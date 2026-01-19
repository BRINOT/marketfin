import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MercadoLivreService } from './marketplaces/mercado-livre.service';
import { AmazonService } from './marketplaces/amazon.service';
import { ShopeeService } from './marketplaces/shopee.service';
import { Marketplace, IntegrationStatus, Integration } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

export interface AuthUrl {
  authUrl: string;
  state: string;
}

export interface SyncResult {
  success: boolean;
  ordersImported: number;
  errors: string[];
}

@Injectable()
export class IntegrationService {
  private readonly logger = new Logger(IntegrationService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private configService: ConfigService,
    private mercadoLivreService: MercadoLivreService,
    private amazonService: AmazonService,
    private shopeeService: ShopeeService,
    @InjectQueue('sync-orders') private syncOrdersQueue: Queue,
  ) {}

  /**
   * Get all integrations for a tenant
   */
  async getIntegrations(tenantId: string): Promise<Integration[]> {
    return this.prisma.integration.findMany({
      where: { tenantId },
      orderBy: { marketplace: 'asc' },
    });
  }

  /**
   * Get integration status
   */
  async getIntegrationStatus(
    tenantId: string,
    marketplace: Marketplace,
  ): Promise<Integration | null> {
    return this.prisma.integration.findUnique({
      where: {
        tenantId_marketplace: {
          tenantId,
          marketplace,
        },
      },
    });
  }

  /**
   * Connect to a marketplace (initiate OAuth flow)
   */
  async connectMarketplace(
    tenantId: string,
    marketplace: Marketplace,
  ): Promise<AuthUrl> {
    // Generate state for OAuth
    const state = `${tenantId}:${marketplace}:${Date.now()}`;
    const encodedState = Buffer.from(state).toString('base64');

    // Store state in Redis for verification
    await this.redis.set(`oauth_state:${encodedState}`, { tenantId, marketplace }, 600);

    let authUrl: string;

    switch (marketplace) {
      case Marketplace.MERCADO_LIVRE:
        authUrl = this.mercadoLivreService.getAuthUrl(encodedState);
        break;

      case Marketplace.AMAZON:
        authUrl = this.amazonService.getAuthUrl(encodedState);
        break;

      case Marketplace.SHOPEE:
        authUrl = this.shopeeService.getAuthUrl(encodedState);
        break;

      default:
        throw new BadRequestException(`Marketplace ${marketplace} not supported yet`);
    }

    return { authUrl, state: encodedState };
  }

  /**
   * Handle OAuth callback
   */
  async handleOAuthCallback(
    state: string,
    code: string,
  ): Promise<Integration> {
    // Verify state
    const stateData = await this.redis.get<{ tenantId: string; marketplace: Marketplace }>(
      `oauth_state:${state}`,
    );

    if (!stateData) {
      throw new BadRequestException('Invalid or expired OAuth state');
    }

    const { tenantId, marketplace } = stateData;

    // Exchange code for tokens
    let tokens: { accessToken: string; refreshToken: string; expiresIn: number; sellerId?: string };

    switch (marketplace) {
      case Marketplace.MERCADO_LIVRE:
        tokens = await this.mercadoLivreService.exchangeCode(code);
        break;

      case Marketplace.AMAZON:
        tokens = await this.amazonService.exchangeCode(code);
        break;

      case Marketplace.SHOPEE:
        tokens = await this.shopeeService.exchangeCode(code);
        break;

      default:
        throw new BadRequestException(`Marketplace ${marketplace} not supported`);
    }

    // Calculate token expiration
    const tokenExpiresAt = new Date(Date.now() + tokens.expiresIn * 1000);

    // Upsert integration
    const integration = await this.prisma.integration.upsert({
      where: {
        tenantId_marketplace: {
          tenantId,
          marketplace,
        },
      },
      update: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt,
        sellerId: tokens.sellerId,
        status: IntegrationStatus.ACTIVE,
        syncError: null,
      },
      create: {
        tenantId,
        marketplace,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt,
        sellerId: tokens.sellerId,
        status: IntegrationStatus.ACTIVE,
      },
    });

