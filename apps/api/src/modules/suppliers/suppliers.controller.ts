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
  type SupplierUpdate,
  supplierCreateSchema,
  supplierListQuerySchema,
  supplierUpdateSchema,
} from '@sc/shared';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { SuppliersService } from './suppliers.service.js';

@Controller('suppliers')
@AuditEntity('Supplier')
export class SuppliersController {
  constructor(private readonly suppliers: SuppliersService) {}

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
}
