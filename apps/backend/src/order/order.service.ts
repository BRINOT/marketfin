import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Order, OrderStatus, Marketplace, Prisma } from '@prisma/client';

export interface OrderFilters {
  tenantId: string;
  startDate?: Date;
  endDate?: Date;
  status?: OrderStatus[];
  marketplace?: Marketplace[];
  search?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedOrders {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class OrderService {
  private readonly logger = new Logger(OrderService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get orders with filters and pagination
   */
  async getOrders(filters: OrderFilters): Promise<PaginatedOrders> {
    const {
      tenantId,
      startDate,
      endDate,
      status,
      marketplace,
      search,
      page = 1,
      limit = 20,
    } = filters;

    const where: Prisma.OrderWhereInput = {
      tenantId,
      ...(startDate && endDate && {
        orderDate: {
          gte: startDate,
          lte: endDate,
        },
      }),
      ...(status && status.length > 0 && {
        status: { in: status },
      }),
      ...(marketplace && marketplace.length > 0 && {
        marketplace: { in: marketplace },
      }),
      ...(search && {
        OR: [
          { marketplaceOrderId: { contains: search, mode: 'insensitive' } },
          { customerName: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        include: {
          items: {
            include: {
              product: true,
            },
          },
          refunds: true,
        },
        orderBy: { orderDate: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Get order by ID
   */
  async getOrderById(id: string, tenantId: string): Promise<Order> {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
        refunds: true,
      },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  /**
   * Get order by marketplace order ID
   */
  async getOrderByMarketplaceId(
    marketplaceOrderId: string,
    tenantId: string,
  ): Promise<Order | null> {
    return this.prisma.order.findFirst({
      where: { marketplaceOrderId, tenantId },
      include: {
        items: true,
        refunds: true,
      },
    });
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    id: string,
    tenantId: string,
    status: OrderStatus,
  ): Promise<Order> {
    const order = await this.prisma.order.findFirst({
      where: { id, tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return this.prisma.order.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Create refund for order
   */
  async createRefund(
    orderId: string,
    tenantId: string,
    amount: number,
    reason?: string,
  ): Promise<Order> {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, tenantId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    // Create refund and update order
    await this.prisma.refund.create({
      data: {
        orderId,
        amount,
        reason,
        refundDate: new Date(),
        status: 'COMPLETED',
      },
    });

    // Update order status if fully refunded
    const totalRefunds = await this.prisma.refund.aggregate({
      where: { orderId },
      _sum: { amount: true },
    });

    const totalRefundAmount = totalRefunds._sum.amount?.toNumber() || 0;
    const orderTotal = order.totalAmount.toNumber();

    if (totalRefundAmount >= orderTotal) {
      await this.prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.REFUNDED },
      });
    }

    return this.getOrderById(orderId, tenantId);
  }

  /**
   * Get order statistics
   */
  async getOrderStats(tenantId: string): Promise<{
    totalOrders: number;
    pendingOrders: number;
    shippedOrders: number;
    deliveredOrders: number;
    cancelledOrders: number;
  }> {
    const [total, pending, shipped, delivered, cancelled] = await Promise.all([
      this.prisma.order.count({ where: { tenantId } }),
      this.prisma.order.count({ where: { tenantId, status: OrderStatus.PENDING } }),
      this.prisma.order.count({ where: { tenantId, status: OrderStatus.SHIPPED } }),
      this.prisma.order.count({ where: { tenantId, status: OrderStatus.DELIVERED } }),
      this.prisma.order.count({ where: { tenantId, status: OrderStatus.CANCELLED } }),
    ]);

    return {
      totalOrders: total,
      pendingOrders: pending,
      shippedOrders: shipped,
      deliveredOrders: delivered,
      cancelledOrders: cancelled,
    };
  }
}
