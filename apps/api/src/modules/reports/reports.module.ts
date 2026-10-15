import { Module } from '@nestjs/common';
import { BillingModule } from '../billing/billing.module.js';
import { BondsModule } from '../bonds/bonds.module.js';
import { CostingModule } from '../costing/costing.module.js';
import { DocumentsModule } from '../documents/documents.module.js';
import { PayrollModule } from '../payroll/payroll.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { SuppliersModule } from '../suppliers/suppliers.module.js';
import { PdfRenderer } from './render/pdf-renderer.js';
import { ReportsController } from './reports.controller.js';
import { ReportsService } from './reports.service.js';

@Module({
  imports: [
    SettingsModule,
    CostingModule,
    PayrollModule,
    BillingModule,
    BondsModule,
    DocumentsModule,
    SuppliersModule,
  ],
  controllers: [ReportsController],
  providers: [ReportsService, PdfRenderer],
  exports: [ReportsService],
})
export class ReportsModule {}
