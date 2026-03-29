import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { isInternalServiceCall } from '@docvault/throttler';

/**
 * Rate-limit guard that:
 * 1. Exempts internal service-to-service calls (x-internal-call header)
 * 2. Tracks by authenticated user ID, falling back to IP
 */
@Injectable()
export class InternalAwareThrottlerGuard extends ThrottlerGuard {
  /** Skip throttle entirely for internal service calls */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (isInternalServiceCall(req)) {
      return true;
    }
    return super.canActivate(context);
  }

  /** Track by user identity when available, otherwise by IP */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Authenticated user (JWT-decoded by Passport)
    const userId = req.user?.sub ?? req.user?.username;
    if (userId) {
      return `user:${userId}`;
    }
    // Fallback to IP
    return req.ip ?? req.connection?.remoteAddress ?? 'unknown';
  }
}
