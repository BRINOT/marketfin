import { Module } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceResolver } from './finance.resolver';
import { ProfitCalculatorService } from './profit-calculator.service';

@Module({
  providers: [FinanceService, FinanceResolver, ProfitCalculatorService],
  exports: [FinanceService, ProfitCalculatorService],
})
export class FinanceModule {}
