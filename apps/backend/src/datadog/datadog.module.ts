import { Module, Global, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import tracer from 'dd-trace';

@Global()
@Module({})
export class DatadogModule implements OnModuleInit {
  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const enabled = this.configService.get('DATADOG_ENABLED') === 'true';
    
    if (enabled) {
      tracer.init({
        service: 'marketfin-api',
        env: this.configService.get('NODE_ENV') || 'development',
        version: this.configService.get('APP_VERSION') || '1.0.0',
        logInjection: true,
        runtimeMetrics: true,
        profiling: true,
        appsec: true,
        // APM settings
        sampleRate: 1,
        // Tags
        tags: {
          'app.name': 'marketfin',
          'app.type': 'api',
        },
      });

      // Enable tracing for specific integrations
      tracer.use('express');
      tracer.use('graphql', { depth: 3 });
      tracer.use('pg');
      tracer.use('redis');
      tracer.use('http');

      console.log('Datadog APM initialized');
    }
  }
}
