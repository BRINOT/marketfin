'use client';

import { useState } from 'react';
import { useQuery } from '@apollo/client';
import { format, subDays, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { KPICards } from '@/components/dashboard/KPICards';
import { ProfitChart } from '@/components/dashboard/ProfitChart';
import { RecentOrders } from '@/components/dashboard/RecentOrders';
import { MarketplaceBreakdown } from '@/components/dashboard/MarketplaceBreakdown';
import { DateRangePicker } from '@/components/ui/date-range-picker';
import { GET_DASHBOARD_KPIS, GET_PROFIT_REPORT } from '@/lib/graphql/queries';

export default function DashboardPage() {
  const [dateRange, setDateRange] = useState({
    startDate: startOfMonth(new Date()),
    endDate: new Date(),
  });

  const { data: kpisData, loading: kpisLoading } = useQuery(GET_DASHBOARD_KPIS);
  
  const { data: profitData, loading: profitLoading } = useQuery(GET_PROFIT_REPORT, {
    variables: {
      filters: {
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString(),
        groupBy: 'DAY',
      },
    },
  });

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Visão geral do seu negócio
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <KPICards data={kpisData?.getDashboardKPIs} loading={kpisLoading} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ProfitChart
            data={profitData?.getProfitReport?.items || []}
            loading={profitLoading}
          />
        </div>
        <div>
          <MarketplaceBreakdown
            startDate={dateRange.startDate}
            endDate={dateRange.endDate}
          />
        </div>
      </div>

      {/* Recent Orders */}
      <RecentOrders />
    </div>
  );
}
