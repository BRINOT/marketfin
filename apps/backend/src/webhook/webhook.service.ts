import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Marketplace } from '@prisma/client';
import * as crypto from 'crypto';

export interface WebhookPayload {
  marketplace: Marketplace;
  eventType: string;
  data: any;
  signature?: string;
  timestamp?: number;
}

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
    @InjectQueue('webhook-processing') private webhookQueue: Queue,
  ) {}

  /**
   * Validate webhook signature
   */
  validateSignature(
    marketplace: Marketplace,
    payload: string,
    signature: string,
  ): boolean {
    let secret: string | undefined;
    let expectedSignature: string;

    switch (marketplace) {
      case Marketplace.MERCADO_LIVRE:
        secret = this.configService.get<string>('MERCADO_LIVRE_WEBHOOK_SECRET');
        if (!secret) return true; // Skip validation if no secret configured
        expectedSignature = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');
        break;

      case Marketplace.AMAZON:
        // Amazon uses different signature validation
        secret = this.configService.get<string>('AMAZON_WEBHOOK_SECRET');
        if (!secret) return true;
        expectedSignature = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('base64');
        break;

      case Marketplace.SHOPEE:
        secret = this.configService.get<string>('SHOPEE_WEBHOOK_SECRET');
        if (!secret) return true;
        expectedSignature = crypto
          .createHmac('sha256', secret)
          .update(payload)
          .digest('hex');
        break;

      default:
        return true;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  /**
   * Process incoming webhook
   */
  async processWebhook(payload: WebhookPayload): Promise<void> {
    // Store webhook event
    const event = await this.prisma.webhookEvent.create({
      data: {
        marketplace: payload.marketplace,
        eventType: payload.eventType,
        payload: payload.data,
        signature: payload.signature,
      },
    });

    // Queue for processing
    await this.webhookQueue.add(
      'process-webhook',
      {
        eventId: event.id,
        marketplace: payload.marketplace,
        eventType: payload.eventType,
        data: payload.data,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    this.logger.log(`Webhook queued: ${payload.marketplace} - ${payload.eventType}`);
  }

  /**
   * Get tenant ID from webhook data
   */
  async getTenantFromWebhook(
    marketplace: Marketplace,
    data: any,
  ): Promise<string | null> {
    let sellerId: string | undefined;

    switch (marketplace) {
      case Marketplace.MERCADO_LIVRE:
        sellerId = data.user_id?.toString();
        break;

      case Marketplace.AMAZON:
        sellerId = data.sellerId;
        break;

      case Marketplace.SHOPEE:
        sellerId = data.shop_id?.toString();
        break;
    }

    if (!sellerId) return null;

    const integration = await this.prisma.integration.findFirst({
      where: {
        marketplace,
        sellerId,
      },
    });

    return integration?.tenantId || null;
  }

  /**
   * Mark webhook as processed
   */
  async markProcessed(eventId: string, error?: string): Promise<void> {
    await this.prisma.webhookEvent.update({
      where: { id: eventId },
      data: {
        processed: !error,
        processedAt: new Date(),
        error,
      },
    });
  }
}
