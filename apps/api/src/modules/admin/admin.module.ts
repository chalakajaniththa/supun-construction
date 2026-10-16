import { Module } from '@nestjs/common';
import { RemindersModule } from '../reminders/reminders.module.js';
import { AdminController } from './admin.controller.js';
import { AdminService } from './admin.service.js';

@Module({
  imports: [RemindersModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
