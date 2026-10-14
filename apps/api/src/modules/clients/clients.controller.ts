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
  type ClientCreate,
  type ClientListQuery,
  type ClientUpdate,
  clientCreateSchema,
  clientListQuerySchema,
  clientUpdateSchema,
} from '@sc/shared';
import { AuditEntity } from '../../common/audit/audit.decorator.js';
import { ZodValidationPipe } from '../../common/zod/zod-validation.pipe.js';
import { ClientsService } from './clients.service.js';

@Controller('clients')
@AuditEntity('Client')
export class ClientsController {
  constructor(private readonly clients: ClientsService) {}

  @Get()
  list(@Query(new ZodValidationPipe(clientListQuerySchema)) q: ClientListQuery) {
    return this.clients.list(q);
  }

  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.get(id);
  }

  @Post()
  create(@Body(new ZodValidationPipe(clientCreateSchema)) body: ClientCreate) {
    return this.clients.create(body);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(clientUpdateSchema)) body: ClientUpdate,
  ) {
    return this.clients.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clients.remove(id);
  }
}
