// Vercel Serverless Function — Google Places API (New) proxy
// Adaptado da Netlify Function original. Mesma lógica, formato Vercel.
// Actions:
//   textSearch — Text Search Pro SKU ($32/1000 requisições, até 20 places por
//     página). Retorna nome, endereço, coords e types direto na busca — sem
//     necessidade de Place Details subsequente. Modelo migrado do antigo
//     "IDs-Only grátis + Details Pro $0.017/place", que custava ~10x mais em
//     buscas exploratórias porque pagava Details por place ANTES do filtro
//     por nome no front (ex.: 10.605 places detalhados, 127 usados).
//   details — Place Details Pro SKU ($17/1000). Mantido para retry de sessões
//     antigas e como fallback; o fluxo principal de Discovery não o usa mais.

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Supabase cache — reuses same project/creds as cnpj-enrich.js
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qfyqvcxhcmduhknbpofx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeXF2Y3hoY21kdWhrbmJwb2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mjk1NjAsImV4cCI6MjA4OTAwNTU2MH0.k92V1LN4OqqdtfF86iml4L-gVg0AabENKt7S5vlP2dk';

// places_cache acts as a permanent proprietary base — entries never expire
// automatically. Rows are only removed or refreshed via explicit SQL ran
// against Supabase. This prioritizes long-term cost reduction on the
// Google Places Details Pro SKU over data freshness; accept that addresses
// may drift over time (stores closing, moving) unless manually refreshed.
const PLACES_CACHE_TTL_MS = null; // was: 30 * 86400 * 1000

const ALLOWED_ORIGINS = [
  'https://geocodify.hypr.mobi',
  'https://hypr-geocodify.vercel.app',
];

