import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  type CertificateCreate,
  type CertificateStatusUpdate,
  type CertificateUpdate,
  type ClientPaymentCreate,
  certificateCreateSchema,
  certificatePreviewSchema,
  certificateStatusSchema,
  certificateUpdateSchema,
  clientPaymentCreateSchema,
} from '@sc/shared';
import { AuditEntity, SkipAudit } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { BillingService } from './billing.service.js';

/** Payment certificates (IPC / progress bills), client payments and the finance summary. */
@Controller('projects/:id')
@AuditEntity('PaymentCertificate')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @Get('certificates')
  list(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.list(id);
  }

  @Post('certificates/preview')
  @SkipAudit()
  preview(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(certificatePreviewSchema)) body: CertificateCreate,
  ) {
    return this.billing.preview(id, body);
  }

  @Post('certificates')
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(certificateCreateSchema)) body: CertificateCreate,
  ) {
    return this.billing.create(id, body);
  }

  @Get('certificates/:certId')
  get(@Param('id', ParseUUIDPipe) id: string, @Param('certId', ParseUUIDPipe) certId: string) {
    return this.billing.get(id, certId);
  }

  @Patch('certificates/:certId')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('certId', ParseUUIDPipe) certId: string,
    @Body(new ZodValidationPipe(certificateUpdateSchema)) body: CertificateUpdate,
  ) {
    return this.billing.update(id, certId, body);
  }

  @Delete('certificates/:certId')
  remove(@Param('id', ParseUUIDPipe) id: string, @Param('certId', ParseUUIDPipe) certId: string) {
    return this.billing.remove(id, certId);
  }

  @Post('certificates/:certId/status')
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('certId', ParseUUIDPipe) certId: string,
    @Body(new ZodValidationPipe(certificateStatusSchema)) body: CertificateStatusUpdate,
  ) {
    return this.billing.setStatus(id, certId, body);
  }

  @Get('payments')
  payments(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.payments(id);
  }

  @Post('payments')
  @AuditEntity('ClientPayment')
  addPayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(clientPaymentCreateSchema)) body: ClientPaymentCreate,
  ) {
    return this.billing.addPayment(id, body);
  }

  @Delete('payments/:paymentId')
  @AuditEntity('ClientPayment')
  removePayment(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('paymentId', ParseUUIDPipe) paymentId: string,
  ) {
    return this.billing.removePayment(id, paymentId);
  }

  @Get('finance-summary')
  summary(@Param('id', ParseUUIDPipe) id: string) {
    return this.billing.summary(id);
  }
}
