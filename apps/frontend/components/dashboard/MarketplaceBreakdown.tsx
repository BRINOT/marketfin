'use client';

import { useQuery } from '@apollo/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { GET_PROFIT_REPORT } from '@/lib/graphql/queries';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface MarketplaceBreakdownProps {
  startDate: Date;
  endDate: Date;
}

const COLORS = {
  MERCADO_LIVRE: '#FFE600',
  AMAZON: '#FF9900',
  SHOPEE: '#EE4D2D',
  MAGALU: '#0086FF',
  AMERICANAS: '#E60014',
  CUSTOM: '#6B7280',
};

const MARKETPLACE_NAMES: Record<string, string> = {
  MERCADO_LIVRE: 'Mercado Livre',
  AMAZON: 'Amazon',
  SHOPEE: 'Shopee',
  MAGALU: 'Magazine Luiza',
  AMERICANAS: 'Americanas',
  CUSTOM: 'Outros',
};

export function MarketplaceBreakdown({ startDate, endDate }: MarketplaceBreakdownProps) {
  const { data, loading } = useQuery(GET_PROFIT_REPORT, {
    variables: {
      filters: {
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        groupBy: 'MARKETPLACE',
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
        <CardHeader>
          <CardTitle>Por Marketplace</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[300px] w-full" />
        </CardContent>
      </Card>
    );
  }

  const chartData = (data?.getProfitReport?.items || []).map((item: any) => ({
    name: MARKETPLACE_NAMES[item.label] || item.label,
    value: item.revenue,
    profit: item.profit,
    color: COLORS[item.label as keyof typeof COLORS] || COLORS.CUSTOM,
  }));

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Por Marketplace</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px] flex items-center justify-center text-muted-foreground">
            Nenhum dado disponível
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Por Marketplace</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={100}
              paddingAngle={2}
              dataKey="value"
            >
              {chartData.map((entry: any, index: number) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatCurrency(value)}
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '8px',
              }}
            />
            <Legend
              formatter={(value) => <span className="text-sm">{value}</span>}
              layout="vertical"
              align="right"
              verticalAlign="middle"
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Summary */}
        <div className="mt-4 space-y-2">
          {chartData.map((item: any) => (
            <div key={item.name} className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
                <span>{item.name}</span>
              </div>
              <span className="font-medium">{formatCurrency(item.value)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
