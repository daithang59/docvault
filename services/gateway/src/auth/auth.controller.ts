import { Controller, Get, Query, Res, Req, Post } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Response, Request } from 'express';
import axios from 'axios';
import * as jwt from 'jsonwebtoken';

/** Parse raw Cookie header into a {name -> value} map without external deps. */
function parseCookies(raw: string): Record<string, string> {
  return Object.fromEntries(
    raw.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    }),
  );
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly keycloakBaseUrl: string;
  private readonly realm: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly issuer: string;
  private readonly frontendUrl: string;

  constructor() {
    this.keycloakBaseUrl = process.env.KEYCLOAK_BASE_URL!;
    this.realm = process.env.KEYCLOAK_REALM!;
    this.clientId = process.env.KEYCLOAK_CLIENT_ID ?? 'docvault-gateway';
    this.clientSecret = process.env.KEYCLOAK_CLIENT_SECRET ?? 'dev-gateway-secret';
    this.issuer = `${this.keycloakBaseUrl}/realms/${this.realm}`;
    this.frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3006';
  }

  @Get('login')
  @ApiOperation({ summary: 'Redirect to Keycloak login page' })
  login(@Res() res: Response) {
    const state = Math.random().toString(36).slice(2);
    const redirectUri = `${process.env.GATEWAY_URL ?? 'http://localhost:3000'}/api/auth/callback`;

    // Store state in an httpOnly cookie for CSRF protection
    res.cookie('kc_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 5 * 60 * 1000,
    });

    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state,
    });

    res.redirect(`${this.issuer}/protocol/openid-connect/auth?${params}`);
  }

  @Get('callback')
  @ApiOperation({ summary: 'Exchange Keycloak auth code for tokens' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Handle Keycloak error responses (e.g., user cancelled login)
    if (error) {
      return res.redirect(`${this.frontendUrl}/login?error=${encodeURIComponent(error)}`);
    }

    // Parse cookies to validate state (CSRF)
    const cookies = parseCookies(req.headers.cookie ?? '');
    if (!cookies['kc_state'] || cookies['kc_state'] !== state) {
      return res.redirect(`${this.frontendUrl}/login?error=invalid_state`);
    }
    res.clearCookie('kc_state');

    if (!code) {
      return res.redirect(`${this.frontendUrl}/login?error=no_code`);
    }

    try {
      const redirectUri = `${process.env.GATEWAY_URL ?? 'http://localhost:3000'}/api/auth/callback`;

      // Exchange the authorization code for tokens at Keycloak
      const tokenRes = await axios.post(
        `${this.issuer}/protocol/openid-connect/token`,
        new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: this.clientId,
          client_secret: this.clientSecret,
          code,
          redirect_uri: redirectUri,
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      );

      const { access_token, refresh_token, expires_in } = tokenRes.data;

      // Extract user info from the decoded JWT payload
      const payload = jwt.decode(access_token) as any;
      const user = {
        sub: payload.sub,
        username: payload.preferred_username ?? payload.username,
        email: payload.email,
        roles: payload.realm_access?.roles ?? [],
      };

      // Access token — frontend JS reads it via /api/me after cookie-hydration
      // Store in a readable (non-HttpOnly) cookie so the frontend can read it.
      // The frontend then moves it to localStorage and clears this cookie.
      res.cookie('dv_access_token', access_token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60_000, // Short-lived; must be consumed by frontend quickly
      });

      if (refresh_token) {
        res.cookie('dv_refresh_token', refresh_token, {
          httpOnly: false,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }

      // User object in a readable cookie — frontend JS reads it and hydrates
      // session into localStorage, then this cookie auto-expires in 10 s
      const userCookie = Buffer.from(JSON.stringify(user)).toString('base64');
      res.cookie('dv_user', userCookie, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10_000,
      });

      // Tell the frontend to complete login
      return res.redirect(`${this.frontendUrl}/login?auth=ok`);
    } catch (err: any) {
      console.error('Keycloak token exchange failed:', err?.response?.data ?? err.message);
      return res.redirect(`${this.frontendUrl}/login?error=token_exchange_failed`);
    }
  }

  @Post('logout')
  @ApiOperation({ summary: 'Clear auth cookies and redirect to Keycloak logout' })
  logout(@Res() res: Response) {
    res.clearCookie('dv_access_token', { httpOnly: false, sameSite: 'lax' });
    res.clearCookie('dv_refresh_token', { httpOnly: false, sameSite: 'lax' });
    res.clearCookie('dv_user', { httpOnly: false, sameSite: 'lax' });

    // Redirect to Keycloak logout endpoint
    const postLogoutUri = `${this.frontendUrl}/login`;
    const keycloakLogout = `${this.issuer}/protocol/openid-connect/logouts?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(postLogoutUri)}`;
    res.redirect(keycloakLogout);
  }
}
