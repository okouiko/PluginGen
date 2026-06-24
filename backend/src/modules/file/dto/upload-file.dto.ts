import { IsString, IsOptional } from 'class-validator';

export class UploadFileDto {
  @IsString()
  pluginId!: string;

  @IsOptional()
  @IsString()
  type?: 'dependency' | 'source';
}
