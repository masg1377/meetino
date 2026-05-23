import { IsDateString, IsOptional, IsString, Length } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateMeetingDto {
  @IsString()
  @Length(1, 200, { message: 'Title must be 1 to 200 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  title!: string;

  @IsOptional()
  @IsString()
  @Length(0, 2000, { message: 'Description cannot exceed 2000 characters' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  description?: string;

  /** ISO 8601 timestamp. Omit → meeting is created in LIVE status (instant). */
  @IsOptional()
  @IsDateString({}, { message: 'scheduledFor must be an ISO date string' })
  scheduledFor?: string;
}
