import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Finance (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authToken: string;
  let tenantId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    prisma = app.get(PrismaService);
    await app.init();

    // Setup test tenant
    const tenant = await prisma.tenant.create({
      data: { name: 'Finance Test Tenant', plan: 'PRO' },
    });
    tenantId = tenant.id;
    authToken = 'test-jwt-token';

    // Create test orders for profit calculation
    const today = new Date();
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

    await prisma.order.createMany({
      data: [
        {
          tenantId,
          marketplace: 'MERCADO_LIVRE',
          marketplaceOrderId: 'ML-FIN-001',
          status: 'DELIVERED',
          orderDate: today,
          totalAmount: 1000.00,
          fees: 100.00,
          shippingCost: 50.00,
          taxes: 180.00,
          netProfit: 670.00,
        },
        {
          tenantId,
          marketplace: 'AMAZON',
          marketplaceOrderId: 'AMZ-FIN-001',
          status: 'DELIVERED',
          orderDate: today,
          totalAmount: 2000.00,
          fees: 200.00,
          shippingCost: 100.00,
          taxes: 360.00,
          netProfit: 1340.00,
        },
        {
          tenantId,
          marketplace: 'MERCADO_LIVRE',
          marketplaceOrderId: 'ML-FIN-002',
          status: 'DELIVERED',
          orderDate: lastMonth,
          totalAmount: 500.00,
          fees: 50.00,
          shippingCost: 25.00,
          taxes: 90.00,
          netProfit: 335.00,
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.order.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  describe('GraphQL Profit Report', () => {
    const profitReportQuery = `
      query GetProfitReport($filters: ProfitFilters!) {
        getProfitReport(filters: $filters) {
          totalRevenue
          totalFees
          totalShipping
          totalTaxes
          totalCost
          netProfit
          items {
            label
            revenue
            profit
            margin
          }
        }
      }
    `;

    it('should return profit report grouped by day', async () => {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: profitReportQuery,
          variables: {
            filters: {
              tenantId,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              groupBy: 'DAY',
            },
          },
        })
        .expect(200);

      const report = response.body.data.getProfitReport;
      expect(report.totalRevenue).toBeGreaterThan(0);
      expect(report.netProfit).toBeGreaterThan(0);
      expect(report.items).toBeInstanceOf(Array);
    });

    it('should return profit report grouped by marketplace', async () => {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: profitReportQuery,
          variables: {
            filters: {
              tenantId,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              groupBy: 'MARKETPLACE',
            },
          },
        })
        .expect(200);

      const report = response.body.data.getProfitReport;
      expect(report.items.length).toBeGreaterThanOrEqual(2); // ML and Amazon
    });

    it('should filter by specific marketplace', async () => {
      const today = new Date();
      const startDate = new Date(today.getFullYear(), today.getMonth(), 1);
      const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);

      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: profitReportQuery,
          variables: {
            filters: {
              tenantId,
              startDate: startDate.toISOString(),
              endDate: endDate.toISOString(),
              marketplace: ['MERCADO_LIVRE'],
              groupBy: 'DAY',
            },
          },
        })
        .expect(200);

      const report = response.body.data.getProfitReport;
      expect(report.totalRevenue).toBe(1000); // Only ML order from this month
    });
  });

  describe('Dashboard KPIs', () => {
    const kpiQuery = `
      query GetDashboardKPIs($tenantId: ID!, $period: String!) {
        getDashboardKPIs(tenantId: $tenantId, period: $period) {
          totalRevenue
          totalProfit
          totalOrders
          averageTicket
          profitMargin
          revenueGrowth
          profitGrowth
        }
      }
    `;

    it('should return dashboard KPIs for current month', async () => {
      const response = await request(app.getHttpServer())
        .post('/graphql')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: kpiQuery,
          variables: {
            tenantId,
            period: 'month',
          },
        })
        .expect(200);

      const kpis = response.body.data.getDashboardKPIs;
      expect(kpis.totalRevenue).toBeGreaterThan(0);
      expect(kpis.totalOrders).toBeGreaterThanOrEqual(2);
      expect(kpis.averageTicket).toBeGreaterThan(0);
    });
  });
});
