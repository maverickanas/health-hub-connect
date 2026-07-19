// Edge function: compute route via Google Maps Routes API (gateway)
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_maps";

interface LatLng { lat: number; lng: number }
interface Body {
  origin: LatLng | string;
  destination: LatLng | string;
  travelMode?: "WALK" | "BICYCLE" | "DRIVE";
}

function buildWaypoint(p: LatLng | string) {
  if (typeof p === "string") return { address: p };
  return { location: { latLng: { latitude: p.lat, longitude: p.lng } } };
}

// Decode Google encoded polyline → [[lat,lng], ...]
function decodePolyline(str: string): [number, number][] {
  let index = 0, lat = 0, lng = 0;
  const coords: [number, number][] = [];
  while (index < str.length) {
    let b, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!LOVABLE_API_KEY || !GOOGLE_MAPS_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing Google Maps credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const body: Body = await req.json();
    if (!body.origin || !body.destination) {
      return new Response(JSON.stringify({ error: "origin and destination required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const travelMode = body.travelMode ?? "WALK";
    const payload = {
      origin: buildWaypoint(body.origin),
      destination: buildWaypoint(body.destination),
      travelMode,
      polylineQuality: "HIGH_QUALITY",
      computeAlternativeRoutes: false,
      languageCode: "en-US",
      units: "METRIC",
    };

    const callRoutes = async (mode: string) => {
      const r = await fetch(`${GATEWAY_URL}/routes/directions/v2:computeRoutes`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_MAPS_API_KEY,
          "Content-Type": "application/json",
          "X-Goog-FieldMask":
            "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.legs.steps.navigationInstruction,routes.legs.steps.distanceMeters",
        },
        body: JSON.stringify({ ...payload, travelMode: mode }),
      });
      const j = await r.json();
      return { r, j };
    };

    let { r: res, j: data } = await callRoutes(travelMode);
    console.log("Routes API status", res.status, "mode", travelMode, "body", JSON.stringify(data).slice(0, 500));

    // Fallback: if WALK/BICYCLE returns no route, try DRIVE so the user still gets a path.
    if (res.ok && !data.routes?.[0] && travelMode !== "DRIVE") {
      const fb = await callRoutes("DRIVE");
      console.log("Fallback DRIVE status", fb.r.status, "body", JSON.stringify(fb.j).slice(0, 500));
      if (fb.r.ok && fb.j.routes?.[0]) { res = fb.r; data = fb.j; }
    }

    if (!res.ok) {
      return new Response(JSON.stringify({ error: "Routes API error", status: res.status, details: data }),
        { status: res.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const route = data.routes?.[0];
    if (!route) {
      return new Response(JSON.stringify({ error: "No route found", details: data }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const polyline = decodePolyline(route.polyline.encodedPolyline);
    const steps = (route.legs?.[0]?.steps ?? []).map((s: any) => ({
      instruction: s.navigationInstruction?.instructions ?? "",
      maneuver: s.navigationInstruction?.maneuver ?? "",
      distanceMeters: s.distanceMeters ?? 0,
    }));
    return new Response(JSON.stringify({
      distanceMeters: route.distanceMeters,
      durationSec: parseInt(String(route.duration).replace("s", "")) || 0,
      polyline,
      steps,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
