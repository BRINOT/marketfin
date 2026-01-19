import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Export (e2e)', () => {
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

    // Setup test tenant and data
    const tenant = await prisma.tenant.create({
      data: { name: 'Export Test Tenant', plan: 'PRO' },
    });
    tenantId = tenant.id;
    authToken = 'test-jwt-token';

    // Create test data
    await prisma.order.create({
      data: {
        tenantId,
        marketplace: 'MERCADO_LIVRE',
        marketplaceOrderId: 'ML-EXP-001',
        status: 'DELIVERED',
        orderDate: new Date(),
        totalAmount: 500.00,
        fees: 50.00,
        shippingCost: 25.00,
        taxes: 90.00,
        netProfit: 335.00,
      },
    });

    await prisma.product.create({
      data: {
        tenantId,
        sku: 'PROD-001',
        name: 'Test Product',
        costPrice: 50.00,
        salePrice: 100.00,
        stock: 10,
      },
    });

    await prisma.expense.create({
      data: {
        tenantId,
        type: 'ADS',
        amount: 100.00,
        date: new Date(),
        description: 'Facebook Ads',
      },
    });
  });

  afterAll(async () => {
    await prisma.expense.deleteMany({ where: { tenantId } });
    await prisma.product.deleteMany({ where: { tenantId } });
    await prisma.order.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  describe('GET /export/excel', () => {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    it('should export orders to Excel', async () => {
      const response = await request(app.getHttpServer())
        .get('/export/excel')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ type: 'orders', startDate, endDate })
        .expect(200);

      expect(response.headers['content-type']).toContain('spreadsheetml');
      expect(response.headers['content-disposition']).toContain('.xlsx');
      expect(response.body).toBeInstanceOf(Buffer);
    });

    it('should export profit report to Excel', async () => {
      const response = await request(app.getHttpServer())
        .get('/export/excel')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ type: 'profit', startDate, endDate })
        .expect(200);

      expect(response.headers['content-type']).toContain('spreadsheetml');
    });

    it('should export expenses to Excel', async () => {
      const response = await request(app.getHttpServer())
        .get('/export/excel')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ type: 'expenses', startDate, endDate })
        .expect(200);

      expect(response.headers['content-type']).toContain('spreadsheetml');
    });

    it('should export products to Excel', async () => {
      const response = await request(app.getHttpServer())
        .get('/export/excel')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ type: 'products', startDate, endDate })
        .expect(200);

      expect(response.headers['content-type']).toContain('spreadsheetml');
    });

    it('should return 400 for missing parameters', async () => {
      await request(app.getHttpServer())
        .get('/export/excel')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /export/pdf', () => {
    const today = new Date();
    const startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
    const endDate = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

    it('should export orders to PDF', async () => {
      const response = await request(app.getHttpServer())
        .get('/export/pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ type: 'orders', startDate, endDate })
        .expect(200);

      expect(response.headers['content-type']).toContain('pdf');
      expect(response.headers['content-disposition']).toContain('.pdf');
    });

    it('should export profit report to PDF', async () => {
      const response = await request(app.getHttpServer())
        .get('/export/pdf')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ type: 'profit', startDate, endDate })
        .expect(200);

      expect(response.headers['content-type']).toContain('pdf');
    });
  });

  describe('Access Control', () => {
    it('should deny access to VIEWER role', async () => {
      // Assuming viewer token
      const viewerToken = 'viewer-jwt-token';
      
      await request(app.getHttpServer())
        .get('/export/excel')
        .set('Authorization', `Bearer ${viewerToken}`)
        .query({ type: 'orders', startDate: '2024-01-01', endDate: '2024-01-31' })
        .expect(403);
    });
  });
});
