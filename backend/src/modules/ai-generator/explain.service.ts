import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { PromptService } from './prompt.service';

@Injectable()
export class ExplainService {
  private openai: OpenAI;

  constructor(
    private configService: ConfigService,
    private promptService: PromptService,
  ) {
    this.openai = new OpenAI({
      baseURL: 'https://api.deepseek.com/v1',
      apiKey: this.configService.get('PLUGINGEN_DEEPSEEK_API_KEY') || '',
    });
  }

  async explain(filePath: string, code: string): Promise<string> {
    const userContent = this.promptService.buildExplainPrompt(filePath, code);

    try {
      const response = await this.openai.chat.completions.create(
        {
          model: 'deepseek-v4-flash',
          messages: [
            { role: 'system', content: this.promptService.getExplainSystemPrompt() },
            { role: 'user', content: userContent },
          ],
          temperature: 0.3,
          max_tokens: 2048,
        },
        { timeout: 15000 },
      );

      return response.choices[0]?.message?.content || '无法解释此代码。';
    } catch {
      throw new HttpException('AI explanation failed', HttpStatus.BAD_GATEWAY);
    }
  }
}
