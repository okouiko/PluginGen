import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DockerService } from './docker.service';
import { ProgressGateway } from '../../websocket/progress.gateway';

interface CompileJobData {
  pluginId: string;
  userId: string;
}

@Processor('compile')
export class CompileProcessor {
  private readonly logger = new Logger(CompileProcessor.name);

  constructor(
    private dockerService: DockerService,
    private prisma: PrismaService,
    private wsGateway: ProgressGateway,
  ) {}

  @Process({ concurrency: 3 })
  async handleCompile(job: Job<CompileJobData>) {
    const { pluginId, userId } = job.data;

    try {
      this.wsGateway.pushEvent(userId, 'compile', 'queued', {
        pluginId,
        position: 0,
      });

      await this.prisma.pluginVersion.updateMany({
        where: { pluginId, compileStatus: { not: 'COMPILING' } },
        data: { compileStatus: 'COMPILING' },
      });

      await this.prisma.pluginProject.update({
        where: { id: pluginId },
        data: { status: 'COMPILING' },
      });

      const result = await this.dockerService.compile(pluginId, userId);

      if (result.success) {
        await this.prisma.pluginVersion.updateMany({
          where: { pluginId, compileStatus: 'COMPILING' },
          data: { compileStatus: 'SUCCESS', compileLog: result.log },
        });

        await this.prisma.pluginProject.update({
          where: { id: pluginId },
          data: { status: 'COMPILED' },
        });

        this.wsGateway.pushEvent(userId, 'compile', 'completed', {
          pluginId,
          status: 'SUCCESS',
        });
      } else {
        await this.prisma.pluginVersion.updateMany({
          where: { pluginId, compileStatus: 'COMPILING' },
          data: { compileStatus: 'FAILED', compileLog: result.log },
        });

        await this.prisma.pluginProject.update({
          where: { id: pluginId },
          data: { status: 'FAILED' },
        });

        this.wsGateway.pushEvent(userId, 'compile', 'completed', {
          pluginId,
          status: 'FAILED',
        });
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Compilation failed';

      await this.prisma.pluginVersion.updateMany({
        where: { pluginId, compileStatus: 'COMPILING' },
        data: { compileStatus: 'FAILED', compileLog: message },
      });

      await this.prisma.pluginProject.update({
        where: { id: pluginId },
        data: { status: 'FAILED' },
      });

      this.wsGateway.pushEvent(userId, 'compile', 'completed', {
        pluginId,
        status: 'FAILED',
        error: message,
      });
    }
  }
}
