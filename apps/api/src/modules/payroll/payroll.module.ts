import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module.js';
import { PayrollController } from './payroll.controller.js';
import { PayrollService } from './payroll.service.js';

@Module({
  imports: [SettingsModule],
  controllers: [PayrollController],
  providers: [PayrollService],
  exports: [PayrollService],
})
export class PayrollModule {}
