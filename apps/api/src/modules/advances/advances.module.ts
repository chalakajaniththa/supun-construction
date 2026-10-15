import { Module } from '@nestjs/common';
import { AdvancesController } from './advances.controller.js';
import { AdvancesService } from './advances.service.js';

@Module({
  controllers: [AdvancesController],
  providers: [AdvancesService],
})
export class AdvancesModule {}
