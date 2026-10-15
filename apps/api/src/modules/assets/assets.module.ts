import { Module } from '@nestjs/common';
import { AssetsController } from './assets.controller.js';
import { AssetOpsService } from './asset-ops.service.js';
import { AssetsService } from './assets.service.js';

@Module({
  controllers: [AssetsController],
  providers: [AssetsService, AssetOpsService],
  exports: [AssetsService],
})
export class AssetsModule {}
