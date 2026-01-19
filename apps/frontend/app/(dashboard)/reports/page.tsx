'use client';

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { format, subDays, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { ProfitTable } from '@/components/reports/ProfitTable';
import { ExportButton } from '@/components/reports/ExportButton';
import { GET_PROFIT_REPORT } from '@/lib/graphql/queries';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Download, FileSpreadsheet, FileText } from 'lucide-react';

type GroupBy = 'DAY' | 'WEEK' | 'MONTH' | 'MARKETPLACE' | 'PRODUCT';

export default function ReportsPage() {
  const [dateRange, setDateRange] = useState({
    startDate: startOfMonth(new Date()),
    endDate: new Date(),
  });
  const [groupBy, setGroupBy] = useState<GroupBy>('DAY');
  const [selectedMarketplaces, setSelectedMarketplaces] = useState<string[]>([]);

  const { data, loading, refetch } = useQuery(GET_PROFIT_REPORT, {
    variables: {
      filters: {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        groupBy,
        marketplace: selectedMarketplaces.length > 0 ? selectedMarketplaces : undefined,
      },
    },
  });

  const report = data?.getProfitReport;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const quickDateRanges = [
    {
      label: 'Hoje',
      range: { startDate: new Date(), endDate: new Date() },
    },
    {
      label: 'Últimos 7 dias',
      range: { startDate: subDays(new Date(), 7), endDate: new Date() },
    },
    {
      label: 'Últimos 30 dias',
      range: { startDate: subDays(new Date(), 30), endDate: new Date() },
    },
    {
      label: 'Este mês',
      range: { startDate: startOfMonth(new Date()), endDate: new Date() },
    },
    {
      label: 'Mês passado',
      range: {
        startDate: startOfMonth(subMonths(new Date(), 1)),
        endDate: endOfMonth(subMonths(new Date(), 1)),
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500 mt-1">
            Analise o desempenho financeiro do seu negócio
          </p>
        </div>
        <div className="mt-4 sm:mt-0 flex gap-2">
          <ExportButton data={report} format="excel" />
          <ExportButton data={report} format="pdf" />
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            {/* Quick Date Ranges */}
            <div className="flex flex-wrap gap-2">
              {quickDateRanges.map((item) => (
                <Button
                  key={item.label}
                  variant="outline"
                  size="sm"
                  onClick={() => setDateRange(item.range)}
                >
                  {item.label}
                </Button>
              ))}
            </div>

            {/* Custom Date Range */}
            <DateRangePicker value={dateRange} onChange={setDateRange} />

            {/* Group By */}
            <Select value={groupBy} onValueChange={(v) => setGroupBy(v as GroupBy)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Agrupar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAY">Por Dia</SelectItem>
                <SelectItem value="WEEK">Por Semana</SelectItem>
                <SelectItem value="MONTH">Por Mês</SelectItem>
                <SelectItem value="MARKETPLACE">Por Marketplace</SelectItem>
                <SelectItem value="PRODUCT">Por Produto</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Faturamento</p>
              <p className="text-xl font-bold text-gray-900">
                {formatCurrency(report.totalRevenue)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Taxas</p>
              <p className="text-xl font-bold text-red-600">
                {formatCurrency(report.totalFees)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Frete</p>
              <p className="text-xl font-bold text-orange-600">
                {formatCurrency(report.totalShipping)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Impostos</p>
              <p className="text-xl font-bold text-yellow-600">
                {formatCurrency(report.totalTaxes)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Custo</p>
              <p className="text-xl font-bold text-purple-600">
                {formatCurrency(report.totalCost)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <p className="text-sm text-muted-foreground">Lucro Líquido</p>
              <p className={`text-xl font-bold ${report.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(report.netProfit)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Detalhamento</CardTitle>
        </CardHeader>
        <CardContent>
          <ProfitTable data={report?.items || []} loading={loading} />
        </CardContent>
      </Card>
    </div>
  );
}
