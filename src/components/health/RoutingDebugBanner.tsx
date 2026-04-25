import React from 'react';
import type { AuthProfile } from '@/hooks/useAuth';

interface RoutingDebugBannerProps {
  rule: 'loading' | 'returning' | 'onboarding' | 'unauthenticated';
  profile: AuthProfile | null;
  profileLoading: boolean;
}

/**
 * Dev-only banner that surfaces which routing rule matched and the loaded
 * biometric values, so we can verify returning vs. onboarding flows at a glance.
 * Shown only when import.meta.env.DEV is true.
 */
const RoutingDebugBanner: React.FC<RoutingDebugBannerProps> = ({ rule, profile, profileLoading }) => {
  if (!import.meta.env.DEV) return null;

  const ruleColor =
    rule === 'returning' ? 'text-[#CCFF00]' :
    rule === 'onboarding' ? 'text-amber-400' :
    rule === 'unauthenticated' ? 'text-red-400' :
    'text-muted-foreground';

  const fmt = (n: number | null | undefined, unit: string) =>
    n == null || !Number.isFinite(Number(n)) ? '—' : `${Number(n)}${unit}`;

  return (
    <div className="fixed top-2 left-2 right-2 z-[100] pointer-events-none">
      <div className="mx-auto max-w-md rounded-lg border border-white/10 bg-black/70 backdrop-blur-md px-3 py-2 text-[9px] font-mono text-foreground/80 flex items-center gap-3 flex-wrap">
        <span className="font-black uppercase tracking-[0.2em] text-muted-foreground">ROUTE</span>
        <span className={`font-black uppercase tracking-[0.2em] ${ruleColor}`}>
          {profileLoading && rule !== 'unauthenticated' ? 'LOADING…' : rule.toUpperCase()}
        </span>
        <span className="text-muted-foreground/60">|</span>
        <span>H: <span className="text-foreground">{fmt(profile?.height, 'cm')}</span></span>
        <span>W: <span className="text-foreground">{fmt(profile?.weight, 'kg')}</span></span>
        <span>A: <span className="text-foreground">{fmt(profile?.age, 'y')}</span></span>
      </div>
    </div>
  );
};

export default RoutingDebugBanner;
