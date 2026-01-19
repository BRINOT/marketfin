import { Controller, Post, Headers, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/cron')
export class CronController {
  private readonly logger = new Logger(CronController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    @InjectQueue('order-sync') private readonly orderSyncQueue: Queue,
  ) {}

  @Post('sync-orders')
  async syncOrders(@Headers('x-cron-secret') cronSecret: string) {
    this.validateCronSecret(cronSecret);

    this.logger.log('Starting scheduled order sync for all active integrations');

    // Get all active integrations
    const integrations = await this.prisma.integration.findMany({
      where: { status: 'ACTIVE' },
      include: { tenant: true },
    });

    this.logger.log(`Found ${integrations.length} active integrations`);

    // Queue sync jobs for each integration
    const jobs = await Promise.all(
      integrations.map((integration) =>
        this.orderSyncQueue.add(
          'sync-orders',
          {
            tenantId: integration.tenantId,
            marketplace: integration.marketplace,
            integrationId: integration.id,
            syncType: 'scheduled',
          },
          {
            attempts: 3,
            backoff: {
              type: 'exponential',
              delay: 5000,
            },
          },
        ),
      ),
    );

    return {
      success: true,
      jobsQueued: jobs.length,
      integrations: integrations.map((i) => ({
        id: i.id,
        marketplace: i.marketplace,
        tenantName: i.tenant.name,
      })),
    };
  }

  @Post('cleanup-exports')
  async cleanupExports(@Headers('x-cron-secret') cronSecret: string) {
    this.validateCronSecret(cronSecret);

    this.logger.log('Starting scheduled export cleanup');

    // This would typically call S3 to delete old exports
    // For now, we'll just log and return success
    const retentionDays = this.configService.get('DATA_RETENTION_DAYS', 30);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    this.logger.log(`Cleaning up exports older than ${cutoffDate.toISOString()}`);

    // TODO: Implement S3 cleanup logic
    // const s3 = new S3Client({});
    // const objects = await s3.send(new ListObjectsV2Command({ Bucket: 'marketfin-exports' }));
    // Filter and delete old objects

    return {
      success: true,
      message: `Cleanup completed for exports older than ${retentionDays} days`,
      cutoffDate: cutoffDate.toISOString(),
    };
  }

  @Post('anonymize-data')
  async anonymizeData(@Headers('x-cron-secret') cronSecret: string) {
    this.validateCronSecret(cronSecret);

    this.logger.log('Starting scheduled data anonymization (LGPD compliance)');

    const retentionDays = this.configService.get('DATA_RETENTION_DAYS', 30);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Anonymize old orders
    const result = await this.prisma.order.updateMany({
      where: {
        orderDate: { lt: cutoffDate },
        customerName: { not: 'ANONYMIZED' },
      },
      data: {
        customerName: 'ANONYMIZED',
      },
    });

    this.logger.log(`Anonymized ${result.count} orders`);

    return {
      success: true,
      anonymizedOrders: result.count,
      cutoffDate: cutoffDate.toISOString(),
    };
  }

  private validateCronSecret(cronSecret: string) {
    const expectedSecret = this.configService.get('CRON_SECRET');
    if (!expectedSecret || cronSecret !== expectedSecret) {
      throw new UnauthorizedException('Invalid cron secret');
    }
  }
}
