import { IsString, MaxLength, MinLength } from 'class-validator';
import { Transform } from 'class-transformer';
import { MAX_CHAT_BODY_LENGTH } from '@meetino/shared';

/**
 * The chat:send WS handler in NestJS routes its payload through the same
 * global ValidationPipe used by HTTP — provided the payload is decorated.
 *
 * We trim BEFORE length checks so a body of "   " is rejected as empty,
 * not as 3-char valid.
 */
export class SendMessageDto {
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString({ message: 'Message body must be a string' })
  @MinLength(1, { message: 'Message body is required' })
  @MaxLength(MAX_CHAT_BODY_LENGTH, {
    message: `Message body cannot exceed ${MAX_CHAT_BODY_LENGTH} characters`,
  })
  body!: string;
}
