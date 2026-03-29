import {
  LayoutDashboard,
  FileText,
  FolderOpen,
  FilePlus,
  CheckSquare,
  Shield,
} from 'lucide-react';
import { UserRole } from '@/types/auth';
import { ROUTES } from './routes';

export interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: UserRole[];
}

// Imported here for type-checking only; actual import happens in usage
export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: ROUTES.DASHBOARD,
    icon: LayoutDashboard,
    roles: ['viewer', 'editor', 'approver', 'compliance_officer', 'admin'],
  },
  {
    label: 'Documents',
    href: ROUTES.DOCUMENTS,
    icon: FileText,
    roles: ['viewer', 'editor', 'approver', 'compliance_officer', 'admin'],
  },
  {
    label: 'My Documents',
    href: ROUTES.MY_DOCUMENTS,
    icon: FolderOpen,
    roles: ['editor', 'admin'],
  },
  {
    label: 'New Document',
    href: ROUTES.DOCUMENTS_NEW,
    icon: FilePlus,
    roles: ['editor', 'admin'],
  },
  {
    label: 'Approvals',
    href: ROUTES.APPROVALS,
    icon: CheckSquare,
    roles: ['approver', 'admin'],
  },
  {
    label: 'Audit',
    href: ROUTES.AUDIT,
    icon: Shield,
    roles: ['compliance_officer', 'admin'],
  },
];
