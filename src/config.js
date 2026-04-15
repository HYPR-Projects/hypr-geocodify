// ─── HYPR Geocodify — Configuração Central ────────────────────────────────
// Constantes, thresholds e env vars num lugar só.
// Importar: import { GEO_BATCH_SIZE } from './config.js'

// ── Geocoding ──
export const GEO_BATCH_SIZE = 8;
export const GEO_BATCH_DELAY_MS = 80;
export const GEO_SCORE_MIN = 0.5;
export const GEO_TIMEOUT_MS = 8000;

// ── Receita Federal ──
export const RECEITA_MAX_CONCURRENT = 5;
export const RECEITA_RETRY_DELAY_MS = 2000;
export const RECEITA_TIMEOUT_MS = 8000;

// ── Places Discovery ──
export const PLACES_BATCH_SIZE = 10;
export const PLACES_CONCURRENCY = 4;
export const PLACES_PAGE_LIMIT = 3;

// ── Supabase DB ──
export const DB_CHUNK_SIZE = 500;
export const DB_PAGE_SIZE = 1000;
export const DB_REQUEST_TIMEOUT_MS = 15000;

// ── Gallery ──
export const GALLERY_PER_PAGE = 30;
export const GALLERY_MAX_FETCH = 500;
export const THUMB_COLORS = [
  '#7C3AED', '#2563EB', '#059669', '#DC2626',
  '#D97706', '#0891B2', '#9333EA',
];

// ── UI ──
export const LIST_RENDER_LIMIT = 500;
export const MARKER_UPDATE_INTERVAL = 100;
