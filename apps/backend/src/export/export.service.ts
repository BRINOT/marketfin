import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

export interface ExportFilters {
  tenantId: string;
  startDate: Date;
  endDate: Date;
  marketplace?: string[];
  type: 'orders' | 'profit' | 'expenses' | 'products';
}

@Injectable()
export class ExportService {
  constructor(private prisma: PrismaService) {}

  async exportToExcel(filters: ExportFilters): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MarketFin';
    workbook.created = new Date();

    switch (filters.type) {
      case 'orders':
        await this.addOrdersSheet(workbook, filters);
        break;
      case 'profit':
        await this.addProfitSheet(workbook, filters);
        break;
      case 'expenses':
        await this.addExpensesSheet(workbook, filters);
        break;
      case 'products':
        await this.addProductsSheet(workbook, filters);
        break;
    }

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }

  async exportToPDF(filters: ExportFilters): Promise<Buffer> {
    return new Promise(async (resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('MarketFin - Relatório', { align: 'center' });
      doc.moveDown();
      doc.fontSize(12).text(`Período: ${filters.startDate.toLocaleDateString('pt-BR')} - ${filters.endDate.toLocaleDateString('pt-BR')}`);
      doc.moveDown();

      switch (filters.type) {
        case 'orders':
          await this.addOrdersPDF(doc, filters);
          break;
        case 'profit':
          await this.addProfitPDF(doc, filters);
          break;
        case 'expenses':
          await this.addExpensesPDF(doc, filters);
          break;
        case 'products':
          await this.addProductsPDF(doc, filters);
          break;
      }

      doc.end();
    });
  }

  private async addOrdersSheet(workbook: ExcelJS.Workbook, filters: ExportFilters) {
    const sheet = workbook.addWorksheet('Pedidos');

    // Headers
    sheet.columns = [
      { header: 'ID Pedido', key: 'marketplaceOrderId', width: 20 },
      { header: 'Data', key: 'orderDate', width: 15 },
      { header: 'Marketplace', key: 'marketplace', width: 15 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Total', key: 'totalAmount', width: 12 },
      { header: 'Taxas', key: 'fees', width: 12 },
      { header: 'Frete', key: 'shippingCost', width: 12 },
      { header: 'Impostos', key: 'taxes', width: 12 },
      { header: 'Lucro Líquido', key: 'netProfit', width: 15 },
      { header: 'Cliente', key: 'customerName', width: 25 },
    ];

    // Style header row
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' },
    };

    // Fetch data
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId: filters.tenantId,
        orderDate: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
        ...(filters.marketplace && { marketplace: { in: filters.marketplace as any } }),
      },
      orderBy: { orderDate: 'desc' },
    });

    // Add data rows
    orders.forEach((order) => {
      sheet.addRow({
        marketplaceOrderId: order.marketplaceOrderId,
        orderDate: order.orderDate.toLocaleDateString('pt-BR'),
        marketplace: order.marketplace,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        fees: Number(order.fees),
        shippingCost: Number(order.shippingCost),
        taxes: Number(order.taxes),
        netProfit: Number(order.netProfit),
        customerName: order.customerName || '-',
      });
    });

    // Format currency columns
    ['E', 'F', 'G', 'H', 'I'].forEach((col) => {
      sheet.getColumn(col).numFmt = 'R$ #,##0.00';
    });

    // Add totals row
    const lastRow = sheet.rowCount + 1;
    sheet.addRow({
      marketplaceOrderId: 'TOTAL',
      totalAmount: { formula: `SUM(E2:E${lastRow - 1})` },
      fees: { formula: `SUM(F2:F${lastRow - 1})` },
      shippingCost: { formula: `SUM(G2:G${lastRow - 1})` },
      taxes: { formula: `SUM(H2:H${lastRow - 1})` },
      netProfit: { formula: `SUM(I2:I${lastRow - 1})` },
    });
    sheet.getRow(lastRow).font = { bold: true };
  }

  private async addProfitSheet(workbook: ExcelJS.Workbook, filters: ExportFilters) {
    const sheet = workbook.addWorksheet('Lucro');

    sheet.columns = [
      { header: 'Período', key: 'period', width: 15 },
      { header: 'Marketplace', key: 'marketplace', width: 15 },
      { header: 'Faturamento', key: 'revenue', width: 15 },
      { header: 'Taxas', key: 'fees', width: 12 },
      { header: 'Frete', key: 'shipping', width: 12 },
      { header: 'Impostos', key: 'taxes', width: 12 },
      { header: 'Custo Produtos', key: 'cost', width: 15 },
      { header: 'Lucro Líquido', key: 'profit', width: 15 },
      { header: 'Margem %', key: 'margin', width: 12 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' },
    };

    // Aggregate data by day and marketplace
    const orders = await this.prisma.order.groupBy({
      by: ['marketplace'],
      where: {
        tenantId: filters.tenantId,
        orderDate: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      },
      _sum: {
        totalAmount: true,
        fees: true,
        shippingCost: true,
        taxes: true,
        netProfit: true,
      },
    });

    orders.forEach((row) => {
      const revenue = Number(row._sum.totalAmount) || 0;
      const profit = Number(row._sum.netProfit) || 0;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      sheet.addRow({
        period: `${filters.startDate.toLocaleDateString('pt-BR')} - ${filters.endDate.toLocaleDateString('pt-BR')}`,
        marketplace: row.marketplace,
        revenue,
        fees: Number(row._sum.fees) || 0,
        shipping: Number(row._sum.shippingCost) || 0,
        taxes: Number(row._sum.taxes) || 0,
        cost: 0, // Would need to calculate from order items
        profit,
        margin: margin.toFixed(2) + '%',
      });
    });

    ['C', 'D', 'E', 'F', 'G', 'H'].forEach((col) => {
      sheet.getColumn(col).numFmt = 'R$ #,##0.00';
    });
  }

  private async addExpensesSheet(workbook: ExcelJS.Workbook, filters: ExportFilters) {
    const sheet = workbook.addWorksheet('Despesas');

    sheet.columns = [
      { header: 'Data', key: 'date', width: 15 },
      { header: 'Tipo', key: 'type', width: 15 },
      { header: 'Descrição', key: 'description', width: 30 },
      { header: 'Marketplace', key: 'marketplace', width: 15 },
      { header: 'Valor', key: 'amount', width: 15 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' },
    };

    const expenses = await this.prisma.expense.findMany({
      where: {
        tenantId: filters.tenantId,
        date: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      },
      orderBy: { date: 'desc' },
    });

    expenses.forEach((expense) => {
      sheet.addRow({
        date: expense.date.toLocaleDateString('pt-BR'),
        type: expense.type,
        description: expense.description || '-',
        marketplace: expense.marketplace || '-',
        amount: Number(expense.amount),
      });
    });

    sheet.getColumn('E').numFmt = 'R$ #,##0.00';
  }

  private async addProductsSheet(workbook: ExcelJS.Workbook, filters: ExportFilters) {
    const sheet = workbook.addWorksheet('Produtos');

    sheet.columns = [
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Nome', key: 'name', width: 30 },
      { header: 'Custo', key: 'costPrice', width: 12 },
      { header: 'Preço Venda', key: 'salePrice', width: 12 },
      { header: 'Margem', key: 'margin', width: 12 },
      { header: 'Estoque', key: 'stock', width: 10 },
      { header: 'Valor Estoque', key: 'stockValue', width: 15 },
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '4F81BD' },
    };

    const products = await this.prisma.product.findMany({
      where: { tenantId: filters.tenantId },
      orderBy: { name: 'asc' },
    });

    products.forEach((product) => {
      const cost = Number(product.costPrice);
      const sale = Number(product.salePrice);
      const margin = sale > 0 ? ((sale - cost) / sale) * 100 : 0;

      sheet.addRow({
        sku: product.sku,
        name: product.name,
        costPrice: cost,
        salePrice: sale,
        margin: margin.toFixed(2) + '%',
        stock: product.stock,
        stockValue: cost * product.stock,
      });
    });

    ['C', 'D', 'G'].forEach((col) => {
      sheet.getColumn(col).numFmt = 'R$ #,##0.00';
    });
  }

  private async addOrdersPDF(doc: PDFKit.PDFDocument, filters: ExportFilters) {
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId: filters.tenantId,
        orderDate: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      },
      orderBy: { orderDate: 'desc' },
      take: 100, // Limit for PDF
    });

    doc.fontSize(16).text('Relatório de Pedidos', { underline: true });
    doc.moveDown();

    // Summary
    const totalRevenue = orders.reduce((sum, o) => sum + Number(o.totalAmount), 0);
    const totalProfit = orders.reduce((sum, o) => sum + Number(o.netProfit), 0);

    doc.fontSize(12);
    doc.text(`Total de Pedidos: ${orders.length}`);
    doc.text(`Faturamento Total: R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    doc.text(`Lucro Total: R$ ${totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    doc.moveDown();

    // Table header
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('ID Pedido | Data | Marketplace | Total | Lucro', { continued: false });
    doc.font('Helvetica');
    doc.moveDown(0.5);

    // Table rows
    orders.slice(0, 50).forEach((order) => {
      doc.text(
        `${order.marketplaceOrderId.substring(0, 15)} | ` +
        `${order.orderDate.toLocaleDateString('pt-BR')} | ` +
        `${order.marketplace} | ` +
        `R$ ${Number(order.totalAmount).toFixed(2)} | ` +
        `R$ ${Number(order.netProfit).toFixed(2)}`
      );
    });

    if (orders.length > 50) {
      doc.moveDown();
      doc.text(`... e mais ${orders.length - 50} pedidos`);
    }
  }

  private async addProfitPDF(doc: PDFKit.PDFDocument, filters: ExportFilters) {
    const orders = await this.prisma.order.groupBy({
      by: ['marketplace'],
      where: {
        tenantId: filters.tenantId,
        orderDate: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      },
      _sum: {
        totalAmount: true,
        fees: true,
        shippingCost: true,
        taxes: true,
        netProfit: true,
      },
      _count: true,
    });

    doc.fontSize(16).text('Relatório de Lucro por Marketplace', { underline: true });
    doc.moveDown();

    let totalRevenue = 0;
    let totalProfit = 0;

    orders.forEach((row) => {
      const revenue = Number(row._sum.totalAmount) || 0;
      const profit = Number(row._sum.netProfit) || 0;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;

      totalRevenue += revenue;
      totalProfit += profit;

      doc.fontSize(12).font('Helvetica-Bold').text(row.marketplace);
      doc.font('Helvetica');
      doc.text(`  Pedidos: ${row._count}`);
      doc.text(`  Faturamento: R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      doc.text(`  Taxas: R$ ${(Number(row._sum.fees) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      doc.text(`  Frete: R$ ${(Number(row._sum.shippingCost) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      doc.text(`  Impostos: R$ ${(Number(row._sum.taxes) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      doc.text(`  Lucro Líquido: R$ ${profit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
      doc.text(`  Margem: ${margin.toFixed(2)}%`);
      doc.moveDown();
    });

    doc.moveDown();
    doc.fontSize(14).font('Helvetica-Bold').text('TOTAIS');
    doc.font('Helvetica');
    doc.text(`Faturamento Total: R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    doc.text(`Lucro Total: R$ ${totalProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    doc.text(`Margem Geral: ${totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(2) : 0}%`);
  }

  private async addExpensesPDF(doc: PDFKit.PDFDocument, filters: ExportFilters) {
    const expenses = await this.prisma.expense.findMany({
      where: {
        tenantId: filters.tenantId,
        date: {
          gte: filters.startDate,
          lte: filters.endDate,
        },
      },
      orderBy: { date: 'desc' },
    });

    doc.fontSize(16).text('Relatório de Despesas', { underline: true });
    doc.moveDown();

    const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
    doc.fontSize(12).text(`Total de Despesas: R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    doc.moveDown();

    // Group by type
    const byType = expenses.reduce((acc, e) => {
      acc[e.type] = (acc[e.type] || 0) + Number(e.amount);
      return acc;
    }, {} as Record<string, number>);

    doc.font('Helvetica-Bold').text('Por Categoria:');
    doc.font('Helvetica');
    Object.entries(byType).forEach(([type, amount]) => {
      doc.text(`  ${type}: R$ ${amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    });
  }

  private async addProductsPDF(doc: PDFKit.PDFDocument, filters: ExportFilters) {
    const products = await this.prisma.product.findMany({
      where: { tenantId: filters.tenantId },
      orderBy: { name: 'asc' },
    });

    doc.fontSize(16).text('Relatório de Produtos', { underline: true });
    doc.moveDown();

    const totalStock = products.reduce((sum, p) => sum + p.stock, 0);
    const totalValue = products.reduce((sum, p) => sum + (Number(p.costPrice) * p.stock), 0);

    doc.fontSize(12);
    doc.text(`Total de Produtos: ${products.length}`);
    doc.text(`Estoque Total: ${totalStock} unidades`);
    doc.text(`Valor em Estoque: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
    doc.moveDown();

    doc.font('Helvetica-Bold').text('SKU | Nome | Custo | Venda | Estoque');
    doc.font('Helvetica');
    doc.moveDown(0.5);

    products.slice(0, 50).forEach((product) => {
      doc.text(
        `${product.sku} | ` +
        `${product.name.substring(0, 20)} | ` +
        `R$ ${Number(product.costPrice).toFixed(2)} | ` +
        `R$ ${Number(product.salePrice).toFixed(2)} | ` +
        `${product.stock}`
      );
    });
  }
}
