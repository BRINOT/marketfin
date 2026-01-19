import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'event', level: 'query' },
        { emit: 'stdout', level: 'info' },
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });

    // Multi-tenancy middleware
    this.$use(this.multiTenancyMiddleware.bind(this));
    
    // LGPD data anonymization middleware
    this.$use(this.lgpdMiddleware.bind(this));
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  /**
   * Multi-tenancy middleware
   * Automatically injects tenantId filter for tenant-scoped models
   */
  private async multiTenancyMiddleware(
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<any>,
  ) {
    const tenantScopedModels = [
      'Order',
      'Product',
      'Integration',
      'Expense',
      'User',
    ];

    // Skip if not a tenant-scoped model
    if (!tenantScopedModels.includes(params.model || '')) {
      return next(params);
    }

    // Get tenantId from async local storage (set by auth middleware)
    const tenantId = this.getCurrentTenantId();
    
    if (!tenantId) {
      return next(params);
    }

    // Inject tenantId filter for read operations
    if (['findUnique', 'findFirst', 'findMany', 'count', 'aggregate'].includes(params.action)) {
      if (!params.args) params.args = {};
      if (!params.args.where) params.args.where = {};
      params.args.where.tenantId = tenantId;
    }

    // Inject tenantId for create operations
    if (['create', 'createMany'].includes(params.action)) {
      if (!params.args) params.args = {};
      if (params.action === 'create') {
        params.args.data = { ...params.args.data, tenantId };
      } else if (params.action === 'createMany') {
        params.args.data = params.args.data.map((item: any) => ({
          ...item,
          tenantId,
        }));
      }
    }

    // Inject tenantId filter for update/delete operations
    if (['update', 'updateMany', 'delete', 'deleteMany'].includes(params.action)) {
      if (!params.args) params.args = {};
      if (!params.args.where) params.args.where = {};
      params.args.where.tenantId = tenantId;
    }

    return next(params);
  }

  /**
   * LGPD middleware
   * Anonymizes customer data in orders older than 30 days
   */
  private async lgpdMiddleware(
    params: Prisma.MiddlewareParams,
    next: (params: Prisma.MiddlewareParams) => Promise<any>,
  ) {
    const result = await next(params);

    // Anonymize customer data for orders older than 30 days
    if (params.model === 'Order' && ['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const anonymize = (order: any) => {
        if (order && new Date(order.orderDate) < thirtyDaysAgo) {
          return {
            ...order,
            customerName: '[ANONYMIZED]',
            customerEmail: '[ANONYMIZED]',
            shippingAddress: null,
          };
        }
        return order;
      };

      if (Array.isArray(result)) {
        return result.map(anonymize);
      }
      return anonymize(result);
    }

    return result;
  }

  /**
   * Get current tenant ID from async local storage
   * This should be set by the auth middleware
   */
  private getCurrentTenantId(): string | null {
    // In a real implementation, this would use AsyncLocalStorage
    // For now, return null to skip tenant filtering
    return (global as any).__currentTenantId || null;
  }

  /**
   * Set current tenant ID (called by auth middleware)
   */
  setCurrentTenantId(tenantId: string | null) {
    (global as any).__currentTenantId = tenantId;
  }

  /**
   * Execute operations without tenant filtering
   * Use with caution - only for admin operations
   */
  async withoutTenantFilter<T>(callback: () => Promise<T>): Promise<T> {
    const previousTenantId = (global as any).__currentTenantId;
    (global as any).__currentTenantId = null;
    try {
      return await callback();
    } finally {
      (global as any).__currentTenantId = previousTenantId;
    }
  }
}
