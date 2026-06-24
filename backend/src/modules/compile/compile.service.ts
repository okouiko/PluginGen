import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import * as path from 'path';
import * as fs from 'fs/promises';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DockerService } from './docker.service';
import { ProgressGateway } from '../../websocket/progress.gateway';

@Injectable()
export class CompileService {
  // In-memory compile log for real-time polling
  private liveLogs = new Map<string, string>();

  constructor(
    private prisma: PrismaService,
    private dockerService: DockerService,
    private wsGateway: ProgressGateway,
  ) {}

  async startCompile(pluginId: string, userId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new HttpException('Plugin not found', HttpStatus.NOT_FOUND);
    if (plugin.userId !== userId) throw new HttpException('Not your plugin', HttpStatus.FORBIDDEN);
    if (plugin.status === 'COMPILING') {
      throw new HttpException('Plugin is already being compiled', HttpStatus.CONFLICT);
    }

    // Save compile log to a file for polling
    const logDir = path.join(process.cwd(), '..', 'data', 'plugins', userId, pluginId);
    const logFile = path.join(logDir, 'compile.log');
    await fs.mkdir(logDir, { recursive: true });
    await fs.writeFile(logFile, '', 'utf-8');

    this.liveLogs.set(pluginId, '');

    await this.prisma.pluginVersion.updateMany({
      where: { pluginId, compileStatus: { not: 'COMPILING' } },
      data: { compileStatus: 'COMPILING' },
    });
    await this.prisma.pluginProject.update({
      where: { id: pluginId },
      data: { status: 'COMPILING' },
    });

    // Run compilation in background, passing the log file for incremental writes
    this.runCompile(pluginId, userId, logFile).catch(() => {});

    return {
      pluginId,
      version: plugin.currentVersion,
      queued: true,
      message: 'Compilation started',
    };
  }

  private async runCompile(pluginId: string, userId: string, logFile: string) {
    const onLog = (text: string) => {
      this.liveLogs.set(pluginId, (this.liveLogs.get(pluginId) || '') + text);
      fs.appendFile(logFile, text, 'utf-8').catch(() => {});
    };

    const result = await this.dockerService.compile(pluginId, userId, onLog);

    if (result.success) {
      await this.prisma.pluginVersion.updateMany({
        where: { pluginId, compileStatus: 'COMPILING' },
        data: { compileStatus: 'SUCCESS', compileLog: result.log },
      });
      await this.prisma.pluginProject.update({
        where: { id: pluginId },
        data: { status: 'COMPILED' },
      });
      this.wsGateway.pushEvent(userId, 'compile', 'completed', { pluginId, status: 'SUCCESS' });
    } else {
      await this.prisma.pluginVersion.updateMany({
        where: { pluginId, compileStatus: 'COMPILING' },
        data: { compileStatus: 'FAILED', compileLog: result.log },
      });
      await this.prisma.pluginProject.update({
        where: { id: pluginId },
        data: { status: 'FAILED' },
      });
      this.wsGateway.pushEvent(userId, 'compile', 'completed', { pluginId, status: 'FAILED' });
    }

    // Keep live log for a while after completion
    setTimeout(() => this.liveLogs.delete(pluginId), 60000);
  }

  async getStatus(pluginId: string) {
    const plugin = await this.prisma.pluginProject.findUnique({
      where: { id: pluginId },
    });
    if (!plugin) throw new HttpException('Plugin not found', HttpStatus.NOT_FOUND);

    const version = await this.prisma.pluginVersion.findFirst({
      where: { pluginId },
      orderBy: { version: 'desc' },
    });

    // Merge live log with persisted log
    const liveLog = this.liveLogs.get(pluginId) || '';
    const persistedLog = version?.compileLog || '';
    const fullLog = liveLog || persistedLog;

    return {
      pluginId,
      status: version?.compileStatus || 'PENDING',
      compileLog: fullLog,
      version: plugin.currentVersion,
    };
  }
}
