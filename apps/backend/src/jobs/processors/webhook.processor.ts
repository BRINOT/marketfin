import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../../prisma/prisma.service';
import { Marketplace, OrderStatus } from '@prisma/client';

export interface WebhookJobData {
  marketplace: Marketplace;
  eventType: string;
  payload: any;
  receivedAt: string;
}

@Processor('webhook-processing')
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private prisma: PrismaService) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<void> {
    const { marketplace, eventType, payload } = job.data;
    
    this.logger.log(`Processing webhook: ${marketplace} - ${eventType}`);

    try {
      switch (marketplace) {
        case 'MERCADO_LIVRE':
          await this.processMercadoLivreWebhook(eventType, payload);
          break;
        case 'AMAZON':
          await this.processAmazonWebhook(eventType, payload);
          break;
        case 'SHOPEE':
          await this.processShopeeWebhook(eventType, payload);
          break;
        default:
          this.logger.warn(`Unsupported marketplace webhook: ${marketplace}`);
      }
    } catch (error) {
      this.logger.error(`Webhook processing failed: ${error.message}`);
      throw error;
    }
  }

  private async processMercadoLivreWebhook(eventType: string, payload: any): Promise<void> {
    switch (eventType) {
      case 'orders_v2':
        await this.handleMercadoLivreOrder(payload);
        break;
      case 'shipments':
        await this.handleMercadoLivreShipment(payload);
        break;
      case 'payments':
        await this.handleMercadoLivrePayment(payload);
        break;
      default:
        this.logger.log(`Unhandled ML event type: ${eventType}`);
    }
  }

  private async handleMercadoLivreOrder(payload: any): Promise<void> {
    const { resource, user_id } = payload;
    
    // Find integration by ML user ID
    const integration = await this.prisma.integration.findFirst({
      where: {
        marketplace: 'MERCADO_LIVRE',
        settings: {
          path: ['sellerId'],
          equals: user_id.toString(),
        },
      },
    });

    if (!integration) {
      this.logger.warn(`No integration found for ML user ${user_id}`);
      return;
    }

    // Extract order ID from resource path
    const orderId = resource.split('/').pop();
    
    // Fetch full order details from ML API
    // This would typically call the ML API to get order details
    // For now, we'll just update the status based on the webhook
    
    const existingOrder = await this.prisma.order.findUnique({
      where: { marketplaceOrderId: orderId },
    });

    if (existingOrder) {
      this.logger.log(`Order ${orderId} already exists, will be updated on next sync`);
    } else {
      this.logger.log(`New order ${orderId} detected, triggering sync`);
      // Could trigger an immediate sync job here
    }
  }

  private async handleMercadoLivreShipment(payload: any): Promise<void> {
    const { resource } = payload;
    const shipmentId = resource.split('/').pop();
    
    // Find order by shipment and update status
    const order = await this.prisma.order.findFirst({
      where: {
        marketplace: 'MERCADO_LIVRE',
        // Would need to store shipment ID in order or separate table
      },
    });

    if (order) {
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: 'SHIPPED' },
      });
    }
  }

  private async handleMercadoLivrePayment(payload: any): Promise<void> {
    // Handle payment status updates
    this.logger.log('Processing ML payment webhook');
  }

  private async processAmazonWebhook(eventType: string, payload: any): Promise<void> {
    switch (eventType) {
      case 'ORDER_CHANGE':
        await this.handleAmazonOrderChange(payload);
        break;
      case 'FULFILLMENT_ORDER_STATUS':
        await this.handleAmazonFulfillment(payload);
        break;
      default:
        this.logger.log(`Unhandled Amazon event type: ${eventType}`);
    }
  }

  private async handleAmazonOrderChange(payload: any): Promise<void> {
    const { AmazonOrderId, OrderStatus: status } = payload;
    
    const order = await this.prisma.order.findUnique({
      where: { marketplaceOrderId: AmazonOrderId },
    });

    if (order) {
      const mappedStatus = this.mapAmazonStatus(status);
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: mappedStatus },
      });
    }
  }

  private async handleAmazonFulfillment(payload: any): Promise<void> {
    this.logger.log('Processing Amazon fulfillment webhook');
  }

  private async processShopeeWebhook(eventType: string, payload: any): Promise<void> {
    switch (eventType) {
      case 'order_status_update':
        await this.handleShopeeOrderStatus(payload);
        break;
      default:
        this.logger.log(`Unhandled Shopee event type: ${eventType}`);
    }
  }

  private async handleShopeeOrderStatus(payload: any): Promise<void> {
    const { ordersn, status } = payload;
    
    const order = await this.prisma.order.findUnique({
      where: { marketplaceOrderId: ordersn },
    });

    if (order) {
      const mappedStatus = this.mapShopeeStatus(status);
      await this.prisma.order.update({
        where: { id: order.id },
        data: { status: mappedStatus },
      });
    }
  }

  private mapAmazonStatus(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'Pending': 'PENDING',
      'Unshipped': 'PAID',
      'PartiallyShipped': 'SHIPPED',
      'Shipped': 'SHIPPED',
      'Delivered': 'DELIVERED',
      'Canceled': 'CANCELLED',
    };
    return statusMap[status] || 'PENDING';
  }

  private mapShopeeStatus(status: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      'UNPAID': 'PENDING',
      'READY_TO_SHIP': 'PAID',
      'SHIPPED': 'SHIPPED',
      'COMPLETED': 'DELIVERED',
      'CANCELLED': 'CANCELLED',
      'IN_CANCEL': 'CANCELLED',
    };
    return statusMap[status] || 'PENDING';
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<WebhookJobData>) {
    this.logger.log(`Webhook job ${job.id} completed`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<WebhookJobData>, error: Error) {
    this.logger.error(`Webhook job ${job.id} failed: ${error.message}`);
  }
}
