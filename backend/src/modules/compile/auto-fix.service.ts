import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DockerService } from './docker.service';
import { ProgressGateway } from '../../websocket/progress.gateway';

@Injectable()
export class AutoFixService {
  private readonly logger = new Logger(AutoFixService.name);

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
    private dockerService: DockerService,
    private wsGateway: ProgressGateway,
  ) {}

  private createOpenAI(apiKey?: string) {
    return new OpenAI({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: apiKey || this.configService.get('PLUGINGEN_DEEPSEEK_API_KEY') || '',
    });
  }

  async fix(pluginId: string, userId: string, apiKey?: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new BadRequestException('Plugin not found');
    if (plugin.userId !== userId) throw new BadRequestException('Not your plugin');

    const version = await this.prisma.pluginVersion.findFirst({
      where: { pluginId },
      orderBy: { version: 'desc' },
    });
    if (!version) throw new BadRequestException('No versions found');

    const compileLog = version.compileLog;
    if (!compileLog) throw new BadRequestException('No compile log found');

    const filesManifest = version.filesManifest as any;
    const currentFiles = filesManifest?.files || {};

    const openai = this.createOpenAI(apiKey);

    // Read actual source files from disk for full context
    const srcDir = path.join(process.cwd(), '..', 'data', 'plugins', userId, pluginId, 'src');
    const allFiles: Record<string, string> = { ...currentFiles };
    try {
      const entries = await fs.readdir(srcDir, { withFileTypes: true, recursive: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          try {
            const content = await fs.readFile(path.join(entry.parentPath || entry.path, entry.name), 'utf-8');
            allFiles[path.relative(srcDir, path.join(entry.parentPath || entry.path, entry.name))] = content;
          } catch {}
        }
      }
    } catch {}

    const response = await openai.chat.completions.create(
      {
        model: 'deepseek-v4-flash',
        messages: [
          {
            role: 'system',
            content: `你是 Minecraft 插件编译错误修复专家。
分析以下 Maven 编译错误和项目源码，输出修复后的完整文件。
只修改有问题的部分，不修改无关代码。

输出格式要求：
// File: path/to/file.java
\`\`\`java
修复后的完整文件内容
\`\`\`

常见错误修复策略：
- "cannot find symbol" → 检查 import 语句，补充缺失的 import
- "incompatible types" → 检查类型转换
- "does not override" → 检查方法签名
- "cannot resolve constructor" → 检查构造参数
- plugin.yml 路径/类名错误 → 修正为实际类路径`,
          },
          {
            role: 'user',
            content: `编译错误日志：\n${compileLog}\n\n项目源码：\n${JSON.stringify(allFiles, null, 2)}`,
          },
        ],
        temperature: 0.2,
        max_tokens: 8192,
      },
      { timeout: 60000 },
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new BadRequestException('AI fix response is empty');

    // Try multiple format patterns
    const fixedFiles: Record<string, string> = {};

    // Pattern 1: ```...\n// File: path\ncode```
    const pattern1 = /```(?:\w+)?\s*\n\/\/\s*File:\s*(\S+)\s*\n([\s\S]*?)```/g;
    let match: RegExpExecArray | null;
    while ((match = pattern1.exec(content)) !== null) {
      fixedFiles[match[1].trim()] = match[2].trim();
    }

    // Pattern 2: ```...\n/* File: path */\ncode```
    if (Object.keys(fixedFiles).length === 0) {
      const pattern2 = /```(?:\w+)?\s*\n\/\*\s*File:\s*(\S+)\s*\*\/\s*\n([\s\S]*?)```/g;
      while ((match = pattern2.exec(content)) !== null) {
        fixedFiles[match[1].trim()] = match[2].trim();
      }
    }

    // Pattern 3: ```java:path\ncode``` (path in info string)
    if (Object.keys(fixedFiles).length === 0) {
      const pattern3 = /```(\w+):(\S+)\s*\n([\s\S]*?)```/g;
      while ((match = pattern3.exec(content)) !== null) {
        fixedFiles[match[2].trim()] = match[3].trim();
      }
    }

    // Pattern 4: Just split by ``` markers and use first comment line as filename
    if (Object.keys(fixedFiles).length === 0) {
      const blocks = content.split(/```(?:\w+)?/);
      for (let i = 1; i < blocks.length - 1; i += 2) {
        const block = blocks[i].trim();
        const lines = block.split('\n');
        const firstLine = lines[0]?.trim() || '';
        // Try to extract filename from first line
        const fileMatch = firstLine.match(/\/\/\s*File:\s*(\S+)/) || firstLine.match(/\/\*\s*File:\s*(\S+)\s*\*\//);
        if (fileMatch) {
          fixedFiles[fileMatch[1].trim()] = lines.slice(1).join('\n').trim();
        }
      }
    }

    if (Object.keys(fixedFiles).length === 0) {
      // Log the response for debugging
      this.logger.warn(`AI fix response (first 500 chars): ${content.substring(0, 500)}`);
      throw new BadRequestException('AI 生成的修复格式无法解析，请重试');
    }

    const newFiles = { ...currentFiles };
    for (const [filePath, fileContent] of Object.entries(fixedFiles)) {
      newFiles[filePath] = fileContent;
    }

    const newVersion = plugin.currentVersion + 1;
    await this.prisma.pluginVersion.create({
      data: {
        pluginId,
        version: newVersion,
        filesManifest: { files: newFiles } as any,
        compileStatus: 'PENDING',
      },
    });

    await this.prisma.pluginProject.update({
      where: { id: pluginId },
      data: { currentVersion: newVersion },
    });

    for (const [filePath, fileContent] of Object.entries(newFiles)) {
      const fullPath = path.join(srcDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, fileContent as string, 'utf-8');
    }

    // Trigger recompile directly
    this.dockerService.compile(pluginId, userId).then((result) => {
      if (result.success) {
        this.prisma.pluginVersion.updateMany({
          where: { pluginId, compileStatus: 'COMPILING' },
          data: { compileStatus: 'SUCCESS', compileLog: result.log },
        }).catch(() => {});
        this.prisma.pluginProject.update({
          where: { id: pluginId }, data: { status: 'COMPILED' },
        }).catch(() => {});
        this.wsGateway.pushEvent(userId, 'compile', 'completed', { pluginId, status: 'SUCCESS' });
      } else {
        this.prisma.pluginVersion.updateMany({
          where: { pluginId, compileStatus: 'COMPILING' },
          data: { compileStatus: 'FAILED', compileLog: result.log },
        }).catch(() => {});
        this.prisma.pluginProject.update({
          where: { id: pluginId }, data: { status: 'FAILED' },
        }).catch(() => {});
        this.wsGateway.pushEvent(userId, 'compile', 'completed', { pluginId, status: 'FAILED' });
      }
    }).catch(() => {});

    return {
      newVersion,
      fixRound: 1,
      fixes: Object.keys(fixedFiles).map((f) => `Fixed: ${f}`),
      recompileStarted: true,
    };
  }
}
