import { IsEmail, IsNotEmpty, IsString, Length, Matches } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsString()
  @IsNotEmpty()
  @Length(2, 20)
  nickname!: string;

  @IsString()
  @IsNotEmpty()
  @Length(8)
  @Matches(/(?=.*[a-zA-Z])(?=.*\d)/, {
    message: 'password must contain at least 1 letter and 1 number',
  })
  password!: string;
}
