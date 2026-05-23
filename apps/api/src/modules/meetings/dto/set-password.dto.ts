import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';

/**
 * Body for POST /api/meetings/:slug/password. Host-only.
 * 4 ≤ length ≤ 64 after trimming. The service hashes with argon2id.
 */
export class SetPasswordDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(4, { message: 'Password must be at least 4 characters' })
  @MaxLength(64, { message: 'Password must be at most 64 characters' })
  password!: string;
}
