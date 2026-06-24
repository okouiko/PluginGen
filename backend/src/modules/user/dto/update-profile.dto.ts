import { IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @Length(2, 20)
  nickname?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  bio?: string;
}