function getCorsOrigin(req) {
  const origin = req.headers?.origin || '';
  if (ALLOWED_ORIGINS.some(o => origin === o)) return origin;
  if (/^https:\/\/hypr-geocodify[a-z0-9-]*\.vercel\.app$/.test(origin)) return origin;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

export default async function handler(req, res) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }
  if (!API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_PLACES_API_KEY not configured' });
  }

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { action } = body;

  try {
    if (action === 'textSearch') {
      return res.json(await handleTextSearch(body));
    } else if (action === 'details') {
      return res.json(await handleDetails(body));
    } else {
      return res.status(400).json({ error: 'Unknown action. Use textSearch or details.' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// ─── Text Search Pro ────────────────────────────────────────────────────────
// Field mask requests displayName/formattedAddress/location/types, which
// triggers the Text Search Pro SKU ($32/1000 requests). Each request returns
// up to 20 complete places — name filtering happens on the client at zero
// cost, instead of paying Place Details Pro ($0.017/place) for every ID
// before filtering. Results are upserted to places_cache (fire-and-forget)
// so the proprietary base keeps growing at no extra cost.
async function handleTextSearch(body) {
  const { query, lat, lon, radius, bbox, pageToken } = body;

  if (!query) throw new Error('query required');

  const payload = {
    textQuery: query,
    languageCode: 'pt-BR',
    regionCode: 'BR',
    pageSize: 20,
  };

  if (bbox && bbox.south != null && bbox.north != null && bbox.west != null && bbox.east != null) {
    payload.locationRestriction = {
      rectangle: {
        low: { latitude: bbox.south, longitude: bbox.west },
        high: { latitude: bbox.north, longitude: bbox.east },
      }
    };
  } else if (lat != null && lon != null && radius) {
    // Text Search (New) does NOT support locationRestriction.circle — only rectangle.
    // (circle is allowed in locationBias, which is SOFT and silently ignored when
    // the textQuery contains an explicit location like ", Brasil"; and in the
    // searchNearby endpoint, which doesn't accept a free-text query.) So we
    // convert the requested circle into a circumscribing bbox and use
    // locationRestriction.rectangle — same HARD-constraint field Estados/Brasil
    // already uses successfully.
    //
    // The bbox is ~27% larger in area than the circle, so a few results may land
    // in the corners outside the intended radius. The Phase-2 haversine filter
    // on the client (with 10% tolerance) already discards those — no client
    // change required. Google caps radius at 50km; clamp to be safe.
    const clampedRadius = Math.min(Math.max(Number(radius) || 0, 1), 50000);
    const dLat = clampedRadius / 111320;
    const dLon = clampedRadius / (111320 * Math.cos(lat * Math.PI / 180));
    payload.locationRestriction = {
      rectangle: {
        low:  { latitude: lat - dLat, longitude: lon - dLon },
        high: { latitude: lat + dLat, longitude: lon + dLon },
      }
    };
  }

  if (pageToken) {
    payload.pageToken = pageToken;
  }

  const resp = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': API_KEY,
      // Pro-tier mask: id + displayName + formattedAddress + location + types.
      // nextPageToken is an Essentials field — including it does not raise the SKU.
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.types,nextPageToken',
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();

  if (!resp.ok) {
    console.error('Google Places textSearch error:', resp.status, JSON.stringify(data));
    throw new Error(data.error?.message || 'Google API error');
  }

  const places = (data.places || []).map(p => ({
    place_id: p.id,
    name: p.displayName?.text || (p.formattedAddress || '').split(',')[0] || '',
    address: p.formattedAddress || '',
    lat: p.location?.latitude ?? null,
    lon: p.location?.longitude ?? null,
    types: p.types || [],
    status: '',
  }));

  // Upsert to places_cache (fire-and-forget). The data is already paid for by
  // the Text Search Pro request — persisting it keeps the proprietary base
  // growing and keeps the details/expand flows cheap.
  const cacheEntries = places
    .filter(p => p.place_id && p.lat != null && p.lon != null)
    .map(p => ({
      place_id: p.place_id,
      name: p.name || null,
      address: p.address || null,
      lat: p.lat,
      lon: p.lon,
      types: (Array.isArray(p.types) && p.types.length) ? p.types : null,
      refreshed_at: new Date().toISOString(),
    }));
  if (cacheEntries.length > 0) {
    fetch(`${SUPABASE_URL}/rest/v1/places_cache`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(cacheEntries),
    }).catch(() => {});
  }

  return {
    places,
    // Kept for backward compatibility with any client still reading IDs.
    placeIds: places.map(p => p.place_id),
    nextPageToken: data.nextPageToken || null,
  };
}

// ─── Place Details Pro (with places_cache layer) ───────────────────────────
// Flow:
//   1. Check places_cache for all requested IDs (fresh entries only, <30 days)
//   2. Fetch only the missing/stale IDs from Google Places Details
//   3. Upsert new entries back to places_cache (fire-and-forget)
// Cache failures degrade gracefully — we fall through to a direct Google call.
async function handleDetails(body) {
  const { placeIds } = body;

  if (!placeIds || !Array.isArray(placeIds) || placeIds.length === 0) {
    throw new Error('placeIds array required');
  }

  const ids = placeIds.slice(0, 10);
  const results = [];
  let cacheHits = 0;
  let toFetch = [...ids];

  // Step 1: Check Supabase places_cache for fresh entries
  try {
    const idList = ids.map(encodeURIComponent).join(',');
    const cacheUrl = `${SUPABASE_URL}/rest/v1/places_cache?place_id=in.(${idList})&select=*`;
    const cacheResp = await fetch(cacheUrl, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      signal: AbortSignal.timeout(3000),
    });
    if (cacheResp.ok) {
      const cached = await cacheResp.json();
      const hitSet = new Set();
      for (const c of cached) {
        // TTL disabled — entries never auto-expire.
        // Skip corrupt entries (missing coords)
        if (c.lat == null || c.lon == null) continue;
        results.push({
          place_id: c.place_id,
          name: c.name || '',
          address: c.address || '',
          lat: c.lat,
          lon: c.lon,
          types: Array.isArray(c.types) ? c.types : [],
          status: '',
        });
        cacheHits++;
        hitSet.add(c.place_id);
      }
      toFetch = toFetch.filter(pid => !hitSet.has(pid));
    }
  } catch (e) {
    console.warn('places_cache read failed:', e.message);
    // Fall through: no cache hit, all IDs go to Google
  }

  // Step 2: Fetch uncached/stale from Google Places Details
  // GROUP controls peak concurrency against Google. With 2 parallel proxy calls
  // from the front-end, peak in-flight Google requests = 2 * GROUP. Keep this
  // conservative — Place Details QPM is the main rate-limit choke point.
  const newEntries = [];
  let rateLimit429s = 0;
  if (toFetch.length > 0) {
    const GROUP = 3;
    for (let i = 0; i < toFetch.length; i += GROUP) {
      const group = toFetch.slice(i, i + GROUP);
      const groupResults = await Promise.allSettled(
        group.map(pid => fetchPlaceDetailsWithRetry(pid, (n) => { rateLimit429s += n; }))
      );
      for (const r of groupResults) {
        if (r.status === 'fulfilled' && r.value) {
          results.push(r.value);
          // Queue for cache upsert only if we have valid coords
          if (r.value.place_id && r.value.lat != null && r.value.lon != null) {
            newEntries.push({
              place_id: r.value.place_id,
              name: r.value.name || null,
              address: r.value.address || null,
              lat: r.value.lat,
              lon: r.value.lon,
              types: (Array.isArray(r.value.types) && r.value.types.length) ? r.value.types : null,
              refreshed_at: new Date().toISOString(),
            });
          }
        }
      }
    }
  }
  if (rateLimit429s > 0) {
    console.warn(JSON.stringify({
      level: 'warn',
      scope: 'places-details',
      event: 'rate_limit_observed',
      count_429: rateLimit429s,
      ids_requested: toFetch.length,
      ids_returned: results.length - cacheHits,
    }));
  }

  // Step 3: Upsert new/refreshed entries to places_cache (fire-and-forget)
  if (newEntries.length > 0) {
    fetch(`${SUPABASE_URL}/rest/v1/places_cache`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(newEntries),
    }).catch(() => {});
  }

  return { places: results, cached: cacheHits, fetched: toFetch.length };
}

// ─── Place Details fetch with exponential backoff ──────────────────────────
// Retries on transient failures (429, 503, 504) up to 3 attempts total.
// Honors the Retry-After header from Google when present (capped at 8s to
// avoid a single slow place blocking the whole batch). Non-retryable errors
// (4xx other than 429, missing place, invalid ID) return null on first hit.
//
// onRateLimit(n): callback invoked with 1 each time a 429 is observed, used
// by the caller to aggregate counts for structured logging.
const RETRY_DELAYS_MS = [500, 1500, 4000];
const RETRY_AFTER_CAP_MS = 8000;
const RETRYABLE_STATUS = new Set([429, 503, 504]);

async function fetchPlaceDetailsWithRetry(pid, onRateLimit) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await fetch(`https://places.googleapis.com/v1/places/${pid}`, {
        method: 'GET',
        headers: {
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'id,displayName,formattedAddress,location,types',
        },
      });

      if (resp.ok) {
        const d = await resp.json();
        return {
          place_id: d.id,
          name: d.displayName?.text || (d.formattedAddress || '').split(',')[0] || '',
          address: d.formattedAddress || '',
          lat: d.location?.latitude || null,
          lon: d.location?.longitude || null,
          types: d.types || [],
          status: '',
        };
      }

      if (resp.status === 429) onRateLimit?.(1);

      const isRetryable = RETRYABLE_STATUS.has(resp.status);
      const isLastAttempt = attempt === 2;

      if (!isRetryable || isLastAttempt) {
        return null;
      }

      // Determine wait time: max(exponential backoff, server's Retry-After).
      // Cap at RETRY_AFTER_CAP_MS so a single rogue place can't stall the batch.
      const baseDelay = RETRY_DELAYS_MS[attempt];
      const retryAfterMs = parseRetryAfter(resp.headers.get('retry-after'));
      const delay = Math.min(
        Math.max(baseDelay, retryAfterMs || 0),
        RETRY_AFTER_CAP_MS
      );

      await new Promise(r => setTimeout(r, delay));
    } catch (e) {
      // Network error / abort. Treat as retryable.
      if (attempt === 2) return null;
      await new Promise(r => setTimeout(r, RETRY_DELAYS_MS[attempt]));
    }
  }
  return null;
}

// Parse Retry-After header. Google sends seconds (e.g. "1", "5"), but the
// HTTP spec also allows HTTP-date format. Returns milliseconds or null.
function parseRetryAfter(headerValue) {
  if (!headerValue) return null;
  const trimmed = String(headerValue).trim();
  // Numeric: seconds (most common case from Google)
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum) && asNum >= 0) return Math.round(asNum * 1000);
  // HTTP-date fallback
  const asDate = Date.parse(trimmed);
  if (!Number.isNaN(asDate)) {
    const diff = asDate - Date.now();
    return diff > 0 ? diff : null;
  }
  return null;
}

