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
    const expectedToken = process.env.AUDIT_INGEST_TOKEN;
    if (!expectedToken || expectedToken.trim().length === 0) {
      throw new ForbiddenException('Audit ingest token is not configured');
    }

    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
    }>();
    const providedToken = request.headers['x-docvault-service-token'];

    if (typeof providedToken !== 'string') {
      throw new ForbiddenException('Invalid audit service token');
    }

    if (!this.matches(providedToken, expectedToken)) {
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
