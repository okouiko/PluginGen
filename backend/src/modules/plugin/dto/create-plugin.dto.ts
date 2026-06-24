import { IsString, IsNotEmpty, Length, Matches, IsEnum } from 'class-validator';
import { CoreType } from '@prisma/client';

export class CreatePluginDto {
  @IsString()
  @IsNotEmpty()
  @Length(2, 50)
  name!: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^\d+\.\d+(\.\d+)?$/, {
    message: 'mcVersion must be a valid version (e.g. 1.20.1)',
  })
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
}
