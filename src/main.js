// ─── HYPR Geocodify — Vite Entry Point ──────────────────────────────────────
// All JS now lives in modules. Zero inline JS in index.html.
//
// This file imports:
// 1. CSS (processed by Vite)
// 2. The legacy app code (extracted from inline, exposes to window.*)
//
// The legacy app-legacy.js handles its own window.* exposure internally.
// ES modules from src/lib/ are NOT imported here anymore — they were
// duplicates of functions that also exist in app-legacy.js.
// Once app-legacy.js is split into proper domain modules, the lib/
// modules will replace it piece by piece.

import './styles/app.css';
import './inline/app-legacy.js';
