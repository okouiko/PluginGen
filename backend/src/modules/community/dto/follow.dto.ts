import { IsString, IsNotEmpty } from 'class-validator';

export class FollowDto {
  @IsString()
  @IsNotEmpty()
  followingId!: string;
}