    // Clean up state
    await this.redis.del(`oauth_state:${state}`);

    // Queue initial sync
    await this.queueOrderSync(tenantId, marketplace);

    return integration;
  }

  /**
   * Disconnect marketplace
   */
  async disconnectMarketplace(
    tenantId: string,
    marketplace: Marketplace,
  ): Promise<boolean> {
    const integration = await this.prisma.integration.findUnique({
      where: {
        tenantId_marketplace: {
          tenantId,
          marketplace,
        },
      },
    });

    if (!integration) {
      throw new NotFoundException('Integration not found');
    }

    // Revoke tokens if possible
    try {
      switch (marketplace) {
        case Marketplace.MERCADO_LIVRE:
          await this.mercadoLivreService.revokeToken(integration.accessToken!);
          break;
        // Other marketplaces...
      }
    } catch (error) {
      this.logger.warn(`Failed to revoke token for ${marketplace}:`, error);
    }

    // Update integration status
    await this.prisma.integration.update({
      where: { id: integration.id },
      data: {
        status: IntegrationStatus.INACTIVE,
        accessToken: null,
        refreshToken: null,
        tokenExpiresAt: null,
      },
    });

    return true;
  }

  /**
   * Queue order sync job
   */
  async queueOrderSync(
    tenantId: string,
    marketplace: Marketplace,
    startDate?: Date,
    endDate?: Date,
  ): Promise<void> {
    const now = new Date();
    const defaultStartDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days ago

    await this.syncOrdersQueue.add(
      'sync-orders',
      {
        tenantId,
        marketplace,
        startDate: startDate || defaultStartDate,
        endDate: endDate || now,
      },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    );

    this.logger.log(`Queued order sync for ${marketplace} (tenant: ${tenantId})`);
  }

  /**
   * Sync orders manually
   */
  async syncOrders(
    tenantId: string,
    marketplace: Marketplace,
    startDate: Date,
    endDate: Date,
  ): Promise<SyncResult> {
    const integration = await this.prisma.integration.findUnique({
      where: {
        tenantId_marketplace: {
          tenantId,
          marketplace,
        },
      },
    });

    if (!integration || integration.status !== IntegrationStatus.ACTIVE) {
      throw new BadRequestException('Integration not active');
    }

    // Queue the sync job
    await this.queueOrderSync(tenantId, marketplace, startDate, endDate);

    return {
      success: true,
      ordersImported: 0, // Will be updated by the job
      errors: [],
    };
  }

  /**
   * Refresh access token if needed
   */
  async refreshTokenIfNeeded(integration: Integration): Promise<string> {
    // Check if token is about to expire (within 5 minutes)
    const expiresAt = integration.tokenExpiresAt;
    const now = new Date();
    const fiveMinutes = 5 * 60 * 1000;

    if (expiresAt && expiresAt.getTime() - now.getTime() > fiveMinutes) {
      return integration.accessToken!;
    }

    // Refresh token
    let newTokens: { accessToken: string; refreshToken: string; expiresIn: number };

    switch (integration.marketplace) {
      case Marketplace.MERCADO_LIVRE:
        newTokens = await this.mercadoLivreService.refreshToken(integration.refreshToken!);
        break;

      case Marketplace.AMAZON:
        newTokens = await this.amazonService.refreshToken(integration.refreshToken!);
        break;

      case Marketplace.SHOPEE:
        newTokens = await this.shopeeService.refreshToken(integration.refreshToken!);
        break;

      default:
        throw new Error(`Token refresh not implemented for ${integration.marketplace}`);
    }

    // Update integration
    await this.prisma.integration.update({
      where: { id: integration.id },
      data: {
        accessToken: newTokens.accessToken,
        refreshToken: newTokens.refreshToken,
        tokenExpiresAt: new Date(Date.now() + newTokens.expiresIn * 1000),
      },
    });

    return newTokens.accessToken;
  }
}
