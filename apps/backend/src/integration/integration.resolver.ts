import { Resolver, Query, Mutation, Args, ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { IntegrationService, AuthUrl, SyncResult } from './integration.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { Marketplace, IntegrationStatus, UserRole } from '@prisma/client';

// Register enums
registerEnumType(IntegrationStatus, {
  name: 'IntegrationStatus',
  description: 'Integration connection status',
});

// Output types
@ObjectType()
class IntegrationType {
  @Field(() => ID)
  id: string;

  @Field(() => Marketplace)
  marketplace: Marketplace;

  @Field(() => IntegrationStatus)
  status: IntegrationStatus;

  @Field({ nullable: true })
  sellerId?: string;

  @Field({ nullable: true })
  lastSyncAt?: Date;

  @Field({ nullable: true })
  syncError?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}

@ObjectType()
class AuthUrlType {
  @Field()
  authUrl: string;

  @Field()
  state: string;
}

@ObjectType()
class SyncResultType {
  @Field()
  success: boolean;

  @Field()
  ordersImported: number;

  @Field(() => [String])
  errors: string[];
}

@Resolver(() => IntegrationType)
export class IntegrationResolver {
  constructor(private integrationService: IntegrationService) {}

  @Query(() => [IntegrationType], { name: 'getIntegrations' })
  @UseGuards(AuthGuard)
  async getIntegrations(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IntegrationType[]> {
    const integrations = await this.integrationService.getIntegrations(user.tenantId);
    
    return integrations.map((integration) => ({
      id: integration.id,
      marketplace: integration.marketplace,
      status: integration.status,
      sellerId: integration.sellerId || undefined,
      lastSyncAt: integration.lastSyncAt || undefined,
      syncError: integration.syncError || undefined,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    }));
  }

  @Query(() => IntegrationType, { name: 'getIntegrationStatus', nullable: true })
  @UseGuards(AuthGuard)
  async getIntegrationStatus(
    @Args('marketplace', { type: () => Marketplace }) marketplace: Marketplace,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<IntegrationType | null> {
    const integration = await this.integrationService.getIntegrationStatus(
      user.tenantId,
      marketplace,
    );

    if (!integration) return null;

    return {
      id: integration.id,
      marketplace: integration.marketplace,
      status: integration.status,
      sellerId: integration.sellerId || undefined,
      lastSyncAt: integration.lastSyncAt || undefined,
      syncError: integration.syncError || undefined,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  }

  @Mutation(() => AuthUrlType, { name: 'connectMarketplace' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async connectMarketplace(
    @Args('marketplace', { type: () => Marketplace }) marketplace: Marketplace,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AuthUrl> {
    return this.integrationService.connectMarketplace(user.tenantId, marketplace);
  }

  @Mutation(() => Boolean, { name: 'disconnectMarketplace' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async disconnectMarketplace(
    @Args('marketplace', { type: () => Marketplace }) marketplace: Marketplace,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<boolean> {
    return this.integrationService.disconnectMarketplace(user.tenantId, marketplace);
  }

  @Mutation(() => SyncResultType, { name: 'syncOrders' })
  @UseGuards(AuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  async syncOrders(
    @Args('marketplace', { type: () => Marketplace }) marketplace: Marketplace,
    @Args('startDate') startDate: Date,
    @Args('endDate') endDate: Date,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SyncResult> {
    return this.integrationService.syncOrders(
      user.tenantId,
      marketplace,
      new Date(startDate),
      new Date(endDate),
    );
  }
}
