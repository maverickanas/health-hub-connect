import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, Clock, Navigation, Zap, AlertTriangle, Footprints, Bike, RotateCw, Save, Loader2 } from 'lucide-react';
import { MapContainer, TileLayer, Polyline, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';

interface GeoPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

type ActivityMode = 'walking' | 'cycling';

interface GPSTrackerProps {
  onWorkoutSave?: (distance: number, calories: number, duration: number) => void;
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

const neonIcon = new L.DivIcon({
  className: '',
  html: `<div style="width:20px;height:20px;background:rgba(204,255,0,0.9);border-radius:50%;box-shadow:0 0 16px rgba(204,255,0,0.6);border:2px solid rgba(204,255,0,0.4);"></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
});

const MapFollower: React.FC<{ position: [number, number] | null; shouldFly?: boolean }> = ({ position, shouldFly }) => {
  const map = useMap();
  const hasFlown = useRef(false);

  useEffect(() => {
    if (!position) return;
    if (!hasFlown.current && shouldFly) {
      map.flyTo(position, 17, { duration: 2, easeLinearity: 0.25 });
      hasFlown.current = true;
    } else {
      map.setView(position, map.getZoom(), { animate: true });
    }
  }, [position, map, shouldFly]);

  return null;
};

type WorkoutState = 'idle' | 'active' | 'paused';

const GPSTracker: React.FC<GPSTrackerProps> = ({ onWorkoutSave }) => {
  const [workoutState, setWorkoutState] = useState<WorkoutState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [activityMode, setActivityMode] = useState<ActivityMode>('walking');
  const [isSaving, setIsSaving] = useState(false);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPointRef = useRef<GeoPoint | null>(null);
  const isPausedRef = useRef(false);
  isPausedRef.current = workoutState === 'paused';

  // Pace = min/km (walking), Speed = km/h (cycling)
  const pace = elapsed > 0 && distance > 0.01 ? (elapsed / 60) / distance : 0;
  const speed = elapsed > 0 && distance > 0.01 ? distance / (elapsed / 3600) : 0;
  // Cycling burns ~30 kcal/km, walking ~60 kcal/km (rough estimate)
  const kcalPerKm = activityMode === 'cycling' ? 30 : 60;
  const caloriesBurned = Math.round(distance * kcalPerKm);

  const mapCenter: [number, number] = currentPosition
    ? [currentPosition.lat, currentPosition.lng]
    : [20.5937, 78.9629];

  const routeLatLngs: [number, number][] = points.map(p => [p.lat, p.lng]);

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
        const point: GeoPoint = { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: pos.timestamp };
        setCurrentPosition(point);
        if (!isPausedRef.current) {
          if (lastPointRef.current) {
            const d = haversineDistance(lastPointRef.current, point);
            const maxJump = activityMode === 'cycling' ? 1.5 : 0.5;
            if (d > 0.003 && d < maxJump) {
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
        if (err.code === 1) { setGpsError('Location access denied. Please enable GPS.'); toast.error('Please allow location access'); }
        else if (err.code === 2) { setGpsError('GPS unavailable'); }
        else { setGpsError('GPS timeout — move to open area'); }
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 }
    );
  }, [activityMode]);

  const stopGPS = useCallback(() => {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null; }
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const handleStart = () => {
    setWorkoutState('active');
    setElapsed(0); setDistance(0); setPoints([]); lastPointRef.current = null;
    startGPS(); startTimer();
  };

  const handlePause = () => { setWorkoutState('paused'); stopTimer(); };
  const handleResume = () => { setWorkoutState('active'); lastPointRef.current = null; startTimer(); };

  const handleStop = () => {
    // Stop = abandon without saving
    stopGPS(); stopTimer();
    setWorkoutState('idle');
    setElapsed(0); setDistance(0); setPoints([]);
    lastPointRef.current = null;
    toast.info('Workout discarded');
  };

  const handleFinishAndSave = async () => {
    if (isSaving) return;
    if (distance < 0.01 && elapsed < 10) {
      toast.error('Workout too short to save');
      return;
    }
    setIsSaving(true);
    try {
      stopGPS(); stopTimer();
      if (onWorkoutSave) {
        await onWorkoutSave(distance, caloriesBurned, elapsed);
      }
      toast.success(`Saved! ${distance.toFixed(2)} km · ${caloriesBurned} kcal`);
      // Reset local state — parent will route to HOME
      setWorkoutState('idle');
      setElapsed(0); setDistance(0); setPoints([]);
      lastPointRef.current = null;
    } catch (err) {
      console.error('Workout save failed:', err);
      toast.error('Failed to save workout. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => { return () => { stopGPS(); stopTimer(); }; }, [stopGPS, stopTimer]);

  const checkGeolocation = useCallback(() => {
    if (!navigator.geolocation) {
      setGpsError('GPS not available on this device');
      return;
    }
    setGpsError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCurrentPosition({ lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: pos.timestamp });
        setGpsError(null);
      },
      (err) => {
        if (err.code === 1) setGpsError('Location access denied. Please enable GPS.');
        else if (err.code === 2) setGpsError('GPS unavailable');
        else setGpsError('GPS timeout — move to open area');
      },
      { enableHighAccuracy: true, timeout: 5000 }
    );
  }, []);

  const handleRetryGPS = useCallback(() => {
    toast.info('Retrying GPS…');
    checkGeolocation();
    if (workoutState !== 'idle') {
      stopGPS();
      startGPS();
    }
  }, [checkGeolocation, workoutState, startGPS, stopGPS]);

  useEffect(() => {
    checkGeolocation();
  }, [checkGeolocation]);

  // Auto re-check when an error appears
  useEffect(() => {
    if (!gpsError) return;
    const id = setTimeout(() => checkGeolocation(), 4000);
    return () => clearTimeout(id);
  }, [gpsError, checkGeolocation]);

  const secondaryMetric = activityMode === 'cycling'
    ? { value: speed > 0 ? speed.toFixed(1) : '--', label: 'Speed (KM/H)' }
    : { value: pace > 0 ? pace.toFixed(1) : '--', label: 'Min/KM' };

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-background">
      {/* Full-Screen Map Base */}
      <div className="absolute inset-0 z-0">
        <MapContainer
          center={mapCenter}
          zoom={16}
          zoomControl={false}
          attributionControl={false}
          className="h-full w-full"
          style={{ background: '#0A0A0A' }}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
          <MapFollower position={currentPosition ? [currentPosition.lat, currentPosition.lng] : null} shouldFly={true} />
          {currentPosition && (
            <Marker position={[currentPosition.lat, currentPosition.lng]} icon={neonIcon} />
          )}
          {routeLatLngs.length > 1 && (
            <Polyline positions={routeLatLngs} pathOptions={{ color: '#CCFF00', weight: 4, opacity: 0.85 }} />
          )}
        </MapContainer>
      </div>

      {/* Floating Header */}
      <div className="absolute top-0 left-0 right-0 z-[1000] pt-14 pb-12 px-6 text-center pointer-events-none bg-gradient-to-b from-background/80 via-background/30 to-transparent">
        <p
          className="text-[9px] font-extrabold text-primary uppercase tracking-[0.4em]"
          style={{ textShadow: '0 0 12px rgba(204,255,0,0.6), 0 2px 6px rgba(0,0,0,0.8)' }}
        >
          GPS Live Tracking
        </p>
        <h1
          className="text-lg font-black text-foreground uppercase tracking-wider mt-1"
          style={{ textShadow: '0 2px 12px rgba(0,0,0,0.9)' }}
        >
          Route <span className="text-primary">Tracker</span>
        </h1>
      </div>

      {/* GPS Error toast */}
      <AnimatePresence>
        {gpsError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-32 left-4 right-4 z-[1000]"
          >
            <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-3 flex items-center gap-3 backdrop-blur-xl">
              <AlertTriangle size={14} className="text-destructive shrink-0" />
              <p className="flex-1 text-[10px] font-bold text-destructive">{gpsError}</p>
              <button
                onClick={handleRetryGPS}
                className="shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-destructive/20 border border-destructive/40 text-[9px] font-black text-destructive uppercase tracking-wider hover:bg-destructive/30 transition-colors"
              >
                <RotateCw size={10} /> Retry
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Glassmorphic Control Panel — lighter overlay, map visible underneath */}
      <div
        className="absolute left-0 right-0 z-[1000] rounded-t-[40px] border-t border-white/10 px-6 pt-5 space-y-4"
        style={{
          bottom: 'calc(6.5rem + env(safe-area-inset-bottom, 0px))',
          paddingBottom: '1.5rem',
          background: 'rgba(10, 10, 10, 0.5)',
          backdropFilter: 'blur(20px) saturate(150%)',
          WebkitBackdropFilter: 'blur(20px) saturate(150%)',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Drag handle */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/15" />

        {/* Activity Mode Toggle — locked while workout running */}
        <div className="relative flex items-center bg-black/40 border border-white/5 rounded-full p-1 backdrop-blur-xl">
          <motion.div
            layout
            transition={{ type: 'spring', stiffness: 400, damping: 32 }}
            className="absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-full bg-primary/15 border border-primary/30"
            style={{
              left: activityMode === 'walking' ? '4px' : 'calc(50% + 0px)',
              boxShadow: '0 0 20px rgba(204,255,0,0.25), inset 0 0 12px rgba(204,255,0,0.1)',
            }}
          />
          {(['walking', 'cycling'] as ActivityMode[]).map((mode) => {
            const Icon = mode === 'walking' ? Footprints : Bike;
            const active = activityMode === mode;
            const locked = workoutState !== 'idle';
            return (
              <button
                key={mode}
                onClick={() => !locked && setActivityMode(mode)}
                disabled={locked}
                className={`relative z-10 flex-1 py-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] transition-colors duration-300 ${
                  active ? 'text-primary' : 'text-muted-foreground'
                } ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={active ? { textShadow: '0 0 12px rgba(204,255,0,0.7)' } : {}}
              >
                <Icon size={14} />
                {mode}
              </button>
            );
          })}
        </div>

        {/* Dynamic Action Buttons — state machine */}
        <AnimatePresence mode="wait">
          {workoutState === 'idle' && (
            <motion.button
              key="start"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              whileTap={{ scale: 0.96 }}
              onClick={handleStart}
              className="w-full py-5 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3"
              style={{ boxShadow: '0 0 40px rgba(204,255,0,0.35), 0 8px 24px rgba(204,255,0,0.15)' }}
            >
              <Play size={20} fill="currentColor" /> Start Workout
            </motion.button>
          )}

          {workoutState === 'active' && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex gap-3"
            >
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handlePause}
                className="flex-1 py-5 rounded-2xl bg-white/10 border border-white/15 text-foreground font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 backdrop-blur-xl"
              >
                <Pause size={18} fill="currentColor" /> Pause
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleStop}
                className="flex-1 py-5 rounded-2xl bg-destructive/15 border border-destructive/40 text-destructive font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 backdrop-blur-xl"
              >
                <Square size={18} fill="currentColor" /> Stop
              </motion.button>
            </motion.div>
          )}

          {workoutState === 'paused' && (
            <motion.div
              key="paused"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-3"
            >
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleResume}
                disabled={isSaving}
                className="w-full py-4 rounded-2xl border border-primary/40 bg-primary/10 text-primary font-black text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-2 backdrop-blur-xl disabled:opacity-50"
              >
                <Play size={18} fill="currentColor" /> Resume
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleFinishAndSave}
                disabled={isSaving}
                className="w-full py-5 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-wait"
                style={{ boxShadow: '0 0 40px rgba(204,255,0,0.4), 0 8px 24px rgba(204,255,0,0.2)' }}
              >
                {isSaving ? (
                  <><Loader2 size={20} className="animate-spin" /> Saving…</>
                ) : (
                  <><Save size={20} /> Finish & Save Protocol</>
                )}
              </motion.button>
              <p className="text-[9px] font-bold text-muted-foreground text-center uppercase tracking-wider">
                {distance.toFixed(2)} km · {formatTime(elapsed)} · {caloriesBurned} kcal
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: Clock, value: formatTime(elapsed), label: 'Time', delay: 0.1 },
            { icon: Navigation, value: secondaryMetric.value, label: secondaryMetric.label, delay: 0.2 },
            { icon: Zap, value: distance.toFixed(2), label: 'KM', delay: 0.3 },
          ].map(m => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: m.delay }}
              className="px-2 py-3 rounded-2xl text-center bg-black/40 border border-white/10 backdrop-blur-xl"
            >
              <m.icon size={14} className="text-muted-foreground mx-auto mb-1.5" />
              <AnimatePresence mode="wait">
                <motion.p
                  key={m.value}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="text-2xl font-black text-foreground tabular-nums leading-tight"
                  style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
                >
                  {m.value}
                </motion.p>
              </AnimatePresence>
              <p className="text-[8px] font-extrabold text-muted-foreground uppercase tracking-wider mt-1">{m.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GPSTracker;
