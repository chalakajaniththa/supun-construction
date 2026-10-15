import { Module } from '@nestjs/common';
import { SuppliersController } from './suppliers.controller.js';
import { SupplierAccountsService } from './supplier-accounts.service.js';
import { SuppliersService } from './suppliers.service.js';

@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService, SupplierAccountsService],
  exports: [SuppliersService, SupplierAccountsService],
})
export class SuppliersModule {}
