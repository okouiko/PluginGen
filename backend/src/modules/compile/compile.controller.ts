import { Controller, Post, Get, Param, Headers } from '@nestjs/common';
import { CompileService } from './compile.service';
import { AutoFixService } from './auto-fix.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('compile')
export class CompileController {
  constructor(
    private compileService: CompileService,
    private autoFixService: AutoFixService,
  ) {}

  @Post('start/:pluginId')
  async startCompile(
    @Param('pluginId') pluginId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.compileService.startCompile(pluginId, userId);
  }

  @Get('status/:pluginId')
  async getStatus(@Param('pluginId') pluginId: string) {
    return this.compileService.getStatus(pluginId);
  }

  @Post('fix/:pluginId')
  async fix(
    @Param('pluginId') pluginId: string,
    @CurrentUser('id') userId: string,
    @Headers('x-api-key') apiKey?: string,
  ) {
    return this.autoFixService.fix(pluginId, userId, apiKey);
  }
}
