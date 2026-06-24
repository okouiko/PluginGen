import { Controller, Post, Get, Param } from '@nestjs/common';
import { DailyService } from './daily.service';
import { DailyTaskService } from './daily-task.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('daily')
export class DailyController {
  constructor(
    private dailyService: DailyService,
    private taskService: DailyTaskService,
  ) {}

  @Post('checkin')
  async checkin(@CurrentUser('id') userId: string) {
    return this.dailyService.checkin(userId);
  }

  @Get('tasks')
  async getTasks(@CurrentUser('id') userId: string) {
    return this.taskService.getTodayTasks(userId);
  }

  @Post('tasks/:taskType/claim')
  async claimReward(
    @Param('taskType') taskType: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.taskService.claimReward(userId, taskType);
  }

  @Get('status')
  async getStatus(@CurrentUser('id') userId: string) {
    return this.dailyService.getStatus(userId);
  }
}
