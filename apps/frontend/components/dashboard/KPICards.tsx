'use client';

import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Percent } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface KPIData {
  today: { revenue: number; profit: number; orders: number };
  thisMonth: { revenue: number; profit: number; orders: number };
  lastMonth: { revenue: number; profit: number; orders: number };
  growth: { revenue: number; profit: number; orders: number };
}

interface KPICardsProps {
  data?: KPIData;
  loading?: boolean;
}

export function KPICards({ data, loading }: KPICardsProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatPercent = (value: number) => {
    const sign = value >= 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32 mb-2" />
              <Skeleton className="h-4 w-20" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const kpis = [
    {
      title: 'Faturamento do Mês',
      value: formatCurrency(data?.thisMonth.revenue || 0),
      change: data?.growth.revenue || 0,
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
    },
    {
      title: 'Lucro Líquido',
      value: formatCurrency(data?.thisMonth.profit || 0),
      change: data?.growth.profit || 0,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
    },
    {
      title: 'Pedidos do Mês',
      value: data?.thisMonth.orders?.toLocaleString('pt-BR') || '0',
      change: data?.growth.orders || 0,
      icon: ShoppingCart,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
    },
    {
      title: 'Margem de Lucro',
      value: data?.thisMonth.revenue
        ? `${((data.thisMonth.profit / data.thisMonth.revenue) * 100).toFixed(1)}%`
        : '0%',
      change: null,
      icon: Percent,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.title}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{kpi.title}</p>
                <p className="text-2xl font-bold mt-1">{kpi.value}</p>
                {kpi.change !== null && (
                  <div className="flex items-center mt-2">
                    {kpi.change >= 0 ? (
                      <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-500 mr-1" />
                    )}
                    <span
                      className={`text-sm font-medium ${
                        kpi.change >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}
                    >
                      {formatPercent(kpi.change)}
                    </span>
                    <span className="text-sm text-muted-foreground ml-1">vs mês anterior</span>
                  </div>
                )}
              </div>
              <div className={`p-3 rounded-full ${kpi.bgColor}`}>
                <kpi.icon className={`h-6 w-6 ${kpi.color}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
