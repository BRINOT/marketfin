# 🚀 MarketFin - Guia de Deploy para Produção

Este guia detalha todos os passos necessários para hospedar o MarketFin SaaS em produção.

## 📋 Pré-requisitos

- Conta AWS com permissões de administrador
- Conta Vercel (para frontend)
- Conta Clerk (autenticação)
- Conta Stripe (pagamentos)
- Domínio registrado (ex: marketfin.com.br)
- Terraform instalado (>= 1.5.0)
- Docker instalado
- Node.js 20+

## 🏗️ Arquitetura de Produção

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLOUDFLARE                               │
│                    (DNS + CDN + WAF)                            │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│    VERCEL     │    │  AWS ALB      │    │ API GATEWAY   │
│   Frontend    │    │   Backend     │    │   Webhooks    │
│  Next.js 14   │    │   NestJS      │    │   Lambda      │
└───────────────┘    └───────────────┘    └───────────────┘
                              │                     │
                              ▼                     ▼
                     ┌───────────────┐    ┌───────────────┐
                     │  ECS Fargate  │    │     SQS       │
                     │   (2-10)      │    │   Queues      │
                     └───────────────┘    └───────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
     ┌───────────────┐ ┌───────────────┐ ┌───────────────┐
     │  RDS Postgres │ │  ElastiCache  │ │      S3       │
     │   Multi-AZ    │ │    Redis      │ │   Exports     │
     └───────────────┘ └───────────────┘ └───────────────┘
```

## 📝 Passo a Passo

### 1. Configurar Serviços Externos

#### 1.1 Clerk (Autenticação)

1. Acesse [clerk.com](https://clerk.com) e crie uma conta
2. Crie uma nova aplicação "MarketFin"
3. Configure os URLs:
   - Sign-in URL: `https://app.marketfin.com.br/sign-in`
   - Sign-up URL: `https://app.marketfin.com.br/sign-up`
   - After sign-in URL: `https://app.marketfin.com.br/dashboard`
4. Copie as chaves:
   - `CLERK_PUBLISHABLE_KEY`
   - `CLERK_SECRET_KEY`
5. Configure o webhook:
   - URL: `https://api.marketfin.com.br/webhooks/clerk`
   - Events: `user.created`, `user.updated`, `user.deleted`
   - Copie o `CLERK_WEBHOOK_SECRET`

#### 1.2 Stripe (Pagamentos)

