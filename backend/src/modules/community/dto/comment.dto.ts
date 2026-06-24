import { IsString, IsNotEmpty, Length } from 'class-validator';

export class CreateCommentDto {
  @IsString()
  @IsNotEmpty()
  pluginId!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 500)
  content!: string;
}
