import { IsString, IsNotEmpty, Length, IsOptional } from 'class-validator';

export class ModifyPluginDto {
  @IsString()
  @IsNotEmpty()
  @Length(5, 1000)
  description!: string;

  @IsOptional()
  @IsString()
  apiKey?: string;
}
