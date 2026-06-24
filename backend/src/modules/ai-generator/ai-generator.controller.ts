import { Controller, Post, Param, Body, Headers } from '@nestjs/common';
import { AiGeneratorService } from './ai-generator.service';
import { ExplainService } from './explain.service';
import { GeneratePluginDto } from './dto/generate-plugin.dto';
import { ModifyPluginDto } from './dto/modify-plugin.dto';
import { ExplainCodeDto } from './dto/explain-code.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('ai')
export class AiGeneratorController {
  constructor(
    private aiGeneratorService: AiGeneratorService,
    private explainService: ExplainService,
  ) {}

  @Post('generate')
  async generate(
    @Body() dto: GeneratePluginDto,
    @CurrentUser('id') userId: string,
    @Headers('x-api-key') apiKey?: string,
  ) {
    return this.aiGeneratorService.generate({ ...dto, apiKey }, userId);
  }

  @Post('modify/:pluginId')
  async modify(
    @Param('pluginId') pluginId: string,
    @Body() dto: ModifyPluginDto,
    @CurrentUser('id') userId: string,
    @Headers('x-api-key') apiKey?: string,
  ) {
    return this.aiGeneratorService.modify(pluginId, { ...dto, apiKey }, userId);
  }

  @Post('explain/:pluginId')
  async explain(
    @Param('pluginId') _pluginId: string,
    @Body() dto: ExplainCodeDto,
    @CurrentUser('id') _userId: string,
  ) {
    const explanation = await this.explainService.explain(dto.filePath, dto.code);
    return {
      filePath: dto.filePath,
      explanation,
      language: 'zh-CN',
    };
  }
}
