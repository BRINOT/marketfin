import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Plan } from '@prisma/client';

export interface TaxSettings {
  icmsRate: number;
  pisCofinsRate: number;
  issRate: number;
  simpleNacionalRate: number;
  taxRegime: string;
}

export interface NotificationSettings {
  emailNotifications: boolean;
  lowStockAlert: boolean;
  lowStockThreshold: number;
  dailyReport: boolean;
  weeklyReport: boolean;
}

@Injectable()
export class TenantService {
  constructor(private prisma: PrismaService) {}

  async getTenant(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant não encontrado');
    }

    return tenant;
  }

  async getTenantSettings(tenantId: string) {
    const tenant = await this.getTenant(tenantId);

    // Parse settings from JSON or return defaults
    const settings = (tenant as any).settings || {};

    return {
      id: tenant.id,
      name: tenant.name,
      plan: tenant.plan,
      taxSettings: settings.taxSettings || {
        icmsRate: 18,
        pisCofinsRate: 4.65,
        issRate: 5,
        simpleNacionalRate: 6,
        taxRegime: 'SIMPLES_NACIONAL',
      },
      notificationSettings: settings.notificationSettings || {
        emailNotifications: true,
        lowStockAlert: true,
        lowStockThreshold: 10,
        dailyReport: false,
        weeklyReport: true,
      },
    };
  }

  async updateTenant(tenantId: string, data: { name?: string }) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data,
    });
  }

  async updateTaxSettings(tenantId: string, taxSettings: TaxSettings) {
    const tenant = await this.getTenant(tenantId);
    const currentSettings = (tenant as any).settings || {};

    await this.prisma.$executeRaw`
      UPDATE "Tenant" 
      SET settings = ${JSON.stringify({ ...currentSettings, taxSettings })}::jsonb
      WHERE id = ${tenantId}
    `;

    return taxSettings;
  }

  async updateNotificationSettings(
    tenantId: string,
    notificationSettings: NotificationSettings,
  ) {
    const tenant = await this.getTenant(tenantId);
    const currentSettings = (tenant as any).settings || {};

    await this.prisma.$executeRaw`
      UPDATE "Tenant" 
      SET settings = ${JSON.stringify({ ...currentSettings, notificationSettings })}::jsonb
      WHERE id = ${tenantId}
    `;

    return notificationSettings;
  }

  async updatePlan(tenantId: string, plan: Plan) {
    return this.prisma.tenant.update({
      where: { id: tenantId },
      data: { plan },
    });
  }

  async getTenantUsage(tenantId: string) {
    const [ordersCount, integrationsCount, usersCount] = await Promise.all([
      this.prisma.order.count({
        where: {
          tenantId,
          orderDate: {
            gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
          },
        },
      }),
      this.prisma.integration.count({
        where: { tenantId },
      }),
      this.prisma.user.count({
        where: { tenantId },
      }),
    ]);

    const tenant = await this.getTenant(tenantId);
    const limits = this.getPlanLimits(tenant.plan);

    return {
      orders: ordersCount,
      ordersLimit: limits.maxOrders,
      integrations: integrationsCount,
      integrationsLimit: limits.maxIntegrations,
      users: usersCount,
      usersLimit: limits.maxUsers,
    };
  }

  getPlanLimits(plan: Plan) {
    const limits = {
      FREE: {
        maxOrders: 1000,
        maxIntegrations: 1,
        maxUsers: 1,
        price: 0,
      },
      PRO: {
        maxOrders: 10000,
        maxIntegrations: 5,
        maxUsers: 5,
        price: 4900,
      },
      ENTERPRISE: {
        maxOrders: Infinity,
        maxIntegrations: Infinity,
        maxUsers: Infinity,
        price: 49900,
      },
    };

    return limits[plan];
  }
}
