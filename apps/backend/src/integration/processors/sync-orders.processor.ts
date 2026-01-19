import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { MercadoLivreService } from '../marketplaces/mercado-livre.service';
import { AmazonService } from '../marketplaces/amazon.service';
import { ShopeeService } from '../marketplaces/shopee.service';
import { IntegrationService } from '../integration.service';
import { ProfitCalculatorService, TaxSettings } from '../../finance/profit-calculator.service';
import { Marketplace, OrderStatus, IntegrationStatus } from '@prisma/client';

interface SyncOrdersJobData {
  tenantId: string;
  marketplace: Marketplace;
  startDate: Date;
  endDate: Date;
}

@Processor('sync-orders')
export class SyncOrdersProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncOrdersProcessor.name);

  constructor(
    private prisma: PrismaService,
    private integrationService: IntegrationService,
    private mercadoLivreService: MercadoLivreService,
    private amazonService: AmazonService,
    private shopeeService: ShopeeService,
    private profitCalculator: ProfitCalculatorService,
  ) {
    super();
  }

  async process(job: Job<SyncOrdersJobData>): Promise<{ ordersImported: number; errors: string[] }> {
    const { tenantId, marketplace, startDate, endDate } = job.data;
    this.logger.log(`Starting order sync for ${marketplace} (tenant: ${tenantId})`);

    const errors: string[] = [];
    let ordersImported = 0;

    try {
      // Get integration
      const integration = await this.prisma.integration.findUnique({
        where: {
          tenantId_marketplace: {
            tenantId,
            marketplace,
          },
        },
      });

      if (!integration || integration.status !== IntegrationStatus.ACTIVE) {
        throw new Error('Integration not active');
      }

      // Update status to syncing
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: { status: IntegrationStatus.SYNCING },
      });

      // Get fresh access token
      const accessToken = await this.integrationService.refreshTokenIfNeeded(integration);

      // Get tax settings for profit calculation
      const taxSettings = await this.getTaxSettings(tenantId);

      // Sync based on marketplace
      switch (marketplace) {
        case Marketplace.MERCADO_LIVRE:
          ordersImported = await this.syncMercadoLivreOrders(
            tenantId,
            accessToken,
            integration.sellerId!,
            new Date(startDate),
            new Date(endDate),
            taxSettings,
            errors,
            job,
          );
          break;

        case Marketplace.AMAZON:
          ordersImported = await this.syncAmazonOrders(
            tenantId,
            accessToken,
            new Date(startDate),
            new Date(endDate),
            taxSettings,
            errors,
            job,
          );
          break;

        case Marketplace.SHOPEE:
          ordersImported = await this.syncShopeeOrders(
            tenantId,
            accessToken,
            integration.sellerId!,
            new Date(startDate),
            new Date(endDate),
            taxSettings,
            errors,
            job,
          );
          break;

        default:
          throw new Error(`Marketplace ${marketplace} not supported`);
      }

      // Update integration status
      await this.prisma.integration.update({
        where: { id: integration.id },
        data: {
          status: IntegrationStatus.ACTIVE,
          lastSyncAt: new Date(),
          syncError: errors.length > 0 ? errors.join('; ') : null,
        },
      });

      this.logger.log(`Sync completed: ${ordersImported} orders imported`);
    } catch (error) {
      this.logger.error(`Sync failed:`, error);
      errors.push(error instanceof Error ? error.message : 'Unknown error');

      // Update integration with error
      await this.prisma.integration.updateMany({
        where: {
          tenantId,
          marketplace,
        },
        data: {
          status: IntegrationStatus.ERROR,
          syncError: errors.join('; '),
        },
      });
    }

    return { ordersImported, errors };
  }

  /**
   * Sync orders from Mercado Livre
   */
  private async syncMercadoLivreOrders(
    tenantId: string,
    accessToken: string,
    sellerId: string,
    startDate: Date,
    endDate: Date,
    taxSettings: TaxSettings,
    errors: string[],
    job: Job,
  ): Promise<number> {
    let ordersImported = 0;
    let offset = 0;
    const limit = 50;
    let hasMore = true;

    while (hasMore) {
      const { orders, total } = await this.mercadoLivreService.fetchOrders(
        accessToken,
        sellerId,
        startDate,
        endDate,
        offset,
        limit,
      );

      for (const mlOrder of orders) {
        try {
          await this.processOrder(
            tenantId,
            Marketplace.MERCADO_LIVRE,
            mlOrder.id.toString(),
            {
              status: this.mercadoLivreService.mapOrderStatus(mlOrder.status) as OrderStatus,
              orderDate: new Date(mlOrder.date_created),
              totalAmount: mlOrder.total_amount,
              fees: this.mercadoLivreService.calculateFees(mlOrder),
              shippingCost: mlOrder.shipping_cost || 0,
              customerName: mlOrder.buyer?.nickname,
              customerEmail: mlOrder.buyer?.email,
              items: mlOrder.order_items.map((item: any) => ({
                sku: item.item.seller_sku || item.item.id,
                name: item.item.title,
                quantity: item.quantity,
                unitPrice: item.unit_price,
                externalProductId: item.item.id,
              })),
              rawData: mlOrder,
            },
            taxSettings,
          );
          ordersImported++;
        } catch (error) {
          const errorMsg = `Failed to process order ${mlOrder.id}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      offset += limit;
      hasMore = offset < total;

      // Update job progress
      await job.updateProgress(Math.min(100, Math.round((offset / total) * 100)));
    }

    return ordersImported;
  }

  /**
   * Sync orders from Amazon
   */
  private async syncAmazonOrders(
    tenantId: string,
    accessToken: string,
    startDate: Date,
    endDate: Date,
    taxSettings: TaxSettings,
    errors: string[],
    job: Job,
  ): Promise<number> {
    let ordersImported = 0;
    let nextToken: string | undefined;

    do {
      const { orders, nextToken: newNextToken } = await this.amazonService.fetchOrders(
        accessToken,
        startDate,
        endDate,
        nextToken,
      );

      for (const amazonOrder of orders) {
        try {
          await this.processOrder(
            tenantId,
            Marketplace.AMAZON,
            amazonOrder.AmazonOrderId,
            {
              status: this.amazonService.mapOrderStatus(amazonOrder.OrderStatus) as OrderStatus,
              orderDate: new Date(amazonOrder.PurchaseDate),
              totalAmount: parseFloat(amazonOrder.OrderTotal?.Amount || '0'),
              fees: 0, // Amazon fees need to be fetched separately
              shippingCost: 0,
              customerName: amazonOrder.BuyerInfo?.BuyerName,
              items: [], // Items need to be fetched separately
              rawData: amazonOrder,
            },
            taxSettings,
          );
          ordersImported++;
        } catch (error) {
          const errorMsg = `Failed to process Amazon order ${amazonOrder.AmazonOrderId}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      nextToken = newNextToken;
    } while (nextToken);

    return ordersImported;
  }

  /**
   * Sync orders from Shopee
   */
  private async syncShopeeOrders(
    tenantId: string,
    accessToken: string,
    shopId: string,
    startDate: Date,
    endDate: Date,
    taxSettings: TaxSettings,
    errors: string[],
    job: Job,
  ): Promise<number> {
    let ordersImported = 0;
    let cursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const result = await this.shopeeService.fetchOrders(
        accessToken,
        shopId,
        startDate,
        endDate,
        cursor,
      );

      for (const shopeeOrder of result.orders) {
        try {
          await this.processOrder(
            tenantId,
            Marketplace.SHOPEE,
            shopeeOrder.order_sn,
            {
              status: this.shopeeService.mapOrderStatus(shopeeOrder.order_status) as OrderStatus,
              orderDate: new Date(shopeeOrder.create_time * 1000),
              totalAmount: shopeeOrder.total_amount,
              fees: shopeeOrder.commission_fee || 0,
              shippingCost: shopeeOrder.actual_shipping_fee || 0,
              items: [],
              rawData: shopeeOrder,
            },
            taxSettings,
          );
          ordersImported++;
        } catch (error) {
          const errorMsg = `Failed to process Shopee order ${shopeeOrder.order_sn}: ${error instanceof Error ? error.message : 'Unknown error'}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      cursor = result.nextCursor;
      hasMore = result.hasMore;
    }

    return ordersImported;
  }

  /**
   * Process and save an order
   */
  private async processOrder(
    tenantId: string,
    marketplace: Marketplace,
    marketplaceOrderId: string,
    orderData: {
      status: OrderStatus;
      orderDate: Date;
      totalAmount: number;
      fees: number;
      shippingCost: number;
      customerName?: string;
      customerEmail?: string;
      items: Array<{
        sku: string;
        name: string;
        quantity: number;
        unitPrice: number;
        externalProductId?: string;
      }>;
      rawData: any;
    },
    taxSettings: TaxSettings,
  ): Promise<void> {
    // Calculate product cost from items
    let productCost = 0;
    const itemsWithCost = [];

    for (const item of orderData.items) {
      // Try to find product by SKU
      const product = await this.prisma.product.findFirst({
        where: {
          tenantId,
          sku: item.sku,
        },
      });

      const unitCost = product
        ? this.profitCalculator.decimalToNumber(product.costPrice)
        : item.unitPrice * 0.6; // Estimate 40% margin if no product found

      productCost += unitCost * item.quantity;

      itemsWithCost.push({
        ...item,
        unitCost,
        totalPrice: item.unitPrice * item.quantity,
        productId: product?.id,
      });
    }

    // Calculate profit
    const profitResult = this.profitCalculator.calculate({
      orderTotal: orderData.totalAmount,
      fees: [orderData.fees],
      shippingCost: orderData.shippingCost,
      shippingPaidByBuyer: 0,
      productCost,
      taxSettings,
    });

    // Upsert order
    await this.prisma.order.upsert({
      where: {
        marketplaceOrderId,
      },
      update: {
        status: orderData.status,
        totalAmount: orderData.totalAmount,
        subtotal: orderData.totalAmount,
        fees: orderData.fees,
        shippingCost: orderData.shippingCost,
        taxes: profitResult.taxes,
        productCost,
        netProfit: profitResult.netProfit,
        profitMargin: profitResult.profitMargin,
        rawData: orderData.rawData,
      },
      create: {
        tenantId,
        marketplace,
        marketplaceOrderId,
        status: orderData.status,
        orderDate: orderData.orderDate,
        totalAmount: orderData.totalAmount,
        subtotal: orderData.totalAmount,
        fees: orderData.fees,
        shippingCost: orderData.shippingCost,
        shippingPaidByBuyer: 0,
        taxes: profitResult.taxes,
        productCost,
        netProfit: profitResult.netProfit,
        profitMargin: profitResult.profitMargin,
        customerName: orderData.customerName,
        customerEmail: orderData.customerEmail,
        rawData: orderData.rawData,
        items: {
          create: itemsWithCost.map((item) => ({
            sku: item.sku,
            name: item.name,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            unitCost: item.unitCost,
            totalPrice: item.totalPrice,
            productId: item.productId,
            externalProductId: item.externalProductId,
          })),
        },
      },
    });
  }

  /**
   * Get tax settings for tenant
   */
  private async getTaxSettings(tenantId: string): Promise<TaxSettings> {
    const settings = await this.prisma.taxSettings.findUnique({
      where: { tenantId },
    });

    if (!settings) {
      // Return default settings
      return {
        icmsRate: 0.18,
        pisCofinsRate: 0.0465,
        taxRegime: 'SIMPLES_NACIONAL',
        simplesRate: 0.06, // 6% default Simples rate
      };
    }

    return {
      icmsRate: this.profitCalculator.decimalToNumber(settings.icmsRate),
      pisCofinsRate: this.profitCalculator.decimalToNumber(settings.pisCofinsRate),
      issRate: settings.issRate
        ? this.profitCalculator.decimalToNumber(settings.issRate)
        : undefined,
      simplesRate: settings.simplesRate
        ? this.profitCalculator.decimalToNumber(settings.simplesRate)
        : undefined,
      taxRegime: settings.taxRegime,
    };
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.log(`Job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed:`, error);
  }
}
