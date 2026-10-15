import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuditInterceptor } from './common/audit/audit.interceptor.js';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { SerializeInterceptor } from './common/money/serialize.interceptor.js';
import { I18nModule } from './common/i18n/i18n.module.js';
import { PrismaModule } from './common/prisma/prisma.module.js';
import { StorageModule } from './common/storage/storage.module.js';
import { validateEnv } from './config/env.js';
import { AdvancesModule } from './modules/advances/advances.module.js';
import { AllocationsModule } from './modules/allocations/allocations.module.js';
import { AssetsModule } from './modules/assets/assets.module.js';
import { AuditModule } from './modules/audit/audit.module.js';
import { AuthModule } from './modules/auth/auth.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { BondsModule } from './modules/bonds/bonds.module.js';
import { BoqModule } from './modules/boq/boq.module.js';
import { ClientsModule } from './modules/clients/clients.module.js';
import { DashboardModule } from './modules/dashboard/dashboard.module.js';
import { DailyEntryModule } from './modules/daily-entry/daily-entry.module.js';
import { DocumentsModule } from './modules/documents/documents.module.js';
import { ExpensesModule } from './modules/expenses/expenses.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { PayrollModule } from './modules/payroll/payroll.module.js';
import { MaterialsModule } from './modules/materials/materials.module.js';
import { ProjectsModule } from './modules/projects/projects.module.js';
import { PurchasesModule } from './modules/purchases/purchases.module.js';
import { RemindersModule } from './modules/reminders/reminders.module.js';
import { ReportsModule } from './modules/reports/reports.module.js';
import { SettingsModule } from './modules/settings/settings.module.js';
import { SuppliersModule } from './modules/suppliers/suppliers.module.js';
import { WorkersModule } from './modules/workers/workers.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv, cache: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    StorageModule,
    I18nModule,
    AuthModule,
    SettingsModule,
    AuditModule,
    HealthModule,
    ClientsModule,
    ProjectsModule,
    WorkersModule,
    AssetsModule,
    SuppliersModule,
    MaterialsModule,
    DocumentsModule,
    AllocationsModule,
    DailyEntryModule,
    ExpensesModule,
    PurchasesModule,
    AdvancesModule,
    PayrollModule,
    BoqModule,
    BillingModule,
    BondsModule,
    RemindersModule,
    DashboardModule,
    ReportsModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    // Order matters: interceptors run outside-in on the way back, so the serializer
    // (registered last) converts Decimals before the audit interceptor sees the result.
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    { provide: APP_INTERCEPTOR, useClass: SerializeInterceptor },
  ],
})
export class AppModule {}
