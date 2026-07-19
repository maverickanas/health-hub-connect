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
import { startWatch, stopWatch, getCurrent, type GeoWatcherId } from '@/lib/backgroundGeo';
import LocationPermissionSheet from './LocationPermissionSheet';

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
  const [profileBits, setProfileBits] = useState<{ gender?: string | null; avatar_url?: string | null; height?: number | null; weight?: number | null; age?: number | null }>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [plannedRoute, setPlannedRoute] = useState<RouteData | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [followHeading, setFollowHeading] = useState(false);
  const [showPermissionSheet, setShowPermissionSheet] = useState(false);
  const lastSpokenStepRef = useRef<number>(-1);

  const { user } = useAuth();
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('gender, avatar_url, height, weight, age')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled && data) setProfileBits(data as any); });
    return () => { cancelled = true; };
  }, [user]);

  const watchIdRef = useRef<GeoWatcherId | null>(null);
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

  const startGPS = useCallback(async () => {
    setGpsError(null);
    const id = await startWatch(
      (sample) => {
        const point: GeoPoint = {
          lat: sample.latitude,
          lng: sample.longitude,
          timestamp: sample.timestamp,
        };
        setCurrentPosition(point);

        // Capture device heading if available; otherwise derive bearing from last point.
        const devHeading = sample.heading;
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
              setDistance((prev) => prev + d);
              setPoints((prev) => [...prev, point]);
            }
          } else {
            setPoints([point]);
          }
          lastPointRef.current = point;
        }
      },
      (err) => {
        if (err.code === 'permission') {
          setGpsError('Location access denied. Please enable GPS.');
          toast.error('Please allow location access');
        } else if (err.code === 'unavailable') {
          setGpsError('GPS unavailable');
        } else if (err.code === 'timeout') {
          setGpsError('GPS timeout — move to open area');
        } else {
          setGpsError(err.message || 'GPS error');
        }
      },
    );
    watchIdRef.current = id;
  }, [activityMode]);

  const stopGPS = useCallback(async () => {
    if (watchIdRef.current !== null) {
      await stopWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => setElapsed(prev => prev + 1), 1000);
  }, []);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const beginWorkout = () => {
    setWorkoutState('active');
    setElapsed(0); setDistance(0); setPoints([]); lastPointRef.current = null;
    startGPS(); startTimer();
  };

  const handleStart = () => {
    // Show the in-app rationale BEFORE we trigger the OS prompt. If the user
    // has already granted location, the sheet still confirms intent in 1 tap.
    if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
      (navigator.permissions as any)
        .query({ name: 'geolocation' })
        .then((res: PermissionStatus) => {
          if (res.state === 'granted') beginWorkout();
          else setShowPermissionSheet(true);
        })
        .catch(() => setShowPermissionSheet(true));
    } else {
      setShowPermissionSheet(true);
    }
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

  const checkGeolocation = useCallback(async () => {
    try {
      const sample = await getCurrent();
      setCurrentPosition({ lat: sample.latitude, lng: sample.longitude, timestamp: sample.timestamp });
      setGpsError(null);
    } catch (err: any) {
      if (err?.code === 'permission') setGpsError('Location access denied. Please enable GPS.');
      else if (err?.code === 'unavailable') setGpsError('GPS unavailable');
      else setGpsError('GPS timeout — move to open area');
    }
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

  // Voice navigation: announce next turn step as user progresses.
  useEffect(() => {
    if (!voiceEnabled || !plannedRoute || !currentPosition) return;
    const steps = plannedRoute.steps;
    if (!steps?.length) return;
    // Find the step whose polyline start is closest to current position.
    let nearestIdx = 0; let nearestD = Infinity;
    plannedRoute.polyline.forEach(([la, ln], idx) => {
      const dx = la - currentPosition.lat, dy = ln - currentPosition.lng;
      const d = dx * dx + dy * dy;
      if (d < nearestD) { nearestD = d; nearestIdx = idx; }
    });
    // Map polyline index → step index proportionally.
    const stepIdx = Math.min(steps.length - 1, Math.floor((nearestIdx / Math.max(1, plannedRoute.polyline.length - 1)) * steps.length));
    if (stepIdx !== lastSpokenStepRef.current && steps[stepIdx]?.instruction) {
      lastSpokenStepRef.current = stepIdx;
      try {
        const u = new SpeechSynthesisUtterance(steps[stepIdx].instruction);
        u.rate = 1; u.pitch = 1; u.lang = 'en-US';
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      } catch {}
    }
  }, [voiceEnabled, plannedRoute, currentPosition]);

  // Reset step tracking when route changes
  useEffect(() => { lastSpokenStepRef.current = -1; }, [plannedRoute]);

  // CSS rotation for "follow heading" — counter-rotate to keep travel direction up.
  const mapRotation = followHeading ? -bearing : 0;

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#0A0A0A]">
      {/* ============ LAYER 1 — MAP ============ */}
      <div
        className="absolute inset-0 z-0 transition-transform duration-500 ease-out"
        style={{ transform: `rotate(${mapRotation}deg)`, transformOrigin: 'center' }}
      >
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

          {/* Planned navigation route (cyan) */}
          {plannedRoute && plannedRoute.polyline.length > 1 && (
            <>
              <Polyline
                positions={plannedRoute.polyline}
                pathOptions={{ color: '#00E5FF', weight: 12, opacity: 0.18, lineCap: 'round', lineJoin: 'round' }}
              />
              <Polyline
                positions={plannedRoute.polyline}
                pathOptions={{ color: '#00E5FF', weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round', dashArray: '1 8' }}
              />
            </>
          )}

          {/* Actual workout trail (lime) */}
          {routeLatLngs.length > 1 && (
            <>
              <Polyline
                positions={routeLatLngs}
                pathOptions={{ color: '#CCFF00', weight: 12, opacity: 0.18, lineCap: 'round', lineJoin: 'round' }}
              />
              <Polyline
                positions={routeLatLngs}
                pathOptions={{ color: '#CCFF00', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }}
              />
            </>
          )}
        </MapContainer>
      </div>

      {/* Heavy dark gradient over lower half of the map so bottom sheet reads cleanly */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 z-[500] bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/80 to-transparent" />

      {/* Right-side FAB stack: recenter + compass */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 z-[1000] flex flex-col gap-2.5">
        <button
          onClick={() => setRecenterTrigger(t => t + 1)}
          aria-label="Recenter map"
          className="w-11 h-11 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-xl bg-[#0A0A0A]/70 active:scale-95 transition-all"
        >
          <Crosshair size={18} className="text-primary" />
        </button>
        <button
          onClick={() => setFollowHeading(v => !v)}
          aria-label="Toggle compass follow"
          className={`w-11 h-11 rounded-2xl flex items-center justify-center border backdrop-blur-xl transition-all active:scale-95 ${
            followHeading ? 'border-primary/60 bg-primary/15' : 'border-white/10 bg-[#0A0A0A]/70'
          }`}
        >
          <Compass
            size={18}
            className={followHeading ? 'text-primary' : 'text-foreground'}
            style={{ transform: `rotate(${followHeading ? 0 : -bearing}deg)`, transition: 'transform 0.4s ease-out' }}
          />
        </button>
      </div>

      {/* ============ LAYER 2 — TOP HEADER ============ */}
      <div className="absolute top-0 left-0 right-0 z-[1000] pointer-events-none">
        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-[#0A0A0A]/85 via-[#0A0A0A]/40 to-transparent" />

        <div className="relative pt-12 px-5">
          {/* Top row — menu + GPS pill */}
          <div className="flex items-center justify-between pointer-events-auto">
            <button
              aria-label="Open route planner"
              onClick={() => setDrawerOpen(true)}
              className="w-10 h-10 rounded-2xl flex items-center justify-center border border-white/10 backdrop-blur-xl bg-[#0A0A0A]/60 active:scale-95 transition-all"
            >
              <Menu size={16} className="text-foreground" />
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-xl bg-[#0A0A0A]/60">
              <span className="relative flex w-1.5 h-1.5">
                {gpsLive && (
                  <span className="absolute inline-flex w-full h-full rounded-full bg-primary opacity-60 animate-ping" />
                )}
                <span className={`relative inline-flex w-1.5 h-1.5 rounded-full ${gpsLive ? 'bg-primary' : 'bg-destructive'}`} />
              </span>
              <span className="text-[9px] font-black text-foreground uppercase tracking-[0.2em]">GPS</span>
            </div>
          </div>

          {/* Sleek title */}
          <div className="mt-5">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Route <span className="text-primary">Tracker</span>
            </h1>
          </div>

          {/* Compact biometrics pill */}
          {(profileBits.height || profileBits.weight || profileBits.age) && (
            <div className="mt-3 pointer-events-auto inline-flex items-center gap-3 bg-[#0F0F0F] border border-white/10 rounded-full px-4 py-2 text-xs text-zinc-500">
              {profileBits.height ? <span><span className="text-zinc-300 font-semibold">{profileBits.height}</span> cm</span> : null}
              {profileBits.weight ? <span><span className="text-zinc-300 font-semibold">{profileBits.weight}</span> kg</span> : null}
              {profileBits.age ? <span><span className="text-zinc-300 font-semibold">{profileBits.age}</span> yr</span> : null}
            </div>
          )}
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

      {/* ============ LAYER 3 — UNIFIED BOTTOM SHEET ============ */}
      <div
        className="absolute left-0 right-0 z-[1000] bg-[#0A0A0A]/95 backdrop-blur-xl border-t border-white/10 rounded-t-3xl p-6 pb-8 space-y-4"
        style={{
          bottom: 'calc(5rem + env(safe-area-inset-bottom, 0px))',
        }}
      >
        {/* 1. Activity Toggle — sleek pill */}
        <div className="bg-white/5 p-1 rounded-full flex">
          {(['walking', 'cycling'] as ActivityMode[]).map((mode) => {
            const Icon = mode === 'walking' ? Footprints : Bike;
            const active = activityMode === mode;
            const locked = workoutState !== 'idle';
            return (
              <button
                key={mode}
                onClick={() => !locked && setActivityMode(mode)}
                disabled={locked}
                className={`flex-1 py-2.5 rounded-full flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                  active ? 'bg-[#CCFF00] text-black' : 'text-zinc-400'
                } ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                <Icon size={14} strokeWidth={2.2} />
                {mode}
              </button>
            );
          })}
        </div>

        {/* 2. Primary action — state machine */}
        <AnimatePresence mode="wait">
          {workoutState === 'idle' && (
            <motion.button
              key="start"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStart}
              className="w-full bg-[#CCFF00] text-black h-14 rounded-xl font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2"
            >
              <Play size={16} fill="currentColor" />
              Start Workout
            </motion.button>
          )}

          {workoutState === 'active' && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="flex gap-3"
            >
              <button
                onClick={handlePause}
                className="flex-1 h-14 rounded-xl bg-white/5 border border-white/10 text-foreground font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Pause size={16} fill="currentColor" /> Pause
              </button>
              <button
                onClick={handleStop}
                className="flex-1 h-14 rounded-xl bg-white/5 border border-destructive/40 text-destructive font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Square size={16} fill="currentColor" /> Stop
              </button>
            </motion.div>
          )}

          {workoutState === 'paused' && (
            <motion.div
              key="paused"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-2.5"
            >
              <button
                onClick={handleResume}
                disabled={isSaving}
                className="w-full h-12 rounded-xl border border-white/10 bg-white/5 text-foreground font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Play size={16} fill="currentColor" /> Resume
              </button>
              <button
                onClick={handleFinishAndSave}
                disabled={isSaving}
                className="w-full h-14 rounded-xl bg-[#CCFF00] text-black font-bold text-sm uppercase tracking-wider flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-wait"
              >
                {isSaving ? (
                  <><Loader2 size={18} className="animate-spin" /> Saving…</>
                ) : (
                  <><Save size={18} /> Finish & Save</>
                )}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. Metrics Grid — clean 3-col */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { value: formatTime(elapsed), label: 'Time' },
            { value: secondaryMetric.value, label: secondaryMetric.label },
            { value: distance.toFixed(2), label: 'KM' },
          ].map((m) => (
            <div
              key={m.label}
              className="bg-white/5 border border-white/5 rounded-xl p-3 flex flex-col items-center justify-center"
            >
              <p className="text-lg leading-none font-bold text-white tabular-nums">
                {m.value}
              </p>
              <p className="mt-1.5 text-zinc-400 text-xs uppercase tracking-wider">
                {m.label}
              </p>
            </div>
          ))}
        </div>
      </div>


      {/* Route planner drawer */}
      <RoutePlannerDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        origin={currentPosition ? { lat: currentPosition.lat, lng: currentPosition.lng } : null}
        onRoute={setPlannedRoute}
        voiceEnabled={voiceEnabled}
        onVoiceToggle={setVoiceEnabled}
      />

      {/* Planned route summary chip */}
      {plannedRoute && (
        <div className="absolute left-3 right-3 z-[1000] mx-auto max-w-md"
             style={{ top: 'calc(8.5rem + env(safe-area-inset-top, 0px))' }}>
          <div className="rounded-2xl border border-cyan-400/30 px-3 py-2 flex items-center gap-2 backdrop-blur-xl"
               style={{ background: 'rgba(0,229,255,0.08)', boxShadow: '0 0 24px rgba(0,229,255,0.15)' }}>
            <Navigation size={14} className="text-cyan-300 shrink-0"
                        style={{ filter: 'drop-shadow(0 0 6px rgba(0,229,255,0.6))' }} />
            <p className="flex-1 text-[10px] font-bold text-foreground truncate uppercase tracking-wider">
              {plannedRoute.destinationLabel}
            </p>
            <span className="text-[10px] font-black text-cyan-300 tracking-wider">
              {(plannedRoute.distanceMeters / 1000).toFixed(2)} KM
            </span>
            <button onClick={() => setPlannedRoute(null)}
                    className="text-[9px] font-black text-muted-foreground hover:text-destructive uppercase tracking-wider ml-1">
              Clear
            </button>
          </div>
        </div>
      )}

      {/* On-demand location permission rationale */}
      <LocationPermissionSheet
        open={showPermissionSheet}
        onClose={() => setShowPermissionSheet(false)}
        onGranted={async () => {
          // Triggers the OS prompt (web: getCurrentPosition; native: addWatcher).
          try {
            await getCurrent();
          } catch {
            // Even if prompt is denied, we still try to start — startGPS will surface
            // a precise error message in the GPS error banner.
          }
          beginWorkout();
        }}
      />
    </div>
  );
};

export default GPSTracker;
