import { Injectable } from '@nestjs/common';
import { StatsD } from 'hot-shots';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DatadogMetrics {
  private client: StatsD;
  private enabled: boolean;

  constructor(private configService: ConfigService) {
    this.enabled = this.configService.get('DATADOG_ENABLED') === 'true';
    
    if (this.enabled) {
      this.client = new StatsD({
        host: this.configService.get('DD_AGENT_HOST') || 'localhost',
        port: 8125,
        prefix: 'marketfin.',
        globalTags: {
          env: this.configService.get('NODE_ENV') || 'development',
          service: 'marketfin-api',
        },
      });
    }
  }

  // Counter metrics
  incrementOrdersProcessed(marketplace: string, tenantId: string) {
    if (!this.enabled) return;
    this.client.increment('orders.processed', 1, [
      `marketplace:${marketplace}`,
      `tenant:${tenantId}`,
    ]);
  }

  incrementWebhooksReceived(marketplace: string) {
    if (!this.enabled) return;
    this.client.increment('webhooks.received', 1, [`marketplace:${marketplace}`]);
  }

  incrementApiErrors(endpoint: string, errorType: string) {
    if (!this.enabled) return;
    this.client.increment('api.errors', 1, [
      `endpoint:${endpoint}`,
      `error_type:${errorType}`,
    ]);
  }

  incrementSyncJobs(marketplace: string, status: 'success' | 'failure') {
    if (!this.enabled) return;
    this.client.increment('sync.jobs', 1, [
      `marketplace:${marketplace}`,
      `status:${status}`,
    ]);
  }

  // Gauge metrics
  setActiveIntegrations(count: number, tenantId: string) {
    if (!this.enabled) return;
    this.client.gauge('integrations.active', count, [`tenant:${tenantId}`]);
  }

  setQueueSize(queueName: string, size: number) {
    if (!this.enabled) return;
    this.client.gauge('queue.size', size, [`queue:${queueName}`]);
  }

  // Histogram metrics
  recordOrderValue(amount: number, marketplace: string) {
    if (!this.enabled) return;
    this.client.histogram('orders.value', amount, [`marketplace:${marketplace}`]);
  }

  recordSyncDuration(durationMs: number, marketplace: string) {
    if (!this.enabled) return;
    this.client.histogram('sync.duration_ms', durationMs, [`marketplace:${marketplace}`]);
  }

  recordApiLatency(durationMs: number, endpoint: string, method: string) {
    if (!this.enabled) return;
    this.client.histogram('api.latency_ms', durationMs, [
      `endpoint:${endpoint}`,
      `method:${method}`,
    ]);
  }

  // Business metrics
  recordRevenue(amount: number, marketplace: string, tenantId: string) {
    if (!this.enabled) return;
    this.client.histogram('business.revenue', amount, [
      `marketplace:${marketplace}`,
      `tenant:${tenantId}`,
    ]);
  }

  recordProfit(amount: number, marketplace: string, tenantId: string) {
    if (!this.enabled) return;
    this.client.histogram('business.profit', amount, [
      `marketplace:${marketplace}`,
      `tenant:${tenantId}`,
    ]);
  }
}
