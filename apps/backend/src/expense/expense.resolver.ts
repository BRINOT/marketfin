import { Resolver, Query, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { ExpenseService, CreateExpenseInput, UpdateExpenseInput, ExpenseFilters, PaginationInput } from './expense.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';

@Resolver('Expense')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExpenseResolver {
  constructor(private expenseService: ExpenseService) {}

  @Query('expenses')
  async getExpenses(
    @CurrentTenant() tenantId: string,
    @Args('filters') filters?: ExpenseFilters,
    @Args('pagination') pagination?: PaginationInput,
  ) {
    return this.expenseService.findAll(tenantId, filters, pagination);
  }

  @Query('expense')
  async getExpense(
    @CurrentTenant() tenantId: string,
    @Args('id') id: string,
  ) {
    return this.expenseService.findById(tenantId, id);
  }

  @Query('expenseStats')
  async getExpenseStats(
    @CurrentTenant() tenantId: string,
    @Args('startDate') startDate?: Date,
    @Args('endDate') endDate?: Date,
  ) {
    return this.expenseService.getExpenseStats(tenantId, startDate, endDate);
  }

  @Mutation('createExpense')
  @Roles('ADMIN', 'MANAGER')
  async createExpense(
    @CurrentTenant() tenantId: string,
    @Args('input') input: CreateExpenseInput,
  ) {
    return this.expenseService.create(tenantId, input);
  }

  @Mutation('updateExpense')
  @Roles('ADMIN', 'MANAGER')
  async updateExpense(
    @CurrentTenant() tenantId: string,
    @Args('id') id: string,
    @Args('input') input: UpdateExpenseInput,
  ) {
    return this.expenseService.update(tenantId, id, input);
  }

  @Mutation('deleteExpense')
  @Roles('ADMIN')
  async deleteExpense(
    @CurrentTenant() tenantId: string,
    @Args('id') id: string,
  ) {
    return this.expenseService.delete(tenantId, id);
  }

  @Mutation('bulkCreateExpenses')
  @Roles('ADMIN', 'MANAGER')
  async bulkCreateExpenses(
    @CurrentTenant() tenantId: string,
    @Args('expenses') expenses: CreateExpenseInput[],
  ) {
    return this.expenseService.bulkCreate(tenantId, expenses);
  }
}
