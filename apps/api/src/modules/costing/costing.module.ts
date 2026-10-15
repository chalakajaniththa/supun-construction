import { Module } from '@nestjs/common';
import { BoqModule } from '../boq/boq.module.js';
import { PayrollModule } from '../payroll/payroll.module.js';
import { SettingsModule } from '../settings/settings.module.js';
import { CostingService } from './costing.service.js';

@Module({
  imports: [SettingsModule, PayrollModule, BoqModule],
  providers: [CostingService],
  exports: [CostingService],
})
export class CostingModule {}
