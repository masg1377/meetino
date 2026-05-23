import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import type { AppConfig } from '../../config/configuration';
import { PrismaService } from '../../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { JwtPayload } from './types/jwt-payload';
import type { AuthResponse, PublicUser } from '@meetino/shared';

interface IssuedTokens {
  authResponse: AuthResponse;
  refreshTokenRaw: string;
  refreshTokenExpiresAt: Date;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // ─── Public flows ────────────────────────────────────────────────

  async register(dto: RegisterDto, meta: { ip?: string; userAgent?: string }): Promise<IssuedTokens> {
    const existing = await this.users.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        displayName: dto.displayName,
        // role defaults to STUDENT (see Prisma schema)
      },
    });

    this.logger.log(`User registered: ${user.email} (${user.id})`);
    return this.issueTokens(user, meta);
  }

  async login(dto: LoginDto, meta: { ip?: string; userAgent?: string }): Promise<IssuedTokens> {
    const user = await this.users.findByEmail(dto.email);
    // Always run a hash compare (even on missing user) to avoid timing oracles.
    const dummyHash = '$argon2id$v=19$m=65536,t=3,p=4$YWFhYWFhYWFhYWFhYWFhYQ$' +
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
    const passwordOk = user
      ? await argon2.verify(user.passwordHash, dto.password).catch(() => false)
      : await argon2.verify(dummyHash, dto.password).catch(() => false);

    if (!user || !passwordOk) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    await this.users.touchLastLogin(user.id);
    return this.issueTokens(user, meta);
  }

  async refresh(rawRefreshToken: string, meta: { ip?: string; userAgent?: string }): Promise<IssuedTokens> {
    if (!rawRefreshToken) throw new UnauthorizedException('Missing refresh token');

    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException('Refresh token invalid or expired');
    }
    if (!stored.user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    // Rotate: revoke the old token, issue a new pair.
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user, meta);
  }

  /**
   * Revoke a single refresh token (called on logout).
   * Silent on already-invalid tokens — logout should always succeed.
   */
  async logout(rawRefreshToken: string | undefined): Promise<void> {
    if (!rawRefreshToken) return;
    const tokenHash = this.hashRefreshToken(rawRefreshToken);
    await this.prisma.refreshToken
      .updateMany({
        where: { tokenHash, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      .catch((err) => {
        this.logger.warn(`logout: failed to revoke token: ${(err as Error).message}`);
      });
  }

  // ─── Helpers ─────────────────────────────────────────────────────

  /**
   * Issue an access JWT + a fresh refresh token. The raw refresh token is
   * returned to the caller so the controller can set it as an HttpOnly cookie.
   * Only the HASH is persisted.
   */
  private async issueTokens(
    user: { id: string; email: string; role: 'ADMIN' | 'HOST' | 'STUDENT' },
    meta: { ip?: string; userAgent?: string },
  ): Promise<IssuedTokens> {
    const jwtCfg = this.config.get('jwt', { infer: true });
    const accessPayload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
    };

    const accessToken = await this.jwt.signAsync(accessPayload, {
      secret: jwtCfg.accessSecret,
      expiresIn: jwtCfg.accessExpiresIn,
    });
    const accessTokenExpiresIn = this.toSeconds(jwtCfg.accessExpiresIn);

    const refreshTokenRaw = this.generateRefreshToken();
    const refreshTokenHash = this.hashRefreshToken(refreshTokenRaw);
    const refreshTtlSec = this.toSeconds(jwtCfg.refreshExpiresIn);
    const refreshTokenExpiresAt = new Date(Date.now() + refreshTtlSec * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId: user.id,
        tokenHash: refreshTokenHash,
        expiresAt: refreshTokenExpiresAt,
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    // Re-fetch full user record to build a complete PublicUser for the response.
    const full = await this.users.findById(user.id);
    if (!full) throw new UnauthorizedException('User vanished'); // shouldn't happen
    const publicUser: PublicUser = UsersService.toPublic(full);

    return {
      authResponse: { user: publicUser, accessToken, accessTokenExpiresIn },
      refreshTokenRaw,
      refreshTokenExpiresAt,
    };
  }

  private generateRefreshToken(): string {
    // 48 random bytes → 384 bits of entropy. Base64url-encoded.
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  /** Convert "15m" / "7d" / "3600" into seconds. Minimal parser, enough for our config. */
  private toSeconds(value: string | number): number {
    if (typeof value === 'number') return value;
    const m = /^(\d+)([smhd])?$/.exec(value);
    if (!m) return 0;
    const n = parseInt(m[1]!, 10);
    switch (m[2]) {
      case 's': return n;
      case 'm': return n * 60;
      case 'h': return n * 60 * 60;
      case 'd': return n * 60 * 60 * 24;
      default:  return n;
    }
  }
}
