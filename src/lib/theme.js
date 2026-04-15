// ─── Theme System ───────────────────────────────────────────────────────────
// Dark/light toggle. Shared entre index e comparativo.

const STORAGE_KEY = 'geocodify-theme';

/** Aplica tema salvo antes do primeiro paint (chamado inline no head) */
export function initTheme() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) document.documentElement.setAttribute('data-theme', saved);
  } catch {}
  updateIcons();
}

/** Toggle dark ↔ light com transição suave */
export function toggleTheme() {
  const html = document.documentElement;
  html.classList.add('theme-switching');

  const current = html.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';

  html.setAttribute('data-theme', next);
  try { localStorage.setItem(STORAGE_KEY, next); } catch {}

  setTimeout(() => html.classList.remove('theme-switching'), 300);
  updateIcons();
  return next;
}

/** Retorna tema atual */
export function getTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

function updateIcons() {
  const icon = getTheme() === 'dark' ? '☀️' : '🌙';
  document.querySelectorAll('#theme-toggle-icon, #theme-toggle-icon-gallery').forEach(el => {
    el.textContent = icon;
  });
}
