import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  ParseFilePipeBuilder,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { FileService } from './file.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';

@Controller('file')
export class FileController {
  constructor(private fileService: FileService) {}

  @Post('upload/dependency/:id')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadDependency(
    @Param('id') pluginId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: 'application/java-archive' })
        .addMaxSizeValidator({ maxSize: 50 * 1024 * 1024 })
        .build({
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        }),
    )
    file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.fileService.uploadDependency(pluginId, userId, file);
  }

  @Post('upload/source/:id')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 50 * 1024 * 1024 },
    }),
  )
  async uploadSource(
    @Param('id') pluginId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addFileTypeValidator({ fileType: 'application/zip' })
        .addMaxSizeValidator({ maxSize: 50 * 1024 * 1024 })
        .build({
          errorHttpStatusCode: HttpStatus.BAD_REQUEST,
        }),
    )
    file: Express.Multer.File,
    @CurrentUser('id') userId: string,
  ) {
    return this.fileService.uploadSource(pluginId, userId, file);
  }

  @Public()
  @Get('download/:id/zip')
  async downloadSourceZip(
    @Param('id') pluginId: string,
    @Res() res: Response,
  ) {
    return this.fileService.downloadSourceZip(pluginId, res);
  }

  @Public()
  @Get('download/:id/jar')
  async downloadJar(
    @Param('id') pluginId: string,
    @Res() res: Response,
  ) {
    return this.fileService.downloadJar(pluginId, res);
  }
}
