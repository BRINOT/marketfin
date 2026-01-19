import { Resolver, Query, Args, ObjectType, Field, Float, Int, InputType, registerEnumType } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { FinanceService, ProfitFilters, ProfitReport } from './finance.service';
import { AuthGuard } from '../auth/guards/auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/auth.service';
import { Marketplace } from '@prisma/client';

// Register enums
enum GroupBy {
  DAY = 'DAY',
  WEEK = 'WEEK',
  MONTH = 'MONTH',
  MARKETPLACE = 'MARKETPLACE',
  PRODUCT = 'PRODUCT',
}

registerEnumType(GroupBy, {
  name: 'GroupBy',
  description: 'Grouping options for reports',
});

registerEnumType(Marketplace, {
  name: 'Marketplace',
  description: 'Supported marketplaces',
});

// Input types
@InputType()
class ProfitFiltersInput {
  @Field()
  startDate: Date;

  @Field()
  endDate: Date;

  @Field(() => [Marketplace], { nullable: true })
  marketplace?: Marketplace[];

  @Field(() => GroupBy)
  groupBy: GroupBy;
}

// Output types
@ObjectType()
class ProfitReportItem {
  @Field()
  label: string;

  @Field(() => Float)
  revenue: number;

  @Field(() => Float)
  profit: number;

  @Field(() => Float)
  margin: number;

  @Field(() => Int)
  orders: number;

  @Field(() => Float)
  fees: number;

  @Field(() => Float)
  taxes: number;

  @Field(() => Float)
  shipping: number;

  @Field(() => Float)
  productCost: number;
}

@ObjectType()
class ProfitReportType {
  @Field(() => Float)
  totalRevenue: number;

  @Field(() => Float)
  totalFees: number;

  @Field(() => Float)
  totalShipping: number;

  @Field(() => Float)
  totalTaxes: number;

  @Field(() => Float)
  totalCost: number;

  @Field(() => Float)
  netProfit: number;

  @Field(() => Float)
  profitMargin: number;

  @Field(() => Int)
  totalOrders: number;

  @Field(() => [ProfitReportItem])
  items: ProfitReportItem[];
}

@ObjectType()
class QuickStats {
  @Field(() => Float)
  revenue: number;

  @Field(() => Float)
  profit: number;

  @Field(() => Int)
  orders: number;
}

@ObjectType()
class GrowthStats {
  @Field(() => Float)
  revenue: number;

  @Field(() => Float)
  profit: number;

  @Field(() => Float)
  orders: number;
}

@ObjectType()
class DashboardKPIs {
  @Field(() => QuickStats)
  today: QuickStats;

  @Field(() => QuickStats)
  thisMonth: QuickStats;

  @Field(() => QuickStats)
  lastMonth: QuickStats;

  @Field(() => GrowthStats)
  growth: GrowthStats;
}

@Resolver()
export class FinanceResolver {
  constructor(private financeService: FinanceService) {}

  @Query(() => ProfitReportType, { name: 'getProfitReport' })
  @UseGuards(AuthGuard)
  async getProfitReport(
    @Args('filters') filters: ProfitFiltersInput,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProfitReport> {
    const profitFilters: ProfitFilters = {
      tenantId: user.tenantId,
      startDate: new Date(filters.startDate),
      endDate: new Date(filters.endDate),
      marketplace: filters.marketplace,
      groupBy: filters.groupBy,
    };

    return this.financeService.getProfitReport(profitFilters);
  }

  @Query(() => DashboardKPIs, { name: 'getDashboardKPIs' })
  @UseGuards(AuthGuard)
  async getDashboardKPIs(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<DashboardKPIs> {
    return this.financeService.getDashboardKPIs(user.tenantId);
  }
}
