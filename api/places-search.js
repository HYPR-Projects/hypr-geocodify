// Vercel Serverless Function — Google Places API (New) proxy
// Adaptado da Netlify Function original. Mesma lógica, formato Vercel.
// Actions: textSearch (IDs grátis) e details (Pro SKU)

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

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

// ─── Place Details Pro ──────────────────────────────────────────────────────
async function handleDetails(body) {
  const { placeIds } = body;

  if (!placeIds || !Array.isArray(placeIds) || placeIds.length === 0) {
    throw new Error('placeIds array required');
  }

  const ids = placeIds.slice(0, 10);
  const results = [];
  const GROUP = 5;

  for (let i = 0; i < ids.length; i += GROUP) {
    const group = ids.slice(i, i + GROUP);
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
      if (r.status === 'fulfilled' && r.value) results.push(r.value);
    }
  }

  return { places: results };
}
