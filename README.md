# MarketFin - Controle Financeiro Multi-Marketplace

![MarketFin](https://img.shields.io/badge/MarketFin-v1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen)

MarketFin é um SaaS B2B que automatiza o controle financeiro de vendedores em múltiplos marketplaces (Amazon, Mercado Livre, Shopee, Magalu, etc.).

## 🚀 Features

- **Multi-tenant**: Cada cliente isolado com segurança total
- **Tempo real**: Webhooks + polling para sincronização automática
- **Cálculo automático de lucro líquido**: Considera taxas, impostos, fretes, devoluções e custo de produto
- **Escalável**: Pronto para 10k+ transações/minuto
- **LGPD/GDPR compliant**: Anonimização automática de dados

## 🛠️ Stack Tecnológica

### Backend
- Node.js 20 + NestJS 10
- TypeScript 5.3 (strict mode)
- GraphQL (Apollo Server) + REST
- Prisma ORM
- BullMQ (filas de jobs)
- Redis 7 (cache, sessões, rate limiting)
- PostgreSQL 16

### Frontend
- Next.js 14 (App Router, SSR)
- React 18 (Server Components)
- TypeScript
- Tailwind CSS 3.4 + Shadcn/UI
- Apollo Client
- Lucide React

### Infraestrutura
- Docker + Docker Compose
- AWS (ECS Fargate, RDS, ElastiCache, S3, Lambda)
- Vercel (frontend)
- GitHub Actions (CI/CD)

## 📦 Estrutura do Projeto

```
marketfin/
├── apps/
│   ├── backend/          # NestJS API
│   │   ├── src/
│   │   │   ├── auth/       # Autenticação e RBAC
│   │   │   ├── finance/    # Cálculos financeiros
│   │   │   ├── integration/ # Conexões com marketplaces
│   │   │   ├── order/      # Gestão de pedidos
│   │   │   ├── product/    # Gestão de produtos
│   │   │   ├── webhook/    # Processamento de webhooks
│   │   │   └── health/     # Health checks
│   │   └── prisma/
│   └── frontend/         # Next.js App
│       ├── app/
│       ├── components/
│       └── lib/
├── packages/
│   └── shared/           # Tipos compartilhados
├── prisma/               # Schema do banco
└── .github/workflows/    # CI/CD
```

## 🚀 Quick Start

### Pré-requisitos

- Node.js 20+
- Docker e Docker Compose
- Conta no Clerk (autenticação)

### Instalação

1. Clone o repositório:
```bash
git clone https://github.com/seu-usuario/marketfin.git
cd marketfin
```

2. Copie o arquivo de ambiente:
```bash
cp .env.example .env
```

3. Configure as variáveis de ambiente no `.env`

4. Inicie os serviços com Docker:
```bash
npm run docker:dev
```

5. Execute as migrations:
```bash
cd apps/backend
npx prisma migrate dev
```

6. Inicie o desenvolvimento:
```bash
npm run dev
```

Acesse:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- GraphQL Playground: http://localhost:3001/graphql

## 📊 Marketplaces Suportados

| Marketplace | Status | OAuth | Webhooks |
|-------------|--------|-------|----------|
| Mercado Livre | ✅ Ativo | ✅ | ✅ |
| Amazon | ✅ Ativo | ✅ | ✅ |
| Shopee | ✅ Ativo | ✅ | ✅ |
| Magazine Luiza | 🚧 Em breve | - | - |
| Americanas | 🚧 Em breve | - | - |

## 💰 Planos

| Feature | Free | Pro | Enterprise |
|---------|------|-----|------------|
| Pedidos/mês | 1.000 | 10.000 | Ilimitado |
| Marketplaces | 2 | 5 | Ilimitado |
| Usuários | 1 | 5 | Ilimitado |
| Relatórios | Básicos | Avançados | Customizados |
| Suporte | Email | Prioritário | Dedicado |
| Preço | Grátis | R$49/mês | R$499/mês |

## 🔒 Segurança

- Autenticação via Clerk (OAuth2, MFA)
- RBAC (Admin, Manager, Viewer)
- Rate limiting por tenant
- Criptografia de tokens de API
- Anonimização automática (LGPD)
- Row-level security no PostgreSQL

## 🧪 Testes

```bash
# Backend
cd apps/backend
npm test
npm run test:e2e

# Frontend
cd apps/frontend
npm test
```

## 📖 API Documentation

A documentação da API está disponível no GraphQL Playground:
- Desenvolvimento: http://localhost:3001/graphql
- Produção: https://api.marketfin.com.br/graphql

## 🤝 Contribuindo

1. Fork o projeto
2. Crie sua feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

## 📞 Suporte

- Email: suporte@marketfin.com.br
- Documentação: https://docs.marketfin.com.br
- Status: https://status.marketfin.com.br
