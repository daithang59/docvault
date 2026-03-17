'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/auth-context';
import { ROUTES } from '@/lib/constants/routes';
import { getCurrentUser } from '@/features/auth/auth.api';
import {
  buildSessionFromAccessToken,
  buildUserInfoFromCurrentUserDto,
  parseJwt,
} from '@/lib/auth/token';
import { UserRole, Session } from '@/types/auth';
import { Shield } from 'lucide-react';

const DEMO_ROLES: { value: UserRole; label: string; description: string }[] = [
  { value: 'viewer', label: 'Viewer', description: 'Read-only access to published documents' },
  { value: 'editor', label: 'Editor', description: 'Create, upload, and submit documents' },
  { value: 'approver', label: 'Approver', description: 'Approve or reject pending documents' },
  { value: 'compliance_officer', label: 'Compliance', description: 'View audit logs and metadata' },
  { value: 'admin', label: 'Admin', description: 'Full system access' },
];

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [mode, setMode] = useState<'demo' | 'jwt'>('demo');
  const [selectedRole, setSelectedRole] = useState<UserRole>('editor');
  const [username, setUsername] = useState('');
  const [jwtToken, setJwtToken] = useState('');
  const [jwtError, setJwtError] = useState('');

  function handleDemoLogin() {
    const displayName = username.trim() || `demo_${selectedRole}`;
    const session: Session = {
      accessToken: `demo_token_${selectedRole}_${Date.now()}`,
      user: {
        sub: `demo-user-${selectedRole}`,
        username: displayName,
        preferred_username: displayName,
        roles: [selectedRole],
      },
    };
    login(session);
    router.push(ROUTES.DASHBOARD);
  }

  async function handleJwtLogin() {
    setJwtError('');
    if (!jwtToken.trim()) {
      setJwtError('Please enter a JWT token.');
      return;
    }
    const token = jwtToken.trim();
    const payload = parseJwt(token);

    try {
      const currentUser = await getCurrentUser(token);
      login({
        accessToken: token,
        user: buildUserInfoFromCurrentUserDto(currentUser),
      });
      router.push(ROUTES.DASHBOARD);
      return;
    } catch {
      const tokenSession = buildSessionFromAccessToken(token);

      if (tokenSession) {
        login({
          ...tokenSession,
          user: {
            ...tokenSession.user,
            username: username.trim() || tokenSession.user.username,
            preferred_username:
              username.trim() || tokenSession.user.preferred_username,
            roles:
              tokenSession.user.roles.length > 0
                ? tokenSession.user.roles
                : [selectedRole],
          },
        });
        router.push(ROUTES.DASHBOARD);
        return;
      }
    }

    if (!payload) {
      setJwtError('Invalid JWT format. Using selected fallback role.');
    }

    const displayName = username.trim() || 'user';
    const session: Session = {
      accessToken: token,
      user: {
        sub: 'unknown',
        username: displayName,
        preferred_username: displayName,
        roles: [selectedRole],
      },
    };
    login(session);
    router.push(ROUTES.DASHBOARD);
  }


  return (
    <div className="min-h-screen bg-[#F8FAFC] flex">
      {/* Left panel - Brand */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] bg-[#0F172A] p-10 shrink-0">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="h-10 w-10 rounded-xl bg-[#2563EB] flex items-center justify-center">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">DocVault</h1>
              <p className="text-xs text-[#94A3B8] tracking-wider uppercase">Document System</p>
            </div>
          </div>
          <h2 className="text-3xl font-semibold text-white leading-tight mb-4">
            Secure document management for modern enterprises.
          </h2>
          <p className="text-[#94A3B8] text-sm leading-relaxed">
            Control access, manage workflows, and ensure compliance across every document lifecycle stage.
          </p>
        </div>

        <div className="space-y-4">
          {['Role-based access control', 'Immutable audit trail', 'Workflow state management', 'Secure file storage'].map((feat) => (
            <div key={feat} className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-[#2563EB]" />
              <span className="text-sm text-[#CBD5E1]">{feat}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right panel - Login form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          {/* Logo mobile */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="h-9 w-9 rounded-xl bg-[#2563EB] flex items-center justify-center">
              <Shield className="h-4 w-4 text-white" />
            </div>
            <span className="text-xl font-bold text-[#0F172A]">DocVault</span>
          </div>

          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-8 shadow-sm">
            <h2 className="text-2xl font-semibold text-[#0F172A] mb-1">Sign in</h2>
            <p className="text-sm text-[#64748B] mb-6">Access your secure document portal</p>

            {/* Mode toggle */}
            <div className="flex gap-1 bg-[#F1F5F9] p-1 rounded-xl mb-6">
              <button
                onClick={() => setMode('demo')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${mode === 'demo' ? 'bg-white text-[#1E293B] shadow-sm' : 'text-[#64748B] hover:text-[#1E293B]'}`}
              >
                Demo Login
              </button>
              <button
                onClick={() => setMode('jwt')}
                className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-all ${mode === 'jwt' ? 'bg-white text-[#1E293B] shadow-sm' : 'text-[#64748B] hover:text-[#1E293B]'}`}
              >
                JWT Token
              </button>
            </div>

            {/* Username */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === 'demo' ? `demo_${selectedRole}` : 'Your name'}
                className="w-full px-3.5 py-2.5 text-sm border border-[#CBD5E1] rounded-xl bg-white text-[#1E293B] placeholder:text-[#94A3B8] outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition"
              />
            </div>

            {mode === 'demo' ? (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-[#1E293B] mb-2">Select Role</label>
                  <div className="space-y-2">
                    {DEMO_ROLES.map((role) => (
                      <button
                        key={role.value}
                        onClick={() => setSelectedRole(role.value)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                          selectedRole === role.value
                            ? 'border-[#2563EB] bg-[#EFF6FF]'
                            : 'border-[#E2E8F0] hover:border-[#CBD5E1] hover:bg-[#F8FAFC]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${selectedRole === role.value ? 'text-[#1D4ED8]' : 'text-[#1E293B]'}`}>
                            {role.label}
                          </span>
                          {selectedRole === role.value && (
                            <div className="h-2 w-2 rounded-full bg-[#2563EB]" />
                          )}
                        </div>
                        <p className="text-xs text-[#94A3B8] mt-0.5">{role.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleDemoLogin}
                  className="w-full py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition"
                >
                  Enter as {DEMO_ROLES.find((r) => r.value === selectedRole)?.label}
                </button>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[#1E293B] mb-1.5">JWT Token</label>
                  <textarea
                    value={jwtToken}
                    onChange={(e) => setJwtToken(e.target.value)}
                    rows={4}
                    placeholder="Paste your JWT access token here..."
                    className="w-full px-3.5 py-2.5 text-xs font-mono border border-[#CBD5E1] rounded-xl bg-white text-[#1E293B] placeholder:text-[#94A3B8] outline-none focus:ring-2 focus:ring-[#2563EB]/20 focus:border-[#2563EB] transition resize-none"
                  />
                  {jwtError && (
                    <p className="text-xs text-[#DC2626] mt-1">{jwtError}</p>
                  )}
                  <p className="text-xs text-[#94A3B8] mt-1">
                    Roles will be extracted from the token. If parsing fails, select a fallback role below.
                  </p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-[#1E293B] mb-1.5">Fallback Role</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2.5 text-sm border border-[#CBD5E1] rounded-xl bg-white text-[#1E293B] outline-none focus:border-[#2563EB] transition"
                  >
                    {DEMO_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleJwtLogin}
                  className="w-full py-3 rounded-xl bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-sm font-semibold transition"
                >
                  Sign in with Token
                </button>
              </>
            )}
          </div>

          <p className="text-center text-xs text-[#94A3B8] mt-6">
            DocVault — Secure Document Management System
          </p>
        </div>
      </div>
    </div>
  );
}
