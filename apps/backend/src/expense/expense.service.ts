import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, Expense, ExpenseType, Marketplace } from '@prisma/client';

export interface CreateExpenseInput {
  type: ExpenseType;
  amount: number;
  date: Date;
  description?: string;
  marketplace?: Marketplace;
}

export interface UpdateExpenseInput {
  type?: ExpenseType;
  amount?: number;
  date?: Date;
  description?: string;
  marketplace?: Marketplace;
}

export interface ExpenseFilters {
  type?: ExpenseType[];
  marketplace?: Marketplace[];
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export interface PaginationInput {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(private prisma: PrismaService) {}

  async create(tenantId: string, input: CreateExpenseInput): Promise<Expense> {
    return this.prisma.expense.create({
      data: {
        tenantId,
        type: input.type,
        amount: input.amount,
        date: input.date,
        description: input.description,
        marketplace: input.marketplace,
      },
    });
  }

  async findAll(
    tenantId: string,
    filters?: ExpenseFilters,
    pagination?: PaginationInput,
  ): Promise<{ expenses: Expense[]; total: number; pages: number }> {
    const page = pagination?.page || 1;
    const pageSize = pagination?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ExpenseWhereInput = {
      tenantId,
      ...(filters?.type?.length && { type: { in: filters.type } }),
      ...(filters?.marketplace?.length && { marketplace: { in: filters.marketplace } }),
      ...(filters?.startDate && { date: { gte: filters.startDate } }),
      ...(filters?.endDate && { date: { lte: filters.endDate } }),
      ...(filters?.minAmount !== undefined && { amount: { gte: filters.minAmount } }),
      ...(filters?.maxAmount !== undefined && { amount: { lte: filters.maxAmount } }),
    };

    const orderBy: Prisma.ExpenseOrderByWithRelationInput = pagination?.sortBy
      ? { [pagination.sortBy]: pagination.sortOrder || 'desc' }
      : { date: 'desc' };

    const [expenses, total] = await Promise.all([
      this.prisma.expense.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
      }),
      this.prisma.expense.count({ where }),
    ]);

    return {
      expenses,
      total,
      pages: Math.ceil(total / pageSize),
    };
  }

  async findById(tenantId: string, id: string): Promise<Expense> {
    const expense = await this.prisma.expense.findFirst({
      where: { id, tenantId },
    });

    if (!expense) {
      throw new NotFoundException(`Expense with ID ${id} not found`);
    }

    return expense;
  }

  async update(tenantId: string, id: string, input: UpdateExpenseInput): Promise<Expense> {
    await this.findById(tenantId, id); // Verify exists

    return this.prisma.expense.update({
      where: { id },
      data: input,
    });
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    await this.findById(tenantId, id); // Verify exists

    await this.prisma.expense.delete({
      where: { id },
    });

    return true;
  }

  async getExpenseStats(
    tenantId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<{
    totalExpenses: number;
    totalAmount: number;
    byType: Record<ExpenseType, number>;
    byMarketplace: Record<string, number>;
    monthlyTrend: { month: string; amount: number }[];
  }> {
    const where: Prisma.ExpenseWhereInput = {
      tenantId,
      ...(startDate && { date: { gte: startDate } }),
      ...(endDate && { date: { lte: endDate } }),
    };

    const [expenses, typeCounts, marketplaceCounts] = await Promise.all([
      this.prisma.expense.aggregate({
        where,
        _count: true,
        _sum: { amount: true },
      }),
      this.prisma.expense.groupBy({
        by: ['type'],
        where,
        _sum: { amount: true },
      }),
      this.prisma.expense.groupBy({
        by: ['marketplace'],
        where: { ...where, marketplace: { not: null } },
        _sum: { amount: true },
      }),
    ]);

    const byType = typeCounts.reduce(
      (acc, item) => ({ ...acc, [item.type]: Number(item._sum.amount) || 0 }),
      {} as Record<ExpenseType, number>,
    );

    const byMarketplace = marketplaceCounts.reduce(
      (acc, item) => ({
        ...acc,
        [item.marketplace || 'OTHER']: Number(item._sum.amount) || 0,
      }),
      {} as Record<string, number>,
    );

    // Get monthly trend for the last 12 months
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    const monthlyExpenses = await this.prisma.$queryRaw<{ month: string; amount: number }[]>`
      SELECT 
        TO_CHAR(date, 'YYYY-MM') as month,
        SUM(amount) as amount
      FROM "Expense"
      WHERE "tenantId" = ${tenantId}
        AND date >= ${twelveMonthsAgo}
      GROUP BY TO_CHAR(date, 'YYYY-MM')
      ORDER BY month ASC
    `;

    return {
      totalExpenses: expenses._count,
      totalAmount: Number(expenses._sum.amount) || 0,
      byType,
      byMarketplace,
      monthlyTrend: monthlyExpenses.map((m) => ({
        month: m.month,
        amount: Number(m.amount),
      })),
    };
  }

  async bulkCreate(tenantId: string, expenses: CreateExpenseInput[]): Promise<number> {
    const result = await this.prisma.expense.createMany({
      data: expenses.map((e) => ({
        tenantId,
        type: e.type,
        amount: e.amount,
        date: e.date,
        description: e.description,
        marketplace: e.marketplace,
      })),
    });

    return result.count;
  }
}
