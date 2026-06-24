import { Module } from '@nestjs/common';
import { CompileController } from './compile.controller';
import { CompileService } from './compile.service';
import { DockerService } from './docker.service';
import { AutoFixService } from './auto-fix.service';

@Module({
  controllers: [CompileController],
  providers: [
    CompileService,
    DockerService,
    AutoFixService,
  ],
})
export class CompileModule {}
