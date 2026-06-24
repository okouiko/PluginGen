import { IsString, IsNotEmpty } from 'class-validator';

export class ExplainCodeDto {
  @IsString()
  @IsNotEmpty()
  filePath!: string;

  @IsString()
  @IsNotEmpty()
  code!: string;
}
