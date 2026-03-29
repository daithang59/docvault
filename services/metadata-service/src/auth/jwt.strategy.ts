import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwksRsa from 'jwks-rsa';

type KeycloakAccessToken = {
  sub: string;
  exp?: number;
  preferred_username?: string;
  email?: string;
  realm_access?: { roles?: string[] };
  resource_access?: Record<string, { roles?: string[] }>;
  aud?: string | string[];
  azp?: string;
  iss?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly audience?: string;

  constructor() {
    const baseUrl = process.env.KEYCLOAK_BASE_URL!;
    const realm = process.env.KEYCLOAK_REALM!;
    const issuer = `${baseUrl}/realms/${realm}`;
    const audience = process.env.KEYCLOAK_AUDIENCE;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer,
      algorithms: ['RS256'],
      // Keycloak in Docker may have clock drift causing tokens to appear expired
      // minutes after issuance. Signature is still verified by JWKS, so we bypass
      // automatic expiry check and validate manually with a generous tolerance below.
      ignoreExpiration: true,
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: `${issuer}/protocol/openid-connect/certs`,
      }),
    });

    this.audience = audience;
  }

  validate(payload: KeycloakAccessToken) {
    // Manually validate expiry with generous clock tolerance (5 min) to handle
    // Keycloak Docker clock drift that causes valid tokens to appear expired.
    if (payload.exp) {
      const now = Math.floor(Date.now() / 1000);
      const CLOCK_DRIFT_TOLERANCE_SECONDS = 300;
      if (payload.exp + CLOCK_DRIFT_TOLERANCE_SECONDS < now) {
        throw new UnauthorizedException('Token expired');
      }
    }

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

    const roles = new Set(payload.realm_access?.roles ?? []);
    if (roles.has('co')) {
      roles.add('compliance_officer');
    }

    return {
      sub: payload.sub,
      username: payload.preferred_username,
      email: payload.email,
      roles: Array.from(roles),
      raw: payload,
    };
  }
}
