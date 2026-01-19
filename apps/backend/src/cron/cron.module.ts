import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CronController } from './cron.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    BullModule.registerQueue({
      name: 'order-sync',
    }),
  ],
  controllers: [CronController],
})
export class CronModule {}
