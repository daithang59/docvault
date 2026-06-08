import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { createHash, timingSafeEqual } from 'crypto';

@Injectable()
export class ServiceTokenGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    // Accept the current token and, during rotation, the previous one too.
    // This lets the audit-service be redeployed with a new token before every
    // caller has switched over — a zero-downtime rotation window.
    const acceptedTokens = [
      process.env.AUDIT_INGEST_TOKEN,
      process.env.AUDIT_INGEST_TOKEN_PREVIOUS,
    ].filter((value): value is string => Boolean(value && value.trim().length));

    if (acceptedTokens.length === 0) {
      throw new ForbiddenException('Audit ingest token is not configured');
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const providedToken = request.headers['x-docvault-service-token'];

    if (typeof providedToken !== 'string') {
      throw new ForbiddenException('Invalid audit service token');
    }

    const isAccepted = acceptedTokens.some((expected) =>
      this.matches(providedToken, expected),
    );
    if (!isAccepted) {
      throw new ForbiddenException('Invalid audit service token');
    }

    return true;
  }

  private matches(providedToken: string, expectedToken: string): boolean {
    const providedDigest = createHash('sha256')
      .update(providedToken, 'utf8')
      .digest();
    const expectedDigest = createHash('sha256')
      .update(expectedToken, 'utf8')
      .digest();

    return timingSafeEqual(providedDigest, expectedDigest);
  }
}
