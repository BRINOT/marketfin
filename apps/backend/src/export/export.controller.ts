import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { ExportService, ExportFilters } from './export.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentTenant } from '../auth/decorators/current-tenant.decorator';
import { ApiTags, ApiOperation, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Export')
@ApiBearerAuth()
@Controller('export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ExportController {
  constructor(private exportService: ExportService) {}

  @Get('excel')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Export data to Excel' })
  @ApiQuery({ name: 'type', enum: ['orders', 'profit', 'expenses', 'products'] })
  @ApiQuery({ name: 'startDate', type: String })
  @ApiQuery({ name: 'endDate', type: String })
  @ApiQuery({ name: 'marketplace', type: String, isArray: true, required: false })
  async exportExcel(
    @CurrentTenant() tenantId: string,
    @Query('type') type: 'orders' | 'profit' | 'expenses' | 'products',
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('marketplace') marketplace?: string | string[],
    @Res() res?: Response,
  ) {
    if (!type || !startDate || !endDate) {
      throw new BadRequestException('Missing required parameters: type, startDate, endDate');
    }

    const filters: ExportFilters = {
      tenantId,
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      marketplace: marketplace ? (Array.isArray(marketplace) ? marketplace : [marketplace]) : undefined,
    };

    const buffer = await this.exportService.exportToExcel(filters);

    const filename = `marketfin-${type}-${startDate}-${endDate}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }

  @Get('pdf')
  @Roles('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Export data to PDF' })
  @ApiQuery({ name: 'type', enum: ['orders', 'profit', 'expenses', 'products'] })
  @ApiQuery({ name: 'startDate', type: String })
  @ApiQuery({ name: 'endDate', type: String })
  @ApiQuery({ name: 'marketplace', type: String, isArray: true, required: false })
  async exportPDF(
    @CurrentTenant() tenantId: string,
    @Query('type') type: 'orders' | 'profit' | 'expenses' | 'products',
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Query('marketplace') marketplace?: string | string[],
    @Res() res?: Response,
  ) {
    if (!type || !startDate || !endDate) {
      throw new BadRequestException('Missing required parameters: type, startDate, endDate');
    }

    const filters: ExportFilters = {
      tenantId,
      type,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      marketplace: marketplace ? (Array.isArray(marketplace) ? marketplace : [marketplace]) : undefined,
    };

    const buffer = await this.exportService.exportToPDF(filters);

    const filename = `marketfin-${type}-${startDate}-${endDate}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  }
}
