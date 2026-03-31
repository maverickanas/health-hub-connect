import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, MapPin, Clock, Navigation, Zap, Trophy, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface GeoPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

const haversineDistance = (a: GeoPoint, b: GeoPoint): number => {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
};

const GPSTracker: React.FC = () => {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [workoutDone, setWorkoutDone] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPointRef = useRef<GeoPoint | null>(null);

  const pace = elapsed > 0 && distance > 0.01 ? (elapsed / 60) / distance : 0;
  const speed = elapsed > 0 && distance > 0.01 ? (distance / (elapsed / 3600)) : 0;
  const caloriesBurned = Math.round(distance * 60);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const startGPS = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS not available on this device');
      toast.error('GPS not supported by your browser');
      return;
    }

    setGpsError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const point: GeoPoint = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          timestamp: pos.timestamp,
        };
        setCurrentPosition(point);

        if (!isPaused) {
          if (lastPointRef.current) {
            const d = haversineDistance(lastPointRef.current, point);
            if (d > 0.003 && d < 0.5) {
              setDistance(prev => prev + d);
              setPoints(prev => [...prev, point]);
            }
          } else {
            setPoints([point]);
          }
          lastPointRef.current = point;
        }
      },
      (err) => {
        console.error('GPS error:', err);
        if (err.code === 1) {
          setGpsError('Location access denied. Please enable GPS.');
          toast.error('Please allow location access to track your workout');
        } else if (err.code === 2) {
          setGpsError('GPS unavailable');
        } else {
          setGpsError('GPS timeout — move to open area');
        }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  }, [isPaused]);

  const stopGPS = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      setElapsed(prev => prev + 1);
    }, 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const handleStart = () => {
    setIsTracking(true);
    setIsPaused(false);
    setWorkoutDone(false);
    setElapsed(0);
    setDistance(0);
    setPoints([]);
    lastPointRef.current = null;
    startGPS();
    startTimer();
  };

  const handlePause = () => {
    setIsPaused(true);
    stopTimer();
  };

  const handleResume = () => {
    setIsPaused(false);
    lastPointRef.current = null;
    startTimer();
  };

  const handleStop = () => {
    stopGPS();
    stopTimer();
    setIsTracking(false);
    setIsPaused(false);
    if (distance > 0.01 || elapsed > 10) {
      setWorkoutDone(true);
      toast.success(`Workout complete! ${distance.toFixed(2)} km in ${formatTime(elapsed)}`);
    }
  };

  const handleReset = () => {
    setWorkoutDone(false);
    setElapsed(0);
    setDistance(0);
    setPoints([]);
    lastPointRef.current = null;
    setCurrentPosition(null);
  };

  useEffect(() => {
    return () => {
      stopGPS();
      stopTimer();
    };
  }, [stopGPS, stopTimer]);

  return (
    <div className="h-full w-full flex flex-col bg-background overflow-hidden">
      {/* Map Area */}
      <div className="flex-1 relative bg-[#0A0A0A]">
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:50px_50px]" />

        {/* Live coordinate display */}
        {currentPosition && (
          <div className="absolute top-32 left-4 right-4 z-10">
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel rounded-2xl p-3 flex items-center gap-3"
            >
              <div className="w-2 h-2 rounded-full bg-luxury-neon animate-pulse shadow-[0_0_8px_rgba(204,255,0,0.8)]" />
              <p className="text-[10px] font-bold text-muted-foreground font-mono">
                {currentPosition.lat.toFixed(6)}, {currentPosition.lng.toFixed(6)}
              </p>
            </motion.div>
          </div>
        )}

        {/* GPS Error */}
        {gpsError && (
          <div className="absolute top-32 left-4 right-4 z-10">
            <div className="bg-destructive/10 border border-destructive/20 rounded-2xl p-3 flex items-center gap-3">
              <AlertTriangle size={14} className="text-destructive shrink-0" />
              <p className="text-[10px] font-bold text-destructive">{gpsError}</p>
            </div>
          </div>
        )}

        {/* Center pin */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div animate={isTracking && !isPaused ? { scale: [1, 1.1, 1] } : {}} transition={{ repeat: Infinity, duration: 2 }}>
            <div className="relative">
              <MapPin size={32} className="text-luxury-neon drop-shadow-[0_0_10px_rgba(204,255,0,0.6)]" fill="rgba(204,255,0,0.2)" />
              {isTracking && !isPaused && (
                <motion.div
                  animate={{ scale: [1, 2.5], opacity: [0.4, 0] }}
                  transition={{ repeat: Infinity, duration: 1.5 }}
                  className="absolute inset-0 rounded-full border border-luxury-neon/30"
                />
              )}
            </div>
          </motion.div>
        </div>

        {/* Route visualization */}
        {isTracking && points.length > 1 && (
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 400 400">
            <motion.path
              d="M 200 280 Q 180 240 200 200 Q 220 160 200 120"
              stroke="rgba(204,255,0,0.4)"
              strokeWidth="3"
              fill="none"
              strokeDasharray="8 4"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 3 }}
            />
          </svg>
        )}

        {/* Header */}
        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-background via-background/80 to-transparent pt-14 pb-10 px-6 text-center">
          <p className="text-[9px] font-extrabold text-luxury-neon/60 uppercase tracking-[0.4em]">GPS Live Tracking</p>
          <h1 className="text-lg font-black text-foreground uppercase tracking-wider mt-1">
            Route <span className="text-luxury-neon">Tracker</span>
          </h1>
        </div>
      </div>

      {/* Control Panel */}
      <div className="bg-background border-t border-border px-6 pt-5 pb-28 space-y-4">
        {/* Workout Summary (after stop) */}
        <AnimatePresence>
          {workoutDone && !isTracking && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="glass-panel rounded-2xl p-4 flex items-center gap-3"
            >
              <Trophy size={20} className="text-luxury-neon shrink-0" />
              <div className="flex-1">
                <p className="text-xs font-black text-foreground uppercase">Workout Complete!</p>
                <p className="text-[10px] text-muted-foreground">
                  {distance.toFixed(2)} km · {formatTime(elapsed)} · {caloriesBurned} kcal burned
                </p>
              </div>
              <button onClick={handleReset} className="text-[9px] font-bold text-luxury-neon uppercase tracking-wider">Reset</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Start / Pause / Stop Buttons */}
        {!isTracking && !workoutDone && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleStart}
            className="w-full py-5 rounded-2xl bg-luxury-neon text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 shadow-[0_0_40px_rgba(204,255,0,0.2)] neon-glow"
          >
            <Play size={20} fill="currentColor" /> Start Workout
          </motion.button>
        )}

        {isTracking && (
          <div className="flex gap-3">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={isPaused ? handleResume : handlePause}
              className="flex-1 py-5 rounded-2xl border border-luxury-neon/30 text-luxury-neon font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2"
            >
              {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
              {isPaused ? 'Resume' : 'Pause'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleStop}
              className="flex-1 py-5 rounded-2xl bg-destructive/10 border border-destructive/30 text-destructive font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2"
            >
              <Square size={18} fill="currentColor" /> Stop
            </motion.button>
          </div>
        )}

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass-panel p-4 rounded-2xl text-center"
          >
            <Clock size={16} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-xl font-black text-foreground">{formatTime(elapsed)}</p>
            <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider mt-1">Time</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass-panel p-4 rounded-2xl text-center"
          >
            <Navigation size={16} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-xl font-black text-foreground">{pace > 0 ? pace.toFixed(1) : '--'}</p>
            <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider mt-1">Min/KM</p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass-panel p-4 rounded-2xl text-center"
          >
            <Zap size={16} className="text-muted-foreground mx-auto mb-2" />
            <p className="text-xl font-black text-foreground">{distance.toFixed(2)}</p>
            <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider mt-1">KM</p>
          </motion.div>
        </div>
      </div>
    </div>
  );
};

export default GPSTracker;
