import { Module } from '@nestjs/common';
import { BackupModule } from '../backup/backup.module.js';
import { BillingModule } from '../billing/billing.module.js';
import { CostingModule } from '../costing/costing.module.js';
import { RemindersModule } from '../reminders/reminders.module.js';
import { DashboardController } from './dashboard.controller.js';
import { DashboardService } from './dashboard.service.js';

@Module({
  imports: [CostingModule, BillingModule, RemindersModule, BackupModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
