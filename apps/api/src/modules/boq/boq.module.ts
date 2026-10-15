import { Module } from '@nestjs/common';
import { BoqController, VariationsController } from './boq.controller.js';
import { BoqService } from './boq.service.js';

@Module({
  controllers: [BoqController, VariationsController],
  providers: [BoqService],
  exports: [BoqService],
})
export class BoqModule {}
