import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, Square, Clock, Navigation, Zap, Trophy, AlertTriangle, Footprints, Bike } from 'lucide-react';
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

const GPSTracker: React.FC<GPSTrackerProps> = ({ onWorkoutSave }) => {
  const [isTracking, setIsTracking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [workoutDone, setWorkoutDone] = useState(false);
  const [activityMode, setActivityMode] = useState<ActivityMode>('walking');

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPointRef = useRef<GeoPoint | null>(null);

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
        if (!isPaused) {
          if (lastPointRef.current) {
            const d = haversineDistance(lastPointRef.current, point);
            // Cycling allows larger jumps between points
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
  }, [isPaused, activityMode]);

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
    setIsTracking(true); setIsPaused(false); setWorkoutDone(false);
    setElapsed(0); setDistance(0); setPoints([]); lastPointRef.current = null;
    startGPS(); startTimer();
  };

  const handlePause = () => { setIsPaused(true); stopTimer(); };
  const handleResume = () => { setIsPaused(false); lastPointRef.current = null; startTimer(); };

  const handleStop = () => {
    stopGPS(); stopTimer(); setIsTracking(false); setIsPaused(false);
    if (distance > 0.01 || elapsed > 10) {
      setWorkoutDone(true);
      toast.success(`Workout complete! ${distance.toFixed(2)} km in ${formatTime(elapsed)}`);
    }
  };

  const handleSaveWorkout = () => {
    if (onWorkoutSave) {
      onWorkoutSave(distance, caloriesBurned, elapsed);
      toast.success('Workout saved & synced to dashboard!');
    }
    setWorkoutDone(false); setElapsed(0); setDistance(0); setPoints([]);
    lastPointRef.current = null; setCurrentPosition(null);
  };

  const handleReset = () => {
    setWorkoutDone(false); setElapsed(0); setDistance(0); setPoints([]);
    lastPointRef.current = null; setCurrentPosition(null);
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
    if (isTracking) {
      stopGPS();
      startGPS();
    }
  }, [checkGeolocation, isTracking, startGPS, stopGPS]);

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
      {gpsError && (
        <div className="absolute top-32 left-4 right-4 z-[1000]">
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-3 flex items-center gap-3 backdrop-blur-xl">
            <AlertTriangle size={14} className="text-destructive shrink-0" />
            <p className="text-[10px] font-bold text-destructive">{gpsError}</p>
          </div>
        </div>
      )}

      {/* Floating Glassmorphic Control Panel */}
      <div
        className="absolute bottom-20 left-0 right-0 z-[1000] rounded-t-[40px] border-t border-white/10 px-6 pt-5 pb-6 space-y-4"
        style={{
          background: 'rgba(10, 10, 10, 0.4)',
          backdropFilter: 'blur(28px) saturate(160%)',
          WebkitBackdropFilter: 'blur(28px) saturate(160%)',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.06)',
        }}
      >
        {/* Drag handle */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-white/15" />

        {/* Activity Mode Toggle */}
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
            return (
              <button
                key={mode}
                onClick={() => !isTracking && setActivityMode(mode)}
                disabled={isTracking}
                className={`relative z-10 flex-1 py-2.5 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] transition-colors duration-300 ${
                  active ? 'text-primary' : 'text-muted-foreground'
                } ${isTracking ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={active ? { textShadow: '0 0 12px rgba(204,255,0,0.7)' } : {}}
              >
                <Icon size={14} />
                {mode}
              </button>
            );
          })}
        </div>

        {/* Workout Complete Card */}
        <AnimatePresence>
          {workoutDone && !isTracking && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="rounded-2xl p-4 space-y-3 bg-black/40 border border-primary/20 backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <Trophy size={20} className="text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-xs font-black text-foreground uppercase">Workout Complete!</p>
                  <p className="text-[10px] text-muted-foreground">
                    {distance.toFixed(2)} km · {formatTime(elapsed)} · {caloriesBurned} kcal
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleReset}
                  className="flex-1 py-3 rounded-xl border border-white/10 text-[9px] font-bold text-muted-foreground uppercase tracking-wider"
                >
                  Discard
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  onClick={handleSaveWorkout}
                  className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-[9px] font-bold uppercase tracking-wider shadow-[0_0_20px_rgba(204,255,0,0.3)]"
                >
                  Save & Sync
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Primary Action */}
        {!isTracking && !workoutDone && (
          <motion.button
            whileTap={{ scale: 0.96 }}
            onClick={handleStart}
            className="w-full py-5 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3"
            style={{ boxShadow: '0 0 40px rgba(204,255,0,0.35), 0 8px 24px rgba(204,255,0,0.15)' }}
          >
            <Play size={20} fill="currentColor" /> Start Workout
          </motion.button>
        )}

        {isTracking && (
          <div className="flex gap-3">
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={isPaused ? handleResume : handlePause}
              className="flex-1 py-5 rounded-2xl border border-primary/30 bg-primary/5 text-primary font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 backdrop-blur-xl"
            >
              {isPaused ? <Play size={18} fill="currentColor" /> : <Pause size={18} fill="currentColor" />}
              {isPaused ? 'Resume' : 'Pause'}
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={handleStop}
              className="flex-1 py-5 rounded-2xl bg-destructive/15 border border-destructive/30 text-destructive font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 backdrop-blur-xl"
            >
              <Square size={18} fill="currentColor" /> Stop
            </motion.button>
          </div>
        )}

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
              className="p-4 rounded-2xl text-center bg-black/30 border border-white/5 backdrop-blur-xl"
            >
              <m.icon size={16} className="text-muted-foreground mx-auto mb-2" />
              <AnimatePresence mode="wait">
                <motion.p
                  key={m.value}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2 }}
                  className="text-xl font-black text-foreground"
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
