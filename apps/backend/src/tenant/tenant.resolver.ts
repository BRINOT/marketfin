import { Resolver, Query, Mutation, Args, Context } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { TenantService, TaxSettings, NotificationSettings } from './tenant.service';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Resolver('Tenant')
@UseGuards(GqlAuthGuard, RolesGuard)
export class TenantResolver {
  constructor(private tenantService: TenantService) {}

  @Query('getTenantSettings')
  async getTenantSettings(@Context() ctx: any) {
    return this.tenantService.getTenantSettings(ctx.req.tenantId);
  }

  @Mutation('updateTenant')
  @Roles(UserRole.ADMIN)
  async updateTenant(
    @Args('input') input: { name?: string },
    @Context() ctx: any,
  ) {
    return this.tenantService.updateTenant(ctx.req.tenantId, input);
  }

  @Mutation('updateTaxSettings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateTaxSettings(
    @Args('input') input: TaxSettings,
    @Context() ctx: any,
  ) {
    return this.tenantService.updateTaxSettings(ctx.req.tenantId, input);
  }

  @Mutation('updateNotificationSettings')
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async updateNotificationSettings(
    @Args('input') input: NotificationSettings,
    @Context() ctx: any,
  ) {
    return this.tenantService.updateNotificationSettings(ctx.req.tenantId, input);
  }
}
