import { IsString, IsNotEmpty, IsInt, Min, Max } from 'class-validator';

export class RatingDto {
  @IsString()
  @IsNotEmpty()
  pluginId!: string;

  @IsInt()
  @Min(1)
  @Max(5)
  score!: number;
}
