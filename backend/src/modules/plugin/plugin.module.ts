import { Module } from '@nestjs/common';
import { PluginController } from './plugin.controller';
import { PluginService } from './plugin.service';
import { PluginVersionService } from './plugin-version.service';
import { CommunityService } from '../community/community.service';
import { UserLevelService } from '../user/user-level.service';
import { DailyTaskService } from '../daily/daily-task.service';

@Module({
  controllers: [PluginController],
  providers: [PluginService, PluginVersionService, CommunityService, UserLevelService, DailyTaskService],
  exports: [PluginService, PluginVersionService],
})
export class PluginModule {}
