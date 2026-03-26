import { Controller, Get, Query, Res, Req, Post, HttpCode } from '@nestjs/common';
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

  /**
   * Initiate Keycloak OIDC Authorization Code flow.
   *
   * **Development flow (DocVault frontend):**
   * 1. Frontend calls `GET /api/auth/login` (Next.js route on :3006)
   * 2. Next.js redirects here → gateway `/auth/login`
   * 3. This endpoint sets `kc_state` cookie + redirects to Keycloak login
   * 4. User authenticates at Keycloak (:8080)
   * 5. Keycloak redirects to `GATEWAY_URL/api/auth/callback`
   *
   * **Note:** For frontend-based SSO, use `GET /api/auth/login` on the Next.js
   * app directly — it handles the flow without involving the gateway's /auth routes.
   */
  @Get('login')
  @ApiOperation({
    summary: 'Initiate Keycloak OIDC login (redirect to Keycloak)',
    description:
      'Sets a CSRF state cookie and redirects the browser to Keycloak\'s login page. ' +
      'After login, Keycloak redirects to `/api/auth/callback` (gateway) with an authorization code.',
  })
  login(@Res() res: Response) {
    const state = Math.random().toString(36).slice(2);
    const redirectUri = `${process.env.GATEWAY_URL ?? 'http://localhost:3000'}/api/auth/callback`;

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

  /**
   * Handle Keycloak redirect after user authentication.
   *
   * - Validates `state` cookie (CSRF protection)
   * - Exchanges `code` for access_token + refresh_token via Keycloak `/token`
   * - Sets `dv_access_token` and `dv_refresh_token` HttpOnly cookies on the gateway origin
   * - Redirects to `FRONTEND_URL/login?auth=ok`
   *
   * The frontend at :3006 reads the cookies via its own `/api/auth/me` route and
   * hydrates the session into localStorage.
   */
  @Get('callback')
  @ApiOperation({
    summary: 'Keycloak OIDC callback — exchange auth code for tokens',
    description:
      'Receives the authorization code from Keycloak. Validates state, exchanges the code ' +
      'for JWT tokens, and sets session cookies on the gateway origin.',
  })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (error) {
      return res.redirect(`${this.frontendUrl}/login?error=${encodeURIComponent(error)}`);
    }

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

      const { access_token, refresh_token } = tokenRes.data;

      // Decode JWT payload to extract user info (no signature check needed — gateway trusts Keycloak)
      const payload = jwt.decode(access_token) as any;
      const user = {
        sub: payload.sub,
        username: payload.preferred_username ?? payload.username,
        email: payload.email,
        roles: payload.realm_access?.roles ?? [],
      };

      // Set session cookies on the gateway origin
      res.cookie('dv_access_token', access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 1000,
      });

      if (refresh_token) {
        res.cookie('dv_refresh_token', refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 7 * 24 * 60 * 60 * 1000,
        });
      }

      // Short-lived user info cookie — frontend reads this to hydrate localStorage
      const userCookie = Buffer.from(JSON.stringify(user)).toString('base64');
      res.cookie('dv_user', userCookie, {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 10_000,
      });

      return res.redirect(`${this.frontendUrl}/login?auth=ok`);
    } catch (err: any) {
      console.error('Keycloak token exchange failed:', err?.response?.data ?? err.message);
      return res.redirect(`${this.frontendUrl}/login?error=token_exchange_failed`);
    }
  }

  /**
   * Logout — clears all session cookies and redirects to Keycloak logout endpoint.
   */
  @Post('logout')
  @HttpCode(302)
  @ApiOperation({
    summary: 'Logout — clear session cookies and redirect to Keycloak',
    description: 'Removes `dv_access_token`, `dv_refresh_token`, and `dv_user` cookies, then redirects to Keycloak to invalidate the SSO session.',
  })
  logout(@Res() res: Response) {
    res.clearCookie('dv_access_token', { httpOnly: true, sameSite: 'lax' });
    res.clearCookie('dv_refresh_token', { httpOnly: true, sameSite: 'lax' });
    res.clearCookie('dv_user', { httpOnly: false, sameSite: 'lax' });

    const postLogoutUri = `${this.frontendUrl}/login`;
    const keycloakLogout =
      `${this.issuer}/protocol/openid-connect/logouts` +
      `?client_id=${this.clientId}&redirect_uri=${encodeURIComponent(postLogoutUri)}`;
    res.redirect(keycloakLogout);
  }
}
