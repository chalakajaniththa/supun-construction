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
  type PurchaseCreate,
  type PurchaseListQuery,
  type PurchaseUpdate,
  type StoreIssueCreate,
  type StoreIssueListQuery,
  purchaseCreateSchema,
  purchaseListQuerySchema,
  purchaseUpdateSchema,
  storeIssueCreateSchema,
  storeIssueListQuerySchema,
} from '@sc/shared';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { PurchasesService } from './purchases.service.js';

@Controller('purchases')
@AuditEntity('Purchase')
export class PurchasesController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get()
  list(@Query(new ZodValidationPipe(purchaseListQuerySchema)) q: PurchaseListQuery) {
    return this.purchases.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchases.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(purchaseCreateSchema)) body: PurchaseCreate) {
    return this.purchases.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(purchaseUpdateSchema)) body: PurchaseUpdate,
  ) {
    return this.purchases.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchases.remove(id);
  }
}

@Controller('store')
@AuditEntity('MaterialIssue')
export class StoreController {
  constructor(private readonly purchases: PurchasesService) {}

  @Get('stock')
  stock() {
    return this.purchases.stock();
  }

  @Get('issues')
  listIssues(@Query(new ZodValidationPipe(storeIssueListQuerySchema)) q: StoreIssueListQuery) {
    return this.purchases.listIssues(q);
  }

  @Post('issues')
  issue(@Body(new ZodValidationPipe(storeIssueCreateSchema)) body: StoreIssueCreate) {
    return this.purchases.issue(body);
  }

  @Delete('issues/:id')
  removeIssue(@Param('id', ParseUUIDPipe) id: string) {
    return this.purchases.removeIssue(id);
  }
}
