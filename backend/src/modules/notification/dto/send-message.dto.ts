import { IsString, IsNotEmpty, Length, IsUUID } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  toUserId!: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, 2000)
  content!: string;
}
