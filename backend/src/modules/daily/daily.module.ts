import { Module } from '@nestjs/common';
import { DailyController } from './daily.controller';
import { DailyService } from './daily.service';
import { DailyTaskService } from './daily-task.service';
import { UserLevelService } from '../user/user-level.service';

@Module({
  controllers: [DailyController],
  providers: [DailyService, DailyTaskService, UserLevelService],
  exports: [DailyTaskService],
})
export class DailyModule {}
