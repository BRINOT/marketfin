import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Orders (e2e)', () => {
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

    // Setup test data
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Tenant',
        plan: 'PRO',
      },
    });
    tenantId = tenant.id;

    // Create test user and get auth token
    // In real tests, you would mock Clerk or use test tokens
    authToken = 'test-jwt-token';
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.order.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  describe('GET /api/orders', () => {
    beforeAll(async () => {
      // Create test orders
      await prisma.order.createMany({
        data: [
          {
            tenantId,
            marketplace: 'MERCADO_LIVRE',
            marketplaceOrderId: 'ML-001',
            status: 'DELIVERED',
            orderDate: new Date(),
            totalAmount: 100.00,
            fees: 10.00,
            shippingCost: 15.00,
            taxes: 5.00,
            netProfit: 70.00,
          },
          {
            tenantId,
            marketplace: 'AMAZON',
            marketplaceOrderId: 'AMZ-001',
            status: 'SHIPPED',
            orderDate: new Date(),
            totalAmount: 200.00,
            fees: 20.00,
            shippingCost: 25.00,
            taxes: 10.00,
            netProfit: 145.00,
          },
        ],
      });
    });

    it('should return paginated orders', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ page: 1, limit: 10 })
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.total).toBeGreaterThanOrEqual(2);
      expect(response.body.page).toBe(1);
    });

    it('should filter orders by marketplace', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ marketplace: 'MERCADO_LIVRE' })
        .expect(200);

      expect(response.body.data.every((o: any) => o.marketplace === 'MERCADO_LIVRE')).toBe(true);
    });

    it('should filter orders by date range', async () => {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 7);
      const endDate = new Date();

      const response = await request(app.getHttpServer())
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        })
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });

    it('should filter orders by status', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/orders')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ status: 'DELIVERED' })
        .expect(200);

      expect(response.body.data.every((o: any) => o.status === 'DELIVERED')).toBe(true);
    });
  });

  describe('GET /api/orders/:id', () => {
    let orderId: string;

    beforeAll(async () => {
      const order = await prisma.order.create({
        data: {
          tenantId,
          marketplace: 'SHOPEE',
          marketplaceOrderId: 'SHOPEE-001',
          status: 'PAID',
          orderDate: new Date(),
          totalAmount: 150.00,
          fees: 15.00,
          shippingCost: 20.00,
          taxes: 7.50,
          netProfit: 107.50,
        },
      });
      orderId = order.id;
    });

    it('should return order details', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/orders/${orderId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(orderId);
      expect(response.body.marketplace).toBe('SHOPEE');
    });

    it('should return 404 for non-existent order', async () => {
      await request(app.getHttpServer())
        .get('/api/orders/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
