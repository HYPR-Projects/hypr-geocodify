// Vercel Serverless Function — Google Places API (New) proxy
// Adaptado da Netlify Function original. Mesma lógica, formato Vercel.
// Actions: textSearch (IDs grátis) e details (Pro SKU)

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

// Supabase cache — reuses same project/creds as cnpj-enrich.js
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://qfyqvcxhcmduhknbpofx.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeXF2Y3hoY21kdWhrbmJwb2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mjk1NjAsImV4cCI6MjA4OTAwNTU2MH0.k92V1LN4OqqdtfF86iml4L-gVg0AabENKt7S5vlP2dk';

// Google Places Platform ToS caps non-place_id content at 30 days.
// Stale entries force a refetch via Place Details.
const PLACES_CACHE_TTL_MS = 30 * 86400 * 1000;

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

// ─── Text Search (IDs Only) — FREE ──────────────────────────────────────────
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
    // locationRestriction.circle: HARD constraint — Google returns only results inside the circle.
    // (locationBias.circle is soft and leaks results outside the radius.)
    // Google limits circle radius to 50000m; clamp just in case.
    const clampedRadius = Math.min(Math.max(Number(radius) || 0, 1), 50000);
    payload.locationRestriction = {
      circle: {
        center: { latitude: lat, longitude: lon },
        radius: clampedRadius,
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
      'X-Goog-FieldMask': 'places.id',
    },
    body: JSON.stringify(payload),
  });

  const data = await resp.json();

  if (!resp.ok) {
    console.error('Google Places textSearch error:', resp.status, JSON.stringify(data));
    throw new Error(data.error?.message || 'Google API error');
  }

  return {
    placeIds: (data.places || []).map(p => p.id),
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
        // Skip stale entries — app refreshes them via Google Details
        const ageMs = Date.now() - new Date(c.refreshed_at).getTime();
        if (ageMs > PLACES_CACHE_TTL_MS) continue;
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
  const newEntries = [];
  if (toFetch.length > 0) {
    const GROUP = 5;
    for (let i = 0; i < toFetch.length; i += GROUP) {
      const group = toFetch.slice(i, i + GROUP);
      const groupResults = await Promise.allSettled(
        group.map(async (pid) => {
          for (let attempt = 0; attempt < 2; attempt++) {
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
              if (resp.status === 429 && attempt === 0) {
                await new Promise(r => setTimeout(r, 300));
                continue;
              }
              return null;
            } catch {
              if (attempt === 0) { await new Promise(r => setTimeout(r, 200)); continue; }
              return null;
            }
          }
          return null;
        })
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
