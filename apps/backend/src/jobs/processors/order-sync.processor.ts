import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { MercadoLivreConnector } from '../../integration/connectors/mercado-livre.connector';
import { AmazonConnector } from '../../integration/connectors/amazon.connector';
import { ShopeeConnector } from '../../integration/connectors/shopee.connector';
import { Marketplace } from '@prisma/client';

export interface OrderSyncJobData {
  tenantId: string;
  marketplace: Marketplace;
  integrationId: string;
  startDate: string;
  endDate: string;
  page?: number;
}

@Processor('order-sync')
export class OrderSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(OrderSyncProcessor.name);

  constructor(
    private prisma: PrismaService,
    private mercadoLivreConnector: MercadoLivreConnector,
    private amazonConnector: AmazonConnector,
    private shopeeConnector: ShopeeConnector,
  ) {
    super();
  }

  async process(job: Job<OrderSyncJobData>): Promise<{ ordersImported: number; errors: string[] }> {
    const { tenantId, marketplace, integrationId, startDate, endDate, page = 1 } = job.data;
    
    this.logger.log(`Processing order sync for tenant ${tenantId}, marketplace ${marketplace}, page ${page}`);

    const integration = await this.prisma.integration.findUnique({
      where: { id: integrationId },
    });

    if (!integration || integration.status !== 'ACTIVE') {
      throw new Error('Integration not found or inactive');
    }

    let ordersImported = 0;
    const errors: string[] = [];

    try {
      const connector = this.getConnector(marketplace);
      const result = await connector.fetchOrders({
        accessToken: integration.accessToken!,
        refreshToken: integration.refreshToken!,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        page,
        pageSize: 50,
      });

      // Process each order
      for (const orderData of result.orders) {
        try {
          await this.processOrder(tenantId, marketplace, orderData);
          ordersImported++;
        } catch (error) {
          const errorMsg = `Failed to process order ${orderData.marketplaceOrderId}: ${error.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      // If there are more pages, add another job
      if (result.hasMore) {
        await job.queue.add('sync-orders', {
          ...job.data,
          page: page + 1,
        }, {
          delay: 1000, // Rate limiting: 1 second between pages
        });
      }

      // Update last sync timestamp
      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { lastSyncAt: new Date() },
      });

      await job.updateProgress(100);

    } catch (error) {
      this.logger.error(`Order sync failed: ${error.message}`);
      errors.push(error.message);
      
      // Update integration status to ERROR
      await this.prisma.integration.update({
        where: { id: integrationId },
        data: { status: 'ERROR' },
      });
    }

    return { ordersImported, errors };
  }

  private getConnector(marketplace: Marketplace) {
    switch (marketplace) {
      case 'MERCADO_LIVRE':
        return this.mercadoLivreConnector;
      case 'AMAZON':
        return this.amazonConnector;
      case 'SHOPEE':
        return this.shopeeConnector;
      default:
        throw new Error(`Unsupported marketplace: ${marketplace}`);
    }
  }

  private async processOrder(tenantId: string, marketplace: Marketplace, orderData: any) {
    const existingOrder = await this.prisma.order.findUnique({
      where: { marketplaceOrderId: orderData.marketplaceOrderId },
    });

    if (existingOrder) {
      // Update existing order
      await this.prisma.order.update({
        where: { id: existingOrder.id },
        data: {
          status: orderData.status,
          totalAmount: orderData.totalAmount,
          fees: orderData.fees,
          shippingCost: orderData.shippingCost,
          taxes: orderData.taxes,
          netProfit: this.calculateNetProfit(orderData),
        },
      });
    } else {
      // Create new order
      await this.prisma.order.create({
        data: {
          tenantId,
          marketplace,
          marketplaceOrderId: orderData.marketplaceOrderId,
          status: orderData.status,
          orderDate: new Date(orderData.orderDate),
          totalAmount: orderData.totalAmount,
          fees: orderData.fees,
          shippingCost: orderData.shippingCost,
          taxes: orderData.taxes,
          netProfit: this.calculateNetProfit(orderData),
          customerName: orderData.customerName,
          items: {
            create: orderData.items?.map((item: any) => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })) || [],
          },
        },
      });
    }
  }

  private calculateNetProfit(orderData: any): number {
    const totalAmount = parseFloat(orderData.totalAmount) || 0;
    const fees = parseFloat(orderData.fees) || 0;
    const shippingCost = parseFloat(orderData.shippingCost) || 0;
    const taxes = parseFloat(orderData.taxes) || 0;
    const productCost = parseFloat(orderData.productCost) || 0;

    return totalAmount - fees - shippingCost - taxes - productCost;
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<OrderSyncJobData>) {
    this.logger.log(`Order sync job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<OrderSyncJobData>, error: Error) {
    this.logger.error(`Order sync job ${job.id} failed: ${error.message}`);
  }
}
