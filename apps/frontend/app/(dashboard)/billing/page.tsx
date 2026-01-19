'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client';
import { gql } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  CreditCard,
  Check,
  Zap,
  Building,
  ArrowRight,
  Download,
  Calendar,
  AlertCircle,
} from 'lucide-react';

const GET_SUBSCRIPTION = gql`
  query GetSubscription {
    getSubscription {
      plan
      status
      currentPeriodEnd
      cancelAtPeriodEnd
      usage {
        orders
        ordersLimit
        integrations
        integrationsLimit
        users
        usersLimit
      }
    }
    getInvoices {
      id
      date
      amount
      status
      pdfUrl
    }
  }
`;

const CREATE_CHECKOUT = gql`
  mutation CreateCheckout($plan: Plan!) {
    createCheckoutSession(plan: $plan) {
      url
    }
  }
`;

const CREATE_PORTAL = gql`
  mutation CreatePortal {
    createPortalSession {
      url
    }
  }
`;

const plans = [
  {
    id: 'FREE',
    name: 'Gratuito',
    price: 0,
    description: 'Para quem está começando',
    features: [
      'Até 1.000 pedidos/mês',
      '1 integração de marketplace',
      '1 usuário',
      'Relatórios básicos',
      'Suporte por e-mail',
    ],
    limits: {
      orders: 1000,
      integrations: 1,
      users: 1,
    },
  },
  {
    id: 'PRO',
    name: 'Profissional',
    price: 49,
    description: 'Para vendedores em crescimento',
    popular: true,
    features: [
      'Até 10.000 pedidos/mês',
      '5 integrações de marketplace',
      '5 usuários',
      'Relatórios avançados',
      'Exportação PDF/Excel',
      'Suporte prioritário',
      'API de acesso',
    ],
    limits: {
      orders: 10000,
      integrations: 5,
      users: 5,
    },
  },
  {
    id: 'ENTERPRISE',
    name: 'Empresarial',
    price: 499,
    description: 'Para grandes operações',
    features: [
      'Pedidos ilimitados',
      'Integrações ilimitadas',
      'Usuários ilimitados',
      'Relatórios personalizados',
      'Integração ERP',
      'Gerente de conta dedicado',
      'SLA garantido',
      'Treinamento da equipe',
    ],
    limits: {
      orders: Infinity,
      integrations: Infinity,
      users: Infinity,
    },
  },
];

