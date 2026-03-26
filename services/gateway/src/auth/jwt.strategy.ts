import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptions } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';
import * as jwt from 'jsonwebtoken';

type TokenPayload = {
  sub: string;
  preferred_username?: string;
  email?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  aud?: string | string[];
  azp?: string;
  iss?: string;
};

/** Parse raw Cookie header without external deps. */
function parseCookies(raw: string): Record<string, string> {
  return Object.fromEntries(
    raw.split(';').map((c) => {
      const [k, ...v] = c.trim().split('=');
      return [k, decodeURIComponent(v.join('='))];
    }),
  );
}

/** Get Bearer token from Authorization header, falling back to dv_access_token cookie. */
function extractToken(req: any): string | undefined {
  const fromHeader = ExtractJwt.fromAuthHeaderAsBearerToken()(req);
  if (fromHeader) return fromHeader;

  // Keycloak cookie-auth flow: read from dv_access_token cookie
  const rawCookies = req.headers.cookie ?? '';
  const cookies = parseCookies(rawCookies);
  return cookies['dv_access_token'];
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly audience?: string;

  constructor() {
    const baseUrl = process.env.KEYCLOAK_BASE_URL!;
    const realm = process.env.KEYCLOAK_REALM!;
    const issuer = `${baseUrl}/realms/${realm}`;
    const audience = process.env.KEYCLOAK_AUDIENCE;

    const opts: StrategyOptions = {
      jwtFromRequest: extractToken as any,
      ignoreExpiration: false,
      algorithms: ['RS256'],
      issuer,
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${issuer}/protocol/openid-connect/certs`,
      }),
    };

    super(opts);
    this.audience = audience;
  }

  private normalizePayload(payload: TokenPayload | any) {
    if (this.audience) {
      const audiences = Array.isArray(payload.aud)
        ? payload.aud
        : payload.aud
          ? [payload.aud]
          : [];

      if (!audiences.includes(this.audience) && payload.azp !== this.audience) {
        throw new UnauthorizedException('Invalid token audience');
      }
    }

    const roles = new Set<string>(payload.realm_access?.roles ?? []);
    if (roles.has('co')) {
      roles.add('compliance_officer');
    }

    return {
      sub: payload.sub,
      username: payload.preferred_username ?? payload.username,
      email: payload.email,
      roles: Array.from(roles),
      raw: payload,
    };
  }

  /** Called by passport-jwt after verifying the JWT. */
  validate(payload: TokenPayload | any) {
    return this.normalizePayload(payload);
  }
}
