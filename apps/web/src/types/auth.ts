export type UserRole =
  | 'viewer'
  | 'editor'
  | 'approver'
  | 'compliance_officer'
  | 'admin';

export interface Session {
  accessToken: string;
  userId: string;
  username: string;
  roles: UserRole[];
}

export interface AuthContextValue {
  session: Session | null;
  login: (session: Session) => void;
  logout: () => void;
  isAuthenticated: boolean;
  hasRole: (role: UserRole) => boolean;
  hasAnyRole: (roles: UserRole[]) => boolean;
  isViewer: boolean;
  isEditor: boolean;
  isApprover: boolean;
  isComplianceOfficer: boolean;
  isAdmin: boolean;
}
