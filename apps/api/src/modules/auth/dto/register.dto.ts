import { IsEmail, IsString, Length, Matches } from 'class-validator';
import { Transform } from 'class-transformer';

export class RegisterDto {
  @IsEmail({}, { message: 'Email is invalid' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  email!: string;

  @IsString()
  @Length(2, 120, { message: 'Display name must be 2 to 120 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  displayName!: string;

  /**
   * 8–72 chars (72 is bcrypt-historical safe upper bound, also fine for argon2).
   * Require at least one letter and one digit so common passwords like "12345678" fail.
   */
  @IsString()
  @Length(8, 72, { message: 'Password must be 8 to 72 characters' })
  @Matches(/[A-Za-z]/, { message: 'Password must contain at least one letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one digit' })
  password!: string;
}
