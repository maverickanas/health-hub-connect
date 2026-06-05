import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, ShieldCheck, Eye, Battery, Lock, X, Loader2 } from 'lucide-react';

interface LocationPermissionSheetProps {
  open: boolean;
  onClose: () => void;
  onGranted: () => void | Promise<void>;
}

type PermState = 'unknown' | 'prompt' | 'granted' | 'denied';

/**
 * A user-friendly, on-demand location permission sheet.
 *
 * Explains exactly WHY we need foreground + background location BEFORE we
 * trigger the OS prompt. This is critical for two reasons:
 *   1) Play Store policy — apps requesting ACCESS_BACKGROUND_LOCATION must
 *      disclose usage in-context.
 *   2) Conversion — users who understand the value grant permission ~3x more
 *      often than those hit with a cold OS dialog.
 *
 * The actual OS prompt is fired by the caller (via startWatch / native
 * BackgroundGeolocation.addWatcher) only AFTER the user taps "Enable".
 */
const LocationPermissionSheet: React.FC<LocationPermissionSheetProps> = ({
  open,
  onClose,
  onGranted,
}) => {
  const [perm, setPerm] = useState<PermState>('unknown');
  const [isRequesting, setIsRequesting] = useState(false);

  // Detect current browser permission state when sheet opens
  useEffect(() => {
    if (!open) return;
    if (typeof navigator === 'undefined' || !('permissions' in navigator)) {
      setPerm('prompt');
      return;
    }
    (navigator.permissions as any)
      .query({ name: 'geolocation' })
      .then((res: PermissionStatus) => {
        setPerm(res.state as PermState);
        res.onchange = () => setPerm(res.state as PermState);
      })
      .catch(() => setPerm('prompt'));
  }, [open]);

  const handleEnable = async () => {
    setIsRequesting(true);
    try {
      await onGranted();
      onClose();
    } finally {
      setIsRequesting(false);
    }
  };

  const reasons = [
    {
      icon: MapPin,
      title: 'Live Route Tracking',
      body: 'Plots your walk or ride in real time so we can compute distance, pace and calories burned.',
    },
    {
      icon: Eye,
      title: 'Background Continuity',
      body: 'Keeps tracking when your phone screen is off or another app is open — so a locked screen never erases your workout.',
    },
    {
      icon: ShieldCheck,
      title: 'Private By Default',
      body: 'Your GPS trail stays on your device and your private HEALTHY.HUB account. We never sell or share location data.',
    },
    {
      icon: Battery,
      title: 'Battery Conscious',
      body: 'We only sample location while a workout is active and stop the moment you tap finish.',
    },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[3000] bg-[#0A0A0A]/95 backdrop-blur-xl flex flex-col items-stretch sm:items-center sm:justify-center p-0 sm:p-6 overflow-y-auto"
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          {/* Solid backdrop to fully occlude the map + header underneath */}
          <div className="absolute inset-0 bg-[#0A0A0A]/95 -z-10" aria-hidden />
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 240 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="loc-perm-title"
            className="w-full max-w-md bg-[#0A0A0A] border-t sm:border border-[#CCFF00]/15 rounded-t-[2rem] sm:rounded-3xl p-6 pb-10 space-y-5 shadow-[0_-20px_60px_-10px_rgba(204,255,0,0.15)]"
          >
            {/* Drag handle (mobile) */}
            <div className="sm:hidden flex justify-center -mt-2">
              <div className="w-10 h-1 rounded-full bg-white/15" />
            </div>

            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="relative shrink-0">
                <div className="w-14 h-14 rounded-2xl bg-[#CCFF00]/10 border border-[#CCFF00]/30 flex items-center justify-center">
                  <MapPin size={26} className="text-[#CCFF00]" />
                </div>
                <div
                  className="absolute -inset-1 rounded-2xl pointer-events-none"
                  style={{ boxShadow: '0 0 24px rgba(204,255,0,0.35)' }}
                />
              </div>
              <div className="flex-1 pt-1">
                <p className="text-[9px] font-extrabold text-[#CCFF00]/70 uppercase tracking-[0.3em]">
                  Permission Required
                </p>
                <h2
                  id="loc-perm-title"
                  className="text-lg font-black text-white uppercase tracking-wide mt-1 leading-tight"
                >
                  Enable Location <span className="text-[#CCFF00]">Tracking</span>
                </h2>
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="p-2 -mr-2 -mt-2 rounded-xl text-white/40 hover:text-white hover:bg-white/5 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Reason list */}
            <div className="space-y-2.5">
              {reasons.map((r) => (
                <div
                  key={r.title}
                  className="flex items-start gap-3 p-3 rounded-2xl bg-white/[0.03] border border-white/[0.06]"
                >
                  <div className="w-9 h-9 rounded-xl bg-[#CCFF00]/10 flex items-center justify-center shrink-0">
                    <r.icon size={16} className="text-[#CCFF00]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-black text-white uppercase tracking-wider leading-snug">
                      {r.title}
                    </p>
                    <p className="text-[11px] text-white/55 leading-relaxed mt-0.5">
                      {r.body}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Denied banner */}
            {perm === 'denied' && (
              <div className="flex items-start gap-2 p-3 rounded-2xl bg-red-500/5 border border-red-500/20">
                <Lock size={14} className="text-red-400 mt-0.5 shrink-0" />
                <p className="text-[10px] text-red-300/90 leading-relaxed">
                  Location is currently blocked for HEALTHY.HUB. Open your device
                  settings → <span className="font-bold">Apps → HEALTHY.HUB → Permissions → Location</span> and
                  choose <span className="font-bold">Allow all the time</span>.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-2 pt-1">
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleEnable}
                disabled={isRequesting || perm === 'denied'}
                className="w-full py-4 rounded-2xl bg-[#CCFF00] text-black font-black text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(204,255,0,0.35)] disabled:opacity-40 disabled:shadow-none transition-all active:scale-[0.97]"
              >
                {isRequesting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Requesting…
                  </>
                ) : perm === 'granted' ? (
                  <>
                    <ShieldCheck size={14} /> Start Tracking
                  </>
                ) : (
                  <>
                    <MapPin size={14} /> Enable Location
                  </>
                )}
              </motion.button>
              <button
                onClick={onClose}
                className="w-full py-3 rounded-2xl text-[10px] font-bold text-white/40 uppercase tracking-[0.2em] hover:text-white/70 transition-colors"
              >
                Not Now
              </button>
            </div>

            <p className="text-[9px] text-white/30 text-center leading-relaxed">
              You can revoke this at any time in your device settings. We will
              never access your location outside of an active workout.
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LocationPermissionSheet;
