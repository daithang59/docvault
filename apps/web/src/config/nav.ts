import type { NavItem } from '@/types/common';

export const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
    roles: ['viewer', 'editor', 'approver', 'compliance_officer', 'admin'],
  },
  {
    label: 'Documents',
    href: '/documents',
    icon: 'FileText',
    roles: ['viewer', 'editor', 'approver', 'compliance_officer', 'admin'],
  },
  {
    label: 'New Document',
    href: '/documents/new',
    icon: 'FilePlus',
    roles: ['editor', 'admin'],
  },
  {
    label: 'Approvals',
    href: '/approvals',
    icon: 'CheckSquare',
    roles: ['approver', 'admin'],
  },
  {
    label: 'Audit',
    href: '/audit',
    icon: 'ClipboardList',
    roles: ['compliance_officer'],
  },
  {
    label: 'Settings',
    href: '/settings',
    icon: 'Settings',
    roles: ['viewer', 'editor', 'approver', 'compliance_officer', 'admin'],
  },
];
