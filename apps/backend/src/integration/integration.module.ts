import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { IntegrationService } from './integration.service';
import { IntegrationResolver } from './integration.resolver';
import { MercadoLivreService } from './marketplaces/mercado-livre.service';
import { AmazonService } from './marketplaces/amazon.service';
import { ShopeeService } from './marketplaces/shopee.service';
import { SyncOrdersProcessor } from './processors/sync-orders.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'sync-orders',
    }),
    BullModule.registerQueue({
      name: 'webhook-processing',
    }),
  ],
  providers: [
    IntegrationService,
    IntegrationResolver,
    MercadoLivreService,
    AmazonService,
    ShopeeService,
    SyncOrdersProcessor,
  ],
  exports: [IntegrationService],
})
export class IntegrationModule {}
