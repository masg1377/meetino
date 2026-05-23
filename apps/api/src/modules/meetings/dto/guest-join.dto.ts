import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class GuestJoinDto {
  @IsString()
  @Length(2, 120, { message: 'Display name must be 2 to 120 characters' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : value,
  )
  displayName!: string;

  /** Phase 7 — required if PublicMeetingDto.hasPassword is true. */
  @IsOptional()
  @IsString()
  @MaxLength(64)
  password?: string;
}
