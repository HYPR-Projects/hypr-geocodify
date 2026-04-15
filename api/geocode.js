// Vercel Serverless Function — HERE Geocoding API proxy
// Aceita os mesmos query params que a HERE API, adiciona a key server-side.
// Suporta: forward freeform (?q=), forward structured (?qq=), reverse (?action=reverse&at=)

const HERE_KEY = process.env.HERE_API_KEY;

const ALLOWED_ORIGINS = [
  'https://geocodify.hypr.mobi',
  'https://hypr-geocodify.vercel.app',
];

function getCorsOrigin(req) {
  const origin = req.headers?.origin || '';
  if (ALLOWED_ORIGINS.some(o => origin === o)) return origin;
  // Vercel preview deploys: only this project's previews
  if (/^https:\/\/hypr-geocodify[a-z0-9-]*\.vercel\.app$/.test(origin)) return origin;
  // Local dev
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) return origin;
  return ALLOWED_ORIGINS[0];
}

export default async function handler(req, res) {
  const corsOrigin = getCorsOrigin(req);
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (!HERE_KEY) {
    return res.status(500).json({ error: 'HERE_API_KEY not configured on server' });
  }

  const params = req.method === 'POST' && req.body
    ? (typeof req.body === 'string' ? JSON.parse(req.body) : req.body)
    : req.query || {};

  try {
    const action = params.action || '';

    if (action === 'reverse') {
      const at = params.at;
      if (!at) return res.status(400).json({ error: 'Missing "at" parameter (lat,lon)' });
      const limit = params.limit || '1';
      const lang = params.lang || 'pt-BR';
      const url = `https://revgeocode.search.hereapi.com/v1/revgeocode?at=${encodeURIComponent(at)}&lang=${lang}&limit=${limit}&apiKey=${HERE_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      return res.status(resp.status).json(data);
    }

    if (params.qq) {
      const limit = params.limit || '5';
      const lang = params.lang || 'pt-BR';
      const url = `https://geocode.search.hereapi.com/v1/geocode?qq=${encodeURIComponent(params.qq)}&limit=${limit}&lang=${lang}&apiKey=${HERE_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      return res.status(resp.status).json(data);
    }

    if (params.q) {
      const limit = params.limit || '5';
      const lang = params.lang || 'pt-BR';
      const inParam = params.in || 'countryCode:BRA';
      const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(params.q)}&in=${encodeURIComponent(inParam)}&limit=${limit}&lang=${lang}&apiKey=${HERE_KEY}`;
      const resp = await fetch(url);
      const data = await resp.json();
      return res.status(resp.status).json(data);
    }

    return res.status(400).json({ error: 'Missing q, qq, or action=reverse parameter' });
  } catch (err) {
    console.error('Geocode proxy error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
