import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Navigation2, MapPin, Loader2, Footprints, Bike, Volume2, VolumeX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface RouteData {
  polyline: [number, number][];
  steps: { instruction: string; maneuver: string; distanceMeters: number }[];
  distanceMeters: number;
  durationSec: number;
  destinationLabel: string;
}

interface Props {
  open: boolean;
  onClose: () => void;
  origin: { lat: number; lng: number } | null;
  onRoute: (route: RouteData | null) => void;
  voiceEnabled: boolean;
  onVoiceToggle: (v: boolean) => void;
}

interface PlaceSuggestion { placeId: string; text: string }

const GMAPS_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const GMAPS_TRACK = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

let gmapsLoading: Promise<void> | null = null;
function loadGoogleMaps(): Promise<void> {
  if (typeof window === 'undefined') return Promise.reject('no window');
  if ((window as any).google?.maps?.places) return Promise.resolve();
  if (gmapsLoading) return gmapsLoading;
  gmapsLoading = new Promise((resolve, reject) => {
    if (!GMAPS_KEY) { reject('Missing Google Maps browser key'); return; }
    (window as any).__hh_gmaps_cb = () => resolve();
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${GMAPS_KEY}&libraries=places&loading=async&callback=__hh_gmaps_cb${GMAPS_TRACK ? `&channel=${GMAPS_TRACK}` : ''}`;
    s.async = true; s.defer = true;
    s.onerror = () => reject('Failed to load Google Maps');
    document.head.appendChild(s);
  });
  return gmapsLoading;
}

const RoutePlannerDrawer: React.FC<Props> = ({ open, onClose, origin, onRoute, voiceEnabled, onVoiceToggle }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [mode, setMode] = useState<'WALK' | 'BICYCLE'>('WALK');
  const [loading, setLoading] = useState(false);
  const sessionTokenRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!open) return;
    loadGoogleMaps().catch((e) => console.warn('GMaps load failed', e));
  }, [open]);

  useEffect(() => {
    if (!open || !query || query.length < 2) { setSuggestions([]); return; }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const g = (window as any).google;
        if (!g?.maps?.places) return;
        const { AutocompleteSuggestion, AutocompleteSessionToken } = await g.maps.importLibrary('places');
        if (!sessionTokenRef.current) sessionTokenRef.current = new AutocompleteSessionToken();
        const { suggestions: sg } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          sessionToken: sessionTokenRef.current,
          ...(origin ? { locationBias: { center: { lat: origin.lat, lng: origin.lng }, radius: 30000 } } : {}),
        });
        const out: PlaceSuggestion[] = sg.slice(0, 6).map((s: any) => ({
          placeId: s.placePrediction?.placeId,
          text: s.placePrediction?.text?.text ?? '',
        })).filter((s: PlaceSuggestion) => s.placeId && s.text);
        setSuggestions(out);
      } catch (e) { console.warn(e); }
    }, 220);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, open, origin]);

  const handlePick = async (s: PlaceSuggestion) => {
    if (!origin) { toast.error('Waiting for GPS lock…'); return; }
    setLoading(true);
    try {
      const g = (window as any).google;
      const { Place } = await g.maps.importLibrary('places');
      const place = new Place({ id: s.placeId });
      await place.fetchFields({ fields: ['location', 'displayName'] });
      const loc = place.location;
      const dest = { lat: loc.lat(), lng: loc.lng() };
      const { data, error } = await supabase.functions.invoke('routes-directions', {
        body: { origin, destination: dest, travelMode: mode },
      });
      if (error || !data?.polyline) { throw new Error(error?.message ?? 'Route failed'); }
      onRoute({
        polyline: data.polyline,
        steps: data.steps ?? [],
        distanceMeters: data.distanceMeters,
        durationSec: data.durationSec,
        destinationLabel: s.text,
      });
      sessionTokenRef.current = null;
      toast.success(`Route ready · ${(data.distanceMeters / 1000).toFixed(2)} km`);
      onClose();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message ?? 'Failed to compute route');
    } finally { setLoading(false); }
  };

  const clearRoute = () => { onRoute(null); toast.info('Route cleared'); onClose(); };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[9998] bg-black/70 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: '-100%' }} animate={{ x: 0 }} exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            className="fixed top-0 left-0 bottom-0 z-[9999] w-[88%] max-w-sm flex flex-col border-r border-white/10"
            style={{
              background: 'linear-gradient(180deg, rgba(10,10,10,0.96), rgba(18,18,18,0.96))',
              backdropFilter: 'blur(24px) saturate(160%)',
              boxShadow: '8px 0 32px rgba(0,0,0,0.6)',
            }}
          >
            <div className="flex items-center justify-between px-5 pt-12 pb-4 border-b border-white/5">
              <div>
                <p className="text-[10px] font-extrabold text-primary uppercase tracking-[0.35em]"
                   style={{ textShadow: '0 0 12px rgba(204,255,0,0.55)' }}>Route Planner</p>
                <h2 className="text-2xl font-black uppercase tracking-tight text-foreground mt-0.5">Plan a path</h2>
              </div>
              <button onClick={onClose} aria-label="Close"
                className="w-10 h-10 rounded-xl flex items-center justify-center border border-white/10 bg-white/5 active:scale-95">
                <X size={18} className="text-foreground" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Mode toggle */}
              <div className="grid grid-cols-2 gap-2">
                {([['WALK', Footprints, 'Walk'], ['BICYCLE', Bike, 'Cycle']] as const).map(([m, Icon, label]) => {
                  const active = mode === m;
                  return (
                    <button key={m} onClick={() => setMode(m)}
                      className={`py-2.5 rounded-xl border text-[10px] font-black uppercase tracking-[0.25em] flex items-center justify-center gap-2 transition-all ${
                        active ? 'border-primary/50 bg-primary/10 text-primary' : 'border-white/10 bg-white/5 text-muted-foreground'
                      }`}
                      style={active ? { boxShadow: '0 0 18px rgba(204,255,0,0.25)' } : {}}>
                      <Icon size={14} /> {label}
                    </button>
                  );
                })}
              </div>

              {/* Origin pill */}
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5">
                <MapPin size={14} className="text-primary" />
                <span className="text-[11px] font-bold text-foreground tracking-wide">
                  {origin ? 'Current location' : 'Acquiring GPS…'}
                </span>
              </div>

              {/* Destination search */}
              <div className="relative">
                <Navigation2 size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary" />
                <input
                  value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search destination…"
                  className="w-full pl-9 pr-3 py-3 rounded-xl bg-black/40 border border-white/10 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              <div className="space-y-1.5">
                {suggestions.map((s) => (
                  <button key={s.placeId} onClick={() => handlePick(s)} disabled={loading}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-white/5 bg-white/[0.03] hover:bg-white/[0.06] active:scale-[0.99] transition-all flex items-start gap-2 disabled:opacity-50">
                    <MapPin size={12} className="text-primary mt-1 shrink-0" />
                    <span className="text-[12px] text-foreground leading-snug">{s.text}</span>
                  </button>
                ))}
                {loading && (
                  <div className="flex items-center justify-center py-3 text-primary">
                    <Loader2 size={16} className="animate-spin" />
                  </div>
                )}
              </div>

              {!GMAPS_KEY && (
                <p className="text-[10px] text-destructive">Google Maps key missing — connect it to enable search.</p>
              )}
            </div>

            <div className="px-5 py-4 border-t border-white/5 space-y-2">
              <button onClick={() => onVoiceToggle(!voiceEnabled)}
                className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl border border-white/10 bg-white/5">
                <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.25em] text-foreground">
                  {voiceEnabled ? <Volume2 size={14} className="text-primary" /> : <VolumeX size={14} className="text-muted-foreground" />}
                  Voice navigation
                </span>
                <span className={`text-[10px] font-black uppercase tracking-wider ${voiceEnabled ? 'text-primary' : 'text-muted-foreground'}`}>
                  {voiceEnabled ? 'On' : 'Off'}
                </span>
              </button>
              <button onClick={clearRoute}
                className="w-full py-2.5 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-[10px] font-black uppercase tracking-[0.25em]">
                Clear Route
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default RoutePlannerDrawer;
