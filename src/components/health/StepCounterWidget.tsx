import React from 'react';
import { motion } from 'framer-motion';
import { Footprints, Play, Square, RotateCcw, Smartphone, Sliders, ShieldCheck, ShieldAlert, Loader2 } from 'lucide-react';
import { useStepCounter } from '@/hooks/useStepCounter';

interface StepCounterWidgetProps {
  userId?: string;
  onSessionSaved?: (newDailyTotal: number) => void;
}

const StepCounterWidget: React.FC<StepCounterWidgetProps> = ({ userId, onSessionSaved }) => {
  const {
    steps,
    isActive,
    isSupported,
    permissionState,
    start,
    stop,
    reset,
    calibrate,
    requestPermission,
  } = useStepCounter({ userId, onSessionSaved });

  if (!isSupported) {
    return (
      <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
          <Smartphone size={18} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-[11px] font-extrabold text-foreground uppercase tracking-wider">Step Counter</p>
          <p className="text-[9px] text-muted-foreground">Hardware motion sensors not supported on this device</p>
        </div>
      </div>
    );
  }

  const granted = permissionState === 'granted';
  const requesting = permissionState === 'requesting';
  const denied = permissionState === 'denied' || permissionState === 'unsupported';

  const statusMeta = (() => {
    if (requesting) return { icon: <Loader2 size={11} className="animate-spin" />, label: 'Requesting motion permission…', cls: 'text-muted-foreground' };
    if (granted)    return { icon: <ShieldCheck size={11} />, label: 'Motion permission granted · sensors ready', cls: 'text-luxury-neon' };
    if (denied)     return { icon: <ShieldAlert size={11} />, label: 'Motion permission denied · enable in device settings', cls: 'text-red-400' };
    return            { icon: <ShieldAlert size={11} />, label: 'Tap unlock to enable motion sensors', cls: 'text-amber-400' };
  })();

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel rounded-2xl p-4 space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
            isActive ? 'bg-luxury-neon/10' : 'bg-muted'
          }`}>
            <Footprints size={18} className={isActive ? 'text-luxury-neon' : 'text-muted-foreground'} />
          </div>
          <div>
            <p className="text-[10px] font-extrabold text-muted-foreground uppercase tracking-[0.15em]">Live Steps</p>
            <p className="text-xl font-black text-foreground">{steps.toLocaleString()}</p>
          </div>
        </div>

        <div className="flex gap-1.5">
          {!granted ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={requestPermission}
              disabled={requesting}
              aria-label="Request motion permission"
              className="px-3 h-9 rounded-full bg-luxury-neon/10 border border-luxury-neon/20 flex items-center gap-1.5 text-luxury-neon text-[10px] font-black uppercase tracking-wider disabled:opacity-50"
            >
              {requesting ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
              Unlock
            </motion.button>
          ) : !isActive ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={start}
              aria-label="Start step tracking"
              className="w-9 h-9 rounded-full bg-luxury-neon/10 border border-luxury-neon/20 flex items-center justify-center text-luxury-neon"
            >
              <Play size={14} />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={stop}
              aria-label="Stop step tracking and save"
              className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400"
            >
              <Square size={12} />
            </motion.button>
          )}

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={calibrate}
            disabled={!granted}
            aria-label="Calibrate step detection"
            title="Calibrate (resets detection without saving)"
            className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground disabled:opacity-40"
          >
            <Sliders size={12} />
          </motion.button>

          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={reset}
            disabled={!granted}
            aria-label="Reset session counter"
            className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground disabled:opacity-40"
          >
            <RotateCcw size={12} />
          </motion.button>
        </div>
      </div>

      {/* Status line */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <span className={`flex items-center gap-1.5 ${statusMeta.cls}`}>
          {statusMeta.icon}
          <span className="text-[9px] font-bold uppercase tracking-wider">{statusMeta.label}</span>
        </span>
      </div>

      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-luxury-neon animate-pulse" />
          <span className="text-[9px] font-bold text-luxury-neon uppercase tracking-wider">Tracking active — walk to count steps</span>
        </motion.div>
      )}
    </motion.div>
  );
};

export default StepCounterWidget;
