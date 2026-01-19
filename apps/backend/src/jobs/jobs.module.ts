import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrderSyncProcessor } from './processors/order-sync.processor';
import { WebhookProcessor } from './processors/webhook.processor';
import { IntegrationModule } from '../integration/integration.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'order-sync' },
      { name: 'webhook-processing' },
      { name: 'report-generation' },
    ),
    IntegrationModule,
    PrismaModule,
  ],
  providers: [OrderSyncProcessor, WebhookProcessor],
  exports: [BullModule],
})
export class JobsModule {}
