import React, { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Square, Clock, Navigation, MapPin,
  AlertTriangle, Footprints, Bike, RotateCw, Save, Loader2,
  Menu, Crosshair, Compass,
} from 'lucide-react';
import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { toast } from 'sonner';
import CharacterMarker from './CharacterMarker';
import RoutePlannerDrawer, { RouteData } from './RoutePlannerDrawer';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface GeoPoint {
  lat: number;
  lng: number;
  timestamp: number;
}

type ActivityMode = 'walking' | 'cycling';
type WorkoutState = 'idle' | 'active' | 'paused';

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

// Compute bearing (deg, 0=N, clockwise) between two geo points.
const computeBearing = (a: GeoPoint, b: GeoPoint): number => {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
            Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

const MapFollower: React.FC<{ position: [number, number] | null; shouldFly?: boolean; recenterTrigger?: number }> = ({
  position, shouldFly, recenterTrigger,
}) => {
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

  useEffect(() => {
    if (recenterTrigger && position) {
      map.flyTo(position, 17, { duration: 1.2 });
    }
  }, [recenterTrigger, position, map]);

  return null;
};

const GPSTracker: React.FC<GPSTrackerProps> = ({ onWorkoutSave }) => {
  const [workoutState, setWorkoutState] = useState<WorkoutState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [distance, setDistance] = useState(0);
  const [points, setPoints] = useState<GeoPoint[]>([]);
  const [currentPosition, setCurrentPosition] = useState<GeoPoint | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [activityMode, setActivityMode] = useState<ActivityMode>('walking');
  const [isSaving, setIsSaving] = useState(false);
  const [recenterTrigger, setRecenterTrigger] = useState(0);
  const [bearing, setBearing] = useState<number>(0);
  const [profileBits, setProfileBits] = useState<{ gender?: string | null; avatar_url?: string | null }>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [plannedRoute, setPlannedRoute] = useState<RouteData | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [followHeading, setFollowHeading] = useState(false);
  const lastSpokenStepRef = useRef<number>(-1);

  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('gender, avatar_url')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setProfileBits(data); });
    return () => { cancelled = true; };
  }, [user]);

  const watchIdRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastPointRef = useRef<GeoPoint | null>(null);
  const isPausedRef = useRef(false);
  isPausedRef.current = workoutState === 'paused';

  const pace = elapsed > 0 && distance > 0.01 ? (elapsed / 60) / distance : 0;
  const speed = elapsed > 0 && distance > 0.01 ? distance / (elapsed / 3600) : 0;
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

        // Capture device heading if available; otherwise derive bearing from last point.
        const devHeading = pos.coords.heading;
        if (typeof devHeading === 'number' && !Number.isNaN(devHeading)) {
          setBearing(devHeading);
        } else if (lastPointRef.current) {
          const d = haversineDistance(lastPointRef.current, point);
          if (d > 0.003) setBearing(computeBearing(lastPointRef.current, point));
        }

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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
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

  useEffect(() => () => { stopGPS(); stopTimer(); }, [stopGPS, stopTimer]);

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
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 5000 }
    );
  }, []);

  const handleRetryGPS = useCallback(() => {
    toast.info('Retrying GPS…');
    checkGeolocation();
    if (workoutState !== 'idle') { stopGPS(); startGPS(); }
  }, [checkGeolocation, workoutState, startGPS, stopGPS]);

  useEffect(() => { checkGeolocation(); }, [checkGeolocation]);

  useEffect(() => {
    if (!gpsError) return;
    const id = setTimeout(() => checkGeolocation(), 4000);
    return () => clearTimeout(id);
  }, [gpsError, checkGeolocation]);

  const secondaryMetric = activityMode === 'cycling'
    ? { value: speed > 0 ? speed.toFixed(1) : '--:--', label: 'KM/H' }
    : { value: pace > 0 ? pace.toFixed(1) : '--:--', label: 'MIN/KM' };

  const gpsLive = !gpsError && currentPosition !== null;

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#0A0A0A]">
      {/* ============ LAYER 1 — MAP ============ */}
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
          <MapFollower
            position={currentPosition ? [currentPosition.lat, currentPosition.lng] : null}
            shouldFly={true}
            recenterTrigger={recenterTrigger}
          />
          {currentPosition && (
            <CharacterMarker
              position={currentPosition}
              bearing={bearing}
              mode={activityMode}
              gender={profileBits.gender}
              avatarUrl={profileBits.avatar_url}
              isMoving={workoutState === 'active'}
            />
          )}
          {routeLatLngs.length > 1 && (
            <>
              {/* Outer glow */}
              <Polyline
                positions={routeLatLngs}
                pathOptions={{ color: '#CCFF00', weight: 12, opacity: 0.18, lineCap: 'round', lineJoin: 'round' }}
              />
              {/* Core line */}
              <Polyline
                positions={routeLatLngs}
                pathOptions={{ color: '#CCFF00', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* Recenter / crosshair FAB — middle-right */}
      <button
        onClick={() => setRecenterTrigger(t => t + 1)}
        aria-label="Recenter map"
        className="absolute right-4 top-1/2 -translate-y-1/2 z-[1000] w-12 h-12 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-xl transition-all active:scale-95"
        style={{
          background: 'rgba(10,10,10,0.6)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
        }}
      >
        <Crosshair size={20} className="text-primary" style={{ filter: 'drop-shadow(0 0 6px rgba(204,255,0,0.6))' }} />
      </button>

      {/* ============ LAYER 2 — TOP HEADER ============ */}
      <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none">
        {/* Fading gradient for readability */}
        <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#0A0A0A]/85 via-[#0A0A0A]/40 to-transparent" />

        <div className="relative pt-12 px-5">
          {/* Top row — menu + GPS pill */}
          <div className="flex items-center justify-between pointer-events-auto">
            <button
              aria-label="Menu"
              className="w-11 h-11 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-xl active:scale-95 transition-all"
              style={{ background: 'rgba(10,10,10,0.55)' }}
            >
              <Menu size={18} className="text-foreground" />
            </button>

            <div
              className="flex items-center gap-2 pl-3 pr-3.5 py-1.5 rounded-full border border-white/10 backdrop-blur-xl"
              style={{ background: 'rgba(10,10,10,0.6)' }}
            >
              <span className="relative flex w-2 h-2">
                {gpsLive && (
                  <span className="absolute inline-flex w-full h-full rounded-full bg-primary opacity-60 animate-ping" />
                )}
                <span className={`relative inline-flex w-2 h-2 rounded-full ${gpsLive ? 'bg-primary' : 'bg-destructive'}`}
                  style={gpsLive ? { boxShadow: '0 0 8px rgba(204,255,0,0.9)' } : {}} />
              </span>
              <span className="text-[10px] font-black text-foreground uppercase tracking-[0.2em]">GPS</span>
            </div>
          </div>

          {/* Title stack */}
          <div className="mt-6">
            <p
              className="text-[10px] font-extrabold text-primary uppercase tracking-[0.4em]"
              style={{ textShadow: '0 0 12px rgba(204,255,0,0.55), 0 2px 6px rgba(0,0,0,0.9)' }}
            >
              GPS Live Tracking
            </p>
            <h1
              className="mt-1.5 text-[40px] leading-[0.95] font-black uppercase tracking-tight"
              style={{ textShadow: '0 4px 20px rgba(0,0,0,0.9)' }}
            >
              <span className="text-foreground">Route </span>
              <span className="text-primary" style={{ textShadow: '0 0 24px rgba(204,255,0,0.45)' }}>Tracker</span>
            </h1>
            <p className="mt-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-[0.25em]">
              Track. Improve. Achieve.
            </p>
          </div>
        </div>
      </div>

      {/* GPS Error toast */}
      <AnimatePresence>
        {gpsError && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-44 left-4 right-4 z-[1001]"
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

      {/* ============ LAYER 3 — CONTROL PANEL ============ */}
      <div
        className="absolute left-3 right-3 z-[1000] mx-auto max-w-md rounded-[1.5rem] border border-white/5 p-3 space-y-2.5"
        style={{
          bottom: 'calc(6.25rem + env(safe-area-inset-bottom, 0px))',
          background: 'rgba(18, 18, 18, 0.92)',
          backdropFilter: 'blur(24px) saturate(160%)',
          WebkitBackdropFilter: 'blur(24px) saturate(160%)',
          boxShadow: '0 -10px 40px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
        }}
      >
        {/* 1. Activity Toggle — pill with vertical divider */}
        <div
          className="relative grid grid-cols-2 rounded-full border border-white/10 overflow-hidden"
          style={{ background: 'rgba(0,0,0,0.4)' }}
        >
          {/* center divider */}
          <span className="pointer-events-none absolute top-1.5 bottom-1.5 left-1/2 w-px bg-white/10" />

          {(['walking', 'cycling'] as ActivityMode[]).map((mode) => {
            const Icon = mode === 'walking' ? Footprints : Bike;
            const active = activityMode === mode;
            const locked = workoutState !== 'idle';
            return (
              <button
                key={mode}
                onClick={() => !locked && setActivityMode(mode)}
                disabled={locked}
                className={`relative py-2 flex items-center justify-center gap-1.5 text-[9px] font-black uppercase tracking-[0.3em] transition-colors ${
                  active ? 'text-primary' : 'text-muted-foreground'
                } ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={
                  active
                    ? {
                        background:
                          mode === 'walking'
                            ? 'linear-gradient(90deg, rgba(204,255,0,0.14) 0%, rgba(204,255,0,0.02) 100%)'
                            : 'linear-gradient(270deg, rgba(204,255,0,0.14) 0%, rgba(204,255,0,0.02) 100%)',
                        textShadow: '0 0 12px rgba(204,255,0,0.6)',
                      }
                    : {}
                }
              >
                <Icon size={13} strokeWidth={active ? 2.5 : 2} />
                {mode}
              </button>
            );
          })}
        </div>

        {/* 2. Action buttons — state machine */}
        <AnimatePresence mode="wait">
          {workoutState === 'idle' && (
            <motion.button
              key="start"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              whileTap={{ scale: 0.97 }}
              onClick={handleStart}
              className="w-full rounded-xl bg-primary text-primary-foreground py-2.5 flex flex-col items-center justify-center gap-0"
              style={{ boxShadow: '0 0 36px rgba(204,255,0,0.45), 0 8px 22px rgba(204,255,0,0.18)' }}
            >
              <span className="flex items-center gap-2">
                <Play size={15} fill="currentColor" />
                <span className="text-[11px] font-black uppercase tracking-[0.3em]">Start Workout</span>
              </span>
              <span className="text-[8px] font-bold uppercase tracking-[0.2em] opacity-70">
                Let's get moving!
              </span>
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
                className="flex-1 py-4 rounded-2xl bg-white/10 border border-white/15 text-foreground font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 backdrop-blur-xl"
              >
                <Pause size={18} fill="currentColor" /> Pause
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleStop}
                className="flex-1 py-4 rounded-2xl bg-destructive/15 border border-destructive/40 text-destructive font-black text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 backdrop-blur-xl"
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
                className="w-full py-3.5 rounded-2xl border border-primary/40 bg-primary/10 text-primary font-black text-xs uppercase tracking-[0.25em] flex items-center justify-center gap-2 backdrop-blur-xl disabled:opacity-50"
              >
                <Play size={18} fill="currentColor" /> Resume
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleFinishAndSave}
                disabled={isSaving}
                className="w-full py-4 rounded-2xl bg-primary text-primary-foreground font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-wait"
                style={{ boxShadow: '0 0 40px rgba(204,255,0,0.45), 0 8px 24px rgba(204,255,0,0.2)' }}
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

        {/* 3. Metrics Grid — 3 square cards */}
        <div className="grid grid-cols-3 gap-1.5">
          {[
            { Icon: Clock, value: formatTime(elapsed), label: 'Time' },
            { Icon: Navigation, value: secondaryMetric.value, label: secondaryMetric.label },
            { Icon: MapPin, value: distance.toFixed(2), label: 'KM' },
          ].map((m, i) => (
            <motion.div
              key={m.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 + i * 0.06 }}
              className="rounded-xl border border-white/5 flex flex-col items-center justify-center p-2"
              style={{ background: 'rgba(24,24,27,0.55)' }}
            >
              <m.Icon
                size={12}
                className="text-primary mb-1"
                style={{ filter: 'drop-shadow(0 0 6px rgba(204,255,0,0.45))' }}
              />
              <AnimatePresence mode="wait">
                <motion.p
                  key={m.value}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                  className="text-base leading-none font-black text-foreground tabular-nums"
                  style={{ textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}
                >
                  {m.value}
                </motion.p>
              </AnimatePresence>
              <p className="mt-1 text-[7px] font-extrabold text-muted-foreground uppercase tracking-[0.18em]">
                {m.label}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GPSTracker;
