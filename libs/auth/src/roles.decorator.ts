import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/**
 * Require one or more roles to access a route.
 * If no roles are specified, the guard permits all authenticated users.
 *
 * @example
 * @Roles('editor')                    // requires editor
 * @Roles('editor', 'admin')           // requires editor OR admin
 * @Roles()                            // any authenticated user (guard returns true)
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
