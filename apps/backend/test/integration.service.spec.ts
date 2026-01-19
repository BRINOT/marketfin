import { Test, TestingModule } from '@nestjs/testing';
import { IntegrationService } from '../src/integration/integration.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { Marketplace, IntegrationStatus } from '@prisma/client';

describe('IntegrationService', () => {
  let service: IntegrationService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    integration: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        MERCADO_LIVRE_CLIENT_ID: 'ml-client-id',
        MERCADO_LIVRE_CLIENT_SECRET: 'ml-client-secret',
        MERCADO_LIVRE_REDIRECT_URI: 'http://localhost:3000/callback/ml',
        AMAZON_CLIENT_ID: 'amz-client-id',
        AMAZON_CLIENT_SECRET: 'amz-client-secret',
        SHOPEE_PARTNER_ID: 'shopee-partner-id',
        SHOPEE_PARTNER_KEY: 'shopee-partner-key',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IntegrationService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<IntegrationService>(IntegrationService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getIntegrations', () => {
    it('should return all integrations for a tenant', async () => {
      const mockIntegrations = [
        { id: '1', marketplace: Marketplace.MERCADO_LIVRE, status: IntegrationStatus.ACTIVE },
        { id: '2', marketplace: Marketplace.AMAZON, status: IntegrationStatus.INACTIVE },
      ];

      mockPrismaService.integration.findMany.mockResolvedValue(mockIntegrations);

      const result = await service.getIntegrations('tenant-1');

      expect(result).toEqual(mockIntegrations);
      expect(mockPrismaService.integration.findMany).toHaveBeenCalledWith({
        where: { tenantId: 'tenant-1' },
      });
    });
  });

  describe('getIntegrationStatus', () => {
    it('should return integration status', async () => {
      const mockIntegration = {
        id: '1',
        marketplace: Marketplace.MERCADO_LIVRE,
        status: IntegrationStatus.ACTIVE,
        lastSyncAt: new Date(),
      };

      mockPrismaService.integration.findFirst.mockResolvedValue(mockIntegration);

      const result = await service.getIntegrationStatus('tenant-1', Marketplace.MERCADO_LIVRE);

      expect(result).toEqual(mockIntegration);
    });

    it('should return null for non-existent integration', async () => {
      mockPrismaService.integration.findFirst.mockResolvedValue(null);

      const result = await service.getIntegrationStatus('tenant-1', Marketplace.SHOPEE);

      expect(result).toBeNull();
    });
  });

  describe('getAuthUrl', () => {
    it('should generate Mercado Livre auth URL', () => {
      const url = service.getAuthUrl(Marketplace.MERCADO_LIVRE, 'tenant-1');

      expect(url).toContain('https://auth.mercadolivre.com.br/authorization');
      expect(url).toContain('client_id=ml-client-id');
      expect(url).toContain('state=tenant-1');
    });

    it('should generate Amazon auth URL', () => {
      const url = service.getAuthUrl(Marketplace.AMAZON, 'tenant-1');

      expect(url).toContain('https://sellercentral.amazon.com.br/apps/authorize/consent');
      expect(url).toContain('application_id=amz-client-id');
    });

    it('should generate Shopee auth URL', () => {
      const url = service.getAuthUrl(Marketplace.SHOPEE, 'tenant-1');

      expect(url).toContain('https://partner.shopeemobile.com/api/v2/shop/auth_partner');
      expect(url).toContain('partner_id=shopee-partner-id');
    });
  });

  describe('disconnectMarketplace', () => {
    it('should delete integration', async () => {
      mockPrismaService.integration.findFirst.mockResolvedValue({ id: '1' });
      mockPrismaService.integration.delete.mockResolvedValue({ id: '1' });

      const result = await service.disconnectMarketplace('tenant-1', Marketplace.MERCADO_LIVRE);

      expect(result).toBe(true);
      expect(mockPrismaService.integration.delete).toHaveBeenCalledWith({
        where: { id: '1' },
      });
    });

    it('should return false if integration not found', async () => {
      mockPrismaService.integration.findFirst.mockResolvedValue(null);

      const result = await service.disconnectMarketplace('tenant-1', Marketplace.AMAZON);

      expect(result).toBe(false);
    });
  });
});
