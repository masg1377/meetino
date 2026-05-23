import { IsOptional, IsString, MaxLength } from 'class-validator';

/**
 * POST /api/meetings/:slug/rejoin-request body.
 *
 * The participant identity is taken from the bearer token / guest cookie —
 * never from the request body. This DTO only carries an optional message
 * for the host (free-text, Persian-friendly, capped to avoid spam).
 */
export class CreateRejoinRequestDto {
  @IsOptional()
  @IsString({ message: 'Message must be a string' })
  @MaxLength(280, { message: 'Message cannot exceed 280 characters' })
  message?: string;
}
