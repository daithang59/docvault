import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles?.length) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user as { roles?: string[]; username?: string; sub?: string } | undefined;
    const userRoles = user?.roles ?? [];
    const actorId = user?.username ?? user?.sub ?? 'unknown';

    const allowed = requiredRoles.some((role) => userRoles.includes(role));
    console.log(`[RolesGuard] path=${request.path} actor=${actorId} roles=[${userRoles.join(',')}] required=[${requiredRoles.join(',')}] allowed=${allowed}`);

    return allowed;
  }
}
