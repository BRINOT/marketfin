'use client';

import { useQuery } from '@apollo/client';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { GET_ORDERS } from '@/lib/graphql/queries';
import { ArrowRight, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const STATUS_COLORS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  PAID: 'bg-blue-100 text-blue-800',
  PROCESSING: 'bg-purple-100 text-purple-800',
  SHIPPED: 'bg-indigo-100 text-indigo-800',
  DELIVERED: 'bg-green-100 text-green-800',
  REFUNDED: 'bg-orange-100 text-orange-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pendente',
  PAID: 'Pago',
  PROCESSING: 'Processando',
  SHIPPED: 'Enviado',
  DELIVERED: 'Entregue',
  REFUNDED: 'Reembolsado',
  CANCELLED: 'Cancelado',
};

const MARKETPLACE_COLORS: Record<string, string> = {
  MERCADO_LIVRE: 'bg-yellow-500',
  AMAZON: 'bg-orange-500',
  SHOPEE: 'bg-orange-600',
  MAGALU: 'bg-blue-600',
  AMERICANAS: 'bg-red-600',
};

export function RecentOrders() {
  const { data, loading } = useQuery(GET_ORDERS, {
    variables: {
      filters: {
        limit: 5,
        page: 1,
      },
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Últimos Pedidos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
                <Skeleton className="h-6 w-20" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const orders = data?.getOrders?.orders || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Últimos Pedidos</CardTitle>
        <Link href="/orders">
          <Button variant="ghost" size="sm">
            Ver todos
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {orders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum pedido encontrado
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order: any) => (
              <div
                key={order.id}
                className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  {/* Marketplace indicator */}
                  <div
                    className={`w-2 h-10 rounded-full ${MARKETPLACE_COLORS[order.marketplace] || 'bg-gray-400'}`}
                  />

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">#{order.marketplaceOrderId}</span>
                      <Badge className={STATUS_COLORS[order.status]}>
                        {STATUS_LABELS[order.status]}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {order.customerName || 'Cliente'} •{' '}
                      {format(new Date(order.orderDate), "dd 'de' MMM", { locale: ptBR })}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-medium">{formatCurrency(order.totalAmount)}</div>
                  <div
                    className={`text-sm ${
                      order.netProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    Lucro: {formatCurrency(order.netProfit)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
