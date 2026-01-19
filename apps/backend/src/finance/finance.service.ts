import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { ProfitCalculatorService, TaxSettings } from './profit-calculator.service';
import { Marketplace, OrderStatus } from '@prisma/client';

export interface ProfitFilters {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  marketplace?: Marketplace[];
  groupBy: 'DAY' | 'WEEK' | 'MONTH' | 'MARKETPLACE' | 'PRODUCT';
}

export interface ProfitReportItem {
  label: string;
  revenue: number;
  profit: number;
  margin: number;
  orders: number;
  fees: number;
  taxes: number;
  shipping: number;
  productCost: number;
}

export interface ProfitReport {
  totalRevenue: number;
  totalFees: number;
  totalShipping: number;
  totalTaxes: number;
  totalCost: number;
  netProfit: number;
  profitMargin: number;
  totalOrders: number;
  items: ProfitReportItem[];
}

@Injectable()
export class FinanceService {
  private readonly logger = new Logger(FinanceService.name);
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private profitCalculator: ProfitCalculatorService,
  ) {}

  /**
   * Get profit report with caching
   */
  async getProfitReport(filters: ProfitFilters): Promise<ProfitReport> {
    const cacheKey = this.buildCacheKey('profit_report', filters);

    // Try to get from cache
    const cached = await this.redis.get<ProfitReport>(cacheKey);
    if (cached) {
      this.logger.debug('Returning cached profit report');
      return cached;
    }

    // Build report
    const report = await this.buildProfitReport(filters);

    // Cache the result
    await this.redis.set(cacheKey, report, this.CACHE_TTL);

    return report;
  }

  /**
   * Build profit report from database
   */
  private async buildProfitReport(filters: ProfitFilters): Promise<ProfitReport> {
    const { tenantId, startDate, endDate, marketplace, groupBy } = filters;

    // Get orders within date range
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        orderDate: {
          gte: startDate,
          lte: endDate,
        },
        ...(marketplace && marketplace.length > 0 && {
          marketplace: { in: marketplace },
        }),
        status: {
          in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
        },
      },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        refunds: true,
      },
      orderBy: {
        orderDate: 'asc',
      },
    });

    // Calculate totals
    let totalRevenue = 0;
    let totalFees = 0;
    let totalShipping = 0;
    let totalTaxes = 0;
    let totalCost = 0;
    let netProfit = 0;

    // Group orders
    const groupedData = new Map<string, ProfitReportItem>();

    for (const order of orders) {
      const revenue = this.profitCalculator.decimalToNumber(order.totalAmount);
      const fees = this.profitCalculator.decimalToNumber(order.fees);
      const shipping = this.profitCalculator.decimalToNumber(order.shippingCost);
      const taxes = this.profitCalculator.decimalToNumber(order.taxes);
      const cost = this.profitCalculator.decimalToNumber(order.productCost);
      const profit = this.profitCalculator.decimalToNumber(order.netProfit);

      // Subtract refunds
      const refundAmount = order.refunds.reduce(
        (sum, refund) => sum + this.profitCalculator.decimalToNumber(refund.amount),
        0,
      );

      const adjustedRevenue = revenue - refundAmount;
      const adjustedProfit = profit - refundAmount;

      totalRevenue += adjustedRevenue;
      totalFees += fees;
      totalShipping += shipping;
      totalTaxes += taxes;
      totalCost += cost;
      netProfit += adjustedProfit;

      // Get group key
      const groupKey = this.getGroupKey(order, groupBy);

      // Update grouped data
      const existing = groupedData.get(groupKey) || {
        label: groupKey,
        revenue: 0,
        profit: 0,
        margin: 0,
        orders: 0,
        fees: 0,
        taxes: 0,
        shipping: 0,
        productCost: 0,
      };

      existing.revenue += adjustedRevenue;
      existing.profit += adjustedProfit;
      existing.orders += 1;
      existing.fees += fees;
      existing.taxes += taxes;
      existing.shipping += shipping;
      existing.productCost += cost;

      groupedData.set(groupKey, existing);
    }

    // Calculate margins for grouped items
    const items = Array.from(groupedData.values()).map((item) => ({
      ...item,
      revenue: Math.round(item.revenue * 100) / 100,
      profit: Math.round(item.profit * 100) / 100,
      margin: item.revenue > 0
        ? Math.round((item.profit / item.revenue) * 10000) / 100
        : 0,
      fees: Math.round(item.fees * 100) / 100,
      taxes: Math.round(item.taxes * 100) / 100,
      shipping: Math.round(item.shipping * 100) / 100,
      productCost: Math.round(item.productCost * 100) / 100,
    }));

    // Sort items by label
    items.sort((a, b) => a.label.localeCompare(b.label));

    return {
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalFees: Math.round(totalFees * 100) / 100,
      totalShipping: Math.round(totalShipping * 100) / 100,
      totalTaxes: Math.round(totalTaxes * 100) / 100,
      totalCost: Math.round(totalCost * 100) / 100,
      netProfit: Math.round(netProfit * 100) / 100,
      profitMargin: totalRevenue > 0
        ? Math.round((netProfit / totalRevenue) * 10000) / 100
        : 0,
      totalOrders: orders.length,
      items,
    };
  }

  /**
   * Get group key based on groupBy parameter
   */
  private getGroupKey(
    order: { orderDate: Date; marketplace: Marketplace },
    groupBy: ProfitFilters['groupBy'],
  ): string {
    const date = new Date(order.orderDate);

    switch (groupBy) {
      case 'DAY':
        return date.toISOString().split('T')[0];

      case 'WEEK': {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        return `Week of ${weekStart.toISOString().split('T')[0]}`;
      }

      case 'MONTH':
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      case 'MARKETPLACE':
        return order.marketplace;

      case 'PRODUCT':
        return 'All Products'; // Would need to aggregate by product

      default:
        return date.toISOString().split('T')[0];
    }
  }

  /**
   * Get dashboard KPIs
   */
  async getDashboardKPIs(tenantId: string): Promise<{
    today: { revenue: number; profit: number; orders: number };
    thisMonth: { revenue: number; profit: number; orders: number };
    lastMonth: { revenue: number; profit: number; orders: number };
    growth: { revenue: number; profit: number; orders: number };
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

    const [today, thisMonth, lastMonth] = await Promise.all([
      this.getQuickStats(tenantId, todayStart, now),
      this.getQuickStats(tenantId, monthStart, now),
      this.getQuickStats(tenantId, lastMonthStart, lastMonthEnd),
    ]);

    // Calculate growth percentages
    const growth = {
      revenue: lastMonth.revenue > 0
        ? ((thisMonth.revenue - lastMonth.revenue) / lastMonth.revenue) * 100
        : 0,
      profit: lastMonth.profit > 0
        ? ((thisMonth.profit - lastMonth.profit) / lastMonth.profit) * 100
        : 0,
      orders: lastMonth.orders > 0
        ? ((thisMonth.orders - lastMonth.orders) / lastMonth.orders) * 100
        : 0,
    };

    return {
      today,
      thisMonth,
      lastMonth,
      growth: {
        revenue: Math.round(growth.revenue * 100) / 100,
        profit: Math.round(growth.profit * 100) / 100,
        orders: Math.round(growth.orders * 100) / 100,
      },
    };
  }

  /**
   * Get quick stats for a date range
   */
  private async getQuickStats(
    tenantId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ revenue: number; profit: number; orders: number }> {
    const result = await this.prisma.order.aggregate({
      where: {
        tenantId,
        orderDate: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: [OrderStatus.PAID, OrderStatus.SHIPPED, OrderStatus.DELIVERED],
        },
      },
      _sum: {
        totalAmount: true,
        netProfit: true,
      },
      _count: true,
    });

    return {
      revenue: this.profitCalculator.decimalToNumber(result._sum.totalAmount),
      profit: this.profitCalculator.decimalToNumber(result._sum.netProfit),
      orders: result._count,
    };
  }

  /**
   * Build cache key
   */
  private buildCacheKey(prefix: string, filters: ProfitFilters): string {
    return `${prefix}:${filters.tenantId}:${filters.startDate.toISOString()}:${filters.endDate.toISOString()}:${filters.marketplace?.join(',') || 'all'}:${filters.groupBy}`;
  }

  /**
   * Invalidate cache for tenant
   */
  async invalidateCache(tenantId: string): Promise<void> {
    await this.redis.delPattern(`profit_report:${tenantId}:*`);
  }
}
