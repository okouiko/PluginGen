import { Injectable } from '@nestjs/common';
import { CoreType } from '@prisma/client';
import { BUKKIT_SYSTEM_PROMPT } from './prompts/bukkit.prompt';
import { SPIGOT_SYSTEM_PROMPT } from './prompts/spigot.prompt';
import { PAPER_SYSTEM_PROMPT } from './prompts/paper.prompt';
import { PURPUR_SYSTEM_PROMPT } from './prompts/purpur.prompt';
import { BUNGEECORD_SYSTEM_PROMPT } from './prompts/bungeecord.prompt';
import { VELOCITY_SYSTEM_PROMPT } from './prompts/velocity.prompt';
import { MODIFY_SYSTEM_PROMPT } from './prompts/modify.prompt';
import { EXPLAIN_SYSTEM_PROMPT } from './prompts/explain.prompt';

@Injectable()
export class PromptService {
  private readonly corePromptMap: Record<CoreType, string> = {
    BUKKIT: BUKKIT_SYSTEM_PROMPT,
    SPIGOT: SPIGOT_SYSTEM_PROMPT,
    PAPER: PAPER_SYSTEM_PROMPT,
    PURPUR: PURPUR_SYSTEM_PROMPT,
    BUNGEECORD: BUNGEECORD_SYSTEM_PROMPT,
    VELOCITY: VELOCITY_SYSTEM_PROMPT,
  };

  buildGeneratePrompt(
    coreType: CoreType,
    javaVersion: string,
    packageName: string,
    description: string,
  ): { systemPrompt: string; userPrompt: string } {
    const template = this.corePromptMap[coreType];
    const packagePath = packageName.replace(/\./g, '/');

    const systemPrompt = template
      .replace(/\{javaVersion\}/g, javaVersion)
      .replace(/\{packageName\}/g, packageName)
      .replace(/\{packagePath\}/g, packagePath);

    const userPrompt = `请生成一个 Minecraft ${coreType} 插件：\n\n${description}`;

    return { systemPrompt, userPrompt };
  }

  buildModifyPrompt(
    filesManifest: Record<string, string>,
    description: string,
  ): string {
    const filesJson = JSON.stringify(filesManifest, null, 2);
    return MODIFY_SYSTEM_PROMPT
      .replace('{filesManifest}', filesJson)
      .replace('{description}', description);
  }

  buildExplainPrompt(filePath: string, code: string): string {
    return `文件：${filePath}\n\n代码：\n\`\`\`java\n${code}\n\`\`\``;
  }

  getExplainSystemPrompt(): string {
    return EXPLAIN_SYSTEM_PROMPT;
  }
}