export default function BillingPage() {
  const { data, loading, refetch } = useQuery(GET_SUBSCRIPTION);

  const [createCheckout, { loading: checkoutLoading }] = useMutation(CREATE_CHECKOUT, {
    onCompleted: (data) => {
      window.location.href = data.createCheckoutSession.url;
    },
  });

  const [createPortal, { loading: portalLoading }] = useMutation(CREATE_PORTAL, {
    onCompleted: (data) => {
      window.location.href = data.createPortalSession.url;
    },
  });

  const handleUpgrade = (planId: string) => {
    createCheckout({ variables: { plan: planId } });
  };

  const handleManageBilling = () => {
    createPortal();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR');
  };

  const subscription = data?.getSubscription;
  const invoices = data?.getInvoices;
  const currentPlan = plans.find((p) => p.id === subscription?.plan) || plans[0];

  const usagePercentage = (used: number, limit: number) => {
    if (limit === Infinity) return 0;
    return Math.min((used / limit) * 100, 100);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Assinatura</h1>
          <p className="text-muted-foreground">
            Gerencie seu plano e faturamento
          </p>
        </div>
        {subscription?.plan !== 'FREE' && (
          <Button variant="outline" onClick={handleManageBilling} disabled={portalLoading}>
            <CreditCard className="mr-2 h-4 w-4" />
            {portalLoading ? 'Carregando...' : 'Gerenciar Pagamento'}
          </Button>
        )}
      </div>

      {/* Current Plan */}
      <Card>
        <CardHeader>
          <CardTitle>Plano Atual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                {currentPlan.id === 'FREE' && <Zap className="h-6 w-6 text-primary" />}
                {currentPlan.id === 'PRO' && <Zap className="h-6 w-6 text-blue-500" />}
                {currentPlan.id === 'ENTERPRISE' && <Building className="h-6 w-6 text-purple-500" />}
              </div>
              <div>
                <h3 className="text-xl font-bold">{currentPlan.name}</h3>
                <p className="text-muted-foreground">{currentPlan.description}</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold">
                {formatCurrency(currentPlan.price)}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </div>
              {subscription?.currentPeriodEnd && (
                <p className="text-sm text-muted-foreground">
                  {subscription.cancelAtPeriodEnd
                    ? `Cancela em ${formatDate(subscription.currentPeriodEnd)}`
                    : `Renova em ${formatDate(subscription.currentPeriodEnd)}`}
                </p>
              )}
            </div>
          </div>

          {subscription?.cancelAtPeriodEnd && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800">
                Sua assinatura será cancelada ao final do período atual.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usage */}
      {subscription?.usage && (
        <Card>
          <CardHeader>
            <CardTitle>Uso do Plano</CardTitle>
            <CardDescription>Acompanhe o consumo dos recursos do seu plano</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Pedidos este mês</span>
                <span className="text-sm text-muted-foreground">
                  {subscription.usage.orders.toLocaleString()} /{' '}
                  {subscription.usage.ordersLimit === Infinity
                    ? 'Ilimitado'
                    : subscription.usage.ordersLimit.toLocaleString()}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${
                    usagePercentage(subscription.usage.orders, subscription.usage.ordersLimit) > 80
                      ? 'bg-red-500'
                      : 'bg-primary'
                  }`}
                  style={{
                    width: `${usagePercentage(subscription.usage.orders, subscription.usage.ordersLimit)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Integrações</span>
                <span className="text-sm text-muted-foreground">
                  {subscription.usage.integrations} /{' '}
                  {subscription.usage.integrationsLimit === Infinity
                    ? 'Ilimitado'
                    : subscription.usage.integrationsLimit}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: `${usagePercentage(subscription.usage.integrations, subscription.usage.integrationsLimit)}%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Usuários</span>
                <span className="text-sm text-muted-foreground">
                  {subscription.usage.users} /{' '}
                  {subscription.usage.usersLimit === Infinity
                    ? 'Ilimitado'
                    : subscription.usage.usersLimit}
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full"
                  style={{
                    width: `${usagePercentage(subscription.usage.users, subscription.usage.usersLimit)}%`,
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Plans */}
      <div>
        <h2 className="text-xl font-bold mb-4">Planos Disponíveis</h2>
        <div className="grid gap-6 md:grid-cols-3">
          {plans.map((plan) => (
            <Card
              key={plan.id}
              className={`relative ${plan.popular ? 'border-primary shadow-lg' : ''}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary">Mais Popular</Badge>
                </div>
              )}
              <CardHeader>
                <CardTitle>{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <span className="text-4xl font-bold">{formatCurrency(plan.price)}</span>
                  <span className="text-muted-foreground">/mês</span>
                </div>

                <ul className="space-y-2">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full"
                  variant={plan.id === subscription?.plan ? 'outline' : 'default'}
                  disabled={plan.id === subscription?.plan || checkoutLoading}
                  onClick={() => handleUpgrade(plan.id)}
                >
                  {plan.id === subscription?.plan ? (
                    'Plano Atual'
                  ) : plan.price > currentPlan.price ? (
                    <>
                      Fazer Upgrade <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  ) : (
                    'Selecionar'
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Invoices */}
      {invoices && invoices.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Faturas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 font-medium">Data</th>
                    <th className="text-left py-3 px-4 font-medium">Valor</th>
                    <th className="text-left py-3 px-4 font-medium">Status</th>
                    <th className="text-right py-3 px-4 font-medium">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.map((invoice: any) => (
                    <tr key={invoice.id} className="border-b hover:bg-muted/50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          {formatDate(invoice.date)}
                        </div>
                      </td>
                      <td className="py-3 px-4 font-medium">
                        {formatCurrency(invoice.amount / 100)}
                      </td>
                      <td className="py-3 px-4">
                        <Badge
                          className={
                            invoice.status === 'paid'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }
                        >
                          {invoice.status === 'paid' ? 'Pago' : 'Pendente'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {invoice.pdfUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(invoice.pdfUrl, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
