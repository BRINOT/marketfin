import {
  Controller,
  Post,
  Body,
  Headers,
  Param,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
  Logger,
  RawBodyRequest,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { WebhookService } from './webhook.service';
import { Marketplace } from '@prisma/client';

@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private webhookService: WebhookService) {}

  /**
   * Mercado Livre webhook endpoint
   */
  @Post('mercado-livre')
  @HttpCode(HttpStatus.OK)
  async handleMercadoLivreWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: any,
    @Headers('x-signature') signature: string,
  ) {
    const rawBody = req.rawBody?.toString() || JSON.stringify(body);

    // Validate signature
    if (signature && !this.webhookService.validateSignature(
      Marketplace.MERCADO_LIVRE,
      rawBody,
      signature,
    )) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    // Determine event type
    const eventType = body.topic || body.resource?.split('/')[1] || 'unknown';

    await this.webhookService.processWebhook({
      marketplace: Marketplace.MERCADO_LIVRE,
      eventType,
      data: body,
      signature,
    });

    return { received: true };
  }

  /**
   * Amazon webhook endpoint (SQS notifications)
   */
  @Post('amazon')
  @HttpCode(HttpStatus.OK)
  async handleAmazonWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: any,
    @Headers('x-amz-sns-message-type') messageType: string,
  ) {
    // Handle SNS subscription confirmation
    if (messageType === 'SubscriptionConfirmation') {
      this.logger.log('Amazon SNS subscription confirmation received');
      // In production, you would confirm the subscription
      return { received: true };
    }

    // Parse SNS message
    const message = typeof body.Message === 'string'
      ? JSON.parse(body.Message)
      : body.Message || body;

    const eventType = message.notificationType || 'unknown';

    await this.webhookService.processWebhook({
      marketplace: Marketplace.AMAZON,
      eventType,
      data: message,
    });

    return { received: true };
  }

  /**
   * Shopee webhook endpoint
   */
  @Post('shopee')
  @HttpCode(HttpStatus.OK)
  async handleShopeeWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() body: any,
    @Headers('authorization') authorization: string,
  ) {
    const rawBody = req.rawBody?.toString() || JSON.stringify(body);

    // Validate signature (Shopee uses authorization header)
    if (authorization && !this.webhookService.validateSignature(
      Marketplace.SHOPEE,
      rawBody,
      authorization,
    )) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const eventType = body.code?.toString() || 'unknown';

    await this.webhookService.processWebhook({
      marketplace: Marketplace.SHOPEE,
      eventType,
      data: body,
      signature: authorization,
    });

    return { received: true };
  }

  /**
   * Generic webhook endpoint for other marketplaces
   */
  @Post(':marketplace')
  @HttpCode(HttpStatus.OK)
  async handleGenericWebhook(
    @Param('marketplace') marketplace: string,
    @Body() body: any,
    @Headers('x-webhook-signature') signature: string,
  ) {
    const marketplaceEnum = marketplace.toUpperCase() as Marketplace;

    if (!Object.values(Marketplace).includes(marketplaceEnum)) {
      this.logger.warn(`Unknown marketplace: ${marketplace}`);
      return { received: true };
    }

    await this.webhookService.processWebhook({
      marketplace: marketplaceEnum,
      eventType: body.event || body.type || 'unknown',
      data: body,
      signature,
    });

    return { received: true };
  }
}
