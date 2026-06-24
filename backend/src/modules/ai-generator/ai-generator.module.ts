import { Module } from '@nestjs/common';
import { AiGeneratorController } from './ai-generator.controller';
import { AiGeneratorService } from './ai-generator.service';
import { ExplainService } from './explain.service';
import { PromptService } from './prompt.service';
import { ParserService } from './parser.service';
import { PluginModule } from '../plugin/plugin.module';
import { UserLevelService } from '../user/user-level.service';
import { DailyTaskService } from '../daily/daily-task.service';

@Module({
  imports: [PluginModule],
  controllers: [AiGeneratorController],
  providers: [
    AiGeneratorService,
    ExplainService,
    PromptService,
    ParserService,
    UserLevelService,
    DailyTaskService,
  ],
})
export class AiGeneratorModule {}
