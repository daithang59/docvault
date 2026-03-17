/**
 * Canonical auth types — aligned with features/auth/auth.types.ts.
 * Legacy code should migrate to import directly from features/auth/auth.types.ts.
 */

export type { UserRole } from '@/types/enums';
export type { UserInfo, Session, AuthContextValue } from '@/features/auth/auth.types';

