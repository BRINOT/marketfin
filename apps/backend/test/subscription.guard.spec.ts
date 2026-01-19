import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext } from '@nestjs/common';
import { SubscriptionGuard } from '../src/subscription/subscription.guard';
import { TenantService } from '../src/tenant/tenant.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { Plan } from '@prisma/client';

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard;
  let tenantService: TenantService;
  let prismaService: PrismaService;

  const mockPrismaService = {
    order: {
      count: jest.fn(),
    },
    integration: {
      count: jest.fn(),
    },
    user: {
      count: jest.fn(),
    },
    tenant: {
      findUnique: jest.fn(),
    },
  };

  const mockTenantService = {
    getTenant: jest.fn(),
    getPlanLimits: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionGuard,
        { provide: TenantService, useValue: mockTenantService },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    guard = module.get<SubscriptionGuard>(SubscriptionGuard);
    tenantService = module.get<TenantService>(TenantService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const createMockContext = (tenantId: string, path: string): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          tenantId,
          path,
        }),
      }),
    } as ExecutionContext;
  };

  describe('Order limits', () => {
    it('should allow when under order limit', async () => {
      const context = createMockContext('tenant-1', '/orders');
      
      mockTenantService.getTenant.mockResolvedValue({ id: 'tenant-1', plan: Plan.FREE });
      mockTenantService.getPlanLimits.mockReturnValue({ maxOrders: 1000 });
      mockPrismaService.order.count.mockResolvedValue(500);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should block when at order limit', async () => {
      const context = createMockContext('tenant-1', '/orders');
      
      mockTenantService.getTenant.mockResolvedValue({ id: 'tenant-1', plan: Plan.FREE });
      mockTenantService.getPlanLimits.mockReturnValue({ maxOrders: 1000 });
      mockPrismaService.order.count.mockResolvedValue(1000);

      await expect(guard.canActivate(context)).rejects.toThrow();
    });

    it('should allow unlimited orders for ENTERPRISE', async () => {
      const context = createMockContext('tenant-1', '/orders');
      
      mockTenantService.getTenant.mockResolvedValue({ id: 'tenant-1', plan: Plan.ENTERPRISE });
      mockTenantService.getPlanLimits.mockReturnValue({ maxOrders: Infinity });
      mockPrismaService.order.count.mockResolvedValue(100000);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('Integration limits', () => {
    it('should allow when under integration limit', async () => {
      const context = createMockContext('tenant-1', '/integrations');
      
      mockTenantService.getTenant.mockResolvedValue({ id: 'tenant-1', plan: Plan.PRO });
      mockTenantService.getPlanLimits.mockReturnValue({ maxIntegrations: 5 });
      mockPrismaService.integration.count.mockResolvedValue(3);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should block when at integration limit', async () => {
      const context = createMockContext('tenant-1', '/integrations');
      
      mockTenantService.getTenant.mockResolvedValue({ id: 'tenant-1', plan: Plan.FREE });
      mockTenantService.getPlanLimits.mockReturnValue({ maxIntegrations: 1 });
      mockPrismaService.integration.count.mockResolvedValue(1);

      await expect(guard.canActivate(context)).rejects.toThrow();
    });
  });

  describe('User limits', () => {
    it('should allow when under user limit', async () => {
      const context = createMockContext('tenant-1', '/users');
      
      mockTenantService.getTenant.mockResolvedValue({ id: 'tenant-1', plan: Plan.PRO });
      mockTenantService.getPlanLimits.mockReturnValue({ maxUsers: 5 });
      mockPrismaService.user.count.mockResolvedValue(2);

      const result = await guard.canActivate(context);
      expect(result).toBe(true);
    });
  });
});
