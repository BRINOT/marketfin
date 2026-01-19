import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Plan } from '@prisma/client';
import Stripe from 'stripe';

export interface PlanLimits {
  maxOrders: number;
  maxIntegrations: number;
  maxUsers: number;
  price: number; // in cents (BRL)
  features: string[];
}

export const PLANS: Record<Plan, PlanLimits> = {
  FREE: {
    maxOrders: 1000,
    maxIntegrations: 2,
    maxUsers: 1,
    price: 0,
    features: [
      'Até 1.000 pedidos/mês',
      '2 integrações',
      '1 usuário',
      'Relatórios básicos',
    ],
  },
  PRO: {
    maxOrders: 10000,
    maxIntegrations: 5,
    maxUsers: 5,
    price: 4900, // R$49,00
    features: [
      'Até 10.000 pedidos/mês',
      '5 integrações',
      '5 usuários',
      'Relatórios avançados',
      'Exportação PDF/Excel',
      'Suporte prioritário',
    ],
  },
  ENTERPRISE: {
    maxOrders: Infinity,
    maxIntegrations: Infinity,
    maxUsers: Infinity,
    price: 49900, // R$499,00
    features: [
      'Pedidos ilimitados',
      'Integrações ilimitadas',
      'Usuários ilimitados',
      'API dedicada',
      'Suporte 24/7',
      'SLA garantido',
      'Onboarding personalizado',
    ],
  },
};

@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);
  private stripe: Stripe;

  constructor(private prisma: PrismaService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
      apiVersion: '2023-10-16',
    });
  }

  async getTenantPlan(tenantId: string): Promise<Plan> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { plan: true },
    });
    return tenant?.plan || 'FREE';
  }

  async getPlanLimits(tenantId: string): Promise<PlanLimits> {
    const plan = await this.getTenantPlan(tenantId);
    return PLANS[plan];
  }

  async checkOrderLimit(tenantId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const limits = await this.getPlanLimits(tenantId);
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const orderCount = await this.prisma.order.count({
      where: {
        tenantId,
        orderDate: { gte: startOfMonth },
      },
    });

    return {
      allowed: orderCount < limits.maxOrders,
      current: orderCount,
      limit: limits.maxOrders,
    };
  }

  async checkIntegrationLimit(tenantId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const limits = await this.getPlanLimits(tenantId);
    const integrationCount = await this.prisma.integration.count({
      where: {
        tenantId,
        status: 'ACTIVE',
      },
    });

    return {
      allowed: integrationCount < limits.maxIntegrations,
      current: integrationCount,
      limit: limits.maxIntegrations,
    };
  }

  async checkUserLimit(tenantId: string): Promise<{ allowed: boolean; current: number; limit: number }> {
    const limits = await this.getPlanLimits(tenantId);
    const userCount = await this.prisma.user.count({
      where: { tenantId },
    });

    return {
      allowed: userCount < limits.maxUsers,
      current: userCount,
      limit: limits.maxUsers,
    };
  }

  async createCheckoutSession(tenantId: string, plan: Plan): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      include: { users: { where: { role: 'ADMIN' }, take: 1 } },
    });

    if (!tenant) {
      throw new Error('Tenant not found');
    }

    const priceId = this.getPriceId(plan);
    
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: tenant.users[0]?.email,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/settings/billing?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/settings/billing?canceled=true`,
      metadata: {
        tenantId,
        plan,
      },
    });

    this.logger.log(`Created checkout session for tenant ${tenantId}, plan ${plan}`);
    return session.url || '';
  }

  async createPortalSession(tenantId: string): Promise<string> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { stripeCustomerId: true },
    });

    if (!tenant?.stripeCustomerId) {
      throw new Error('No Stripe customer found for this tenant');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: tenant.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/settings/billing`,
    });

    return session.url;
  }

  async handleWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await this.handleCheckoutComplete(session);
        break;
      }
      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionUpdate(subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.handleSubscriptionCanceled(subscription);
        break;
      }
      default:
        this.logger.log(`Unhandled Stripe event: ${event.type}`);
    }
  }

  private async handleCheckoutComplete(session: Stripe.Checkout.Session): Promise<void> {
    const tenantId = session.metadata?.tenantId;
    const plan = session.metadata?.plan as Plan;

    if (!tenantId || !plan) {
      this.logger.error('Missing metadata in checkout session');
      return;
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        plan,
        stripeCustomerId: session.customer as string,
        stripeSubscriptionId: session.subscription as string,
      },
    });

    this.logger.log(`Tenant ${tenantId} upgraded to ${plan}`);
  }

  private async handleSubscriptionUpdate(subscription: Stripe.Subscription): Promise<void> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!tenant) {
      this.logger.error(`Tenant not found for subscription ${subscription.id}`);
      return;
    }

    // Update plan based on price
    const priceId = subscription.items.data[0]?.price.id;
    const plan = this.getPlanFromPriceId(priceId);

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: { plan },
    });

    this.logger.log(`Tenant ${tenant.id} subscription updated to ${plan}`);
  }

  private async handleSubscriptionCanceled(subscription: Stripe.Subscription): Promise<void> {
    const tenant = await this.prisma.tenant.findFirst({
      where: { stripeSubscriptionId: subscription.id },
    });

    if (!tenant) {
      this.logger.error(`Tenant not found for subscription ${subscription.id}`);
      return;
    }

    await this.prisma.tenant.update({
      where: { id: tenant.id },
      data: {
        plan: 'FREE',
        stripeSubscriptionId: null,
      },
    });

    this.logger.log(`Tenant ${tenant.id} subscription canceled, downgraded to FREE`);
  }

  private getPriceId(plan: Plan): string {
    const priceIds: Record<Plan, string> = {
      FREE: '',
      PRO: process.env.STRIPE_PRO_PRICE_ID || '',
      ENTERPRISE: process.env.STRIPE_ENTERPRISE_PRICE_ID || '',
    };
    return priceIds[plan];
  }

  private getPlanFromPriceId(priceId: string): Plan {
    if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) return 'ENTERPRISE';
    if (priceId === process.env.STRIPE_PRO_PRICE_ID) return 'PRO';
    return 'FREE';
  }
}
