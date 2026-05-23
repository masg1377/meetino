import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

/**
 * Generates meeting slugs of the form `xyz-abcd-efg` from a 32-char
 * non-ambiguous alphabet. With 10 alphabet chars per slug and 32 symbols,
 * we get ~10^15 possibilities — effectively unguessable at academy scale.
 */
@Injectable()
export class CodeGeneratorService {
  // 32 chars: no 0/o/O, no 1/l/I (digits and letters that look alike).
  private static readonly ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';
  private static readonly CHUNKS = [3, 4, 3] as const;

  /** Returns a fresh slug, e.g. "fa1-x9km-7mq" (well, with the safe alphabet). */
  generate(): string {
    return CodeGeneratorService.CHUNKS.map((n) => this.randomChunk(n)).join('-');
  }

  /** Quick syntactic check used by request validation. */
  isValidShape(value: string): boolean {
    return /^[a-z2-9]{3}-[a-z2-9]{4}-[a-z2-9]{3}$/.test(value);
  }

  private randomChunk(len: number): string {
    // Over-sample bytes to reduce modulo bias on the rejection sample.
    const bytes = randomBytes(len * 2);
    let out = '';
    let i = 0;
    while (out.length < len && i < bytes.length) {
      const b = bytes[i++]!;
      // Reject samples that would introduce modulo bias.
      if (b >= 256 - (256 % CodeGeneratorService.ALPHABET.length)) continue;
      out += CodeGeneratorService.ALPHABET[b % CodeGeneratorService.ALPHABET.length];
    }
    // Extremely unlikely fallback if rejection sampling ate everything.
    while (out.length < len) {
      out += CodeGeneratorService.ALPHABET[randomBytes(1)[0]! % CodeGeneratorService.ALPHABET.length];
    }
    return out;
  }
}
