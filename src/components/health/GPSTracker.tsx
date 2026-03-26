import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, MapPin, Clock, Activity, Navigation } from 'lucide-react';

const GPSTracker: React.FC = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);

  const handleToggle = () => {
    setIsTracking(!isTracking);
    if (!isTracking) {
      // Simulate tracking
      const interval = setInterval(() => {
        setElapsed(prev => prev + 1);
        setDistance(prev => prev + 0.008 + Math.random() * 0.005);
      }, 1000);
      (window as any).__trackInterval = interval;
    } else {
      clearInterval((window as any).__trackInterval);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const pace = elapsed > 0 && distance > 0 ? (elapsed / 60) / distance : 0;

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden">
      {/* Map Area */}
      <div className="flex-1 relative bg-[#0A0A0A]">
        {/* Dark map placeholder with grid */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:50px_50px]" />
        
        {/* Map pin */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            animate={isTracking ? { scale: [1, 1.1, 1] } : {}}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            <div className="relative">
              <MapPin size={32} className="text-luxury-neon drop-shadow-[0_0_10px_rgba(204,255,0,0.6)]" fill="rgba(204,255,0,0.2)" />
              {isTracking && (
                <motion.div
                  animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute inset-0 rounded-full border border-luxury-neon/30"
                />
              )}
            </div>
          </motion.div>
        </div>

        {/* Simulated route dots */}
        {isTracking && (
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
            <motion.path
              d="M 200 280 Q 180 240 200 200 Q 220 160 200 120"
              stroke="rgba(204,255,0,0.4)"
              strokeWidth="3"
              fill="none"
              strokeDasharray="8 4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 10, repeat: Infinity }}
            />
          </svg>
        )}

        {/* Header overlay */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-background via-background/80 to-transparent pt-14 pb-10 px-6 text-center">
          <p className="text-[9px] font-extrabold text-luxury-neon/60 uppercase tracking-[0.4em]">GPS Live Tracking</p>
          <h1 className="text-lg font-black text-foreground uppercase tracking-wider mt-1">
            Route <span className="text-luxury-neon">Tracker</span>
          </h1>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-background border-t border-border px-6 pt-6 pb-28 space-y-5">
        {/* Start/Stop Button */}
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={handleToggle}
          className={`w-full py-5 rounded-2xl font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 transition-all ${
            isTracking
              ? 'bg-destructive/10 border border-destructive/30 text-destructive'
              : 'bg-luxury-neon text-primary-foreground shadow-[0_0_40px_rgba(204,255,0,0.2)] neon-glow'
          }`}
        >
          {isTracking ? <Pause size={20} fill="currentColor" /> : <Play size={20} fill="currentColor" />}
          {isTracking ? 'Stop Workout' : 'Start Workout'}
        </motion.button>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <div className="glass-panel p-4 rounded-2xl text-center">
            <Clock size={16} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-xl font-black text-foreground">{formatTime(elapsed)}</p>
            <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider mt-1">Time</p>
          </div>
          <div className="glass-panel p-4 rounded-2xl text-center">
            <Navigation size={16} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-xl font-black text-foreground">{pace > 0 ? pace.toFixed(1) : '--'}</p>
            <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider mt-1">Pace</p>
          </div>
          <div className="glass-panel p-4 rounded-2xl text-center">
            <Activity size={16} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-xl font-black text-foreground">{distance.toFixed(2)}</p>
            <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider mt-1">KM</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GPSTracker;
