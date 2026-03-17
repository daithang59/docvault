import { PageShell } from '@/components/layout/page-shell';
import { SectionHeader } from '@/components/common/section-header';
import { User, Shield, Globe, Info } from 'lucide-react';

export default function SettingsPage() {
  return (
    <PageShell
      title="Settings"
      description="Profile, session, and environment information"
    >
      <div className="grid gap-6 max-w-2xl">
        {/* Profile / Session Card */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <User size={18} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Profile & Session</h2>
          </div>
          <div className="px-5 py-4 space-y-3 text-sm text-slate-600">
            <p>Session information is shown below. Token details are managed by Keycloak.</p>
            <p className="text-xs text-slate-400">
              User info is read from the access token stored in session storage.
            </p>
          </div>
        </div>

        {/* Roles */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <Shield size={18} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Your Roles</h2>
          </div>
          <div className="px-5 py-4">
            <p className="text-sm text-slate-500">
              Your current roles are assigned by the identity provider.
              Contact your administrator to request role changes.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {/* Roles rendered dynamically in client component */}
              <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                Roles loaded from session
              </span>
            </div>
          </div>
        </div>

        {/* Environment Info */}
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
            <Globe size={18} className="text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Environment</h2>
          </div>
          <div className="px-5 py-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">App</span>
              <span className="font-mono text-slate-700">{process.env.NEXT_PUBLIC_APP_NAME ?? 'DocVault'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">API Base URL</span>
              <span className="font-mono text-slate-700 text-xs truncate max-w-[240px]">
                {process.env.NEXT_PUBLIC_API_BASE_URL ?? 'Not configured'}
              </span>
            </div>
          </div>
        </div>

        {/* System Preferences placeholder */}
        <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50">
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-200">
            <Info size={18} className="text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-500">System Preferences</h2>
          </div>
          <div className="px-5 py-4 text-sm text-slate-400">
            System preferences will be configurable in a future release.
          </div>
        </div>
      </div>
    </PageShell>
  );
}
