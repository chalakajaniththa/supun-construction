import { Module } from '@nestjs/common';
import { BoqModule } from '../boq/boq.module.js';
import { BillingController } from './billing.controller.js';
import { BillingService } from './billing.service.js';

@Module({
  imports: [BoqModule],
  controllers: [BillingController],
  providers: [BillingService],
  exports: [BillingService],
})
export class BillingModule {}
