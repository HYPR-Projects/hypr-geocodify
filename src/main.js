// ─── HYPR Geocodify — Vite Entry Point ──────────────────────────────────────
// CSS + single app module. Zero inline JS in index.html.

// Global error handlers — captura erros silenciados e promises rejeitadas
window.onerror = (msg, src, line, col, err) => {
  console.error('[Geocodify]', msg, src + ':' + line + ':' + col, err);
};
window.addEventListener('unhandledrejection', (e) => {
  console.error('[Geocodify] Unhandled promise:', e.reason);
});

import './styles/app.css';
import './inline/app.js';
import './inline/v360-competitors.js';
import './inline/v360-comp-render.js';
import './inline/v360-comp-pr3.js';
import './inline/v360-hero.js';
import './inline/v360-sidebar.js';
import './inline/v360-panel.js';
