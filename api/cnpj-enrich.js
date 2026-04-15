// Vercel Serverless Function — Batch CNPJ enrichment proxy
// Receives up to 25 CNPJs, queries BrasilAPI + OpenCNPJ server-side.
// Reads/writes Supabase cnpj_cache for instant lookups.

const SUPABASE_URL  = process.env.SUPABASE_URL || 'https://qfyqvcxhcmduhknbpofx.supabase.co';
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeXF2Y3hoY21kdWhrbmJwb2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mjk1NjAsImV4cCI6MjA4OTAwNTU2MH0.k92V1LN4OqqdtfF86iml4L-gVg0AabENKt7S5vlP2dk';

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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  let body;
  try {
    body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const { cnpjs } = body;
  if (!cnpjs || !Array.isArray(cnpjs) || cnpjs.length === 0) {
    return res.status(400).json({ error: 'cnpjs array required' });
  }

  const batch = cnpjs.slice(0, 25).map(c => String(c).replace(/\D/g, '')).filter(c => c.length >= 8);
  if (batch.length === 0) return res.json({ results: {} });

  const results = {};
  let uncached = [...batch];

  // Step 1: Check Supabase cache
  try {
    const cacheUrl = `${SUPABASE_URL}/rest/v1/cnpj_cache?cnpj=in.(${batch.map(encodeURIComponent).join(',')})&select=*`;
    const cacheResp = await fetch(cacheUrl, {
      headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` },
      signal: AbortSignal.timeout(4000),
    });
    if (cacheResp.ok) {
      const cached = await cacheResp.json();
      const NINETY_DAYS = 90 * 86400 * 1000;
      for (const c of cached) {
        if (c.updated_at && (Date.now() - new Date(c.updated_at).getTime()) > NINETY_DAYS) continue;
        if (c.nome_exibicao || c.nome_fantasia || c.razao_social) {
          results[c.cnpj] = c;
          uncached = uncached.filter(x => x !== c.cnpj);
        }
      }
    }
  } catch (e) {
    console.warn('Cache read failed:', e.message);
  }

  // Step 2: Fetch uncached — 5 concurrent, each with 4s timeout
  if (uncached.length > 0) {
    const CONCURRENT = 15;
    const newEntries = [];

    for (let i = 0; i < uncached.length; i += CONCURRENT) {
      const chunk = uncached.slice(i, i + CONCURRENT);
      const settled = await Promise.allSettled(chunk.map(cnpj => lookupCNPJ(cnpj)));

      for (let j = 0; j < chunk.length; j++) {
        if (settled[j].status === 'fulfilled' && settled[j].value) {
          results[chunk[j]] = settled[j].value;
          newEntries.push({ cnpj: chunk[j], ...settled[j].value });
        }
      }
    }

    // Step 3: Save to cache (fire-and-forget)
    if (newEntries.length > 0) {
      fetch(`${SUPABASE_URL}/rest/v1/cnpj_cache`, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(newEntries),
      }).catch(() => {});
    }
  }

  return res.json({ results, cached: batch.length - uncached.length, fetched: uncached.length });
}

// Try BrasilAPI first, fallback to OpenCNPJ
async function lookupCNPJ(cnpj) {
  if (cnpj.length <= 8) {
    return lookupCNPJws(cnpj.padStart(8, '0')).catch(() => null);
  }
  // BrasilAPI (primary)
  try {
    const r = await fetchAPI(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (r) return r;
  } catch {}
  // OpenCNPJ (fallback)
  try {
    const r = await fetchAPI(`https://api.opencnpj.org/${cnpj}`);
    if (r) return r;
  } catch {}
  return null;
}

async function fetchAPI(url) {
  const resp = await fetch(url, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'HYPRGeocodify/1.0' },
    signal: AbortSignal.timeout(4000),
  });
  if (resp.status === 429) { await sleep(500); return null; }
  if (!resp.ok) return null;
  const d = await resp.json();
  return normalize(d);
}

async function lookupCNPJws(cnpjRaiz) {
  const resp = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjRaiz}`, {
    headers: { 'Accept': 'application/json', 'User-Agent': 'HYPRGeocodify/1.0' },
    signal: AbortSignal.timeout(5000),
  });
  if (!resp.ok) return null;
  const d = await resp.json();
  const est = d.estabelecimento || {};
  const nome = (est.nome_fantasia || '').trim();
  const razao = (d.razao_social || '').trim();
  if (!nome && !razao) return null;
  return {
    nome_fantasia: nome || null, razao_social: razao || null,
    nome_exibicao: nome || razao || null,
    municipio: est.cidade?.nome || null, uf: est.estado?.sigla || null,
  };
}

function normalize(d) {
  const nome = (d.nome_fantasia || '').trim();
  const razao = (d.razao_social || '').trim();
  if (!nome && !razao) return null;
  return {
    nome_fantasia: nome || null, razao_social: razao || null,
    nome_exibicao: nome || razao || null,
    municipio: (d.municipio || '').trim() || null,
    uf: (d.uf || '').trim() || null,
    cep: (d.cep || '').replace(/\D/g, '') || null,
    situacao: d.descricao_situacao_cadastral || d.situacao_cadastral || null,
    atividade: d.cnae_fiscal_descricao || null,
    endereco_receita: [d.descricao_tipo_logradouro, d.logradouro, d.numero, d.complemento, d.bairro, d.municipio, d.uf].filter(Boolean).join(', ') || null,
    logradouro: [d.descricao_tipo_logradouro, d.logradouro, d.numero].filter(Boolean).join(' ') || null,
    bairro: d.bairro || null, numero: d.numero || null,
  };
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
