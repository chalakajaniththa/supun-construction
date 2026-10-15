import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  type SupplierCreate,
  type SupplierListQuery,
  type StatementQuery,
  type SupplierPaymentCreate,
  type SupplierUpdate,
  statementQuerySchema,
  supplierCreateSchema,
  supplierPaymentCreateSchema,
  supplierListQuerySchema,
  supplierUpdateSchema,
} from '@sc/shared';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { SupplierAccountsService } from './supplier-accounts.service.js';
import { SuppliersService } from './suppliers.service.js';

@Controller('suppliers')
@AuditEntity('Supplier')
export class SuppliersController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly accounts: SupplierAccountsService,
  ) {}

  @Get('balances')
  balances() {
    return this.accounts.balances();
  }

  @Get()
  list(@Query(new ZodValidationPipe(supplierListQuerySchema)) q: SupplierListQuery) {
    return this.suppliers.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliers.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(supplierCreateSchema)) body: SupplierCreate) {
    return this.suppliers.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(supplierUpdateSchema)) body: SupplierUpdate,
  ) {
    return this.suppliers.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.suppliers.remove(id);
  }

  @Get(':id/statement')
  statement(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(new ZodValidationPipe(statementQuerySchema)) q: StatementQuery,
  ) {
    return this.accounts.statement(id, q);
  }

  @Post(':id/payments')
  @AuditEntity('SupplierPayment')
  addPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(supplierPaymentCreateSchema)) body: SupplierPaymentCreate,
  ) {
    return this.accounts.addPayment(id, body);
  }

  @Delete(':id/payments/:paymentId')
  @AuditEntity('SupplierPayment')
  removePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.accounts.removePayment(id, paymentId);
  }
}
