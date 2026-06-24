import { IsString, IsNotEmpty, IsEnum } from 'class-validator';
import { TargetType } from '@prisma/client';

export class LikeDto {
  @IsString()
  @IsNotEmpty()
  targetId!: string;

  @IsEnum(TargetType)
  targetType!: TargetType;
}
