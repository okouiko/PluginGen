import { IsOptional, IsString, Length } from 'class-validator';

export class UpdatePluginDto {
  @IsOptional()
  @IsString()
  @Length(2, 50)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
