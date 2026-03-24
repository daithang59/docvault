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
    <div className="min-h-screen flex bg-slate-50">
      {/* Left panel — Brand: glassmorphism dark with ambient glow */}
      <div
        className="hidden lg:flex flex-col justify-between relative w-[460px] shrink-0 overflow-hidden"
        style={{
          background: 'linear-gradient(160deg, rgba(15,23,42,0.97) 0%, rgba(15,23,42,1) 60%, rgba(30,41,59,0.95) 100%)',
          backdropFilter: 'blur(24px)',
        }}
      >
        {/* Ambient background orbs */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute top-1/3 right-0 w-60 h-60 rounded-full bg-violet-500/10 blur-3xl translate-x-1/2" />
          <div className="absolute bottom-0 left-1/4 w-96 h-96 rounded-full bg-indigo-500/5 blur-3xl translate-y-1/2" />
          {/* Grid overlay */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
        </div>

        {/* Content */}
        <div className="relative flex flex-col justify-between h-full p-10 z-10">
          <div>
            {/* Logo */}
            <div className="flex items-center gap-3 mb-16">
              {/* Logo icon with glass effect */}
              <div className="relative h-11 w-11 rounded-xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-violet-600" />
                <div className="absolute inset-0.5 rounded-[8px] bg-[#0F172A] flex items-center justify-center">
                  <Shield className="h-5 w-5 text-blue-400" />
                </div>
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight">DocVault</h1>
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-medium">Document System</p>
              </div>
            </div>

            {/* Headline */}
            <div className="mb-8">
              <h2 className="text-[28px] font-semibold text-white leading-[1.25] mb-4 tracking-tight">
                Secure document management for{' '}
                <span className="bg-gradient-to-r from-blue-400 to-violet-400 bg-clip-text text-transparent">
                  modern enterprises.
                </span>
              </h2>
              <p className="text-sm text-slate-400 leading-relaxed">
                Control access, manage workflows, and ensure compliance across every document lifecycle stage.
              </p>
            </div>
          </div>

          {/* Feature list */}
          <div className="space-y-3">
            {[
              { icon: '🛡️', label: 'Role-based access control', glow: 'rgba(59,130,246,0.4)' },
              { icon: '🔗', label: 'Immutable audit trail', glow: 'rgba(124,58,237,0.4)' },
              { icon: '⚡', label: 'Workflow state management', glow: 'rgba(59,130,246,0.3)' },
              { icon: '🔒', label: 'Secure file storage', glow: 'rgba(34,197,94,0.4)' },
            ].map((feat) => (
              <div key={feat.label} className="flex items-center gap-3 group">
                <div
                  className="h-7 w-7 rounded-lg flex items-center justify-center text-sm shrink-0 transition-transform group-hover:scale-110"
                  style={{
                    background: `linear-gradient(135deg, ${feat.glow.replace('0.4', '0.15')}, ${feat.glow.replace('0.4', '0.05')})`,
                    border: `1px solid ${feat.glow.replace('0.4', '0.3')}`,
                  }}
                >
                  {feat.icon}
                </div>
                <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{feat.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — Login form: clean white with subtle shadow */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-[420px]">
          {/* Logo mobile */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="relative h-9 w-9 rounded-xl overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-violet-600" />
              <div className="absolute inset-0.5 rounded-[8px] bg-[#0F172A] flex items-center justify-center">
                <Shield className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            <span className="text-xl font-bold text-slate-800">DocVault</span>
          </div>

          {/* Form card */}
          <div
            className="rounded-2xl p-8"
            style={{
              background: 'rgba(255,255,255,0.95)',
              backdropFilter: 'blur(16px)',
              border: '1px solid rgba(226,232,240,0.8)',
              boxShadow: '0 25px 50px rgba(0,0,0,0.08), 0 8px 20px rgba(0,0,0,0.04)',
            }}
          >
            <div className="mb-6">
              <h2 className="text-2xl font-semibold text-slate-800 mb-1">Welcome back</h2>
              <p className="text-sm text-slate-500">Sign in to your secure document portal</p>
            </div>

            {/* Mode toggle — pill tabs */}
            <div
              className="flex gap-1 p-1 rounded-xl mb-6"
              style={{ background: 'rgba(241,245,249,0.8)', border: '1px solid rgba(226,232,240,0.6)' }}
            >
              <button
                onClick={() => setMode('demo')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  mode === 'demo'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Demo Login
              </button>
              <button
                onClick={() => setMode('jwt')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
                  mode === 'jwt'
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                JWT Token
              </button>
            </div>

            {/* Username */}
            <div className="mb-4">
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                Username
              </label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={mode === 'demo' ? `demo_${selectedRole}` : 'Your name'}
                className="w-full px-3.5 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
              />
            </div>

            {mode === 'demo' ? (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Select Role</label>
                  <div className="space-y-2">
                    {DEMO_ROLES.map((role) => (
                      <button
                        key={role.value}
                        onClick={() => setSelectedRole(role.value)}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all ${
                          selectedRole === role.value
                            ? 'border-blue-400/60 bg-blue-50/60'
                            : 'border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/80'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-sm font-medium ${selectedRole === role.value ? 'text-blue-600' : 'text-slate-700'}`}>
                            {role.label}
                          </span>
                          {selectedRole === role.value && (
                            <div
                              className="h-2 w-2 rounded-full"
                              style={{
                                background: '#2563EB',
                                boxShadow: '0 0 6px rgba(37,99,235,0.6)',
                              }}
                            />
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{role.description}</p>
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleDemoLogin}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all active:scale-[0.98] btn-primary"
                >
                  Enter as {DEMO_ROLES.find((r) => r.value === selectedRole)?.label}
                </button>
              </>
            ) : (
              <>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">JWT Token</label>
                  <textarea
                    value={jwtToken}
                    onChange={(e) => setJwtToken(e.target.value)}
                    rows={4}
                    placeholder="Paste your JWT access token here..."
                    className="w-full px-3.5 py-2.5 text-xs font-mono border border-slate-200 rounded-xl bg-white text-slate-800 placeholder:text-slate-400 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none"
                  />
                  {jwtError && (
                    <p className="text-xs text-red-500 mt-1">{jwtError}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1.5">
                    Roles will be extracted from the token. If parsing fails, select a fallback role below.
                  </p>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-semibold text-slate-700 mb-1.5">Fallback Role</label>
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white text-slate-800 outline-none transition-all focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
                  >
                    {DEMO_ROLES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleJwtLogin}
                  className="w-full py-3 rounded-xl text-white text-sm font-semibold transition-all active:scale-[0.98] btn-primary"
                >
                  Sign in with Token
                </button>
              </>
            )}
          </div>

          <p className="text-center text-xs text-slate-400 mt-6">
            DocVault — Secure Document Management System
          </p>
        </div>
      </div>
    </div>
  );
}
