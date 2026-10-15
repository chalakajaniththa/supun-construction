import { Module } from '@nestjs/common';
import { BondsController } from './bonds.controller.js';
import { BondsService } from './bonds.service.js';

@Module({ controllers: [BondsController], providers: [BondsService], exports: [BondsService] })
export class BondsModule {}
