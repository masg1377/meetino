import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { AuthResponse, MeResponse } from '@meetino/shared';
import type { AppConfig } from '../../config/configuration';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const REFRESH_COOKIE = 'meetino_refresh';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly users: UsersService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  // ─── Public endpoints ────────────────────────────────────────────

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { authResponse, refreshTokenRaw, refreshTokenExpiresAt } = await this.auth.register(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.setRefreshCookie(res, refreshTokenRaw, refreshTokenExpiresAt);
    return authResponse;
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const { authResponse, refreshTokenRaw, refreshTokenExpiresAt } = await this.auth.login(dto, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.setRefreshCookie(res, refreshTokenRaw, refreshTokenExpiresAt);
    return authResponse;
  }

  /**
   * Reads the refresh cookie, rotates it, returns a new access token + sets a new cookie.
   * Marked @Public because the access token is intentionally absent here.
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const raw = req.cookies?.[REFRESH_COOKIE];
    if (!raw) throw new UnauthorizedException('Missing refresh token');

    const { authResponse, refreshTokenRaw, refreshTokenExpiresAt } = await this.auth.refresh(raw, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.setRefreshCookie(res, refreshTokenRaw, refreshTokenExpiresAt);
    return authResponse;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const raw = req.cookies?.[REFRESH_COOKIE];
    await this.auth.logout(raw);
    this.clearRefreshCookie(res);
  }

  // ─── Protected ──────────────────────────────────────────────────

  @Get('me')
  async me(@CurrentUser() current: AuthUser): Promise<MeResponse> {
    const user = await this.users.findById(current.id);
    if (!user) throw new UnauthorizedException('User no longer exists');
    return UsersService.toPublic(user);
  }

  // ─── Cookie helpers ──────────────────────────────────────────────

  private setRefreshCookie(res: Response, token: string, expiresAt: Date): void {
    const isProd = this.config.get('nodeEnv', { infer: true }) === 'production';
    res.cookie(REFRESH_COOKIE, token, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
      expires: expiresAt,
    });
  }

  private clearRefreshCookie(res: Response): void {
    const isProd = this.config.get('nodeEnv', { infer: true }) === 'production';
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: isProd,
      sameSite: 'lax',
      path: '/',
    });
  }
}
