// ─── Autenticação ───────────────────────────────────────────────────────────
// Google OAuth via Supabase, restrito a @hypr.mobi

import { getSupabase } from './supabase.js';

let currentUser = null;

export function getCurrentUser() {
  return currentUser;
}

/** Inicializa auth: verifica sessão, escuta mudanças */
export async function initAuth(onLoggedIn, onLoggedOut) {
  const supa = getSupabase();
  if (!supa) throw new Error('Supabase not initialized');

  const { data } = await supa.auth.getSession();
  if (data.session?.user) {
    const accepted = await handleLoggedIn(data.session.user, onLoggedIn);
    if (accepted) return;
  }

  supa.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      handleLoggedIn(session.user, onLoggedIn);
    }
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      // Expor globalmente pra código legacy
      window.currentUser = null;
      onLoggedOut?.();
    }
  });

  onLoggedOut?.();
}

/** Inicia OAuth com Google */
export async function doGoogleLogin() {
  const supa = getSupabase();
  const { error } = await supa.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { hd: 'hypr.mobi' },
    },
  });
  return error;
}

/** Logout */
export async function logout() {
  const supa = getSupabase();
  await supa.auth.signOut();
  currentUser = null;
  window.currentUser = null;
}

/** Valida domínio e configura usuário */
async function handleLoggedIn(user, callback) {
  if (!user?.email?.endsWith('@hypr.mobi')) {
    const supa = getSupabase();
    await supa.auth.signOut();
    return false;
  }
  currentUser = user;
  // Expor globalmente pra código legacy que referencia window.currentUser
  window.currentUser = user;
  callback?.(user);
  return true;
}