1. Acesse [stripe.com](https://stripe.com) e crie uma conta
2. Ative o modo de produção
3. Crie os produtos e preços:
   ```
   - PRO: R$49/mês (price_xxx)
   - ENTERPRISE: R$499/mês (price_xxx)
   ```
4. Configure o webhook:
   - URL: `https://api.marketfin.com.br/webhooks/stripe`
   - Events: `checkout.session.completed`, `customer.subscription.*`, `invoice.*`
5. Copie as chaves:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`

#### 1.3 Marketplaces

**Mercado Livre:**
1. Acesse [developers.mercadolivre.com.br](https://developers.mercadolivre.com.br)
2. Crie uma aplicação
3. Configure redirect URI: `https://api.marketfin.com.br/integrations/mercado-livre/callback`
4. Copie `ML_CLIENT_ID` e `ML_CLIENT_SECRET`

**Amazon SP-API:**
1. Acesse [sellercentral.amazon.com.br](https://sellercentral.amazon.com.br)
2. Registre como desenvolvedor
3. Crie uma aplicação SP-API
4. Configure as credenciais

**Shopee:**
1. Acesse [open.shopee.com](https://open.shopee.com)
2. Registre como parceiro
3. Crie uma aplicação
4. Configure redirect URI

### 2. Configurar AWS

#### 2.1 Preparar Terraform State

```bash
# Criar bucket S3 para state
aws s3 mb s3://marketfin-terraform-state --region us-east-1

# Habilitar versionamento
aws s3api put-bucket-versioning \
  --bucket marketfin-terraform-state \
  --versioning-configuration Status=Enabled

# Criar tabela DynamoDB para locks
aws dynamodb create-table \
  --table-name marketfin-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region us-east-1
```

#### 2.2 Configurar Secrets

```bash
# Criar arquivo de variáveis
cd infrastructure/terraform
cp terraform.tfvars.example terraform.tfvars

# Editar terraform.tfvars com suas configurações
```

**terraform.tfvars:**
```hcl
aws_region   = "us-east-1"
environment  = "production"
db_password  = "SUA_SENHA_SEGURA_AQUI"
domain_name  = "marketfin.com.br"
```

#### 2.3 Deploy da Infraestrutura

```bash
# Inicializar Terraform
terraform init

# Verificar plano
terraform plan

# Aplicar (isso pode levar 15-20 minutos)
terraform apply

# Salvar outputs
terraform output > outputs.txt
```

#### 2.4 Configurar Secrets no AWS Secrets Manager

```bash
# Database URL
aws secretsmanager put-secret-value \
  --secret-id marketfin/database-url \
  --secret-string "postgresql://marketfin_admin:PASSWORD@RDS_ENDPOINT:5432/marketfin?schema=public&sslmode=require"

# Redis URL
aws secretsmanager put-secret-value \
  --secret-id marketfin/redis-url \
  --secret-string "rediss://REDIS_ENDPOINT:6379"

# Clerk
aws secretsmanager put-secret-value \
  --secret-id marketfin/clerk \
  --secret-string '{"secret_key":"sk_live_xxx","webhook_secret":"whsec_xxx"}'

# Stripe
aws secretsmanager put-secret-value \
  --secret-id marketfin/stripe \
  --secret-string '{"secret_key":"sk_live_xxx","webhook_secret":"whsec_xxx"}'
```

### 3. Deploy do Backend

#### 3.1 Build e Push da Imagem Docker

```bash
# Login no ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com

# Build da imagem
cd apps/backend
docker build -t marketfin/backend:latest .

# Tag para ECR
docker tag marketfin/backend:latest ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/marketfin/backend:latest

# Push
docker push ACCOUNT_ID.dkr.ecr.us-east-1.amazonaws.com/marketfin/backend:latest
```

#### 3.2 Executar Migrations

```bash
# Conectar ao bastion ou usar ECS Exec
aws ecs execute-command \
  --cluster marketfin-cluster \
  --task TASK_ID \
  --container backend \
  --interactive \
  --command "/bin/sh"

# Dentro do container
npx prisma migrate deploy
```

#### 3.3 Atualizar ECS Service

```bash
aws ecs update-service \
  --cluster marketfin-cluster \
  --service marketfin-backend \
  --force-new-deployment
```

### 4. Deploy do Frontend (Vercel)

#### 4.1 Conectar Repositório

1. Acesse [vercel.com](https://vercel.com)
2. Importe o repositório do GitHub
3. Configure:
   - Framework: Next.js
   - Root Directory: `apps/frontend`
   - Build Command: `npm run build`
   - Output Directory: `.next`

#### 4.2 Configurar Variáveis de Ambiente

No painel do Vercel, adicione:

```
NEXT_PUBLIC_APP_URL=https://app.marketfin.com.br
NEXT_PUBLIC_API_URL=https://api.marketfin.com.br
NEXT_PUBLIC_GRAPHQL_URL=https://api.marketfin.com.br/graphql
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_xxx
CLERK_SECRET_KEY=sk_live_xxx
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
```

#### 4.3 Configurar Domínio

1. Adicione o domínio `app.marketfin.com.br`
2. Configure os registros DNS no Cloudflare

### 5. Configurar DNS (Cloudflare)

```
# Frontend (Vercel)
app.marketfin.com.br    CNAME   cname.vercel-dns.com

# Backend (AWS ALB)
api.marketfin.com.br    CNAME   marketfin-alb-xxx.us-east-1.elb.amazonaws.com

# Webhooks (API Gateway)
webhooks.marketfin.com.br   CNAME   xxx.execute-api.us-east-1.amazonaws.com
```

### 6. Deploy das Lambda Functions

```bash
cd apps/lambda-webhook

# Instalar dependências
npm install

# Deploy com Serverless Framework
npx serverless deploy --stage production
```

### 7. Configurar Monitoramento

#### 7.1 Sentry

1. Crie um projeto no [sentry.io](https://sentry.io)
2. Copie o DSN
3. Adicione às variáveis de ambiente

#### 7.2 Datadog

1. Crie uma conta no [datadoghq.com](https://datadoghq.com)
2. Instale o agent no ECS
3. Configure as métricas customizadas

### 8. Verificação Final

#### 8.1 Checklist de Deploy

- [ ] RDS PostgreSQL rodando e acessível
- [ ] ElastiCache Redis rodando
- [ ] ECS Service com 2+ tasks healthy
- [ ] ALB respondendo em api.marketfin.com.br
- [ ] Frontend acessível em app.marketfin.com.br
- [ ] Webhooks funcionando (testar com curl)
- [ ] Clerk login funcionando
- [ ] Stripe checkout funcionando
- [ ] Sentry recebendo erros
- [ ] Logs no CloudWatch

#### 8.2 Testes de Smoke

```bash
# Health check
curl https://api.marketfin.com.br/health

# GraphQL
curl -X POST https://api.marketfin.com.br/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}'

# Webhook (Mercado Livre)
curl -X POST https://webhooks.marketfin.com.br/webhooks/mercado-livre \
  -H "Content-Type: application/json" \
  -d '{"test": true}'
```

## 🔄 CI/CD Automático

O GitHub Actions está configurado para deploy automático:

1. Push para `main` → Deploy para produção
2. Push para `develop` → Deploy para staging

Configure os secrets no GitHub:

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
```

## 💰 Custos Estimados (AWS)

| Serviço | Configuração | Custo/mês |
|---------|--------------|----------|
| RDS PostgreSQL | db.t3.medium, Multi-AZ | ~$100 |
| ElastiCache Redis | cache.t3.medium, 2 nodes | ~$70 |
| ECS Fargate | 2 tasks, 1vCPU, 2GB | ~$60 |
| ALB | 1 ALB | ~$20 |
| Lambda | ~1M invocações | ~$5 |
| S3 | 10GB | ~$1 |
| CloudWatch | Logs + Metrics | ~$20 |
| **Total** | | **~$276/mês** |

## 🆘 Troubleshooting

### ECS Tasks não iniciam
```bash
# Ver logs
aws logs tail /ecs/marketfin-backend --follow

# Ver eventos do service
aws ecs describe-services --cluster marketfin-cluster --services marketfin-backend
```

### Conexão com RDS falha
```bash
# Verificar security groups
aws ec2 describe-security-groups --group-ids sg-xxx

# Testar conectividade
aws ecs execute-command --cluster marketfin-cluster --task TASK_ID --container backend --command "nc -zv RDS_ENDPOINT 5432"
```

### Webhooks não chegam
```bash
# Ver logs do API Gateway
aws logs tail /aws/apigateway/marketfin-webhooks --follow

# Ver DLQ
aws sqs receive-message --queue-url https://sqs.us-east-1.amazonaws.com/xxx/marketfin-webhooks-dlq
```

## 📞 Suporte

Para dúvidas ou problemas:
- Email: suporte@marketfin.com.br
- Docs: https://docs.marketfin.com.br
