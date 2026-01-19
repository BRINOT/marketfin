import { Injectable } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

export interface TaxSettings {
  icmsRate: number;      // ICMS rate (e.g., 0.18 = 18%)
  pisCofinsRate: number; // PIS/COFINS rate (e.g., 0.0465 = 4.65%)
  issRate?: number;      // ISS rate for services
  simplesRate?: number;  // Simples Nacional rate
  taxRegime: 'SIMPLES_NACIONAL' | 'LUCRO_PRESUMIDO' | 'LUCRO_REAL';
}

export interface CalculationInput {
  orderTotal: number;
  fees: number[];           // Marketplace commissions
  shippingCost: number;     // Shipping cost paid by seller
  shippingPaidByBuyer: number; // Shipping paid by buyer
  productCost: number;      // Total product cost
  taxSettings: TaxSettings;
}

export interface CalculationResult {
  netProfit: number;
  taxes: number;
  totalFees: number;
  profitMargin: number;     // Percentage
  breakdown: {
    revenue: number;
    icms: number;
    pisCofins: number;
    iss: number;
    simples: number;
    fees: number;
    shipping: number;
    productCost: number;
  };
}

@Injectable()
export class ProfitCalculatorService {
  /**
   * Calculate net profit for an order
   */
  calculate(input: CalculationInput): CalculationResult {
    const { orderTotal, fees, shippingCost, shippingPaidByBuyer, productCost, taxSettings } = input;

    // Calculate total fees
    const totalFees = fees.reduce((sum, fee) => sum + fee, 0);

    // Calculate taxes based on tax regime
    let icms = 0;
    let pisCofins = 0;
    let iss = 0;
    let simples = 0;

    if (taxSettings.taxRegime === 'SIMPLES_NACIONAL' && taxSettings.simplesRate) {
      // Simples Nacional - single rate covers all taxes
      simples = orderTotal * taxSettings.simplesRate;
    } else {
      // Lucro Presumido or Lucro Real
      icms = orderTotal * taxSettings.icmsRate;
      pisCofins = orderTotal * taxSettings.pisCofinsRate;
      
      if (taxSettings.issRate) {
        iss = orderTotal * taxSettings.issRate;
      }
    }

    const totalTaxes = icms + pisCofins + iss + simples;

    // Calculate net shipping cost (what seller actually pays)
    const netShippingCost = Math.max(0, shippingCost - shippingPaidByBuyer);

    // Calculate net profit
    const netProfit = orderTotal - totalFees - netShippingCost - productCost - totalTaxes;

    // Calculate profit margin
    const profitMargin = orderTotal > 0 ? (netProfit / orderTotal) * 100 : 0;

    return {
      netProfit: this.round(netProfit),
      taxes: this.round(totalTaxes),
      totalFees: this.round(totalFees),
      profitMargin: this.round(profitMargin),
      breakdown: {
        revenue: this.round(orderTotal),
        icms: this.round(icms),
        pisCofins: this.round(pisCofins),
        iss: this.round(iss),
        simples: this.round(simples),
        fees: this.round(totalFees),
        shipping: this.round(netShippingCost),
        productCost: this.round(productCost),
      },
    };
  }

  /**
   * Calculate profit for multiple orders (batch)
   */
  calculateBatch(inputs: CalculationInput[]): CalculationResult[] {
    return inputs.map((input) => this.calculate(input));
  }

  /**
   * Aggregate profit results
   */
  aggregate(results: CalculationResult[]): {
    totalRevenue: number;
    totalProfit: number;
    totalTaxes: number;
    totalFees: number;
    averageMargin: number;
  } {
    const totals = results.reduce(
      (acc, result) => ({
        revenue: acc.revenue + result.breakdown.revenue,
        profit: acc.profit + result.netProfit,
        taxes: acc.taxes + result.taxes,
        fees: acc.fees + result.totalFees,
      }),
      { revenue: 0, profit: 0, taxes: 0, fees: 0 },
    );

    return {
      totalRevenue: this.round(totals.revenue),
      totalProfit: this.round(totals.profit),
      totalTaxes: this.round(totals.taxes),
      totalFees: this.round(totals.fees),
      averageMargin: totals.revenue > 0
        ? this.round((totals.profit / totals.revenue) * 100)
        : 0,
    };
  }

  /**
   * Convert Prisma Decimal to number
   */
  decimalToNumber(decimal: Decimal | null | undefined): number {
    if (!decimal) return 0;
    return parseFloat(decimal.toString());
  }

  /**
   * Round to 2 decimal places
   */
  private round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
