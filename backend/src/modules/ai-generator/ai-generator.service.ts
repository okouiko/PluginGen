import {
  Injectable,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PromptService } from './prompt.service';
import { ParserService } from './parser.service';
import { PluginVersionService } from '../plugin/plugin-version.service';
import { ProgressGateway } from '../../websocket/progress.gateway';
import { GeneratePluginDto } from './dto/generate-plugin.dto';
import { ModifyPluginDto } from './dto/modify-plugin.dto';
import { UserLevelService } from '../user/user-level.service';
import { DailyTaskService } from '../daily/daily-task.service';
import type { CoreType } from '@prisma/client';

@Injectable()
export class AiGeneratorService {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private promptService: PromptService,
    private parserService: ParserService,
    private pluginVersionService: PluginVersionService,
    private progressGateway: ProgressGateway,
    private userLevelService: UserLevelService,
    private dailyTaskService: DailyTaskService,
  ) {}

  private createOpenAI(apiKey?: string) {
    return new OpenAI({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: apiKey || this.configService.get('PLUGINGEN_DEEPSEEK_API_KEY') || '',
    });
  }

  async generate(dto: GeneratePluginDto & { apiKey?: string }, userId: string) {
    const { systemPrompt, userPrompt } = this.promptService.buildGeneratePrompt(
      dto.coreType as CoreType,
      dto.javaVersion,
      dto.packageName,
      dto.description,
    );

    this.progressGateway.pushProgress(userId, 'ai', 10, '正在根据需求生成项目结构…');

    const openai = this.createOpenAI(dto.apiKey);
    let aiContent = '';
    try {
      const stream = await openai.chat.completions.create(
        {
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.3,
          max_tokens: 8192,
          stream: true,
        },
        { timeout: 60000 },
      );
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (delta) {
          aiContent += delta;
          this.progressGateway.pushEvent(userId, 'ai', 'stream', { content: delta });
        }
      }
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const errMsg = error instanceof Error ? error.message : 'AI service unavailable';
      if (errMsg.includes('401') || errMsg.includes('Incorrect API key')) {
        throw new HttpException('DeepSeek API Key 无效，请在设置页面检查你的 API Key', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(errMsg, HttpStatus.BAD_GATEWAY);
    }

    if (!aiContent) {
      throw new BadRequestException('AI response is empty');
    }

    this.progressGateway.pushProgress(userId, 'ai', 60, '正在解析生成结果…');

    const filesManifest = this.parserService.parseResponse(aiContent);
    if (Object.keys(filesManifest).length === 0) {
      throw new BadRequestException('AI response parse failed, please try again');
    }

    this.progressGateway.pushProgress(userId, 'ai', 80, '正在保存项目…');

    const plugin = await this.prisma.pluginProject.create({
      data: {
        userId,
        name: dto.name,
        mcVersion: dto.mcVersion,
        coreType: dto.coreType,
        javaVersion: dto.javaVersion,
        packageName: dto.packageName,
      },
    });

    const version = await this.prisma.pluginVersion.create({
      data: {
        pluginId: plugin.id,
        version: 1,
        filesManifest: { files: filesManifest } as any,
      },
    });

    await this.prisma.pluginProject.update({
      where: { id: plugin.id },
      data: { currentVersion: 1 },
    });

    const srcDir = this.pluginVersionService.getSrcDir(userId, plugin.id);
    await this.pluginVersionService.writeManifestToDisk(srcDir, filesManifest);

    this.userLevelService.addExp(userId, 'plugin_generated').catch(() => {});
    this.dailyTaskService.updateProgress(userId, 'generate_plugin').catch(() => {});

    this.progressGateway.pushProgress(userId, 'ai', 100, '生成完成！正在跳转到编辑页…');

    return {
      pluginId: plugin.id,
      version: version.version,
      files: Object.keys(filesManifest),
    };
  }

  async modify(pluginId: string, dto: ModifyPluginDto, userId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new BadRequestException('Plugin not found');
    if (plugin.userId !== userId) throw new BadRequestException('Not your plugin');

    this.progressGateway.pushProgress(userId, 'ai', 10, '正在读取当前代码…');

    const currentVersion = await this.prisma.pluginVersion.findFirst({
      where: { pluginId },
      orderBy: { version: 'desc' },
    });
    if (!currentVersion) throw new BadRequestException('No versions found');

    const currentFiles = (currentVersion.filesManifest as any)?.files as Record<string, string> || {};

    const modifyPrompt = this.promptService.buildModifyPrompt(currentFiles, dto.description);

    this.progressGateway.pushProgress(userId, 'ai', 30, '正在调用 AI 进行修改…');

    const modifyOpenai = this.createOpenAI((dto as any).apiKey);
    let aiContent = '';
    try {
      const stream = await modifyOpenai.chat.completions.create(
        {
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: '你是一个 Minecraft 插件开发专家。根据用户要求和当前代码，输出修改后的完整文件内容。' },
            { role: 'user', content: modifyPrompt },
          ],
          temperature: 0.3,
          max_tokens: 8192,
          stream: true,
        },
        { timeout: 60000 },
      );
      for await (const chunk of stream) {
        const delta = chunk.choices?.[0]?.delta?.content || '';
        if (delta) {
          aiContent += delta;
          this.progressGateway.pushEvent(userId, 'ai', 'stream', { content: delta });
        }
      }
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      const errMsg = error instanceof Error ? error.message : 'AI modification failed';
      if (errMsg.includes('401') || errMsg.includes('Incorrect API key')) {
        throw new HttpException('DeepSeek API Key 无效，请在设置页面检查你的 API Key', HttpStatus.BAD_REQUEST);
      }
      throw new HttpException(errMsg, HttpStatus.BAD_GATEWAY);
    }

    if (!aiContent) {
      throw new BadRequestException('AI response is empty');
    }

    this.progressGateway.pushProgress(userId, 'ai', 60, '正在解析修改结果…');

    const newFiles = this.parserService.parseResponse(aiContent);
    if (Object.keys(newFiles).length === 0) {
      throw new BadRequestException('AI response parse failed');
    }

    this.progressGateway.pushProgress(userId, 'ai', 80, '正在保存修改…');

    const newVersion = plugin.currentVersion + 1;

    await this.prisma.pluginVersion.create({
      data: {
        pluginId,
        version: newVersion,
        filesManifest: { files: newFiles } as any,
      },
    });

    await this.prisma.pluginProject.update({
      where: { id: pluginId },
      data: { currentVersion: newVersion, status: 'MODIFIED' },
    });

    const srcDir = this.pluginVersionService.getSrcDir(userId, pluginId);
    await this.pluginVersionService.writeManifestToDisk(srcDir, newFiles);

    const changes = this.parserService.detectChanges(currentFiles, newFiles);

    this.progressGateway.pushProgress(userId, 'ai', 100, '修改完成！');

    return {
      pluginId,
      newVersion,
      changes,
    };
  }
}
