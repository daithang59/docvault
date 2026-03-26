import { Lock } from 'lucide-react';

interface AppLogoProps {
  collapsed?: boolean;
}

export function AppLogo({ collapsed }: AppLogoProps) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white flex-shrink-0">
        <Lock size={16} strokeWidth={2.5} />
      </div>
      {!collapsed && (
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-white tracking-tight">DocVault</span>
          <span className="text-[10px] text-[var(--text-faint)] font-medium uppercase tracking-widest">Enterprise</span>
        </div>
      )}
    </div>
  );
}
