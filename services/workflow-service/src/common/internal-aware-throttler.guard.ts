import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { isInternalServiceCall } from '@docvault/throttler';

/**
 * Backend throttler guard:
 * 1. Exempts internal gateway→backend calls (x-internal-call header)
 * 2. Tracks by user identity from x-user-id header or JWT, falling back to IP
 */
@Injectable()
export class InternalAwareThrottlerGuard extends ThrottlerGuard {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    if (isInternalServiceCall(req)) {
      return true;
    }
    return super.canActivate(context);
  }

  protected async getTracker(req: Record<string, any>): Promise<string> {
    // Try x-user-id header (set by gateway proxy)
    const userHeader = req.headers?.['x-user-id'];
    if (userHeader) {
      return `user:${userHeader}`;
    }
    // JWT-decoded user
    const userId = req.user?.sub ?? req.user?.username;
    if (userId) {
      return `user:${userId}`;
    }
    return req.ip ?? req.connection?.remoteAddress ?? 'unknown';
  }
}
