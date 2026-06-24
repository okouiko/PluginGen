import { IsString, IsNotEmpty } from 'class-validator';

export class CompileStartDto {
  @IsString()
  @IsNotEmpty()
  pluginId!: string;
}
