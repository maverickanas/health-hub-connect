import React from 'react';
import { motion } from 'framer-motion';
import { Footprints, Play, Square, RotateCcw, Smartphone } from 'lucide-react';
import { useStepCounter } from '@/hooks/useStepCounter';

interface StepCounterWidgetProps {
  onStepsChange: (steps: number) => void;
}

const StepCounterWidget: React.FC<StepCounterWidgetProps> = ({ onStepsChange }) => {
  const { steps, isActive, isSupported, permissionState, start, stop, reset } = useStepCounter(onStepsChange);

  if (!isSupported) {
    return (
      <div className="glass-panel rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
          <Smartphone size={18} className="text-muted-foreground" />
        </div>
        <div>
          <p className="text-[11px] font-extrabold text-foreground uppercase tracking-wider">Step Counter</p>
          <p className="text-[9px] text-muted-foreground">Open on a mobile device for motion tracking</p>
        </div>
      </div>
    );
  }

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
          {!isActive ? (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={start}
              className="w-9 h-9 rounded-full bg-luxury-neon/10 border border-luxury-neon/20 flex items-center justify-center text-luxury-neon"
            >
              <Play size={14} />
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={stop}
              className="w-9 h-9 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400"
            >
              <Square size={12} />
            </motion.button>
          )}
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={reset}
            className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground"
          >
            <RotateCcw size={12} />
          </motion.button>
        </div>
      </div>

      {isActive && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex items-center gap-2"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-luxury-neon animate-pulse" />
          <span className="text-[9px] font-bold text-luxury-neon uppercase tracking-wider">Tracking active</span>
        </motion.div>
      )}

      {permissionState === 'denied' && (
        <p className="text-[9px] text-red-400 font-bold">Motion permission denied. Enable in device settings.</p>
      )}
    </motion.div>
  );
};

export default StepCounterWidget;
