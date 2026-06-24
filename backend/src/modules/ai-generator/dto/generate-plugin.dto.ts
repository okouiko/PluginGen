import { IsString, IsNotEmpty, Length, Matches, IsEnum, IsOptional } from 'class-validator';
import { CoreType } from '@prisma/client';

export class GeneratePluginDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+\.\d+(\.\d+)?$/)
  mcVersion!: string;

  @IsEnum(CoreType)
  coreType!: CoreType;

  @IsString()
  @IsNotEmpty()
  javaVersion!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^[a-zA-Z_][a-zA-Z0-9_]*(\.[a-zA-Z_][a-zA-Z0-9_]*)*$/, {
    message: 'packageName must be a valid Java package name (e.g. com.example.myplugin)',
  })
  packageName!: string;

  @IsString()
  @IsNotEmpty()
  @Length(5, 2000)
  description!: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}
