// ─── HYPR Geocodify — Application ───────────────────────────────────────────
// All app JS extracted from index.html. Imported by main.js as ES module.
// Functions are exposed to window.* at the bottom for HTML onclick handlers.

// ── Bootstrap — inicializa Supabase e auth ──
window._supa = null;
window.currentUser = null;
window.MAP_STYLES = null;
window._supaReady = false;
var _supa = null;
var currentUser = null;
document.addEventListener('DOMContentLoaded', function() {
  // 1. Supabase client (may not be ready yet if defer scripts still loading)
  function _initSupa() {
    if (!window.supabase) { setTimeout(_initSupa, 50); return; }
    if (window._supaReady) return;
    var url  = 'https://qfyqvcxhcmduhknbpofx.supabase.co';
    var anon = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeXF2Y3hoY21kdWhrbmJwb2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mjk1NjAsImV4cCI6MjA4OTAwNTU2MH0.k92V1LN4OqqdtfF86iml4L-gVg0AabENKt7S5vlP2dk';
    _supa = window.supabase.createClient(url, anon);
    window._supa = _supa;
    window._supaReady = true;
    window.SUPABASE_URL  = url;
    window.SUPABASE_ANON = anon;
    if (typeof _initMapStyles === 'function') _initMapStyles();
  }
  _initSupa();
});

// ── Theme helpers ──
function _cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function toggleTheme() {
  var html = document.documentElement;
  html.classList.add('theme-switching');
  var current = html.getAttribute('data-theme') || 'dark';
  var next = current === 'dark' ? 'light' : 'dark';
  html.setAttribute('data-theme', next);
  localStorage.setItem('geocodify-theme', next);
  setTimeout(function(){ html.classList.remove('theme-switching'); }, 300);
  // Theme toggle SVG (header + gallery) é controlado por CSS [data-theme]
  // — não tocar no DOM dele.
  // Rebuild map style if map is loaded
  if (typeof _onThemeChange === 'function') _onThemeChange(next);
  // Re-render charts with new colors
  if (typeof updateAnalytics === 'function') {
    try { updateAnalytics(); } catch(e) {}
  }
  // Re-render markers (pinColor reads CSS vars now)
  if (typeof renderMarkers === 'function' && typeof map !== 'undefined' && map) {
    try { renderMarkers(); } catch(e) {}
  }
}

// Quando o usuário altera a cor de uma marca via color picker, V360Comp
// dispara 'v360:competitors-loaded' com detail.colorChanged=true. O pool de
// donut markers do mapa usa um sig baseado em contagens (não cores), então
// re-renderizar sem invalidar o pool não repinta os SVGs existentes. Aqui
// limpamos o pool e forçamos um renderMarkers() completo — assim cluster
// donuts (modo Categoria) e pdv-points individuais pegam a cor nova.
window.addEventListener('v360:competitors-loaded', function(e) {
  if (!e || !e.detail || e.detail.colorChanged !== true) return;
  try { if (typeof _clearClusterDonuts === 'function') _clearClusterDonuts(); } catch(_) {}
  if (typeof renderMarkers === 'function' && typeof map !== 'undefined' && map) {
    try { renderMarkers(); } catch(_) {}
  }
});

function _onThemeChange(theme) {
  if (typeof map === 'undefined' || !map) return;
  // Se o fallback HERE está ativo, troca de tema usa o estilo HERE correspondente
  // para manter consistência. Sem isso, theme-toggle voltaria pro vector e quebraria de novo.
  var style;
  if (_fallbackActive) {
    style = _buildHereRasterStyle(theme === 'light' ? 'light' : 'dark');
  } else {
    style = theme === 'light' ? _buildLightMapStyle() : _buildDarkStyle();
  }
  var center = map.getCenter();
  var zoom = map.getZoom();
  map.setStyle(style);
  map.once('styledata', function() {
    map.jumpTo({ center: center, zoom: zoom });
    _setupMapSources();
    _setupMapInteractions();
    if (filteredData.length > 0) renderMarkers();
  });
}

function _buildLightMapStyle() {
  return {
    version: 8,
    glyphs: '/fonts/{fontstack}/{range}.pbf',
    sources: { 'ofm': { type: 'vector', url: 'https://tiles.openfreemap.org/planet' } },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#f0f4f8' } },
      { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water', paint: { 'fill-color': '#c8ddf0' } },
      { id: 'waterway', type: 'line', source: 'ofm', 'source-layer': 'waterway', paint: { 'line-color': '#c8ddf0', 'line-width': 1 } },
      { id: 'landcover', type: 'fill', source: 'ofm', 'source-layer': 'landcover', paint: { 'fill-color': '#e8f0e0', 'fill-opacity': 0.5 } },
      { id: 'landuse', type: 'fill', source: 'ofm', 'source-layer': 'landuse', paint: { 'fill-color': '#eef2e8' } },
      { id: 'park', type: 'fill', source: 'ofm', 'source-layer': 'park', paint: { 'fill-color': '#d4e8d0', 'fill-opacity': 0.6 } },
      { id: 'boundary-country', type: 'line', source: 'ofm', 'source-layer': 'boundary', filter: ['==', 'admin_level', 2],
        paint: { 'line-color': '#9ca3af', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 6, 2, 10, 2.5], 'line-opacity': 0.6 } },
      { id: 'boundary-state', type: 'line', source: 'ofm', 'source-layer': 'boundary', filter: ['==', 'admin_level', 4],
        paint: { 'line-color': '#c0c8d0', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 6, 1.4, 10, 2, 14, 2.5], 'line-opacity': 0.5 } },
      { id: 'road-motorway-casing', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['in', 'class', 'motorway', 'trunk'],
        paint: { 'line-color': '#c0c8d2', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 12, 4, 16, 8] }, minzoom: 5 },
      { id: 'road-motorway', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['in', 'class', 'motorway', 'trunk'],
        paint: { 'line-color': '#e4e8ee', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 12, 2.5, 16, 5] } },
      { id: 'road-primary', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['in', 'class', 'primary', 'secondary'],
        paint: { 'line-color': '#d8dce4', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 12, 1.8, 16, 3.5] } },
      { id: 'road-minor', type: 'line', source: 'ofm', 'source-layer': 'transportation', filter: ['in', 'class', 'tertiary', 'minor', 'residential', 'service'],
        paint: { 'line-color': '#e4e8ee', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 14, 1.2, 16, 2.2] }, minzoom: 10 },
      { id: 'building', type: 'fill', source: 'ofm', 'source-layer': 'building',
        paint: { 'fill-color': '#dde2e8', 'fill-outline-color': '#c8d0d8' }, minzoom: 14 },
      { id: 'label-road-major', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 11, 18, 13], 'symbol-placement': 'line', 'text-max-angle': 30, 'text-rotation-alignment': 'map', 'text-padding': 2 },
        paint: { 'text-color': '#6b7280', 'text-halo-color': '#f0f4f8', 'text-halo-width': 1.5 }, minzoom: 12 },
      { id: 'label-road-minor', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'tertiary', 'minor', 'residential', 'service'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 9, 18, 11], 'symbol-placement': 'line', 'text-max-angle': 30, 'text-rotation-alignment': 'map', 'text-padding': 2 },
        paint: { 'text-color': '#9ca3af', 'text-halo-color': '#f0f4f8', 'text-halo-width': 1.2 }, minzoom: 15 },
      { id: 'label-state', type: 'symbol', source: 'ofm', 'source-layer': 'place', filter: ['==', 'class', 'state'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 6, 12, 8, 14, 12, 16], 'text-transform': 'uppercase', 'text-letter-spacing': 0.12, 'text-max-width': 8 },
        paint: { 'text-color': '#6b7280', 'text-halo-color': '#f0f4f8', 'text-halo-width': 2, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.8, 12, 0.5] }, minzoom: 4 },
      { id: 'label-city', type: 'symbol', source: 'ofm', 'source-layer': 'place', filter: ['in', 'class', 'city', 'town', 'village'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 10, 13], 'text-max-width': 8 },
        paint: { 'text-color': '#4b5563', 'text-halo-color': '#f0f4f8', 'text-halo-width': 1.5 } },
      { id: 'label-country', type: 'symbol', source: 'ofm', 'source-layer': 'place', filter: ['==', 'class', 'country'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 14], 'text-transform': 'uppercase', 'text-letter-spacing': 0.15 },
        paint: { 'text-color': '#6b7280', 'text-halo-color': '#f0f4f8', 'text-halo-width': 2 } },
    ]
  };
}

// ─── Utilitários ────────────────────────────────────────────────────────────
function debounce(fn, ms) {
  let tid;
  return function(...args) { clearTimeout(tid); tid = setTimeout(() => fn.apply(this, args), ms); };
}
function throttle(fn, ms) {
  let last = 0;
  return function(...args) { const now = Date.now(); if (now - last >= ms) { last = now; fn.apply(this, args); } };
}

// ─── Lazy script loader (Chart.js, XLSX carregados sob demanda) ──────────────
var _scriptPromises = {};
function _loadScript(url, integrity) {
  if (_scriptPromises[url]) return _scriptPromises[url];
  _scriptPromises[url] = new Promise(function(resolve, reject) {
    if (document.querySelector('script[src="' + url + '"]')) { resolve(); return; }
    var s = document.createElement('script');
    s.src = url;
    if (integrity) { s.integrity = integrity; s.crossOrigin = 'anonymous'; }
    s.onload = resolve;
    s.onerror = function() { delete _scriptPromises[url]; reject(new Error('Failed to load ' + url)); };
    document.head.appendChild(s);
  });
  return _scriptPromises[url];
}

function ensureChartJS() {
  if (window.Chart) return Promise.resolve();
  return _loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
    'sha384-bs/nf9FbdNouRbMiFcrcZfLXYPKiPaGVGplVbv7dLGECccEXDW+S3zjqSKR5ZEaD'
  ).then(function() {
    // Aplica Urbanist como fonte default em todos os charts (labels, tooltips, eixos, legenda)
    if (window.Chart && window.Chart.defaults) {
      window.Chart.defaults.font.family = "'Urbanist', sans-serif";
    }
  });
}

function ensureXLSX() {
  if (window.XLSX) return Promise.resolve();
  return _loadScript(
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'sha384-vtjasyidUo0kW94K5MXDXntzOJpQgBKXmE7e2Ga4LG0skTTLeBi97eFAXsqewJjw'
  );
}

// ─── HTML Escape (XSS prevention) ────────────────────────────────────────────
function _escForHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ─── State ───────────────────────────────────────────────────────────────────
var STATE_NAME_TO_UF = {'Acre':'AC','Alagoas':'AL','Amapá':'AP','Amazonas':'AM','Bahia':'BA','Ceará':'CE','Distrito Federal':'DF','Espírito Santo':'ES','Goiás':'GO','Maranhão':'MA','Mato Grosso do Sul':'MS','Mato Grosso':'MT','Minas Gerais':'MG','Pará':'PA','Paraíba':'PB','Paraná':'PR','Pernambuco':'PE','Piauí':'PI','Rio de Janeiro':'RJ','Rio Grande do Norte':'RN','Rio Grande do Sul':'RS','Rondônia':'RO','Roraima':'RR','Santa Catarina':'SC','São Paulo':'SP','Sergipe':'SE','Tocantins':'TO'};
// HERE key: usada APENAS para satellite tiles do MapLibre (raster tile URL precisa da key no client).
// Geocoding e reverse geocoding usam o proxy server-side /api/geocode (key fica no Vercel env vars).
// Key restrita a Map Tile API v2 + referrer lock (geocodify.hypr.mobi, *.vercel.app, localhost).
var _HERE_SAT_KEY = 'cxwGDGEtFvYZ7Qjvyr14HvCOay4qi7r6-tTGOIK98Xs';
var allData = [];
var filteredData = [];
var map = null;
var charts = {};
var activeLayer = 'dark';
var _popup = null;        // MapLibre popup atual

// Filtro de bucket de share ativado via clique no chart "Distribuição de Share"
// Quando setado, sobrescreve o slider f-share-min. Formato: { min: 0.05, max: 0.10 } ou null.
var _activeShareBucket = null;

// Subset de allData com todos os filtros aplicados EXCETO o filtro de performance.
// Usado pelos mini-stats Ganhando/Competindo/Perdendo/Sem presença para mostrar a contagem
// real de cada categoria mesmo quando uma delas está ativa como filtro.
var _baseDataNoPerf = [];

// Modo seleção múltipla — Varejo 360
var _selectionMode = false;
var _selectedIds = new Set(); // row.id (UUID) dos pins selecionados

// ─── Estilos de mapa (MapLibre style URLs) ───────────────────────────────────
// OpenFreeMap — vector tiles WebGL gratuito + HERE raster para satellite
var MAP_STYLES = null; // inicializado após _buildDarkStyle e _buildSatelliteStyle

function _buildDarkStyle() {
  // Style dark customizado usando tiles OpenFreeMap + paleta HYPR
  // Background alinhado com --bg #1C262F (canvas HYPR) ao invés de #0d1117.
  return {
    version: 8,
    glyphs: '/fonts/{fontstack}/{range}.pbf',
    sources: {
      'ofm': {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#1C262F' } },
      { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water',
        paint: { 'fill-color': '#161E26' } },
      { id: 'waterway', type: 'line', source: 'ofm', 'source-layer': 'waterway',
        paint: { 'line-color': '#161E26', 'line-width': 1 } },
      { id: 'landcover', type: 'fill', source: 'ofm', 'source-layer': 'landcover',
        paint: { 'fill-color': '#1A232C', 'fill-opacity': 0.5 } },
      { id: 'landuse', type: 'fill', source: 'ofm', 'source-layer': 'landuse',
        paint: { 'fill-color': '#1F2932' } },
      { id: 'park', type: 'fill', source: 'ofm', 'source-layer': 'park',
        paint: { 'fill-color': '#19251F', 'fill-opacity': 0.8 } },
      { id: 'boundary-country', type: 'line', source: 'ofm', 'source-layer': 'boundary',
        filter: ['==', 'admin_level', 2],
        paint: { 'line-color': '#475968', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 6, 2, 10, 2.5], 'line-opacity': 0.85 } },
      { id: 'boundary-state', type: 'line', source: 'ofm', 'source-layer': 'boundary',
        filter: ['==', 'admin_level', 4],
        paint: { 'line-color': '#384857', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 6, 1.4, 10, 2, 14, 2.5], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.7, 10, 0.6, 14, 0.45] } },
      { id: 'road-motorway-casing', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk'],
        paint: { 'line-color': '#2F3D4A', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 12, 4, 16, 8] }, minzoom: 5 },
      { id: 'road-motorway', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk'],
        paint: { 'line-color': '#24323F', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 12, 2.5, 16, 5] } },
      { id: 'road-primary', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'primary', 'secondary'],
        paint: { 'line-color': '#22303C', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 12, 1.8, 16, 3.5] } },
      { id: 'road-minor', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'tertiary', 'minor', 'residential', 'service'],
        paint: { 'line-color': '#1F2A35', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 14, 1.2, 16, 2.2] },
        minzoom: 10 },
      { id: 'building', type: 'fill', source: 'ofm', 'source-layer': 'building',
        paint: { 'fill-color': '#22303C', 'fill-outline-color': '#2A3946' },
        minzoom: 14 },
      { id: 'label-road-major', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 11, 18, 13], 'symbol-placement': 'line', 'text-max-angle': 30, 'text-rotation-alignment': 'map', 'text-padding': 2 },
        paint: { 'text-color': '#5F758A', 'text-halo-color': '#1C262F', 'text-halo-width': 1.5 }, minzoom: 12 },
      { id: 'label-road-minor', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'tertiary', 'minor', 'residential', 'service'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 9, 18, 11], 'symbol-placement': 'line', 'text-max-angle': 30, 'text-rotation-alignment': 'map', 'text-padding': 2 },
        paint: { 'text-color': '#475968', 'text-halo-color': '#1C262F', 'text-halo-width': 1.2 }, minzoom: 15 },
      { id: 'label-state', type: 'symbol', source: 'ofm', 'source-layer': 'place',
        filter: ['==', 'class', 'state'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 6, 12, 8, 14, 12, 16], 'text-transform': 'uppercase', 'text-letter-spacing': 0.12, 'text-max-width': 8 },
        paint: { 'text-color': ['interpolate', ['linear'], ['zoom'], 4, '#5F758A', 10, '#4A5F73'], 'text-halo-color': '#1C262F', 'text-halo-width': 2, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.9, 12, 0.6] },
        minzoom: 4 },
      { id: 'label-city', type: 'symbol', source: 'ofm', 'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town', 'village'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 10, 13], 'text-max-width': 8 },
        paint: { 'text-color': '#8A9FB0', 'text-halo-color': '#1C262F', 'text-halo-width': 1.5 } },
      { id: 'label-country', type: 'symbol', source: 'ofm', 'source-layer': 'place',
        filter: ['==', 'class', 'country'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 14], 'text-transform': 'uppercase', 'text-letter-spacing': 0.15 },
        paint: { 'text-color': '#5F758A', 'text-halo-color': '#1C262F', 'text-halo-width': 2 } },
    ]
  };
}

function _buildSatelliteStyle() {
  const H = _HERE_SAT_KEY;
  return {
    version: 8,
    glyphs: '/fonts/{fontstack}/{range}.pbf',
    sources: {
      'here-sat': {
        type: 'raster',
        tiles: [`https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png?style=satellite.day&apiKey=${H}`],
        tileSize: 256,
        maxzoom: 20,
        attribution: '© HERE Maps'
      }
    },
    layers: [
      { id: 'satellite', type: 'raster', source: 'here-sat', paint: { 'raster-opacity': 1 } }
    ]
  };
}

// ─── HERE raster fallback (acionado quando OpenFreeMap fica indisponível) ────
// Não usa vector tiles; usa HERE Map Tile API v3 (mesma key do satellite).
// `explore.night` para dark, `lite.day` para light. Visual difere do vector
// (sem custom paint HYPR), mas mantém o app funcional. Sem dependência de glyphs
// externos: o HERE renderiza labels server-side direto no raster.
function _buildHereRasterStyle(theme) {
  const H = _HERE_SAT_KEY;
  const style = theme === 'light' ? 'lite.day' : 'explore.night';
  return {
    version: 8,
    glyphs: '/fonts/{fontstack}/{range}.pbf',
    sources: {
      'here-raster': {
        type: 'raster',
        tiles: [`https://maps.hereapi.com/v3/base/mc/{z}/{x}/{y}/png?style=${style}&size=512&apiKey=${H}`],
        tileSize: 512,
        maxzoom: 20,
        attribution: '© HERE Maps'
      }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': theme === 'light' ? '#f0f4f8' : '#1C262F' } },
      { id: 'here-raster-layer', type: 'raster', source: 'here-raster', paint: { 'raster-opacity': 1 } }
    ]
  };
}

// ─── Tile circuit breaker ────────────────────────────────────────────────────
// Monitora falhas de fetch nos tiles do OpenFreeMap. Se 3+ erros em 10s,
// faz setStyle() pro fallback HERE raster e mostra banner discreto no mapa.
// `_tileErrorCount` reseta a cada janela de 10s; só dispara fallback uma vez por sessão.
var _tileFailures = [];      // timestamps (ms) das falhas recentes
var _fallbackActive = false; // já fez switch pro HERE nesta sessão?
var _NETWORK_BLOCK_HINT = false; // detectou padrão de ERR_CONNECTION_CLOSED?

function _trackTileFailure(errorMessage) {
  var now = Date.now();
  _tileFailures = _tileFailures.filter(function(t) { return now - t < 10000; });
  _tileFailures.push(now);

  // Heurística: ERR_CONNECTION_CLOSED / Failed to fetch sem CORS sugere
  // bloqueio de rede local (firewall corporativo, extensão de inspeção TLS).
  var msg = String(errorMessage || '').toLowerCase();
  if (msg.indexOf('failed to fetch') !== -1 || msg.indexOf('connection_closed') !== -1 || msg.indexOf('err_network') !== -1) {
    _NETWORK_BLOCK_HINT = true;
  }

  if (_tileFailures.length >= 3 && !_fallbackActive) {
    _activateTileFallback();
  }
}

function _activateTileFallback() {
  if (_fallbackActive || !map) return;
  _fallbackActive = true;
  console.warn('[Geocodify][tiles] OpenFreeMap indisponível — alternando para HERE raster fallback');

  try {
    var theme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    var center = map.getCenter();
    var zoom = map.getZoom();
    var bearing = map.getBearing();
    var pitch = map.getPitch();

    map.setStyle(_buildHereRasterStyle(theme));
    map.once('styledata', function() {
      map.jumpTo({ center: center, zoom: zoom, bearing: bearing, pitch: pitch });
      try { _setupMapSources(); } catch(_) {}
      try { _setupMapInteractions(); } catch(_) {}
      if (filteredData.length > 0) {
        try { renderMarkers(); } catch(_) {}
      }
    });

    _showTileBanner(_NETWORK_BLOCK_HINT);
  } catch (e) {
    console.error('[Geocodify][tiles] fallback failed:', e);
  }
}

function _showTileBanner(networkHint) {
  // Remove banner existente
  var existing = document.getElementById('tile-fallback-banner');
  if (existing) existing.remove();

  var banner = document.createElement('div');
  banner.id = 'tile-fallback-banner';
  banner.style.cssText = 'position:absolute;top:14px;left:50%;transform:translateX(-50%);' +
    'background:rgba(28,38,47,0.92);backdrop-filter:blur(16px) saturate(1.6);-webkit-backdrop-filter:blur(16px) saturate(1.6);' +
    'border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:10px 14px;' +
    'color:#E5EBF2;font-family:Urbanist,sans-serif;font-size:12px;line-height:1.4;' +
    'box-shadow:0 8px 24px rgba(0,0,0,0.32);z-index:5;max-width:520px;display:flex;align-items:center;gap:10px;';

  var msg = networkHint
    ? '<strong style="color:#FF5528;">Mapa em modo fallback (HERE)</strong> · OpenFreeMap inacess&iacute;vel — poss&iacute;vel bloqueio de rede local ou extens&atilde;o de inspe&ccedil;&atilde;o TLS no Chrome.'
    : '<strong style="color:#EDD900;">Mapa em modo fallback (HERE)</strong> · OpenFreeMap indispon&iacute;vel — usando provedor alternativo.';

  banner.innerHTML =
    '<span style="font-size:14px;">⚠</span>' +
    '<span style="flex:1;">' + msg + '</span>' +
    '<button id="tile-banner-close" style="background:transparent;border:0;color:#78909C;cursor:pointer;padding:0 4px;font-size:16px;line-height:1;">×</button>';

  var container = document.getElementById('map');
  if (container) {
    container.appendChild(banner);
    var closeBtn = document.getElementById('tile-banner-close');
    if (closeBtn) closeBtn.addEventListener('click', function() { banner.remove(); });
    // Auto-dismiss em 30s
    setTimeout(function() { if (banner.parentNode) banner.remove(); }, 30000);
  }
}

// MAP_STYLES — inicializado aqui pois _buildDarkStyle e _buildSatelliteStyle já existem
function _initMapStyles() {
  if (MAP_STYLES) return;
  MAP_STYLES = {
    dark:      _buildDarkStyle(),
    street:    'https://tiles.openfreemap.org/styles/positron',
    explore:   'https://tiles.openfreemap.org/styles/liberty',
    satellite: _buildSatelliteStyle(),
  };
}


// ─── Map Init ────────────────────────────────────────────────────────────────
function initMap() {
  _initMapStyles();
  map = new maplibregl.Map({
    container: 'map',
    style: (document.documentElement.getAttribute('data-theme') === 'light') ? _buildLightMapStyle() : MAP_STYLES.dark,
    center: [-47.9292, -15.7801],
    zoom: 4.5,
    attributionControl: false,
    pitchWithRotate: false,
  });

  // Zoom controls customizados
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

  // ─── Tile error tracking ────────────────────────────────────────────────
  // MapLibre dispara `error` para falhas de fetch de tiles e sources.
  // Detectamos especificamente erros em openfreemap.org e disparamos circuit breaker.
  map.on('error', function(e) {
    if (!e || !e.error) return;
    var msg = e.error.message || e.error.toString() || '';
    var src = (e.source && e.source.url) || (e.tile && e.tile.tileID) || '';
    // Filtra apenas erros relacionados ao OpenFreeMap (não estoura fallback por erro de pdv-source etc.)
    var isOFM = msg.indexOf('openfreemap') !== -1 || String(src).indexOf('openfreemap') !== -1
      || (e.sourceId === 'ofm');
    // Erros de fetch sem source identificado também contam (CORS/network failures não anexam sourceId)
    var isNetworkErr = msg.indexOf('Failed to fetch') !== -1
      || msg.indexOf('CONNECTION_CLOSED') !== -1
      || msg.indexOf('ERR_NETWORK') !== -1;
    if (isOFM || (isNetworkErr && !_fallbackActive)) {
      _trackTileFailure(msg);
    }
  });

  map.on('load', () => {
    _setupMapSources();
    _setupMapInteractions();
    // Se já há dados carregados (mapa aberto da galeria), plotar imediatamente
    if (filteredData.length > 0) renderMarkers();
  });
}

// Modo competitivo atual usado pelos clusterProperties.
// Quando muda (Solo→Duelo, Duelo→Categoria, Categoria com N marcas ≠ N anterior),
// _setupMapSources precisa ser re-executado para reconstruir os agregadores.
var _currentClusterAggMode = null; // 'solo' | 'duelo' | 'categoria:N'

function _computeClusterAggMode() {
  try {
    if (window.V360CompRender && typeof window.V360CompRender.getMode === 'function') {
      var mode = window.V360CompRender.getMode();
      if (mode === 'duelo') return 'duelo';
      if (mode === 'categoria') {
        var brands = window.V360CompRender.brandsList();
        var n = 1 + (brands.others || []).length;
        return 'categoria:' + n;
      }
    }
  } catch(_) {}
  return 'solo';
}

function _buildClusterPropertiesForMode(mode) {
  // Modo Solo e Duelo usam o mesmo schema (cat: 1-4) — 4 agregadores fixos
  if (mode === 'solo' || mode === 'duelo') {
    return {
      'c_win':     ['+', ['case', ['==', ['get','cat'], 1], 1, 0]],
      'c_lose':    ['+', ['case', ['==', ['get','cat'], 2], 1, 0]],
      'c_neutral': ['+', ['case', ['==', ['get','cat'], 3], 1, 0]],
      'c_absent':  ['+', ['case', ['==', ['get','cat'], 4], 1, 0]],
    };
  }
  // Modo Categoria: 1 agregador por marca (até N marcas)
  if (mode && mode.indexOf('categoria:') === 0) {
    var n = parseInt(mode.split(':')[1], 10) || 0;
    var props = {};
    for (var i = 0; i < n; i++) {
      props['c_b' + i] = ['+', ['case', ['==', ['get','brand_idx'], i], 1, 0]];
    }
    return props;
  }
  return {};
}

function _setupMapSources() {
  // Limpar layers e source anteriores se existirem (ex: após trocar de layer)
  ['clusters','cluster-count','pdv-points'].forEach(id => {
    try { if (map.getLayer(id)) map.removeLayer(id); } catch(e) {}
  });
  try { if (map.getSource('pdvs')) map.removeSource('pdvs'); } catch(e) {}

  // Limpar donut markers de render anterior (troca de layer/tema)
  _clearClusterDonuts();

  _currentClusterAggMode = _computeClusterAggMode();

  map.addSource('pdvs', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterMaxZoom: 11,       // transição mais cedo para dots individuais
    clusterRadius: 44,        // raio em pixels para agrupar
    // Agregadores por categoria — montados conforme o modo competitivo
    clusterProperties: _buildClusterPropertiesForMode(_currentClusterAggMode),
  });

  // Layer de clusters — INVISÍVEL (opacity 0) mas preservada para
  // queryRenderedFeatures (box-select, click handler). Os donuts visíveis
  // são renderizados via _renderClusterDonuts() como HTML markers por cima.
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'pdvs',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': 'rgba(0,0,0,0)',
      'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'],
        1, 18, 10, 24, 50, 30, 200, 36, 1000, 42
      ],
      'circle-opacity': 0,
      'circle-stroke-width': 0,
    },
  });

  // Layer de pontos individuais (não clusterizados) — maiores e com halo sutil
  map.addLayer({
    id: 'pdv-points',
    type: 'circle',
    source: 'pdvs',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 5, 12, 7, 14, 9, 18, 12],
      'circle-stroke-width': ['case', ['==', ['get', '_selected'], 1], 3, 1.5],
      'circle-stroke-color': ['case', ['==', ['get', '_selected'], 1], '#ffffff', _cssVar('--circle-stroke-hover')],
      'circle-opacity': ['case', ['==', ['get', '_dim'], 1], 0.3, 0.95],
      'circle-blur': 0.05,
    },
  });

  // Hook de re-render dos donuts sempre que viewport ou source mudarem
  _bindClusterDonutEvents();
}

// ─── Cluster Donut Markers ───────────────────────────────────────────────────
// Renderiza HTML markers sobre cada cluster com um donut SVG mostrando a
// composição por categoria (win/lose/neutral/absent). Markers são poolados
// e reutilizados a cada sync para evitar GC churn.
var _clusterMarkerPool = new Map(); // cluster_id -> { marker, el, sig }
var _clusterDonutBound = false;
var _clusterDonutRAF = null;

function _clearClusterDonuts() {
  _hideClusterTooltip(); // qualquer tooltip que esteja aberto será órfão após o clear
  if (_clusterMarkerPool && _clusterMarkerPool.size) {
    _clusterMarkerPool.forEach(function(entry) {
      try { entry.marker.remove(); } catch(_) {}
    });
    _clusterMarkerPool.clear();
  }
}

// ─── Cluster Tooltip (singleton global) ─────────────────────────────────────
// Um único nó de tooltip vive no document.body. Ele é mostrado/escondido por
// hover dos donuts. Esse padrão singleton evita "tooltip fantasma" quando o
// marker sob o cursor é removido pelo pool antes de disparar mouseleave (caso
// comum durante pan/zoom, troca de modo competitivo ou mudança de tema).
var _clusterTooltipEl = null;
var _clusterTooltipOwnerId = null; // cluster_id do marker que está exibindo o tooltip

function _getOrCreateTooltipEl() {
  if (_clusterTooltipEl && document.body.contains(_clusterTooltipEl)) return _clusterTooltipEl;
  _clusterTooltipEl = document.createElement('div');
  _clusterTooltipEl.className = 'cluster-tooltip';
  _clusterTooltipEl.style.display = 'none';
  document.body.appendChild(_clusterTooltipEl);
  return _clusterTooltipEl;
}

function _showClusterTooltip(ownerId, innerHTML, anchorEl) {
  var el = _getOrCreateTooltipEl();
  el.innerHTML = innerHTML;
  el.style.display = 'block';
  _clusterTooltipOwnerId = ownerId;
  _positionTooltipNearEl(el, anchorEl);
}

function _hideClusterTooltip() {
  if (_clusterTooltipEl) {
    _clusterTooltipEl.style.display = 'none';
    _clusterTooltipEl.innerHTML = '';
  }
  _clusterTooltipOwnerId = null;
}

// Hide tooltip se ele pertencia a um marker que está sendo destruído
function _maybeHideTooltipFor(clusterId) {
  if (_clusterTooltipOwnerId === clusterId) _hideClusterTooltip();
}

function _bindClusterDonutEvents() {
  if (_clusterDonutBound || !map) return;
  _clusterDonutBound = true;
  var schedule = function() {
    if (_clusterDonutRAF) return;
    _clusterDonutRAF = requestAnimationFrame(function() {
      _clusterDonutRAF = null;
      _renderClusterDonuts();
    });
  };
  // IMPORTANTE: não escutar 'move'/'zoom' (frame-by-frame). Durante o pan o
  // MapLibre reposiciona os markers existentes pela LngLat automaticamente —
  // re-rodar queryRenderedFeatures + setLngLat a cada frame causa "flutuação"
  // porque supercluster pode fundir/desfundir clusters durante o gesto.
  // Reconciliamos apenas quando o usuário PARA de mover/zoomar.
  var onGestureStart = function() {
    _hideClusterTooltip();
    var c = map.getContainer(); if (c) c.classList.add('cluster-donuts-dim');
  };
  var onGestureEnd = function() {
    var c = map.getContainer(); if (c) c.classList.remove('cluster-donuts-dim');
    schedule();
  };
  map.on('movestart', onGestureStart);
  map.on('zoomstart', onGestureStart);
  map.on('moveend', onGestureEnd);
  map.on('zoomend', onGestureEnd);
  map.on('sourcedata', function(e) {
    if (e.sourceId === 'pdvs' && e.isSourceLoaded) schedule();
  });
}

function _renderClusterDonuts() {
  if (!map || !map.getLayer('clusters')) return;
  // Skip enquanto estilo não carregou — evita query em source não pronta
  try { if (!map.isStyleLoaded()) return; } catch(_) { return; }

  var feats;
  try {
    feats = map.queryRenderedFeatures({ layers: ['clusters'] });
  } catch(_) {
    return;
  }

  // Detectar modo: Solo/Duelo usam contadores fixos; Categoria usa contadores por marca
  var aggMode = _currentClusterAggMode || 'solo';
  var isCategoria = aggMode.indexOf('categoria:') === 0;
  var brandCount = isCategoria ? parseInt(aggMode.split(':')[1], 10) || 0 : 0;
  // Cache de cores ordenadas em modo Categoria (uma vez por render pass)
  var brandColors = null;
  if (isCategoria && _categoryBrandIdxCache) {
    brandColors = _categoryBrandIdxCache.ordered.map(function(b) {
      return _categoryBrandIdxCache.colorMap[b] || '#94a3b8';
    });
  }

  var seen = new Set();
  for (var i = 0; i < feats.length; i++) {
    var f = feats[i];
    var p = f.properties || {};
    var cid = p.cluster_id;
    if (cid === undefined || cid === null) continue;
    seen.add(cid);

    var total = p.point_count || 0;

    // Sig PRIMEIRO (concat barato). Só monta SVG se cache miss — evita 50–200ms
    // por moveend em mapas estáveis onde o pool já está aquecido.
    var sig;
    var winC = 0, loseC = 0, neuC = 0, absC = 0;        // solo/duelo
    var brandCounts = null;                              // categoria
    var isSingleColorMode = currentMapType === 'places_discovery' ||
                            currentMapType === 'geocoder' ||
                            currentMapType === 'reverse_geocoder';

    if (isSingleColorMode) {
      sig = total + '|' + currentMapType;
    } else if (isCategoria && brandColors) {
      brandCounts = new Array(brandCount);
      var sigParts = [String(total)];
      for (var b = 0; b < brandCount; b++) {
        var count = p['c_b' + b] || 0;
        brandCounts[b] = count;
        sigParts.push(String(count));
      }
      sig = sigParts.join('|');
    } else {
      winC = p.c_win || 0; loseC = p.c_lose || 0; neuC = p.c_neutral || 0; absC = p.c_absent || 0;
      sig = total + '|' + winC + '|' + loseC + '|' + neuC + '|' + absC;
    }

    var entry = _clusterMarkerPool.get(cid);
    var coords = f.geometry && f.geometry.coordinates;
    if (!coords) continue;

    // Cache hit: só reposiciona o marker e segue.
    if (entry && entry.sig === sig) {
      try { entry.marker.setLngLat(coords); } catch(_) {}
      continue;
    }

    // Cache miss: monta o SVG.
    var svgHtml;
    if (isSingleColorMode) {
      // Modos sem categoria competitiva: anel único na cor de assinatura da
      // marca do modo. Sem esse caminho, todos os c_* ficam em 0 e o donut
      // renderiza só o miolo, deixando o cluster invisível no modo dark.
      //   Places Discovery   → purple
      //   Lat/Lon Generator  → accent (teal)
      //   Address Generator  → sky (cyan)
      if (!_pinColors) _refreshPinColors();
      // Places Discovery + Lat/Lon Generator: ambos usam accent (HYPR brand teal).
      // Reverse Geocoder: sky (#03A9F5) — único modo "Generator" diferenciado.
      // Varejo 360 nunca cai aqui (não é single-color, usa status palette).
      var modeColor = currentMapType === 'reverse_geocoder' ? _pinColors.sky
                                                            : _pinColors.accent;
      svgHtml = _buildDonutSVGFromSegments(total, [
        { color: modeColor, count: total }
      ]);
    } else if (brandCounts) {
      // Modo Categoria: 1 segmento por marca
      var brandSegs = new Array(brandCount);
      for (var bb = 0; bb < brandCount; bb++) {
        brandSegs[bb] = { color: brandColors[bb], count: brandCounts[bb] };
      }
      svgHtml = _buildDonutSVGFromSegments(total, brandSegs);
    } else {
      svgHtml = _buildDonutSVG(total, winC, loseC, neuC, absC);
    }

    if (!entry) {
      var el = document.createElement('div');
      el.className = 'cluster-donut';
      el.style.cssText = 'position:absolute;transform:translate(-50%,-50%);cursor:pointer;pointer-events:auto;';
      el.innerHTML = svgHtml;
      _attachDonutInteractions(el, cid, coords);
      var marker = new maplibregl.Marker({ element: el, anchor: 'center' })
        .setLngLat(coords)
        .addTo(map);
      _clusterMarkerPool.set(cid, { marker: marker, el: el, sig: sig });
    } else {
      entry.el.innerHTML = svgHtml;
      entry.sig = sig;
      try { entry.marker.setLngLat(coords); } catch(_) {}
    }
  }

  // Remover markers que não estão mais visíveis
  _clusterMarkerPool.forEach(function(entry, cid) {
    if (!seen.has(cid)) {
      _maybeHideTooltipFor(cid); // evita tooltip órfão se marker era o owner
      try { entry.marker.remove(); } catch(_) {}
      _clusterMarkerPool.delete(cid);
    }
  });
}

// SVG do donut — recebe array genérico de segmentos [{color, count}, ...]
// Compatível com Solo/Duelo (4 segmentos) e Categoria (N marcas).
function _buildDonutSVGFromSegments(total, segments) {
  // Raio externo: escala log-suavizada, comprimida para evitar que clusters
  // grandes (4k+) dominem a tela visualmente. A diferença perceptual entre
  // 200 e 4000 PDVs não precisa ser linear — basta sinalizar "grande".
  var R;
  if (total <= 5)         R = 15;
  else if (total <= 25)   R = 17;
  else if (total <= 75)   R = 19;
  else if (total <= 200)  R = 22;
  else if (total <= 500)  R = 25;
  else if (total <= 1500) R = 27;
  else                    R = 29;

  var sw = Math.max(4, Math.round(R * 0.22)); // espessura do anel
  var size = R * 2 + 4;
  var cx = size / 2, cy = size / 2;
  var ringR = R - sw / 2; // raio do centro do stroke
  var circ = 2 * Math.PI * ringR;

  var safeTotal = Math.max(1, total);

  // Construir segmentos como stroke-dasharray rotativos
  var segs = '';
  var offset = 0;
  for (var i = 0; i < segments.length; i++) {
    var seg = segments[i];
    if (!seg || !seg.count || seg.count <= 0) continue;
    var len = (seg.count / safeTotal) * circ;
    segs += '<circle cx="' + cx + '" cy="' + cy + '" r="' + ringR +
      '" fill="none" stroke="' + seg.color + '" stroke-width="' + sw +
      '" stroke-dasharray="' + len.toFixed(2) + ' ' + (circ - len).toFixed(2) +
      '" stroke-dashoffset="' + (-offset).toFixed(2) + '"/>';
    offset += len;
  }

  // Label: número (com formatação k para >=1000)
  var label = total >= 1000 ? (Math.floor(total / 100) / 10).toFixed(1).replace(/\.0$/, '') + 'k' : String(total);
  var fontSize = R >= 28 ? 12 : R >= 22 ? 11 : 10;

  // Tokens lidos do cache _pinColors (populado 1×/render pass em
  // _refreshPinColors). Antes eram 3 chamadas getComputedStyle por marker.
  if (!_pinColors) _refreshPinColors();
  var bgFill = _pinColors.mapBg;
  var haloStroke = _pinColors.circleStroke;
  var textFill = _pinColors.textCanvas;

  return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 ' + size + ' ' + size + '" style="display:block;overflow:visible">' +
    // Halo externo sutil
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + (R + 0.5) + '" fill="none" stroke="' + haloStroke + '" stroke-width="0.5"/>' +
    // Preenchimento interno (cobre o "miolo" do donut)
    '<circle cx="' + cx + '" cy="' + cy + '" r="' + (ringR - sw / 2 + 0.5) + '" fill="' + bgFill + '"/>' +
    // Segmentos do donut (rotação -90° para começar no topo)
    '<g transform="rotate(-90 ' + cx + ' ' + cy + ')">' + segs + '</g>' +
    // Número central
    '<text x="' + cx + '" y="' + cy + '" text-anchor="middle" dominant-baseline="central" font-size="' + fontSize + '" font-weight="600" font-family="Urbanist, sans-serif" fill="' + textFill + '">' + label + '</text>' +
    '</svg>';
}

// Wrapper retrocompatível para Solo/Duelo (4 categorias fixas).
function _buildDonutSVG(total, win, lose, neu, abs) {
  if (!_pinColors) _refreshPinColors();
  // Ordem visual: vence → disputa → perde → ausência (sentido horário)
  return _buildDonutSVGFromSegments(total, [
    { color: _pinColors.win,     count: win },
    { color: _pinColors.neutral, count: neu },
    { color: _pinColors.lose,    count: lose },
    { color: _pinColors.absent,  count: abs },
  ]);
}

// Tooltip + click handlers para cada donut
function _attachDonutInteractions(el, clusterId, coords) {
  el.addEventListener('mouseenter', function() {
    var entry = _clusterMarkerPool.get(clusterId);
    if (!entry) return;
    // Re-query features para pegar contagens atualizadas
    var feats;
    try { feats = map.queryRenderedFeatures({ layers: ['clusters'] }); }
    catch(_) { return; }
    var feat = null;
    for (var i = 0; i < feats.length; i++) {
      if (feats[i].properties && feats[i].properties.cluster_id === clusterId) { feat = feats[i]; break; }
    }
    if (!feat) return;
    var p = feat.properties || {};
    var total = p.point_count || 0;
    // Construir conteúdo (HTML string) e mostrar via singleton
    var contentEl;
    var aggMode = _currentClusterAggMode || 'solo';
    if (aggMode.indexOf('categoria:') === 0 && _categoryBrandIdxCache) {
      var brandCount = parseInt(aggMode.split(':')[1], 10) || 0;
      var brandRows = [];
      for (var b = 0; b < brandCount; b++) {
        var brandName = _categoryBrandIdxCache.ordered[b];
        var color = _categoryBrandIdxCache.colorMap[brandName] || '#94a3b8';
        var count = p['c_b' + b] || 0;
        if (count > 0) brandRows.push({ label: brandName, n: count, c: color });
      }
      contentEl = _buildClusterTooltipRows(total, brandRows);
    } else {
      var win = p.c_win || 0, lose = p.c_lose || 0, neu = p.c_neutral || 0, abs = p.c_absent || 0;
      contentEl = _buildClusterTooltip(total, win, lose, neu, abs);
    }
    _showClusterTooltip(clusterId, contentEl.innerHTML, el);
  });

  el.addEventListener('mousemove', function() {
    if (_clusterTooltipOwnerId === clusterId && _clusterTooltipEl) {
      _positionTooltipNearEl(_clusterTooltipEl, el);
    }
  });

  el.addEventListener('mouseleave', function() {
    _maybeHideTooltipFor(clusterId);
  });

  el.addEventListener('click', function(ev) {
    // Cmd/Ctrl+click: delega para o handler nativo do map (que faz select de leaves)
    // Comportamento padrão: zoom in
    var isModifier = ev.metaKey || ev.ctrlKey;
    if (isModifier && currentMapType === 'varejo360' && currentUser && !_isSharedMode) {
      var src = map.getSource('pdvs');
      if (src && typeof src.getClusterLeaves === 'function') {
        src.getClusterLeaves(clusterId, Infinity, 0).then(function(leaves) {
          if (!_selectionMode) startSelectionMode();
          var added = 0;
          leaves.forEach(function(leaf) {
            var mapId = leaf.properties && leaf.properties._mapId;
            if (mapId === undefined) return;
            var row = allData.find(function(r) { return r._mapId === mapId; });
            if (row && row.id && !_selectedIds.has(row.id)) {
              _selectedIds.add(row.id);
              added++;
            }
          });
          try { updateSelectionBar(); } catch(_) {}
          renderMarkers();
        }).catch(function(){});
        return;
      }
    }
    // Zoom in
    var src2 = map.getSource('pdvs');
    if (src2 && typeof src2.getClusterExpansionZoom === 'function') {
      src2.getClusterExpansionZoom(clusterId).then(function(zoom) {
        map.easeTo({ center: coords, zoom: Math.min(zoom + 0.5, 14), duration: 400 });
      }).catch(function() {
        map.easeTo({ center: coords, zoom: map.getZoom() + 2, duration: 400 });
      });
    }
  });
}

// Tooltip genérico — recebe linhas arbitrárias [{label, n, c}, ...].
// Linhas com n<=0 são filtradas e ordenadas por contagem decrescente.
function _buildClusterTooltipRows(total, rows) {
  var el = document.createElement('div');
  el.className = 'cluster-tooltip';
  rows = (rows || []).filter(function(r) { return r && r.n > 0; })
                     .sort(function(a, b) { return b.n - a.n; });

  var totalFmt = total.toLocaleString('pt-BR');
  var html = '<div class="cluster-tt-header">' + totalFmt + ' PDV' + (total !== 1 ? 's' : '') + '</div>';
  html += '<div class="cluster-tt-body">';
  rows.forEach(function(r) {
    var pct = total > 0 ? Math.round((r.n / total) * 100) : 0;
    var labelSafe = String(r.label).replace(/[<>&"]/g, function(m){
      return { '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;' }[m];
    });
    html += '<div class="cluster-tt-row">' +
      '<span class="cluster-tt-dot" style="background:' + r.c + '"></span>' +
      '<span class="cluster-tt-label">' + labelSafe + '</span>' +
      '<span class="cluster-tt-val">' + r.n.toLocaleString('pt-BR') + ' <span class="cluster-tt-pct">· ' + pct + '%</span></span>' +
      '</div>';
  });
  html += '</div>';
  el.innerHTML = html;
  return el;
}

// Tooltip para Solo/Duelo — 4 grupos sinônimos
function _buildClusterTooltip(total, win, lose, neu, abs) {
  if (!_pinColors) _refreshPinColors();
  return _buildClusterTooltipRows(total, [
    { label: 'Vence',        n: win,  c: _pinColors.win },
    { label: 'Disputa',      n: neu,  c: _pinColors.neutral },
    { label: 'Perde',        n: lose, c: _pinColors.lose },
    { label: 'Sem presença', n: abs,  c: _pinColors.absent },
  ]);
}

function _positionTooltipNearEl(tooltipEl, anchorEl) {
  var rect = anchorEl.getBoundingClientRect();
  var ttRect = tooltipEl.getBoundingClientRect();
  var pad = 10;
  var top = rect.top - ttRect.height - pad;
  var left = rect.left + rect.width / 2 - ttRect.width / 2;
  // Se não couber acima, mostra abaixo
  if (top < 8) top = rect.bottom + pad;
  // Clamp horizontal
  left = Math.max(8, Math.min(window.innerWidth - ttRect.width - 8, left));
  tooltipEl.style.position = 'fixed';
  tooltipEl.style.top = top + 'px';
  tooltipEl.style.left = left + 'px';
}

function _setupMapInteractions() {
  // Expandir cluster ao clicar — ou selecionar leaves se Cmd/Ctrl+click (V360)
  map.on('click', 'clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    if (!features.length) return;
    const clusterId = features[0].properties.cluster_id;
    const coords = features[0].geometry.coordinates;

    // Cmd (Mac) / Ctrl (Win/Linux) + click: seleciona todos os pins do cluster
    // em vez de expandir. Gating: V360 + dono + não shared.
    const isModifierClick = e.originalEvent && (e.originalEvent.metaKey || e.originalEvent.ctrlKey);
    if (isModifierClick
        && currentMapType === 'varejo360'
        && currentUser && !_isSharedMode) {
      const src = map.getSource('pdvs');
      if (src && typeof src.getClusterLeaves === 'function') {
        src.getClusterLeaves(clusterId, Infinity, 0).then((leaves) => {
          if (!_selectionMode) startSelectionMode();
          var added = 0;
          leaves.forEach((leaf) => {
            var mapId = leaf.properties && leaf.properties._mapId;
            if (mapId === undefined) return;
            var row = allData.find((r) => r._mapId === mapId);
            if (row && row.id && !_selectedIds.has(row.id)) {
              _selectedIds.add(row.id);
              added++;
            }
          });
          console.debug('[cluster-select] adicionados:', added, 'de', leaves.length, 'leaves');
          try { updateSelectionBar(); } catch(_) {}
          renderMarkers();
        }).catch((err) => {
          console.warn('[cluster-select] getClusterLeaves falhou:', err);
        });
        return;
      }
    }

    // Comportamento padrão: zoom in
    map.getSource('pdvs').getClusterExpansionZoom(clusterId).then(zoom => {
      map.easeTo({ center: coords, zoom: Math.min(zoom + 0.5, 14), duration: 400 });
    }).catch(() => {
      map.easeTo({ center: coords, zoom: map.getZoom() + 2, duration: 400 });
    });
  });

  // Popup ao clicar no ponto (ou toggle de seleção em modo seleção)
  map.on('click', 'pdv-points', (e) => {
    const props = e.features[0].properties;
    const row = allData.find(r => r._mapId === props._mapId);
    if (!row) return;

    // Cmd (Mac) / Ctrl (Win/Linux) + click ativa modo seleção automaticamente
    // se ainda não estiver ativo e o usuário tiver permissão para deletar.
    const isModifierClick = e.originalEvent && (e.originalEvent.metaKey || e.originalEvent.ctrlKey);
    if (isModifierClick && !_selectionMode
        && currentMapType === 'varejo360'
        && currentUser && !_isSharedMode
        && row.id) {
      startSelectionMode();
      _selectedIds.add(row.id);
      try { updateSelectionBar(); } catch(_) {}
      renderMarkers();
      return;
    }

    // Modo seleção: toggle no Set, não abre popup
    if (_selectionMode) {
      if (!row.id) return; // pin não persistido no banco — não pode deletar
      if (_selectedIds.has(row.id)) _selectedIds.delete(row.id);
      else _selectedIds.add(row.id);
      try { updateSelectionBar(); } catch(_) {}
      renderMarkers();
      return;
    }

    if (_popup) _popup.remove();
    const coords = e.features[0].geometry.coordinates.slice();
    // anchor: 'bottom' — popup cresce pra cima a partir do pin (previsível).
    // 'auto' deixava o popup descolado do pin em alguns cliques.
    _popup = new maplibregl.Popup({ maxWidth: '340px', closeButton: true, anchor: 'bottom' })
      .setLngLat(coords)
      .setHTML(buildPopup(row))
      .addTo(map);
    // Se o popup estoura no topo do viewport, pan o mapa pra encaixar — sem
    // animação (duration: 0). Acontece no mesmo frame, sem sensação de salto.
    requestAnimationFrame(() => {
      if (!_popup) return;
      const popupEl = _popup.getElement();
      if (!popupEl) return;
      const rect = popupEl.getBoundingClientRect();
      const mapRect = map.getContainer().getBoundingClientRect();
      const overflow = mapRect.top - rect.top + 16; // 16px de respiro
      if (overflow > 0) {
        map.panBy([0, -overflow], { duration: 0 });
      }
    });
  });

  // Cursor pointer (apenas pdv-points — donut markers HTML já têm cursor:pointer inline)
  map.on('mouseenter', 'pdv-points', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'pdv-points', () => map.getCanvas().style.cursor = '');

  // Box selection (Cmd/Ctrl + drag) — Varejo 360
  _setupBoxSelection();
}

// Box selection: Cmd (Mac) ou Ctrl (Win/Linux) + arrastar desenha um
// retângulo no mapa. Pins dentro do retângulo são adicionados à seleção
// e o modo de seleção é ativado se ainda não estiver. Drag-pan do mapa
// fica desabilitado só enquanto o retângulo está sendo desenhado.
var _boxSelectInited = false;
function _setupBoxSelection() {
  if (_boxSelectInited) return;
  _boxSelectInited = true;

  var canvas = map.getCanvasContainer();
  var startPt = null;
  var box = null;
  var dragging = false;
  var DRAG_THRESHOLD = 5; // px

  function mousePos(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  canvas.addEventListener('mousedown', function(e) {
    // Só ativa com modifier (Cmd no Mac, Ctrl no Win/Linux)
    if (!(e.metaKey || e.ctrlKey)) return;
    // Botão esquerdo apenas
    if (e.button !== 0) return;
    // Gating: V360 + dono + não shared
    if (currentMapType !== 'varejo360') return;
    if (!currentUser || _isSharedMode) return;

    startPt = mousePos(e);
    dragging = false;

    // Desabilita pan/zoom imediatamente pra evitar competição de handlers
    try { map.dragPan.disable(); } catch(_) {}
    try { map.boxZoom.disable(); } catch(_) {}

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('keydown', onKey);
  });

  function onMove(e) {
    if (!startPt) return;
    var p = mousePos(e);
    var dx = Math.abs(p.x - startPt.x);
    var dy = Math.abs(p.y - startPt.y);

    // Detecta drag depois de cruzar o threshold
    if (!dragging && (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD)) {
      dragging = true;
      box = document.createElement('div');
      box.className = 'map-box-select';
      canvas.appendChild(box);
    }

    if (dragging && box) {
      var minX = Math.min(startPt.x, p.x);
      var maxX = Math.max(startPt.x, p.x);
      var minY = Math.min(startPt.y, p.y);
      var maxY = Math.max(startPt.y, p.y);
      box.style.left = minX + 'px';
      box.style.top = minY + 'px';
      box.style.width = (maxX - minX) + 'px';
      box.style.height = (maxY - minY) + 'px';
    }
  }

  function onUp(e) {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('keydown', onKey);

    var hadBox = dragging;
    var startBackup = startPt;
    var endPt = mousePos(e);

    // Cleanup visual + re-habilita interações do mapa
    if (box) { try { box.parentNode.removeChild(box); } catch(_) {} box = null; }
    try { map.dragPan.enable(); } catch(_) {}
    try { map.boxZoom.enable(); } catch(_) {}

    startPt = null;
    dragging = false;

    if (!hadBox) return; // não houve drag — handler de click cuida

    // Query features renderizadas dentro do bbox em pixels — pins individuais
    // e clusters separadamente (clusters precisam de getClusterLeaves async).
    var bbox = [
      [Math.min(startBackup.x, endPt.x), Math.min(startBackup.y, endPt.y)],
      [Math.max(startBackup.x, endPt.x), Math.max(startBackup.y, endPt.y)],
    ];
    var pinFeats, clusterFeats;
    try { pinFeats = map.queryRenderedFeatures(bbox, { layers: ['pdv-points'] }); }
    catch(err) { console.warn('[box-select] queryRenderedFeatures(pdv-points) falhou:', err); pinFeats = []; }
    try { clusterFeats = map.queryRenderedFeatures(bbox, { layers: ['clusters'] }); }
    catch(err) { console.warn('[box-select] queryRenderedFeatures(clusters) falhou:', err); clusterFeats = []; }

    if (!pinFeats.length && !clusterFeats.length) {
      console.debug('[box-select] nenhum pin/cluster no retângulo');
      return;
    }

    if (!_selectionMode) startSelectionMode();

    // 1) Pins individuais — sync
    var addedIndividual = 0;
    pinFeats.forEach(function(f) {
      var mapId = f.properties && f.properties._mapId;
      if (mapId === undefined) return;
      var row = allData.find(function(r) { return r._mapId === mapId; });
      if (row && row.id && !_selectedIds.has(row.id)) {
        _selectedIds.add(row.id);
        addedIndividual++;
      }
    });

    // 2) Clusters — async via getClusterLeaves
    var src = map.getSource('pdvs');
    if (!clusterFeats.length || !src || typeof src.getClusterLeaves !== 'function') {
      console.debug('[box-select] adicionados:', addedIndividual, 'pin(s) | visíveis:', pinFeats.length);
      try { updateSelectionBar(); } catch(_) {}
      renderMarkers();
      return;
    }

    var leafPromises = clusterFeats.map(function(cf) {
      var cid = cf.properties && cf.properties.cluster_id;
      if (cid === undefined) return Promise.resolve([]);
      return src.getClusterLeaves(cid, Infinity, 0).catch(function(err) {
        console.warn('[box-select] getClusterLeaves falhou para cluster', cid, err);
        return [];
      });
    });

    Promise.all(leafPromises).then(function(leavesArr) {
      var addedFromClusters = 0;
      leavesArr.forEach(function(leaves) {
        leaves.forEach(function(leaf) {
          var mapId = leaf.properties && leaf.properties._mapId;
          if (mapId === undefined) return;
          var row = allData.find(function(r) { return r._mapId === mapId; });
          if (row && row.id && !_selectedIds.has(row.id)) {
            _selectedIds.add(row.id);
            addedFromClusters++;
          }
        });
      });
      console.debug('[box-select] adicionados:', addedIndividual + addedFromClusters,
        '(pins:', addedIndividual, '| clusters:', addedFromClusters + ')',
        '| visíveis:', pinFeats.length, 'pin(s),', clusterFeats.length, 'cluster(s)');
      try { updateSelectionBar(); } catch(_) {}
      renderMarkers();
    });
  }

  function onKey(e) {
    if (e.key === 'Escape') {
      // Cancela o box em andamento
      if (box) { try { box.parentNode.removeChild(box); } catch(_) {} box = null; }
      try { map.dragPan.enable(); } catch(_) {}
      try { map.boxZoom.enable(); } catch(_) {}
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('keydown', onKey);
      startPt = null;
      dragging = false;
    }
  }
}

// ─── Pin Color ───────────────────────────────────────────────────────────────
// _pinColors: cache de CSS vars lido uma vez por renderMarkers() — evita
// getComputedStyle() por row (era ~15k chamadas em mapas grandes).
var _pinColors = null;

function _refreshPinColors() {
  _pinColors = {
    win: _cssVar('--win'),
    lose: _cssVar('--lose'),
    neutral: _cssVar('--neutral'),
    absent: _cssVar('--absent') || '#94a3b8',
    purple: _cssVar('--purple') || '#a855f7',
    // Assinaturas de marca por modo de mapa (cores HYPR — paleta de suporte).
    // Usadas em pinColor() + _renderClusterDonuts() para dar identidade visual
    // distinta a Lat/Lon Generator e Address Generator.
    accent: _cssVar('--accent') || '#3397B9',
    sky: _cssVar('--sky') || '#03A9F5',
    // Tokens lidos pelo SVG do donut. Cacheados aqui pra evitar 3 chamadas
    // getComputedStyle() por marker — em mapas com ~100 clusters visíveis isso
    // significava ~300 reflows síncronos por moveend/zoomend.
    mapBg: _cssVar('--map-bg') || (document.documentElement.getAttribute('data-theme') === 'light' ? '#ffffff' : '#0d1117'),
    circleStroke: _cssVar('--circle-stroke') || 'rgba(255,255,255,0.4)',
    textCanvas: _cssVar('--text-canvas') || '#ffffff',
  };
}

function pinColor(row) {
  if (!_pinColors) _refreshPinColors();
  // Modos single-color (não-V360): accent teal HYPR pra Places Discovery e
  // Lat/Lon Generator; sky pra Reverse Geocoder. Purple foi aposentado a
  // pedido do produto — HYPR teal é a cor universal de marca.
  if (currentMapType === 'places_discovery') return _pinColors.accent;
  if (currentMapType === 'geocoder') return _pinColors.accent;
  if (currentMapType === 'reverse_geocoder') return _pinColors.sky;
  // V360 Competitors PR2: delega para o módulo de render quando há concorrentes carregados
  try {
    if (window.V360CompRender && typeof window.V360CompRender.pinColor === 'function') {
      const c = window.V360CompRender.pinColor(row, _pinColors);
      if (c) return c;
    }
  } catch(_) {}
  const diff = parseFloat(row.percentual_diff_media_dimensao || 0);
  if (diff > 2) return _pinColors.win;
  if (diff < -2) return _pinColors.lose;
  // Faixa de média: separa "competindo" (com presença) de "sem presença"
  const share = parseFloat(row.share_reais_sku_dimensao || 0);
  if (share <= 0) return _pinColors.absent;
  return _pinColors.neutral;
}

// Categoria numérica (1=win, 2=lose, 3=neutral, 4=absent, 0=outros)
// Usada pelo clusterProperties para agregação eficiente no donut.
//
// Modo Solo:      diff vs média (±2pp) + share=0 → 4 categorias
// Modo Duelo:     mapeia 8 estados competitivos em 4 grupos sinônimos:
//                 Vence  = Dominância + Liderança + Exclusividade
//                 Disputa = Disputa
//                 Perde   = Atrás + Vulnerável
//                 Ausência = Oportunidade aberta + Whitespace
// Modo Categoria: retorna 0 (não usa schema 1-4; donut é montado via brand_idx)
function pinCategory(row) {
  if (currentMapType === 'places_discovery') return 0;
  // Geocoder/Reverse Geocoder: sem dados V360 → não usa schema 1-4. Retorna 0
  // pra que _renderClusterDonuts use o caminho de cor única por modo (assinatura
  // de marca em accent/sky) em vez de cair no fallback absent (cinza).
  if (currentMapType === 'geocoder' || currentMapType === 'reverse_geocoder') return 0;
  // V360 Competitors: mapeia conforme o modo
  try {
    if (window.V360CompRender && typeof window.V360CompRender.getMode === 'function') {
      var mode = window.V360CompRender.getMode();
      if (mode === 'duelo' || mode === 'categoria') {
        // Categoria usa brand_idx, não schema 1-4 → retorna 0
        if (mode === 'categoria') return 0;
        // Duelo: classifica e mapeia em 4 grupos
        var cls = window.V360CompRender.classifyRow(row);
        if (!cls) return 0;
        var STATE = window.V360CompRender.STATE;
        switch (cls.state) {
          case STATE.DOMINANCE:
          case STATE.LEADERSHIP:
          case STATE.EXCLUSIVE:
            return 1; // Vence
          case STATE.DISPUTE:
            return 3; // Disputa (mapeia para "neutral" cor amarela)
          case STATE.BEHIND:
          case STATE.VULNERABLE:
            return 2; // Perde
          case STATE.OPPORTUNITY:
          case STATE.WHITESPACE:
            return 4; // Ausência
          default:
            return 0;
        }
      }
    }
  } catch(_) {}
  // Solo (sem competitors): faixa de diff vs média
  const diff = parseFloat(row.percentual_diff_media_dimensao || 0);
  if (diff > 2) return 1;   // win
  if (diff < -2) return 2;  // lose
  const share = parseFloat(row.share_reais_sku_dimensao || 0);
  if (share <= 0) return 4; // absent
  return 3;                  // neutral
}

// Índice da marca líder (modo Categoria). Retorna -1 se não aplicável.
// Cacheado por sessão de render para evitar lookups repetidos no brandsList.
var _categoryBrandIdxCache = null;
function _refreshCategoryBrandIdxCache() {
  _categoryBrandIdxCache = null;
  try {
    if (window.V360CompRender && window.V360CompRender.getMode() === 'categoria') {
      var brands = window.V360CompRender.brandsList();
      // Ordem: perspective primeiro, depois others (estável)
      var ordered = [brands.perspective].concat(brands.others.filter(function(b){ return b && b !== brands.perspective; }));
      _categoryBrandIdxCache = {
        ordered: ordered,
        colorMap: brands.colorMap || {},
        idxByBrand: Object.fromEntries(ordered.map(function(b, i){ return [b, i]; })),
      };
    }
  } catch(_) {}
}
function pinCategoryBrandIdx(row) {
  if (!_categoryBrandIdxCache) return -1;
  try {
    var cls = window.V360CompRender.classifyRow(row);
    if (!cls || !cls.leaderBrand) return -1;
    var idx = _categoryBrandIdxCache.idxByBrand[cls.leaderBrand];
    return (idx === undefined) ? -1 : idx;
  } catch(_) { return -1; }
}

// ─── Render Markers (GeoJSON source update) ──────────────────────────────────
function renderMarkers() {
  if (!map) return;

  // Refresh color cache once per render pass (theme may have changed)
  _refreshPinColors();

  const _doRender = () => {
    if (!map.getSource('pdvs')) {
      _setupMapSources();
      _setupMapInteractions();
    } else {
      // Detectar mudança de modo competitivo: se o agregador atual não bate
      // com o modo presente, recriar source (clusterProperties é imutável após addSource).
      var modeNow = _computeClusterAggMode();
      if (modeNow !== _currentClusterAggMode) {
        _setupMapSources();
        // _setupMapInteractions já foi feito; só re-binda events de donut
      }
    }

    // Refresh do cache de índice de marca (modo Categoria) — feito uma vez por render
    _refreshCategoryBrandIdxCache();

    const features = filteredData
      .filter(r => parseFloat(r.lat) && parseFloat(r.lon))
      .map((r, i) => {
        if (r._mapId === undefined) r._mapId = i;
        var isSel = _selectionMode && r.id && _selectedIds.has(r.id);
        var isDim = _selectionMode && !isSel;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [parseFloat(r.lon), parseFloat(r.lat)] },
          properties: {
            color: pinColor(r),
            cat: pinCategory(r),
            brand_idx: pinCategoryBrandIdx(r), // -1 quando não está em modo Categoria
            _mapId: r._mapId,
            _selected: isSel ? 1 : 0,
            _dim: isDim ? 1 : 0,
          },
        };
      });

    try {
      map.getSource('pdvs').setData({ type: 'FeatureCollection', features });
    } catch(e) {
      // Source ainda não existe — tentar novamente
      setTimeout(_doRender, 200);
    }
  };

  // Se o mapa ainda está carregando o style, aguardar
  if (!map.isStyleLoaded()) {
    map.once('styledata', _doRender);
  } else {
    _doRender();
  }
}

// ─── Popup Builder ───────────────────────────────────────────────────────────
function pct(v) { return v != null ? (parseFloat(v) * 100).toFixed(1) + '%' : '—'; }
function pctRaw(v) { return v != null ? parseFloat(v).toFixed(1) + '%' : '—'; }
function buildPopup(row) {
  // Places Discovery: simplified popup with name, address, type, status
  if (row.place_id) {
    return `<div class="popup-inner">
      <div class="popup-header">
        <div class="popup-bandeira">${row.nome || row.bandeira || ''}</div>
        <div class="popup-address">${row.geo_address || ''}</div>
        ${row.place_types ? `<div style="font-size:11px;color:var(--text-muted);margin-top:6px;">${row.place_types}</div>` : ''}
        ${row.place_status ? `<div style="font-size:11px;margin-top:3px;color:${row.place_status === 'Aberto' ? 'var(--win)' : 'var(--text-muted)'}">${row.place_status}</div>` : ''}
      </div>
    </div>`;
  }

  // Geocoder / Reverse Geocoder: show name, address, coordinates
  if (currentMapType === 'geocoder' || currentMapType === 'reverse_geocoder') {
    // Nome: preferir nome/marca; nunca mostrar endereço como nome
    var name = row.nome || row.marca || row.nome_fantasia || '';
    if (!name || name === 'Carregando...' || name === 'Não identificado' || name === 'Desconhecido') {
      name = row.razao_social || '';
    }
    // Se bandeira contém " - " (formato HYPR) ou é igual ao endereço, não usar como nome
    var bnd = row.bandeira || '';
    if (bnd && bnd !== 'Carregando...' && bnd !== 'Não identificado' && bnd !== 'Desconhecido'
        && !bnd.includes(' - ') && bnd !== row.geo_address && bnd !== (row._endereco_livre || '')) {
      name = name || bnd;
    }
    var addr = row.geo_address || '';
    // Só mostrar CNPJ se é realmente um CNPJ (14 dígitos)
    var cnpjRaw = (row.cnpj || '').split(' - ')[0].replace(/\D/g, '');
    var cnpjDisplay = cnpjRaw.length >= 11 ? cnpjRaw : '';
    // Coordenadas
    var coords = (row.lat && row.lon) ? parseFloat(row.lat).toFixed(6) + ', ' + parseFloat(row.lon).toFixed(6) : '';
    return `<div class="popup-inner">
      <div class="popup-header" style="margin-bottom:0;padding-bottom:0;border-bottom:none;">
        ${name ? `<div class="popup-bandeira">${name}</div>` : ''}
        ${addr ? `<div class="popup-address">${addr}</div>` : ''}
        ${cnpjDisplay ? `<div style="font-size:11px;color:var(--text-muted);font-family:var(--mono);margin-top:6px;">CNPJ ${cnpjDisplay}</div>` : ''}
        ${coords ? `<div style="font-size:10px;color:var(--text-muted);font-family:var(--mono);margin-top:4px;">${coords}</div>` : ''}
      </div>
    </div>`;
  }

  // Varejo 360: full popup with metrics
  // V360 Competitors PR2: enriquece popup com mini-barras das marcas concorrentes
  // Fase 4: quando há extension (modo Duelo/Categoria), marca popup-inner com
  // .has-v360-ext pra esconder métricas legadas redundantes via CSS.
  try {
    if (window.V360CompRender && typeof window.V360CompRender.buildPopupExtension === 'function') {
      const ext = window.V360CompRender.buildPopupExtension(row);
      if (ext) {
        return _v360BuildPopupOriginal(row, ext, /*hasExt=*/true);
      }
    }
  } catch(_) {}
  return _v360BuildPopupOriginal(row, '', /*hasExt=*/false);
}

function _v360BuildPopupOriginal(row, compExtension, hasExt) {
  const diff = parseFloat(row.percentual_diff_media_dimensao || 0);
  const diffClass = diff > 2 ? 'positive' : diff < -2 ? 'negative' : '';
  const diffLabel = diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;

  const shareReis = parseFloat(row.share_reais_sku_dimensao || 0) * 100;
  const shareVol = parseFloat(row.share_volume_sku_dimensao || 0) * 100;
  const shareUn = parseFloat(row.share_unidades_sku_dimensao || 0) * 100;

  const maxShare = Math.max(shareReis, shareVol, shareUn, 1);

  const v360CnpjDisplay = row.cnpj_completo || (row.cnpj || '').split(' - ')[0];
  const addrDisplay = (row.cnpj || '').split(' - ').slice(1).join(' - ');

  return `<div class="popup-inner${hasExt ? ' has-v360-ext' : ''}">
    <div class="popup-header">
      <div class="popup-bandeira">${row.bandeira || 'Bandeira desconhecida'}</div>
      ${row.razao_social && row.razao_social !== row.bandeira ? `<div class="popup-fantasia">${row.razao_social}</div>` : ''}
      <div class="popup-address">${row.geo_address || addrDisplay}</div>
      <div class="popup-cnpj">CNPJ ${v360CnpjDisplay}${row.situacao && !/^ativa$/i.test(row.situacao.trim()) ? ` · <span style="color:var(--lose)">${row.situacao}</span>` : ''}${row.atividade ? `<div style="font-size:9px;color:var(--text-muted);margin-top:2px">${row.atividade.slice(0,60)}${row.atividade.length>60?'…':''}</div>` : ''}</div>
    </div>
    <div class="popup-metrics popup-metrics--legacy">
      <div class="popup-metric">
        <div class="popup-metric-val ${diffClass}">${diffLabel}</div>
        <div class="popup-metric-label">Diff vs. média dimensão</div>
      </div>
      <div class="popup-metric">
        <div class="popup-metric-val">${parseFloat(row.oportunidade_dimensao || 0).toFixed(2)}</div>
        <div class="popup-metric-label">Score oportunidade</div>
      </div>
      <div class="popup-metric">
        <div class="popup-metric-val">${pctRaw(row.percentual_dimensao)}</div>
        <div class="popup-metric-label">% dimensão total</div>
      </div>
      <div class="popup-metric">
        <div class="popup-metric-val">${pctRaw(row.percentual_marca_dimensao)}</div>
        <div class="popup-metric-label">% marca/dimensão</div>
      </div>
    </div>
    <div class="popup-section-title popup-section-title--legacy-share">Share da marca neste PDV</div>
    <div class="popup-share-bars popup-share-bars--legacy">
      <div class="share-bar-row">
        <span class="share-bar-label">Reais</span>
        <div class="share-bar-track"><div class="share-bar-fill ${shareReis >= 10 ? 'win' : shareReis < 5 ? 'lose' : ''}" style="width:${Math.min(shareReis / maxShare * 100, 100)}%"></div></div>
        <span class="share-bar-val">${shareReis.toFixed(1)}%</span>
      </div>
      <div class="share-bar-row">
        <span class="share-bar-label">Volume</span>
        <div class="share-bar-track"><div class="share-bar-fill" style="width:${Math.min(shareVol / maxShare * 100, 100)}%"></div></div>
        <span class="share-bar-val">${shareVol.toFixed(1)}%</span>
      </div>
      <div class="share-bar-row">
        <span class="share-bar-label">Unidades</span>
        <div class="share-bar-track"><div class="share-bar-fill" style="width:${Math.min(shareUn / maxShare * 100, 100)}%"></div></div>
        <span class="share-bar-val">${shareUn.toFixed(1)}%</span>
      </div>
    </div>
    <div class="popup-tickets popup-tickets--legacy">
      <span class="popup-tickets-label">Tickets na amostra</span>
      <span class="popup-tickets-val">${parseInt(row.tickets_amostra || 0).toLocaleString('pt-BR')}</span>
    </div>
    ${compExtension || ''}
    ${(!_isSharedMode && currentUser && row.id) ? `
    <div class="popup-actions">
      <button class="popup-delete-btn" onclick="deletePdvFromMap('${row.id}')" title="Remover este PDV do mapa">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/></svg>
        Remover do mapa
      </button>
    </div>` : ''}
  </div>`;
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────
// ─── CSV Parser com detecção automática de formato ───────────────────────────
// Suporta: HYPR/Kantar · lat/lon · endereços livres · CNPJs puros · separador ; ou ,
function parseCSV(text) {
  const lines = text.trim().split('\n');

  // Encontrar linha do header
  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const clean = lines[i].replace(/^\uFEFF/, '').toLowerCase();
    if (clean.includes('marca') || clean.includes('lat') || clean.includes('lon') ||
        clean.includes('cnpj') || clean.includes('enderec') || clean.includes('address') ||
        clean.includes('nome') || clean.includes('name')) {
      headerIdx = i; break;
    }
  }

  const raw = lines[headerIdx].replace(/^\uFEFF/, '');
  const sep = (raw.match(/;/g) || []).length > (raw.match(/,/g) || []).length ? ';' : ',';
  const header = raw.split(sep).map(h => h.trim().replace(/"/g,'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,''));

  function parseLine(line) {
    const values = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; continue; }
      if (line[i] === sep && !inQ) { values.push(cur.trim()); cur = ''; continue; }
      cur += line[i];
    }
    values.push(cur.trim());
    const obj = {};
    header.forEach((h, i) => obj[h] = values[i] || '');
    return obj;
  }

  return lines.slice(headerIdx + 1).filter(l => l.trim()).map(parseLine);
}

// Detectar formato e normalizar para estrutura interna
function detectAndNormalize(rows) {
  if (!rows.length) return { rows: [], formato: 'vazio', info: 'Sem dados' };
  const keys = Object.keys(rows[0]);

  const find = (...terms) => keys.find(k => terms.some(t => k.includes(t)));

  const latKey      = find('lat', 'latitude');
  const lonKey      = find('lon', 'lng', 'longitude');
  const cnpjRaizKey = keys.find(k => k === 'cnpj_raiz');          // coluna exata cnpj_raiz
  const cnpjKey     = !cnpjRaizKey ? find('cnpj') : null;         // só busca 'cnpj' se não tiver raiz
  const endKey      = find('endereco', 'endereço', 'address', 'logradouro', 'rua');
  const nomeKey     = find('nome', 'name', 'marca', 'brand', 'loja', 'razao', 'fantasia');

  // Formato 0: Varejo 360 com cnpj_raiz — base de share por PDV (ex: Varejo 360 / Kantar)
  if (cnpjRaizKey && rows.some(r => (r[cnpjRaizKey] || '').replace(/\D/g,'').length >= 8)) {
    const marcaKey = keys.find(k => k === 'marca') || nomeKey;
    const norm = rows.map(r => ({
      cnpj:       r[cnpjRaizKey],
      _cnpj_raiz: (r[cnpjRaizKey] || '').replace(/\D/g,'').padStart(8,'0'),
      marca:      r[marcaKey] || '',
      bandeira:   'Carregando...',
      ...r,
    }));
    return { rows: norm, formato: 'cnpj_raiz', info: `${norm.length} PDVs por CNPJ Raiz — endereços via Receita Federal` };
  }

  // Formato 1: lat/lon direto — plota sem geocodificar
  if (latKey && lonKey && rows.some(r => parseFloat(r[latKey]) && parseFloat(r[lonKey]))) {
    const norm = rows.map(r => ({
      cnpj: r[cnpjKey] || '',
      nome: r[nomeKey] || '',
      marca: r[nomeKey] || '',
      bandeira: r[nomeKey] || 'Desconhecido',
      lat: parseFloat(r[latKey]), lon: parseFloat(r[lonKey]),
      geo_address: r[endKey] || '',
      ...r,
    }));
    return { rows: norm, formato: 'latlon', info: `${norm.length} pontos com coordenadas — plotando direto` };
  }

  // Formato 2: HYPR/Kantar — campo cnpj contém endereço embutido ("CNPJ - RUA - CIDADE/UF")
  if (cnpjKey && rows.some(r => (r[cnpjKey] || '').includes(' - '))) {
    const marcaKeyH = keys.find(k => k === 'marca') || nomeKey;
    const normH = rows.map(r => ({ ...r, marca: r[marcaKeyH] || '', bandeira: 'Carregando...' }));
    return { rows: normH, formato: 'hypr', info: `${normH.length} PDVs no formato HYPR/Kantar` };
  }

  // Formato 3: Endereço livre — tem coluna de endereço mas não cnpj com " - "
  if (endKey) {
    const norm = rows.map(r => ({
      cnpj: r[cnpjKey] || '',
      _endereco_livre: [r[endKey], r[find('bairro','neighborhood')||''], r[find('cidade','city','municipio')||''], r[find('uf','estado','state')||''], 'Brasil'].filter(Boolean).join(', '),
      nome: r[nomeKey] || '',
      marca: r[nomeKey] || '',
      bandeira: r[nomeKey] || 'Desconhecido',
      ...r,
    }));
    return { rows: norm, formato: 'endereco', info: `${norm.length} endereços livres detectados` };
  }

  // Formato 4: CNPJ puro (14 dígitos) — busca endereço na Receita Federal
  if (cnpjKey && rows.some(r => r[cnpjKey]?.replace(/\D/g,'').length >= 8)) {
    const norm = rows.map(r => ({
      cnpj: r[cnpjKey],
      marca: r[nomeKey] || '',
      bandeira: r[nomeKey] || r[cnpjKey] || 'Desconhecido',
      ...r,
    }));
    return { rows: norm, formato: 'cnpj_puro', info: `${norm.length} CNPJs — endereços serão buscados na Receita Federal` };
  }

  // Fallback genérico
  return { rows, formato: 'hypr', info: `${rows.length} linhas (formato genérico)` };
}

// ─── Filters ─────────────────────────────────────────────────────────────────
// ─── Normalização de nomes de bandeira ──────────────────────────────────────
var _bandeiraGroupMap = {}; // mapa: nome original → nome normalizado
function normalizeBandeira(nome) {
  if (!nome) return nome;
  var n = nome.toUpperCase().trim();
  // Remover complemento após hífen/travessão: "ATACADAO SOUZA - COMERCIO DE PRODUTOS..."
  n = n.replace(/\s*[-–—]\s*(COMERCIO|COMÉRCIO|COM\.?|DIST\.?|IND\.?)\s+DE\s+.+$/i, '');
  // Remover sufixos jurídicos e descritivos (loop até estabilizar)
  var prev = '';
  while (prev !== n) {
    prev = n;
    n = n.replace(/\s+(LTDA\.?|ME\.?|EPP\.?|EIRELI\.?|SLU\.?|SS\.?|S\.?\s*A\.?|S\/A|CIA\.?)\.?$/i, '');
    n = n.replace(/\s+(COMERCIAL|DISTRIBUIDORA|SUPERMERCADOS?|HIPERMERCADOS?|ATACADISTA|ATACADO|VAREJO|VAREJISTA|MERCADO|MERCEARIA|EMPORIO|MINIMERCADO)$/i, '');
    n = n.replace(/\s+(COMERCIO|COMÉRCIO|COM\.?)\s+(DE|E)\s+.+$/i, '');
    n = n.replace(/\s+(ALIMENTOS|BEBIDAS|PRODUTOS|GENEROS|GÊNEROS|CEREAIS|FRIOS|HORTIFRUTI).*$/i, '');
    n = n.replace(/\s+(IND\.?\s*(E|&)\s*COM\.?|COM\.?\s*(E|&)\s*IND\.?).*$/i, '');
  }
  // Remover pontuação final e normalizar espaços
  n = n.replace(/[\.\,\-]+$/, '').trim();
  n = n.replace(/\s+/g, ' ');
  return n;
}

function buildBandeiraGroups() {
  _bandeiraGroupMap = {};
  var groups = {}; // chave normalizada → { display: nome mais curto, originals: [...] }
  allData.forEach(function(r) {
    if (!r.bandeira || r.bandeira === 'Não identificado' || r.bandeira === 'Carregando...') return;
    var key = normalizeBandeira(r.bandeira);
    if (!groups[key]) groups[key] = { display: null, originals: new Set(), count: 0 };
    groups[key].originals.add(r.bandeira);
    groups[key].count++;
    // Usar o nome mais curto como display (mais limpo)
    if (!groups[key].display || r.bandeira.length < groups[key].display.length) {
      groups[key].display = r.bandeira;
    }
  });
  // Construir mapa reverso: original → display
  Object.values(groups).forEach(function(g) {
    g.originals.forEach(function(orig) {
      _bandeiraGroupMap[orig] = g.display;
    });
  });
  return groups;
}

// ─── Multi-select component ─────────────────────────────────────────────────
var _msState = {}; // id → { options: [{value, label, count}], selected: Set }

function initMultiSelect(id, options) {
  // Ordenar por count desc (mais frequentes primeiro)
  options.sort(function(a, b) { return b.count - a.count; });
  _msState[id] = { options: options, selected: new Set() };
  var wrap = document.getElementById(id);
  var optContainer = wrap.querySelector('.ms-options');
  optContainer.innerHTML = '';
  options.forEach(function(opt) {
    var div = document.createElement('div');
    div.className = 'ms-opt';
    div.dataset.value = opt.value;
    div.dataset.search = opt.label.toLowerCase();
    div.innerHTML = '<input type="checkbox" tabindex="-1"><span class="ms-opt-label">' + _escForHtml(opt.label) + '</span><span class="ms-opt-count">' + opt.count.toLocaleString('pt-BR') + '</span>';
    div.onclick = function(e) {
      e.stopPropagation();
      var cb = div.querySelector('input');
      // Se o click foi direto no checkbox, o browser já togglou — não inverter de novo
      if (e.target !== cb) {
        cb.checked = !cb.checked;
      }
      if (cb.checked) {
        _msState[id].selected.add(opt.value);
        div.classList.add('selected');
      } else {
        _msState[id].selected.delete(opt.value);
        div.classList.remove('selected');
      }
      _updateMsSelectionBar(id);
      updateMsDisplay(id);
      applyFilters();
    };
    optContainer.appendChild(div);
  });
  _updateMsSelectionBar(id);
  updateMsDisplay(id);
}

function _updateMsSelectionBar(id) {
  var bar = document.getElementById(id + '-bar');
  var countEl = document.getElementById(id + '-count');
  if (!bar || !countEl) return;
  var n = _msState[id].selected.size;
  if (n > 0) {
    bar.style.display = 'flex';
    countEl.textContent = n + ' selecionada' + (n > 1 ? 's' : '');
  } else {
    bar.style.display = 'none';
  }
  // Atualizar badge no header do sidebar
  var badge = document.getElementById('filter-active-count');
  if (badge) {
    var totalActive = n;
    // Contar outros filtros ativos
    if (document.getElementById('f-uf').value) totalActive++;
    if (parseFloat(document.getElementById('f-share-min').value) > 0) totalActive++;
    var ticketsEl = document.getElementById('f-tickets-min');
    if (ticketsEl && parseInt(ticketsEl.value) > 0) totalActive++;
    if (document.querySelector('#f-oport .badge.active[data-v]:not([data-v=""])')) totalActive++;
    if (document.querySelector('#f-perf .badge.active[data-v]:not([data-v=""])')) totalActive++;
    if (totalActive > 0) {
      badge.textContent = totalActive;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }
}

function updateMsDisplay(id) {
  var wrap = document.getElementById(id);
  var display = wrap.querySelector('.ms-display');
  var sel = _msState[id].selected;
  if (sel.size === 0) {
    display.innerHTML = 'Todas as bandeiras';
    display.style.color = '';
  } else if (sel.size <= 2) {
    var tags = [...sel].map(function(v) { return '<span class="ms-tag">' + v + '</span>'; }).join('');
    display.innerHTML = tags;
    display.style.color = '';
  } else {
    var first2 = [...sel].slice(0, 2).map(function(v) { return '<span class="ms-tag">' + v + '</span>'; }).join('');
    display.innerHTML = first2 + '<span class="ms-tag-more">+' + (sel.size - 2) + '</span>';
    display.style.color = '';
  }
}

function toggleMultiSelect(id) {
  var wrap = document.getElementById(id);
  var dd = wrap.querySelector('.ms-dropdown');
  var trigger = wrap.querySelector('.ms-trigger');
  var isOpen = dd.classList.contains('open');
  // Fechar todos os outros
  document.querySelectorAll('.ms-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
  document.querySelectorAll('.ms-trigger.open').forEach(function(t) { t.classList.remove('open'); });
  if (!isOpen) {
    dd.classList.add('open');
    trigger.classList.add('open');
    var searchInput = wrap.querySelector('.ms-search');
    if (searchInput) { searchInput.value = ''; filterMultiSelect(id, ''); setTimeout(function() { searchInput.focus(); }, 50); }
  }
}

function filterMultiSelect(id, query) {
  var wrap = document.getElementById(id);
  var q = query.toLowerCase();
  wrap.querySelectorAll('.ms-opt').forEach(function(opt) {
    opt.classList.toggle('hidden', q && opt.dataset.search.indexOf(q) === -1);
  });
}

function msSelectAll(id) {
  var wrap = document.getElementById(id);
  _msState[id].selected.clear();
  wrap.querySelectorAll('.ms-opt').forEach(function(opt) {
    opt.classList.remove('selected');
    opt.querySelector('input').checked = false;
  });
  _updateMsSelectionBar(id);
  updateMsDisplay(id);
  applyFilters();
}

function msClearAll(id) {
  msSelectAll(id);
}

function msGetSelected(id) {
  return _msState[id] ? _msState[id].selected : new Set();
}

function msReset(id) {
  if (!_msState[id]) return;
  _msState[id].selected.clear();
  var wrap = document.getElementById(id);
  if (wrap) {
    wrap.querySelectorAll('.ms-opt').forEach(function(opt) {
      opt.classList.remove('selected');
      opt.querySelector('input').checked = false;
    });
  }
  _updateMsSelectionBar(id);
  updateMsDisplay(id);
}

// Fechar dropdown ao clicar fora
document.addEventListener('click', function(e) {
  if (!e.target.closest('.ms-wrap')) {
    document.querySelectorAll('.ms-dropdown.open').forEach(function(d) { d.classList.remove('open'); });
    document.querySelectorAll('.ms-trigger.open').forEach(function(t) { t.classList.remove('open'); });
  }
});

function populateFilters() {
  // ── Bandeira multi-select com normalização ──
  var groups = buildBandeiraGroups();

  // Contar "Não identificado" e variantes (vazio, Carregando, null)
  var naoIdCount = allData.filter(function(r) {
    return !r.bandeira || r.bandeira === 'Não identificado' || r.bandeira === 'Carregando...' || r.bandeira.trim() === '';
  }).length;

  // Construir options ordenadas por count (desc)
  var options = Object.keys(groups).sort().map(function(key) {
    return { value: groups[key].display, label: groups[key].display, count: groups[key].count };
  });

  // Filtrar options com label vazia ou só espaços
  options = options.filter(function(opt) {
    return opt.label && opt.label.trim().length > 0;
  });

  if (naoIdCount > 0) {
    options.push({ value: 'Não identificado', label: 'Não identificado', count: naoIdCount });
  }

  initMultiSelect('ms-bandeira', options);

  const selUf = document.getElementById('f-uf');
  selUf.innerHTML = '<option value="">Todos os estados</option>';
  const ufs = [...new Set(allData.map(r => r.uf || '').filter(Boolean))].sort();
  ufs.forEach(u => {
    const opt = document.createElement('option'); opt.value = u; opt.textContent = u;
    selUf.appendChild(opt);
  });

  // ── Ranges dinâmicos baseados nos dados reais ──────────────────────
  const ticketsArr = allData.map(r => parseInt(r.tickets_amostra || 0)).filter(v => v > 0);
  const sharesArr  = allData.map(r => parseFloat(r.share_reais_sku_dimensao || 0) * 100).filter(v => v > 0);

  if (ticketsArr.length) {
    const maxT = Math.max(...ticketsArr);
    // Step inteligente baseado no máximo real
    const stepT = maxT <= 50 ? 1 : maxT <= 200 ? 5 : maxT <= 1000 ? 10 : maxT <= 5000 ? 25 : 50;
    const maxTRounded = Math.ceil(maxT / stepT) * stepT;
    const sliderTMin = document.getElementById('f-tickets-min');
    if (sliderTMin) {
      sliderTMin.max = maxTRounded; sliderTMin.step = stepT; sliderTMin.value = 0;
      syncTicketRange();
    }
  }

  if (sharesArr.length) {
    // share_reais_sku_dimensao já é decimal (0.20 = 20%) — multiplicar por 100 para %
    const maxS = Math.min(Math.ceil(Math.max(...sharesArr)), 100);
    const shareSlider = document.getElementById('f-share-min');
    shareSlider.max   = maxS;
    shareSlider.value = 0;
    updateRangeLabel('f-share-min', 'lbl-share-min');
  }
}

function applyFilters() {
  _lastFilteredHash = ''; // invalidar cache de panels
  const selBandeiras = msGetSelected('ms-bandeira');
  const uf = document.getElementById('f-uf').value;
  const shareMin = parseFloat(document.getElementById('f-share-min').value) / 100;
  const ticketsMinEl = document.getElementById('f-tickets-min');
  const ticketsMin = ticketsMinEl ? parseInt(ticketsMinEl.value) : 0;
  const oport = document.querySelector('#f-oport .badge.active')?.dataset.v || '';
  const perf = document.querySelector('#f-perf .badge.active')?.dataset.v || '';

  // Passada 1: aplica TODOS os filtros exceto perf → _baseDataNoPerf
  _baseDataNoPerf = allData.filter(r => {
    if (selBandeiras.size > 0) {
      var bandeira = r.bandeira;
      // Tratar variantes de não identificado
      if (!bandeira || bandeira === 'Carregando...' || bandeira.trim() === '') {
        bandeira = 'Não identificado';
      }
      // Checar pelo nome agrupado (display) via _bandeiraGroupMap
      const grouped = _bandeiraGroupMap[bandeira] || bandeira;
      if (!selBandeiras.has(grouped) && !selBandeiras.has(bandeira)) return false;
    }
    if (uf && r.uf !== uf) return false;

    // Share bucket ativo (clique no chart-dist) tem precedência sobre o slider
    var shareRaw = parseFloat(r.share_reais_sku_dimensao || 0);
    if (_activeShareBucket) {
      if (shareRaw < _activeShareBucket.min || shareRaw >= _activeShareBucket.max) return false;
    } else {
      if (shareRaw < shareMin) return false;
    }

    if (parseInt(r.tickets_amostra || 0) < ticketsMin) return false;
    if (oport) {
      const o = parseFloat(r.oportunidade_dimensao || 0);
      if (oport === 'alta'  && o <= 0.05) return false;
      if (oport === 'media' && (o < -0.03 || o > 0.05)) return false;
      if (oport === 'baixa' && o >= -0.03) return false;
    }
    return true;
  });

  // Passada 2: aplica apenas o filtro de perf em cima de _baseDataNoPerf → filteredData
  if (!perf) {
    filteredData = _baseDataNoPerf.slice();
  } else {
    filteredData = _baseDataNoPerf.filter(r => {
      const d = parseFloat(r.percentual_diff_media_dimensao || 0);
      const s = parseFloat(r.share_reais_sku_dimensao || 0);
      if (perf === 'acima' && d <= 2) return false;
      if (perf === 'abaixo' && d >= -2) return false;
      // Competindo: na faixa de média (±2pp) com share > 0
      if (perf === 'competindo' && !(d >= -2 && d <= 2 && s > 0)) return false;
      // Sem presença: na faixa de média (±2pp) com share = 0
      if (perf === 'sem_presenca' && !(d >= -2 && d <= 2 && s <= 0)) return false;
      return true;
    });
  }

  // Passada 3 (Fase 8): Lens preset (Sidebar V360) + esconder whitespace
  // Esses passes só rodam em V360. Aplicados DENTRO de applyFilters pra
  // garantir um único renderMarkers (sem race de re-render).
  if (currentMapType === 'varejo360' && typeof window._v360FilterByPreset === 'function') {
    filteredData = window._v360FilterByPreset(filteredData);
  }

  renderMarkers();
  updatePanels();
  updateOverlay();
  // Atualizar badge de filtros ativos
  _updateMsSelectionBar('ms-bandeira');
}

function syncTicketRange() {
  const minEl = document.getElementById('f-tickets-min');
  const lblEl = document.getElementById('lbl-tickets-min');
  if (minEl && lblEl) lblEl.textContent = parseInt(minEl.value).toLocaleString('pt-BR');
}

function updateRangeLabel(id, labelId, unit = '%') {
  const val = document.getElementById(id).value;
  document.getElementById(labelId).textContent = val + unit;
}

function toggleBadge(el, groupId) {
  document.querySelectorAll(`#${groupId} .badge`).forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function resetFilters() {
  _lastFilteredHash = '';
  _activeShareBucket = null;
  msReset('ms-bandeira');
  document.getElementById('f-uf').value = '';
  document.getElementById('f-share-min').value = 0;
  if (document.getElementById('f-tickets-min')) {
    document.getElementById('f-tickets-min').value = 0;
    syncTicketRange();
  }
  // Reset do slider Mínimo PDVs/rede para o default (3)
  var minRedeEl = document.getElementById('f-min-pdvs-rede');
  if (minRedeEl) {
    minRedeEl.value = 3;
    var lbl = document.getElementById('lbl-min-pdvs-rede');
    if (lbl) lbl.textContent = '3';
  }
  document.getElementById('lbl-share-min').textContent = '0%';
  // lbl-tickets atualizado por syncTicketRange
  ['f-oport','f-perf'].forEach(gid => {
    const badges = document.querySelectorAll(`#${gid} .badge`);
    badges.forEach(b => b.classList.remove('active'));
    badges[0]?.classList.add('active');
  });
  filteredData = allData.slice();
  _baseDataNoPerf = filteredData.slice();
  renderMarkers();
  updatePanels();
  updateOverlay();
}

// ─── Stats & Panels ───────────────────────────────────────────────────────────
function avg(arr, key) {
  const vals = arr.map(r => parseFloat(r[key] || 0)).filter(v => !isNaN(v));
  return vals.length ? vals.reduce((a,b) => a+b, 0) / vals.length : 0;
}

function groupBy(arr, key) {
  return arr.reduce((acc, r) => {
    const k = r[key] || 'Outros';
    if (!acc[k]) acc[k] = [];
    acc[k].push(r);
    return acc;
  }, {});
}

function updateOverlay() {
  document.getElementById('overlay-count').textContent = filteredData.length.toLocaleString('pt-BR');
  const shareAvg = avg(filteredData, 'share_reais_sku_dimensao') * 100;
  document.getElementById('overlay-share').textContent = shareAvg.toFixed(1) + '%';
}

function updateHeader() {
  // Os 4 mini-stats de perf devem mostrar a contagem REAL de cada categoria
  // mesmo quando uma delas está ativa como filtro. Por isso iteramos sobre
  // _baseDataNoPerf (filteredData sem o filtro de perf aplicado).
  var basePool = _baseDataNoPerf && _baseDataNoPerf.length ? _baseDataNoPerf : filteredData;
  var winCount = 0, loseCount = 0, competeCount = 0, absentCount = 0;
  for (var i = 0; i < basePool.length; i++) {
    var r = basePool[i];
    var d = parseFloat(r.percentual_diff_media_dimensao || 0);
    if (d > 2) winCount++;
    else if (d < -2) loseCount++;
    else {
      // Faixa de média (±2pp): separa por presença efetiva
      var s = parseFloat(r.share_reais_sku_dimensao || 0);
      if (s > 0) competeCount++;
      else absentCount++;
    }
  }
  // Bandeiras refletem o que está visível no mapa (PDVs e share méd. agora
  // só no rodapé — não duplica no header)
  var bandeiras = new Set(filteredData.map(function(r) { return r.bandeira || 'Outros'; })).size;

  // KPIs do painel Overview
  var elOvWin = document.getElementById('ov-win');
  if (elOvWin) elOvWin.textContent = winCount.toLocaleString('pt-BR');
  var elOvCompete = document.getElementById('ov-compete');
  if (elOvCompete) elOvCompete.textContent = competeCount.toLocaleString('pt-BR');
  var elOvLose = document.getElementById('ov-lose');
  if (elOvLose) elOvLose.textContent = loseCount.toLocaleString('pt-BR');
  var elOvAbsent = document.getElementById('ov-absent');
  if (elOvAbsent) elOvAbsent.textContent = absentCount.toLocaleString('pt-BR');
  var elOvBand = document.getElementById('ov-bandeiras');
  if (elOvBand) elOvBand.textContent = bandeiras.toLocaleString('pt-BR');

  // Sincroniza visual dos mini-stats clicáveis com o badge perf ativo
  syncMiniStatActive();
}

// ─── Filtros clicáveis (overview) ───────────────────────────────────────────
// Sincroniza classe .active e .dimmed dos mini-stats com badge perf ativo
function syncMiniStatActive() {
  var activePerf = document.querySelector('#f-perf .badge.active')?.dataset.v || '';
  var hasActive = activePerf !== '';
  document.querySelectorAll('.overview-mini-stat.clickable').forEach(function(el) {
    if (el.dataset.perf === activePerf && hasActive) {
      el.classList.add('active');
      el.classList.remove('dimmed');
    } else {
      el.classList.remove('active');
      // Quando há um filtro ativo, os outros mini-stats ficam dimmed
      if (hasActive) el.classList.add('dimmed');
      else el.classList.remove('dimmed');
    }
  });
}

// Clique em mini-stat: ativa/desativa o badge perf correspondente
function toggleMiniStatFilter(perfValue) {
  var group = document.getElementById('f-perf');
  if (!group) return;
  var current = group.querySelector('.badge.active');
  var target = group.querySelector('.badge[data-v="' + perfValue + '"]');
  if (!target) return;

  // Toggle: se já está ativo, volta pra "Todos" (data-v="")
  if (current && current.dataset.v === perfValue) {
    var none = group.querySelector('.badge[data-v=""]');
    if (none) toggleBadge(none, 'f-perf');
  } else {
    toggleBadge(target, 'f-perf');
  }
  applyFilters();
}

// Clique em bin do chart-dist: ativa/desativa o bucket de share
function toggleShareBucket(min, max) {
  if (_activeShareBucket && _activeShareBucket.min === min && _activeShareBucket.max === max) {
    _activeShareBucket = null;
  } else {
    _activeShareBucket = { min: min, max: max };
  }
  _lastFilteredHash = ''; // invalida cache de panels
  applyFilters();
}

function clearShareBucket() {
  _activeShareBucket = null;
  _lastFilteredHash = '';
  applyFilters();
}

// Clique em barra do chart-bandeiras: seleciona aquela bandeira no multi-select
function selectBandeiraFromChart(bandeiraName) {
  if (!bandeiraName) return;
  // Resolver nome agrupado (se houver agrupamento)
  var grouped = (typeof _bandeiraGroupMap !== 'undefined' && _bandeiraGroupMap[bandeiraName]) || bandeiraName;

  // Verificar estado atual: se já está só essa bandeira selecionada, limpar (toggle)
  var current = msGetSelected('ms-bandeira');
  if (current.size === 1 && (current.has(grouped) || current.has(bandeiraName))) {
    msReset('ms-bandeira');
    applyFilters();
    return;
  }

  // Selecionar exclusivamente essa bandeira: reset + marca opção correspondente
  msReset('ms-bandeira');
  var wrap = document.getElementById('ms-bandeira');
  if (!wrap || !_msState['ms-bandeira']) { applyFilters(); return; }

  // Tenta achar a opção pelo valor agrupado ou pelo nome bruto
  var targetOpt = wrap.querySelector('.ms-opt[data-value="' + CSS.escape(grouped) + '"]')
              || wrap.querySelector('.ms-opt[data-value="' + CSS.escape(bandeiraName) + '"]');

  if (targetOpt) {
    var val = targetOpt.dataset.value;
    _msState['ms-bandeira'].selected.add(val);
    targetOpt.classList.add('selected');
    var input = targetOpt.querySelector('input');
    if (input) input.checked = true;
    _updateMsSelectionBar('ms-bandeira');
    updateMsDisplay('ms-bandeira');
  }
  applyFilters();
}

var _lastFilteredLength = -1;
var _lastFilteredHash = '';
var _panelRafId = null;

function updatePanels() {
  const hash = filteredData.length + '_' + (filteredData[0]?.cnpj || '') + '_' + (filteredData[filteredData.length-1]?.cnpj || '');
  if (hash === _lastFilteredHash) return;
  _lastFilteredHash = hash;

  // Usar rAF para não bloquear o render do mapa
  if (_panelRafId) cancelAnimationFrame(_panelRafId);
  _panelRafId = requestAnimationFrame(() => {
    updateHeader();
    updateOverview();
    // Atualizar ranking e análise com pequeno delay para priorizar o mapa
    setTimeout(() => { updateRanking(); updateAnalysis(); }, 50);
    _panelRafId = null;
  });
}

// ─── Overview Tab ────────────────────────────────────────────────────────────
function _median(arr) {
  if (!arr.length) return 0;
  var s = arr.slice().sort(function(a,b) { return a - b; });
  var mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function updateOverview() {
  var shares = filteredData.map(function(r) { return parseFloat(r.share_reais_sku_dimensao || 0) * 100; });
  var sharesNonZero = shares.filter(function(v) { return v > 0.01; });
  var shareAvg = shares.length ? shares.reduce(function(a,b) { return a+b; }, 0) / shares.length : 0;
  var shareMedian = _median(shares);
  var shareAvgNZ = sharesNonZero.length ? sharesNonZero.reduce(function(a,b) { return a+b; }, 0) / sharesNonZero.length : 0;

  var diffAvg = avg(filteredData, 'percentual_diff_media_dimensao');

  document.getElementById('ov-share-val').textContent = shareAvg.toFixed(1);
  var deltaEl = document.getElementById('ov-share-delta');
  deltaEl.textContent = (diffAvg > 0 ? '+' : '') + diffAvg.toFixed(1) + '% vs. média';
  deltaEl.className = 'share-delta ' + (diffAvg >= 0 ? 'pos' : 'neg');

  // Métricas complementares
  var detailEl = document.getElementById('ov-share-detail');
  if (detailEl) {
    var zeroCount = shares.length - sharesNonZero.length;
    var parts = [];
    parts.push('Mediana: ' + shareMedian.toFixed(1) + '%');
    if (sharesNonZero.length < shares.length) {
      parts.push('Excl. zeros: ' + shareAvgNZ.toFixed(1) + '%');
      parts.push(zeroCount.toLocaleString('pt-BR') + ' PDVs sem presença');
    }
    detailEl.textContent = parts.join(' · ');
  }

  // Chart: shares (reais, volume, unidades)
  var shareR = shareAvg;
  var shareV = avg(filteredData, 'share_volume_sku_dimensao') * 100;
  var shareU = avg(filteredData, 'share_unidades_sku_dimensao') * 100;
  renderBarChart('chart-shares',
    ['Reais', 'Volume', 'Unidades'],
    [shareR, shareV, shareU],
    [_cssVar('--accent'), _cssVar('--accent-light'), _cssVar('--blue-light')]
  );

  // Chart: PDVs por bandeira (top 8 por count)
  var grp = groupBy(filteredData, 'bandeira');
  var bandSort = Object.entries(grp).sort(function(a,b) { return b[1].length - a[1].length; }).slice(0, 8);
  var bandLabels = bandSort.map(function(e) { return e[0]; });
  var bandCounts = bandSort.map(function(e) { return e[1].length; });

  // Detecta bandeira "ativa" (única selecionada no multi-select) para destacar a barra
  var selBand = msGetSelected('ms-bandeira');
  var activeBand = null;
  if (selBand.size === 1) { activeBand = Array.from(selBand)[0]; }
  renderHorizBarChart('chart-bandeiras', bandLabels, bandCounts, activeBand);
  updateBandeiraChartChip(activeBand);

  // Chart: distribuição de share — bins fixos (em decimal: 0.02 = 2%)
  var bins = [0, 0.02, 0.05, 0.10, 0.15, 0.20, 0.30, 0.50, 1.00];
  var distLabels = bins.slice(0,-1).map(function(v,i) { return Math.round(v*100) + '–' + Math.round(bins[i+1]*100) + '%'; });
  var distCounts = bins.slice(0,-1).map(function(v,i) { return filteredData.filter(function(r) {
    var s = parseFloat(r.share_reais_sku_dimensao||0);
    return s >= v && s < bins[i+1];
  }).length; });
  // Detecta bin ativo
  var activeBinIdx = -1;
  if (_activeShareBucket) {
    for (var bi = 0; bi < bins.length - 1; bi++) {
      if (Math.abs(bins[bi] - _activeShareBucket.min) < 1e-6 && Math.abs(bins[bi+1] - _activeShareBucket.max) < 1e-6) {
        activeBinIdx = bi; break;
      }
    }
  }
  renderHistChart('chart-dist', distLabels, distCounts, bins, activeBinIdx);
  updateShareBucketChip();
}

// Atualiza chip do bucket de share ativo
function updateShareBucketChip() {
  var chip = document.getElementById('chip-share-bucket');
  if (!chip) return;
  if (_activeShareBucket) {
    var minPct = Math.round(_activeShareBucket.min * 100);
    var maxPct = Math.round(_activeShareBucket.max * 100);
    chip.innerHTML = '<span>Filtro: ' + minPct + '–' + maxPct + '%</span><span class="chip-close">✕</span>';
    chip.style.display = 'inline-flex';
    chip.onclick = function() { clearShareBucket(); };
  } else {
    chip.style.display = 'none';
    chip.innerHTML = '';
    chip.onclick = null;
  }
}

// Atualiza chip de bandeira filtrada via clique no chart
function updateBandeiraChartChip(bandeiraName) {
  var chip = document.getElementById('chip-bandeira-chart');
  if (!chip) return;
  if (bandeiraName) {
    chip.innerHTML = '<span>Filtro: ' + _escForHtml(bandeiraName) + '</span><span class="chip-close">✕</span>';
    chip.style.display = 'inline-flex';
    chip.onclick = function() { msReset('ms-bandeira'); applyFilters(); };
  } else {
    chip.style.display = 'none';
    chip.innerHTML = '';
    chip.onclick = null;
  }
}

// ─── Ranking Tab ─────────────────────────────────────────────────────────────
function updateRanking() {
  var grp = groupBy(filteredData, 'bandeira');
  // Mínimo de PDVs com presença para uma rede aparecer (configurável via slider)
  var minRedeEl = document.getElementById('f-min-pdvs-rede');
  var MIN_PDVS = minRedeEl ? Math.max(1, parseInt(minRedeEl.value) || 3) : 3;

  var ranked = Object.entries(grp).map(function(entry) {
    var b = entry[0], rows = entry[1];
    var withShare = rows.filter(function(r) { return r.share_reais_sku_dimensao != null && parseFloat(r.share_reais_sku_dimensao) > 0; });
    var withoutShare = rows.length - withShare.length;
    var shareAvgVal = withShare.length ? avg(withShare, 'share_reais_sku_dimensao') * 100 : 0;
    var diffWithShare = withShare.length ? avg(withShare, 'percentual_diff_media_dimensao') : null;
    return {
      name: b, count: rows.length, withShare: withShare.length,
      withoutShare: withoutShare, shareAvg: shareAvgVal,
      diffReal: diffWithShare,
      presence: rows.length > 0 ? (withShare.length / rows.length * 100) : 0,
    };
  });

  var withPresence = ranked.filter(function(r) { return r.withShare >= MIN_PDVS; });
  var noPresence = ranked.filter(function(r) { return r.withShare === 0 && r.count >= MIN_PDVS; });

  var isFew = withPresence.length <= 12;
  var topSection = document.getElementById('rank-top-section');
  var bottomSection = document.getElementById('rank-bottom-section');
  var oportSection = document.getElementById('rank-oport-section');

  function renderList(id, items, renderFn) {
    var el = document.getElementById(id);
    if (!el) return;
    if (!items.length) {
      el.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:8px 0;">Sem dados suficientes (min. ' + MIN_PDVS + ' PDVs)</div>';
      return;
    }
    el.innerHTML = items.map(renderFn).join('');
  }

  // Ordenar por diff real (performance vs media, excluindo PDVs sem presenca)
  var topPerf = withPresence.slice().sort(function(a,b) { return (b.diffReal||0) - (a.diffReal||0); });

  // Bandeira atualmente selecionada (única) no multi-select — usado para destacar item ativo
  var _selRank = msGetSelected('ms-bandeira');
  var _activeBand = _selRank.size === 1 ? Array.from(_selRank)[0] : null;
  function _isActiveBand(itemName) {
    if (!_activeBand) return false;
    var grouped = (typeof _bandeiraGroupMap !== 'undefined' && _bandeiraGroupMap[itemName]) || itemName;
    return _activeBand === grouped || _activeBand === itemName;
  }
  function _rankItemAttrs(itemName) {
    var safeName = _escForHtml(itemName);
    var cls = 'rank-item clickable' + (_isActiveBand(itemName) ? ' active' : '');
    return 'class="' + cls + '" data-bandeira="' + safeName + '"';
  }

  if (isFew) {
    if (topSection) topSection.querySelector('.panel-section-title').textContent = 'Performance por rede (' + withPresence.length + ')';
    if (bottomSection) bottomSection.style.display = 'none';
    var maxS = Math.max.apply(null, withPresence.map(function(r) { return r.shareAvg; }).concat([1]));
    renderList('rank-top', topPerf, function(item, i) {
      var d = item.diffReal || 0;
      var barColor = d > 2 ? _cssVar('--win') : d < -2 ? _cssVar('--lose') : _cssVar('--neutral');
      return '<div ' + _rankItemAttrs(item.name) + '>' +
        '<span class="rank-num">' + (i+1) + '</span>' +
        '<span class="rank-name" title="' + _escForHtml(item.name) + '">' + _escForHtml(item.name) + '</span>' +
        '<div class="rank-bar-wrap"><div class="rank-bar" style="width:' + Math.min(item.shareAvg/maxS*100,100) + '%;background:' + barColor + '"></div></div>' +
        '<span class="rank-val" style="color:' + barColor + '">' + item.shareAvg.toFixed(1) + '%</span>' +
        '<span class="rank-badge neutral">' + item.withShare + ' PDVs</span>' +
      '</div>';
    });
  } else {
    if (topSection) topSection.querySelector('.panel-section-title').textContent = 'Onde a marca performa melhor';
    if (bottomSection) { bottomSection.style.display = ''; bottomSection.querySelector('.panel-section-title').textContent = 'Onde precisa melhorar'; }
    var topItems = topPerf.filter(function(r) { return (r.diffReal||0) > 0; }).slice(0, 7);
    var bottomItems = topPerf.filter(function(r) { return (r.diffReal||0) < 0; }).sort(function(a,b) { return (a.diffReal||0) - (b.diffReal||0); }).slice(0, 7);
    var maxDiff = Math.max.apply(null, topItems.concat(bottomItems).map(function(r) { return Math.abs(r.diffReal||0); }).concat([1]));

    function renderDiffItem(item, i) {
      var d = item.diffReal || 0;
      var barColor = d > 2 ? _cssVar('--win') : d < -2 ? _cssVar('--lose') : _cssVar('--neutral');
      return '<div ' + _rankItemAttrs(item.name) + '>' +
        '<span class="rank-num">' + (i+1) + '</span>' +
        '<span class="rank-name" title="' + _escForHtml(item.name) + '">' + _escForHtml(item.name) + '</span>' +
        '<div class="rank-bar-wrap"><div class="rank-bar" style="width:' + Math.min(Math.abs(d)/maxDiff*100,100) + '%;background:' + barColor + '"></div></div>' +
        '<span class="rank-val" style="color:' + barColor + '">' + (d > 0 ? '+' : '') + d.toFixed(1) + '%</span>' +
        '<span class="rank-badge neutral">' + item.withShare + ' PDVs \u00b7 ' + item.shareAvg.toFixed(1) + '%</span>' +
      '</div>';
    }
    renderList('rank-top', topItems, renderDiffItem);
    renderList('rank-bottom', bottomItems, renderDiffItem);
  }

  // Oportunidade: grandes redes sem presenca ou com baixa presenca
  if (oportSection) oportSection.querySelector('.panel-section-title').textContent = 'Redes sem presenca da marca';
  var oportItems = noPresence.sort(function(a,b) { return b.count - a.count; }).slice(0, 7);
  if (!oportItems.length) {
    if (oportSection) oportSection.querySelector('.panel-section-title').textContent = 'Menor presenca da marca';
    oportItems = withPresence.filter(function(r) { return r.presence < 50; })
      .sort(function(a,b) { return a.presence - b.presence; }).slice(0, 7);
  }
  renderList('rank-oport', oportItems, function(item, i) {
    var hasAny = item.withShare > 0;
    var presenceLabel = hasAny ? (item.presence.toFixed(0) + '% c/ share') : 'zero presenca';
    return '<div ' + _rankItemAttrs(item.name) + '>' +
      '<span class="rank-num">' + (i+1) + '</span>' +
      '<span class="rank-name" title="' + _escForHtml(item.name) + '">' + _escForHtml(item.name) + '</span>' +
      '<div class="rank-bar-wrap"><div class="rank-bar" style="width:' + Math.min(item.count/Math.max(oportItems[0].count,1)*100,100) + '%;background:var(--accent)"></div></div>' +
      '<span class="rank-val" style="color:var(--text-dim)">' + item.count + ' PDVs</span>' +
      '<span class="rank-badge ' + (hasAny ? 'neutral' : 'lose') + '">' + presenceLabel + '</span>' +
    '</div>';
  });
}


// ─── Analysis Tab ────────────────────────────────────────────────────────────
function updateAnalysis() {
  var grp = groupBy(filteredData, 'bandeira');
  // Lê o mínimo de PDVs/rede configurado no painel (mesmo controle do Ranking)
  var minRedeEl = document.getElementById('f-min-pdvs-rede');
  var MIN_PDVS_REDE = minRedeEl ? Math.max(1, parseInt(minRedeEl.value) || 3) : 3;

  var ranked = Object.entries(grp).map(function(entry) {
    var b = entry[0], rows = entry[1];
    // PDVs com presença efetiva da marca (share > 0)
    var withShareRows = rows.filter(function(r) {
      return parseFloat(r.share_reais_sku_dimensao || 0) > 0;
    });
    return {
      name: b, count: rows.length,
      withShareCount: withShareRows.length,
      shareAvg: avg(rows, 'share_reais_sku_dimensao') * 100,
      diffAvg: avg(rows, 'percentual_diff_media_dimensao'),
    };
  });

  var totalPDVs = filteredData.length;
  var winCount = filteredData.filter(function(r) { return parseFloat(r.percentual_diff_media_dimensao||0) > 2; }).length;
  var loseCount = filteredData.filter(function(r) { return parseFloat(r.percentual_diff_media_dimensao||0) < -2; }).length;
  var neutralCount = totalPDVs - winCount - loseCount;
  var winPct = totalPDVs ? (winCount / totalPDVs * 100).toFixed(0) : 0;
  var losePct = totalPDVs ? (loseCount / totalPDVs * 100).toFixed(0) : 0;

  // Concentração geográfica
  var ufGrp = groupBy(filteredData, 'uf');
  var ufSorted = Object.entries(ufGrp).sort(function(a,b) { return b[1].length - a[1].length; });
  var topUF = ufSorted[0] ? ufSorted[0][0] : '';
  var topUFPct = ufSorted[0] && totalPDVs ? (ufSorted[0][1].length / totalPDVs * 100).toFixed(0) : 0;

  // Filtro de relevância: redes com presença efetiva + mínimo configurado de PDVs c/ share
  var withPresence = ranked.filter(function(r) {
    return r.shareAvg > 0.1 && r.withShareCount >= MIN_PDVS_REDE;
  });

  // Score ponderado: prioriza redes onde o ganho/perda vale a pena agir
  // score = |diff| × √(PDVs c/ presença) → diffs altos em redes maiores ranqueiam à frente
  function relevanceScore(r) {
    return Math.abs(r.diffAvg) * Math.sqrt(Math.max(r.withShareCount, 1));
  }
  var bestPerf = withPresence
    .filter(function(r) { return r.diffAvg > 2; })
    .sort(function(a,b) { return relevanceScore(b) - relevanceScore(a); })
    .slice(0,3);
  var worstPerf = withPresence
    .filter(function(r) { return r.diffAvg < -2; })
    .sort(function(a,b) { return relevanceScore(b) - relevanceScore(a); })
    .slice(0,3);

  // Share da top bandeira vs média geral
  var shareGeral = avg(filteredData, 'share_reais_sku_dimensao') * 100;
  var topBandeira = ranked.sort(function(a,b) { return b.count - a.count; })[0];
  var topBandShare = topBandeira ? topBandeira.shareAvg : 0;

  var cards = [
    {
      title: 'Performance geral',
      body: totalPDVs === 0 ? 'Nenhum PDV visível com os filtros atuais.' :
        '<span class="analysis-highlight win">' + winCount.toLocaleString('pt-BR') + ' PDVs ganham</span> share (' + winPct + '%), ' +
        '<span class="analysis-highlight lose">' + loseCount.toLocaleString('pt-BR') + ' perdem</span> (' + losePct + '%) e ' +
        neutralCount.toLocaleString('pt-BR') + ' estão na média.' +
        (parseFloat(winPct) > parseFloat(losePct) ? ' Cenário <span class="analysis-highlight win">favorável</span>.' : ' Há espaço para <span class="analysis-highlight">recuperação</span>.')
    },
    {
      title: 'Concentração geográfica',
      body: topUF ?
        topUFPct + '% dos PDVs estão em <span class="analysis-highlight">' + topUF + '</span>.' +
        (ufSorted.length > 1 ? ' Seguido por ' + ufSorted.slice(1,3).map(function(u) { return u[0] + ' (' + u[1].length + ')'; }).join(', ') + '.' : '') +
        (parseInt(topUFPct) > 60 ? ' <span class="analysis-highlight lose">Alta concentração</span> — risco de dependência regional.' : '')
        : 'Sem dados de UF disponíveis.'
    },
    {
      title: 'Onde a marca vai bem',
      body: bestPerf.length ?
        'Melhor performance em: ' + bestPerf.map(function(b) {
          return '<span class="analysis-highlight">' + _escForHtml(b.name) + '</span> (+' + b.diffAvg.toFixed(1) + '%, ' + b.withShareCount + ' PDVs)';
        }).join(', ') + '.'
        : 'Nenhuma rede com performance significativamente acima da média (mín. ' + MIN_PDVS_REDE + ' PDVs c/ presença).'
    },
    {
      title: 'Onde precisa melhorar',
      body: worstPerf.length ?
        'Maior risco em: ' + worstPerf.map(function(b) {
          return '<span class="analysis-highlight lose">' + _escForHtml(b.name) + '</span> (' + b.diffAvg.toFixed(1) + '%, ' + b.withShareCount + ' PDVs)';
        }).join(', ') + '.'
        : 'Nenhuma rede com performance significativamente abaixo da média (mín. ' + MIN_PDVS_REDE + ' PDVs c/ presença).'
    },
    {
      title: 'Rede principal',
      body: topBandeira ?
        '<span class="analysis-highlight">' + _escForHtml(topBandeira.name) + '</span> concentra ' + topBandeira.count.toLocaleString('pt-BR') + ' PDVs com share médio de ' + topBandShare.toFixed(1) + '%.' +
        (topBandShare > shareGeral * 1.5 ? ' Share nessa rede é <span class="analysis-highlight win">' + (topBandShare / shareGeral).toFixed(1) + 'x maior</span> que a média geral.' : '') +
        (topBandShare < shareGeral * 0.7 ? ' Share nessa rede está <span class="analysis-highlight lose">abaixo da média</span> geral — oportunidade de investimento.' : '')
        : ''
    }
  ];

  document.getElementById('analysis-cards').innerHTML = cards.map(function(c) {
    return '<div class="analysis-card">' +
      '<div class="analysis-card-header"><span class="analysis-card-title">' + c.title + '</span></div>' +
      '<div class="analysis-card-body">' + c.body + '</div>' +
    '</div>';
  }).join('');

  // Win/Lose chart — usar bandeiras com presença, ordenadas por diff
  var wlData = withPresence.sort(function(a,b) { return b.diffAvg - a.diffAvg; }).slice(0, 10);
  renderWinLoseChart('chart-winlose',
    wlData.map(function(r) { return r.name; }),
    wlData.map(function(r) { return Math.max(r.diffAvg, 0); }),
    wlData.map(function(r) { return Math.min(r.diffAvg, 0); })
  );

  // UF ranking
  var ufRanked = ufSorted
    .map(function(entry) { return { name: entry[0], count: entry[1].length, shareAvg: avg(entry[1], 'share_reais_sku_dimensao') * 100 }; })
    .slice(0, 10);
  var maxUf = Math.max.apply(null, ufRanked.map(function(r) { return r.count; }).concat([1]));
  document.getElementById('rank-uf').innerHTML = ufRanked.map(function(item, i) {
    return '<div class="rank-item">' +
      '<span class="rank-num">' + (i+1) + '</span>' +
      '<span class="rank-name">' + _escForHtml(item.name) + '</span>' +
      '<div class="rank-bar-wrap"><div class="rank-bar" style="width:' + (item.count/maxUf*100) + '%;background:var(--accent)"></div></div>' +
      '<span class="rank-val" style="color:var(--text-dim)">' + item.count + '</span>' +
      '<span class="rank-badge neutral">' + item.shareAvg.toFixed(1) + '%</span>' +
    '</div>';
  }).join('');
}

// ─── Charts ──────────────────────────────────────────────────────────────────
var chartDefaults = {
  plugins: { legend: { display: false }, tooltip: {
    backgroundColor: _cssVar('--surface-solid'), borderColor: _cssVar('--border'), borderWidth: 1,
    titleColor: _cssVar('--text'), bodyColor: _cssVar('--text-dim'), padding: 10, cornerRadius: 6,
  }},
  scales: {},
};

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

async function renderBarChart(id, labels, data, colors) {
  await ensureChartJS();
  destroyChart(id);
  const ctx = document.getElementById(id).getContext('2d');
  // Formatador pt-BR para valores percentuais: 3.982 → "3,98%"
  function _fmtPctBR(v) {
    if (v == null || isNaN(v)) return '—';
    return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '%';
  }
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4, borderSkipped: false }] },
    options: { ...chartDefaults, responsive: true, maintainAspectRatio: false,
      plugins: { ...chartDefaults.plugins, tooltip: { ...(chartDefaults.plugins && chartDefaults.plugins.tooltip || {}),
        callbacks: { label: function(ctx) { return _fmtPctBR(ctx.parsed.y); } }
      }},
      scales: { x: { grid: { color: _cssVar('--surface-subtle') }, ticks: { color: _cssVar('--text-muted'), font: { size: 10 } } },
        y: { grid: { color: _cssVar('--surface-subtle') }, ticks: { color: _cssVar('--text-muted'), font: { size: 10 }, callback: function(v) { return _fmtPctBR(v); } } } }
    }
  });
}

async function renderHorizBarChart(id, labels, data, activeLabel) {
  await ensureChartJS();
  destroyChart(id);
  const ctx = document.getElementById(id).getContext('2d');
  var accentColor = _cssVar('--accent');
  var dimColor = _cssVar('--accent-chart') || _cssVar('--accent');
  // Se há label ativo, destaca essa barra e atenua as outras
  var hasActive = activeLabel != null && labels.indexOf(activeLabel) !== -1;
  var bgColors = labels.map(function(l) {
    if (!hasActive) return accentColor;
    return l === activeLabel ? accentColor : (dimColor + '55'); // semi-transparente
  });
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: bgColors, borderRadius: 3, borderSkipped: false }] },
    options: { ...chartDefaults, indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      onClick: function(evt, elements) {
        if (!elements || !elements.length) return;
        var idx = elements[0].index;
        var labelOriginal = labels[idx];
        try { selectBandeiraFromChart(labelOriginal); } catch(e) { console.error(e); }
      },
      onHover: function(evt, elements) {
        evt.native.target.style.cursor = elements && elements.length ? 'pointer' : 'default';
      },
      scales: {
        x: { grid: { color: _cssVar('--surface-subtle') }, ticks: { color: _cssVar('--text-muted'), font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { color: _cssVar('--text-dim'), font: { size: 10 }, callback: function(value) { var l = this.getLabelForValue(value); return l && l.length > 16 ? l.slice(0,16) + '…' : l; } } }
      }
    }
  });
}

async function renderHistChart(id, labels, data, bins, activeBinIdx) {
  await ensureChartJS();
  destroyChart(id);
  const ctx = document.getElementById(id).getContext('2d');
  var accentColor = _cssVar('--accent-chart') || _cssVar('--accent');
  var hasActive = typeof activeBinIdx === 'number' && activeBinIdx >= 0;
  var bgColors = labels.map(function(_, i) {
    if (!hasActive) return accentColor;
    return i === activeBinIdx ? _cssVar('--accent') : (accentColor + '55');
  });
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: bgColors, borderRadius: 2 }] },
    options: { ...chartDefaults, responsive: true, maintainAspectRatio: false,
      onClick: function(evt, elements) {
        if (!elements || !elements.length || !bins) return;
        var idx = elements[0].index;
        var min = bins[idx];
        var max = bins[idx + 1];
        try { toggleShareBucket(min, max); } catch(e) { console.error(e); }
      },
      onHover: function(evt, elements) {
        evt.native.target.style.cursor = elements && elements.length ? 'pointer' : 'default';
      },
      scales: { x: { grid: { display: false }, ticks: { color: _cssVar('--text-muted'), font: { size: 9 }, maxRotation: 45 } },
        y: { grid: { color: _cssVar('--surface-subtle') }, ticks: { color: _cssVar('--text-muted'), font: { size: 10 } } } }
    }
  });
}

async function renderWinLoseChart(id, labels, wins, loses) {
  await ensureChartJS();
  destroyChart(id);
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Ganho', data: wins, backgroundColor: _cssVar('--win-chart'), borderRadius: 3 },
        { label: 'Perda', data: loses, backgroundColor: _cssVar('--lose-chart'), borderRadius: 3 },
      ]
    },
    options: { ...chartDefaults, indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { ...chartDefaults.plugins, legend: { display: true, labels: { color: _cssVar('--text-dim'), font: { size: 10 } } } },
      scales: {
        x: { stacked: false, grid: { color: _cssVar('--surface-subtle') }, ticks: { color: _cssVar('--text-muted'), font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { color: _cssVar('--text-dim'), font: { size: 10 }, callback: v => v.length > 12 ? v.slice(0,12)+'…' : v } }
      }
    }
  });
}

// ─── Tab System ──────────────────────────────────────────────────────────────
function setTab(name) {
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel-tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name)?.classList.add('active');
  document.getElementById('tc-' + name)?.classList.add('active');
}

// ─── Load Data ───────────────────────────────────────────────────────────────
async function loadData(data) {
  // Remover linha de totais
  data = data.filter(r => r.cnpj && !r.cnpj.toUpperCase().includes('TODOS OS CNPJS'));

  allData = data.filter(r => r.lat && r.lon && parseFloat(r.lat) && parseFloat(r.lon));
  filteredData = allData.slice();

  document.getElementById('upload-zone').classList.add('hidden');
  document.getElementById('app').style.display = 'flex';
  await new Promise(r => setTimeout(r, 50));
  if (!map) initMap();
  await new Promise(r => setTimeout(r, 100));
  if (map) map.resize();

  // Fit bounds
  setTimeout(() => {
    const validPts = allData.filter(r => r.lat && r.lon);
    if (validPts.length) {
      if (!validPts.length) return;
      const bounds = validPts.reduce((b, r) => b.extend([parseFloat(r.lon), parseFloat(r.lat)]),
        new maplibregl.LngLatBounds([parseFloat(validPts[0].lon), parseFloat(validPts[0].lat)], [parseFloat(validPts[0].lon), parseFloat(validPts[0].lat)]));
      map.fitBounds(bounds, { padding: 40, animate: true });
    }
  }, 200);

  populateFilters();
  renderMarkers();
  updatePanels();
  updateOverlay();
}

// ─── Auth — Supabase (client inicializado no bootstrap DOMContentLoaded) ────
var SUPABASE_URL  = 'https://qfyqvcxhcmduhknbpofx.supabase.co';
var SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFmeXF2Y3hoY21kdWhrbmJwb2Z4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0Mjk1NjAsImV4cCI6MjA4OTAwNTU2MH0.k92V1LN4OqqdtfF86iml4L-gVg0AabENKt7S5vlP2dk';

async function initAuth() {
  // Aguardar bootstrap se ainda não rodou (defer scripts carregando)
  if (!window._supaReady) {
    await new Promise(function(resolve) {
      var check = setInterval(function() {
        if (window._supaReady) { clearInterval(check); resolve(); }
      }, 50);
    });
  }
  // Check existing session
  var sessionResult = await _supa.auth.getSession();
  var session = sessionResult.data ? sessionResult.data.session : null;
  if (session && session.user) {
    handleLoggedIn(session.user);
    return;
  }
  // Listen for auth changes (OAuth redirect callback)
  _supa.auth.onAuthStateChange(function(event, sess) {
    if (event === 'SIGNED_IN' && sess && sess.user) {
      handleLoggedIn(sess.user);
    }
    if (event === 'SIGNED_OUT') {
      currentUser = null;
      document.getElementById('login-screen').style.display = '';
      document.getElementById('gallery-screen').classList.add('hidden');
    }
  });
  // No session - show login
  document.getElementById('login-screen').style.display = '';
}

async function doGoogleLogin() {
  if (!_supa) return;
  var btn = document.getElementById('login-google-btn');
  var errEl = document.getElementById('login-error');
  errEl.innerHTML = ''; errEl.classList.remove('visible');
  btn.disabled = true; btn.textContent = 'Conectando...';
  var result = await _supa.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin,
      queryParams: { hd: 'hypr.mobi' }
    }
  });
  if (result.error) {
    btn.disabled = false;
    btn.innerHTML = 'Entrar com Google';
    errEl.innerHTML = 'Erro: ' + escHtml(result.error.message);
    errEl.classList.add('visible');
  }
}

async function handleLoggedIn(user) {
  if (!user || !user.email || !user.email.endsWith('@hypr.mobi')) {
    await _supa.auth.signOut();
    var errEl = document.getElementById('login-error');
    if (errEl) {
      errEl.innerHTML = 'Acesso restrito a <strong>@hypr.mobi</strong>. Você entrou com: ' + escHtml(user ? user.email : 'desconhecido');
      errEl.classList.add('visible');
    }
    document.getElementById('login-screen').style.display = '';
    return;
  }
  currentUser = user;
  document.getElementById('login-screen').style.display = 'none';
  var emailEl = document.getElementById('gallery-user-email');
  var subEl = document.getElementById('gallery-user-sub');
  if (emailEl) emailEl.textContent = user.email;
  if (subEl) subEl.textContent = 'Seus mapas geocodificados';
  // Restore context
  try {
    var urlMapId = new URLSearchParams(location.search).get('map');
    var saved = sessionStorage.getItem('hypr_last_map');
    var targetId = urlMapId || (saved ? JSON.parse(saved).mapId : null);
    if (targetId) {
      if (allData.length > 0) {
        document.getElementById('gallery-screen').classList.add('hidden');
        document.getElementById('app').style.display = 'flex';
        await new Promise(function(r) { setTimeout(r, 50); });
        if (!map) initMap(); else map.resize();
        renderMarkers(); populateFilters(); updatePanels(); updateOverlay();
        return;
      }
      _supa.from('saved_maps').select('id,name,map_type').eq('id', targetId).single()
        .then(function(res) { if (res.data) openSavedMap(res.data.id, res.data.name, res.data.map_type); else showGallery(); })
        .catch(function() { showGallery(); });
      return;
    }
  } catch(e) {}
  if (window._pendingGeocodingAfterLogin && rawCSVData.length > 0) {
    window._pendingGeocodingAfterLogin = false;
    startGeocoding();
    return;
  }
  showGallery();
}

function supaLogout() {
  try { sessionStorage.removeItem('hypr_last_map'); } catch(e) {}
  _supa.auth.signOut();
  currentUser = null;
  document.getElementById('login-screen').style.display = '';
  document.getElementById('gallery-screen').classList.add('hidden');
}

// Criar versão debounced de applyFilters (150ms) para sliders
var _debouncedFilter = debounce(applyFilters, 150);

// Debounced refresh apenas das tabs Ranking + Análise — usado pelo slider
// "Mínimo PDVs/rede", que não muda o que está visível no mapa (só recalcula painéis).
var _debouncedAnalytics = debounce(function() {
  _lastFilteredHash = '';
  try { updateRanking(); } catch(e) { console.error(e); }
  try { updateAnalysis(); } catch(e) { console.error(e); }
}, 150);

// ─── Estado do tipo de mapa atual ─────────────────────────────────────────────
var currentMapType = 'varejo360'; // 'geocoder' | 'reverse_geocoder' | 'varejo360' | 'places_discovery'

// Aplica modo visual correto — sempre chamar ao mudar de mapa
function applyMapMode(type) {
  currentMapType = type || 'varejo360';
  const app = document.getElementById('app');
  if (!app) return;
  const isGeo = currentMapType !== 'varejo360' && currentMapType !== 'places_discovery';
  const isPlaces = currentMapType === 'places_discovery';
  // Forçar remoção antes de adicionar — garante estado limpo
  app.classList.remove('mode-geo', 'mode-places');
  if (isGeo) app.classList.add('mode-geo');
  if (isPlaces) app.classList.add('mode-places');
  // Explicitly hide/show places-panel based on mode
  var placesPanel = document.getElementById('places-panel');
  if (placesPanel) {
    if (!isPlaces) {
      placesPanel.style.display = 'none';
    }
  }
  // Clear GeoJSON source when switching modes to prevent stale data on map
  if (map && map.getSource('pdvs') && !isPlaces) {
    // Don't clear if loading saved map data (allData may be populated by openSavedMap)
  }
  // Tipo do mapa (texto sutil ao lado do brand)
  const labels = { geocoder:'Lat/Lon Generator', reverse_geocoder:'Address Generator', varejo360:'Varejo 360', places_discovery:'Places Discovery' };
  const sub = document.getElementById('brand-sub');
  if (sub) sub.textContent = ' · ' + (labels[currentMapType] || 'Geocodify');
  // View toggle buttons
  const vt = document.getElementById('view-toggle-btns');
  if (vt) vt.style.display = (isGeo || isPlaces) ? 'flex' : 'none';
}

// ─── Modal de seleção de tipo ─────────────────────────────────────────────────
function openMapTypeModal() {
  const m = document.getElementById('map-type-modal');
  m.style.display = 'flex';
  m.style.opacity = '1';
  m.style.pointerEvents = 'all';
  m.classList.add('active');
}
function closeMapTypeModal() {
  const m = document.getElementById('map-type-modal');
  m.classList.remove('active');
  m.style.display = 'none';
  m.style.opacity = '0';
  m.style.pointerEvents = 'none';
}
// Fechar modal ao clicar no backdrop
document.addEventListener('click', e => {
  const modal = document.getElementById('map-type-modal');
  if (modal?.classList.contains('active') && e.target === modal) closeMapTypeModal();
});
function selectMapType(type) {
  currentMapType = type;
  closeMapTypeModal();
  // Limpar dados do mapa anterior — evita sobrescrever mapa existente
  allData = [];
  filteredData = [];
  rawCSVData = [];
  window._pendingMapName = null;
  window._pendingMapDesc = null;
  window._pendingMapType = type;
  window._pendingPeriodo = null;

  // Adaptar UI conforme o tipo
  const periodoEl = document.getElementById('step2-periodo');
  const uploadSub = document.querySelector('#upload-zone .upload-sub');
  const formatsMsg = document.getElementById('upload-formats-msg');
  const startBtn = document.getElementById('btn-start-geo');
  const uploadTitle = document.querySelector('#drop-zone .upload-title');

  if (type === 'geocoder') {
    if (uploadTitle) uploadTitle.textContent = 'Gerar Lat/Lon';
    if (uploadSub) uploadSub.textContent = 'Suba um CSV com endereços. O sistema geocodifica cada linha e gera as coordenadas (lat/lon).';
    if (formatsMsg) formatsMsg.textContent = 'Aceita endereço por extenso com cidade e UF';
    if (startBtn) startBtn.textContent = 'Iniciar geocodificação →';
    if (periodoEl) periodoEl.style.display = 'none';
    renderUploadTemplate('geocoder');
  } else if (type === 'reverse_geocoder') {
    if (uploadTitle) uploadTitle.textContent = 'Gerar Endereços';
    if (uploadSub) uploadSub.textContent = 'Suba um CSV com colunas lat e lon. O sistema busca o endereço completo de cada coordenada via reverse geocoding.';
    if (formatsMsg) formatsMsg.textContent = 'Colunas obrigatórias: lat · lon — opcionais: nome · categoria';
    if (startBtn) startBtn.textContent = 'Iniciar reverse geocoding →';
    if (periodoEl) periodoEl.style.display = 'none';
    renderUploadTemplate('reverse_geocoder');
  } else if (type === 'places_discovery') {
    // Places Discovery: abrir setup overlay em vez do upload zone
    showPlacesSetup();
    return; // não chamar showUploadZone()
  } else {
    if (uploadTitle) uploadTitle.textContent = 'Mapa de Share por PDV';
    if (uploadSub) uploadSub.innerHTML = 'Exporte do Varejo 360 o share da marca aberto por <strong>Loja (CNPJ)</strong>. O sistema geocodifica cada PDV e plota o share no mapa.';
    if (formatsMsg) formatsMsg.textContent = 'Formato HYPR/Kantar · CSV com cnpj + share · CNPJ raiz (8 dígitos)';
    if (startBtn) startBtn.textContent = 'Iniciar geocodificação →';
    if (periodoEl) periodoEl.style.display = 'flex';
    renderUploadTemplate('varejo360');
  }

  // Mostrar view toggle só para geocoder
  const vtBtns = document.getElementById('view-toggle-btns');
  if (vtBtns) vtBtns.style.display = type !== 'varejo360' ? 'flex' : 'none';

  showUploadZone();
}

// ─── Template preview e download por tipo de mapa ────────────────────────────
var _uploadTemplates = {
  geocoder: {
    label: 'Formato esperado do CSV',
    headers: ['endereco', 'nome'],
    rows: [
      ['RUA DO COMERCIO, 150, CENTRO, RECIFE, PE', 'Loja Centro'],
      ['AV PAULISTA, 1000, BELA VISTA, SAO PAULO, SP', 'Filial SP'],
      ['ROD BR-101, KM 45, CAMAÇARI, BA', 'CD Bahia'],
    ],
    tip: 'Inclua cidade e UF para maior precisão na geocodificação.',
    filename: 'template_geocoder.csv',
  },
  reverse_geocoder: {
    label: 'Formato esperado do CSV',
    headers: ['lat', 'lon', 'nome'],
    rows: [
      ['-23.56132', '-46.65618', 'Ponto A'],
      ['-22.90680', '-43.17290', 'Ponto B'],
      ['-19.91910', '-43.93860', 'Ponto C'],
    ],
    tip: 'Use coordenadas decimais (WGS84). A coluna "nome" é opcional.',
    filename: 'template_reverse_geocoder.csv',
  },
  varejo360: {
    label: 'Formato Varejo 360 — Share por Loja (CNPJ)',
    headers: ['marca', 'cnpj', 'percentual_dimensao', 'percentual_marca_dimensao', 'tickets_amostra'],
    displayHeaders: ['marca', 'cnpj', '% dimensão', '% marca', 'tickets'],
    rows: [
      ['ITALAC', '44480747000160 - PARADA PINTO, 2262 - V.N. CACHOEIRINHA', '0.47', '3.14', '9187'],
      ['ITALAC', '43559079000602 - LUIS STAMATIS, 431 - SAO PAULO/SP', '0.38', '20.78', '6168'],
      ['ITALAC', '06057223054697 - AV ANA COSTA, 340 - SANTOS/SP', '0.32', '22.89', '5234'],
    ],
    tip: 'No Varejo 360, exporte o share da marca aberto por dimensão <strong>Loja (CNPJ)</strong>.',
    filename: 'template_varejo360_share.csv',
  },
};

function renderUploadTemplate(type) {
  var tpl = _uploadTemplates[type];
  var preview = document.getElementById('upload-tpl-preview');
  var dlBtn = document.getElementById('upload-tpl-dl');
  if (!tpl || !preview) { if (preview) preview.style.display = 'none'; if (dlBtn) dlBtn.style.display = 'none'; return; }

  var html = '<div class="tpl-label"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> ' + tpl.label + '</div>';
  var displayH = tpl.displayHeaders || tpl.headers;
  html += '<table><thead><tr>' + displayH.map(function(h) { return '<th>' + h + '</th>'; }).join('') + '</tr></thead><tbody>';
  tpl.rows.forEach(function(row) {
    html += '<tr>' + row.map(function(v) { return '<td>' + v + '</td>'; }).join('') + '</tr>';
  });
  html += '</tbody></table>';
  if (tpl.tip) html += '<div style="margin-top:8px;font-size:11px;color:var(--text-muted);line-height:1.5;text-align:left;">💡 ' + tpl.tip + '</div>';

  preview.innerHTML = html;
  preview.style.display = 'block';
  if (dlBtn) { dlBtn.style.display = 'inline-flex'; dlBtn.setAttribute('data-type', type); }
}

function downloadTemplate(e) {
  if (e) e.stopPropagation();
  var btn = document.getElementById('upload-tpl-dl');
  var type = btn?.getAttribute('data-type') || 'geocoder';
  var tpl = _uploadTemplates[type];
  if (!tpl) return;

  var csvRows = [tpl.headers.join(',')];
  tpl.rows.forEach(function(row) {
    csvRows.push(row.map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','));
  });
  var blob = new Blob([csvRows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = tpl.filename; a.click();
  URL.revokeObjectURL(url);
}

// ─── Varejo 360: Sub-modal de seleção ────────────────────────────────────────
function openVarejoSubModal() {
  closeMapTypeModal();
  var m = document.getElementById('varejo-sub-modal');
  m.style.display = 'flex';
  m.style.opacity = '1';
  m.style.pointerEvents = 'all';
  m.classList.add('active');
}
function closeVarejoSubModal() {
  var m = document.getElementById('varejo-sub-modal');
  m.classList.remove('active');
  m.style.display = 'none';
  m.style.opacity = '0';
  m.style.pointerEvents = 'none';
}
document.addEventListener('click', function(e) {
  var modal = document.getElementById('varejo-sub-modal');
  if (modal && modal.classList.contains('active') && e.target === modal) closeVarejoSubModal();
});
function selectVarejoSubType(subType) {
  closeVarejoSubModal();
  if (subType === 'comparativo') {
    window.location.href = '/comparativo.html';
  } else {
    selectMapType('varejo360');
  }
}

// ─── View toggle mapa/lista ───────────────────────────────────────────────────
var currentView = 'map';
function setMapView(view) {
  currentView = view;
  const listEl = document.getElementById('geocoder-list-view');
  const btnMap  = document.getElementById('btn-view-map');
  const btnList = document.getElementById('btn-view-list');
  const placesPanel = document.getElementById('places-panel');

  if (btnMap) btnMap.classList.toggle('active', view === 'map');
  if (btnList) btnList.classList.toggle('active', view === 'list');

  if (view === 'list') {
    if (listEl) {
      listEl.style.display = 'block';
      // Garantir que a lista está ACIMA do mapa (z-index)
      listEl.style.zIndex = '50';
      listEl.style.position = 'absolute';
      listEl.style.inset = '0';
      listEl.style.background = 'var(--bg)';
      listEl.style.overflowY = 'auto';
      listEl.style.padding = '16px';
    }
    // Places Discovery panel sits at z-index:500 and would overlap the list.
    // Remember its visibility and hide it while list is open.
    if (placesPanel && currentMapType === 'places_discovery') {
      placesPanel._wasVisibleBeforeList = placesPanel.style.display !== 'none';
      placesPanel.style.display = 'none';
    }
    renderGeocoderList();
  } else {
    if (listEl) listEl.style.display = 'none';
    // Restore places-panel when returning to the map.
    if (placesPanel && currentMapType === 'places_discovery' && placesPanel._wasVisibleBeforeList) {
      placesPanel.style.display = 'block';
      placesPanel._wasVisibleBeforeList = false;
    }
    setTimeout(() => map && map.resize(), 100);
  }
}

function renderGeocoderList() {
  const thead = document.getElementById('geocoder-thead');
  const tbody = document.getElementById('geocoder-tbody');
  const countEl = document.getElementById('list-count');
  if (!thead || !tbody) return;

  const data = filteredData.length ? filteredData : allData;
  const failCount = data.filter(r => r._geocodeFailed).length;
  const mismatchCount = data.filter(r => r._ufMismatch).length;
  let summaryParts = [`${data.length.toLocaleString('pt-BR')} pontos`];
  if (failCount > 0)    summaryParts.push(`<span style="color:var(--lose);">${failCount.toLocaleString('pt-BR')} não identificados</span>`);
  if (mismatchCount > 0) summaryParts.push(`<span style="color:var(--neutral);">${mismatchCount.toLocaleString('pt-BR')} UF divergente</span>`);
  countEl.innerHTML = summaryParts.join(' · ');

  // Colunas conforme tipo — mostrar apenas dados relevantes
  let cols = [];
  const isGeoMode = currentMapType === 'geocoder' || currentMapType === 'reverse_geocoder';
  if (currentMapType === 'geocoder') {
    cols = ['_input', 'lat', 'lon', 'geo_address', '_status'];
  } else if (currentMapType === 'reverse_geocoder') {
    cols = ['nome', 'input_lat', 'input_lon', 'geo_address', '_status'];
  } else if (currentMapType === 'places_discovery') {
    cols = ['nome', 'geo_address', 'lat', 'lon', 'place_types', 'place_status'];
  } else {
    // Varejo 360: full columns including bandeira and CNPJ
    cols = ['bandeira', 'lat', 'lon', 'geo_address', 'cnpj'];
  }

  const labels = { nome: 'Nome', bandeira: 'Bandeira/Rede', lat: 'Latitude', lon: 'Longitude',
    geo_address: 'Endereço Geocodificado', cnpj: 'CNPJ', input_lat: 'Lat input', input_lon: 'Lon input',
    place_types: 'Tipos', place_status: 'Status', place_id: 'Place ID', _status: 'Status',
    _input: 'Endereço Original' };

  thead.innerHTML = cols.map(c => `<th style="padding:8px 10px;text-align:left;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);border-bottom:1px solid var(--border);">${labels[c]||c}</th>`).join('');

  // Sort: falhas primeiro, depois mismatches, depois OK
  const sorted = [...data].sort((a, b) => {
    const aW = a._geocodeFailed ? 2 : (a._ufMismatch ? 1 : 0);
    const bW = b._geocodeFailed ? 2 : (b._ufMismatch ? 1 : 0);
    return bW - aW;
  });

  tbody.innerHTML = sorted.slice(0, 500).map((r, i) => {
    const isFail = r._geocodeFailed;
    const isMismatch = !isFail && r._ufMismatch;
    const rowStyle = isFail ? 'border-bottom:1px solid var(--border);background:rgba(239,68,68,0.06);'
      : isMismatch ? 'border-bottom:1px solid var(--border);background:rgba(245,158,11,0.06);'
      : 'border-bottom:1px solid var(--border);';
    return `<tr style="${rowStyle}">
      ${cols.map(c => {
        if (c === '_status') {
          if (isFail) return '<td style="padding:7px 10px;font-size:11px;"><span style="color:var(--lose);font-weight:500;">✗ Não identificado</span></td>';
          if (isMismatch) return `<td style="padding:7px 10px;font-size:11px;"><span style="color:var(--neutral);font-weight:500;" title="Esperava ${r._expectedUF}, HERE retornou ${r.uf}">⚠ UF: ${r._expectedUF}→${r.uf}</span></td>`;
          return '<td style="padding:7px 10px;font-size:11px;"><span style="color:var(--win);">✓ OK</span></td>';
        }
        if (c === '_input') {
          // Endereço original: usar endereco_geocode, _endereco_livre, ou campo endereco do CSV
          var inputAddr = r.endereco_geocode || r._endereco_livre || r.endereco || r['endereço'] || r.address || '';
          var inputName = r.nome || r.marca || '';
          var display = inputName ? inputName + (inputAddr ? ' — ' + inputAddr : '') : inputAddr;
          return `<td style="padding:7px 10px;color:${isFail ? 'var(--lose)' : 'var(--text-dim)'};font-size:12px;" title="${display ? _escForHtml(display) : ''}">${display ? _escForHtml(String(display).slice(0,80)) : '—'}</td>`;
        }
        return `<td style="padding:7px 10px;color:${isFail ? 'var(--lose)' : 'var(--text-dim)'};font-size:12px;">${r[c] != null && r[c] !== '' ? _escForHtml(String(r[c]).slice(0,60)) : '—'}</td>`;
      }).join('')}
    </tr>`;
  }).join('');

  if (data.length > 500) {
    tbody.innerHTML += `<tr><td colspan="${cols.length}" style="padding:12px;text-align:center;color:var(--text-muted);font-size:11px;">Mostrando primeiros 500 de ${data.length.toLocaleString('pt-BR')}. Exporte o CSV para ver todos.</td></tr>`;
  }
}

// ─── Download CSV geocodificado ────────────────────────────────────────────────
function downloadGeocoderCSV() {
  const data = allData.length ? allData : [];
  if (!data.length) { alert('Nenhum dado para exportar.'); return; }

  let cols, labels;
  if (currentMapType === 'geocoder') {
    cols   = ['_input', 'lat', 'lon', 'geo_address', 'uf', 'cep', '_status'];
    labels = ['Endereco_Original', 'Latitude', 'Longitude', 'Endereco_Geocodificado', 'UF', 'CEP', 'Status'];
  } else if (currentMapType === 'reverse_geocoder') {
    cols   = ['nome', 'input_lat', 'input_lon', 'geo_address', 'uf', 'cep', '_status'];
    labels = ['Nome', 'Lat_Input', 'Lon_Input', 'Endereco', 'UF', 'CEP', 'Status'];
  } else if (currentMapType === 'places_discovery') {
    cols   = ['nome', 'geo_address', 'lat', 'lon', 'place_id', 'place_types', 'place_status'];
    labels = ['Nome', 'Endereco', 'Latitude', 'Longitude', 'Google_Place_ID', 'Tipos', 'Status'];
  } else {
    // Varejo 360: identificação + endereço + coordenadas + métricas de share/performance
    cols   = ['bandeira', '_cnpj', 'nome_fantasia', 'razao_social', 'geo_address', 'cidade', 'uf', 'cep', 'lat', 'lon', '_share_reais', '_share_volume', '_share_unidades', '_diff_media', '_performance'];
    labels = ['Bandeira', 'CNPJ', 'Nome_Fantasia', 'Razao_Social', 'Endereco', 'Cidade', 'UF', 'CEP', 'Latitude', 'Longitude', 'Share_Reais_%', 'Share_Volume_%', 'Share_Unidades_%', 'Diff_vs_Media_pp', 'Performance'];
  }

  const esc = v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
  const fmtPct = v => { var n = parseFloat(v || 0); return isFinite(n) ? (n * 100).toFixed(2) : ''; };
  const fmtPp  = v => { var n = parseFloat(v || 0); return isFinite(n) ? n.toFixed(2) : ''; };
  const classifyPerformance = r => {
    var d = parseFloat(r.percentual_diff_media_dimensao || 0);
    if (!isFinite(d) || d === 0) return 'Sem dado';
    if (d > 2) return 'Ganhando';
    if (d < -2) return 'Perdendo';
    return 'Competindo';
  };

  const rows = [labels.join(','), ...data.map(r => cols.map(c => {
    if (c === '_status')      return esc(r._geocodeFailed ? 'Não identificado' : (r._ufMismatch ? 'UF Mismatch (' + r._expectedUF + '→' + (r.uf||'?') + ')' : 'OK'));
    if (c === '_input')       return esc(r.endereco_geocode || r._endereco_livre || r.endereco || r['endereço'] || r.address || '');
    if (c === '_cnpj')        return esc(r.cnpj_completo || (r.cnpj || '').split(' - ')[0] || '');
    if (c === '_share_reais') return esc(fmtPct(r.share_reais_sku_dimensao));
    if (c === '_share_volume')return esc(fmtPct(r.share_volume_sku_dimensao));
    if (c === '_share_unidades') return esc(fmtPct(r.share_unidades_sku_dimensao));
    if (c === '_diff_media')  return esc(fmtPp(r.percentual_diff_media_dimensao));
    if (c === '_performance') return esc(classifyPerformance(r));
    return esc(r[c]);
  }).join(','))];
  const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), { href: url, download: `geocodify_${currentMapType}_${Date.now()}.csv` });
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Reverse Geocoding (lat/lon → endereço) ───────────────────────────────────
async function reverseGeocodeHERE(lat, lon) {
  const resp = await fetch(
    `/api/geocode?action=reverse&at=${lat},${lon}&lang=pt-BR&limit=1`
  );
  if (!resp.ok) return null;
  const d = await resp.json();
  const item = d.items?.[0];
  if (!item) return null;
  return {
    geo_address: item.address?.label || '',
    uf: item.address?.stateCode || '',
    cep: item.address?.postalCode || '',
  };
}

// ─── Resize e Colapso dos Painéis ────────────────────────────────────────────
function initResizablePanels() {
  // Restaurar larguras salvas em CSS vars (handles e map chrome reagem juntos)
  try {
    const sw = localStorage.getItem('hypr_sidebar_w');
    const pw = localStorage.getItem('hypr_panel_w');
    if (sw) document.documentElement.style.setProperty('--sidebar-w', sw);
    if (pw) document.documentElement.style.setProperty('--right-w', pw);
  } catch(e) {}

  // Resize sidebar (handle esquerdo)
  setupResizer('sidebar-resizer', 'sidebar', '--sidebar-w', 'right', 240, 480, 'hypr_sidebar_w');
  // Resize painel direito (handle direito)
  setupResizer('panel-resizer', 'right-panel', '--right-w', 'left', 240, 520, 'hypr_panel_w');
}

function setupResizer(handleId, panelId, cssVar, direction, minW, maxW, storageKey) {
  const handle = document.getElementById(handleId);
  const panel  = document.getElementById(panelId);
  if (!handle || !panel) return;

  let startX, startW;

  handle.addEventListener('mousedown', e => {
    startX = e.clientX;
    startW = panel.getBoundingClientRect().width;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = e => {
      const delta = direction === 'right' ? e.clientX - startX : startX - e.clientX;
      const newW = Math.min(maxW, Math.max(minW, startW + delta));
      // Update CSS var so handle position, map chrome anchors, and panel width
      // all stay in sync. We also keep inline width as a fallback override.
      document.documentElement.style.setProperty(cssVar, newW + 'px');
      panel.style.width = newW + 'px';
      if (map) map.resize();
    };

    const onUp = () => {
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try { localStorage.setItem(storageKey, panel.style.width); } catch(e) {}
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (map) map.resize();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  // Touch support para mobile
  handle.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startW = panel.getBoundingClientRect().width;
    const onMove = e => {
      const delta = direction === 'right' ? e.touches[0].clientX - startX : startX - e.touches[0].clientX;
      const newW = Math.min(maxW, Math.max(minW, startW + delta));
      document.documentElement.style.setProperty(cssVar, newW + 'px');
      panel.style.width = newW + 'px';
    };
    const onEnd = () => {
      try { localStorage.setItem(storageKey, panel.style.width); } catch(e) {}
      handle.removeEventListener('touchmove', onMove);
      handle.removeEventListener('touchend', onEnd);
      if (map) map.resize();
    };
    handle.addEventListener('touchmove', onMove);
    handle.addEventListener('touchend', onEnd);
  }, { passive: true });
}

function toggleFullMap() {
  const app = document.getElementById('app');
  const btn = document.getElementById('btn-fullmap');
  const isFullMap = app.classList.toggle('map-only');
  btn.classList.toggle('active', isFullMap);
  btn.innerHTML = isFullMap
    ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>'
    : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
  btn.setAttribute('title', isFullMap ? 'Recolher (F)' : 'Tela cheia (F)');
  btn.setAttribute('aria-label', isFullMap ? 'Recolher mapa' : 'Expandir mapa');
  try { localStorage.setItem('hypr_fullmap', isFullMap); } catch(e) {}
  setTimeout(() => map && map.resize(), 250);
}

function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('sidebar-collapse');
  const collapsed = sidebar.classList.toggle('collapsed');
  btn.textContent = collapsed ? '›' : '‹';
  try { localStorage.setItem('hypr_sidebar_collapsed', collapsed); } catch(e) {}
  setTimeout(() => map && map.resize(), 220);
}

function togglePanel() {
  const panel = document.getElementById('right-panel');
  const btn = document.getElementById('panel-collapse');
  const collapsed = panel.classList.toggle('collapsed');
  btn.textContent = collapsed ? '‹' : '›';
  try { localStorage.setItem('hypr_panel_collapsed', collapsed); } catch(e) {}
  setTimeout(() => map && map.resize(), 220);
}

document.addEventListener('DOMContentLoaded', () => {
  initResizablePanels();
  // Restaurar estado de colapso
  try {
    if (localStorage.getItem('hypr_sidebar_collapsed') === 'true') toggleSidebar();
    if (localStorage.getItem('hypr_panel_collapsed') === 'true') togglePanel();
    if (localStorage.getItem('hypr_fullmap') === 'true') toggleFullMap();
  } catch(e) {}

  // Atalho de teclado: F = toggle tela cheia do mapa
  document.addEventListener('keydown', e => {
    if (e.key === 'f' || e.key === 'F') {
      // Não disparar se estiver em input/textarea
      if (['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)) return;
      toggleFullMap();
    }
    // ESC sai do modo tela cheia ou fecha modal/toast
    if (e.key === 'Escape') {
      var geoToast = document.getElementById('geo-toast');
      if (geoToast && geoToast.classList.contains('active')) { dismissGeoToast(); return; }
      var vsm = document.getElementById('varejo-sub-modal');
      if (vsm && vsm.classList.contains('active')) { closeVarejoSubModal(); return; }
      const modal = document.getElementById('map-type-modal');
      if (modal?.classList.contains('active')) { closeMapTypeModal(); return; }
      const app = document.getElementById('app');
      if (app.classList.contains('map-only')) toggleFullMap();
    }
  });

  // Check for shared mode (public link) before normal auth
  if (typeof initSharedMode === 'function') {
    initSharedMode().then(function(handled) {
      if (!handled) initAuth();
    });
  } else {
    initAuth();
  }
});
var rawCSVData = [];
var geocodingCancelled = false;
var geocodingActive = false;

// ─── Step Navigation ─────────────────────────────────────────────────────────
function goToStep(n) {
  document.getElementById('drop-zone').style.display = n === 1 ? 'block' : 'none';
  document.getElementById('step-apikey-box').style.display = n === 2 ? 'block' : 'none';

  [1,2].forEach(i => {
    const el = document.getElementById('step-' + i);
    if (!el) return;
    el.classList.remove('active','done');
    if (i < n) el.classList.add('done');
    if (i === n) el.classList.add('active');
  });
}

// ─── Address Parser ───────────────────────────────────────────────────────────
function extrairEndereco(cnpjCol) {
  // Formato: "CNPJ - RUA, NUM - BAIRRO - CIDADE/UF"
  const partes = cnpjCol.split(' - ');
  if (partes.length < 2) return { address: cnpjCol + ', Brasil', street: cnpjCol, city: '', state: '', district: '' };

  // partes[0] = CNPJ (ignorar)
  // partes[1] = Rua + número: "ALEXANDRE COLARES, 1188"
  // partes[2..n-1] = Bairro(s) intermediários
  // partes[último] = "CIDADE/UF"

  const ruaNum = (partes[1] || '').trim();

  const ultimo = partes[partes.length - 1] || '';
  const matchCidade = ultimo.match(/^(.+?)\/([A-Z]{2})\s*$/);
  const cidade = matchCidade ? matchCidade[1].trim() : '';
  const uf    = matchCidade ? matchCidade[2] : '';

  // Incluir bairro(s) intermediários para melhorar precisão do geocoding
  const bairros = partes.slice(2, partes.length - 1).map(b => b.trim()).filter(Boolean);
  const bairro = bairros.join(', ');

  const partesCombinadas = [ruaNum, bairro, cidade, uf, 'Brasil'].filter(Boolean);
  return {
    address: partesCombinadas.join(', '),
    street: ruaNum,
    city: cidade,
    state: uf,
    district: bairro,
  };
}

// ─── Tabela de bandeiras por CNPJ Raiz ───────────────────────────────────────
// ATENÇÃO: Esta tabela é usada APENAS como placeholder visual temporário enquanto
// a Receita Federal ainda não respondeu. O nome real (nome_fantasia da Receita)
// SEMPRE sobrescreve este valor. Nunca confiar nesta tabela como fonte de verdade.
// Fonte autoritativa: publica.cnpj.ws — consultada em tempo real para cada PDV.
// Tabela de bandeiras REMOVIDA — identificação 100% via Receita Federal (CNPJ completo).
// Usar CNPJ raiz para identificar bandeira é incorreto: filiais de empresas diferentes
// podem compartilhar os mesmos primeiros 8 dígitos por coincidência de numeração.
// Exemplo real: CNPJ 61585865/2819-08 = Raia Drogasil, não Carrefour.

// Placeholder visual temporário — exibido APENAS enquanto a Receita Federal ainda não respondeu.
// NUNCA usar como valor final. aplicarReceita() sempre sobrescreve com dado real da Receita.
// Não identificamos por CNPJ raiz (8 dígitos) pois filiais de empresas diferentes podem
// compartilhar os mesmos primeiros 8 dígitos (ex: Raia Drogasil vs Carrefour).
function identificarBandeira(cnpjCol) {
  return 'Carregando...'; // Receita Federal vai resolver via CNPJ completo
}

// Aplica dados da Receita Federal a um row — ÚNICA fonte autoritativa de bandeira/nome.
// Sempre chamada com await no loop de geocoding. Nunca usar identificarBandeira como valor final.
function aplicarReceita(row, receita) {
  if (!receita) {
    // Receita falhou — marcar como não identificado (nunca deixar "Carregando...")
    if (row.bandeira === 'Carregando...') row.bandeira = 'Não identificado';
    return;
  }
  // Nome fantasia > razão social > CNPJ como último recurso — nunca retornar vazio
  const nomeReal = receita.nome_exibicao || receita.nome_fantasia || receita.razao_social || '';
  // Sempre sobrescrever — mesmo que nomeReal seja razão social (mais verdadeiro que placeholder)
  row.nome_fantasia = receita.nome_fantasia || '';
  row.razao_social  = receita.razao_social  || '';
  row.bandeira      = nomeReal || row.cnpj || 'Não identificado';
  if (receita.municipio)         row.cidade            = receita.municipio;
  if (receita.uf_receita)        row.uf                = receita.uf_receita;
  if (receita.cep)               row.cep               = receita.cep;
  if (receita.situacao)          row.situacao          = receita.situacao;
  if (receita.atividade)         row.atividade         = receita.atividade;
  if (receita.endereco_receita)  row.endereco_receita  = receita.endereco_receita;
}

// ─── CNPJ Geocode Cache (Varejo 360) ─────────────────────────────────────────
// Permite reaproveitar lat/lon já computado para um CNPJ em uploads anteriores
// (próprios ou de outros usuários HYPR), pulando a chamada HERE.
//
// Match estrito por CNPJ completo (14 dígitos). CNPJ raiz (8) NÃO entra no
// cache de geocode porque a raiz cobre múltiplos estabelecimentos com lat/lon
// distintos — esses casos seguem o fluxo HERE normal.
//
// SCOPE ISOLATION: mexe apenas em `cnpj_cache`. Nenhuma referência a
// `places_cache` ou Places Discovery.
function _normalizeCnpj14(raw) {
  if (!raw) return null;
  var digits = String(raw).split(' - ')[0].replace(/\D/g, '');
  if (digits.length < 14) return null;
  return digits.slice(0, 14);
}

// Bulk SELECT em cnpj_cache filtrando só linhas com lat/lon válidos. Retorna
// Map<cnpj14, { cnpj, lat, lon, geo_address, uf_geocode }>. Falha de rede
// degrada graciosamente — perde a otimização para esse chunk, HERE assume.
async function bulkCnpjGeocodeLookup(cnpjs) {
  var hits = new Map();
  if (!cnpjs || !cnpjs.length) return hits;
  // CNPJ tem 14 chars + vírgula = 15 chars/ID. 200 IDs ~3KB de URL, bem abaixo
  // do limite típico de 8-16k em proxies/CDNs.
  var CHUNK = 200;
  for (var i = 0; i < cnpjs.length; i += CHUNK) {
    var slice = cnpjs.slice(i, i + CHUNK);
    var idList = slice.map(encodeURIComponent).join(',');
    var url = SUPABASE_URL + '/rest/v1/cnpj_cache?cnpj=in.(' + idList + ')'
      + '&lat=not.is.null&lon=not.is.null'
      + '&select=cnpj,lat,lon,geo_address,uf_geocode';
    try {
      var resp = await fetch(url, {
        headers: { 'apikey': SUPABASE_ANON, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000),
      });
      if (!resp.ok) continue;
      var rows = await resp.json();
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        if (row && row.cnpj && row.lat != null && row.lon != null) hits.set(row.cnpj, row);
      }
    } catch (e) {
      console.warn('[cnpj-geo-cache] chunk failed:', e && e.message);
    }
  }
  return hits;
}

// Acumula rows com geocode novo (pós-HERE) e faz upsert em lote no cnpj_cache.
// Fire-and-forget — falha de rede no upsert não afeta a UX, o cache
// simplesmente não cresce desta vez.
var _pendingGeoUpserts = [];
var _flushingGeoUpserts = false;

async function flushCnpjGeoUpserts(force) {
  if (_flushingGeoUpserts) return;
  if (!_pendingGeoUpserts.length) return;
  if (!force && _pendingGeoUpserts.length < 50) return;
  _flushingGeoUpserts = true;
  var batch = _pendingGeoUpserts.splice(0, _pendingGeoUpserts.length);
  try {
    // Dedup por CNPJ na própria batch — última escrita vence
    var seen = new Map();
    for (var i = 0; i < batch.length; i++) seen.set(batch[i].cnpj, batch[i]);
    var payload = Array.from(seen.values());
    var authToken = SUPABASE_ANON;
    try {
      if (typeof _supa !== 'undefined' && _supa && _supa.auth) {
        var sess = await _supa.auth.getSession();
        authToken = (sess && sess.data && sess.data.session && sess.data.session.access_token) || SUPABASE_ANON;
      }
    } catch (e) {}
    await fetch(SUPABASE_URL + '/rest/v1/cnpj_cache?on_conflict=cnpj', {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON,
        'Authorization': 'Bearer ' + authToken,
        'Content-Type': 'application/json',
        'Prefer': 'resolution=merge-duplicates,return=minimal',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
  } catch (e) {
    console.warn('[cnpj-geo-cache] upsert failed:', e && e.message);
  } finally {
    _flushingGeoUpserts = false;
  }
}

// Enfileira uma linha pra upsert. Só linhas com cnpj 14d válido + lat/lon.
function queueCnpjGeoUpsert(row) {
  var key = _normalizeCnpj14(row && row.cnpj);
  if (!key) return;
  if (row.lat == null || row.lon == null) return;
  _pendingGeoUpserts.push({
    cnpj: key,
    lat: row.lat,
    lon: row.lon,
    geo_address: row.geo_address || null,
    uf_geocode: row.uf || null,
    geocoded_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

// Reset dos campos do overlay compartilhado com Varejo 360.
// Espelha _resetPlacesOverlayFields — chamado em entry points pra evitar
// contaminação entre fluxos (Places, Varejo 360, geocoder, etc).
function _resetVarejoOverlayFields() {
  var cacheChip = document.getElementById('geo-cache');
  if (cacheChip) { cacheChip.style.display = 'none'; cacheChip.textContent = '💾 0'; }
  var fillCache = document.getElementById('geo-fill-cache');
  if (fillCache) fillCache.style.width = '0%';
  var fillApi = document.getElementById('geo-fill-api');
  if (fillApi) fillApi.style.width = '0%';
}

// ─── Geocoding HERE (endereço → lat/lon) ─────────────────────────────────────
// Usa structured geocoding (qq=) quando cidade/UF disponíveis para forçar
// localidade correta. Fallback para freeform (q=) quando sem contexto.
// Valida UF retornada vs esperada; busca até 5 resultados para cross-check.
var _geoCache = {};
var _GEO_SCORE_MIN = 0.5; // threshold mínimo de queryScore

// Converte item da resposta HERE em objeto padronizado
function _hereItemToResult(item, address) {
  return {
    lat: item.position.lat,
    lon: item.position.lng,
    geo_address: item.address?.label || address || '',
    geo_score: item.scoring?.queryScore || 0,
    uf: item.address?.stateCode || '',
    municipio: item.address?.city || item.address?.district || '',
    cep: item.address?.postalCode || '',
  };
}

// Limpa ruído de endereços comerciais (shoppings, lojas, pisos) para melhorar geocoding
function _cleanCommercialAddress(addr) {
  if (!addr) return addr;
  var s = addr;
  // Remover nome de shopping antes do endereço real: "NomeShopping - Rua..."
  s = s.replace(/^[\w\sÀ-ÿ\.]+Shopping\s*-\s*/i, '');
  s = s.replace(/^Shopping\s+[\w\sÀ-ÿ]+\s*-\s*/i, '');
  // Remover "Loja XXX" e "Piso XXX"
  s = s.replace(/\s*-?\s*Loja\s+\d+[A-Za-z]?\s*-?\s*/gi, ' ');
  s = s.replace(/\s+Piso\s+(?:Térreo|Trreo|Terreo|L\d+|\d+[ºª°]?\s*(?:Piso)?)\s*/gi, ' ');
  s = s.replace(/\s+\d+[ºª°]\s*(?:Andar|Piso)\s*/gi, ' ');
  // Remover "R. Eng." solto (fragmento)
  s = s.replace(/\s+R\.\s+Eng\.\s*/g, ' ');
  // Remover "Gleba XXXX" (loteamento)
  s = s.replace(/\s+Gleba\s+\w+\s*/gi, ' ');
  // Remover "Ac." (acesso)
  s = s.replace(/\s+Ac\.\s+/g, ' ');
  // Remover "PAVMTO1" e similares
  s = s.replace(/\s+PAVMT?O?\d*\s*/gi, ' ');
  // Limpar hifens duplos e espaços
  s = s.replace(/\s*-\s*-\s*/g, ' - ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

// opts: { street, city, state, district } — campos structured (opcional)
// Se presentes, usa qq= (structured); senão, usa q= (freeform)
async function geocodeHERE(address, opts) {
  if (!address && !opts?.street) return null;

  // Cache key inclui contexto structured
  const cacheExtra = opts ? `|${opts.city||''}|${opts.state||''}` : '';
  const key = (address || '').toLowerCase().trim() + cacheExtra;
  if (_geoCache[key] !== undefined) return _geoCache[key];

  try {
    let url;
    const hasStructured = opts && (opts.city || opts.state);

    if (hasStructured) {
      // Structured geocoding — HERE respeita city/state como restrições
      const parts = [];
      if (opts.street)   parts.push('street=' + encodeURIComponent(opts.street));
      if (opts.district) parts.push('district=' + encodeURIComponent(opts.district));
      if (opts.city)     parts.push('city=' + encodeURIComponent(opts.city));
      if (opts.state)    parts.push('state=' + encodeURIComponent(opts.state));
      parts.push('country=Brasil');
      url = `/api/geocode?qq=${parts.join(';')}&limit=5&lang=pt-BR`;
    } else {
      // Freeform — sem contexto de cidade/UF
      url = `/api/geocode?q=${encodeURIComponent(address)}&in=countryCode:BRA&limit=5&lang=pt-BR`;
    }

    const resp = await fetch(url);
    if (!resp.ok) { _geoCache[key] = null; return null; }
    const d = await resp.json();
    if (!d.items?.length) { _geoCache[key] = null; return null; }

    const expectedUF = (opts?.state || '').toUpperCase();
    const expectedCity = (opts?.city || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Se temos UF esperada, tentar encontrar resultado que bata
    if (expectedUF) {
      // 1) Procurar match exato de UF + melhor score
      const ufMatches = d.items
        .filter(it => (it.address?.stateCode || '').toUpperCase() === expectedUF)
        .map(it => _hereItemToResult(it, address));

      if (ufMatches.length > 0) {
        // Se temos cidade, preferir match de cidade dentro dos que batem UF
        if (expectedCity) {
          const cityMatch = ufMatches.find(r => {
            const rCity = (r.municipio || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return rCity === expectedCity;
          });
          if (cityMatch && cityMatch.geo_score >= _GEO_SCORE_MIN) {
            _geoCache[key] = cityMatch;
            return cityMatch;
          }
        }
        // Pegar melhor score entre os que batem UF
        const best = ufMatches.reduce((a, b) => b.geo_score > a.geo_score ? b : a);
        if (best.geo_score >= _GEO_SCORE_MIN) {
          _geoCache[key] = best;
          return best;
        }
      }

      // 2) Nenhum resultado bateu UF ou score muito baixo — fallback freeform se era structured
      if (hasStructured && address) {
        const fallUrl = `/api/geocode?q=${encodeURIComponent(address)}&in=countryCode:BRA&limit=5&lang=pt-BR`;
        const fallResp = await fetch(fallUrl);
        if (fallResp.ok) {
          const fallD = await fallResp.json();
          if (fallD.items?.length) {
            const fallUF = fallD.items
              .filter(it => (it.address?.stateCode || '').toUpperCase() === expectedUF)
              .map(it => _hereItemToResult(it, address));
            if (fallUF.length > 0) {
              const best2 = fallUF.reduce((a, b) => b.geo_score > a.geo_score ? b : a);
              if (best2.geo_score >= _GEO_SCORE_MIN) {
                _geoCache[key] = best2;
                return best2;
              }
            }
          }
        }
      }
    }

    // 3) Sem UF esperada ou nenhum match — pegar primeiro resultado com score aceitável
    const first = _hereItemToResult(d.items[0], address);
    if (first.geo_score >= _GEO_SCORE_MIN) {
      // Marcar mismatch se UF esperada e não bateu
      if (expectedUF && first.uf.toUpperCase() !== expectedUF) {
        first._ufMismatch = true;
        first._expectedUF = expectedUF;
      }
      _geoCache[key] = first;
      return first;
    }

    // Score abaixo do threshold — tentar com endereço limpo (sem shopping/loja/piso)
    var cleanedAddr = _cleanCommercialAddress(address);
    if (cleanedAddr && cleanedAddr !== address) {
      var cleanUrl = `/api/geocode?q=${encodeURIComponent(cleanedAddr)}&in=countryCode:BRA&limit=5&lang=pt-BR`;
      var cleanResp = await fetch(cleanUrl);
      if (cleanResp.ok) {
        var cleanD = await cleanResp.json();
        if (cleanD.items?.length) {
          // Se temos UF esperada, filtrar por ela
          if (expectedUF) {
            var cleanUF = cleanD.items
              .filter(function(it) { return (it.address?.stateCode || '').toUpperCase() === expectedUF; })
              .map(function(it) { return _hereItemToResult(it, address); });
            if (cleanUF.length > 0) {
              var bestClean = cleanUF.reduce(function(a, b) { return b.geo_score > a.geo_score ? b : a; });
              if (bestClean.geo_score >= _GEO_SCORE_MIN) {
                _geoCache[key] = bestClean;
                return bestClean;
              }
            }
          }
          // Sem UF ou sem match: pegar primeiro com score ok
          var firstClean = _hereItemToResult(cleanD.items[0], address);
          if (firstClean.geo_score >= _GEO_SCORE_MIN) {
            if (expectedUF && firstClean.uf.toUpperCase() !== expectedUF) {
              firstClean._ufMismatch = true;
              firstClean._expectedUF = expectedUF;
            }
            _geoCache[key] = firstClean;
            return firstClean;
          }
        }
      }
    }

    // Último fallback: tentar só com CEP se disponível
    var cepMatch = (address || '').match(/(\d{5}-?\d{3})/);
    if (cepMatch) {
      var cepUrl = `/api/geocode?q=${encodeURIComponent(cepMatch[1] + ' Brasil')}&in=countryCode:BRA&limit=1&lang=pt-BR`;
      var cepResp = await fetch(cepUrl);
      if (cepResp.ok) {
        var cepD = await cepResp.json();
        if (cepD.items?.length) {
          var cepResult = _hereItemToResult(cepD.items[0], address);
          cepResult._cepFallback = true;
          _geoCache[key] = cepResult;
          return cepResult;
        }
      }
    }

    _geoCache[key] = null;
    return null;
  } catch(e) {
    _geoCache[key] = null;
    return null;
  }
}

// ─── API CNPJ.ws (Receita Federal) ─────────────────────────────────────────
// Usa cnpj.ws — sem rate limit agressivo, dados direto da Receita Federal
var _receitaCache = {};
var _receitaInFlight = 0;    // throttle de requisições simultâneas
var _receitaPending = 0;     // total de requisições pendentes (para aguardar antes do save)

async function buscarReceitaEstab(estab, razaoSocial) {
  // Nome fantasia é preferido; fallback para razão social — nunca retornar string vazia
  const nomeFantasia = (estab.nome_fantasia || '').trim();
  const razao        = (razaoSocial || estab.razao_social || '').trim();
  const logradouro   = [estab.tipo_logradouro, estab.logradouro, estab.numero, estab.complemento]
    .filter(Boolean).join(' ');
  const bairro = (estab.bairro || '').trim();
  const cidade = estab.cidade?.nome || '';
  const uf     = estab.estado?.sigla || '';
  const cep    = (estab.cep || '').replace(/\D/g, '');
  return {
    nome_fantasia:    nomeFantasia,
    razao_social:     razao,
    nome_exibicao:    nomeFantasia || razao,  // fonte de verdade para row.bandeira
    endereco_receita: [logradouro, bairro, cidade, uf, 'Brasil'].filter(Boolean).join(', '),
    municipio:        cidade,
    uf_receita:       uf,
    cep,
    situacao:         estab.situacao_cadastral || '',
    atividade:        estab.atividade_principal?.descricao || estab.cnae_fiscal_descricao || '',
    logradouro,
    bairro,
    numero:           estab.numero || '',
  };
}

// Busca CNPJ completo na Receita Federal via publica.cnpj.ws com fallback para BrasilAPI.
// Para CNPJ raiz (8 dígitos): busca via /estabelecimentos e usa a filial mais representativa
// (a que tiver mais funcionários ou a primeira ativa), NÃO a primeira filial aleatória.
// Garantias: (1) sempre usa CNPJ completo de 14 dígitos para identificação de filial,
//            (2) razão social é fallback obrigatório quando nome_fantasia ausente,
//            (3) BrasilAPI como segunda fonte se cnpj.ws falhar.
async function buscarReceita(cnpjCol, _retries) {
  if (_retries === undefined) _retries = 0;
  var MAX_RETRIES = 3;
  const cnpjNum = (cnpjCol.split(' - ')[0] || '').replace(/\D/g, '').slice(0, 14);
  if (!cnpjNum) return null;

  // CNPJ Raiz (8 dígitos) — busca a primeira filial ativa via /estabelecimentos
  if (cnpjNum.length === 8) {
    const cacheKey = 'raiz_' + cnpjNum;
    if (_receitaCache[cacheKey] !== undefined) return _receitaCache[cacheKey];
    if (_receitaInFlight >= 5) await new Promise(r => setTimeout(r, 300));
    _receitaInFlight++;
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjNum}/estabelecimentos?quantidade=5`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' }
      });
      clearTimeout(tid);
      if (resp.status === 429) {
        _receitaInFlight--;
        if (_retries >= MAX_RETRIES) { _receitaCache[cacheKey] = null; return null; }
        await new Promise(r => setTimeout(r, 2000 * (_retries + 1)));
        return buscarReceita(cnpjCol, _retries + 1);
      }
      if (!resp.ok) { _receitaCache[cacheKey] = null; _receitaInFlight--; return null; }
      const d = await resp.json();
      // Escolher a primeira filial ativa (situacao_cadastral = "Ativa" ou "ATIVA")
      const estabs = Array.isArray(d) ? d : (d.estabelecimentos || d.data || []);
      const ativa = estabs.find(e => /ativa/i.test(e.situacao_cadastral || '')) || estabs[0];
      if (!ativa) { _receitaCache[cacheKey] = null; _receitaInFlight--; return null; }
      const result = await buscarReceitaEstab(ativa, d.razao_social || ativa.razao_social || '');
      _receitaCache[cacheKey] = result;
      _receitaInFlight--;
      _receitaPending = Math.max(0, _receitaPending - 1);
      return result;
    } catch {
      _receitaCache['raiz_' + cnpjNum] = null;
      _receitaInFlight = Math.max(0, _receitaInFlight - 1);
      _receitaPending  = Math.max(0, _receitaPending - 1);
      return null;
    }
  }

  if (cnpjNum.length < 14) return null;

  // Cache por CNPJ completo (14 dígitos) — cada filial tem endereço único
  if (_receitaCache[cnpjNum] !== undefined) return _receitaCache[cnpjNum];

  // Throttle: máx 5 requisições simultâneas
  if (_receitaInFlight >= 5) {
    await new Promise(r => setTimeout(r, 300));
  }
  _receitaInFlight++;

  try {
    // PRIMARY: BrasilAPI (faster, more stable)
    const result = await buscarReceitaBrasilAPI(cnpjNum);
    if (result) {
      _receitaCache[cnpjNum] = result;
      _receitaInFlight--;
      _receitaPending = Math.max(0, _receitaPending - 1);
      return result;
    }
    // FALLBACK: publica.cnpj.ws
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjNum}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(tid);

    if (resp.status === 429) {
      _receitaInFlight--;
      if (_retries >= MAX_RETRIES) { _receitaCache[cnpjNum] = null; return null; }
      await new Promise(r => setTimeout(r, 2000 * (_retries + 1)));
      return buscarReceita(cnpjCol, _retries + 1);
    }
    if (!resp.ok) {
      _receitaCache[cnpjNum] = null;
      _receitaInFlight--;
      _receitaPending = Math.max(0, _receitaPending - 1);
      return null;
    }

    const d = await resp.json();
    const estab = d.estabelecimento || {};
    const fallback = await buscarReceitaEstab(estab, d.razao_social || '');
    _receitaCache[cnpjNum] = fallback;
    _receitaInFlight--;
    _receitaPending = Math.max(0, _receitaPending - 1);
    return fallback;
  } catch {
    _receitaCache[cnpjNum] = null;
    _receitaInFlight = Math.max(0, _receitaInFlight - 1);
    _receitaPending = Math.max(0, _receitaPending - 1);
    return null;
  }
}

// Fallback: BrasilAPI (fonte: Receita Federal, endpoint alternativo)
async function buscarReceitaBrasilAPI(cnpjNum) {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjNum}`, {
      signal: controller.signal,
      headers: { 'Accept': 'application/json' }
    });
    clearTimeout(tid);
    if (!resp.ok) return null;
    const d = await resp.json();
    // BrasilAPI retorna formato diferente — normalizar
    const nomeFantasia = (d.nome_fantasia || '').trim();
    const razao = (d.razao_social || '').trim();
    const logradouro = [d.descricao_tipo_logradouro, d.logradouro, d.numero, d.complemento]
      .filter(Boolean).join(' ');
    const bairro = (d.bairro || '').trim();
    const cidade = (d.municipio || '').trim();
    const uf = (d.uf || '').trim();
    const cep = (d.cep || '').replace(/\D/g, '');
    return {
      nome_fantasia:    nomeFantasia,
      razao_social:     razao,
      nome_exibicao:    nomeFantasia || razao,
      endereco_receita: [logradouro, bairro, cidade, uf, 'Brasil'].filter(Boolean).join(', '),
      municipio:        cidade,
      uf_receita:       uf,
      cep,
      situacao:         d.descricao_situacao_cadastral || '',
      atividade:        d.cnae_fiscal_descricao || '',
      logradouro,
      bairro,
      numero:           d.numero || '',
    };
  } catch {
    return null;
  }
}

// ─── Start Geocoding ──────────────────────────────────────────────────────────
function startGeocodingFromStep2() {
  const nameInput = document.getElementById('map-name-input');
  const name = (nameInput?.value || '').trim();
  const errEl = document.getElementById('step2-error');

  if (!name) {
    if (errEl) errEl.style.display = 'block';
    if (nameInput) nameInput.style.borderColor = 'var(--lose)';
    return;
  }
  if (errEl) errEl.style.display = 'none';

  // Guardar nome/descrição para salvar depois
  window._pendingMapName = name;
  window._pendingMapDesc = (document.getElementById('map-desc-input')?.value || '').trim();
  window._pendingMapType = currentMapType;

  // Capturar período (Varejo 360)
  const mes = document.getElementById('periodo-mes')?.value || '';
  const ano = document.getElementById('periodo-ano')?.value || '';
  window._pendingPeriodo = { mes: mes ? parseInt(mes) : null, ano: ano ? parseInt(ano) : null };
  const mesNomes = ['','Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
  window._pendingPeriodo.label = mes && ano ? `${mesNomes[parseInt(mes)]} ${ano}` : ano || '';

  // Mostrar/esconder view toggle e botão CSV conforme tipo
  const vtBtns = document.getElementById('view-toggle-btns');
  if (vtBtns) vtBtns.style.display = currentMapType !== 'varejo360' ? 'flex' : 'none';

  // Roteamento por tipo
  if (currentMapType === 'reverse_geocoder') {
    startReverseGeocoding();
  } else {
    startGeocoding(); // geocoder e varejo360 usam o mesmo fluxo
  }
}

async function startGeocoding() {
  if (!currentUser) {
    // Guardar intenção de geocoding para retomar após login
    window._pendingGeocodingAfterLogin = true;
    document.getElementById('login-screen').style.display = '';
    return;
  }

  // Mostrar mapa IMEDIATAMENTE — pins aparecerão em tempo real
  document.getElementById('gallery-screen').classList.add('hidden');
  document.getElementById('upload-zone').classList.add('hidden');
  // Em modo append, preserva o mapa existente (pins, posição, dados).
  // Pins novos serão somados aos existentes sem flash de tela vazia.
  if (!window._appendMode) {
    allData = []; filteredData = [];
    if (map && map.getSource('pdvs')) {
      map.getSource('pdvs').setData({ type: 'FeatureCollection', features: [] });
    }
  }

  const appEl = document.getElementById('app');
  appEl.style.display = 'flex';
  applyMapMode(currentMapType);
  await new Promise(r => setTimeout(r, 50));
  if (!map) initMap();
  await new Promise(r => setTimeout(r, 100));
  if (map) map.resize();

  // Mostrar barra flutuante discreta — título contextual
  document.getElementById('geo-title-text').textContent = window._appendMode
    ? 'Adicionando PDVs ao mapa'
    : 'Buscando Receita + Geocodificando';
  _resetPlacesOverlayFields();
  _resetVarejoOverlayFields();
  document.getElementById('geocoding-overlay').classList.add('active');

  // Em modo append, mantém posição/zoom do mapa atual.
  // Em criação, centraliza no Brasil enquanto carrega.
  if (!window._appendMode) {
    map.jumpTo({ center: [-47.93, -15.78], zoom: 4 });
  }

  // Limpar cache de geocoding para nova sessão
  Object.keys(_geoCache).forEach(k => delete _geoCache[k]);
  _pendingGeoUpserts.length = 0;
  geocodingCancelled = false;
  geocodingActive = true;

  // Avisar se tentar FECHAR a aba durante geocoding (trocar de aba é ok — continua em background)
  window._unloadHandler = (e) => {
    if (geocodingActive) {
      e.preventDefault();
      return e.returnValue = 'O geocoding ainda está em andamento. Se fechar, perderá o progresso.';
    }
  };
  window.addEventListener('beforeunload', window._unloadHandler);

  // Geocoding continua em background quando usuário troca de aba — não cancelar
  // Quando voltar, overlay reaparece automaticamente pois geocodingActive ainda é true
  window._visibilityHandler = () => {
    if (document.hidden || !geocodingActive) return;
    // Voltou para a aba com geocoding ativo — garantir que overlay está visível
    document.getElementById('geocoding-overlay')?.classList.add('active');
    if (map) map.resize();
  };
  document.addEventListener('visibilitychange', window._visibilityHandler);

  const total = rawCSVData.length;
  let ok = 0, fail = 0;
  const startTime = Date.now();

  // Geocoding rápido — Receita Federal buscada em background sem bloquear
  // HERE free: 250k req/mês — batch 8 concurrent com 80ms delay (~100 req/s)
  const BATCH = 8;
  const DELAY = 80;

  // Em criação, zera allData pra começar do zero. Em append, mantém os PDVs
  // existentes — pins novos serão somados a eles.
  if (!window._appendMode) {
    allData = [];
  }
  // Baseline: número de PDVs já presentes antes do processamento. Usado pra
  // dar fallback consistente em modo append se a hidratação cache falhar.
  const _appendBaseline = allData.length;

  // ─── Phase 1.5: Hidratação geográfica via cnpj_cache (Varejo 360 only) ──
  // Antes de chamar HERE, consulta cnpj_cache pelos CNPJs únicos. Linhas com
  // lat/lon salvos entram direto em allData e são removidas da fila do HERE.
  // Falha gracioso: qualquer erro na hidratação cai para o fluxo padrão.
  let cacheHits = 0;
  let rowsToProcess = rawCSVData;
  if (currentMapType === 'varejo360' && rawCSVData.length > 0) {
    try {
      document.getElementById('geo-current').textContent = 'Consultando cache de CNPJs...';
      // Map CNPJ14 -> array de rows (uma loja pode aparecer em múltiplas SKUs)
      const cnpjRowsMap = new Map();
      const rowsSemCnpj = [];
      for (const row of rawCSVData) {
        const c14 = _normalizeCnpj14(row.cnpj || '');
        if (c14) {
          if (!cnpjRowsMap.has(c14)) cnpjRowsMap.set(c14, []);
          cnpjRowsMap.get(c14).push(row);
        } else {
          rowsSemCnpj.push(row);
        }
      }

      const uniqueCnpjs = Array.from(cnpjRowsMap.keys());
      if (uniqueCnpjs.length > 0) {
        const hits = await bulkCnpjGeocodeLookup(uniqueCnpjs);

        // Pré-popular allData com linhas hidratadas + montar fila pro HERE
        const remaining = [];
        for (const [c14, rows] of cnpjRowsMap.entries()) {
          const hit = hits.get(c14);
          if (hit) {
            // Aplica geocode em TODAS as linhas da mesma loja
            for (const row of rows) {
              if (!row.bandeira || row.bandeira === 'Desconhecido') row.bandeira = 'Carregando...';
              row.lat = hit.lat;
              row.lon = hit.lon;
              row.geo_address = hit.geo_address || '';
              if (!row.uf && hit.uf_geocode) row.uf = hit.uf_geocode;
              row._fromCache = true;
              allData.push(row);
              cacheHits++;
              ok++;
            }
          } else {
            remaining.push(...rows);
          }
        }
        rowsToProcess = remaining.concat(rowsSemCnpj);

        // UI: chip 💾 + progress segment de cache
        if (cacheHits > 0) {
          const cacheChip = document.getElementById('geo-cache');
          if (cacheChip) {
            cacheChip.style.display = '';
            cacheChip.textContent = '💾 ' + cacheHits.toLocaleString('pt-BR');
          }
          const cachePct = Math.round((cacheHits / total) * 100);
          const fillCache = document.getElementById('geo-fill-cache');
          if (fillCache) fillCache.style.width = cachePct + '%';
          document.getElementById('geo-ok').textContent = ok.toLocaleString('pt-BR') + ' ✓';
          document.getElementById('geo-current').textContent =
            cacheHits.toLocaleString('pt-BR') + ' do cache · ' +
            rowsToProcess.length.toLocaleString('pt-BR') + ' p/ geocodificar';

          // Renderiza pins do cache imediatamente — usuário já vê resultado
          filteredData = allData.slice();
          renderMarkers();
        }
      }
    } catch (e) {
      console.warn('[cnpj-geo-cache] hydration failed, falling back to full HERE:', e && e.message);
      rowsToProcess = rawCSVData;
      // Restaura ao baseline (preserva pins existentes em modo append; zera em criação)
      allData = allData.slice(0, _appendBaseline);
      ok = 0;
      cacheHits = 0;
    }
  }

  // Loop principal: processa apenas rows que não vieram do cache
  for (let i = 0; i < rowsToProcess.length; i += BATCH) {
    if (geocodingCancelled) break;

    const batch = rowsToProcess.slice(i, Math.min(i + BATCH, rowsToProcess.length));

    await Promise.all(batch.map(async (row) => {
      if (!row.bandeira || row.bandeira === 'Desconhecido') row.bandeira = 'Carregando...';

      // Extrair cidade/UF do campo cnpj como fallback (formato HYPR)
      const partes = (row.cnpj || '').split(' - ');
      const ultimo = partes[partes.length - 1] || '';
      const mUF = ultimo.match(/^(.+?)\/([A-Z]{2})\s*$/);
      row.cidade = mUF ? mUF[1].trim() : '';
      row.uf = mUF ? mUF[2] : '';

      // Endereço para geocoding — adaptar conforme formato detectado
      // geoOpts: campos structured para forçar localidade (city/state)
      let address, geoOpts = null;
      if (row._endereco_livre) {
        // Formato endereço livre — extrair campos structured das colunas originais
        address = row._endereco_livre;
        // Tentar extrair cidade/UF dos campos originais do CSV
        const csvCity  = row[Object.keys(row).find(k => /^(cidade|city|municipio)$/i.test(k))] || '';
        const csvState = row[Object.keys(row).find(k => /^(uf|estado|state)$/i.test(k))] || '';
        const csvBairro = row[Object.keys(row).find(k => /^(bairro|neighborhood)$/i.test(k))] || '';
        const csvEnd   = row[Object.keys(row).find(k => /^(endereco|endereço|address|logradouro|rua)$/i.test(k))] || '';
        if (csvCity || csvState) {
          geoOpts = { street: csvEnd, city: csvCity, state: csvState, district: csvBairro };
        }
      } else if (window._formatoCSV === 'cnpj_raiz' || window._formatoCSV === 'cnpj_puro') {
        // CNPJ raiz (8 dígitos) ou puro (14 dígitos) — AGUARDAR Receita Federal para obter endereço
        const receita = await buscarReceita(row.cnpj || '');
        aplicarReceita(row, receita);
        address = receita?.endereco_receita || null;
        // Campos structured da Receita Federal
        if (receita && (receita.municipio || receita.uf_receita)) {
          geoOpts = {
            street: [receita.logradouro, receita.numero].filter(Boolean).join(' '),
            city: receita.municipio || '',
            state: receita.uf_receita || '',
            district: receita.bairro || '',
          };
        }
      } else {
        // Formato HYPR — extrair do campo cnpj (agora retorna objeto structured)
        const parsed = extrairEndereco(row.cnpj || '');
        address = parsed.address;
        if (parsed.city || parsed.state) {
          geoOpts = { street: parsed.street, city: parsed.city, state: parsed.state, district: parsed.district };
        }
        // Nome será enriquecido na Fase 2 (após geocoding completo)
      }
      row.endereco_geocode = address;

      try {
        const geo = await geocodeHERE(address, geoOpts);
        if (geo) {
          row.lat = geo.lat;
          row.lon = geo.lon;
          row.geo_address = geo.geo_address;
          row.geo_score = geo.geo_score;
          // Marcar mismatch de UF para visibilidade na lista
          if (geo._ufMismatch) {
            row._ufMismatch = true;
            row._expectedUF = geo._expectedUF;
          }
          // Extrair UF, município e CEP da resposta HERE (se não vieram da Receita)
          if (!row.uf && geo.uf)         row.uf       = geo.uf;
          if (!row.cidade && geo.municipio) row.cidade = geo.municipio;
          if (!row.cep && geo.cep)       row.cep      = geo.cep;
          ok++;

          // Plot pin em tempo real — usuário já pode interagir
          allData.push(row);

          // Persistir lat/lon em cnpj_cache para o próximo upload pular HERE.
          // Só Varejo 360 — geocoder/reverse não tem CNPJ confiável.
          // Fire-and-forget: queueCnpjGeoUpsert valida cnpj 14d + lat/lon,
          // flushCnpjGeoUpserts(false) só dispara request a cada 50 enfileirados.
          if (currentMapType === 'varejo360') {
            queueCnpjGeoUpsert(row);
            flushCnpjGeoUpserts(false);
          }

          // Atualizar mapa a cada 200 novos pins (batch GeoJSON update é mais eficiente)
          if (allData.length % 200 === 0) {
            filteredData = allData.slice();
            renderMarkers();
            updatePanels();
          }
        } else {
          fail++;
          row._geocodeFailed = true;
          row.geo_address = '';
          allData.push(row);
        }
      } catch (e) {
        fail++;
        row._geocodeFailed = true;
        row.geo_address = '';
        allData.push(row);
      }
    }));

    // Atualizar barra flutuante
    const done = Math.min(i + BATCH, total);
    const pct = Math.round(done / total * 100);
    document.getElementById('geo-fill').style.width = pct + '%';
    document.getElementById('geo-pct').textContent = pct + '%';
    const cacheHits = Object.keys(_geoCache).length;
    document.getElementById('geo-ok').textContent = ok.toLocaleString('pt-BR') + ' ✓';
    document.getElementById('geo-fail').textContent = fail > 0 ? fail.toLocaleString('pt-BR') + ' ✗' : '';
    document.getElementById('geo-current').textContent = extrairEndereco(batch[0]?.cnpj || '').address;

    // ETA
    const elapsed = (Date.now() - startTime) / 1000;
    const rate = done / elapsed;
    const remaining = (total - done) / rate;
    if (remaining > 0 && isFinite(remaining)) {
      const min = Math.floor(remaining / 60);
      const sec = Math.round(remaining % 60);
      document.getElementById('geo-eta').textContent = min > 0 ? `~${min}m ${sec}s` : `~${sec}s`;
    }

    await new Promise(r => setTimeout(r, DELAY));
  }

  // Flush final dos upserts pendentes — força mesmo com batch pequeno
  // para garantir que todos os novos lat/lon sejam persistidos no cnpj_cache.
  if (currentMapType === 'varejo360') {
    try { await flushCnpjGeoUpserts(true); } catch(e) {}
  }

  geocodingActive = false;
  window.removeEventListener('beforeunload', window._unloadHandler);
  document.removeEventListener('visibilitychange', window._visibilityHandler);

  filteredData = allData.slice();
  document.getElementById('geocoding-overlay').classList.remove('active');

  if (allData.length === 0) {
    document.getElementById('upload-zone').classList.remove('hidden');
    goToStep(2);
    return;
  }

  // Fit map (only items with valid coordinates)
  const validPts = allData.filter(r => parseFloat(r.lat) && parseFloat(r.lon));
  if (validPts.length > 0) {
    const bounds = validPts.reduce((b, r) => b.extend([parseFloat(r.lon), parseFloat(r.lat)]), new maplibregl.LngLatBounds([parseFloat(validPts[0].lon), parseFloat(validPts[0].lat)], [parseFloat(validPts[0].lon), parseFloat(validPts[0].lat)]));
    map.fitBounds(bounds, { padding: 40, animate: true });
  }

  filteredData = allData.slice();
  // Renderizar pins no mapa
  if (map.isStyleLoaded() && map.getSource('pdvs')) {
    renderMarkers();
  } else {
    map.once('styledata', () => renderMarkers());
  }

  populateFilters();
  updatePanels();
  updateOverlay();

  // Toast pós-geocoding com resumo e CTA de salvar
  var mismatchCount = allData.filter(r => r._ufMismatch).length;
  showGeoToast(ok, fail, mismatchCount, total);

  // ─── FASE 2: Enriquecimento de nomes (cache Supabase + deduplica + buscarReceita) ──
  var needsEnrich = allData.filter(r => r.cnpj && (!r.bandeira || r.bandeira === 'Carregando...' || r.bandeira === 'Não identificado' || r.bandeira === 'Desconhecido'));
  if (needsEnrich.length > 0) {
    var overlay2 = document.getElementById('geocoding-overlay');
    document.getElementById('geo-title-text').textContent = 'Enriquecendo nomes';
    document.getElementById('geo-fill').style.width = '0%';
    document.getElementById('geo-pct').textContent = '0%';
    document.getElementById('geo-ok').textContent = '';
    document.getElementById('geo-fail').textContent = '';
    document.getElementById('geo-eta').textContent = '';
    document.getElementById('geo-current').textContent = 'Consultando cache...';
    _resetPlacesOverlayFields();
    overlay2.classList.add('active');

    // ── Helper: extract cache key from row (same logic as buscarReceita) ──
    function _enrichCacheKey(row) {
      var raw = (row.cnpj || '').split(' - ')[0].replace(/\D/g, '');
      if (raw.length >= 14) return raw.slice(0, 14);
      if (raw.length >= 8) return 'raiz_' + raw.padStart(8, '0');
      return null;
    }

    // ── Helper: update overlay UI ──
    function updateEnrichUI(enrichOk, enrichFail, enrichDone, total, startTime, label) {
      var ePct = Math.round(enrichDone / total * 100);
      document.getElementById('geo-fill').style.width = ePct + '%';
      document.getElementById('geo-pct').textContent = ePct + '%';
      document.getElementById('geo-ok').textContent = enrichOk + ' nomes';
      document.getElementById('geo-fail').textContent = enrichFail > 0 ? enrichFail + ' ✗' : '';
      var eElapsed = (Date.now() - startTime) / 1000;
      var eRate = enrichDone / eElapsed;
      var eRemaining = (total - enrichDone) / eRate;
      if (eRemaining > 0 && isFinite(eRemaining)) {
        document.getElementById('geo-eta').textContent = eRemaining > 60 ? '~' + Math.ceil(eRemaining/60) + 'min' : '~' + Math.round(eRemaining) + 's';
      }
      document.getElementById('geo-current').textContent = enrichOk + ' identificados · ' + enrichDone + '/' + total + (label || '');
    }

    // ── STEP 1: Deduplicate — group rows by CNPJ key ──
    var cnpjGroups = {};
    var noKeyRows = [];
    needsEnrich.forEach(function(row) {
      var key = _enrichCacheKey(row);
      if (!key) { noKeyRows.push(row); return; }
      if (!cnpjGroups[key]) cnpjGroups[key] = [];
      cnpjGroups[key].push(row);
    });
    // Mark rows without valid CNPJ as not identifiable
    noKeyRows.forEach(function(row) { row.bandeira = 'Não identificado'; });

    var uniqueKeys = Object.keys(cnpjGroups);
    var totalRows = needsEnrich.length;
    var enrichOk = 0, enrichFail = noKeyRows.length, enrichDone = noKeyRows.length;
    var enrichStart = Date.now();

    // ── STEP 2: Fetch from Supabase cache (90-day TTL) ──
    var CACHE_TTL_DAYS = 90;
    var cacheMinDate = new Date(Date.now() - CACHE_TTL_DAYS * 86400000).toISOString();
    try {
      var CACHE_CHUNK = 300;
      for (var ci = 0; ci < uniqueKeys.length; ci += CACHE_CHUNK) {
        var cacheChunk = uniqueKeys.slice(ci, ci + CACHE_CHUNK);
        var cacheQuery = 'cnpj_cache?cnpj=in.(' + cacheChunk.map(encodeURIComponent).join(',') + ')&updated_at=gte.' + cacheMinDate + '&select=*';
        var cached = await sbFetch(cacheQuery);
        if (cached && cached.length) {
          cached.forEach(function(c) {
            var result = {
              nome_fantasia: c.nome_fantasia || '', razao_social: c.razao_social || '',
              nome_exibicao: c.nome_exibicao || c.nome_fantasia || c.razao_social || '',
              municipio: c.municipio || '', uf_receita: c.uf || '', cep: c.cep || '',
              situacao: c.situacao || '', atividade: c.atividade || '',
              endereco_receita: c.endereco_receita || '', logradouro: c.logradouro || '',
              bairro: c.bairro || '', numero: c.numero || '',
            };
            var rows = cnpjGroups[c.cnpj];
            if (rows && result.nome_exibicao) {
              rows.forEach(function(row) { aplicarReceita(row, result); });
              _receitaCache[c.cnpj] = result;
              enrichOk += rows.length;
              enrichDone += rows.length;
              delete cnpjGroups[c.cnpj];
            }
          });
        }
      }
    } catch(e) {
      console.warn('Cache fetch error (continuing with API):', e.message);
    }

    // Update UI after cache step
    if (enrichOk > 0) {
      document.getElementById('geo-current').textContent = enrichOk + ' do cache · consultando APIs...';
      filteredData = allData.slice(); populateFilters(); applyFilters(); updatePanels();
    }

    // ── STEP 3: Enrich via server-side batch proxy /api/cnpj-enrich ──
    // Sends 25 CNPJs per request, 2 requests in parallel. Proxy does parallel API lookups.
    var remainingKeys = Object.keys(cnpjGroups);
    var ENRICH_BATCH = 25;
    var PARALLEL_REQUESTS = 2;

    for (var ei = 0; ei < remainingKeys.length; ei += ENRICH_BATCH * PARALLEL_REQUESTS) {
      if (geocodingCancelled) break;

      // Build 2 parallel batches
      var parallelBatches = [];
      for (var p = 0; p < PARALLEL_REQUESTS; p++) {
        var start = ei + p * ENRICH_BATCH;
        if (start >= remainingKeys.length) break;
        parallelBatches.push(remainingKeys.slice(start, start + ENRICH_BATCH));
      }

      // Fire all batch requests in parallel
      var responses = await Promise.allSettled(parallelBatches.map(function(batchKeys) {
        var cnpjNums = batchKeys.map(function(key) {
          return key.startsWith('raiz_') ? key.slice(5) : key;
        });
        return fetch('/api/cnpj-enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ cnpjs: cnpjNums }),
          signal: AbortSignal.timeout(30000),
        }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });
      }));

      // Process responses
      for (var pi = 0; pi < parallelBatches.length; pi++) {
        var batchKeys = parallelBatches[pi];
        var proxyData = responses[pi].status === 'fulfilled' ? responses[pi].value : null;
        var proxyResults = proxyData ? (proxyData.results || {}) : {};

        batchKeys.forEach(function(key) {
          var rows = cnpjGroups[key];
          if (!rows) return;
          var lookupKey = key.startsWith('raiz_') ? key.slice(5) : key;
          var result = proxyResults[lookupKey];
          if (result && (result.nome_exibicao || result.nome_fantasia || result.razao_social)) {
            var receita = {
              nome_fantasia: result.nome_fantasia || '', razao_social: result.razao_social || '',
              nome_exibicao: result.nome_exibicao || result.nome_fantasia || result.razao_social || '',
              municipio: result.municipio || '', uf_receita: result.uf || '',
              cep: result.cep || '', situacao: result.situacao || '',
              atividade: result.atividade || '', endereco_receita: result.endereco_receita || '',
            };
            rows.forEach(function(row) { aplicarReceita(row, receita); });
            _receitaCache[key] = receita;
            enrichOk += rows.length;
          } else {
            rows.forEach(function(row) { row.bandeira = 'Não identificado'; });
            enrichFail += rows.length;
          }
          enrichDone += rows.length;
        });
      }

      updateEnrichUI(enrichOk, enrichFail, enrichDone, totalRows, enrichStart, '');

      // Periodic render so user sees progress on map
      if ((ei + ENRICH_BATCH) % 100 === 0 || ei + ENRICH_BATCH >= remainingKeys.length) {
        filteredData = allData.slice(); populateFilters(); applyFilters(); updatePanels();
      }
    }

    // ── RETRY: wait 30s for rate limits to reset, then retry failed ones ──
    var retryKeys = remainingKeys.filter(function(key) {
      var rows = cnpjGroups[key];
      return rows && rows.some(function(r) { return r.bandeira === 'Não identificado' || r.bandeira === 'Carregando...' || r.bandeira === 'Desconhecido'; });
    });
    if (retryKeys.length > 0 && !geocodingCancelled) {
      document.getElementById('geo-title-text').textContent = 'Aguardando reset de APIs...';
      document.getElementById('geo-current').textContent = retryKeys.length + ' CNPJs para retry em 20s';
      // Countdown
      for (var cd = 20; cd > 0 && !geocodingCancelled; cd--) {
        document.getElementById('geo-eta').textContent = cd + 's';
        await new Promise(function(r) { setTimeout(r, 1000); });
      }
      if (!geocodingCancelled) {
        document.getElementById('geo-title-text').textContent = 'Retry — recuperando nomes';
        enrichFail = 0; // Reset fail count for retry pass
        var retryDone = 0;
        var retryStart = Date.now();
        for (var ri = 0; ri < retryKeys.length; ri += ENRICH_BATCH * PARALLEL_REQUESTS) {
          if (geocodingCancelled) break;
          var retryBatches = [];
          for (var rp = 0; rp < PARALLEL_REQUESTS; rp++) {
            var rStart = ri + rp * ENRICH_BATCH;
            if (rStart >= retryKeys.length) break;
            retryBatches.push(retryKeys.slice(rStart, rStart + ENRICH_BATCH));
          }
          var retryResponses = await Promise.allSettled(retryBatches.map(function(batchKeys) {
            var cnpjNums = batchKeys.map(function(key) { return key.startsWith('raiz_') ? key.slice(5) : key; });
            return fetch('/api/cnpj-enrich', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cnpjs: cnpjNums }),
              signal: AbortSignal.timeout(30000),
            }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });
          }));
          for (var rpi = 0; rpi < retryBatches.length; rpi++) {
            var rBatchKeys = retryBatches[rpi];
            var rData = retryResponses[rpi].status === 'fulfilled' ? retryResponses[rpi].value : null;
            var rResults = rData ? (rData.results || {}) : {};
            rBatchKeys.forEach(function(key) {
              var rows = cnpjGroups[key];
              if (!rows) return;
              var lookupKey = key.startsWith('raiz_') ? key.slice(5) : key;
              var result = rResults[lookupKey];
              if (result && (result.nome_exibicao || result.nome_fantasia || result.razao_social)) {
                var receita = {
                  nome_fantasia: result.nome_fantasia || '', razao_social: result.razao_social || '',
                  nome_exibicao: result.nome_exibicao || '', municipio: result.municipio || '',
                  uf_receita: result.uf || '', cep: result.cep || '',
                  situacao: result.situacao || '', atividade: result.atividade || '',
                };
                rows.forEach(function(row) { aplicarReceita(row, receita); });
                _receitaCache[key] = receita;
                enrichOk += rows.length;
              } else {
                enrichFail += rows.length;
              }
              retryDone += rows.length;
            });
          }
          var rPct = Math.round(retryDone / (retryKeys.length * (totalRows / remainingKeys.length || 1)) * 100);
          document.getElementById('geo-fill').style.width = Math.min(100, 80 + rPct * 0.2) + '%';
          document.getElementById('geo-ok').textContent = enrichOk + ' nomes';
          document.getElementById('geo-fail').textContent = enrichFail > 0 ? enrichFail + ' ✗' : '';
          document.getElementById('geo-current').textContent = enrichOk + ' identificados · retry ' + retryDone + '/' + (retryKeys.length * (totalRows / remainingKeys.length || 1));
          await new Promise(function(r) { setTimeout(r, 80); });
        }
      }
    }

    // Mark any remaining as definitively not identified
    needsEnrich.forEach(function(row) {
      if (!row.bandeira || row.bandeira === 'Carregando...') row.bandeira = 'Não identificado';
    });

    // Cache save is handled by the proxy — no client-side save needed

    // Final render
    filteredData = allData.slice();
    populateFilters();
    applyFilters();
    updatePanels();
    renderMarkers();
  }
  
  document.getElementById('geocoding-overlay').classList.remove('active');
  try { checkReenrichBar(); } catch(e) {}
  // Modo append: ao invés de abrir modal de salvar, faz INSERT no mapa existente
  if (window._appendMode && window._appendToMapId) {
    await finishAppendToMap(window._appendToMapId);
    return;
  }
  showSaveMapDialog();
}

async function startReverseGeocoding() {
  if (!rawCSVData.length) return;

  // Limpar dados ANTES de mostrar o mapa — evita flash dos dados anteriores
  allData = []; filteredData = [];
  if (map && map.getSource('pdvs')) {
    map.getSource('pdvs').setData({ type: 'FeatureCollection', features: [] });
  }

  document.getElementById('gallery-screen').classList.add('hidden');
  document.getElementById('upload-zone').classList.add('hidden');
  const appEl2 = document.getElementById('app');
  appEl2.style.display = 'flex';
  applyMapMode('reverse_geocoder');
  await new Promise(r => setTimeout(r, 50));
  if (!map) initMap();
  await new Promise(r => setTimeout(r, 100));
  if (map) map.resize();
  geocodingCancelled = false; geocodingActive = true;
  window.addEventListener('beforeunload', window._unloadHandler);

  const overlay = document.getElementById('geocoding-overlay');
  _resetPlacesOverlayFields();
  overlay.classList.add('active');
  document.getElementById('geo-current').textContent = 'Iniciando reverse geocoding...';
  document.getElementById('geo-fill').style.width = '0%';

  const total = rawCSVData.length;
  const BATCH = 5; const DELAY = 150;
  let ok = 0, fail = 0;

  for (let i = 0; i < total; i += BATCH) {
    if (geocodingCancelled) break;
    const batch = rawCSVData.slice(i, Math.min(i + BATCH, total));

    await Promise.all(batch.map(async row => {
      const lat = parseFloat(row.lat || row.latitude || row.lat_input || row.input_lat);
      const lon = parseFloat(row.lon || row.longitude || row.lng || row.input_lon);
      if (!lat || !lon) {
        fail++;
        row._geocodeFailed = true;
        row.geo_address = '';
        row.nome = row.nome || row.name || row.label || `Ponto ${i + 1}`;
        row.bandeira = row.nome;
        allData.push(row);
        return;
      }

      row.input_lat = lat; row.input_lon = lon;
      row.lat = lat; row.lon = lon;
      row.nome = row.nome || row.name || row.label || `Ponto ${allData.length + 1}`;
      row.bandeira = row.nome;

      try {
        const geo = await reverseGeocodeHERE(lat, lon);
        if (geo) {
          row.geo_address = geo.geo_address;
          row.uf = geo.uf;
          row.cep = geo.cep;
          ok++;
        } else { fail++; row._geocodeFailed = true; row.geo_address = ''; }
      } catch { fail++; row._geocodeFailed = true; row.geo_address = ''; }

      allData.push(row);
    }));

    const done = Math.min(i + BATCH, total);
    const pct = Math.round(done / total * 100);
    document.getElementById('geo-fill').style.width = pct + '%';
    document.getElementById('geo-pct').textContent = pct + '%';
    document.getElementById('geo-ok').textContent = ok + ' ✓';
    document.getElementById('geo-fail').textContent = fail > 0 ? fail + ' ✗' : '';
    document.getElementById('geo-current').textContent = `${done.toLocaleString('pt-BR')} / ${total.toLocaleString('pt-BR')} pontos`;

    if (done % 100 === 0) {
      filteredData = allData.slice();
      renderMarkers();
    }
    await new Promise(r => setTimeout(r, DELAY));
  }

  overlay.classList.remove('active');
  geocodingActive = false;
  window.removeEventListener('beforeunload', window._unloadHandler);
  document.removeEventListener('visibilitychange', window._visibilityHandler);
  filteredData = allData.slice();
  renderMarkers();
  updatePanels(); updateOverlay();

  // Mostrar lista automaticamente no reverse geocoder
  setMapView('list');

  // Salvar
  showSaveMapDialog();
}

function cancelGeocoding() {
  // Places Discovery cancel
  if (currentMapType === 'places_discovery') {
    _placesDiscoveryCancelled = true;
    geocodingActive = false;
    window.removeEventListener('beforeunload', window._unloadHandler);
    document.getElementById('geocoding-overlay').classList.remove('active');
    if (allData.length > 0) {
      filteredData = allData.slice();
      renderMarkers();
      const pts = allData.filter(r => r.lat && r.lon);
      if (pts.length) {
        const bounds = pts.reduce((b, r) => b.extend([parseFloat(r.lon), parseFloat(r.lat)]),
          new maplibregl.LngLatBounds([parseFloat(pts[0].lon), parseFloat(pts[0].lat)], [parseFloat(pts[0].lon), parseFloat(pts[0].lat)]));
        map.fitBounds(bounds, { padding: 40, animate: true });
      }
    }
    // Always re-show panel on cancel so user can adjust
    document.getElementById('places-panel').style.display = 'block';
    if (_placesMode === 'pin') enablePinMode();
    return;
  }
  // Original cancel logic
  geocodingCancelled = true;
  geocodingActive = false;
  window.removeEventListener('beforeunload', window._unloadHandler);
  document.removeEventListener('visibilitychange', window._visibilityHandler);
  document.getElementById('geocoding-overlay').classList.remove('active');

  if (allData.length > 0) {
    filteredData = allData.slice();
    const validCancel = allData.filter(r => parseFloat(r.lat) && parseFloat(r.lon));
    if (validCancel.length > 0) {
      const bounds = validCancel.reduce((b, r) => b.extend([parseFloat(r.lon), parseFloat(r.lat)]), new maplibregl.LngLatBounds([parseFloat(validCancel[0].lon), parseFloat(validCancel[0].lat)], [parseFloat(validCancel[0].lon), parseFloat(validCancel[0].lat)]));
      map.fitBounds(bounds, { padding: 40, animate: true });
    }
    populateFilters();
    updatePanels();
    updateOverlay();
  } else {
    document.getElementById('upload-zone').classList.remove('hidden');
    goToStep(1);
  }
}

// ─── Toast pós-geocoding ────────────────────────────────────────────────────
var _geoToastTimer = null;

function showGeoToast(okCount, failCount, mismatchCount, total) {
  var toast = document.getElementById('geo-toast');
  var title = document.getElementById('geo-toast-title');
  var stats = document.getElementById('geo-toast-stats');
  if (!toast) return;

  // Montar título
  var cancelled = geocodingCancelled;
  title.textContent = cancelled ? 'Geocodificação cancelada' : 'Geocodificação concluída';

  // Montar stats
  var parts = [];
  parts.push('<span class="t-ok">' + okCount.toLocaleString('pt-BR') + ' encontrados</span>');
  if (failCount > 0) parts.push('<span class="t-fail">' + failCount.toLocaleString('pt-BR') + ' não identificados</span>');
  if (mismatchCount > 0) parts.push('<span class="t-warn">' + mismatchCount.toLocaleString('pt-BR') + ' UF divergente</span>');
  parts.push(total.toLocaleString('pt-BR') + ' total');
  stats.innerHTML = parts.join(' · ');

  // Esconder CTA "Salvar mapa" quando auto-save vai rodar (_pendingMapName)
  // ou já rodou (_currentOpenMapId). Em fluxos com nome do step 2 do wizard
  // ou Places Discovery, o save é automático — oferecer o botão abre modal
  // com estado leftover e permite duplicar linha em saved_maps.
  var saveBtn = toast.querySelector('.geo-toast-btn.primary');
  if (saveBtn) {
    var willAutoSave = !!(window._pendingMapName || window._currentOpenMapId);
    saveBtn.style.display = willAutoSave ? 'none' : '';
  }

  toast.classList.remove('hiding');
  toast.classList.add('active');

  // Auto-dismiss após 15s
  clearTimeout(_geoToastTimer);
  _geoToastTimer = setTimeout(dismissGeoToast, 15000);
}

function dismissGeoToast() {
  var toast = document.getElementById('geo-toast');
  if (!toast || !toast.classList.contains('active')) return;
  clearTimeout(_geoToastTimer);
  toast.classList.add('hiding');
  setTimeout(function() {
    toast.classList.remove('active', 'hiding');
  }, 200);
}

function openSaveModalFromToast() {
  dismissGeoToast();
  // Se mapa já está salvo, não abrir modal — apenas notificar
  if (window._currentOpenMapId) {
    var summary = document.getElementById('places-results-summary');
    if (summary) summary.innerHTML += '<br><span style="color:var(--win);font-size:11px;">✓ Mapa já está salvo</span>';
    return;
  }
  // Abrir o modal de salvar — preencher nome se já existe do step2
  var saveModal = document.getElementById('save-modal');
  if (saveModal) {
    // Reset de estado leftover (status/disabled de saves anteriores)
    var statusEl = document.getElementById('save-status');
    if (statusEl) statusEl.textContent = '';
    var btn = document.getElementById('save-btn');
    if (btn) btn.disabled = false;
    saveModal.classList.add('active');
    var nameInput = document.getElementById('save-name');
    var pendingName = window._pendingMapName || document.getElementById('map-name-input')?.value || '';
    if (nameInput && !nameInput.value && pendingName) nameInput.value = pendingName;
    var descInput = document.getElementById('save-desc');
    var pendingDesc = window._pendingMapDesc || document.getElementById('map-desc-input')?.value || '';
    if (descInput && !descInput.value && pendingDesc) descInput.value = pendingDesc;
    nameInput?.focus();
  }
}

// ─── File Upload ─────────────────────────────────────────────────────────────
async function handleCSVFile(file) {
  const isXLSX = /\.xlsx?$/i.test(file.name);

  // Carregar SheetJS sob demanda apenas quando o arquivo for .xlsx
  if (isXLSX) await ensureXLSX();

  const reader = new FileReader();

  reader.onload = ev => {
    let parsed;
    try {
      if (isXLSX) {
        // Ler XLSX com SheetJS
        const data = new Uint8Array(ev.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        
        // Detectar header real: SheetJS usa row 1 como header por padrão,
        // mas exports da Kantar/Varejo360 às vezes têm rows de aviso antes do header.
        // Estratégia: ler como array puro, encontrar a row que tem colunas conhecidas,
        // e usar essa como header.
        const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
        const knownCols = ['marca', 'cnpj', 'lat', 'lon', 'latitude', 'longitude', 'endereco', 'nome', 'name', 'address', 'cnpj_raiz', 'bandeira'];
        
        let headerRow = 0;
        for (let r = 0; r < Math.min(aoa.length, 10); r++) {
          const cells = (aoa[r] || []).map(c => String(c || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
          const matchCount = cells.filter(c => knownCols.some(kc => c.includes(kc))).length;
          if (matchCount >= 2) { headerRow = r; break; }
        }
        
        // Construir objetos usando o header correto
        const headers = (aoa[headerRow] || []).map(h => String(h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/\s+/g, '_'));
        parsed = [];
        for (let r = headerRow + 1; r < aoa.length; r++) {
          const row = aoa[r];
          if (!row || !row.some(v => v !== '' && v != null)) continue;
          const obj = {};
          headers.forEach((h, i) => { obj[h] = row[i] != null ? String(row[i]) : ''; });
          parsed.push(obj);
        }
      } else {
        // Ler CSV normalmente
        parsed = parseCSV(ev.target.result);
      }
    } catch(e) {
      document.getElementById('upload-formats-msg').textContent = '⚠️ Erro ao ler arquivo: ' + e.message;
      return;
    }

    // Filtrar linhas inválidas (totalizadores, linhas vazias)
    const cleaned = parsed.filter(r => {
      const vals = Object.values(r);
      if (!vals.some(v => v)) return false; // linha vazia
      const cnpjVal = r.cnpj || r['cnpj'] || '';
      if (cnpjVal.toUpperCase().includes('TODOS OS CNPJS')) return false;
      return true;
    });

    if (cleaned.length === 0) {
      document.getElementById('upload-formats-msg').textContent = '⚠️ Nenhum dado válido encontrado. Verifique o formato do arquivo.';
      return;
    }

    // Detectar formato e normalizar
    const { rows, formato, info } = detectAndNormalize(cleaned);

    // Lat/Lon direto: só plotar sem geocodificar se NÃO for reverse_geocoder
    // Para reverse_geocoder, lat/lon são os INPUTS — precisa buscar endereços
    if (formato === 'latlon' && currentMapType !== 'reverse_geocoder') {
      document.getElementById('upload-formats-msg').textContent = `✅ ${rows.length.toLocaleString('pt-BR')} pontos com coordenadas — plotando direto no mapa.`;
      loadData(rows);
      return;
    }

    // Mensagem de info conforme formato e tipo selecionado
    if (formato === 'latlon' && currentMapType === 'reverse_geocoder') {
      window._formatoCSV = 'latlon';
      document.getElementById('upload-formats-msg').textContent = `✅ ${rows.length.toLocaleString('pt-BR')} coordenadas detectadas — endereços serão gerados via HERE API.`;
    } else if (formato === 'cnpj_raiz') {
      window._formatoCSV = 'cnpj_raiz';
      document.getElementById('upload-formats-msg').textContent = `✅ ${rows.length.toLocaleString('pt-BR')} PDVs por CNPJ Raiz detectados — endereços e bandeiras via Receita Federal.`;
    } else if (formato === 'cnpj_puro') {
      window._formatoCSV = 'cnpj_puro';
      document.getElementById('upload-formats-msg').textContent = `✅ ${rows.length.toLocaleString('pt-BR')} CNPJs detectados — endereços serão buscados na Receita Federal.`;
    } else if (formato === 'endereco') {
      window._formatoCSV = 'endereco';
      document.getElementById('upload-formats-msg').textContent = `✅ ${rows.length.toLocaleString('pt-BR')} endereços detectados — pronto para geocodificar.`;
    } else {
      window._formatoCSV = 'hypr';
      document.getElementById('upload-formats-msg').textContent = `✅ ${rows.length.toLocaleString('pt-BR')} registros carregados de "${file.name}".`;
    }

    rawCSVData = rows;
    document.getElementById('step-apikey-sub').textContent =
      `${info} — ${rows.length.toLocaleString('pt-BR')} linhas. Clique em iniciar para geocodificar.`;

    // Modo append: usuário já está em mapa salvo, não precisa nomear/escolher período.
    // Reaproveita meta do mapa atual e vai direto pra geocodificação.
    if (window._appendMode && window._appendToMapId) {
      window._pendingMapName = window._appendToMapName || window._currentOpenMapName || '';
      window._pendingMapType = 'varejo360';
      // Período: mantém o do mapa atual (não está acessível diretamente, mas o
      // saveMapToSupabase só usa _pendingPeriodo na criação; em append, o INSERT
      // em map_pdvs ignora isso)
      window._pendingPeriodo = window._pendingPeriodo || null;
      startGeocoding();
      return;
    }

    goToStep(2);
  };
  if (isXLSX) {
    reader.readAsArrayBuffer(file);
  } else {
    // Ler como ArrayBuffer primeiro para detectar encoding
    var encodingReader = new FileReader();
    encodingReader.onload = function(ev2) {
      var bytes = new Uint8Array(ev2.target.result);

      // 1. Tentar UTF-8 (encoding correto)
      try {
        var decoded = new TextDecoder('UTF-8', { fatal: true }).decode(bytes);
        reader.onload({ target: { result: decoded } });
        return;
      } catch(e) { /* não é UTF-8 válido */ }

      // 2. Detectar se é MacRoman ou Windows-1252/Latin-1
      //    MacRoman usa bytes 0x80-0x9F para caracteres visíveis (Ä, Å, Ç, É, etc.)
      //    Windows-1252 usa 0x80-0x9F para controle/pontuação (€, ‚, ƒ, „, etc.)
      //    Heurística: contar bytes no range 0x80-0x9F que são letras comuns em pt-BR no MacRoman
      var macHits = 0, winHits = 0;
      // MacRoman: 0x87=á, 0x88=à, 0x89=â, 0x8A=ä, 0x8B=ã, 0x8C=å, 0x8E=é, 0x8F=è,
      //           0x90=ê, 0x91=ë, 0x92=í, 0x93=ì, 0x94=î, 0x95=ï, 0x96=ñ, 0x97=ó,
      //           0x98=ò, 0x99=ô, 0x9A=ö, 0x9B=õ, 0x9C=ú, 0x9D=ù, 0x9E=û, 0x9F=ü
      var macLetters = {0x87:1,0x88:1,0x89:1,0x8A:1,0x8B:1,0x8C:1,0x8E:1,0x8F:1,
                        0x90:1,0x91:1,0x92:1,0x93:1,0x94:1,0x95:1,0x96:1,0x97:1,
                        0x98:1,0x99:1,0x9A:1,0x9B:1,0x9C:1,0x9D:1,0x9E:1,0x9F:1};
      for (var bi = 0; bi < bytes.length; bi++) {
        var b = bytes[bi];
        if (b >= 0x80 && b <= 0x9F) {
          if (macLetters[b]) macHits++;
          else winHits++;
        }
      }

      var text;
      if (macHits > winHits && macHits > 0) {
        // MacRoman — TextDecoder não suporta, decodificar manualmente
        var macMap = {
          0x80:0xC4,0x81:0xC5,0x82:0xC7,0x83:0xC9,0x84:0xD1,0x85:0xD6,0x86:0xDC,
          0x87:0xE1,0x88:0xE0,0x89:0xE2,0x8A:0xE4,0x8B:0xE3,0x8C:0xE5,0x8D:0xE7,
          0x8E:0xE9,0x8F:0xE8,0x90:0xEA,0x91:0xEB,0x92:0xED,0x93:0xEC,0x94:0xEE,
          0x95:0xEF,0x96:0xF1,0x97:0xF3,0x98:0xF2,0x99:0xF4,0x9A:0xF6,0x9B:0xF5,
          0x9C:0xFA,0x9D:0xF9,0x9E:0xFB,0x9F:0xFC,0xA1:0xB0,0xA2:0xA2,0xA3:0xA3,
          0xA4:0xA7,0xA5:0x2022,0xA6:0xB6,0xA7:0xDF,0xA8:0xAE,0xA9:0xA9,0xAA:0x2122,
          0xAB:0xB4,0xAC:0xA8,0xAD:0x2260,0xAE:0xC6,0xAF:0xD8,0xB0:0x221E,
          0xB1:0xB1,0xB2:0x2264,0xB3:0x2265,0xB4:0xA5,0xB5:0xB5,0xB7:0x2211,
          0xB8:0x220F,0xBA:0x2126,0xBB:0xAA,0xBC:0xBA,0xBF:0xBF,0xC0:0xA1,
          0xC1:0xAC,0xC7:0xAB,0xC8:0xBB,0xC9:0x2026,0xCA:0xA0,0xCB:0xC0,
          0xCC:0xC3,0xCD:0xD5,0xCE:0x152,0xCF:0x153,0xD0:0x2013,0xD1:0x2014,
          0xD2:0x201C,0xD3:0x201D,0xD4:0x2018,0xD5:0x2019,0xD6:0xF7,
          0xD8:0xFF,0xD9:0x178,0xDA:0x2044,0xDB:0x20AC,0xDC:0x2039,0xDD:0x203A,
          0xDE:0xFB01,0xDF:0xFB02,0xE0:0x2021,0xE1:0xB7,0xE5:0xC2,0xE6:0xCA,
          0xE7:0xC1,0xE8:0xCB,0xE9:0xC8,0xEA:0xCD,0xEB:0xCE,0xEC:0xCF,0xED:0xCC,
          0xEE:0xD3,0xEF:0xD4,0xF1:0xD2,0xF2:0xDA,0xF3:0xDB,0xF4:0xD9
        };
        var chars = [];
        for (var ci = 0; ci < bytes.length; ci++) {
          var bv = bytes[ci];
          if (bv < 0x80) chars.push(String.fromCharCode(bv));
          else if (macMap[bv]) chars.push(String.fromCharCode(macMap[bv]));
          else chars.push(String.fromCharCode(bv)); // fallback
        }
        text = chars.join('');
      } else {
        // Windows-1252 (superset de Latin-1 — TextDecoder suporta como 'windows-1252')
        try {
          text = new TextDecoder('windows-1252').decode(bytes);
        } catch(e2) {
          text = new TextDecoder('ISO-8859-1').decode(bytes);
        }
      }

      reader.onload({ target: { result: text } });
    };
    encodingReader.readAsArrayBuffer(file);
  }
}

document.getElementById('file-input').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) handleCSVFile(file);
});

var dropZone = document.getElementById('drop-zone');
dropZone.addEventListener('click', e => {
  // Não disparar se clicou em botão, link ou input dentro do drop-zone
  if (e.target.closest('button, a, input, .upload-template-preview')) return;
  document.getElementById('file-input').click();
});
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault(); dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file && /\.(csv|xlsx|xls)$/i.test(file.name)) handleCSVFile(file);
  else if (file) document.getElementById('upload-formats-msg').textContent = '⚠️ Formato não suportado. Use CSV, XLSX ou XLS.';
});

// ─── Supabase DB helpers ──────────────────────────────────────────────────────
async function sbFetch(path, opts = {}) {
  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 15000); // 15s timeout
  // Usar token do usuário logado se disponível, senão usar anon key
  const authToken = (await _supa.auth.getSession()).data.session?.access_token || SUPABASE_ANON;
  const headers = {
    'apikey': SUPABASE_ANON,
    'Authorization': `Bearer ${authToken}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation',
    ...(opts.headers || {}),
  };
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      ...opts, headers, signal: controller.signal
    });
    clearTimeout(tid);
    if (!res.ok) throw new Error(await res.text());
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch(e) {
    clearTimeout(tid);
    throw e;
  }
}

// ─── Galeria ──────────────────────────────────────────────────────────────────
var THUMB_COLORS = ['#7C3AED','#2563EB','#059669','#DC2626','#D97706','#0891B2','#9333EA'];

function showGallery() {
  window._pendingGeocodingAfterLogin = false;
  // Limpa qualquer modo append em curso (usuário voltou pra galeria)
  window._appendMode = false;
  window._appendToMapId = null;
  window._appendToMapName = null;
  var _appendBanner = document.getElementById('append-mode-banner');
  if (_appendBanner) _appendBanner.style.display = 'none';
  try { history.replaceState(null, '', location.pathname); } catch(e) {}
  try { sessionStorage.removeItem('hypr_last_map'); } catch(e) {}
  // Resetar view e pendências
  window._pendingMapType = null;
  window._pendingPeriodo = null;
  window._pendingMapName = null;
  window._pendingMapDesc = null;
  rawCSVData = [];
  currentView = 'map';
  const listEl = document.getElementById('geocoder-list-view');
  if (listEl) listEl.style.display = 'none';
  const vtBtns = document.getElementById('view-toggle-btns');
  if (vtBtns) vtBtns.style.display = 'none';
  // Resetar modo visual
  const _appGal = document.getElementById('app');
  if (_appGal) _appGal.classList.remove('mode-geo', 'mode-places');
  // Always hide places-panel when returning to gallery
  var _ppGal = document.getElementById('places-panel');
  if (_ppGal) _ppGal.style.display = 'none';
  var _badgeGal = document.getElementById('places-map-badge');
  if (_badgeGal) _badgeGal.style.display = 'none';
  const _lsGal = document.getElementById('brand-sub');
  if (_lsGal) _lsGal.textContent = ' · Geocodify';
  try { setHeaderMapName(''); } catch(e) {}
  try { closeMoreMenu(); } catch(e) {}
  // V360 Competitors PR1: reseta estado ao voltar pra galeria
  try { window.dispatchEvent(new CustomEvent('v360:map-closed')); } catch(_) {}
  const _vtGal = document.getElementById('view-toggle-btns');
  if (_vtGal) _vtGal.style.display = 'none';
  document.getElementById('gallery-screen').classList.remove('hidden');
  document.getElementById('upload-zone').classList.add('hidden');
  document.getElementById('app').style.display = 'none';
  loadGallery();
}


function showUploadZone() {
  document.getElementById('gallery-screen').classList.add('hidden');
  document.getElementById('upload-zone').classList.remove('hidden');
  document.getElementById('app').style.display = 'none';
  allData = []; filteredData = [];
  goToStep(1);
}

var _galleryMaps = []; // Store for filtering
var _galleryPage = 1;
var _galleryPerPage = 30;
var _galleryFiltered = []; // Filtered + sem fixados (paginado)
var _galleryFilteredPinned = []; // Filtered + fixados (sempre renderizados completos)

// ─── Pinned Maps (por usuário) ─────────────────────────────────────────────
// Cada user pode pinar N mapas; persiste em pinned_maps (RLS por auth.uid()).
// _pinnedMapIds é a snapshot em memória, atualizada via loadPinnedMaps() e
// togglePinMap(). isPinned(id) é o predicate usado pelo render do card.
var _pinnedMapIds = new Set();

async function loadPinnedMaps() {
  if (!currentUser) { _pinnedMapIds = new Set(); return; }
  try {
    var rows = await sbFetch('pinned_maps?select=map_id&order=pinned_at.desc');
    _pinnedMapIds = new Set((rows || []).map(function(r) { return r.map_id; }));
  } catch(e) {
    console.warn('[pins] load failed:', e);
    _pinnedMapIds = new Set();
  }
}

function isPinned(mapId) {
  return _pinnedMapIds.has(mapId);
}

async function togglePinMap(mapId, btn) {
  if (!currentUser || !mapId) return;
  var wasPinned = _pinnedMapIds.has(mapId);
  // Optimistic: atualiza UI imediatamente, reverte se falhar
  if (wasPinned) _pinnedMapIds.delete(mapId);
  else _pinnedMapIds.add(mapId);
  if (btn) { btn.classList.toggle('is-pinned', !wasPinned); btn.disabled = true; }
  try {
    if (wasPinned) {
      await sbFetch('pinned_maps?map_id=eq.' + encodeURIComponent(mapId),
        { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } });
    } else {
      await sbFetch('pinned_maps', {
        method: 'POST',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ user_id: currentUser.id, map_id: mapId }),
      });
    }
    // Re-render pra mover o card pra/da seção "Fixados"
    if (typeof applyGalleryFilters === 'function') applyGalleryFilters(true);
  } catch(e) {
    // Rollback
    if (wasPinned) _pinnedMapIds.add(mapId);
    else _pinnedMapIds.delete(mapId);
    if (btn) btn.classList.toggle('is-pinned', wasPinned);
    console.warn('[pins] toggle failed:', e);
    alert('Falha ao ' + (wasPinned ? 'desafixar' : 'fixar') + ' o mapa. Tente de novo.');
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ─── Gallery KPIs (big numbers na home) ─────────────────────────────────────
// Baseline historico HYPR (PDVs ja mapeados antes do Geocodify). Atualizar este
// valor manualmente quando houver bump significativo (novo deal, base externa).
// O KPI 'Historico HYPR' exibe: BASELINE + soma de row_count de TODOS os mapas
// do Geocodify (nao filtrado), para representar o footprint cumulativo total.
var HYPR_HISTORICAL_BASELINE = 2217396;

var _kpiState = { mapas: 0, pdvs: 0, mes: 0, historic: 0 };

function _fmtKpiInt(n) { return Math.round(n).toLocaleString('pt-BR'); }

function _fmtKpiBig(n) {
  n = Math.round(n);
  if (n < 1000) return n.toLocaleString('pt-BR');
  if (n < 10000) return (n / 1000).toFixed(1).replace('.', ',') + 'k';
  if (n < 1000000) return Math.round(n / 1000) + 'k';
  return (n / 1000000).toFixed(2).replace('.', ',') + 'M';
}

function _easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

function _animateKpi(el, from, to, duration, fmt) {
  if (!el) return;
  if (from === to) { el.textContent = fmt(to); return; }
  var start = performance.now();
  function frame(now) {
    var t = Math.min(1, (now - start) / duration);
    var current = from + (to - from) * _easeOutCubic(t);
    el.textContent = fmt(current);
    if (t < 1) requestAnimationFrame(frame);
    else el.textContent = fmt(to);
  }
  requestAnimationFrame(frame);
}

function updateGalleryKPIs(filtered) {
  if (!filtered) return;
  var nMapas = filtered.length;
  var nPdvs = filtered.reduce(function(s, m) { return s + (parseInt(m.row_count) || 0); }, 0);
  // Ultimos 30 dias rolling (respeita filtro tipo/criador/busca)
  var cutoff = Date.now() - 30 * 24 * 3600 * 1000;
  var nMes = filtered.filter(function(m) {
    if (!m.created_at) return false;
    return new Date(m.created_at).getTime() >= cutoff;
  }).length;
  // Historico HYPR: NAO reage a filtros. Soma TODOS os mapas (_galleryMaps).
  var totalAllMaps = (_galleryMaps || []).reduce(function(s, m) { return s + (parseInt(m.row_count) || 0); }, 0);
  var nHistoric = HYPR_HISTORICAL_BASELINE + totalAllMaps;

  var elMapas = document.getElementById('kpi-mapas');
  var elPdvs = document.getElementById('kpi-pdvs');
  var elMes = document.getElementById('kpi-mes');
  var elHistoric = document.getElementById('kpi-historic');

  _animateKpi(elMapas, _kpiState.mapas, nMapas, 300, _fmtKpiInt);
  _animateKpi(elPdvs, _kpiState.pdvs, nPdvs, 300, _fmtKpiBig);
  _animateKpi(elMes, _kpiState.mes, nMes, 300, _fmtKpiInt);
  _animateKpi(elHistoric, _kpiState.historic, nHistoric, 300, _fmtKpiBig);

  // Tooltips com numeros completos
  if (elPdvs) elPdvs.title = nPdvs.toLocaleString('pt-BR') + ' PDVs no recorte';
  if (elHistoric) elHistoric.title = 'Baseline ' + HYPR_HISTORICAL_BASELINE.toLocaleString('pt-BR') +
    ' + ' + totalAllMaps.toLocaleString('pt-BR') + ' no Geocodify = ' +
    nHistoric.toLocaleString('pt-BR') + ' PDVs total';

  _kpiState = { mapas: nMapas, pdvs: nPdvs, mes: nMes, historic: nHistoric };
}

async function loadGallery() {
  var loading = document.getElementById('gallery-loading');
  var grid = document.getElementById('gallery-grid');
  var empty = document.getElementById('gallery-empty');
  var filters = document.getElementById('gallery-filters');
  var kpis = document.getElementById('gallery-kpis');
  var pagination = document.getElementById('gallery-pagination');

  // Stale-while-revalidate: se já temos _galleryMaps em memória (voltou de um
  // mapa, p.ex.), renderiza imediato do cache e refresca em background. Sem
  // isso, cada retorno à gallery exibia um flash de "Carregando..." com
  // KPIs/filtros/grid escondidos enquanto a fetch rodava.
  var hasCachedData = Array.isArray(_galleryMaps) && _galleryMaps.length > 0;

  if (!hasCachedData) {
    // 1º load da sessão — mostra spinner
    loading.style.display = 'block';
    grid.style.display = 'none';
    empty.style.display = 'none';
    if (filters) filters.style.display = 'none';
    if (kpis) kpis.style.display = 'none';
    pagination.style.display = 'none';
  } else {
    // Re-entrada na gallery — re-renderiza imediato dos dados em cache.
    loading.style.display = 'none';
    if (filters) filters.style.display = 'flex';
    if (kpis) kpis.style.display = 'grid';
    try { applyGalleryFilters(true); } catch(_) {}
  }

  try {
    // Fetch em paralelo: lista de mapas + ids fixados do usuário atual.
    // loadPinnedMaps() nunca rejeita (try/catch interno) — falha vira Set vazio.
    var fetchResults = await Promise.all([
      sbFetch('saved_maps?select=*&order=created_at.desc&limit=500'),
      loadPinnedMaps()
    ]);
    var maps = fetchResults[0];
    loading.style.display = 'none';
    if (!maps || maps.length === 0) { empty.style.display = 'block'; return; }

    // Detecta mudança real antes de re-renderizar (evita flicker quando
    // os dados vieram idênticos ao cache). Compara tamanho + IDs/timestamps
    // dos extremos da lista — suficiente pra detectar inserções, deleções
    // e edições mais recentes (lista vem ordenada por created_at desc).
    var changed = !hasCachedData
      || maps.length !== _galleryMaps.length
      || maps[0]?.id !== _galleryMaps[0]?.id
      || maps[0]?.updated_at !== _galleryMaps[0]?.updated_at
      || maps[maps.length - 1]?.id !== _galleryMaps[_galleryMaps.length - 1]?.id;

    _galleryMaps = maps;

    // Populate creator dropdown (preserva valor selecionado)
    var creatorEl = document.getElementById('gf-creator');
    if (creatorEl) {
      var creators = {};
      maps.forEach(function(m) { if (m.created_by) creators[m.created_by] = true; });
      var prevValue = creatorEl.value;
      creatorEl.innerHTML = '<option value="">Todos os criadores</option>';
      Object.keys(creators).sort().forEach(function(c) {
        var opt = document.createElement('option');
        opt.value = c; opt.textContent = c.split('@')[0];
        creatorEl.appendChild(opt);
      });
      creatorEl.value = prevValue;
    }
    if (filters) filters.style.display = 'flex';
    if (kpis) kpis.style.display = 'grid';
    if (changed) {
      _galleryPage = 1;
      applyGalleryFilters();
    }
  } catch (e) {
    if (!hasCachedData) {
      loading.innerHTML = '<span style="color:var(--lose)">Erro ao carregar: ' + escHtml(e.message) + '</span>';
    }
    // Com cache em tela, falha de refetch é silenciosa — mantém o que tá visível.
  }
}

function applyGalleryFilters(keepPage) {
  var searchVal = (document.getElementById('gf-search').value || '').toLowerCase().trim();
  var typeVal = document.getElementById('gf-type').value;
  var creatorVal = document.getElementById('gf-creator').value;
  var sortVal = document.getElementById('gf-sort').value;
  var grid = document.getElementById('gallery-grid');
  var empty = document.getElementById('gallery-empty');
  var pagEl = document.getElementById('gallery-pagination');
  
  // Search in name, description and creator
  var filtered = _galleryMaps.filter(function(m) {
    if (searchVal) {
      var haystack = ((m.name || '') + ' ' + (m.description || '') + ' ' + (m.created_by || '')).toLowerCase();
      if (haystack.indexOf(searchVal) === -1) return false;
    }
    if (typeVal && m.map_type !== typeVal) return false;
    if (creatorVal && m.created_by !== creatorVal) return false;
    return true;
  });
  
  if (sortVal === 'oldest') {
    filtered.sort(function(a,b) { return new Date(a.created_at) - new Date(b.created_at); });
  } else if (sortVal === 'name') {
    filtered.sort(function(a,b) { return (a.name || '').localeCompare(b.name || ''); });
  }
  // newest is default (already sorted from API)
  
  // Separa fixados (mantêm a ordem do sort selecionado) dos demais. Pinados
  // ignoram paginação — usuário típico tem ≤20 e quer ver todos sem clicar.
  _galleryFilteredPinned = [];
  _galleryFiltered = [];
  for (var i = 0; i < filtered.length; i++) {
    if (isPinned(filtered[i].id)) _galleryFilteredPinned.push(filtered[i]);
    else _galleryFiltered.push(filtered[i]);
  }
  if (!keepPage) _galleryPage = 1;

  // Atualiza big numbers da home (reage ao filtro). Historico HYPR e' fixo
  // baseado em _galleryMaps, nao em filtered, portanto sempre consistente.
  try { updateGalleryKPIs(filtered); } catch(e) {}

  if (filtered.length === 0) {
    grid.innerHTML = '';
    grid.style.display = 'none';
    pagEl.style.display = 'none';
    empty.style.display = 'block';
    empty.querySelector('.gallery-empty-title').textContent = searchVal || typeVal || creatorVal ? 'Nenhum mapa encontrado com esses filtros' : 'Nenhum mapa salvo ainda';
    // Esconder seção de pinados quando empty
    var _pinSec0 = document.getElementById('gallery-pinned-section');
    var _allHead0 = document.getElementById('gallery-all-section-head');
    if (_pinSec0) _pinSec0.style.display = 'none';
    if (_allHead0) _allHead0.style.display = 'none';
  } else {
    empty.style.display = 'none';
    renderGalleryPage();
  }
}

function renderGalleryPage() {
  var grid = document.getElementById('gallery-grid');
  var pagEl = document.getElementById('gallery-pagination');

  // ── Seção de fixados (sempre todos, sem paginação) ───────────────────────
  var pinSection = document.getElementById('gallery-pinned-section');
  var pinGrid = document.getElementById('gallery-pinned-grid');
  var pinCount = document.getElementById('gallery-pinned-count');
  var allHead = document.getElementById('gallery-all-section-head');
  if (pinSection && pinGrid) {
    if (_galleryFilteredPinned.length > 0) {
      pinGrid.innerHTML = '';
      for (var pi = 0; pi < _galleryFilteredPinned.length; pi++) {
        pinGrid.appendChild(buildMapCard(_galleryFilteredPinned[pi]));
      }
      if (pinCount) pinCount.textContent = _galleryFilteredPinned.length;
      pinSection.style.display = '';
      // Mostra header "Todos os mapas" só quando há fixados E há outros mapas
      if (allHead) allHead.style.display = _galleryFiltered.length > 0 ? '' : 'none';
    } else {
      pinSection.style.display = 'none';
      if (allHead) allHead.style.display = 'none';
    }
  }

  // ── Grid principal (paginado, sem fixados) ───────────────────────────────
  var total = _galleryFiltered.length;
  var totalPages = Math.ceil(total / _galleryPerPage);

  if (_galleryPage < 1) _galleryPage = 1;
  if (totalPages > 0 && _galleryPage > totalPages) _galleryPage = totalPages;

  var start = (_galleryPage - 1) * _galleryPerPage;
  var end = Math.min(start + _galleryPerPage, total);
  var pageItems = total > 0 ? _galleryFiltered.slice(start, end) : [];

  grid.innerHTML = '';
  for (var i = 0; i < pageItems.length; i++) grid.appendChild(buildMapCard(pageItems[i]));
  grid.style.display = total > 0 ? 'grid' : 'none';
  
  // Scroll gallery body to top
  var body = document.querySelector('.gallery-body');
  if (body) body.scrollTop = 0;
  
  if (totalPages <= 1) { pagEl.style.display = 'none'; return; }
  
  pagEl.style.display = 'flex';
  pagEl.innerHTML = '';
  
  var info = document.createElement('span');
  info.className = 'gallery-pagination-info';
  info.textContent = (start + 1) + '–' + end + ' de ' + total;
  pagEl.appendChild(info);
  
  var prev = document.createElement('button');
  prev.className = 'gp-btn gp-arrow';
  prev.innerHTML = '‹';
  prev.disabled = _galleryPage === 1;
  prev.onclick = function() { _galleryPage--; renderGalleryPage(); };
  pagEl.appendChild(prev);
  
  var pages = buildPageNumbers(_galleryPage, totalPages);
  for (var p = 0; p < pages.length; p++) {
    if (pages[p] === '...') {
      var ell = document.createElement('span');
      ell.className = 'gp-ellipsis';
      ell.textContent = '…';
      pagEl.appendChild(ell);
    } else {
      var btn = document.createElement('button');
      btn.className = 'gp-btn' + (pages[p] === _galleryPage ? ' active' : '');
      btn.textContent = pages[p];
      btn.onclick = (function(pg) { return function() { _galleryPage = pg; renderGalleryPage(); }; })(pages[p]);
      pagEl.appendChild(btn);
    }
  }
  
  var next = document.createElement('button');
  next.className = 'gp-btn gp-arrow';
  next.innerHTML = '›';
  next.disabled = _galleryPage === totalPages;
  next.onclick = function() { _galleryPage++; renderGalleryPage(); };
  pagEl.appendChild(next);
}

function buildPageNumbers(current, total) {
  if (total <= 7) {
    var arr = [];
    for (var i = 1; i <= total; i++) arr.push(i);
    return arr;
  }
  var pages = [1];
  if (current > 3) pages.push('...');
  var lo = Math.max(2, current - 1);
  var hi = Math.min(total - 1, current + 1);
  for (var j = lo; j <= hi; j++) pages.push(j);
  if (current < total - 2) pages.push('...');
  pages.push(total);
  return pages;
}

function escHtml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Card cover: bolinhas decorativas proporcionais à quantidade de registros ──
// Usa PRNG seeded pelo ID do mapa para posições/tamanhos estáveis entre renders.
// FNV-1a hash → seed determinístico
function _fnv1aHash(str) {
  var h = 2166136261;
  for (var i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
// mulberry32 PRNG — rápido e suficientemente bom para uso visual
function _mulberry32(seed) {
  return function() {
    seed = (seed + 0x6D2B79F5) >>> 0;
    var t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// Quantidade de dots — tabela de tiers definida pelo usuário, com
// interpolação linear entre vizinhos. Cap superior em 70.
function _dotsCountForRows(rowCount) {
  var n = Math.max(0, parseInt(rowCount) || 0);
  var tiers = [
    [0, 3], [10, 5], [100, 10], [250, 14], [500, 19],
    [1000, 24], [2500, 29], [5000, 38], [7500, 45],
    [10000, 55], [15000, 70]
  ];
  var last = tiers[tiers.length - 1];
  if (n >= last[0]) return last[1];
  if (n <= tiers[0][0]) return tiers[0][1];
  for (var i = 1; i < tiers.length; i++) {
    var x1 = tiers[i-1][0], y1 = tiers[i-1][1];
    var x2 = tiers[i][0],   y2 = tiers[i][1];
    if (n <= x2) {
      var t = (n - x1) / (x2 - x1);
      return Math.round(y1 + t * (y2 - y1));
    }
  }
  return last[1];
}
// Gera o SVG dos dots dado um mapa (id + row_count)
function _buildThumbDots(mapId, rowCount) {
  var seedStr = String(mapId || 'fallback') + ':' + (rowCount || 0);
  var rand = _mulberry32(_fnv1aHash(seedStr));
  var n = _dotsCountForRows(rowCount);
  var parts = [];
  for (var i = 0; i < n; i++) {
    var x = 8 + rand() * 84;             // 8% a 92% horizontal
    var y = 10 + rand() * 80;            // 10% a 90% vertical
    var r = 1.4 + rand() * 2.2;          // raio 1.4–3.6
    var op = 0.28 + rand() * 0.5;        // opacidade 0.28–0.78
    parts.push('<circle cx="' + x.toFixed(2) + '%" cy="' + y.toFixed(2) + '%" r="' + r.toFixed(2) + '" fill="white" opacity="' + op.toFixed(2) + '"/>');
  }
  return parts.join('');
}

function buildMapCard(m) {
  const card = document.createElement('div');
  const pinned = isPinned(m.id);
  card.className = 'map-card' + (pinned ? ' is-pinned' : '');
  card.dataset.mapId = m.id;
  const date = new Date(m.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
  const dots = _buildThumbDots(m.id, m.row_count);
  const typeLabels = {
    'geocoder':              { label: '📍 Lat/Lon Generator',  color: '#10b981', bg: 'rgba(16,185,129,0.2)',  c1: '#059669', c2: '#064e3b' },
    'reverse_geocoder':      { label: '🔄 Address Generator',  color: '#22d3ee', bg: 'rgba(34,211,238,0.2)',  c1: '#0891b2', c2: '#0c4a6e' },
    'varejo360':             { label: '📊 Varejo 360',         color: '#f59e0b', bg: 'rgba(245,158,11,0.2)',  c1: '#d97706', c2: '#7c2d12' },
    'varejo360_comparativo': { label: '📈 Attack Plan',    color: '#818cf8', bg: 'rgba(129,140,248,0.2)', c1: '#4f46e5', c2: '#1e1b4b' },
    'places_discovery':      { label: '🔎 Places Discovery',   color: '#5DD6E6', bg: 'rgba(51,151,185,0.20)', c1: '#3397B9', c2: '#0F3B4A' },
  };
  const tConf = typeLabels[m.map_type] || typeLabels['varejo360'];
  const periodoStr = m.periodo_label ? ` · ${m.periodo_label}` : '';
  const rowLabel = m.map_type === 'geocoder' ? 'pontos' : m.map_type === 'reverse_geocoder' ? 'endereços' : m.map_type === 'places_discovery' ? 'places' : m.map_type === 'varejo360_comparativo' ? 'bandeiras' : 'PDVs';
  card.innerHTML = `
    <div class="map-card-thumb" style="--thumb-c1:${tConf.c1};--thumb-c2:${tConf.c2}">
      <svg class="map-card-thumb-dots" viewBox="0 0 100 100" preserveAspectRatio="none">${dots}</svg>
      <div class="map-card-badge">${(m.row_count||0).toLocaleString('pt-BR')} ${rowLabel}</div>
      <div style="position:absolute;top:10px;left:10px;z-index:1;font-size:10px;font-weight:600;padding:4px 10px;border-radius:6px;background:rgba(0,0,0,0.6);color:${tConf.color};backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);letter-spacing:0.2px;">${tConf.label}</div>
      ${pinned ? '<div class="map-card-pin-flag" title="Fixado" aria-hidden="true"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h1.6v-6H18v-2l-2-2z"/></svg></div>' : ''}
    </div>
    <div class="map-card-body">
      <div class="map-card-name">${escHtml(m.name)}</div>
      <div class="map-card-desc">${escHtml(m.description||'Sem descrição')}</div>
      <div class="map-card-meta">
        <div class="map-card-meta-info">
          <div class="map-card-date">${date}${periodoStr}</div>
          <div class="map-card-user">${escHtml(m.created_by)}</div>
        </div>
        <div class="map-card-actions">
          <button class="map-card-pin${pinned ? ' is-pinned' : ''}" title="${pinned ? 'Desafixar mapa' : 'Fixar mapa'}" aria-label="${pinned ? 'Desafixar mapa' : 'Fixar mapa'}" aria-pressed="${pinned}" onclick="event.stopPropagation();togglePinMap('${m.id}',this)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg></button>
          <button class="map-card-share" title="Compartilhar" aria-label="Compartilhar" onclick="event.stopPropagation();openShareModalFromCard('${m.id}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg></button>
          <button class="map-card-del" title="Excluir" aria-label="Excluir" onclick="event.stopPropagation();deleteMap('${m.id}',this)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-2 14a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L5 6"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
        </div>
      </div>
    </div>`;
  card.addEventListener('click', () => {
    if (m.map_type === 'varejo360_comparativo') {
      window.location.href = '/comparativo.html?id=' + m.id;
    } else {
      openSavedMap(m.id, m.name, m.map_type || 'varejo360');
    }
  });
  return card;
}

async function deleteMap(id, btn) {
  if (!confirm('Excluir este mapa? Esta ação não pode ser desfeita.')) return;
  btn.disabled = true;
  try {
    await sbFetch(`saved_maps?id=eq.${id}`, { method:'DELETE', headers:{'Prefer':'return=minimal'} });
    _galleryMaps = _galleryMaps.filter(function(m) { return m.id !== id; });
    if (_galleryMaps.length === 0) {
      document.getElementById('gallery-grid').style.display = 'none';
      document.getElementById('gallery-pagination').style.display = 'none';
      document.getElementById('gallery-empty').style.display = 'block';
      var _kpisEl = document.getElementById('gallery-kpis');
      if (_kpisEl) _kpisEl.style.display = 'none';
      var _filtersEl = document.getElementById('gallery-filters');
      if (_filtersEl) _filtersEl.style.display = 'none';
    } else {
      applyGalleryFilters(true);
    }
  } catch(e) { alert('Erro ao excluir: '+e.message); btn.disabled=false; }
}

// ─── Append PDVs a um mapa Varejo 360 existente ─────────────────────────────
// Permite expandir um mapa salvo com nova lista de CSV sem refazer do zero.
// O fluxo de geocoding (startGeocoding) é o MESMO de criação de mapa novo;
// a diferença está apenas no final, onde ao invés de showSaveModal fazemos
// INSERT em map_pdvs com on_conflict=map_id,cnpj_14.
//
// SCOPE: Varejo 360 apenas. Bloqueia em outros tipos no startAppendPdvs.
function startAppendPdvs() {
  if (!window._currentOpenMapId) {
    alert('Abra um mapa primeiro para adicionar PDVs.');
    return;
  }
  if (currentMapType !== 'varejo360') {
    alert('Adicionar PDVs só está disponível para mapas Varejo 360.');
    return;
  }
  if (!currentUser) {
    alert('Você precisa estar logado para adicionar PDVs.');
    return;
  }
  // Marcar modo append + alvo
  window._appendMode = true;
  window._appendToMapId = window._currentOpenMapId;
  window._appendToMapName = window._currentOpenMapName || 'mapa atual';

  // Trocar de tela SEM resetar allData/filteredData/map source.
  // selectMapType e showUploadZone zerariam tudo — em append a gente precisa
  // preservar os PDVs já carregados para somar os novos por cima.
  document.getElementById('app').style.display = 'none';
  document.getElementById('gallery-screen').classList.add('hidden');
  document.getElementById('upload-zone').classList.remove('hidden');
  // Reset apenas o necessário pro novo upload
  rawCSVData = [];
  window._pendingMapName = null;
  window._pendingMapDesc = null;
  window._pendingMapType = 'varejo360';
  window._pendingPeriodo = null;

  // Configurar UI do upload zone para Varejo 360 (sem chamar selectMapType)
  var uploadTitle = document.querySelector('#drop-zone .upload-title');
  var uploadSub = document.querySelector('#upload-zone .upload-sub');
  var formatsMsg = document.getElementById('upload-formats-msg');
  var startBtn = document.getElementById('btn-start-geo');
  var periodoEl = document.getElementById('step2-periodo');
  if (uploadTitle) uploadTitle.textContent = 'Adicionar PDVs ao mapa';
  if (uploadSub) uploadSub.innerHTML = 'Suba um CSV com os novos PDVs. CNPJs que já estão no mapa serão ignorados automaticamente.';
  if (formatsMsg) formatsMsg.textContent = 'Formato HYPR/Kantar · CSV com cnpj + share · CNPJ raiz (8 dígitos)';
  if (startBtn) startBtn.textContent = 'Adicionar →';
  if (periodoEl) periodoEl.style.display = 'none';
  try { renderUploadTemplate('varejo360'); } catch(e) {}
  var vtBtns = document.getElementById('view-toggle-btns');
  if (vtBtns) vtBtns.style.display = 'none';
  try { goToStep(1); } catch(e) {}

  // Mostrar banner indicando alvo do append
  var banner = document.getElementById('append-mode-banner');
  var nameEl = document.getElementById('append-mode-map-name');
  if (banner) banner.style.display = '';
  if (nameEl) nameEl.textContent = window._appendToMapName;
}

function cancelAppendMode() {
  window._appendMode = false;
  window._appendToMapId = null;
  window._appendToMapName = null;
  var banner = document.getElementById('append-mode-banner');
  if (banner) banner.style.display = 'none';
  // Voltar para o mapa que estava aberto
  if (window._currentOpenMapId && window._currentOpenMapName) {
    document.getElementById('upload-zone').classList.add('hidden');
    openSavedMap(window._currentOpenMapId, window._currentOpenMapName, 'varejo360');
  } else {
    showGallery();
  }
}

// Chamado no fim do startGeocoding quando _appendMode está ativo.
// Insere as linhas geocodificadas em map_pdvs com on_conflict, mostra toast
// com contagem de novos/duplicados, e recarrega o mapa pra fundir os dados.
async function finishAppendToMap(mapId) {
  // Em modo append, allData contém PDVs existentes (com `id` do banco) +
  // novos (sem `id`). Só inserimos os novos.
  var newRows = allData.filter(function(r) {
    return !r.id && r.lat != null && r.lon != null;
  });
  var failedRows = allData.filter(function(r) {
    return !r.id && (r.lat == null || r.lon == null);
  });

  if (newRows.length === 0) {
    showAppendToast(0, 0, failedRows.length);
    window._appendMode = false;
    window._appendToMapId = null;
    return;
  }

  // Baseline: contagem real no banco antes do INSERT. Usada pra calcular
  // novos vs ignorados de forma confiável, sem depender do response do
  // PostgREST (que tem comportamento variável com on_conflict).
  var totalAntes = null;
  try {
    var beforeResp = await fetch(SUPABASE_URL + '/rest/v1/map_pdvs?map_id=eq.' + mapId + '&select=id', {
      headers: { 'apikey': SUPABASE_ANON, 'Prefer': 'count=exact', 'Range': '0-0' },
    });
    var contentRange = beforeResp.headers.get('content-range') || '';
    var m = contentRange.match(/\/(\d+)$/);
    totalAntes = m ? parseInt(m[1], 10) : null;
  } catch (e) {}

  var CHUNK = 500;

  for (var i = 0; i < newRows.length; i += CHUNK) {
    var chunk = newRows.slice(i, i + CHUNK).map(function(r) {
      return {
        map_id: mapId,
        cnpj: r.cnpj || null,
        bandeira: r.bandeira || null,
        marca: r.marca || null,
        lat: r.lat,
        lon: r.lon,
        geo_address: r.geo_address || null,
        uf: r.uf || null,
        nome_fantasia: r.nome_fantasia || null,
        razao_social: r.razao_social || null,
        situacao: r.situacao || null,
        atividade: r.atividade || null,
        cep: r.cep || null,
        percentual_dimensao: r.percentual_dimensao != null ? Number(r.percentual_dimensao) : null,
        percentual_marca_dimensao: r.percentual_marca_dimensao != null ? Number(r.percentual_marca_dimensao) : null,
        percentual_diff_media_dimensao: r.percentual_diff_media_dimensao != null ? Number(r.percentual_diff_media_dimensao) : null,
        oportunidade_dimensao: r.oportunidade_dimensao || null,
        share_reais_sku: r.share_reais_sku != null ? Number(r.share_reais_sku) : null,
        share_volume_sku: r.share_volume_sku != null ? Number(r.share_volume_sku) : null,
        share_unidades_sku: r.share_unidades_sku != null ? Number(r.share_unidades_sku) : null,
        share_reais_dimensao: r.share_reais_dimensao != null ? Number(r.share_reais_dimensao) : null,
        share_volume_dimensao: r.share_volume_dimensao != null ? Number(r.share_volume_dimensao) : null,
        share_unidades_dimensao: r.share_unidades_dimensao != null ? Number(r.share_unidades_dimensao) : null,
        share_reais_sku_dimensao: r.share_reais_sku_dimensao != null ? Number(r.share_reais_sku_dimensao) : null,
        share_volume_sku_dimensao: r.share_volume_sku_dimensao != null ? Number(r.share_volume_sku_dimensao) : null,
        share_unidades_sku_dimensao: r.share_unidades_sku_dimensao != null ? Number(r.share_unidades_sku_dimensao) : null,
        share_reais_sku_diff_media_dimensao: r.share_reais_sku_diff_media_dimensao != null ? Number(r.share_reais_sku_diff_media_dimensao) : null,
        share_volume_sku_diff_media_dimensao: r.share_volume_sku_diff_media_dimensao != null ? Number(r.share_volume_sku_diff_media_dimensao) : null,
        share_unidades_sku_diff_media_dimensao: r.share_unidades_sku_diff_media_dimensao != null ? Number(r.share_unidades_sku_diff_media_dimensao) : null,
        tickets_amostra: r.tickets_amostra != null ? parseInt(r.tickets_amostra, 10) : null,
        raw_data: r.raw_data || null,
      };
    });
    try {
      await sbFetch('map_pdvs?on_conflict=map_id,cnpj_14', {
        method: 'POST',
        headers: {
          'Prefer': 'resolution=ignore-duplicates,return=minimal',
        },
        body: JSON.stringify(chunk),
      });
    } catch (e) {
      console.error('[append] chunk insert failed:', e && e.message);
    }
  }

  // Recalcula total no banco e deriva contagens reais a partir da diferença.
  // Robusto a comportamentos esperados do PostgREST com on_conflict + RLS.
  var inserted = 0;
  var ignored = newRows.length;
  try {
    var afterResp = await fetch(SUPABASE_URL + '/rest/v1/map_pdvs?map_id=eq.' + mapId + '&select=id', {
      headers: { 'apikey': SUPABASE_ANON, 'Prefer': 'count=exact', 'Range': '0-0' },
    });
    var contentRangeAfter = afterResp.headers.get('content-range') || '';
    var m2 = contentRangeAfter.match(/\/(\d+)$/);
    var totalDepois = m2 ? parseInt(m2[1], 10) : null;
    if (totalAntes != null && totalDepois != null) {
      inserted = Math.max(0, totalDepois - totalAntes);
      ignored = newRows.length - inserted;
    }
    if (totalDepois != null) {
      // Atualiza row_count em saved_maps
      await sbFetch('saved_maps?id=eq.' + mapId, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ row_count: totalDepois, updated_at: new Date().toISOString() }),
      });
    }
  } catch (e) {}

  // Limpar flags antes do reload
  var nameForReload = window._appendToMapName || window._currentOpenMapName;
  window._appendMode = false;
  window._appendToMapId = null;
  window._appendToMapName = null;
  var banner = document.getElementById('append-mode-banner');
  if (banner) banner.style.display = 'none';

  // Toast antes de recarregar para o usuário ver o resultado
  showAppendToast(inserted, ignored, failedRows.length);

  // Recarregar o mapa com os dados consolidados (servidor é fonte da verdade)
  await openSavedMap(mapId, nameForReload, 'varejo360');
}

function showAppendToast(inserted, ignored, failed) {
  var toast = document.getElementById('geo-toast');
  if (!toast) return;
  var title = document.getElementById('geo-toast-title');
  var stats = document.getElementById('geo-toast-stats');
  if (title) title.textContent = inserted > 0
    ? '✓ PDVs adicionados ao mapa'
    : 'Nenhum PDV novo adicionado';
  if (stats) {
    var parts = [];
    parts.push('<strong>' + inserted.toLocaleString('pt-BR') + '</strong> novo' + (inserted !== 1 ? 's' : ''));
    if (ignored > 0) parts.push(ignored.toLocaleString('pt-BR') + ' já no mapa');
    if (failed > 0) parts.push('<span style="color:var(--lose);">' + failed.toLocaleString('pt-BR') + ' falharam no geocoding</span>');
    stats.innerHTML = parts.join(' · ');
  }
  toast.classList.add('active');
  // Auto-dismiss em 8s
  setTimeout(function() { toast.classList.remove('active'); }, 8000);
}

// Remove um PDV específico do mapa. Disponível apenas no popup do dono do
// mapa (não exposto em shared mode). Confirma com o usuário antes de deletar.
async function deletePdvFromMap(rowId) {
  if (!rowId) return;
  if (_isSharedMode) return; // defesa em profundidade — não deveria nem ter sido renderizado
  if (!currentUser) {
    alert('Você precisa estar logado para remover PDVs.');
    return;
  }
  var row = allData.find(function(r) { return r.id === rowId; });
  if (!row) {
    alert('PDV não encontrado no mapa.');
    return;
  }
  var nomeDisplay = row.bandeira || row.razao_social || row.cnpj || 'este PDV';
  if (!confirm('Remover "' + nomeDisplay + '" do mapa?\n\nA remoção é permanente. Você pode adicionar este PDV de volta subindo uma nova base.')) {
    return;
  }

  // Fechar popup imediatamente — UX responsivo
  try { if (_popup) _popup.remove(); } catch(e) {}

  try {
    // DELETE no Supabase
    await sbFetch('map_pdvs?id=eq.' + encodeURIComponent(rowId), {
      method: 'DELETE',
      headers: { 'Prefer': 'return=minimal' },
    });

    // Remove de memória
    allData = allData.filter(function(r) { return r.id !== rowId; });
    filteredData = filteredData.filter(function(r) { return r.id !== rowId; });

    // Re-render markers, filtros, painéis
    try { renderMarkers(); } catch(e) {}
    try { populateFilters(); } catch(e) {}
    try { applyFilters(); } catch(e) {}
    try { updatePanels(); } catch(e) {}

    // Atualizar row_count no saved_maps
    if (window._currentOpenMapId) {
      try {
        await sbFetch('saved_maps?id=eq.' + window._currentOpenMapId, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ row_count: allData.length, updated_at: new Date().toISOString() }),
        });
      } catch(e) {}
    }
  } catch (e) {
    console.error('[delete-pdv] failed:', e && e.message);
    alert('Erro ao remover PDV: ' + (e && e.message ? e.message : 'tente novamente.'));
  }
}

// ─── Modo de seleção múltipla (Varejo 360) ──────────────────────────────────
// Permite selecionar vários pins clicando neles em sequência e deletar em
// massa. Disponível apenas para dono do mapa, fora do shared mode.
//
// Visual: pins selecionados ganham borda branca + opacidade 1.0; não-
// selecionados ficam com opacidade 0.3. Popups bloqueados durante o modo.
function startSelectionMode() {
  if (currentMapType !== 'varejo360') {
    alert('Seleção múltipla disponível apenas em mapas Varejo 360.');
    return;
  }
  if (!currentUser || _isSharedMode) return;
  if (_selectionMode) return; // já ativo

  _selectionMode = true;
  _selectedIds = new Set();
  // Fecha qualquer popup aberto
  try { if (_popup) _popup.remove(); } catch(e) {}
  // Cursor crosshair pra dar feedback visual
  try { map.getCanvas().style.cursor = 'crosshair'; } catch(e) {}
  // Mostra barra flutuante
  var bar = document.getElementById('selection-bar');
  if (bar) bar.classList.add('active');
  updateSelectionBar();
  // ESC sai do modo
  document.addEventListener('keydown', _selectionEscHandler);
  // Re-render pra aplicar dim
  renderMarkers();
}

function exitSelectionMode() {
  if (!_selectionMode) return;
  _selectionMode = false;
  _selectedIds = new Set();
  try { map.getCanvas().style.cursor = ''; } catch(e) {}
  var bar = document.getElementById('selection-bar');
  if (bar) bar.classList.remove('active');
  document.removeEventListener('keydown', _selectionEscHandler);
  renderMarkers();
}

function _selectionEscHandler(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    exitSelectionMode();
  }
}

function updateSelectionBar() {
  var count = _selectedIds.size;
  var countEl = document.getElementById('selection-count');
  if (countEl) countEl.textContent = count.toLocaleString('pt-BR');
  var deleteBtn = document.getElementById('selection-delete-btn');
  if (deleteBtn) {
    deleteBtn.disabled = count === 0;
    var label = document.getElementById('selection-delete-label');
    if (label) label.textContent = count > 0 ? ('Remover ' + count.toLocaleString('pt-BR')) : 'Remover selecionados';
  }
}

async function bulkDeleteSelected() {
  if (!_selectionMode) return;
  var ids = Array.from(_selectedIds);
  if (ids.length === 0) return;
  if (_isSharedMode || !currentUser) return;
  var mapId = window._currentOpenMapId;
  if (!mapId) return;

  if (!confirm('Remover ' + ids.length.toLocaleString('pt-BR') + ' PDVs do mapa?\n\nA remoção é permanente.')) {
    return;
  }

  // Desativar botão durante o processo
  var deleteBtn = document.getElementById('selection-delete-btn');
  if (deleteBtn) deleteBtn.disabled = true;

  var deleted = 0;
  // DELETE em chunks (filtro in.() — Supabase aceita).
  var CHUNK = 100;
  try {
    for (var i = 0; i < ids.length; i += CHUNK) {
      var slice = ids.slice(i, i + CHUNK);
      var idList = slice.map(encodeURIComponent).join(',');
      await sbFetch('map_pdvs?id=in.(' + idList + ')', {
        method: 'DELETE',
        headers: { 'Prefer': 'return=minimal' },
      });
      deleted += slice.length;
    }
    // Remove de memória
    var idSet = new Set(ids);
    allData = allData.filter(function(r) { return !idSet.has(r.id); });
    filteredData = filteredData.filter(function(r) { return !idSet.has(r.id); });

    // Atualiza row_count
    try {
      await sbFetch('saved_maps?id=eq.' + mapId, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ row_count: allData.length, updated_at: new Date().toISOString() }),
      });
    } catch(e) {}

    // Sai do modo e re-renderiza
    exitSelectionMode();
    try { populateFilters(); } catch(e) {}
    try { applyFilters(); } catch(e) {}
    try { updatePanels(); } catch(e) {}
  } catch (e) {
    console.error('[bulk-delete] failed:', e && e.message);
    alert('Erro ao remover PDVs: ' + (e && e.message ? e.message : 'tente novamente.') + '\n\n' + deleted + ' de ' + ids.length + ' foram removidos antes do erro.');
    if (deleteBtn) deleteBtn.disabled = false;
  }
}

// Dispara `v360:map-opened` para o V360Comp carregar dados competitivos e
// retorna uma Promise que resolve quando o evento `v360:competitors-loaded`
// dispara (ou após timeout). Usar antes do primeiro render evita o flash
// onde o mapa aparece em modo Solo (cor "Na média" amarela em todos os pins)
// por 0.5-3s até os concorrentes carregarem e reclassificarem tudo.
function _loadCompetitorsAndWait(mapId, sharedMode) {
  return new Promise(function(resolve) {
    var done = false;
    var finish = function() {
      if (done) return;
      done = true;
      window.removeEventListener('v360:competitors-loaded', finish);
      resolve();
    };
    window.addEventListener('v360:competitors-loaded', finish);
    // Timeout de segurança: nunca trava o boot por mais de 8s mesmo se algo
    // der errado no fetch de concorrentes. 8s cobre paginação de ~10k PDVs
    // de concorrente com folga.
    setTimeout(finish, 8000);
    try {
      window.dispatchEvent(new CustomEvent('v360:map-opened', {
        detail: { mapId: mapId, sharedMode: !!sharedMode }
      }));
    } catch(_) {
      finish(); // se dispatch falhar, libera o boot
    }
  });
}

// Cache de 1 slot foi removido por causar bugs de UX recorrentes (charts
// stale, painéis presos em skeleton, V360 reabrindo sem pins). O fluxo de
// fetch paralelo (4× paginação) já é rápido o suficiente; consistência
// vale mais do que ~500ms de "reabertura instantânea".

async function openSavedMap(mapId, name, mapType) {
  // Limpar pendências de geocoding anterior — evita save acidental
  window._pendingMapName = null;
  window._pendingMapDesc = null;
  window._pendingMapType = null;
  window._pendingPeriodo = null;
  rawCSVData = [];
  // Limpar modo seleção se ativo de algum mapa anterior
  try { if (typeof exitSelectionMode === 'function' && _selectionMode) exitSelectionMode(); } catch(e) {}
  // Track open map for share feature
  window._currentOpenMapId = mapId;
  window._currentOpenMapName = name;
  try { setHeaderMapName(name); } catch(e) {}
  // Aplicar modo visual correto ANTES de mostrar o mapa
  applyMapMode(mapType || 'varejo360');
  // Salvar estado para restaurar ao trocar de aba
  try { sessionStorage.setItem('hypr_last_map', JSON.stringify({ mapId, mapName: name, mapType: _mapType })); } catch(e) {}
  // Atualizar URL para permitir compartilhamento e F5
  try { history.replaceState(null, '', '?map=' + mapId); } catch(e) {}
  document.getElementById('gallery-screen').classList.add('hidden');
  document.getElementById('upload-zone').classList.add('hidden');
  // Mostrar #app ANTES de initMap — MapLibre precisa do container visível
  document.getElementById('app').style.display = 'flex';
  await new Promise(r => setTimeout(r, 50)); // dar tempo ao browser renderizar
  if (!map) initMap();
  await new Promise(r => setTimeout(r, 100)); // aguardar MapLibre inicializar
  if (map) map.resize();

  // ─── Limpeza forte do mapa anterior ──────────────────────────────────────
  // Antes de qualquer fetch, zera tudo o que pode "vazar" do mapa anterior:
  // dados em memória, source GeoJSON do MapLibre, donut markers HTML, estado
  // do V360Comp (perspBar/chips/competidores). Sem isso, o usuário vê pins/
  // chips do mapa antigo durante o load do novo.
  allData = [];
  filteredData = [];
  try {
    if (map && map.getSource('pdvs')) {
      map.getSource('pdvs').setData({ type: 'FeatureCollection', features: [] });
    }
  } catch(_) {}
  try { if (typeof _clearClusterDonuts === 'function') _clearClusterDonuts(); } catch(_) {}
  try { if (window.V360Comp && typeof window.V360Comp.reset === 'function') window.V360Comp.reset(); } catch(_) {}
  // Reset do estado de minimize do painel Places: a flag e os estilos inline
  // que togglePlacesPanel deixa no nó persistem entre mapas (DOM é o mesmo).
  // Sem isso, abrir um Places novo depois de ter minimizado outro volta com
  // pill em vez do painel completo.
  try {
    if (_placesPanelMinimized) {
      _placesPanelMinimized = false;
      var _pp = document.getElementById('places-panel');
      var _ppBody = document.getElementById('places-panel-body');
      var _ppTitle = document.getElementById('places-panel-title');
      var _ppBtn = document.getElementById('btn-minimize-panel');
      var _ppHeader = _pp ? _pp.firstElementChild : null;
      if (_ppBody) _ppBody.style.display = '';
      if (_pp) {
        _pp.style.width = '340px';
        _pp.style.bottom = 'var(--gap-edge)';
        _pp.style.padding = '20px';
        _pp.style.borderRadius = 'var(--r-xl)';
      }
      if (_ppHeader) {
        _ppHeader.style.marginBottom = '14px';
        _ppHeader.style.paddingBottom = '10px';
        _ppHeader.style.borderBottom = '1px solid var(--glass-border)';
        _ppHeader.style.gap = '8px';
      }
      if (_ppTitle) { _ppTitle.textContent = '🔎 Places Discovery'; _ppTitle.style.fontSize = '13px'; }
      if (_ppBtn) { _ppBtn.textContent = '‹'; _ppBtn.title = 'Minimizar painel'; }
    }
  } catch(_) {}
  try { if (map) map.jumpTo({ center: [-47.93, -15.78], zoom: 4 }); } catch(_) {}

  const overlay = document.getElementById('geocoding-overlay');
  _resetPlacesOverlayFields();
  // Skeleton minimalista no right-panel + dot pulsante no header. Nada de
  // overlay pesado — esse é o fluxo de "abrir mapa salvo", só fetch.
  const _rightPanelEl = document.getElementById('right-panel');
  const _headerNameEl = document.getElementById('header-map-name');
  if (_rightPanelEl) _rightPanelEl.classList.add('panel-loading');
  if (_headerNameEl) _headerNameEl.classList.add('loading');
  document.getElementById('geo-current').textContent = `Carregando "${name}"...`;
  document.getElementById('geo-fill').style.width = '0%';
  document.getElementById('geo-pct').textContent = '';
  document.getElementById('geo-ok').textContent = '';
  document.getElementById('geo-fail').textContent = '';
  document.getElementById('geo-eta').textContent = '';

  try {
    // Load map metadata (payload + base_brand + tickets_floor numa só request).
    // v360-competitors.js lê window._savedMapMeta em vez de refetchar.
    var mapMeta = await sbFetch('saved_maps?id=eq.' + mapId + '&select=payload,base_brand,tickets_floor');
    window._savedMapMeta = (Array.isArray(mapMeta) && mapMeta[0]) || null;
    window._savedMapPayload = window._savedMapMeta?.payload || null;
    window._savedMapId = mapId;

    const PAGE = 1000;
    const CONCURRENCY = 4;
    allData = [];
      map.jumpTo({ center: [-47.93, -15.78], zoom: 4 });

    let page = 0;
    let done = false;
    while (!done) {
      const batch = [];
      for (let i = 0; i < CONCURRENCY; i++) {
        const p = page + i;
        // .catch(() => null): se uma página falha por rede flaky, não derruba
        // o batch inteiro. Null vira "página vazia" no loop abaixo e seguimos
        // — melhor PDVs parciais do que alert('Erro ao carregar') com tudo OK
        // nas outras 3. initSharedMode (~6242) já usa o mesmo padrão.
        batch.push(
          sbFetch(`map_pdvs?map_id=eq.${mapId}&select=*&offset=${p*PAGE}&limit=${PAGE}`)
            .catch(() => null)
        );
      }
      const results = await Promise.all(batch);
      for (const rows of results) {
        if (!rows || rows.length === 0) { done = true; continue; }
        for (const r of rows) allData.push(r);
        if (rows.length < PAGE) done = true;
      }
      const pct = Math.min(99, Math.round(allData.length/500*10));
      document.getElementById('geo-fill').style.width = pct+'%';
      document.getElementById('geo-current').textContent = `${allData.length.toLocaleString('pt-BR')} PDVs carregados...`;
      page += CONCURRENCY;
    }

    overlay.classList.remove('active');
  filteredData = allData.slice();
  if (allData.length > 0) {
      const _pts = allData.filter(r => r.lat && r.lon);
      if (!_pts.length) {
        // Edge case: mapa salvo sem nenhuma lat/lon válida (DB corrompido).
        // Sem isso aqui, o early return deixaria skeleton + loading dot presos
        // pulsando pra sempre. Limpa o loading state antes de sair.
        if (_rightPanelEl) _rightPanelEl.classList.remove('panel-loading');
        if (_headerNameEl) _headerNameEl.classList.remove('loading');
        return;
      }
      const bounds = _pts.reduce((b, r) => b.extend([parseFloat(r.lon), parseFloat(r.lat)]),
        new maplibregl.LngLatBounds([parseFloat(_pts[0].lon), parseFloat(_pts[0].lat)], [parseFloat(_pts[0].lon), parseFloat(_pts[0].lat)]));
      map.fitBounds(bounds, { padding:[40,40] });
    }
    // V360: aguardar concorrentes carregarem ANTES do primeiro render dos
    // painéis/mapa para evitar flash Solo → Duelo/Categoria. Se o mapa não
    // tem concorrentes, _loadCompetitorsAndWait resolve rapidamente (~200ms).
    if (currentMapType === 'varejo360') {
      // Skeleton no right-panel já comunica "preparando" — sem overlay pesado.
      try {
        await _loadCompetitorsAndWait(mapId, false);
      } catch(_) {}
    } else if (window.V360Comp) {
      window.V360Comp.reset();
    }
    populateFilters(); updatePanels(); updateOverlay();
    // Conteúdo dos painéis pronto — remover skeleton/dot
    if (_rightPanelEl) _rightPanelEl.classList.remove('panel-loading');
    if (_headerNameEl) _headerNameEl.classList.remove('loading');
    checkReenrichBar();
    if (currentMapType === 'places_discovery' && allData.length > 0) {
      document.getElementById('places-panel').style.display = 'block';
      document.getElementById('places-results-section').style.display = 'block';
      var plPayload = window._savedMapPayload;
      var queryLabel = plPayload?.search_query ? ' · <span style="color:var(--text-dim);">"' + escHtml(plPayload.search_query) + '"</span>' : '';
      document.getElementById('places-results-summary').innerHTML = '<strong>' + allData.length + '</strong> places carregados' + queryLabel;
      // Pre-fill query field for expand
      if (plPayload?.search_query) {
        var qInput = document.getElementById('places-query-input');
        if (qInput) qInput.value = plPayload.search_query;
      }
      // Alinha a tab de modo com o que foi salvo. Sem isso, o default 'states'
      // (do showPlacesSetup) fica selecionado mesmo abrindo um mapa salvo em
      // pin mode — gera inconsistência: tab Estados ativa + controles de pin
      // + círculo de raio visíveis no mapa simultaneamente.
      var savedMode = plPayload?.search_mode;
      if (savedMode === 'pin' || savedMode === 'states' || savedMode === 'country') {
        setPlacesMode(savedMode);
        // Restaura UFs ativos quando o modo é 'states' (country já popula tudo
        // internamente em setPlacesMode).
        if (savedMode === 'states' && Array.isArray(plPayload.search_states)) {
          _selectedStates.clear();
          document.querySelectorAll('.state-chip[data-uf]').forEach(function(c) { c.classList.remove('active'); });
          plPayload.search_states.forEach(function(uf) {
            _selectedStates.add(uf);
            var chip = document.querySelector('.state-chip[data-uf="' + uf + '"]');
            if (chip) chip.classList.add('active');
          });
        }
      }
      // Restore the original search pins visually if the payload has them.
      // Required for Aprofundar busca to work on previously-saved maps.
      // Older saves predate this field — they silently no-op here.
      if (plPayload && Array.isArray(plPayload.search_pins) && plPayload.search_pins.length > 0) {
        var restorePins = function() {
          try {
            clearAllPins();
            var radiusInput = document.getElementById('pin-radius-km');
            var prevRadiusValue = radiusInput ? radiusInput.value : null;
            plPayload.search_pins.forEach(function(p) {
              if (typeof p.lat !== 'number' || typeof p.lon !== 'number') return;
              if (radiusInput) radiusInput.value = p.radiusKm || plPayload.search_radius_km || 5;
              // historical=true → não desenha o círculo de raio (que ficava
              // dominando visualmente o mapa de visualização). O pin marker
              // + metadata em _radiusPins continuam pra Aprofundar busca.
              addRadiusPin(p.lat, p.lon, { historical: true });
            });
            if (radiusInput && prevRadiusValue !== null) radiusInput.value = prevRadiusValue;
          } catch(e) {
            console.warn('[places] could not restore search pins:', e);
          }
        };
        // addRadiusPin calls map.addSource/addLayer, which requires the style
        // to be loaded. Defer if it isn't yet.
        if (map && map.isStyleLoaded()) restorePins();
        else if (map) map.once('styledata', restorePins);
      }
      updatePlacesBadge(allData.length);
    }
    // Renderizar pins — renderMarkers já lida internamente com style/source não
    // prontos via map.once('styledata'). Aguardar source aqui criava deadlock
    // quando style estava loaded mas 'pdvs' ainda não existia (após initMap
    // recém-feito): o styledata já não disparava de novo e renderMarkers nunca
    // rodava → 1027 places carregados em memória, 0 plotados no mapa.
    renderMarkers();
    // Safety net: força _renderClusterDonuts depois que o fitBounds termina.
    // O overlay HTML de donuts depende de map.queryRenderedFeatures, que só é
    // confiável quando a câmera para de animar (event 'idle'). Sem isso, o
    // overlay renderiza uma vez mid-animação (parcial) e o user vê só 1
    // cluster + alguns pins soltos até interagir com o mapa.
    try {
      if (map) {
        map.once('idle', function() {
          try { if (typeof _renderClusterDonuts === 'function') _renderClusterDonuts(); } catch(_) {}
        });
      }
    } catch(_) {}
  } catch(e) {
    overlay.classList.remove('active');
    if (_rightPanelEl) _rightPanelEl.classList.remove('panel-loading');
    if (_headerNameEl) _headerNameEl.classList.remove('loading');
    alert('Erro ao carregar mapa: '+e.message);
  }
}

// ─── Modal Salvar ─────────────────────────────────────────────────────────────
function showSaveMapDialog() {
  if (!currentUser || allData.length === 0) return;
  // Se já tem nome (step 2 ou Places Discovery), salvar automaticamente sem modal
  if (window._pendingMapName) {
    document.getElementById('save-name').value = window._pendingMapName;
    document.getElementById('save-desc').value = window._pendingMapDesc || '';
    autoSaveAndNotify();
    return;
  }
  // Se o mapa já foi salvo (auto-save), não mostrar modal
  if (window._currentOpenMapId) return;
  // Mostrar modal para o usuário dar nome
  document.getElementById('save-name').value = '';
  document.getElementById('save-desc').value = '';
  document.getElementById('save-status').textContent = '';
  document.getElementById('save-btn').disabled = false;
  document.getElementById('save-modal').classList.add('active');
}

async function autoSaveAndNotify() {
  var summary = document.getElementById('places-results-summary');
  try {
    await saveMapToSupabase();
    if (summary) summary.innerHTML += '<br><span style="color:var(--win);font-size:11px;">✓ Mapa salvo automaticamente</span>';
  } catch(e) {
    console.error('Auto-save failed:', e);
    if (summary) summary.innerHTML += '<br><span style="color:var(--lose);font-size:11px;">⚠ Erro ao salvar: ' + escHtml(e.message) + '</span>';
    // Fallback: show modal so user can retry
    document.getElementById('save-modal').classList.add('active');
  }
}

function closeSaveModal() {
  var modal = document.getElementById('save-modal');
  modal.classList.remove('active');
  // Defensive: clear inline style in case any legacy path used style.display
  modal.style.display = '';
}

async function saveMapToSupabase() {
  const name = document.getElementById('save-name').value.trim();
  if (!name) { document.getElementById('save-status').textContent = '⚠️ Dê um nome ao mapa para salvar.'; return; }

  const btn = document.getElementById('save-btn');
  const status = document.getElementById('save-status');

  // Guard: se mapa já foi salvo nesta sessão, não criar duplicata em saved_maps
  if (window._currentOpenMapId) {
    status.innerHTML = '<span style="color:var(--win)">✓ Mapa já está salvo</span>';
    btn.disabled = false;
    setTimeout(closeSaveModal, 1500);
    return;
  }

  btn.disabled = true;
  status.textContent = 'Salvando mapa...';

  try {
    const colorIdx = Math.floor(Math.random()*THUMB_COLORS.length);
    // Build payload with search context for Places Discovery maps
    var savePayload = null;
    var effectiveMapType = window._pendingMapType || currentMapType || 'varejo360';
    if (effectiveMapType === 'places_discovery') {
      savePayload = {
        search_query: (document.getElementById('places-query-input')?.value || '').trim() || window._placesSearchQuery || null,
        search_mode: window._placesSearchMode || _placesMode || 'pin',
        search_states: window._placesSearchStates || Array.from(_selectedStates),
        search_radius_km: parseFloat(document.getElementById('pin-radius-km')?.value) || 5,
        // Persist the actual pin positions so that reloading a saved map can
        // restore them visually and enable features like Aprofundar busca,
        // which depends on knowing where the original areas were.
        search_pins: (window._placesSearchMode || _placesMode) === 'pin'
          ? _radiusPins.map(function(p) { return { lat: p.lat, lon: p.lon, radiusKm: p.radiusKm }; })
          : null,
      };
    }
    const saved = await sbFetch('saved_maps', {
      method: 'POST',
      body: JSON.stringify({
        name,
        description: document.getElementById('save-desc').value.trim() || null,
        created_by: currentUser.email,
        row_count: allData.length,
        thumbnail_color: THUMB_COLORS[colorIdx],
        map_type: effectiveMapType,
        periodo_mes: window._pendingPeriodo?.mes || null,
        periodo_ano: window._pendingPeriodo?.ano || null,
        periodo_label: window._pendingPeriodo?.label || null,
        payload: savePayload,
      }),
    });
    const mapId = Array.isArray(saved) ? saved[0].id : saved.id;

    // Inserir PDVs em lotes de 500
    const CHUNK = 500;
    const saveable = allData.filter(r => r.lat != null && r.lon != null && parseFloat(r.lat) && parseFloat(r.lon));
    for (let i = 0; i < saveable.length; i += CHUNK) {
      const chunk = saveable.slice(i, i+CHUNK).map(r => ({
        // NUNCA enviar 'id' — evita upsert acidental em PDVs de outros mapas
        map_id: mapId,
        cnpj: r.cnpj||null, bandeira: r.bandeira||null,
        nome: r.nome||null,
        lat: r.lat, lon: r.lon,
        geo_address: r.geo_address||null,
        marca: r.marca||null, uf: r.uf||null,
        nome_fantasia: r.nome_fantasia||null,
        razao_social: r.razao_social||null,
        situacao: r.situacao||null,
        atividade: r.atividade||null,
        cep: r.cep||null,
        place_id: r.place_id||null,
        place_types: r.place_types||null,
        place_status: r.place_status||null,
        percentual_dimensao: parseFloat(r.percentual_dimensao)||null,
        percentual_marca_dimensao: parseFloat(r.percentual_marca_dimensao)||null,
        percentual_diff_media_dimensao: parseFloat(r.percentual_diff_media_dimensao)||null,
        oportunidade_dimensao: r.oportunidade_dimensao||null,
        share_reais_sku: parseFloat(r.share_reais_sku)||null,
        share_volume_sku: parseFloat(r.share_volume_sku)||null,
        share_unidades_sku: parseFloat(r.share_unidades_sku)||null,
        share_reais_dimensao: parseFloat(r.share_reais_dimensao)||null,
        share_volume_dimensao: parseFloat(r.share_volume_dimensao)||null,
        share_unidades_dimensao: parseFloat(r.share_unidades_dimensao)||null,
        share_reais_sku_dimensao: parseFloat(r.share_reais_sku_dimensao)||null,
        share_volume_sku_dimensao: parseFloat(r.share_volume_sku_dimensao)||null,
        share_unidades_sku_dimensao: parseFloat(r.share_unidades_sku_dimensao)||null,
        share_reais_sku_diff_media_dimensao: parseFloat(r.share_reais_sku_diff_media_dimensao)||null,
        share_volume_sku_diff_media_dimensao: parseFloat(r.share_volume_sku_diff_media_dimensao)||null,
        share_unidades_sku_diff_media_dimensao: parseFloat(r.share_unidades_sku_diff_media_dimensao)||null,
        tickets_amostra: parseInt(r.tickets_amostra)||null,
      }));
      await sbFetch('map_pdvs', { method:'POST', headers:{'Prefer':'return=minimal'}, body: JSON.stringify(chunk) });
      const pct = Math.round((i+chunk.length)/saveable.length*100);
      status.textContent = `Salvando PDVs... ${pct}%`;
    }

    status.innerHTML = `<span style="color:var(--win)">✓ Mapa salvo com sucesso!</span>`;
    // Marcar mapa como salvo na sessão — evita duplicata em saves subsequentes
    // e desbloqueia features que dependem do ID (ex: openShareModal)
    window._currentOpenMapId = mapId;
    window._currentOpenMapName = name;
    // Keep _savedMapId in sync — autoSaveExpandedPlaces and retryPendingIds
    // read this variable to know which saved_map to append rows to. Without
    // this, Aprofundar busca right after the initial save would fail to
    // persist new places because the legacy openSavedMap-only path never ran.
    window._savedMapId = mapId;
    // Mostrar nome do mapa no header (substitui a antiga aparição do botão Compartilhar separado)
    try { setHeaderMapName(name); } catch(e) {}
    // Limpar estado pendente — auto-save já consumiu
    window._pendingMapName = null;
    window._pendingMapDesc = null;
    btn.disabled = false;
    try { checkReenrichBar(); } catch(e) {}
    setTimeout(closeSaveModal, 1500);
  } catch(e) {
    status.innerHTML = `<span style="color:var(--lose)">Erro: ${escHtml(e.message)}</span>`;
    btn.disabled = false;
    throw e; // Re-throw so autoSaveAndNotify can catch it
  }
}

// ─── Compartilhamento de mapas ─────────────────────────────────────────────
var _currentShareMapId = null;

function openShareModal() {
  var mapId = window._currentOpenMapId;
  if (!mapId) return;
  _currentShareMapId = mapId;
  document.getElementById('share-modal').classList.add('active');
  document.getElementById('share-modal-content').innerHTML = '<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:13px;">Gerando link...</div>';
  generateShareLink(mapId);
}

function openShareModalFromCard(mapId) {
  _currentShareMapId = mapId;
  window._currentOpenMapId = mapId;
  document.getElementById('share-modal').classList.add('active');
  document.getElementById('share-modal-content').innerHTML = '<div style="text-align:center;padding:20px 0;color:var(--text-muted);font-size:13px;">Gerando link...</div>';
  generateShareLink(mapId);
}

function closeShareModal() {
  document.getElementById('share-modal').classList.remove('active');
  _currentShareMapId = null;
}

async function generateShareLink(mapId) {
  var content = document.getElementById('share-modal-content');
  try {
    var maps = await sbFetch('saved_maps?id=eq.' + mapId + '&select=share_token,share_expires_at');
    var existing = maps && maps[0] ? maps[0].share_token : null;
    if (existing) {
      renderShareLink(existing);
      return;
    }
    var token = crypto.randomUUID();
    await sbFetch('saved_maps?id=eq.' + mapId, {
      method: 'PATCH',
      body: JSON.stringify({ share_token: token, share_expires_at: null }),
    });
    renderShareLink(token);
  } catch(e) {
    content.innerHTML = '<div style="color:var(--lose);font-size:13px;">Erro ao gerar link: ' + escHtml(e.message) + '</div>';
  }
}

function renderShareLink(token) {
  var link = window.location.origin + '/?share=' + token;
  var content = document.getElementById('share-modal-content');
  content.innerHTML =
    '<div style="display:flex;gap:8px;align-items:center;">' +
      '<input class="modal-input" id="share-link-input" value="' + link + '" readonly style="flex:1;font-size:12px;font-family:var(--mono,monospace);cursor:text;">' +
      '<button class="modal-btn-save" id="share-copy-btn" onclick="copyShareLink()" style="white-space:nowrap;padding:10px 16px;font-size:13px;">Copiar link</button>' +
    '</div>' +
    '<div style="font-size:12px;color:var(--text-muted);margin-top:12px;line-height:1.6;">' +
      'Qualquer pessoa com este link pode <strong>visualizar</strong> o mapa sem login. ' +
      'Não é possível editar, excluir ou acessar outros mapas.' +
    '</div>' +
    '<div style="margin-top:12px;">' +
      '<button onclick="revokeShareLink()" style="background:none;border:none;color:var(--lose);font-size:12px;cursor:pointer;padding:0;text-decoration:underline;">Revogar acesso</button>' +
    '</div>';
}

function copyShareLink() {
  var input = document.getElementById('share-link-input');
  if (!input) return;
  navigator.clipboard.writeText(input.value).then(function() {
    var btn = document.getElementById('share-copy-btn');
    btn.textContent = 'Copiado!';
    btn.style.background = 'var(--win)';
    setTimeout(function() { btn.textContent = 'Copiar link'; btn.style.background = ''; }, 2000);
  });
}

async function revokeShareLink() {
  if (!_currentShareMapId) return;
  if (!confirm('Revogar o link? Quem tiver o link antigo não conseguirá mais acessar.')) return;
  try {
    await sbFetch('saved_maps?id=eq.' + _currentShareMapId, {
      method: 'PATCH',
      body: JSON.stringify({ share_token: null, share_expires_at: null }),
    });
    document.getElementById('share-modal-content').innerHTML =
      '<div style="text-align:center;padding:16px 0;color:var(--win);font-size:13px;">Link revogado com sucesso.</div>';
  } catch(e) {
    alert('Erro: ' + e.message);
  }
}

// ─── Shared Mode (link público — read-only, sem login) ──────────────────────
var _isSharedMode = false;

function hideSharedLoading() {
  try {
    var root = document.documentElement;
    if (!root.classList.contains('shared-loading')) return;
    root.classList.add('shared-loading-leaving');
    setTimeout(function() {
      root.classList.remove('shared-loading');
      root.classList.remove('shared-loading-leaving');
    }, 380);
  } catch(e) {}
}

async function initSharedMode() {
  var params = new URLSearchParams(location.search);
  var shareToken = params.get('share');
  if (!shareToken) return false;

  _isSharedMode = true;
  // Sincroniza com window.* — v360-competitors.js (perspBar / chip × / botão +)
  // e outros módulos checam window._isSharedMode pra esconder ações de edição.
  // Sem isso a perspBar renderiza '+' e '×' mesmo no link compartilhado.
  try { window._isSharedMode = true; } catch(e) {}
  document.body.classList.add('shared-mode');

  // Esconder login, gallery, upload
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('gallery-screen').classList.add('hidden');

  try {
    // Buscar mapa via anon key (sem auth, RLS permite por share_token)
    var url = SUPABASE_URL + '/rest/v1/saved_maps?share_token=eq.' + shareToken + '&select=*';
    var resp = await fetch(url, { headers: { 'apikey': SUPABASE_ANON, 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error('Mapa não encontrado');
    var maps = await resp.json();
    if (!maps || !maps.length) throw new Error('Link inválido ou expirado');
    var mapMeta = maps[0];

    // Buscar PDVs — 4 páginas em paralelo por batch (~4x mais rápido que sequencial)
    var pdvs = [];
    var PAGE = 1000, CONCURRENCY = 4, page = 0, done = false;
    var fetchPage = function(p) {
      var pdvUrl = SUPABASE_URL + '/rest/v1/map_pdvs?map_id=eq.' + mapMeta.id + '&select=*&offset=' + (p * PAGE) + '&limit=' + PAGE;
      return fetch(pdvUrl, { headers: { 'apikey': SUPABASE_ANON, 'Accept': 'application/json' } })
        .then(function(r) { return r.ok ? r.json() : []; })
        .catch(function() { return []; });
    };
    while (!done) {
      var batchPromises = [];
      for (var i = 0; i < CONCURRENCY; i++) batchPromises.push(fetchPage(page + i));
      var results = await Promise.all(batchPromises);
      for (var j = 0; j < results.length; j++) {
        var batch = results[j];
        if (!batch || !batch.length) { done = true; continue; }
        pdvs = pdvs.concat(batch);
        if (batch.length < PAGE) done = true;
      }
      page += CONCURRENCY;
    }

    // Montar app em modo read-only
    var appEl = document.getElementById('app');
    appEl.style.display = 'flex';
    applyMapMode(mapMeta.map_type || 'varejo360');

    // Header: mostrar nome do mapa, esconder botões de edição
    try { setHeaderMapName(mapMeta.name || 'Mapa compartilhado'); } catch(e) {}
    var _shareBackBtn = document.getElementById('btn-back-gallery');
    if (_shareBackBtn) _shareBackBtn.style.display = 'none';

    await new Promise(function(r) { setTimeout(r, 80); });
    if (!map) initMap(); else map.resize();

    allData = pdvs.map(function(r) {
      r.lat = parseFloat(r.lat); r.lon = parseFloat(r.lon);
      return r;
    }).filter(function(r) { return r.lat && r.lon; });
    filteredData = allData.slice();

    // V360 Competitors: carrega ANTES de renderizar pra evitar flash Solo→Duelo
    window._currentOpenMapId = mapMeta.id;
    if (mapMeta.map_type === 'varejo360') {
      try { await _loadCompetitorsAndWait(mapMeta.id, true); } catch(_) {}
    }

    populateFilters(); applyFilters(); updatePanels(); renderMarkers(); updateOverlay();

    // Zoom to data
    if (allData.length > 0 && map) {
      var bounds = allData.reduce(function(b, r) {
        return [[Math.min(b[0][0], r.lon), Math.min(b[0][1], r.lat)], [Math.max(b[1][0], r.lon), Math.max(b[1][1], r.lat)]];
      }, [[180, 90], [-180, -90]]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }

    hideSharedLoading();
    return true;
  } catch(e) {
    hideSharedLoading();
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#888;font-size:16px;text-align:center;padding:20px;">' +
      '<div><div style="font-size:48px;margin-bottom:16px;">🔒</div>' + escHtml(e.message) + '<br><br><a href="/" style="color:var(--accent-light,#3b9eff);">Ir para o Geocodify</a></div></div>';
    return true;
  }
}

// ─── Show share button when a saved map is open ─────────────────────────────
window._currentOpenMapId = null;

// ─── Header helpers: nome do mapa e menu de ações ─────────────────────────
// Fase 6: .map-title é contenteditable native — divider e título mostram juntos.
function setHeaderMapName(name) {
  var el = document.getElementById('header-map-name');
  var divider = document.getElementById('map-title-divider');
  if (!el) return;
  if (name && String(name).trim()) {
    el.textContent = name;
    el.setAttribute('title', _isSharedMode ? name : 'Clique para renomear o mapa');
    // contenteditable só quando não é share mode
    el.setAttribute('contenteditable', _isSharedMode ? 'false' : 'true');
    el.removeAttribute('hidden');
    if (divider) divider.removeAttribute('hidden');
  } else {
    el.textContent = '';
    el.removeAttribute('title');
    el.setAttribute('contenteditable', 'false');
    el.setAttribute('hidden', '');
    if (divider) divider.setAttribute('hidden', '');
  }
}

// ── Edição inline do nome do mapa ────────────────────────────────────────────
// Fase 6: usa contenteditable nativo. Enter ou blur salva; Escape cancela.
// Bloqueado em modo share (read-only).
function startEditMapName() {
  if (_isSharedMode) return;
  if (!window._currentOpenMapId) return;

  var span = document.getElementById('header-map-name');
  if (!span) return;
  // Já em edição? (foco ativo)
  if (document.activeElement === span) return;

  var currentName = (span.textContent || '').trim();
  span.dataset.originalName = currentName;
  span.setAttribute('contenteditable', 'true');
  span.focus();

  // Seleciona todo o texto
  var range = document.createRange();
  range.selectNodeContents(span);
  var sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  var done = false;
  function finish(save) {
    if (done) return;
    done = true;
    span.removeEventListener('keydown', onKey);
    span.removeEventListener('blur', onBlur);

    var newName = (span.textContent || '').trim();
    var oldName = span.dataset.originalName || '';
    delete span.dataset.originalName;

    if (!save || !newName) {
      span.textContent = oldName;
      return;
    }
    if (newName === oldName) return;

    saveMapName(newName).catch(function(err) {
      console.error('Erro ao renomear mapa:', err);
      span.textContent = oldName;
      alert('Não foi possível renomear o mapa. Tente novamente.');
    });
  }

  function onKey(e) {
    if (e.key === 'Enter') { e.preventDefault(); span.blur(); }
    else if (e.key === 'Escape') { e.preventDefault(); finish(false); span.blur(); }
  }
  function onBlur() { finish(true); }

  span.addEventListener('keydown', onKey);
  span.addEventListener('blur', onBlur);
}

async function saveMapName(newName) {
  if (!window._currentOpenMapId) throw new Error('No open map id');
  await sbFetch('saved_maps?id=eq.' + window._currentOpenMapId, {
    method: 'PATCH',
    headers: { 'Prefer': 'return=minimal' },
    body: JSON.stringify({ name: newName, updated_at: new Date().toISOString() }),
  });
  // Atualiza caches conhecidos
  window._currentOpenMapName = newName;
  try {
    var last = JSON.parse(sessionStorage.getItem('hypr_last_map') || '{}');
    if (last && last.mapId === window._currentOpenMapId) {
      last.mapName = newName;
      sessionStorage.setItem('hypr_last_map', JSON.stringify(last));
    }
  } catch(e) {}
}

function toggleMoreMenu(ev) {
  if (ev) ev.stopPropagation();
  var dd = document.getElementById('more-menu-dropdown');
  var btn = document.getElementById('btn-more-actions');
  if (!dd) return;
  var isOpen = dd.style.display !== 'none';
  if (isOpen) {
    closeMoreMenu();
  } else {
    // Atualiza itens do menu ANTES de abrir (visibilidade contextual)
    var shareItem = document.getElementById('menu-item-share');
    var csvItem = document.getElementById('menu-item-csv');
    if (shareItem) {
      // Compartilhar: só disponível quando o mapa tem ID salvo e não está em modo shared
      var canShare = !!window._currentOpenMapId && !_isSharedMode;
      shareItem.style.display = canShare ? '' : 'none';
    }
    if (csvItem) {
      // CSV: disponível quando há dados carregados e não está em modo shared
      var canCsv = (typeof allData !== 'undefined') && allData && allData.length > 0 && !_isSharedMode;
      csvItem.style.display = canCsv ? '' : 'none';
    }
    var appendItem = document.getElementById('menu-item-append');
    if (appendItem) {
      // Adicionar PDVs: só para mapas Varejo 360 já salvos, dono autenticado, fora do shared mode
      var canAppend = currentMapType === 'varejo360'
        && !!window._currentOpenMapId
        && !!currentUser
        && !_isSharedMode;
      appendItem.style.display = canAppend ? '' : 'none';
    }
    var selectItem = document.getElementById('menu-item-select');
    if (selectItem) {
      // Selecionar PDVs: mesmo gating do Adicionar (V360 + dono + não shared) + tem dados
      var canSelect = currentMapType === 'varejo360'
        && !!window._currentOpenMapId
        && !!currentUser
        && !_isSharedMode
        && (typeof allData !== 'undefined') && allData && allData.length > 0;
      selectItem.style.display = canSelect ? '' : 'none';
    }
    dd.style.display = '';
    if (btn) btn.setAttribute('aria-expanded', 'true');
    // Click fora fecha
    setTimeout(function() { document.addEventListener('click', _moreMenuClickOutside); }, 0);
  }
}

function closeMoreMenu() {
  var dd = document.getElementById('more-menu-dropdown');
  var btn = document.getElementById('btn-more-actions');
  if (dd) dd.style.display = 'none';
  if (btn) btn.setAttribute('aria-expanded', 'false');
  document.removeEventListener('click', _moreMenuClickOutside);
}

function _moreMenuClickOutside(ev) {
  var wrap = document.querySelector('.hdr-more-wrap');
  if (wrap && !wrap.contains(ev.target)) closeMoreMenu();
}

// ─── Re-enrich: detect and update unidentified PDVs ──────────────────────
function checkReenrichBar() {
  var headerBtn = document.getElementById('btn-reenrich-map');
  var badge = document.getElementById('reenrich-badge');
  if (_isSharedMode || !currentUser) {
    if (headerBtn) headerBtn.style.display = 'none';
    return;
  }
  var unidentified = (allData || []).filter(function(r) {
    return r.cnpj && (!r.bandeira || r.bandeira === 'Não identificado' || r.bandeira === 'Carregando...' || r.bandeira === 'Desconhecido');
  });
  if (headerBtn) headerBtn.style.display = unidentified.length > 0 ? '' : 'none';
  if (badge) {
    var n = unidentified.length;
    badge.textContent = n > 999 ? '999+' : String(n);
  }
}

function dismissReenrich() {
  // Mantida como no-op por compatibilidade; a barra antiga foi removida em favor do badge no header
}

async function startReenrich() {
  var btn = document.getElementById('btn-reenrich-map');
  var badge = document.getElementById('reenrich-badge');
  if (btn) {
    btn.disabled = true;
    btn.setAttribute('title', 'Atualizando nomes...');
    btn.classList.add('is-loading');
  }

  var needsEnrich = allData.filter(function(r) {
    return r.cnpj && (!r.bandeira || r.bandeira === 'Não identificado' || r.bandeira === 'Carregando...' || r.bandeira === 'Desconhecido');
  });
  if (needsEnrich.length === 0) {
    if (btn) { btn.disabled = false; btn.classList.remove('is-loading'); btn.setAttribute('title', 'Atualizar nomes dos PDVs não identificados'); }
    checkReenrichBar();
    return;
  }

  // Show the geocoding overlay with re-enrich context
  document.getElementById('geo-title-text').textContent = 'Atualizando nomes';
  document.getElementById('geo-fill').style.width = '0%';
  document.getElementById('geo-pct').textContent = '0%';
  document.getElementById('geo-ok').textContent = '';
  document.getElementById('geo-fail').textContent = '';
  document.getElementById('geo-eta').textContent = '';
  document.getElementById('geo-current').textContent = needsEnrich.length + ' CNPJs para atualizar...';
  _resetPlacesOverlayFields();
  document.getElementById('geocoding-overlay').classList.add('active');
  geocodingCancelled = false;

  // Extract unique CNPJ keys
  function _cacheKey(row) {
    var raw = (row.cnpj || '').split(' - ')[0].replace(/\D/g, '');
    if (raw.length >= 14) return raw.slice(0, 14);
    if (raw.length >= 8) return 'raiz_' + raw.padStart(8, '0');
    return null;
  }
  var groups = {};
  needsEnrich.forEach(function(row) {
    var key = _cacheKey(row);
    if (!key) return;
    if (!groups[key]) groups[key] = [];
    groups[key].push(row);
  });

  var keys = Object.keys(groups);
  var ok = 0, fail = 0, done = 0;
  var total = needsEnrich.length;
  var startTime = Date.now();
  var BATCH = 25;

  for (var i = 0; i < keys.length; i += BATCH * 2) {
    if (geocodingCancelled) break;
    var batches = [];
    for (var p = 0; p < 2; p++) {
      var start = i + p * BATCH;
      if (start >= keys.length) break;
      batches.push(keys.slice(start, start + BATCH));
    }

    var responses = await Promise.allSettled(batches.map(function(batchKeys) {
      var cnpjNums = batchKeys.map(function(k) { return k.startsWith('raiz_') ? k.slice(5) : k; });
      return fetch('/api/cnpj-enrich', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cnpjs: cnpjNums }),
      }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });
    }));

    for (var pi = 0; pi < batches.length; pi++) {
      var batchKeys = batches[pi];
      var data = responses[pi].status === 'fulfilled' ? responses[pi].value : null;
      var results = data ? (data.results || {}) : {};

      batchKeys.forEach(function(key) {
        var rows = groups[key];
        if (!rows) return;
        var lookupKey = key.startsWith('raiz_') ? key.slice(5) : key;
        var result = results[lookupKey];
        if (result && (result.nome_exibicao || result.nome_fantasia || result.razao_social)) {
          var receita = {
            nome_fantasia: result.nome_fantasia || '', razao_social: result.razao_social || '',
            nome_exibicao: result.nome_exibicao || '', municipio: result.municipio || '',
            uf_receita: result.uf || '', cep: result.cep || '',
            situacao: result.situacao || '', atividade: result.atividade || '',
          };
          rows.forEach(function(row) { aplicarReceita(row, receita); });
          ok += rows.length;
        } else {
          fail += rows.length;
        }
        done += rows.length;
      });
    }

    // Update overlay with same format as geocoding
    var pct = Math.round(done / total * 100);
    document.getElementById('geo-fill').style.width = pct + '%';
    document.getElementById('geo-pct').textContent = pct + '%';
    document.getElementById('geo-ok').textContent = ok + ' nomes';
    document.getElementById('geo-fail').textContent = fail > 0 ? fail + ' ✗' : '';
    var elapsed = (Date.now() - startTime) / 1000;
    var rate = done / elapsed;
    var remaining = (total - done) / rate;
    if (remaining > 0 && isFinite(remaining)) {
      document.getElementById('geo-eta').textContent = remaining > 60 ? '~' + Math.ceil(remaining / 60) + 'min' : '~' + Math.round(remaining) + 's';
    }
    document.getElementById('geo-current').textContent = ok + ' identificados · ' + done + '/' + total;

    // Periodic render
    if ((i + BATCH * 2) % 100 === 0 || i + BATCH * 2 >= keys.length) {
      filteredData = allData.slice(); populateFilters(); applyFilters(); updatePanels();
    }
  }

  // ── RETRY: wait 20s for rate limits to reset, then retry failed ones ──
  var retryKeys = keys.filter(function(key) {
    var rows = groups[key];
    return rows && rows.some(function(r) { return r.bandeira === 'Não identificado' || r.bandeira === 'Carregando...' || r.bandeira === 'Desconhecido'; });
  });
  if (retryKeys.length > 0 && !geocodingCancelled) {
    document.getElementById('geo-title-text').textContent = 'Aguardando reset de APIs...';
    document.getElementById('geo-current').textContent = retryKeys.length + ' CNPJs para retry em 20s';
    for (var cd = 20; cd > 0 && !geocodingCancelled; cd--) {
      document.getElementById('geo-eta').textContent = cd + 's';
      await new Promise(function(r) { setTimeout(r, 1000); });
    }
    if (!geocodingCancelled) {
      document.getElementById('geo-title-text').textContent = 'Retry — recuperando nomes';
      fail = 0;
      var retryDone = 0;
      for (var ri = 0; ri < retryKeys.length; ri += BATCH * 2) {
        if (geocodingCancelled) break;
        var retryBatches = [];
        for (var rp = 0; rp < 2; rp++) {
          var rStart = ri + rp * BATCH;
          if (rStart >= retryKeys.length) break;
          retryBatches.push(retryKeys.slice(rStart, rStart + BATCH));
        }
        var retryResponses = await Promise.allSettled(retryBatches.map(function(batchKeys) {
          var cnpjNums = batchKeys.map(function(k) { return k.startsWith('raiz_') ? k.slice(5) : k; });
          return fetch('/api/cnpj-enrich', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cnpjs: cnpjNums }),
          }).then(function(r) { return r.ok ? r.json() : null; }).catch(function() { return null; });
        }));
        for (var rpi = 0; rpi < retryBatches.length; rpi++) {
          var rBatchKeys = retryBatches[rpi];
          var rData = retryResponses[rpi].status === 'fulfilled' ? retryResponses[rpi].value : null;
          var rResults = rData ? (rData.results || {}) : {};
          rBatchKeys.forEach(function(key) {
            var rows = groups[key];
            if (!rows) return;
            var lookupKey = key.startsWith('raiz_') ? key.slice(5) : key;
            var result = rResults[lookupKey];
            if (result && (result.nome_exibicao || result.nome_fantasia || result.razao_social)) {
              var receita = {
                nome_fantasia: result.nome_fantasia || '', razao_social: result.razao_social || '',
                nome_exibicao: result.nome_exibicao || '', municipio: result.municipio || '',
                uf_receita: result.uf || '', cep: result.cep || '',
                situacao: result.situacao || '', atividade: result.atividade || '',
              };
              rows.forEach(function(row) { aplicarReceita(row, receita); });
              ok += rows.length;
            } else {
              fail += rows.length;
            }
            retryDone += rows.length;
          });
        }
        document.getElementById('geo-ok').textContent = ok + ' nomes';
        document.getElementById('geo-fail').textContent = fail > 0 ? fail + ' ✗' : '';
        document.getElementById('geo-current').textContent = ok + ' identificados · retry ' + retryDone + '/' + retryKeys.length;
        await new Promise(function(r) { setTimeout(r, 80); });
      }
    }
  }

  // Final render
  filteredData = allData.slice();
  populateFilters(); applyFilters(); updatePanels(); renderMarkers();

  // Save updated PDVs to Supabase
  document.getElementById('geo-current').textContent = 'Salvando no banco...';
  var mapId = window._currentOpenMapId;
  if (mapId && ok > 0) {
    try {
      var updated = allData.filter(function(r) { return r.id && r.bandeira && r.bandeira !== 'Não identificado' && r.bandeira !== 'Carregando...'; });
      var CHUNK = 200;
      for (var si = 0; si < updated.length; si += CHUNK) {
        var chunk = updated.slice(si, si + CHUNK).filter(function(r) { return r.id; });
        await Promise.allSettled(chunk.map(function(r) {
          return sbFetch('map_pdvs?id=eq.' + r.id, {
            method: 'PATCH',
            body: JSON.stringify({ bandeira: r.bandeira, nome_fantasia: r.nome_fantasia || null, razao_social: r.razao_social || null }),
          });
        }));
      }
    } catch(e) {}
  }

  // Hide overlay
  document.getElementById('geocoding-overlay').classList.remove('active');
  if (btn) {
    btn.disabled = false;
    btn.classList.remove('is-loading');
    btn.setAttribute('title', 'Atualizar nomes dos PDVs não identificados');
  }
  checkReenrichBar();
}
// ─── Places Discovery ─────────────────────────────────────────────────────────
// Brazilian state centroids and bounding boxes for grid generation
var BR_STATES = {
  'BR': { label: 'Brasil inteiro', lat: -14.24, lon: -51.93, bbox: [-73.98,-33.75,-34.79,5.27] },
  'AC': { label: 'Acre', lat:-9.97, lon:-67.81, bbox:[-73.99,-11.15,-66.62,-7.11] },
  'AL': { label: 'Alagoas', lat:-9.57, lon:-36.78, bbox:[-37.94,-10.50,-35.15,-8.81] },
  'AM': { label: 'Amazonas', lat:-3.42, lon:-65.86, bbox:[-73.79,-9.82,-56.10,2.25] },
  'AP': { label: 'Amapá', lat:1.41, lon:-51.77, bbox:[-54.87,-1.24,-49.87,4.44] },
  'BA': { label: 'Bahia', lat:-12.97, lon:-41.68, bbox:[-46.62,-18.35,-37.34,-8.53] },
  'CE': { label: 'Ceará', lat:-5.50, lon:-39.32, bbox:[-41.42,-7.86,-37.25,-2.78] },
  'DF': { label: 'Distrito Federal', lat:-15.83, lon:-47.86, bbox:[-48.29,-16.05,-47.31,-15.50] },
  'ES': { label: 'Espírito Santo', lat:-19.19, lon:-40.34, bbox:[-41.88,-21.30,-39.68,-17.89] },
  'GO': { label: 'Goiás', lat:-15.83, lon:-49.84, bbox:[-53.25,-19.50,-45.91,-12.40] },
  'MA': { label: 'Maranhão', lat:-5.42, lon:-45.44, bbox:[-48.76,-10.26,-41.79,-1.04] },
  'MG': { label: 'Minas Gerais', lat:-18.51, lon:-44.55, bbox:[-51.05,-22.92,-39.86,-14.23] },
  'MS': { label: 'Mato Grosso do Sul', lat:-20.77, lon:-54.78, bbox:[-58.17,-24.07,-53.26,-17.17] },
  'MT': { label: 'Mato Grosso', lat:-12.64, lon:-55.42, bbox:[-61.63,-18.04,-50.22,-7.35] },
  'PA': { label: 'Pará', lat:-3.42, lon:-52.49, bbox:[-58.90,-9.86,-46.06,2.59] },
  'PB': { label: 'Paraíba', lat:-7.12, lon:-36.72, bbox:[-38.77,-8.31,-34.79,-6.02] },
  'PE': { label: 'Pernambuco', lat:-8.28, lon:-37.86, bbox:[-41.36,-9.49,-34.86,-7.33] },
  'PI': { label: 'Piauí', lat:-7.72, lon:-42.73, bbox:[-45.99,-10.93,-40.37,-2.74] },
  'PR': { label: 'Paraná', lat:-25.25, lon:-51.93, bbox:[-54.62,-26.72,-48.02,-22.52] },
  'RJ': { label: 'Rio de Janeiro', lat:-22.91, lon:-43.17, bbox:[-44.89,-23.37,-40.96,-20.76] },
  'RN': { label: 'Rio Grande do Norte', lat:-5.79, lon:-36.51, bbox:[-37.96,-6.98,-34.95,-4.83] },
  'RO': { label: 'Rondônia', lat:-10.83, lon:-63.34, bbox:[-66.62,-13.70,-59.77,-7.97] },
  'RR': { label: 'Roraima', lat:2.74, lon:-61.37, bbox:[-64.83,-1.58,-58.88,5.27] },
  'RS': { label: 'Rio Grande do Sul', lat:-30.03, lon:-51.23, bbox:[-57.64,-33.75,-49.69,-27.08] },
  'SC': { label: 'Santa Catarina', lat:-27.24, lon:-50.22, bbox:[-53.84,-29.39,-48.55,-25.96] },
  'SE': { label: 'Sergipe', lat:-10.57, lon:-37.07, bbox:[-38.25,-11.57,-36.39,-9.51] },
  'SP': { label: 'São Paulo', lat:-23.55, lon:-46.64, bbox:[-53.11,-25.31,-44.16,-19.78] },
  'TO': { label: 'Tocantins', lat:-10.18, lon:-48.33, bbox:[-50.73,-13.47,-45.74,-5.17] },
};

// BR_CITIES: carregado sob demanda de /br-cities.json (38KB → lazy load)
var BR_CITIES = null;

async function ensureBRCities() {
  if (BR_CITIES) return;
  var resp = await fetch('/br-cities.json');
  BR_CITIES = await resp.json();
}


var _placesMode = 'states'; // 'states' | 'country' | 'pin' — default Estados (mais comum)
var _selectedStates = new Set();
var _radiusPins = []; // [{lat, lon, radiusKm, marker, circleId}]
var _placesDiscoveryCancelled = false;
// Captures API errors during the most recent places discovery run. Surfaced
// to the user when the search finishes with zero results, so failures like
// HTTP 4xx/5xx don't silently masquerade as 'Nenhum resultado encontrado'.
var _placesApiErrors = [];
// When set (non-null), getSearchAreas() returns these sub-areas instead of
// mapping _radiusPins. Used by startDeepSearch() to inject a 3x3 sub-pin grid
// over each existing pin without disturbing the visible pin markers.
var _deepSearchSubAreas = null;
var _placesClickHandler = null;
var _regionFilter = 'all';

// Region mapping
var UF_REGIONS = {
  'N':['AC','AM','AP','PA','RO','RR','TO'],
  'NE':['AL','BA','CE','MA','PB','PE','PI','RN','SE'],
  'CO':['DF','GO','MS','MT'],
  'SE':['ES','MG','RJ','SP'],
  'S':['PR','RS','SC']
};

// State capitals
var BR_CAPITALS = {
  'AC':'Rio Branco','AL':'Maceió','AM':'Manaus','AP':'Macapá','BA':'Salvador',
  'CE':'Fortaleza','DF':'Brasília','ES':'Vitória','GO':'Goiânia','MA':'São Luís',
  'MG':'Belo Horizonte','MS':'Campo Grande','MT':'Cuiabá','PA':'Belém','PB':'João Pessoa',
  'PE':'Recife','PI':'Teresina','PR':'Curitiba','RJ':'Rio de Janeiro','RN':'Natal',
  'RO':'Porto Velho','RR':'Boa Vista','RS':'Porto Alegre','SC':'Florianópolis',
  'SE':'Aracaju','SP':'São Paulo','TO':'Palmas'
};

// Haversine distance in meters. Used to validate Phase 2 results against pin circles.
function haversineM(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var toRad = Math.PI / 180;
  var dLat = (lat2 - lat1) * toRad;
  var dLon = (lon2 - lon1) * toRad;
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) *
          Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}

// Returns true if (lat, lon) falls inside at least one pin circle.
// Circles already include a 10% tolerance (applied when captured in startPlacesDiscovery).
function isInsideAnyPinCircle(lat, lon, circles) {
  if (!circles || !circles.length) return true;
  for (var i = 0; i < circles.length; i++) {
    var c = circles[i];
    if (haversineM(lat, lon, c.lat, c.lon) <= c.radiusM) return true;
  }
  return false;
}

// ─── Name-match filter (opt-in) ─────────────────────────────────────────────
// Google's Text Search is semantic: "O Boticário" can return any cosmetics store
// the algorithm considers relevant. When the user expects a brand, we can post-
// filter Phase 2 results against the query tokens.

var _NAME_FILTER_STOP_WORDS = {
  'o':1,'a':1,'os':1,'as':1,'de':1,'do':1,'da':1,'dos':1,'das':1,
  'e':1,'em':1,'no':1,'na':1,'nos':1,'nas':1
};

// Lowercase, strip accents, replace non-alphanumeric with spaces, collapse whitespace.
function normalizeText(s) {
  if (!s) return '';
  return String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

// Extracts meaningful tokens from a query: >=3 chars, not a stop word.
function extractQueryTokens(query) {
  var normalized = normalizeText(query);
  if (!normalized) return [];
  return normalized.split(' ').filter(function(t) {
    return t.length >= 3 && !_NAME_FILTER_STOP_WORDS[t];
  });
}

// Resets Places Discovery-specific overlay fields (cache chip, segmented
// progress fills). Called by OTHER flows (Receita/CNPJ, Reverse Geocoding,
// Attack Plan, map load, nome refresh) when they open the shared
// geocoding-overlay, so residual state from a previous Places Discovery
// session doesn't bleed visually into their progress UI.
function _resetPlacesOverlayFields() {
  var cacheChip = document.getElementById('geo-cache');
  if (cacheChip) { cacheChip.style.display = 'none'; cacheChip.textContent = '💾 0'; }
  var fillMain = document.getElementById('geo-fill');
  if (fillMain) fillMain.style.width = '0%';
  var fillCache = document.getElementById('geo-fill-cache');
  if (fillCache) fillCache.style.width = '0%';
  var fillApi = document.getElementById('geo-fill-api');
  if (fillApi) fillApi.style.width = '0%';
}

// All tokens must be present in the place name (substring match, normalized).
// Empty/useless tokens list returns true (fail-open — don't over-filter on weird queries).
function matchesNameFilter(placeName, tokens) {
  if (!tokens || !tokens.length) return true;
  var normalized = normalizeText(placeName);
  if (!normalized) return false;
  for (var i = 0; i < tokens.length; i++) {
    if (normalized.indexOf(tokens[i]) === -1) return false;
  }
  return true;
}

// ─── Phase 1.5: Bulk cache lookup helpers ────────────────────────────────
// Read places_cache directly from Supabase before invoking the serverless
// proxy. The proxy still runs its own cache check as defense-in-depth, so
// any failure here degrades gracefully — we just lose the optimization
// for that request, never break the flow.
async function bulkCacheLookup(placeIds) {
  var hits = new Map();
  if (!placeIds || !placeIds.length) return hits;
  // URL safety: each place_id ~30 chars + comma. 200 IDs ~6.4k — well below
  // typical 8-16k URL limits at proxies/CDNs. Chunk to be safe.
  var CHUNK = 200;
  for (var i = 0; i < placeIds.length; i += CHUNK) {
    var slice = placeIds.slice(i, i + CHUNK);
    var idList = slice.map(encodeURIComponent).join(',');
    var url = SUPABASE_URL + '/rest/v1/places_cache?place_id=in.(' + idList + ')&select=place_id,name,address,lat,lon,types';
    try {
      var resp = await fetch(url, {
        headers: { 'apikey': SUPABASE_ANON, 'Accept': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });
      if (!resp.ok) continue;
      var rows = await resp.json();
      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        if (row && row.place_id) hits.set(row.place_id, row);
      }
    } catch (e) {
      // Network error / timeout — proxy cache check covers as fallback.
      console.warn('[bulk-cache] chunk failed:', e && e.message);
    }
  }
  return hits;
}

// Apply the same filters Phase 2 applies before pushing a place to allData.
// Returns { accepted, reason } where reason ∈ 'coords'|'radius'|'uf'|'name'|null.
// Caller decides how to increment counters based on reason.
function applyCachedPlaceFilters(row, allowedUFs, pinCircles, strictName, nameTokens) {
  if (row.lat == null || row.lon == null) return { accepted: false, reason: 'coords' };
  if (pinCircles && !isInsideAnyPinCircle(row.lat, row.lon, pinCircles)) {
    return { accepted: false, reason: 'radius' };
  }
  if (allowedUFs) {
    var addr = row.address || '';
    if (addr.indexOf('Brazil') === -1 && addr.indexOf('Brasil') === -1) return { accepted: false, reason: 'uf' };
    var placeUF = null;
    var m1 = addr.match(/- ([A-Z]{2}),/);
    if (m1) placeUF = m1[1];
    if (!placeUF) { var m2 = addr.match(/, ([A-Z]{2}),/); if (m2) placeUF = m2[1]; }
    if (!placeUF) {
      var _sn = STATE_NAME_TO_UF;
      var m3 = addr.match(/State of ([^,]+)/);
      if (m3 && _sn[m3[1]]) placeUF = _sn[m3[1]];
    }
    if (placeUF && !allowedUFs[placeUF]) return { accepted: false, reason: 'uf' };
    if (!placeUF && Object.keys(allowedUFs).length < 27) return { accepted: false, reason: 'uf' };
  }
  if (strictName && !matchesNameFilter(row.name, nameTokens)) {
    return { accepted: false, reason: 'name' };
  }
  return { accepted: true, reason: null };
}

function toggleAdvancedFilters() {
  var body = document.getElementById('places-filters-body');
  var icon = document.getElementById('filter-toggle-icon');
  var visible = body.style.display !== 'none';
  body.style.display = visible ? 'none' : 'block';
  icon.textContent = visible ? '▼' : '▲';
}

var _placesPanelMinimized = false;
function togglePlacesPanel() {
  var panel = document.getElementById('places-panel');
  var body = document.getElementById('places-panel-body');
  var title = document.getElementById('places-panel-title');
  var btn = document.getElementById('btn-minimize-panel');
  var header = panel ? panel.firstElementChild : null; // the header row div
  _placesPanelMinimized = !_placesPanelMinimized;
  if (_placesPanelMinimized) {
    // Minimizado: vira pill compacto (header só com ícone + chevron). Resetar
    // bottom é o que evita o painel virar uma coluna alta e vazia — sem isso
    // o `bottom: var(--gap-edge)` herdado força altura full-height mesmo com
    // o body escondido.
    body.style.display = 'none';
    panel.style.width = 'auto';
    panel.style.bottom = 'auto';
    panel.style.padding = '8px 10px 8px 14px';
    panel.style.borderRadius = 'var(--r-pill)';
    if (header) {
      header.style.marginBottom = '0';
      header.style.paddingBottom = '0';
      header.style.borderBottom = 'none';
      header.style.gap = '10px';
    }
    title.textContent = '🔎';
    title.style.fontSize = '14px';
    btn.textContent = '›';
    btn.title = 'Expandir painel';
  } else {
    body.style.display = '';
    panel.style.width = '340px';
    panel.style.bottom = 'var(--gap-edge)';
    panel.style.padding = '20px';
    panel.style.borderRadius = 'var(--r-xl)';
    if (header) {
      header.style.marginBottom = '14px';
      header.style.paddingBottom = '10px';
      header.style.borderBottom = '1px solid var(--glass-border)';
      header.style.gap = '8px';
    }
    title.textContent = '🔎 Places Discovery';
    title.style.fontSize = '13px';
    btn.textContent = '‹';
    btn.title = 'Minimizar painel';
  }
}

function setRegionFilter(region, el) {
  _regionFilter = region;
  document.querySelectorAll('#places-advanced-filters .state-chip[data-region]').forEach(function(c) { c.classList.remove('active'); });
  el.classList.add('active');
  updatePlacesEstimate();
}

async function showPlacesSetup() {
  document.getElementById('gallery-screen').classList.add('hidden');
  document.getElementById('upload-zone').classList.add('hidden');
  window._pendingMapType = 'places_discovery';
  window._pendingPeriodo = null;
  // Preload BR_CITIES em paralelo com setup do mapa
  ensureBRCities();
  // Clear previous data and map
  allData = []; filteredData = [];
  var appEl = document.getElementById('app');
  appEl.style.display = 'flex';
  applyMapMode('places_discovery');
  setTimeout(function() {
    if (!map) initMap();
    setTimeout(function() {
      if (map) {
        map.resize();
        // Clear previous pins from map
        if (map.getSource('pdvs')) {
          map.getSource('pdvs').setData({ type: 'FeatureCollection', features: [] });
        }
        map.jumpTo({ center: [-47.93, -15.78], zoom: 4 });
      }
    }, 100);
  }, 50);
  _selectedStates.clear();
  clearAllPins();
  _placesMode = 'states';
  document.getElementById('places-query-input').value = '';
  document.getElementById('places-map-name').value = '';
  document.getElementById('places-setup-error').style.display = 'none';
  document.getElementById('places-results-section').style.display = 'none';
  document.getElementById('places-cost-info').style.display = 'none';
  document.getElementById('places-panel').style.display = 'block';
  setPlacesMode('states');
  buildStateGrid();
  updatePlacesEstimate();
}

function setPlacesMode(mode) {
  _placesMode = mode;
  document.getElementById('ptab-pin').classList.toggle('active', mode === 'pin');
  document.getElementById('ptab-states').classList.toggle('active', mode === 'states');
  document.getElementById('ptab-country').classList.toggle('active', mode === 'country');
  document.getElementById('places-pin-controls').style.display = mode === 'pin' ? 'block' : 'none';
  document.getElementById('places-states-controls').style.display = mode === 'states' ? 'block' : 'none';
  document.getElementById('places-country-controls').style.display = mode === 'country' ? 'block' : 'none';
  document.getElementById('places-advanced-filters').style.display = (mode === 'states' || mode === 'country') ? 'block' : 'none';
  // Region filter only makes sense in Brasil mode
  var regionRow = document.getElementById('filter-region-row');
  if (regionRow) regionRow.style.display = mode === 'country' ? 'block' : 'none';
  if (mode === 'pin') { enablePinMode(); } else { disablePinMode(); }
  // Clear states when switching away from states/country
  if (mode === 'pin') {
    _selectedStates.clear();
    document.querySelectorAll('.state-chip[data-uf]').forEach(function(c) { c.classList.remove('active'); });
  }
  if (mode === 'states') {
    _selectedStates.clear();
    document.querySelectorAll('.state-chip[data-uf]').forEach(function(c) { c.classList.remove('active'); });
  }
  if (mode === 'country') {
    var allUFs = Object.keys(BR_STATES).filter(function(k) { return k !== 'BR'; });
    _selectedStates.clear();
    allUFs.forEach(function(u) { _selectedStates.add(u); });
  }
  updatePlacesEstimate();
}

function enablePinMode() {
  // When Places Discovery opens, setPlacesMode('pin') fires synchronously while
  // initMap() is still inside a setTimeout. On that first call map is null and
  // the original early-return left the click handler unregistered — users had
  // to switch to Estados and back to Pin+Raio to "wake it up". Poll briefly
  // until the map exists, then re-enter.
  if (!map) {
    if (window._enablePinDeferred) return;
    window._enablePinDeferred = true;
    var attempts = 0;
    var poll = setInterval(function() {
      attempts++;
      if (map) {
        clearInterval(poll);
        window._enablePinDeferred = false;
        if (_placesMode === 'pin') enablePinMode();
      } else if (attempts >= 50) {  // ~7.5s safety cap
        clearInterval(poll);
        window._enablePinDeferred = false;
        console.warn('[places] map never became available; pin mode could not be enabled');
      }
    }, 150);
    return;
  }
  map.getCanvas().style.cursor = 'crosshair';
  if (_placesClickHandler) map.off('click', _placesClickHandler);
  _placesClickHandler = function(e) {
    // Defensive: layers may not exist yet if _setupMapSources hasn't run.
    // Treat any error from queryRenderedFeatures as "no features", which lets
    // the user drop a pin even on a fresh map with no PDV layers yet.
    var features = [];
    try { features = map.queryRenderedFeatures(e.point, { layers: ['pdv-points', 'clusters'] }); }
    catch(err) { features = []; }
    if (features.length > 0) return;
    addRadiusPin(e.lngLat.lat, e.lngLat.lng);
  };
  map.on('click', _placesClickHandler);
}

function disablePinMode() {
  if (!map) return;
  map.getCanvas().style.cursor = 'grab';
  if (_placesClickHandler) { map.off('click', _placesClickHandler); _placesClickHandler = null; }
}

function addRadiusPin(lat, lon, opts) {
  // opts.historical=true: pin restaurado de mapa salvo. Mantém o marker + dados
  // em _radiusPins (Aprofundar busca precisa), mas NÃO desenha o círculo de
  // raio — pra mapa de visualização, o disco grande translúcido competia com
  // os clusters dos places. Pra search ativa, o círculo continua mostrando a
  // área que o user tá prestes a buscar.
  var historical = !!(opts && opts.historical);
  var radiusKm = parseFloat(document.getElementById('pin-radius-km').value) || 5;
  var pinData = { lat: +lat.toFixed(5), lon: +lon.toFixed(5), radiusKm: radiusKm, marker: null, circleId: null };
  var el = document.createElement('div');
  el.style.cssText = 'width:14px;height:14px;background:var(--accent);border:2px solid var(--text-on-accent);border-radius:50%;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5);';
  pinData.marker = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
  if (!historical) {
    var idx = _radiusPins.length;
    pinData.circleId = 'places-circle-' + idx + '-' + Date.now();
    var circle = generateCircleGeoJSON(lat, lon, radiusKm);
    if (map.isStyleLoaded()) {
      map.addSource(pinData.circleId, { type: 'geojson', data: circle });
      map.addLayer({ id: pinData.circleId, type: 'fill', source: pinData.circleId, paint: { 'fill-color': _cssVar('--accent'), 'fill-opacity': 0.12 } });
    }
  }
  _radiusPins.push(pinData);
  renderRadiusPinTags();
  updatePlacesEstimate();
}

function removeRadiusPin(idx) {
  var pin = _radiusPins[idx];
  if (pin) {
    if (pin.marker) pin.marker.remove();
    if (pin.circleId && map) {
      try { if (map.getLayer(pin.circleId)) map.removeLayer(pin.circleId); } catch(e) {}
      try { if (map.getSource(pin.circleId)) map.removeSource(pin.circleId); } catch(e) {}
    }
  }
  _radiusPins.splice(idx, 1);
  renderRadiusPinTags();
  updatePlacesEstimate();
}

function clearAllPins() {
  while (_radiusPins.length > 0) {
    var pin = _radiusPins.pop();
    if (pin.marker) pin.marker.remove();
    if (pin.circleId && map) {
      try { if (map.getLayer(pin.circleId)) map.removeLayer(pin.circleId); } catch(e) {}
      try { if (map.getSource(pin.circleId)) map.removeSource(pin.circleId); } catch(e) {}
    }
  }
  renderRadiusPinTags();
  updatePlacesEstimate();
}

function renderRadiusPinTags() {
  var list = document.getElementById('radius-pins-list');
  var clearBtn = document.getElementById('btn-clear-pins');
  if (!list) return;
  list.innerHTML = _radiusPins.map(function(p, i) {
    return '<span class="radius-pin-tag">' + p.lat.toFixed(3) + ', ' + p.lon.toFixed(3) + ' \u00b7 ' + p.radiusKm + 'km <button onclick="removeRadiusPin(' + i + ')">\u00d7</button></span>';
  }).join('');
  if (clearBtn) clearBtn.style.display = _radiusPins.length > 0 ? 'block' : 'none';
}

function buildStateGrid() {
  var grid = document.getElementById('state-grid');
  if (!grid) return;
  var stateKeys = Object.keys(BR_STATES).filter(function(k) { return k !== 'BR'; });
  grid.innerHTML = stateKeys.map(function(k) {
    return '<button class="state-chip" data-uf="' + k + '" onclick="toggleState(\'' + k + '\',this)">' + k + '</button>';
  }).join('');
}

function toggleState(uf, el) {
  if (_selectedStates.has(uf)) { _selectedStates.delete(uf); el.classList.remove('active'); }
  else { _selectedStates.add(uf); el.classList.add('active'); }
  updatePlacesEstimate();
}

function generateCircleGeoJSON(lat, lon, radiusKm) {
  var pts = 64, coords = [];
  for (var i = 0; i <= pts; i++) {
    var angle = (i / pts) * 2 * Math.PI;
    var dLat = (radiusKm / 111.32) * Math.cos(angle);
    var dLon = (radiusKm / (111.32 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
    coords.push([lon + dLon, lat + dLat]);
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } };
}


async function getSearchAreas() {
  if (_placesMode === 'pin') {
    // Deep search injects a pre-computed sub-grid; bypass _radiusPins to avoid
    // disturbing the visible pin markers while still feeding the same pipeline.
    if (_deepSearchSubAreas && _deepSearchSubAreas.length > 0) {
      return { mode: 'pin', areas: _deepSearchSubAreas.slice() };
    }
    return { mode: 'pin', areas: _radiusPins.map(function(p) { return { lat: p.lat, lon: p.lon, radiusM: p.radiusKm * 1000 }; }) };
  }
  await ensureBRCities();
  var states = _placesMode === 'country' ? Object.keys(BR_STATES).filter(function(k) { return k !== 'BR'; }) : Array.from(_selectedStates);
  var capitalsOnly = document.getElementById('capitals-only')?.checked || false;
  if (_placesMode === 'states' && states.length === 0 && capitalsOnly) {
    states = Object.keys(BR_STATES).filter(function(k) { return k !== 'BR'; });
  }
  if (_regionFilter !== 'all') {
    var regionUFs = UF_REGIONS[_regionFilter] || [];
    states = states.filter(function(uf) { return regionUFs.indexOf(uf) >= 0; });
  }
  var minPop = (parseInt(document.getElementById('pop-filter')?.value) || 20) * 1000;
  
  var tasks = [], cityCount = 0, quadrantCount = 0;
  states.forEach(function(uf) {
    var st = BR_STATES[uf];
    if (!st) return;
    var cities = BR_CITIES[uf] || [];
    cities.forEach(function(c) {
      if (c[1] < minPop) return;
      if (capitalsOnly && c[0] !== BR_CAPITALS[uf]) return;
      cityCount++;
      // Normal city task (text query with city name)
      tasks.push({ label: c[0], uf: uf, cityName: c[0] });
      
      // HYBRID: For capitals >1M, add geographic quadrants for deeper coverage
      // The text query gets top 60 results, quadrants find places the text query missed
      var isCapital = c[0] === BR_CAPITALS[uf];
      if (isCapital && c[1] >= 1000000 && st.lat && st.lon) {
        var span = c[1] > 5000000 ? 0.25 : c[1] > 2000000 ? 0.18 : 0.12;
        var quads = [
          { s: st.lat - span, n: st.lat, w: st.lon - span, e: st.lon },         // SW
          { s: st.lat - span, n: st.lat, w: st.lon, e: st.lon + span },          // SE
          { s: st.lat, n: st.lat + span, w: st.lon - span, e: st.lon },          // NW
          { s: st.lat, n: st.lat + span, w: st.lon, e: st.lon + span },          // NE
        ];
        quads.forEach(function(q, qi) {
          quadrantCount++;
          tasks.push({
            label: c[0] + ' Q' + (qi+1),
            uf: uf,
            cityName: null,  // No city name — use only bbox
            bbox: { south: q.s, north: q.n, west: q.w, east: q.e }
          });
        });
      }
    });
  });
  return { mode: 'cities', tasks: tasks, states: states, cityCount: cityCount, quadrantCount: quadrantCount };
}

async function updatePlacesEstimate() {
  var est = document.getElementById('places-estimate');
  var txt = document.getElementById('places-est-text');
  var runBtn = document.getElementById('places-run-btn');
  var query = (document.getElementById('places-query-input') || {}).value || '';
  query = query.trim();
  var hasArea = false;
  var areaLabel = '';
  if (_placesMode === 'pin') {
    hasArea = _radiusPins.length > 0;
    areaLabel = _radiusPins.length + ' pin' + (_radiusPins.length !== 1 ? 's' : '');
  } else {
    // Use getSearchAreas to get the FILTERED city list
    var config = await getSearchAreas();
    hasArea = config.tasks.length > 0;
    areaLabel = config.states.length + ' estado' + (config.states.length !== 1 ? 's' : '') + ' \u00b7 ' + config.cityCount + ' cidades' + (config.quadrantCount > 0 ? ' + ' + config.quadrantCount + ' quadrantes' : '');
  }
  if (!hasArea || !query) { est.classList.remove('visible'); runBtn.disabled = true; document.getElementById('places-cost-info').style.display = 'none'; return; }
  est.classList.add('visible');
  document.getElementById('places-cost-info').style.display = 'block';
  if (_placesMode === 'pin') {
    var estPlaces = _radiusPins.length * 50;
    txt.innerHTML = areaLabel + ' · ~<span class="est-highlight">' + estPlaces.toLocaleString('pt-BR') + '</span> places est. · Custo: <span class="est-highlight">gr\u00e1tis</span>';
  } else {
    txt.innerHTML = '<span class="est-highlight">' + areaLabel + '</span> · busca por cidade · Custo: <span class="est-highlight">gr\u00e1tis</span>';
  }
  runBtn.disabled = false;
  var nameInput = document.getElementById('places-map-name');
  if (nameInput && !nameInput._userEdited) {
    var ml = _placesMode === 'pin' ? _radiusPins.length + ' pins' : _placesMode === 'country' ? 'Brasil' : Array.from(_selectedStates).slice(0,4).join(', ');
    nameInput.value = query + ' \u2014 ' + ml;
  }
}

var _appendMode = false; // When true, keeps existing data and deduplicates

function startExpandSearch() {
  _appendMode = true;
  // Hide results, show search form
  document.getElementById('places-results-section').style.display = 'none';
  
  // Restore search context from saved payload if available
  var payload = window._savedMapPayload;
  var restoredContext = false;
  
  if (payload && payload.search_query) {
    // Restore query
    var qInput = document.getElementById('places-query-input');
    if (qInput && !qInput.value.trim()) qInput.value = payload.search_query;
    
    // Restore search mode
    if (payload.search_mode && payload.search_mode !== 'pin') {
      setPlacesMode(payload.search_mode);
      
      if (payload.search_mode === 'country') {
        // setPlacesMode('country') already populates all 27 states
        restoredContext = true;
      } else if (payload.search_states && payload.search_states.length > 0) {
        // States mode — restore specific states
        _selectedStates.clear();
        payload.search_states.forEach(function(uf) {
          _selectedStates.add(uf);
          var chip = document.querySelector('.state-chip[data-uf="' + uf + '"]');
          if (chip) chip.classList.add('active');
        });
        restoredContext = true;
      }
    } else {
      // Pin mode — reset for new pin placement
      setPlacesMode('pin');
      if (payload.search_radius_km) {
        var radInput = document.getElementById('pin-radius-km');
        if (radInput) radInput.value = payload.search_radius_km;
      }
    }
  } else {
    // No saved context — reset mode selection
    _selectedStates.clear();
    document.querySelectorAll('.state-chip[data-uf]').forEach(function(c) { c.classList.remove('active'); });
  }
  
  document.getElementById('places-estimate').classList.remove('visible');
  document.getElementById('places-cost-info').style.display = 'none';
  document.getElementById('places-run-btn').disabled = true;
  document.getElementById('places-setup-error').style.display = 'none';
  
  // Show hint
  var errEl = document.getElementById('places-setup-error');
  var hint = '➕ Modo expansão: novos places serão adicionados ao mapa atual (' + allData.length + ' existentes). Duplicados serão ignorados sem custo.';
  if (restoredContext) {
    hint += '\n📋 Configuração original restaurada. Ajuste estados/área se necessário.';
  } else if (!payload?.search_query) {
    hint += '\n⚠ Configuração original não disponível — preencha a busca e selecione a área.';
  }
  errEl.textContent = hint;
  errEl.style.display = 'block';
  errEl.style.color = 'var(--accent-light)';
  errEl.style.whiteSpace = 'pre-line';
  
  // Trigger estimate update (will enable run button if states were restored)
  if (restoredContext) updatePlacesEstimate();
}

// Synonyms for common pt-BR category queries. When Aprofundar busca runs with
// a query that matches one of these keys (normalized), the deep search iterates
// over the variations too, dramatically increasing coverage. Google treats each
// term as a partially-disjoint set — "açougue" alone tops out at ~130 places in
// SP centro, but with variations it reaches ~430. Marca/brand queries should
// NOT have variations (no entry → falls through to single-query behavior).
var _PLACES_VARIATIONS = {
  'acougue': ['Casa de carnes', 'Frigorífico', 'Boutique de carnes', 'Carnes'],
  'padaria': ['Panificadora', 'Panificação', 'Padaria artesanal', 'Casa do pão'],
  'farmacia': ['Drogaria', 'Drogasil', 'Farmácia popular', 'Drogaria popular'],
  'pet shop': ['Petshop', 'Agropet', 'Casa de rações', 'Clínica veterinária'],
  'restaurante': ['Lanchonete', 'Bistrô', 'Cantina', 'Comida brasileira', 'Self-service'],
  'supermercado': ['Mercado', 'Mercadinho', 'Hortifruti', 'Empório', 'Atacarejo'],
  'posto de gasolina': ['Posto', 'Conveniência', 'Posto de combustível'],
  'bar': ['Boteco', 'Pub', 'Cervejaria', 'Choperia'],
  'sorveteria': ['Açaí', 'Gelateria', 'Casa de sorvetes'],
  'pizzaria': ['Pizza', 'Rodízio de pizza'],
  'salao de beleza': ['Cabeleireiro', 'Barbearia', 'Salão', 'Studio de beleza'],
  'academia': ['Crossfit', 'Studio de pilates', 'Box de crossfit'],
  'escola': ['Colégio', 'Educação infantil', 'Berçário'],
  'clinica': ['Consultório', 'Clínica médica', 'Centro médico'],
  'oficina': ['Mecânica', 'Auto center', 'Oficina mecânica'],
};

// Returns [originalQuery, ...variations] if the normalized query matches a known
// category; otherwise returns [originalQuery] (single-query behavior preserved
// for brand names and unknown terms).
function _lookupQueryVariations(query) {
  var orig = (query || '').trim();
  if (!orig) return [];
  // Normalize: lowercase + strip accents + collapse spaces
  var norm = orig.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ').trim();
  var variations = _PLACES_VARIATIONS[norm];
  if (!variations) return [orig];
  // Dedupe in case the dictionary itself contains the original (case-insensitive)
  var all = [orig];
  for (var i = 0; i < variations.length; i++) {
    var v = variations[i];
    var vNorm = v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    if (vNorm !== norm) all.push(v);
  }
  return all;
}

// Generate a 3x3 sub-pin grid that tiles a parent pin's circle. Each sub-pin
// has a smaller radius (R/2.5) and centers are offset by R*0.6 — chosen to
// give meaningful overlap while keeping sub-areas small enough that the Google
// Places ranking re-prioritizes hyperlocal results. Returns { lat, lon, radiusM }.
// Empirical estimates per pin (parent radius ~20km, dense urban area like SP centro).
// Used to populate the cost preview in the Aprofundar busca modal. Values are
// upper bounds — cache hits in places_cache reduce the real cost significantly.
var DEEP_SEARCH_PRESETS = {
  3: { label: 'Leve',       estPerPin: 180  },
  5: { label: 'Médio',      estPerPin: 470  },
  7: { label: 'Profundo',   estPerPin: 830  },
  9: { label: 'Exaustivo',  estPerPin: 1350 },
};

// Build an NxN sub-pin grid that tiles the parent circle. The Google Places
// ranking is recomputed per sub-area, so hyperlocal results that were drowned
// out by globally dominant ones in the original radius surface here.
// Formula validated empirically: offset = 2*parentR/(N-1), subR = offset/2
// gives the best IDs-per-call ratio (180/470/868/1354 unique IDs for N=3/5/7/9
// at parent radius 20km in SP centro for the query "Açougue").
function _generateDeepSearchGrid(centerLat, centerLon, parentRadiusKm, gridN) {
  gridN = gridN || 3;
  if (gridN < 2) gridN = 3;
  var offsetKm = (2 * parentRadiusKm) / (gridN - 1);
  var subRadiusKm = Math.max(offsetKm / 2, 1);
  var dLatDeg = offsetKm / 111.32;
  var dLonDeg = offsetKm / (111.32 * Math.cos(centerLat * Math.PI / 180));
  var areas = [];
  var half = (gridN - 1) / 2;
  for (var i = 0; i < gridN; i++) {
    for (var j = 0; j < gridN; j++) {
      var dy = i - half, dx = j - half;
      areas.push({
        lat: +(centerLat + dy * dLatDeg).toFixed(5),
        lon: +(centerLon + dx * dLonDeg).toFixed(5),
        radiusM: subRadiusKm * 1000,
      });
    }
  }
  return areas;
}

// Aprofundar busca: subdivide each existing pin into a 3x3 sub-grid and run
// the same pipeline in append mode. The Google Places ranking is recomputed
// per sub-area, so hyperlocal results that were drowned out by globally
// dominant ones in the original radius surface here.
async function startDeepSearch() {
  // Source pins: prefer visible _radiusPins; fall back to saved payload pins
  // if user reloaded a saved map (pins aren't restored visually today).
  var sourcePins = [];
  if (_radiusPins && _radiusPins.length > 0) {
    sourcePins = _radiusPins.map(function(p) { return { lat: p.lat, lon: p.lon, radiusKm: p.radiusKm }; });
  } else if (window._savedMapPayload && Array.isArray(window._savedMapPayload.search_pins) && window._savedMapPayload.search_pins.length > 0) {
    sourcePins = window._savedMapPayload.search_pins.map(function(p) {
      return { lat: p.lat, lon: p.lon, radiusKm: p.radiusKm || window._savedMapPayload.search_radius_km || 5 };
    });
  }
  if (sourcePins.length === 0) {
    alert('Não há pins ativos para aprofundar. Posicione pelo menos um pin e refaça a busca, ou use "Expandir busca" para adicionar novas áreas.');
    return;
  }
  // Recover the original query
  var qInput = document.getElementById('places-query-input');
  var query = (qInput && qInput.value || '').trim();
  if (!query && window._savedMapPayload && window._savedMapPayload.search_query) {
    query = window._savedMapPayload.search_query;
    if (qInput) qInput.value = query;
  }
  if (!query) {
    alert('Não foi possível recuperar a query original. Digite o termo de busca e tente novamente.');
    return;
  }
  // Look up category variations. If the query is a known generic term (açougue,
  // padaria, etc.), iterate over synonyms too. For brand/name queries with no
  // dictionary entry, falls through to single-query behavior automatically.
  var queryVariations = _lookupQueryVariations(query);
  var hasVariations = queryVariations.length > 1;
  // Grid size fixed at 5x5 (Médio) — sweet spot of coverage vs cost. The depth
  // selector was removed in favor of a single Aprofundar busca button.
  var gridN = 5;
  var preset = DEEP_SEARCH_PRESETS[gridN];
  // Build sub-grid: for each pin × each query variation, add an entry with
  // a per-area `query` field. The pin-mode loop in startPlacesDiscovery reads
  // area.query and falls back to the global query when absent (backwards-compat
  // with non-deep searches).
  var subAreas = [];
  sourcePins.forEach(function(p) {
    var grid = _generateDeepSearchGrid(p.lat, p.lon, p.radiusKm, gridN);
    queryVariations.forEach(function(q) {
      for (var i = 0; i < grid.length; i++) {
        subAreas.push({ lat: grid[i].lat, lon: grid[i].lon, radiusM: grid[i].radiusM, query: q });
      }
    });
  });
  // Confirmation with cost estimate. Place Details Pro = $0.017/req; cache hit
  // rate is unknown at this point so we present an upper bound only.
  var totalCalls = subAreas.length;
  // Empirical per-pin yields (SP centro, parent radius 20km, single query):
  //   3x3 → ~180, 5x5 → ~470, 7x7 → ~830, 9x9 → ~1350 unique IDs
  // Multi-query variations overlap ~60% with each other, so each extra
  // variation contributes roughly 40% of its solo yield on top.
  var basePerPin = preset.estPerPin;
  var multiQueryBonus = hasVariations ? 1 + 0.4 * (queryVariations.length - 1) : 1;
  var estimateNewPlaces = Math.round(basePerPin * multiQueryBonus * sourcePins.length);
  var estimateMaxCostUSD = (estimateNewPlaces * 0.017).toFixed(2);
  var msg = 'Aprofundar busca\n\n';
  msg += '• Profundidade: ' + preset.label + ' (grid ' + gridN + 'x' + gridN + ', ' + (gridN * gridN) + ' sub-pins por pin)\n';
  msg += '• Pins originais: ' + sourcePins.length + '\n';
  if (hasVariations) {
    msg += '• Variações detectadas: ' + queryVariations.length + ' (' + queryVariations.slice(0, 3).join(', ') + (queryVariations.length > 3 ? '…' : '') + ')\n';
  }
  msg += '• Sub-buscas totais: ' + totalCalls + '\n';
  msg += '• Estimativa: ~' + estimateNewPlaces + ' places novos\n';
  msg += '• Custo máximo estimado: ~$' + estimateMaxCostUSD + ' (Place Details $0.017/req)\n';
  msg += '• Custo real costuma ser bem menor pelo cache permanente\n\n';
  msg += 'Continuar?';
  if (!confirm(msg)) return;
  // Wire append mode and inject sub-grid. _deepSearchSubAreas is consumed by
  // getSearchAreas(); finishPlacesDiscovery clears it on completion.
  _appendMode = true;
  _deepSearchSubAreas = subAreas;
  // Ensure pin mode is active so the pipeline takes the pin code path
  if (_placesMode !== 'pin') {
    _placesMode = 'pin';
  }
  // Hide results section so the overlay takes over
  document.getElementById('places-results-section').style.display = 'none';
  document.getElementById('places-panel').style.display = 'block';
  document.getElementById('places-setup-error').style.display = 'none';
  // Kick off the same pipeline used by the main search button
  await startPlacesDiscovery();
}

async function startPlacesDiscovery() {
  var query = (document.getElementById('places-query-input').value || '').trim();
  var mapName = (document.getElementById('places-map-name').value || '').trim();
  var errEl = document.getElementById('places-setup-error');
  errEl.style.color = ''; // Reset color from expand hint
  if (!query) { errEl.textContent = 'Digite o tipo de estabelecimento.'; errEl.style.display = 'block'; return; }
  if (!mapName && !_appendMode) { errEl.textContent = 'Dê um nome ao mapa.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';
  var searchConfig = await getSearchAreas();
  if (searchConfig.mode === 'pin' && searchConfig.areas.length === 0) { errEl.textContent = 'Adicione pins no mapa.'; errEl.style.display = 'block'; return; }
  if (searchConfig.mode === 'cities' && searchConfig.tasks.length === 0) { errEl.textContent = 'Selecione pelo menos um estado.'; errEl.style.display = 'block'; return; }
  document.getElementById('places-panel').style.display = 'none';
  disablePinMode();
  // Snapshot search context for save payload
  window._placesSearchQuery = query;
  window._placesSearchMode = _placesMode;
  window._placesSearchStates = Array.from(_selectedStates);
  if (!_appendMode) {
    window._pendingMapName = mapName;
    window._pendingMapDesc = 'Places Discovery: "' + query + '"';
    window._pendingMapType = 'places_discovery';
    allData = []; filteredData = [];
    if (map && map.getSource('pdvs')) map.getSource('pdvs').setData({ type: 'FeatureCollection', features: [] });
  }
  var overlay = document.getElementById('geocoding-overlay');
  document.getElementById('geo-title-text').textContent = 'Buscando Places';
  overlay.classList.add('active');
  document.getElementById('geo-current').textContent = _appendMode ? 'Expandindo busca...' : 'Preparando busca...';
  document.getElementById('geo-fill').style.width = '0%';
  document.getElementById('geo-fill-cache').style.width = '0%';
  document.getElementById('geo-fill-api').style.width = '0%';
  document.getElementById('geo-pct').textContent = '0%';
  document.getElementById('geo-ok').textContent = '';
  document.getElementById('geo-fail').textContent = '';
  document.getElementById('geo-eta').textContent = '';
  var cacheChipEl = document.getElementById('geo-cache');
  if (cacheChipEl) { cacheChipEl.style.display = 'none'; cacheChipEl.textContent = '💾 0'; }
  _placesDiscoveryCancelled = false;
  _placesApiErrors = [];
  geocodingActive = true;
  window._unloadHandler = function(e) { if (geocodingActive) { e.preventDefault(); return e.returnValue = 'Busca em andamento.'; } };
  window.addEventListener('beforeunload', window._unloadHandler);
  
  // Build set of existing place_ids to skip in Phase 2 (saves API credits)
  var seenIds = {};
  var existingCount = 0;
  if (_appendMode) {
    allData.forEach(function(r) { if (r.place_id) { seenIds[r.place_id] = true; existingCount++; } });
  }
  var found = 0, errors = 0, filtered = 0, skippedDupes = 0;
  var filteredByRadius = 0; // Pin mode: places returned outside the requested radius
  var filteredByName = 0; // Opt-in: places whose name didn't match the query tokens
  // places_cache transparency counters (aggregated from proxy responses during Phase 2)
  var cacheHits = 0, apiFetched = 0;
  var startTime = Date.now(), allPlaceIds = [];
  // Store allowed UFs for Phase 2 filtering (only for city/state mode)
  var allowedUFs = null;
  if (searchConfig.mode === 'cities') {
    allowedUFs = {};
    searchConfig.states.forEach(function(uf) { allowedUFs[uf] = true; });
  }
  window._allowedUFs = allowedUFs; // Store for retry function
  // Pin mode: keep the circles around for post-details haversine validation.
  // Small 10% tolerance on radius to account for Google's geocoding jitter.
  var pinCircles = null;
  if (searchConfig.mode === 'pin') {
    pinCircles = searchConfig.areas.map(function(a) {
      return { lat: a.lat, lon: a.lon, radiusM: a.radiusM * 1.1 };
    });
  }
  window._pinCircles = pinCircles;
  // Opt-in strict name filter: only keep places whose name contains the query tokens.
  var strictNameEl = document.getElementById('strict-name-filter');
  var strictName = !!(strictNameEl && strictNameEl.checked);
  var nameTokens = strictName ? extractQueryTokens(query) : [];
  // If strict is on but the query had no meaningful tokens (e.g. "O"), fall back to off.
  if (strictName && !nameTokens.length) strictName = false;
  window._strictNameTokens = nameTokens;

  if (searchConfig.mode === 'pin') {
    // PIN MODE: search each pin area
    var areas = searchConfig.areas;
    var total = areas.length;
    for (var ai = 0; ai < areas.length; ai++) {
      if (_placesDiscoveryCancelled) break;
      var area = areas[ai], pageToken = null, pages = 0;
      // Deep search injects a per-area query (multi-query mode). For regular
      // searches and single-query deep searches, area.query is undefined and
      // we fall back to the global query read from the input field.
      var areaQuery = area.query || query;
      do {
        try {
          var resp = await fetch('/api/places-search', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'textSearch', query: areaQuery, lat:area.lat, lon:area.lon, radius:area.radiusM, pageToken:pageToken }) });
          var data = await resp.json();
          if (resp.ok && data.placeIds) { for (var pi=0;pi<data.placeIds.length;pi++) { var pid=data.placeIds[pi]; if(!seenIds[pid]){seenIds[pid]=true;allPlaceIds.push(pid);}else{skippedDupes++;} } pageToken=data.nextPageToken; }
          else {
            console.error('[places-search] textSearch failed (pin mode)', { status: resp.status, error: data && data.error, query: areaQuery, area: area });
            _placesApiErrors.push({ status: resp.status, error: (data && data.error) || 'unknown', phase: 'textSearch', mode: 'pin' });
            errors++; pageToken=null;
          }
        } catch(e) {
          console.error('[places-search] textSearch network error (pin mode)', e, { query: areaQuery, area: area });
          _placesApiErrors.push({ status: 0, error: (e && e.message) || 'network', phase: 'textSearch', mode: 'pin' });
          errors++; pageToken=null;
        }
        pages++;
      } while (pageToken && pages < 3 && !_placesDiscoveryCancelled);
      var pv = Math.round((ai+1)/total*50);
      document.getElementById('geo-fill').style.width = pv+'%';
      document.getElementById('geo-pct').textContent = pv+'%';
      document.getElementById('geo-ok').textContent = allPlaceIds.length+' novos';
      var dupLabel = _appendMode ? ' já no mapa' : ' dup';
      document.getElementById('geo-current').textContent = 'Buscando: '+(ai+1)+'/'+total+' · '+allPlaceIds.length+' novos' + (skippedDupes > 0 ? ' · ' + skippedDupes + dupLabel : '');
      await new Promise(function(r){setTimeout(r,50);});
    }
  } else {
    // CITY/TASK MODE: PARALLEL search (concurrency pool of 8)
    var tasks = searchConfig.tasks;
    var total = tasks.length;
    var CONCURRENCY = 4;
    var completed = 0;
    
    async function runTask(task) {
      if (_placesDiscoveryCancelled) return;
      // HYBRID: city tasks use text query, quadrant tasks use bbox
      var taskQuery;
      if (task.cityName) {
        taskQuery = query + ', ' + task.cityName + ', ' + task.uf;
      } else {
        taskQuery = query;  // Quadrant mode: just the search term + bbox
      }
      var pageToken = null, pages = 0;
      do {
        var searchBody = { action:'textSearch', query: taskQuery, pageToken:pageToken };
        // Quadrant tasks send bbox for locationRestriction
        if (task.bbox) {
          searchBody.bbox = task.bbox;
        }
        var success = false;
        for (var attempt = 0; attempt < 2 && !success; attempt++) {
          try {
            var resp = await fetch('/api/places-search', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(searchBody) });
            var data = await resp.json();
            if (resp.ok && data.placeIds) {
              for (var pi=0;pi<data.placeIds.length;pi++) { var pid=data.placeIds[pi]; if(!seenIds[pid]){seenIds[pid]=true;allPlaceIds.push(pid);}else{skippedDupes++;} }
              pageToken=data.nextPageToken; success=true;
            } else if (resp.status === 429 && attempt === 0) {
              await new Promise(function(r){setTimeout(r,1000);}); // Wait 1s and retry
            } else {
              console.error('[places-search] textSearch failed (city/quadrant mode)', { status: resp.status, error: data && data.error, query: taskQuery, task: task && task.label });
              _placesApiErrors.push({ status: resp.status, error: (data && data.error) || 'unknown', phase: 'textSearch', mode: 'task' });
              errors++; pageToken=null; success=true;
            }
          } catch(e) {
            if (attempt === 0) { await new Promise(function(r){setTimeout(r,500);}); }
            else {
              console.error('[places-search] textSearch network error (city/quadrant mode)', e, { query: taskQuery, task: task && task.label });
              _placesApiErrors.push({ status: 0, error: (e && e.message) || 'network', phase: 'textSearch', mode: 'task' });
              errors++; pageToken=null; success=true;
            }
          }
        }
        pages++;
      } while (pageToken && pages < 3 && !_placesDiscoveryCancelled);
      completed++;
      var pv = Math.round(completed/total*50);
      document.getElementById('geo-fill').style.width = pv+'%';
      document.getElementById('geo-pct').textContent = pv+'%';
      document.getElementById('geo-ok').textContent = allPlaceIds.length+' novos';
      var dupLabel = _appendMode ? ' já no mapa' : ' dup';
      document.getElementById('geo-current').textContent = task.label+'/'+task.uf+' ('+completed+'/'+total+') · '+allPlaceIds.length+' novos' + (skippedDupes > 0 ? ' · ' + skippedDupes + dupLabel : '');
    }
    
    // Process tasks in parallel batches of CONCURRENCY
    for (var bi = 0; bi < tasks.length; bi += CONCURRENCY) {
      if (_placesDiscoveryCancelled) break;
      var batch = tasks.slice(bi, bi + CONCURRENCY);
      await Promise.all(batch.map(runTask));
    }
  }

  if (_placesDiscoveryCancelled) { finishPlacesDiscovery(); return; }

  // Phase 1.5: Bulk cache hydration
  // Query places_cache once for all collected IDs. Hits are pushed to allData
  // immediately (after applying the same filters Phase 2 applies), and only
  // misses proceed to the serverless proxy. Reduces proxy invocations and
  // round-trips drastically when cache hit rate is high.
  // Failure modes (network, timeout, partial chunks) degrade gracefully —
  // the proxy retains its own cache check as defense-in-depth.
  if (allPlaceIds.length > 0) {
    document.getElementById('geo-current').textContent = 'Verificando cache (' + allPlaceIds.length + ' places)...';
    try {
      var cacheMap = await bulkCacheLookup(allPlaceIds);
      if (cacheMap.size > 0) {
        var remaining = [];
        var bulkCacheHydrated = 0;
        for (var ip = 0; ip < allPlaceIds.length; ip++) {
          var pid = allPlaceIds[ip];
          var row = cacheMap.get(pid);
          if (!row) { remaining.push(pid); continue; }
          var fr = applyCachedPlaceFilters(row, allowedUFs, pinCircles, strictName, nameTokens);
          if (!fr.accepted) {
            if (fr.reason === 'radius') filteredByRadius++;
            else if (fr.reason === 'name') filteredByName++;
            else if (fr.reason === 'uf') filtered++;
            // 'coords' = silently skipped (corrupt cache row); proxy would also skip
            continue;
          }
          var typesArr = Array.isArray(row.types) ? row.types : [];
          allData.push({
            nome: row.name || '',
            bandeira: row.name || '',
            geo_address: row.address || '',
            lat: row.lat, lon: row.lon,
            place_id: row.place_id,
            place_types: typesArr.slice(0, 3).join(', '),
            place_status: '',
            _mapId: allData.length
          });
          found++;
          bulkCacheHydrated++;
        }
        allPlaceIds = remaining;
        cacheHits += bulkCacheHydrated;
        // Reflect bulk hits in the UI immediately so the user sees progress
        // before Phase 2 even starts.
        var cacheChipBulk = document.getElementById('geo-cache');
        if (cacheChipBulk && cacheHits > 0) {
          cacheChipBulk.style.display = '';
          cacheChipBulk.textContent = '\ud83d\udcbe ' + cacheHits;
        }
        // Render cached pins early so the map populates progressively
        if (bulkCacheHydrated > 0) { filteredData = allData.slice(); renderMarkers(); }
      }
    } catch (e) {
      console.warn('[bulk-cache] lookup failed, falling back to proxy-only:', e && e.message);
    }
  }

  if (_placesDiscoveryCancelled) { finishPlacesDiscovery(); return; }

  // Phase 2: Enrich with Details — controlled pace to avoid rate limiting
  document.getElementById('geo-current').textContent = 'Enriquecendo '+allPlaceIds.length+' places...';
  var BATCH = 10, enriched = 0;
  var failedIds = [];
  var filtered = 0; // Collect failed IDs for retry
  
  async function enrichBatch(batch) {
    try {
      var resp2 = await fetch('/api/places-search', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'details', placeIds:batch }) });
      var data2 = await resp2.json();
      if (resp2.ok && data2.places) {
        // Aggregate cache transparency counters from proxy (places_cache hits vs Google API fetches)
        if (typeof data2.cached === 'number') cacheHits += data2.cached;
        if (typeof data2.fetched === 'number') apiFetched += data2.fetched;
        // Track which IDs were successfully returned
        var returnedIds = {};
        for (var ri=0;ri<data2.places.length;ri++) {
          var p=data2.places[ri]; 
          if (p.place_id) returnedIds[p.place_id] = true;
          if(!p.lat||!p.lon)continue;
          // Pin mode: discard places that fell outside the requested radius
          // (locationRestriction on the API already prevents this, but Google
          // occasionally places a pin just outside the circle — this is the safety net).
          if (pinCircles && !isInsideAnyPinCircle(p.lat, p.lon, pinCircles)) {
            filteredByRadius++;
            continue;
          }
          // Geographic filter: respect selected states, reject non-Brazil
          if (allowedUFs) {
            var addr = p.address || '';
            // LAYER 1: Must be in Brazil
            if (addr.indexOf('Brazil') === -1 && addr.indexOf('Brasil') === -1) { filtered++; continue; }
            // LAYER 2: Extract UF from address (3 patterns + State of mapping)
            var placeUF = null;
            var m1 = addr.match(/- ([A-Z]{2}),/);
            if (m1) placeUF = m1[1];
            if (!placeUF) { var m2 = addr.match(/, ([A-Z]{2}),/); if (m2) placeUF = m2[1]; }
            if (!placeUF) {
              var _sn = STATE_NAME_TO_UF;
              var m3 = addr.match(/State of ([^,]+)/);
              if (m3 && _sn[m3[1]]) placeUF = _sn[m3[1]];
            }
            // LAYER 3: Check UF against allowed list
            if (placeUF && !allowedUFs[placeUF]) { filtered++; continue; }
            // LAYER 4: If no UF extracted and not full-Brasil mode, discard (can't verify)
            if (!placeUF && Object.keys(allowedUFs).length < 27) { filtered++; continue; }
          }
          // Opt-in strict name filter (all meaningful tokens from the query must appear in the name).
          if (strictName && !matchesNameFilter(p.name, nameTokens)) {
            filteredByName++;
            continue;
          }
          allData.push({ nome:p.name, bandeira:p.name, geo_address:p.address, lat:p.lat, lon:p.lon, place_id:p.place_id, place_types:(p.types||[]).slice(0,3).join(', '), place_status:p.status||'', _mapId:allData.length }); found++;
        }
        // IDs that were sent but not returned = failed (rate limited or error)
        for (var fi=0;fi<batch.length;fi++) {
          if (!returnedIds[batch[fi]]) failedIds.push(batch[fi]);
        }
      } else {
        // Entire batch failed — add all to retry
        console.error('[places-search] details batch failed (Phase 2)', { status: resp2.status, error: data2 && data2.error, batchSize: batch.length });
        _placesApiErrors.push({ status: resp2.status, error: (data2 && data2.error) || 'unknown', phase: 'details', mode: 'enrich' });
        for (var fi=0;fi<batch.length;fi++) failedIds.push(batch[fi]);
        errors++;
      }
    } catch(e) {
      console.error('[places-search] details network error (Phase 2)', e, { batchSize: batch.length });
      _placesApiErrors.push({ status: 0, error: (e && e.message) || 'network', phase: 'details', mode: 'enrich' });
      for (var fi=0;fi<batch.length;fi++) failedIds.push(batch[fi]);
      errors++;
    }
    enriched += batch.length;
  }
  
  // Process sequentially with 2 concurrent batches and delay between rounds
  for (var bi = 0; bi < allPlaceIds.length; bi += BATCH * 2) {
    if (_placesDiscoveryCancelled) break;
    var parallelBatches = [];
    for (var pb = 0; pb < 2; pb++) {
      var start = bi + pb * BATCH;
      if (start >= allPlaceIds.length) break;
      parallelBatches.push(allPlaceIds.slice(start, start + BATCH));
    }
    await Promise.all(parallelBatches.map(enrichBatch));
    await new Promise(function(r){setTimeout(r,250);});
    // Segmented progress: Phase 1 (geo-fill) locked at 50%, Phase 2 splits cache vs API.
    // Total = 50% + proportional cache and API contributions based on allPlaceIds.length.
    var total2 = allPlaceIds.length || 1;
    var cachePct = 50 * (cacheHits / total2);
    var apiPct = 50 * (apiFetched / total2);
    document.getElementById('geo-fill').style.width = '50%';
    document.getElementById('geo-fill-cache').style.width = cachePct + '%';
    document.getElementById('geo-fill-api').style.width = apiPct + '%';
    var totalPct = Math.min(Math.round(50 + cachePct + apiPct), 99);
    document.getElementById('geo-pct').textContent = totalPct+'%';
    document.getElementById('geo-ok').textContent = found+' \u2713';
    document.getElementById('geo-fail').textContent = failedIds.length>0?failedIds.length+' pendentes':'';
    // Show cache chip once we have any hits
    var cacheChipEl2 = document.getElementById('geo-cache');
    if (cacheChipEl2) {
      if (cacheHits > 0) { cacheChipEl2.style.display = ''; cacheChipEl2.textContent = '💾 ' + cacheHits; }
      else { cacheChipEl2.style.display = 'none'; }
    }
    document.getElementById('geo-current').textContent = 'Detalhes: '+enriched+'/'+allPlaceIds.length+' \u00b7 \ud83d\udcbe '+cacheHits+' cache \u00b7 \ud83c\udf10 '+apiFetched+' API \u00b7 \u2713 '+found+' novos' + (failedIds.length > 0 ? ' \u00b7 ' + failedIds.length + ' retry' : '');
    if (enriched%60===0||enriched>=allPlaceIds.length) { filteredData=allData.slice(); renderMarkers(); }
    var elapsed=Date.now()-startTime, rate=enriched/(elapsed/1000), remaining=allPlaceIds.length-enriched;
    var eta=remaining>0&&rate>0?Math.round(remaining/rate):0;
    document.getElementById('geo-eta').textContent = eta>0?'~'+eta+'s':'';
    await new Promise(function(r){setTimeout(r,200);});
  }
  
  // Store failed IDs for optional retry later
  window._pendingRetryIds = failedIds.length > 0 ? failedIds.slice() : [];
  // Store search stats for finish screen
  window._lastSearchStats = { newIds: allPlaceIds.length, skippedDupes: skippedDupes, found: found, errors: errors, existingCount: existingCount, filtered: filtered, filteredByRadius: filteredByRadius, filteredByName: filteredByName, cacheHits: cacheHits, apiFetched: apiFetched };
  finishPlacesDiscovery();
}

function updatePlacesBadge(newCount, detail) {
  var badge = document.getElementById('places-map-badge');
  if (!badge) return;
  var isPlaces = currentMapType === 'places_discovery';
  badge.style.display = isPlaces && allData.length > 0 ? 'block' : 'none';
  if (!isPlaces) return;
  var countEl = document.getElementById('places-badge-count');
  var detailEl = document.getElementById('places-badge-detail');
  if (countEl) countEl.textContent = allData.length.toLocaleString('pt-BR');
  if (detailEl) {
    if (detail) {
      detailEl.textContent = detail;
      detailEl.style.display = 'inline';
    } else {
      detailEl.style.display = 'none';
    }
  }
}

function finishPlacesDiscovery() {
  var wasAppend = _appendMode;
  _appendMode = false;
  geocodingActive = false;
  window.removeEventListener('beforeunload', window._unloadHandler);
  document.getElementById('geocoding-overlay').classList.remove('active');
  filteredData = allData.slice();
  renderMarkers();
  
  var stats = window._lastSearchStats || {};
  var newIds = stats.newIds || 0;
  var dupes = stats.skippedDupes || 0;
  var foundDetails = stats.found || 0;
  var filteredGeo = stats.filtered || 0;
  var cacheHits = stats.cacheHits || 0;
  var apiFetched = stats.apiFetched || 0;
  // Google Places Details Pro SKU reference pricing: $17 per 1000 requests ($0.017/req).
  // Used only as an estimate — disclose as such in UI.
  var PLACES_DETAILS_COST_USD = 0.017;
  var savingsUSD = cacheHits * PLACES_DETAILS_COST_USD;
  
  if (allData.length > 0) {
    var pts = allData.filter(function(r){return r.lat&&r.lon;});
    if (pts.length) {
      var bounds = pts.reduce(function(b,r){return b.extend([parseFloat(r.lon),parseFloat(r.lat)]);}, new maplibregl.LngLatBounds([parseFloat(pts[0].lon),parseFloat(pts[0].lat)],[parseFloat(pts[0].lon),parseFloat(pts[0].lat)]));
      map.fitBounds(bounds, {padding:40, animate:true});
    }
    document.getElementById('places-panel').style.display = 'block';
    document.getElementById('places-results-section').style.display = 'block';
    var pendingCount = (window._pendingRetryIds || []).length;
    
    // Build summary with expansion details
    var summaryParts = ['<strong>' + allData.length + '</strong> places'];
    if (wasAppend) {
      if (foundDetails > 0) {
        summaryParts.push('<span style="color:var(--win);">+' + foundDetails + ' novos</span>');
      } else if (newIds === 0 && dupes > 0) {
        summaryParts.push('<span style="color:var(--text-muted);">nenhum novo encontrado</span>');
      } else if (newIds > 0 && foundDetails === 0) {
        summaryParts.push('<span style="color:var(--text-muted);">0 novos após filtros</span>');
      }
    }
    if (pendingCount > 0) {
      summaryParts.push('<span style="color:var(--neutral);">' + pendingCount.toLocaleString('pt-BR') + ' pendentes</span>');
    }
    var radiusFiltered = (stats.filteredByRadius || 0);
    if (radiusFiltered > 0) {
      summaryParts.push('<span style="color:var(--text-muted);">' + radiusFiltered + ' fora do raio</span>');
    }
    var nameFiltered = (stats.filteredByName || 0);
    if (nameFiltered > 0) {
      summaryParts.push('<span style="color:var(--text-muted);">' + nameFiltered + ' fora do nome</span>');
    }
    document.getElementById('places-results-summary').innerHTML = summaryParts.join(' · ');
    
    // Show expansion detail banner when in append mode
    if (wasAppend) {
      var detailHtml = '<div style="margin-top:8px;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:8px;font-size:11px;color:var(--text-dim);line-height:1.6;">';
      detailHtml += '<span style="font-weight:600;color:var(--text);">Resultado da expansão:</span><br>';
      if (dupes > 0) detailHtml += '• ' + dupes.toLocaleString('pt-BR') + ' places já existiam no mapa (ignorados sem custo)<br>';
      if (newIds > 0) detailHtml += '• ' + newIds.toLocaleString('pt-BR') + ' IDs novos encontrados<br>';
      if (cacheHits > 0) detailHtml += '• <span style="color:var(--win);">💾 ' + cacheHits.toLocaleString('pt-BR') + ' reaproveitado' + (cacheHits !== 1 ? 's' : '') + ' do cache (sem custo)</span><br>';
      if (apiFetched > 0) detailHtml += '• 🌐 ' + apiFetched.toLocaleString('pt-BR') + ' consultado' + (apiFetched !== 1 ? 's' : '') + ' na Google Places API<br>';
      if (filteredGeo > 0) detailHtml += '• ' + filteredGeo + ' descartados por filtro geográfico (fora dos estados selecionados)<br>';
      if (foundDetails > 0) detailHtml += '• <span style="color:var(--win);font-weight:500;">' + foundDetails + ' novo' + (foundDetails !== 1 ? 's' : '') + ' place' + (foundDetails !== 1 ? 's' : '') + ' adicionado' + (foundDetails !== 1 ? 's' : '') + ' ao mapa</span><br>';
      if (newIds === 0 && dupes > 0) detailHtml += '• <span style="color:var(--text-muted);">A API retornou os mesmos places da busca original. Tente expandir para outros estados ou alterar a query.</span><br>';
      if (newIds === 0 && dupes === 0) detailHtml += '• <span style="color:var(--text-muted);">Nenhum place retornado pela API nesta busca.</span><br>';
      // Savings line (appears only when cache was actually useful)
      if (cacheHits > 0) {
        detailHtml += '<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--glass-border);color:var(--win);">💡 Economia estimada: ~$' + savingsUSD.toFixed(2) + ' nesta busca <span style="color:var(--text-muted);font-size:10px;">(ref. Places Details Pro $0,017/req)</span></div>';
      }
      detailHtml += '</div>';
      document.getElementById('places-results-summary').innerHTML += detailHtml;
    } else if (cacheHits > 0) {
      // First-time search with cache hits — compact banner explaining reuse
      var firstHtml = '<div style="margin-top:8px;padding:8px 12px;background:var(--win-bg);border:1px solid rgba(16,185,129,0.25);border-radius:8px;font-size:11px;color:var(--text-dim);line-height:1.6;">';
      firstHtml += '<span style="color:var(--win);">💾 ' + cacheHits.toLocaleString('pt-BR') + ' place' + (cacheHits !== 1 ? 's' : '') + ' reaproveitado' + (cacheHits !== 1 ? 's' : '') + ' do cache</span>';
      if (apiFetched > 0) firstHtml += ' <span style="color:var(--text-muted);">·</span> 🌐 ' + apiFetched.toLocaleString('pt-BR') + ' consultado' + (apiFetched !== 1 ? 's' : '') + ' na API';
      firstHtml += '<br><span style="color:var(--win);">💡 Economia estimada: ~$' + savingsUSD.toFixed(2) + '</span> <span style="color:var(--text-muted);font-size:10px;">(ref. Places Details Pro $0,017/req)</span>';
      firstHtml += '</div>';
      document.getElementById('places-results-summary').innerHTML += firstHtml;
    }
    
    // Show/hide retry button
    var retryBtn = document.getElementById('btn-retry-pending');
    if (retryBtn) retryBtn.style.display = pendingCount > 0 ? 'block' : 'none';
    if (!wasAppend) {
      showSaveMapDialog();
    } else {
      // Auto-save new places to existing saved map. Prefer _savedMapId (set by
      // both openSavedMap and the initial save flow), fall back to
      // _currentOpenMapId for robustness against any code path that sets only
      // the legacy variable.
      var mapIdForAppend = window._savedMapId || window._currentOpenMapId;
      if (mapIdForAppend) autoSaveExpandedPlaces(mapIdForAppend);
    }
  } else {
    document.getElementById('places-panel').style.display = 'block';
    if (_placesMode === 'pin') enablePinMode();
    var errEl = document.getElementById('places-setup-error');
    if (errEl) {
      // If the search ended with zero results AND we recorded API errors, surface
      // them to the user instead of the generic "nenhum resultado" — that message
      // hid an HTTP 400 (locationRestriction.circle) bug for 4 weeks.
      if (_placesApiErrors.length > 0) {
        console.error('[places-search] search ended with ' + _placesApiErrors.length + ' API errors:', _placesApiErrors);
        var firstErr = _placesApiErrors[0];
        var httpLabel = firstErr.status > 0 ? 'HTTP ' + firstErr.status : 'erro de rede';
        var errSnippet = (firstErr.error && typeof firstErr.error === 'string') ? firstErr.error.slice(0, 120) : '';
        errEl.textContent = 'Erro na API (' + httpLabel + ')' + (errSnippet ? ': ' + errSnippet : '') + '. Tente novamente em alguns instantes ou abra o console (F12) para detalhes.';
      } else {
        errEl.textContent = 'Nenhum resultado encontrado. Tente outra busca ou amplie a área.';
      }
      errEl.style.display = 'block';
    }
  }
  // Cleanup stats
  window._lastSearchStats = null;
  // Clear deep-search sub-grid so the next regular search reads _radiusPins
  _deepSearchSubAreas = null;
  // Update floating badge
  var badgeDetail = wasAppend ? (foundDetails > 0 ? '+' + foundDetails + ' novos' : dupes > 0 ? 'nenhum novo' : '') : '';
  updatePlacesBadge(allData.length, badgeDetail);
}

async function autoSaveExpandedPlaces(mapId) {
  var summary = document.getElementById('places-results-summary');
  try {
    // Find new places: rows without an existing DB 'id' (loaded rows from Supabase have 'id')
    var newPlaces = allData.filter(function(r) {
      return !r.id && r.lat && r.lon && r.place_id;
    });
    if (newPlaces.length === 0) {
      if (summary) summary.innerHTML += '<br><span style="color:var(--text-dim);font-size:11px;">Nenhum place novo encontrado para salvar.</span>';
      return;
    }
    if (summary) summary.innerHTML += '<br><span style="color:var(--text-dim);font-size:11px;">Salvando ' + newPlaces.length + ' novos places...</span>';
    
    // Build lookup to assign DB ids back to allData rows after insert
    // (so subsequent saves don't re-insert the same rows).
    var byPlaceId = {};
    for (var ai = 0; ai < allData.length; ai++) {
      var r = allData[ai];
      if (!r.id && r.place_id) byPlaceId[r.place_id] = r;
    }
    
    // Insert new places in chunks; use return=representation so we can map ids back
    var CHUNK = 500;
    for (var i = 0; i < newPlaces.length; i += CHUNK) {
      var chunk = newPlaces.slice(i, i + CHUNK).map(function(r) {
        return {
          map_id: mapId,
          cnpj: r.cnpj || null,
          bandeira: r.bandeira || null,
          nome: r.nome || null,
          lat: r.lat,
          lon: r.lon,
          geo_address: r.geo_address || null,
          place_id: r.place_id || null,
          place_types: r.place_types || null,
          place_status: r.place_status || null,
        };
      });
      var inserted = await sbFetch('map_pdvs?on_conflict=map_id,place_id', { method: 'POST', headers: { 'Prefer': 'return=representation,resolution=merge-duplicates' }, body: JSON.stringify(chunk) });
      // Map inserted ids back to allData rows so next save() skips them
      if (Array.isArray(inserted)) {
        for (var ii = 0; ii < inserted.length; ii++) {
          var ins = inserted[ii];
          var target = ins.place_id && byPlaceId[ins.place_id];
          if (target) target.id = ins.id;
        }
      }
    }
    
    // Update row_count and payload on saved_maps
    var updateBody = { row_count: allData.length };
    // Also update payload with latest search context
    if (window._placesSearchQuery) {
      var resolvedMode = window._placesSearchMode || _placesMode;
      updateBody.payload = {
        search_query: window._placesSearchQuery,
        search_mode: resolvedMode,
        search_states: window._placesSearchStates || Array.from(_selectedStates),
        search_radius_km: parseFloat(document.getElementById('pin-radius-km')?.value) || 5,
        // Preserve pins on append too — otherwise every Aprofundar busca on a
        // saved map would erase search_pins from the payload, breaking the
        // next reload's pin restoration and disabling Aprofundar busca itself.
        search_pins: resolvedMode === 'pin'
          ? _radiusPins.map(function(p) { return { lat: p.lat, lon: p.lon, radiusKm: p.radiusKm }; })
          : null,
      };
    }
    await sbFetch('saved_maps?id=eq.' + mapId, {
      method: 'PATCH',
      headers: { 'Prefer': 'return=minimal' },
      body: JSON.stringify(updateBody),
    });
    
    if (summary) summary.innerHTML += '<br><span style="color:var(--win);font-size:11px;">✓ ' + newPlaces.length + ' novos places salvos automaticamente</span>';
  } catch (e) {
    console.error('Auto-save expanded places failed:', e);
    if (summary) summary.innerHTML += '<br><span style="color:var(--lose);font-size:11px;">⚠ Erro ao salvar expansão: ' + escHtml(e.message) + '</span>';
  }
}

async function retryPendingIds() {
  var ids = window._pendingRetryIds || [];
  if (ids.length === 0) return;
  
  var overlay = document.getElementById('geocoding-overlay');
  document.getElementById('geo-title-text').textContent = 'Recuperando pendentes';
  overlay.classList.add('active');
  document.getElementById('geo-fill').style.width = '0%';
  document.getElementById('geo-pct').textContent = '0%';
  document.getElementById('geo-ok').textContent = '0';
  document.getElementById('geo-fail').textContent = '';
  document.getElementById('geo-eta').textContent = '';
  document.getElementById('geo-current').textContent = 'Processando ' + ids.length + ' pendentes...';
  document.getElementById('geo-fill').style.width = '0%';
  document.getElementById('geo-fill-cache').style.width = '0%';
  document.getElementById('geo-fill-api').style.width = '0%';
  var cacheChipRetry = document.getElementById('geo-cache');
  if (cacheChipRetry) { cacheChipRetry.style.display = 'none'; cacheChipRetry.textContent = '💾 0'; }
  
  geocodingActive = true;
  _placesDiscoveryCancelled = false;
  var found = 0, processed = 0, newFailed = [];
  // Retry also captures places_cache transparency counters
  var cacheHits = 0, apiFetched = 0;
  var BATCH = 10;
  
  for (var i = 0; i < ids.length; i += BATCH) {
    if (_placesDiscoveryCancelled) break;
    var batch = ids.slice(i, i + BATCH);
    // Check if any of these IDs already exist in allData (from previous retry or expand)
    var newBatch = batch.filter(function(pid) {
      return !allData.some(function(r) { return r.place_id === pid; });
    });
    if (newBatch.length === 0) { processed += batch.length; continue; }
    
    try {
      var resp = await fetch('/api/places-search', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'details', placeIds: newBatch }) });
      var data = await resp.json();
      if (resp.ok && data.places) {
        if (typeof data.cached === 'number') cacheHits += data.cached;
        if (typeof data.fetched === 'number') apiFetched += data.fetched;
        var returnedIds = {};
        for (var ri = 0; ri < data.places.length; ri++) {
          var p = data.places[ri];
          if (p.place_id) returnedIds[p.place_id] = true;
          if (!p.lat || !p.lon) continue;
          // Geographic filter in retry too
          if (window._allowedUFs) {
            var addr = p.address || '';
            if (addr.indexOf('Brazil') === -1 && addr.indexOf('Brasil') === -1) continue;
            var placeUF = null;
            var m1 = addr.match(/- ([A-Z]{2}),/);
            if (m1) placeUF = m1[1];
            if (!placeUF) { var m2 = addr.match(/, ([A-Z]{2}),/); if (m2) placeUF = m2[1]; }
            if (!placeUF) {
              var _sn = STATE_NAME_TO_UF;
              var m3 = addr.match(/State of ([^,]+)/);
              if (m3 && _sn[m3[1]]) placeUF = _sn[m3[1]];
            }
            if (placeUF && !window._allowedUFs[placeUF]) continue;
          }
          allData.push({ nome:p.name, bandeira:p.name, geo_address:p.address, lat:p.lat, lon:p.lon, place_id:p.place_id, place_types:(p.types||[]).slice(0,3).join(', '), place_status:p.status||'', _mapId:allData.length });
          found++;
        }
        for (var fi = 0; fi < newBatch.length; fi++) {
          if (!returnedIds[newBatch[fi]]) newFailed.push(newBatch[fi]);
        }
      } else {
        console.error('[places-search] retry details batch failed', { status: resp.status, error: data && data.error, batchSize: newBatch.length });
        _placesApiErrors.push({ status: resp.status, error: (data && data.error) || 'unknown', phase: 'details', mode: 'retry' });
        for (var fi = 0; fi < newBatch.length; fi++) newFailed.push(newBatch[fi]);
      }
    } catch(e) {
      console.error('[places-search] retry details network error', e, { batchSize: newBatch.length });
      _placesApiErrors.push({ status: 0, error: (e && e.message) || 'network', phase: 'details', mode: 'retry' });
      for (var fi = 0; fi < newBatch.length; fi++) newFailed.push(newBatch[fi]);
    }
    processed += batch.length;
    // Retry progress: geo-fill stays at 0 (no Phase 1), cache+api split the full 100%.
    var totalRetry = ids.length || 1;
    var cachePctR = 100 * (cacheHits / totalRetry);
    var apiPctR = 100 * (apiFetched / totalRetry);
    document.getElementById('geo-fill').style.width = '0%';
    document.getElementById('geo-fill-cache').style.width = cachePctR + '%';
    document.getElementById('geo-fill-api').style.width = apiPctR + '%';
    var pv = Math.min(Math.round(cachePctR + apiPctR), 99);
    document.getElementById('geo-pct').textContent = pv + '%';
    document.getElementById('geo-ok').textContent = found + ' novos';
    // Update cache chip
    var cacheChipR = document.getElementById('geo-cache');
    if (cacheChipR) {
      if (cacheHits > 0) { cacheChipR.style.display = ''; cacheChipR.textContent = '💾 ' + cacheHits; }
      else { cacheChipR.style.display = 'none'; }
    }
    document.getElementById('geo-current').textContent = 'Recuperando: ' + processed + '/' + ids.length + ' \u00b7 \ud83d\udcbe ' + cacheHits + ' cache \u00b7 \ud83c\udf10 ' + apiFetched + ' API \u00b7 ' + found + ' novos' + (newFailed.length > 0 ? ' \u00b7 ' + newFailed.length + ' falharam' : '');
    if (processed % 100 === 0) { filteredData = allData.slice(); renderMarkers(); }
    await new Promise(function(r) { setTimeout(r, 300); });
  }
  
  window._pendingRetryIds = newFailed;
  geocodingActive = false;
  document.getElementById('geocoding-overlay').classList.remove('active');
  filteredData = allData.slice();
  renderMarkers();
  
  // Update results summary
  var pendingCount = newFailed.length;
  document.getElementById('places-results-summary').innerHTML = '<strong>' + allData.length + '</strong> places' + (pendingCount > 0 ? ' · <span style="color:#f59e0b;">' + pendingCount.toLocaleString('pt-BR') + ' pendentes</span>' : ' · <span style="color:var(--win);">completo</span>');
  var retryBtn = document.getElementById('btn-retry-pending');
  if (retryBtn) retryBtn.style.display = pendingCount > 0 ? 'block' : 'none';
  
  // Persist recovered places to map_pdvs so they survive page reloads.
  // autoSaveExpandedPlaces filters by !r.id so it also catches any previously
  // unsaved rows from earlier retries. Safe to call even when nothing new came
  // back from this retry — the function short-circuits when no new rows exist.
  var mapIdForRetry = window._savedMapId || window._currentOpenMapId;
  if (mapIdForRetry) {
    await autoSaveExpandedPlaces(mapIdForRetry);
  }
}

function resetPlacesForNewSearch() {
  _appendMode = false;
  allData = []; filteredData = [];
  if (map && map.getSource('pdvs')) {
    map.getSource('pdvs').setData({ type: 'FeatureCollection', features: [] });
  }
  clearAllPins();
  _selectedStates.clear();
  document.querySelectorAll('.state-chip[data-uf]').forEach(function(c) { c.classList.remove('active'); });
  document.getElementById('places-query-input').value = '';
  document.getElementById('places-map-name').value = '';
  document.getElementById('places-results-section').style.display = 'none';
  document.getElementById('places-setup-error').style.display = 'none';
  document.getElementById('places-estimate').classList.remove('visible');
  document.getElementById('places-cost-info').style.display = 'none';
  document.getElementById('places-run-btn').disabled = true;
  // Reset pro modo default (Estados — primeira aba)
  setPlacesMode('states');
  // Reset map view
  if (map) map.jumpTo({ center: [-47.93, -15.78], zoom: 4 });
  // Switch to map view if on list
  setMapView('map');
}


// ── Event delegation: badges + region chips ──
(function() {
  // Badge-list delegation (f-oport, f-perf)
  document.querySelectorAll('.badge-list').forEach(function(list) {
    list.addEventListener('click', function(e) {
      var btn = e.target.closest('.badge');
      if (!btn) return;
      toggleBadge(btn, list.id);
      applyFilters();
    });
  });

  // Region filter chips delegation
  var regionRow = document.getElementById('filter-region-row');
  if (regionRow) {
    regionRow.addEventListener('click', function(e) {
      var chip = e.target.closest('.state-chip[data-region]');
      if (!chip) return;
      setRegionFilter(chip.getAttribute('data-region'), chip);
    });
  }

  // Mini-stats clicáveis na Overview (Ganhando / Competindo / Perdendo / Sem presença)
  document.addEventListener('click', function(e) {
    var el = e.target.closest('.overview-mini-stat.clickable');
    if (!el || !el.dataset.perf) return;
    try { toggleMiniStatFilter(el.dataset.perf); } catch(err) { console.error(err); }
  });

  // Itens do Ranking clicáveis — seleciona aquela bandeira no multi-select
  var tcRanking = document.getElementById('tc-ranking');
  if (tcRanking) {
    tcRanking.addEventListener('click', function(e) {
      var el = e.target.closest('.rank-item.clickable[data-bandeira]');
      if (!el) return;
      // dataset decodifica entidades HTML automaticamente
      var name = el.dataset.bandeira;
      try { selectBandeiraFromChart(name); } catch(err) { console.error(err); }
    });
  }

  // Clique no nome do mapa no header → edição inline (read-only em modo share)
  // Fase 6: .map-title contenteditable nativo; clique foca pra editar.
  var nameSpan = document.getElementById('header-map-name');
  if (nameSpan) {
    nameSpan.addEventListener('click', function() {
      if (_isSharedMode) return;
      try { startEditMapName(); } catch(err) { console.error(err); }
    });
    // Suporte a foco via teclado (Tab + Enter)
    nameSpan.addEventListener('focus', function() {
      if (_isSharedMode) return;
      try { startEditMapName(); } catch(err) { console.error(err); }
    });
  }
})();




// ─── WINDOW EXPORTS ─────────────────────────────────────────────────────────
// Expose functions + state to window for HTML onclick handlers.
// try/catch because some functions are inside callbacks (not module scope).

(function _exportAll() {
  try { window._buildDarkStyle = _buildDarkStyle; } catch(e) {}
  try { window._buildLightMapStyle = _buildLightMapStyle; } catch(e) {}
  try { window._buildSatelliteStyle = _buildSatelliteStyle; } catch(e) {}
  try { window._cleanCommercialAddress = _cleanCommercialAddress; } catch(e) {}
  try { window._cssVar = _cssVar; } catch(e) {}
  try { window._refreshPinColors = _refreshPinColors; } catch(e) {}
  try { window._pinColors = _pinColors; } catch(e) {}
  try { window._escForHtml = _escForHtml; } catch(e) {}
  try { window._hereItemToResult = _hereItemToResult; } catch(e) {}
  try { window._initMapStyles = _initMapStyles; } catch(e) {}
  try { window._initSupa = _initSupa; } catch(e) {}
  try { window._onThemeChange = _onThemeChange; } catch(e) {}
  try { window._setupMapInteractions = _setupMapInteractions; } catch(e) {}
  try { window._setupMapSources = _setupMapSources; } catch(e) {}
  try { window.addRadiusPin = addRadiusPin; } catch(e) {}
  try { window.aplicarReceita = aplicarReceita; } catch(e) {}
  try { window.applyFilters = applyFilters; } catch(e) {}
  try { window.applyGalleryFilters = applyGalleryFilters; } catch(e) {}
  try { window.applyMapMode = applyMapMode; } catch(e) {}
  try { window.autoSaveAndNotify = autoSaveAndNotify; } catch(e) {}
  try { window.autoSaveExpandedPlaces = autoSaveExpandedPlaces; } catch(e) {}
  try { window.avg = avg; } catch(e) {}
  try { window._median = _median; } catch(e) {}
  try { window.buildBandeiraGroups = buildBandeiraGroups; } catch(e) {}
  try { window.buildMapCard = buildMapCard; } catch(e) {}
  try { window.buildPageNumbers = buildPageNumbers; } catch(e) {}
  try { window.buildPopup = buildPopup; } catch(e) {}
  try { window.buildStateGrid = buildStateGrid; } catch(e) {}
  try { window.buscarReceita = buscarReceita; } catch(e) {}
  try { window.buscarReceitaBrasilAPI = buscarReceitaBrasilAPI; } catch(e) {}
  try { window.buscarReceitaEstab = buscarReceitaEstab; } catch(e) {}
  try { window.cancelGeocoding = cancelGeocoding; } catch(e) {}
  try { window.clearAllPins = clearAllPins; } catch(e) {}
  try { window.closeMapTypeModal = closeMapTypeModal; } catch(e) {}
  try { window.closeSaveModal = closeSaveModal; } catch(e) {}
  try { window.closeVarejoSubModal = closeVarejoSubModal; } catch(e) {}
  try { window.debounce = debounce; } catch(e) {}
  try { window._loadScript = _loadScript; } catch(e) {}
  try { window.ensureChartJS = ensureChartJS; } catch(e) {}
  try { window.ensureXLSX = ensureXLSX; } catch(e) {}
  try { window.ensureBRCities = ensureBRCities; } catch(e) {}
  try { window.deleteMap = deleteMap; } catch(e) {}
  try { window.togglePinMap = togglePinMap; } catch(e) {}
  try { window.destroyChart = destroyChart; } catch(e) {}
  try { window.detectAndNormalize = detectAndNormalize; } catch(e) {}
  try { window.disablePinMode = disablePinMode; } catch(e) {}
  try { window.dismissGeoToast = dismissGeoToast; } catch(e) {}
  try { window.doGoogleLogin = doGoogleLogin; } catch(e) {}
  try { window.downloadGeocoderCSV = downloadGeocoderCSV; } catch(e) {}
  try { window.downloadTemplate = downloadTemplate; } catch(e) {}
  try { window.enablePinMode = enablePinMode; } catch(e) {}
  try { window.enrichBatch = enrichBatch; } catch(e) {}
  try { window.enrichRow = enrichRow; } catch(e) {}
  try { window.escHtml = escHtml; } catch(e) {}
  try { window.extrairEndereco = extrairEndereco; } catch(e) {}
  try { window.filterMultiSelect = filterMultiSelect; } catch(e) {}
  try { window.finishPlacesDiscovery = finishPlacesDiscovery; } catch(e) {}
  try { window.generateCircleGeoJSON = generateCircleGeoJSON; } catch(e) {}
  try { window.geocodeHERE = geocodeHERE; } catch(e) {}
  try { window.bulkCnpjGeocodeLookup = bulkCnpjGeocodeLookup; } catch(e) {}
  try { window.queueCnpjGeoUpsert = queueCnpjGeoUpsert; } catch(e) {}
  try { window.flushCnpjGeoUpserts = flushCnpjGeoUpserts; } catch(e) {}
  try { window._normalizeCnpj14 = _normalizeCnpj14; } catch(e) {}
  try { window.getSearchAreas = getSearchAreas; } catch(e) {}
  try { window.goToStep = goToStep; } catch(e) {}
  try { window.groupBy = groupBy; } catch(e) {}
  try { window.handleCSVFile = handleCSVFile; } catch(e) {}
  try { window.handleLoggedIn = handleLoggedIn; } catch(e) {}
  try { window.identificarBandeira = identificarBandeira; } catch(e) {}
  try { window.initAuth = initAuth; } catch(e) {}
  try { window.initMap = initMap; } catch(e) {}
  try { window.initMultiSelect = initMultiSelect; } catch(e) {}
  try { window._updateMsSelectionBar = _updateMsSelectionBar; } catch(e) {}
  try { window.initResizablePanels = initResizablePanels; } catch(e) {}
  try { window.loadData = loadData; } catch(e) {}
  try { window.loadGallery = loadGallery; } catch(e) {}
  try { window.msClearAll = msClearAll; } catch(e) {}
  try { window.msGetSelected = msGetSelected; } catch(e) {}
  try { window.msReset = msReset; } catch(e) {}
  try { window.msSelectAll = msSelectAll; } catch(e) {}
  try { window.normalizeBandeira = normalizeBandeira; } catch(e) {}
  try { window.openMapTypeModal = openMapTypeModal; } catch(e) {}
  try { window.openSaveModalFromToast = openSaveModalFromToast; } catch(e) {}
  try { window.openSavedMap = openSavedMap; } catch(e) {}
  try { window.openVarejoSubModal = openVarejoSubModal; } catch(e) {}
  try { window.parseCSV = parseCSV; } catch(e) {}
  try { window.parseLine = parseLine; } catch(e) {}
  try { window.pct = pct; } catch(e) {}
  try { window.pctRaw = pctRaw; } catch(e) {}
  try { window.pinColor = pinColor; } catch(e) {}
  try { window.populateFilters = populateFilters; } catch(e) {}
  try { window.removeRadiusPin = removeRadiusPin; } catch(e) {}
  try { window.renderBarChart = renderBarChart; } catch(e) {}
  try { window.renderGalleryPage = renderGalleryPage; } catch(e) {}
  try { window.renderGeocoderList = renderGeocoderList; } catch(e) {}
  try { window.renderHistChart = renderHistChart; } catch(e) {}
  try { window.renderHorizBarChart = renderHorizBarChart; } catch(e) {}
  try { window.renderMarkers = renderMarkers; } catch(e) {}
  try { window.renderRadiusPinTags = renderRadiusPinTags; } catch(e) {}
  try { window.renderRankList = renderRankList; } catch(e) {}
  try { window.renderUploadTemplate = renderUploadTemplate; } catch(e) {}
  try { window.renderWinLoseChart = renderWinLoseChart; } catch(e) {}
  try { window.resetFilters = resetFilters; } catch(e) {}
  try { window.resetPlacesForNewSearch = resetPlacesForNewSearch; } catch(e) {}
  try { window.retryPendingIds = retryPendingIds; } catch(e) {}
  try { window.reverseGeocodeHERE = reverseGeocodeHERE; } catch(e) {}
  try { window.runTask = runTask; } catch(e) {}
  try { window.saveMapToSupabase = saveMapToSupabase; } catch(e) {}
  try { window.sbFetch = sbFetch; } catch(e) {}
  try { window.selectMapType = selectMapType; } catch(e) {}
  try { window.selectVarejoSubType = selectVarejoSubType; } catch(e) {}
  try { window.setMapView = setMapView; } catch(e) {}
  try { window.setPlacesMode = setPlacesMode; } catch(e) {}
  try { window.setRegionFilter = setRegionFilter; } catch(e) {}
  try { window.setTab = setTab; } catch(e) {}
  try { window.setupResizer = setupResizer; } catch(e) {}
  try { window.showGallery = showGallery; } catch(e) {}
  try { window.showGeoToast = showGeoToast; } catch(e) {}
  try { window.showPlacesSetup = showPlacesSetup; } catch(e) {}
  try { window.showSaveMapDialog = showSaveMapDialog; } catch(e) {}
  try { window.startAppendPdvs = startAppendPdvs; } catch(e) {}
  try { window.cancelAppendMode = cancelAppendMode; } catch(e) {}
  try { window.finishAppendToMap = finishAppendToMap; } catch(e) {}
  try { window.deletePdvFromMap = deletePdvFromMap; } catch(e) {}
  try { window.startSelectionMode = startSelectionMode; } catch(e) {}
  try { window.exitSelectionMode = exitSelectionMode; } catch(e) {}
  try { window.bulkDeleteSelected = bulkDeleteSelected; } catch(e) {}
  try { window.updateSelectionBar = updateSelectionBar; } catch(e) {}
  try { window.openShareModal = openShareModal; } catch(e) {}
  try { window.startReenrich = startReenrich; } catch(e) {}
  try { window.dismissReenrich = dismissReenrich; } catch(e) {}
  try { window.checkReenrichBar = checkReenrichBar; } catch(e) {}
  try { window.setHeaderMapName = setHeaderMapName; } catch(e) {}
  try { window.startEditMapName = startEditMapName; } catch(e) {}
  try { window.saveMapName = saveMapName; } catch(e) {}
  try { window.toggleMoreMenu = toggleMoreMenu; } catch(e) {}
  try { window.closeMoreMenu = closeMoreMenu; } catch(e) {}
  try { window.openShareModalFromCard = openShareModalFromCard; } catch(e) {}
  try { window.closeShareModal = closeShareModal; } catch(e) {}
  try { window.copyShareLink = copyShareLink; } catch(e) {}
  try { window.revokeShareLink = revokeShareLink; } catch(e) {}
  try { window.initSharedMode = initSharedMode; } catch(e) {}
  try { window._isSharedMode = _isSharedMode; } catch(e) {}
  try { window.showUploadZone = showUploadZone; } catch(e) {}
  try { window.startExpandSearch = startExpandSearch; } catch(e) {}
  try { window.startDeepSearch = startDeepSearch; } catch(e) {}
  try { window.startGeocoding = startGeocoding; } catch(e) {}
  try { window.startGeocodingFromStep2 = startGeocodingFromStep2; } catch(e) {}
  try { window.startPlacesDiscovery = startPlacesDiscovery; } catch(e) {}
  try { window.startReverseGeocoding = startReverseGeocoding; } catch(e) {}
  try { window.supaLogout = supaLogout; } catch(e) {}
  try { window.syncTicketRange = syncTicketRange; } catch(e) {}
  try { window.throttle = throttle; } catch(e) {}
  try { window.toggleAdvancedFilters = toggleAdvancedFilters; } catch(e) {}
  try { window.toggleBadge = toggleBadge; } catch(e) {}
  try { window.toggleFullMap = toggleFullMap; } catch(e) {}
  try { window.toggleMiniStatFilter = toggleMiniStatFilter; } catch(e) {}
  try { window.toggleShareBucket = toggleShareBucket; } catch(e) {}
  try { window.clearShareBucket = clearShareBucket; } catch(e) {}
  try { window.selectBandeiraFromChart = selectBandeiraFromChart; } catch(e) {}
  try { window.syncMiniStatActive = syncMiniStatActive; } catch(e) {}
  try { window.toggleMultiSelect = toggleMultiSelect; } catch(e) {}
  try { window.togglePanel = togglePanel; } catch(e) {}
  try { window.togglePlacesPanel = togglePlacesPanel; } catch(e) {}
  try { window.toggleSidebar = toggleSidebar; } catch(e) {}
  try { window.toggleState = toggleState; } catch(e) {}
  try { window.toggleTheme = toggleTheme; } catch(e) {}
  try { window.updateAnalysis = updateAnalysis; } catch(e) {}
  try { window.updateEnrichUI = updateEnrichUI; } catch(e) {}
  try { window.updateHeader = updateHeader; } catch(e) {}
  try { window.updateMsDisplay = updateMsDisplay; } catch(e) {}
  try { window.updateOverlay = updateOverlay; } catch(e) {}
  try { window.updateOverview = updateOverview; } catch(e) {}
  try { window.updatePanels = updatePanels; } catch(e) {}
  try { window.updatePlacesBadge = updatePlacesBadge; } catch(e) {}
  try { window.updatePlacesEstimate = updatePlacesEstimate; } catch(e) {}
  try { window.updateRangeLabel = updateRangeLabel; } catch(e) {}
  try { window.updateRanking = updateRanking; } catch(e) {}

  // Shared state — getter+setter pra sempre refletir a referência atual.
  // Atribuição direta (window.X = X) seria capturada só no boot quando os
  // arrays estão vazios. Setter permite que código externo (PR2) reatribua.
  try {
    Object.defineProperty(window, 'allData', {
      get: () => allData,
      set: (v) => { allData = v; },
      configurable: true,
    });
    Object.defineProperty(window, 'filteredData', {
      get: () => filteredData,
      set: (v) => { filteredData = v; },
      configurable: true,
    });
    Object.defineProperty(window, 'currentMapType', {
      get: () => currentMapType,
      set: (v) => { currentMapType = v; },
      configurable: true,
    });
    Object.defineProperty(window, 'currentView', {
      get: () => currentView,
      set: (v) => { currentView = v; },
      configurable: true,
    });
    Object.defineProperty(window, 'currentUser', {
      get: () => currentUser,
      set: (v) => { currentUser = v; },
      configurable: true,
    });
  } catch(e) {
    // Fallback se Object.defineProperty falhar
    try { window.allData = allData; } catch(_) {}
    try { window.filteredData = filteredData; } catch(_) {}
    try { window.currentMapType = currentMapType; } catch(_) {}
    try { window.currentView = currentView; } catch(_) {}
    try { window.currentUser = currentUser; } catch(_) {}
  }
  try { window.map = map; } catch(e) {}
  try { window._supa = _supa; } catch(e) {}
  try { window.MAP_STYLES = MAP_STYLES; } catch(e) {}
  try { window.charts = charts; } catch(e) {}
  try { window.activeLayer = activeLayer; } catch(e) {}
  try { window.rawCSVData = rawCSVData; } catch(e) {}
  try { window.geocodingActive = geocodingActive; } catch(e) {}
  try { window.geocodingCancelled = geocodingCancelled; } catch(e) {}
  try { window.SUPABASE_URL = SUPABASE_URL; } catch(e) {}
  try { window.SUPABASE_ANON = SUPABASE_ANON; } catch(e) {}
  try { window.THUMB_COLORS = THUMB_COLORS; } catch(e) {}
  try { window.BR_STATES = BR_STATES; } catch(e) {}
  try { window.BR_CITIES = BR_CITIES; } catch(e) {}
  try { window.UF_REGIONS = UF_REGIONS; } catch(e) {}
  try { window.BR_CAPITALS = BR_CAPITALS; } catch(e) {}
  try { window._galleryMaps = _galleryMaps; } catch(e) {}
  try { window._selectedStates = _selectedStates; } catch(e) {}
  try { window._radiusPins = _radiusPins; } catch(e) {}
  try { window._placesMode = _placesMode; } catch(e) {}
  try { window._appendMode = _appendMode; } catch(e) {}
  try { window._geoCache = _geoCache; } catch(e) {}
  try { window._receitaCache = _receitaCache; } catch(e) {}
  try { window._receitaInFlight = _receitaInFlight; } catch(e) {}
  try { window._receitaPending = _receitaPending; } catch(e) {}
  try { window._GEO_SCORE_MIN = _GEO_SCORE_MIN; } catch(e) {}
  try { window._debouncedFilter = _debouncedFilter; } catch(e) {}
  try { window._debouncedAnalytics = _debouncedAnalytics; } catch(e) {}
  try { window.dropZone = dropZone; } catch(e) {}
  try { window._escForHtml = _escForHtml; } catch(e) {}
  try { window._cssVar = _cssVar; } catch(e) {}
  try { window.sbFetch = sbFetch; } catch(e) {}
  try { window.escHtml = escHtml; } catch(e) {}
})();








