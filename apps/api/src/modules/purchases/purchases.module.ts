import { Module } from '@nestjs/common';
import { PurchasesController, StoreController } from './purchases.controller.js';
import { PurchasesService } from './purchases.service.js';

@Module({
  controllers: [PurchasesController, StoreController],
  providers: [PurchasesService],
})
export class PurchasesModule {}
