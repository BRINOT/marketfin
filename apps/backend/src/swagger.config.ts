import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { INestApplication } from '@nestjs/common';

export function setupSwagger(app: INestApplication) {
  const config = new DocumentBuilder()
    .setTitle('MarketFin API')
    .setDescription(`
## MarketFin - Controle Financeiro Multi-Marketplace

API REST para gerenciamento financeiro de vendedores em múltiplos marketplaces.

### Recursos Principais:
- **Autenticação**: JWT via Clerk
- **Multi-tenancy**: Isolamento completo por tenant
- **Integrações**: Amazon, Mercado Livre, Shopee, Magalu
- **Relatórios**: Lucro, pedidos, despesas, produtos
- **Export**: PDF e Excel

### Rate Limiting:
- 100 requests/minuto por tenant
- 1000 requests/minuto para plano Enterprise

### Autenticação:
Todas as rotas requerem Bearer Token JWT.
\`\`\`
Authorization: Bearer <token>
\`\`\`
    `)
    .setVersion('1.0.0')
    .setContact('MarketFin', 'https://marketfin.com.br', 'api@marketfin.com.br')
    .setLicense('Proprietary', 'https://marketfin.com.br/terms')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth',
    )
    .addTag('Auth', 'Autenticação e autorização')
    .addTag('Integrations', 'Conexão com marketplaces')
    .addTag('Orders', 'Gerenciamento de pedidos')
    .addTag('Products', 'Gerenciamento de produtos')
    .addTag('Finance', 'Relatórios financeiros')
    .addTag('Expenses', 'Controle de despesas')
    .addTag('Export', 'Exportação de dados')
    .addTag('Subscription', 'Planos e assinaturas')
    .addTag('Users', 'Gerenciamento de usuários')
    .addTag('Tenant', 'Configurações do tenant')
    .addTag('Health', 'Status da API')
    .addServer('http://localhost:3001', 'Development')
    .addServer('https://api.marketfin.com.br', 'Production')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'MarketFin API Docs',
    customfavIcon: '/favicon.ico',
    customCss: `
      .swagger-ui .topbar { display: none }
      .swagger-ui .info { margin: 20px 0 }
      .swagger-ui .info .title { color: #3b82f6 }
    `,
  });

  return document;
}