import { IsString, IsNotEmpty, Length, IsOptional, IsArray, ArrayMaxSize } from 'class-validator';

export class PublishPluginDto {
  @IsString()
  @IsNotEmpty()
  @Length(10, 2000)
  description!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(5)
  tags?: string[];
}
