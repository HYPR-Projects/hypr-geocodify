// ─── Supabase Client ────────────────────────────────────────────────────────
// Init centralizado. Importar { supa, sbFetch } de qualquer módulo.

import { DB_REQUEST_TIMEOUT_MS } from '../config.js';

// Supabase URL e anon key — client-side (esperado pelo Supabase)
// TODO Sprint 5: mover pra import.meta.env.VITE_SUPABASE_*
const SUPABASE_URL = 'https://qfyqvcxhcmduhknbpofx.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeXF2Y3hoY21kdWhrbmJwb2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mjk1NjAsImV4cCI6MjA4OTAwNTU2MH0.k92V1LN4OqqdtfF86iml4L-gVg0AabENKt7S5vlP2dk';

let _supa = null;

/** Inicializa o client Supabase (aguarda script defer) */
export function initSupabase() {
  return new Promise((resolve) => {
    function attempt() {
      if (window.supabase) {
        _supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON);
        // Expor globais pra código legacy que ainda referencia
        window._supa = _supa;
        window.SUPABASE_URL = SUPABASE_URL;
        window.SUPABASE_ANON = SUPABASE_ANON;
        resolve(_supa);
      } else {
        setTimeout(attempt, 50);
      }
    }
    attempt();
  });
}

/** Retorna o client (assume já inicializado) */
export function getSupabase() {
  return _supa;
}

/** Retorna URL e anon key (pra código que precisa dos valores raw) */
export function getSupabaseConfig() {
  return { url: SUPABASE_URL, anonKey: SUPABASE_ANON };
}

/**
 * Fetch tipado pro Supabase REST API.
 * Usa token do usuário logado quando disponível.
 */
export async function sbFetch(path, opts = {}) {
  if (!_supa) throw new Error('Supabase not initialized');

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), DB_REQUEST_TIMEOUT_MS);

  const session = (await _supa.auth.getSession()).data.session;
  const authToken = session?.access_token || SUPABASE_ANON;

  const headers = {
    apikey: SUPABASE_ANON,
    Authorization: `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...(opts.headers || {}),
  };

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...opts, headers, signal: controller.signal,
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error(await res.text());
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (e) {
    clearTimeout(tid);
    throw e;
  }
}
