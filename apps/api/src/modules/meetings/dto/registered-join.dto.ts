import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * Body for POST /api/meetings/:slug/join.
 * The only field today is an optional password (used when the meeting has
 * `hasPassword: true`). Sending an empty body is allowed.
 */
export class RegisteredJoinDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  password?: string;
}
