import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { SubscriptionService, PLANS, PlanLimits } from './subscription.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { Plan } from '@prisma/client';

@Resolver('Subscription')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SubscriptionResolver {
  constructor(private subscriptionService: SubscriptionService) {}

  @Query('getCurrentPlan')
  async getCurrentPlan(@CurrentTenant() tenantId: string) {
    const plan = await this.subscriptionService.getTenantPlan(tenantId);
    const limits = PLANS[plan];
    const [orderCheck, integrationCheck, userCheck] = await Promise.all([
      this.subscriptionService.checkOrderLimit(tenantId),
      this.subscriptionService.checkIntegrationLimit(tenantId),
      this.subscriptionService.checkUserLimit(tenantId),
    ]);

    return {
      plan,
      limits,
      usage: {
        orders: orderCheck,
        integrations: integrationCheck,
        users: userCheck,
      },
    };
  }

  @Query('getAvailablePlans')
  getAvailablePlans() {
    return Object.entries(PLANS).map(([plan, limits]) => ({
      plan,
      ...limits,
    }));
  }

  @Mutation('createCheckoutSession')
  @Roles('ADMIN')
  async createCheckoutSession(
    @CurrentTenant() tenantId: string,
    @Args('plan') plan: Plan,
  ) {
    const url = await this.subscriptionService.createCheckoutSession(tenantId, plan);
    return { url };
  }

  @Mutation('createPortalSession')
  @Roles('ADMIN')
  async createPortalSession(@CurrentTenant() tenantId: string) {
    const url = await this.subscriptionService.createPortalSession(tenantId);
    return { url };
  }
}
