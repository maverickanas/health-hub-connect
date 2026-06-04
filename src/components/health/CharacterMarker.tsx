import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMap } from 'react-leaflet';
import Lottie from 'lottie-react';

type Mode = 'walking' | 'cycling';
type Gender = 'Male' | 'Female' | 'Other' | string | null | undefined;

interface CharacterMarkerProps {
  position: { lat: number; lng: number } | null;
  bearing?: number | null;        // degrees, 0 = north, clockwise
  mode: Mode;
  gender?: Gender;
  isMoving?: boolean;
  avatarUrl?: string | null;
}

// Curated, lightweight public Lottie animations (LottieFiles CDN).
// Different files per gender for personalization.
const LOTTIE_URLS: Record<Mode, { Male: string; Female: string }> = {
  walking: {
    Male:   'https://assets2.lottiefiles.com/packages/lf20_x62chJ.json',
    Female: 'https://assets9.lottiefiles.com/packages/lf20_ystsffqy.json',
  },
  cycling: {
    Male:   'https://assets10.lottiefiles.com/packages/lf20_kkflmtur.json',
    Female: 'https://assets10.lottiefiles.com/packages/lf20_kkflmtur.json',
  },
};

const animationCache = new Map<string, unknown>();

const fetchAnimation = async (url: string): Promise<unknown | null> => {
  if (animationCache.has(url)) return animationCache.get(url)!;
  try {
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) return null;
    const json = await res.json();
    animationCache.set(url, json);
    return json;
  } catch {
    return null;
  }
};

const pickUrl = (mode: Mode, gender: Gender): string => {
  const g = (gender === 'Female') ? 'Female' : 'Male';
  return LOTTIE_URLS[mode][g];
};

/**
 * CharacterMarker — overlays an animated Lottie character at the user's GPS
 * coordinate on top of the Leaflet map canvas. Rotates with travel bearing,
 * pulses a Neon Lime aura, and falls back to an animated emoji if the Lottie
 * JSON fails to load (offline / CORS).
 *
 * Render this *inside* <MapContainer> so it can subscribe to the map.
 */
const CharacterMarker: React.FC<CharacterMarkerProps> = ({
  position,
  bearing,
  mode,
  gender,
  isMoving = false,
  avatarUrl,
}) => {
  const map = useMap();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [animation, setAnimation] = useState<unknown | null>(null);
  const url = useMemo(() => pickUrl(mode, gender), [mode, gender]);

  // Fetch the right Lottie when mode/gender change.
  useEffect(() => {
    let cancelled = false;
    setAnimation(null);
    fetchAnimation(url).then(json => { if (!cancelled) setAnimation(json); });
    return () => { cancelled = true; };
  }, [url]);

  // Reposition the overlay whenever the map moves or the position updates.
  useEffect(() => {
    if (!position) return;
    const place = () => {
      if (!containerRef.current) return;
      const pt = map.latLngToContainerPoint([position.lat, position.lng]);
      containerRef.current.style.transform = `translate3d(${pt.x}px, ${pt.y}px, 0) translate(-50%, -50%)`;
    };
    place();
    map.on('move zoom viewreset moveend zoomend', place);
    return () => { map.off('move zoom viewreset moveend zoomend', place); };
  }, [map, position]);

  if (!position) return null;

  // Normalize bearing so character "faces" travel direction.
  const rot = typeof bearing === 'number' && Number.isFinite(bearing) ? bearing : 0;
  const emoji = mode === 'cycling' ? '🚴' : (gender === 'Female' ? '🚶‍♀️' : '🚶‍♂️');

  return (
    <div
      ref={containerRef}
      className="leaflet-character-marker"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 0,
        height: 0,
        pointerEvents: 'none',
        zIndex: 650, // above tiles + polyline, below leaflet controls (700+)
        willChange: 'transform',
      }}
      aria-hidden="true"
    >
      {/* Neon aura — pulses always, stronger when moving */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          width: 90,
          height: 90,
          background:
            'radial-gradient(circle, rgba(204,255,0,0.35) 0%, rgba(204,255,0,0.12) 45%, rgba(204,255,0,0) 70%)',
          filter: 'blur(4px)',
          animation: 'hh-character-pulse 1.8s ease-in-out infinite',
        }}
      />

      {/* Character — rotates to bearing, bounces while moving */}
      <div
        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{
          width: 64,
          height: 64,
          transform: `translate(-50%, -50%) rotate(${rot}deg)`,
          transformOrigin: 'center',
          animation: isMoving ? 'hh-character-bounce 0.6s ease-in-out infinite' : undefined,
        }}
      >
        {/* Counter-rotate inner content so the character itself stays upright,
            and only the "direction indicator" feels rotated. Looks more natural. */}
        <div
          className="w-full h-full flex items-center justify-center"
          style={{ transform: `rotate(${-rot}deg)` }}
        >
          {animation ? (
            <Lottie
              animationData={animation}
              loop
              autoplay
              style={{ width: 64, height: 64, filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.6))' }}
            />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{
                background: 'radial-gradient(circle at 30% 30%, #1a1a1a, #050505)',
                border: '2px solid #CCFF00',
                boxShadow: '0 0 16px rgba(204,255,0,0.65), inset 0 0 8px rgba(0,0,0,0.8)',
                fontSize: 30,
                lineHeight: 1,
              }}
            >
              <span>{emoji}</span>
            </div>
          )}
        </div>

        {/* Avatar face badge — graceful fallback to a glowing Neon Lime dot
            if the user has no avatar, or the image fails to load (CORS, 404). */}
        <AvatarBadge avatarUrl={avatarUrl} counterRotate={-rot} />


        {/* Direction triangle — points along bearing */}
        <div
          className="absolute left-1/2 -translate-x-1/2"
          style={{
            top: -10,
            width: 0,
            height: 0,
            borderLeft: '6px solid transparent',
            borderRight: '6px solid transparent',
            borderBottom: '10px solid #CCFF00',
            filter: 'drop-shadow(0 0 6px rgba(204,255,0,0.9))',
          }}
        />
      </div>

      {/* Local keyframes */}
      <style>{`
        @keyframes hh-character-pulse {
          0%, 100% { opacity: 0.55; transform: translate(-50%, -50%) scale(0.95); }
          50%      { opacity: 1;    transform: translate(-50%, -50%) scale(1.15); }
        }
        @keyframes hh-character-bounce {
          0%, 100% { transform: translate(-50%, -50%) rotate(${rot}deg) translateY(0); }
          50%      { transform: translate(-50%, -50%) rotate(${rot}deg) translateY(-4px); }
        }
      `}</style>
    </div>
  );
};

export default CharacterMarker;
