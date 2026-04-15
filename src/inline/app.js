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
  // Update toggle icon
  var icon = document.getElementById('theme-toggle-icon');
  if (icon) icon.textContent = next === 'dark' ? '☀️' : '🌙';
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

function _onThemeChange(theme) {
  if (typeof map === 'undefined' || !map) return;
  var style = theme === 'light' ? _buildLightMapStyle() : _buildDarkStyle();
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
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
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

// ─── Estilos de mapa (MapLibre style URLs) ───────────────────────────────────
// OpenFreeMap — vector tiles WebGL gratuito + HERE raster para satellite
var MAP_STYLES = null; // inicializado após _buildDarkStyle e _buildSatelliteStyle

function _buildDarkStyle() {
  // Style dark customizado usando tiles OpenFreeMap + paleta escura
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
    sources: {
      'ofm': {
        type: 'vector',
        url: 'https://tiles.openfreemap.org/planet',
      }
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0d1117' } },
      { id: 'water', type: 'fill', source: 'ofm', 'source-layer': 'water',
        paint: { 'fill-color': '#141b24' } },
      { id: 'waterway', type: 'line', source: 'ofm', 'source-layer': 'waterway',
        paint: { 'line-color': '#141b24', 'line-width': 1 } },
      { id: 'landcover', type: 'fill', source: 'ofm', 'source-layer': 'landcover',
        paint: { 'fill-color': '#111618', 'fill-opacity': 0.5 } },
      { id: 'landuse', type: 'fill', source: 'ofm', 'source-layer': 'landuse',
        paint: { 'fill-color': '#131a1f' } },
      { id: 'park', type: 'fill', source: 'ofm', 'source-layer': 'park',
        paint: { 'fill-color': '#0f1a14', 'fill-opacity': 0.8 } },
      { id: 'boundary-country', type: 'line', source: 'ofm', 'source-layer': 'boundary',
        filter: ['==', 'admin_level', 2],
        paint: { 'line-color': '#3a5060', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 1.2, 6, 2, 10, 2.5], 'line-opacity': 0.8 } },
      { id: 'boundary-state', type: 'line', source: 'ofm', 'source-layer': 'boundary',
        filter: ['==', 'admin_level', 4],
        paint: { 'line-color': '#2d4050', 'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.8, 6, 1.4, 10, 2, 14, 2.5], 'line-opacity': ['interpolate', ['linear'], ['zoom'], 3, 0.7, 10, 0.6, 14, 0.45] } },
      { id: 'road-motorway-casing', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk'],
        paint: { 'line-color': '#253545', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 1.5, 12, 4, 16, 8] }, minzoom: 5 },
      { id: 'road-motorway', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'motorway', 'trunk'],
        paint: { 'line-color': '#1a2a38', 'line-width': ['interpolate', ['linear'], ['zoom'], 6, 0.8, 12, 2.5, 16, 5] } },
      { id: 'road-primary', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'primary', 'secondary'],
        paint: { 'line-color': '#172430', 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 12, 1.8, 16, 3.5] } },
      { id: 'road-minor', type: 'line', source: 'ofm', 'source-layer': 'transportation',
        filter: ['in', 'class', 'tertiary', 'minor', 'residential', 'service'],
        paint: { 'line-color': '#141e28', 'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.3, 14, 1.2, 16, 2.2] },
        minzoom: 10 },
      { id: 'building', type: 'fill', source: 'ofm', 'source-layer': 'building',
        paint: { 'fill-color': '#141c24', 'fill-outline-color': '#1a2530' },
        minzoom: 14 },
      { id: 'label-road-major', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'motorway', 'trunk', 'primary', 'secondary'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 10, 9, 14, 11, 18, 13], 'symbol-placement': 'line', 'text-max-angle': 30, 'text-rotation-alignment': 'map', 'text-padding': 2 },
        paint: { 'text-color': '#506878', 'text-halo-color': '#0d1117', 'text-halo-width': 1.5 }, minzoom: 12 },
      { id: 'label-road-minor', type: 'symbol', source: 'ofm', 'source-layer': 'transportation_name',
        filter: ['in', 'class', 'tertiary', 'minor', 'residential', 'service'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 14, 9, 18, 11], 'symbol-placement': 'line', 'text-max-angle': 30, 'text-rotation-alignment': 'map', 'text-padding': 2 },
        paint: { 'text-color': '#3a5060', 'text-halo-color': '#0d1117', 'text-halo-width': 1.2 }, minzoom: 15 },
      { id: 'label-state', type: 'symbol', source: 'ofm', 'source-layer': 'place',
        filter: ['==', 'class', 'state'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 9, 6, 12, 8, 14, 12, 16], 'text-transform': 'uppercase', 'text-letter-spacing': 0.12, 'text-max-width': 8 },
        paint: { 'text-color': ['interpolate', ['linear'], ['zoom'], 4, '#4a6575', 10, '#3d5565'], 'text-halo-color': '#0d1117', 'text-halo-width': 2, 'text-opacity': ['interpolate', ['linear'], ['zoom'], 4, 0.9, 12, 0.6] },
        minzoom: 4 },
      { id: 'label-city', type: 'symbol', source: 'ofm', 'source-layer': 'place',
        filter: ['in', 'class', 'city', 'town', 'village'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Regular'], 'text-size': ['interpolate', ['linear'], ['zoom'], 5, 10, 10, 13], 'text-max-width': 8 },
        paint: { 'text-color': '#7a8f9e', 'text-halo-color': '#0d1117', 'text-halo-width': 1.5 } },
      { id: 'label-country', type: 'symbol', source: 'ofm', 'source-layer': 'place',
        filter: ['==', 'class', 'country'],
        layout: { 'text-field': ['get', 'name:pt'], 'text-font': ['Noto Sans Bold'], 'text-size': ['interpolate', ['linear'], ['zoom'], 3, 10, 6, 14], 'text-transform': 'uppercase', 'text-letter-spacing': 0.15 },
        paint: { 'text-color': '#4a5f6e', 'text-halo-color': '#0d1117', 'text-halo-width': 2 } },
    ]
  };
}

function _buildSatelliteStyle() {
  const H = _HERE_SAT_KEY;
  return {
    version: 8,
    glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
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

  map.on('load', () => {
    _setupMapSources();
    _setupMapInteractions();
    // Se já há dados carregados (mapa aberto da galeria), plotar imediatamente
    if (filteredData.length > 0) renderMarkers();
  });
}

function _setupMapSources() {
  // Limpar layers e source anteriores se existirem (ex: após trocar de layer)
  ['clusters','cluster-count','pdv-points'].forEach(id => {
    try { if (map.getLayer(id)) map.removeLayer(id); } catch(e) {}
  });
  try { if (map.getSource('pdvs')) map.removeSource('pdvs'); } catch(e) {}

  map.addSource('pdvs', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] },
    cluster: true,
    clusterMaxZoom: 12,      // acima de zoom 12, mostra pontos individuais
    clusterRadius: 40,        // raio em pixels para agrupar
    clusterProperties: {      // agregar cor dominante para colorir o cluster
      'has_green':  ['+', ['case', ['==', ['get','color'], _cssVar('--win')], 1, 0]],
      'has_red':    ['+', ['case', ['==', ['get','color'], _cssVar('--lose')], 1, 0]],
    }
  });

  // Layer de clusters — tamanho proporcional à contagem, cor neutra azul
  map.addLayer({
    id: 'clusters',
    type: 'circle',
    source: 'pdvs',
    filter: ['has', 'point_count'],
    paint: {
      'circle-color': _cssVar('--cluster-color'),
      'circle-radius': ['interpolate', ['linear'], ['get', 'point_count'],
        1, 14, 10, 20, 50, 26, 200, 32, 1000, 38
      ],
      'circle-opacity': 0.85,
      'circle-stroke-width': 2,
      'circle-stroke-color': _cssVar('--circle-stroke'),
    },
  });

  // Layer de contagem dos clusters
  map.addLayer({
    id: 'cluster-count',
    type: 'symbol',
    source: 'pdvs',
    filter: ['has', 'point_count'],
    layout: {
      'text-field': ['case',
        ['>=', ['get', 'point_count'], 1000],
        ['concat', ['to-string', ['floor', ['/', ['get', 'point_count'], 1000]]], 'k'],
        ['to-string', ['get', 'point_count']]
      ],
      'text-font': ['Noto Sans Bold'],
      'text-size': 11,
    },
    paint: { 'text-color': _cssVar('--text-canvas') },
  });

  // Layer de pontos individuais (não clusterizados)
  map.addLayer({
    id: 'pdv-points',
    type: 'circle',
    source: 'pdvs',
    filter: ['!', ['has', 'point_count']],
    paint: {
      'circle-color': ['get', 'color'],
      'circle-radius': ['interpolate', ['linear'], ['zoom'], 8, 4, 14, 7, 18, 10],
      'circle-stroke-width': 1.5,
      'circle-stroke-color': _cssVar('--circle-stroke-hover'),
      'circle-opacity': 0.95,
    },
  });
}

function _setupMapInteractions() {
  // Expandir cluster ao clicar
  map.on('click', 'clusters', (e) => {
    const features = map.queryRenderedFeatures(e.point, { layers: ['clusters'] });
    if (!features.length) return;
    const clusterId = features[0].properties.cluster_id;
    const coords = features[0].geometry.coordinates;
    map.getSource('pdvs').getClusterExpansionZoom(clusterId).then(zoom => {
      map.easeTo({ center: coords, zoom: Math.min(zoom + 0.5, 14), duration: 400 });
    }).catch(() => {
      map.easeTo({ center: coords, zoom: map.getZoom() + 2, duration: 400 });
    });
  });

  // Popup ao clicar no ponto
  map.on('click', 'pdv-points', (e) => {
    const props = e.features[0].properties;
    const row = allData.find(r => r._mapId === props._mapId);
    if (!row) return;
    if (_popup) _popup.remove();
    const coords = e.features[0].geometry.coordinates.slice();
    _popup = new maplibregl.Popup({ maxWidth: '340px', closeButton: true, anchor: 'bottom' })
      .setLngLat(coords)
      .setHTML(buildPopup(row))
      .addTo(map);
    // Pan map only if popup is clipped — measure actual popup position vs viewport
    requestAnimationFrame(() => {
      const popupEl = _popup.getElement();
      if (!popupEl) return;
      const rect = popupEl.getBoundingClientRect();
      const mapRect = map.getContainer().getBoundingClientRect();
      // How many pixels the popup top is above the map viewport (negative = clipped)
      const overflow = mapRect.top - rect.top + 16; // 16px breathing room
      if (overflow > 0) {
        // Pan down by exactly the overflow amount (pixel offset)
        map.panBy([0, -overflow], { duration: 300 });
      }
    });
  });

  // Cursor pointer
  map.on('mouseenter', 'clusters', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'clusters', () => map.getCanvas().style.cursor = '');
  map.on('mouseenter', 'pdv-points', () => map.getCanvas().style.cursor = 'pointer');
  map.on('mouseleave', 'pdv-points', () => map.getCanvas().style.cursor = '');
}

// ─── Pin Color ───────────────────────────────────────────────────────────────
function pinColor(row) {
  if (currentMapType === 'places_discovery') return _cssVar('--purple') || '#a855f7';
  const diff = parseFloat(row.percentual_diff_media_dimensao || 0);
  if (diff > 2) return _cssVar('--win');
  if (diff < -2) return _cssVar('--lose');
  return _cssVar('--neutral');
}

// ─── Render Markers (GeoJSON source update) ──────────────────────────────────
function renderMarkers() {
  if (!map) return;

  const _doRender = () => {
    if (!map.getSource('pdvs')) {
      _setupMapSources();
      _setupMapInteractions();
    }

    const features = filteredData
      .filter(r => parseFloat(r.lat) && parseFloat(r.lon))
      .map((r, i) => {
        if (r._mapId === undefined) r._mapId = i;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [parseFloat(r.lon), parseFloat(r.lat)] },
          properties: { color: pinColor(r), _mapId: r._mapId },
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
  const diff = parseFloat(row.percentual_diff_media_dimensao || 0);
  const diffClass = diff > 2 ? 'positive' : diff < -2 ? 'negative' : '';
  const diffLabel = diff > 0 ? `+${diff.toFixed(1)}%` : `${diff.toFixed(1)}%`;

  const shareReis = parseFloat(row.share_reais_sku_dimensao || 0) * 100;
  const shareVol = parseFloat(row.share_volume_sku_dimensao || 0) * 100;
  const shareUn = parseFloat(row.share_unidades_sku_dimensao || 0) * 100;

  const maxShare = Math.max(shareReis, shareVol, shareUn, 1);

  const v360CnpjDisplay = row.cnpj_completo || (row.cnpj || '').split(' - ')[0];
  const addrDisplay = (row.cnpj || '').split(' - ').slice(1).join(' - ');

  return `<div class="popup-inner">
    <div class="popup-header">
      <div class="popup-bandeira">${row.bandeira || 'Bandeira desconhecida'}</div>
      ${row.razao_social && row.razao_social !== row.bandeira ? `<div class="popup-fantasia">${row.razao_social}</div>` : ''}
      <div class="popup-address">${row.geo_address || addrDisplay}</div>
      <div class="popup-cnpj">CNPJ ${v360CnpjDisplay}${row.situacao && row.situacao !== 'ATIVA' ? ` · <span style="color:var(--lose)">${row.situacao}</span>` : ''}${row.atividade ? `<div style="font-size:9px;color:var(--text-muted);margin-top:2px">${row.atividade.slice(0,60)}${row.atividade.length>60?'…':''}</div>` : ''}</div>
    </div>
    <div class="popup-metrics">
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
    <div class="popup-section-title">Share da marca neste PDV</div>
    <div class="popup-share-bars">
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
    <div class="popup-tickets">
      <span class="popup-tickets-label">Tickets na amostra</span>
      <span class="popup-tickets-val">${parseInt(row.tickets_amostra || 0).toLocaleString('pt-BR')}</span>
    </div>
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
  _msState[id] = { options: options, selected: new Set() };
  var wrap = document.getElementById(id);
  var optContainer = wrap.querySelector('.ms-options');
  optContainer.innerHTML = '';
  options.forEach(function(opt) {
    var div = document.createElement('div');
    div.className = 'ms-opt';
    div.dataset.value = opt.value;
    div.dataset.search = opt.label.toLowerCase();
    div.innerHTML = '<input type="checkbox" tabindex="-1"><span class="ms-opt-label">' + _escForHtml(opt.label) + '</span><span class="ms-opt-count">' + opt.count + '</span>';
    div.onclick = function(e) {
      e.stopPropagation();
      var cb = div.querySelector('input');
      cb.checked = !cb.checked;
      if (cb.checked) _msState[id].selected.add(opt.value);
      else _msState[id].selected.delete(opt.value);
      updateMsDisplay(id);
      applyFilters();
    };
    optContainer.appendChild(div);
  });
  updateMsDisplay(id);
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
  wrap.querySelectorAll('.ms-opt input').forEach(function(cb) { cb.checked = false; });
  updateMsDisplay(id);
  applyFilters();
}

function msClearAll(id) {
  msSelectAll(id); // "Limpar" = voltar para "Todas"
}

function msGetSelected(id) {
  return _msState[id] ? _msState[id].selected : new Set();
}

function msReset(id) {
  if (!_msState[id]) return;
  _msState[id].selected.clear();
  var wrap = document.getElementById(id);
  if (wrap) wrap.querySelectorAll('.ms-opt input').forEach(function(cb) { cb.checked = false; });
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
  // Também contar "Não identificado" e "Carregando..."
  var naoIdCount = allData.filter(function(r) { return !r.bandeira || r.bandeira === 'Não identificado' || r.bandeira === 'Carregando...'; }).length;

  var options = Object.keys(groups).sort().map(function(key) {
    return { value: groups[key].display, label: groups[key].display, count: groups[key].count };
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

  filteredData = allData.filter(r => {
    if (selBandeiras.size > 0) {
      // Checar pelo nome agrupado (display) via _bandeiraGroupMap
      const grouped = _bandeiraGroupMap[r.bandeira] || r.bandeira;
      if (!selBandeiras.has(grouped)) return false;
    }
    if (uf && r.uf !== uf) return false;
    if (parseFloat(r.share_reais_sku_dimensao || 0) < shareMin) return false;
    if (parseInt(r.tickets_amostra || 0) < ticketsMin) return false;
    if (oport) {
      const o = parseFloat(r.oportunidade_dimensao || 0);
      if (oport === 'alta'  && o <= 0.05) return false;
      if (oport === 'media' && (o < -0.03 || o > 0.05)) return false;
      if (oport === 'baixa' && o >= -0.03) return false;
    }
    if (perf) {
      const d = parseFloat(r.percentual_diff_media_dimensao || 0);
      if (perf === 'acima' && d <= 2) return false;
      if (perf === 'abaixo' && d >= -2) return false;
    }
    return true;
  });

  renderMarkers();
  updatePanels();
  updateOverlay();
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
  msReset('ms-bandeira');
  document.getElementById('f-uf').value = '';
  document.getElementById('f-share-min').value = 0;
  if (document.getElementById('f-tickets-min')) {
    document.getElementById('f-tickets-min').value = 0;
    syncTicketRange();
  }
  document.getElementById('lbl-share-min').textContent = '0%';
  // lbl-tickets atualizado por syncTicketRange
  ['f-oport','f-perf'].forEach(gid => {
    const badges = document.querySelectorAll(`#${gid} .badge`);
    badges.forEach(b => b.classList.remove('active'));
    badges[0]?.classList.add('active');
  });
  filteredData = [...allData];
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
  const winCount = filteredData.filter(r => parseFloat(r.percentual_diff_media_dimensao||0) > 2).length;
  const shareAvg = avg(filteredData, 'share_reais_sku_dimensao') * 100;
  const bandeiras = new Set(filteredData.map(r => r.bandeira || 'Outros')).size;

  document.getElementById('h-pdvs').textContent = filteredData.length.toLocaleString('pt-BR');
  document.getElementById('h-share').textContent = shareAvg.toFixed(1) + '%';
  document.getElementById('h-win').textContent = winCount.toLocaleString('pt-BR');
  document.getElementById('h-bandeiras').textContent = bandeiras;
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
function updateOverview() {
  const shareAvg = avg(filteredData, 'share_reais_sku_dimensao') * 100;
  const diffAvg = avg(filteredData, 'percentual_diff_media_dimensao');
  document.getElementById('ov-share-val').textContent = shareAvg.toFixed(1);
  const deltaEl = document.getElementById('ov-share-delta');
  deltaEl.textContent = (diffAvg > 0 ? '+' : '') + diffAvg.toFixed(1) + '% vs. média';
  deltaEl.className = 'share-delta ' + (diffAvg >= 0 ? 'pos' : 'neg');

  // Chart: shares (reais, volume, unidades)
  const shareR = avg(filteredData, 'share_reais_sku_dimensao') * 100;
  const shareV = avg(filteredData, 'share_volume_sku_dimensao') * 100;
  const shareU = avg(filteredData, 'share_unidades_sku_dimensao') * 100;
  renderBarChart('chart-shares',
    ['Reais', 'Volume', 'Unidades'],
    [shareR, shareV, shareU],
    [_cssVar('--accent'), _cssVar('--accent-light'), _cssVar('--blue-light')]
  );

  // Chart: PDVs por bandeira
  const grp = groupBy(filteredData, 'bandeira');
  const bandSort = Object.entries(grp).sort((a,b) => b[1].length - a[1].length).slice(0, 8);
  renderHorizBarChart('chart-bandeiras', bandSort.map(e => e[0]), bandSort.map(e => e[1].length));

  // Chart: distribuição de share
  const bins = [0,2,5,10,15,20,30,50,100];
  const labels = bins.slice(0,-1).map((v,i) => `${v}–${bins[i+1]}%`);
  const counts = bins.slice(0,-1).map((v,i) => filteredData.filter(r => {
    const s = parseFloat(r.share_reais_sku_dimensao||0)*100;
    return s >= v && s < bins[i+1];
  }).length);
  renderHistChart('chart-dist', labels, counts);
}

// ─── Ranking Tab ─────────────────────────────────────────────────────────────
function updateRanking() {
  const grp = groupBy(filteredData, 'bandeira');
  const ranked = Object.entries(grp).map(([b, rows]) => ({
    name: b,
    count: rows.length,
    shareAvg: avg(rows, 'share_reais_sku_dimensao') * 100,
    diffAvg: avg(rows, 'percentual_diff_media_dimensao'),
    oportAvg: avg(rows, 'oportunidade_dimensao'),
  })).sort((a,b) => b.shareAvg - a.shareAvg);

  const maxShare = Math.max(...ranked.map(r => r.shareAvg), 1);

  const top = ranked.slice(0, 7);
  const bottom = [...ranked].sort((a,b) => a.shareAvg - b.shareAvg).slice(0, 7);
  const topOport = [...ranked].sort((a,b) => b.oportAvg - a.oportAvg).slice(0, 7);

  function renderRankList(id, items, valueKey, label, badgeFn) {
    const el = document.getElementById(id);
    el.innerHTML = items.map((item, i) => {
      const val = item[valueKey];
      const badge = badgeFn ? badgeFn(item) : '';
      const barColor = item.diffAvg > 2 ? _cssVar('--win') : item.diffAvg < -2 ? _cssVar('--lose') : _cssVar('--neutral');
      return `<div class="rank-item">
        <span class="rank-num">${i+1}</span>
        <span class="rank-name" title="${_escForHtml(item.name)}">${_escForHtml(item.name)}</span>
        <div class="rank-bar-wrap"><div class="rank-bar" style="width:${Math.min(val/maxShare*100,100)}%;background:${barColor}"></div></div>
        <span class="rank-val" style="color:${barColor}">${val.toFixed(1)}%</span>
        ${badge}
      </div>`;
    }).join('');
  }

  renderRankList('rank-top', top, 'shareAvg', '%', item => {
    const cls = item.diffAvg > 2 ? 'win' : item.diffAvg < -2 ? 'lose' : 'neutral';
    const label = item.diffAvg > 2 ? '▲ ganha' : item.diffAvg < -2 ? '▼ perde' : '→ neutro';
    return `<span class="rank-badge ${cls}">${label}</span>`;
  });
  renderRankList('rank-bottom', bottom, 'shareAvg', '%', item => {
    const cls = item.diffAvg > 2 ? 'win' : item.diffAvg < -2 ? 'lose' : 'neutral';
    const label = item.diffAvg > 2 ? '▲ ganha' : item.diffAvg < -2 ? '▼ perde' : '→ neutro';
    return `<span class="rank-badge ${cls}">${label}</span>`;
  });

  // Oportunidade
  const maxOport = Math.max(...topOport.map(r => r.oportAvg), 1);
  const el = document.getElementById('rank-oport');
  el.innerHTML = topOport.map((item, i) => `
    <div class="rank-item">
      <span class="rank-num">${i+1}</span>
      <span class="rank-name" title="${_escForHtml(item.name)}">${_escForHtml(item.name)}</span>
      <div class="rank-bar-wrap"><div class="rank-bar" style="width:${Math.min(item.oportAvg/maxOport*100,100)}%;background:var(--accent)"></div></div>
      <span class="rank-val" style="color:var(--accent-light)">${item.oportAvg.toFixed(2)}</span>
      <span class="rank-badge neutral">${item.count} PDVs</span>
    </div>
  `).join('');
}

// ─── Analysis Tab ────────────────────────────────────────────────────────────
function updateAnalysis() {
  const grp = groupBy(filteredData, 'bandeira');
  const ranked = Object.entries(grp).map(([b, rows]) => ({
    name: b,
    count: rows.length,
    shareAvg: avg(rows, 'share_reais_sku_dimensao') * 100,
    diffAvg: avg(rows, 'percentual_diff_media_dimensao'),
    oportTotal: rows.reduce((s,r) => s + parseFloat(r.oportunidade_dimensao||0), 0),
  }));

  const winBandeiras = ranked.filter(r => r.diffAvg > 3).sort((a,b) => b.diffAvg - a.diffAvg).slice(0,3);
  const loseBandeiras = ranked.filter(r => r.diffAvg < -3).sort((a,b) => a.diffAvg - b.diffAvg).slice(0,3);
  const bestOport = ranked.sort((a,b) => b.oportTotal - a.oportTotal).slice(0,3);

  const totalPDVs = filteredData.length;
  const winCount = filteredData.filter(r => parseFloat(r.percentual_diff_media_dimensao||0) > 2).length;
  const loseCount = filteredData.filter(r => parseFloat(r.percentual_diff_media_dimensao||0) < -2).length;
  const winPct = totalPDVs ? (winCount / totalPDVs * 100).toFixed(0) : 0;
  const losePct = totalPDVs ? (loseCount / totalPDVs * 100).toFixed(0) : 0;

  const cards = [
    {
      icon: '📈',
      title: 'Onde a marca ganha share',
      body: winBandeiras.length
        ? `A marca está <span class="analysis-highlight win">acima da média</span> em ${winCount} PDVs (${winPct}% do total). ${winBandeiras.length ? `Melhor performance em: <span class="analysis-highlight">${winBandeiras.map(b => _escForHtml(b.name)).join(', ')}</span>.` : ''}`
        : `Nenhuma bandeira com performance significativamente acima da média nos filtros selecionados.`
    },
    {
      icon: '📉',
      title: 'Onde a marca perde share',
      body: loseBandeiras.length
        ? `A marca está <span class="analysis-highlight lose">abaixo da média</span> em ${loseCount} PDVs (${losePct}% do total). Risco concentrado em: <span class="analysis-highlight">${loseBandeiras.map(b => _escForHtml(b.name)).join(', ')}</span>.`
        : `Nenhuma bandeira com performance significativamente abaixo da média.`
    },
    {
      icon: '🎯',
      title: 'Maior oportunidade de investimento',
      body: bestOport.length
        ? `Priorizando bandeiras com maior score de oportunidade: <span class="analysis-highlight">${bestOport.map(b => `${_escForHtml(b.name)} (${b.count} PDVs)`).join(', ')}</span>. Esses PDVs têm maior potencial de crescimento de share.`
        : `Sem dados de oportunidade disponíveis.`
    },
    {
      icon: '⚖️',
      title: 'Balanço geral',
      body: `De ${totalPDVs.toLocaleString('pt-BR')} PDVs visíveis, <span class="analysis-highlight win">${winPct}% ganham</span> e <span class="analysis-highlight lose">${losePct}% perdem</span> share vs. a média da dimensão. ${parseFloat(winPct) > parseFloat(losePct) ? 'Cenário <span class="analysis-highlight win">favorável</span> para a marca.' : 'Há espaço relevante para <span class="analysis-highlight">recuperação de share</span>.'}`
    }
  ];

  document.getElementById('analysis-cards').innerHTML = cards.map(c => `
    <div class="analysis-card">
      <div class="analysis-card-header">
        <span class="analysis-card-icon">${c.icon}</span>
        <span class="analysis-card-title">${c.title}</span>
      </div>
      <div class="analysis-card-body">${c.body}</div>
    </div>
  `).join('');

  // Win/Lose chart
  const wlData = ranked.slice(0, 10);
  renderWinLoseChart('chart-winlose',
    wlData.map(r => r.name),
    wlData.map(r => Math.max(r.diffAvg, 0)),
    wlData.map(r => Math.min(r.diffAvg, 0))
  );

  // UF ranking
  const ufGrp = groupBy(filteredData, 'uf');
  const ufRanked = Object.entries(ufGrp)
    .map(([uf, rows]) => ({ name: uf, count: rows.length, shareAvg: avg(rows, 'share_reais_sku_dimensao') * 100 }))
    .sort((a,b) => b.count - a.count).slice(0, 10);
  const maxUf = Math.max(...ufRanked.map(r => r.count), 1);
  document.getElementById('rank-uf').innerHTML = ufRanked.map((item, i) => `
    <div class="rank-item">
      <span class="rank-num">${i+1}</span>
      <span class="rank-name">${_escForHtml(item.name)}</span>
      <div class="rank-bar-wrap"><div class="rank-bar" style="width:${item.count/maxUf*100}%;background:var(--accent)"></div></div>
      <span class="rank-val" style="color:var(--text-dim)">${item.count}</span>
      <span class="rank-badge neutral">${item.shareAvg.toFixed(1)}%</span>
    </div>
  `).join('');
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

function renderBarChart(id, labels, data, colors) {
  destroyChart(id);
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4, borderSkipped: false }] },
    options: { ...chartDefaults, responsive: true, maintainAspectRatio: false,
      scales: { x: { grid: { color: _cssVar('--surface-subtle') }, ticks: { color: _cssVar('--text-muted'), font: { size: 10 } } },
        y: { grid: { color: _cssVar('--surface-subtle') }, ticks: { color: _cssVar('--text-muted'), font: { size: 10 }, callback: v => v.toFixed(1) + '%' } } }
    }
  });
}

function renderHorizBarChart(id, labels, data) {
  destroyChart(id);
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: _cssVar('--accent'), borderRadius: 3, borderSkipped: false }] },
    options: { ...chartDefaults, indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: _cssVar('--surface-subtle') }, ticks: { color: _cssVar('--text-muted'), font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { color: _cssVar('--text-dim'), font: { size: 10 }, callback: v => v.length > 14 ? v.slice(0,14)+'…' : v } }
      }
    }
  });
}

function renderHistChart(id, labels, data) {
  destroyChart(id);
  const ctx = document.getElementById(id).getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: _cssVar('--accent-chart'), borderRadius: 2 }] },
    options: { ...chartDefaults, responsive: true, maintainAspectRatio: false,
      scales: { x: { grid: { display: false }, ticks: { color: _cssVar('--text-muted'), font: { size: 9 }, maxRotation: 45 } },
        y: { grid: { color: _cssVar('--surface-subtle') }, ticks: { color: _cssVar('--text-muted'), font: { size: 10 } } } }
    }
  });
}

function renderWinLoseChart(id, labels, wins, loses) {
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
  filteredData = [...allData];

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
  // Subtítulo do header
  const labels = { geocoder:'📍 Lat/Lon Generator', reverse_geocoder:'🔄 Address Generator', varejo360:'📊 Varejo 360 Analysis', places_discovery:'🔎 Places Discovery' };
  const sub = document.getElementById('logo-map-type');
  if (sub) sub.textContent = labels[currentMapType] || 'by HYPR°';
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
    renderGeocoderList();
  } else {
    if (listEl) listEl.style.display = 'none';
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
    // Varejo 360: full columns with CNPJ, bandeira, receita data
    cols   = ['bandeira', 'cnpj', 'lat', 'lon', 'geo_address', 'uf', 'nome_fantasia', 'razao_social', 'cep'];
    labels = ['Bandeira', 'CNPJ', 'Latitude', 'Longitude', 'Endereco', 'UF', 'Nome_Fantasia', 'Razao_Social', 'CEP'];
  }

  const esc = v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;
  const rows = [labels.join(','), ...data.map(r => cols.map(c => {
    if (c === '_status') return esc(r._geocodeFailed ? 'Não identificado' : (r._ufMismatch ? 'UF Mismatch (' + r._expectedUF + '→' + (r.uf||'?') + ')' : 'OK'));
    if (c === '_input') return esc(r.endereco_geocode || r._endereco_livre || r.endereco || r['endereço'] || r.address || '');
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
  // Restaurar larguras salvas
  try {
    const sw = localStorage.getItem('hypr_sidebar_w');
    const pw = localStorage.getItem('hypr_panel_w');
    if (sw) document.getElementById('sidebar').style.width = sw;
    if (pw) document.getElementById('right-panel').style.width = pw;
  } catch(e) {}

  // Resize sidebar (handle esquerdo)
  setupResizer('sidebar-resizer', 'sidebar', 'right', 160, 420, 'hypr_sidebar_w');
  // Resize painel direito (handle direito)
  setupResizer('panel-resizer', 'right-panel', 'left', 200, 520, 'hypr_panel_w');
}

function setupResizer(handleId, panelId, direction, minW, maxW, storageKey) {
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
    ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg> Recolher'
    : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> Expandir';
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
  // Limpar dados ANTES de mostrar o mapa — evita flash dos dados anteriores
  allData = []; filteredData = [];
  if (map && map.getSource('pdvs')) {
    map.getSource('pdvs').setData({ type: 'FeatureCollection', features: [] });
  }

  const appEl = document.getElementById('app');
  appEl.style.display = 'flex';
  applyMapMode(currentMapType);
  await new Promise(r => setTimeout(r, 50));
  if (!map) initMap();
  await new Promise(r => setTimeout(r, 100));
  if (map) map.resize();

  // Mostrar barra flutuante discreta
  document.getElementById('geo-title-text').textContent = 'Buscando Receita + Geocodificando';
  document.getElementById('geocoding-overlay').classList.add('active');

  // Centralizar mapa no Brasil enquanto carrega
  map.jumpTo({ center: [-47.93, -15.78], zoom: 4 });

  // Limpar cache de geocoding para nova sessão
  Object.keys(_geoCache).forEach(k => delete _geoCache[k]);
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

  allData = [];

  for (let i = 0; i < rawCSVData.length; i += BATCH) {
    if (geocodingCancelled) break;

    const batch = rawCSVData.slice(i, Math.min(i + BATCH, rawCSVData.length));

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

          // Atualizar mapa a cada 50 novos pins (batch GeoJSON update é mais eficiente)
          if (allData.length % 100 === 0) {
            filteredData = [...allData];
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

  geocodingActive = false;
  window.removeEventListener('beforeunload', window._unloadHandler);
  document.removeEventListener('visibilitychange', window._visibilityHandler);

  filteredData = [...allData];
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

  filteredData = [...allData];
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
      filteredData = [...allData]; populateFilters(); applyFilters(); updatePanels();
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
        filteredData = [...allData]; populateFilters(); applyFilters(); updatePanels();
      }

      await new Promise(function(r) { setTimeout(r, ENRICH_DELAY); });
    }

    // Mark any remaining as definitively not identified
    needsEnrich.forEach(function(row) {
      if (!row.bandeira || row.bandeira === 'Carregando...') row.bandeira = 'Não identificado';
    });

    // Cache save is handled by the proxy — no client-side save needed

    // Final render
    filteredData = [...allData];
    populateFilters();
    applyFilters();
    updatePanels();
    renderMarkers();
  }
  
  document.getElementById('geocoding-overlay').classList.remove('active');
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
      filteredData = [...allData];
      renderMarkers();
    }
    await new Promise(r => setTimeout(r, DELAY));
  }

  overlay.classList.remove('active');
  geocodingActive = false;
  window.removeEventListener('beforeunload', window._unloadHandler);
  document.removeEventListener('visibilitychange', window._visibilityHandler);
  filteredData = [...allData];
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
      filteredData = [...allData];
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
    filteredData = [...allData];
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
  // Abrir o modal de salvar — preencher nome se já existe do step2
  var saveModal = document.getElementById('save-modal');
  if (saveModal) {
    saveModal.style.display = 'flex';
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
function handleCSVFile(file) {
  const isXLSX = /\.xlsx?$/i.test(file.name);
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
  const _lsGal = document.getElementById('logo-map-type');
  if (_lsGal) _lsGal.textContent = 'by HYPR°';
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
var _galleryFiltered = []; // Current filtered set

async function loadGallery() {
  var loading = document.getElementById('gallery-loading');
  var grid = document.getElementById('gallery-grid');
  var empty = document.getElementById('gallery-empty');
  var filters = document.getElementById('gallery-filters');
  loading.style.display = 'block';
  grid.style.display = 'none';
  empty.style.display = 'none';
  if (filters) filters.style.display = 'none';
  document.getElementById('gallery-pagination').style.display = 'none';

  try {
    var maps = await sbFetch('saved_maps?select=*&order=created_at.desc&limit=500');
    loading.style.display = 'none';
    if (!maps || maps.length === 0) { empty.style.display = 'block'; return; }
    _galleryMaps = maps;
    // Populate creator dropdown
    var creatorEl = document.getElementById('gf-creator');
    if (creatorEl) {
      var creators = {};
      maps.forEach(function(m) { if (m.created_by) creators[m.created_by] = true; });
      creatorEl.innerHTML = '<option value="">Todos os criadores</option>';
      Object.keys(creators).sort().forEach(function(c) {
        var opt = document.createElement('option');
        opt.value = c; opt.textContent = c.split('@')[0];
        creatorEl.appendChild(opt);
      });
    }
    if (filters) filters.style.display = 'flex';
    _galleryPage = 1;
    applyGalleryFilters();
  } catch (e) {
    loading.innerHTML = '<span style="color:var(--lose)">Erro ao carregar: ' + escHtml(e.message) + '</span>';
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
  
  _galleryFiltered = filtered;
  if (!keepPage) _galleryPage = 1;
  
  if (filtered.length === 0) {
    grid.innerHTML = '';
    grid.style.display = 'none';
    pagEl.style.display = 'none';
    empty.style.display = 'block';
    empty.querySelector('.gallery-empty-title').textContent = searchVal || typeVal || creatorVal ? 'Nenhum mapa encontrado com esses filtros' : 'Nenhum mapa salvo ainda';
  } else {
    empty.style.display = 'none';
    renderGalleryPage();
  }
}

function renderGalleryPage() {
  var grid = document.getElementById('gallery-grid');
  var pagEl = document.getElementById('gallery-pagination');
  var total = _galleryFiltered.length;
  var totalPages = Math.ceil(total / _galleryPerPage);
  
  if (_galleryPage < 1) _galleryPage = 1;
  if (_galleryPage > totalPages) _galleryPage = totalPages;
  
  var start = (_galleryPage - 1) * _galleryPerPage;
  var end = Math.min(start + _galleryPerPage, total);
  var pageItems = _galleryFiltered.slice(start, end);
  
  grid.innerHTML = '';
  for (var i = 0; i < pageItems.length; i++) grid.appendChild(buildMapCard(pageItems[i]));
  grid.style.display = 'grid';
  
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

function buildMapCard(m) {
  const card = document.createElement('div');
  card.className = 'map-card';
  const date = new Date(m.created_at).toLocaleDateString('pt-BR', { day:'2-digit', month:'short', year:'numeric' });
  const dots = Array.from({length:30}, () => {
    const x = 10 + Math.random()*80, y = 10 + Math.random()*80;
    return `<circle cx="${x}%" cy="${y}%" r="${1.5+Math.random()*2}" fill="white" opacity="${0.3+Math.random()*0.5}"/>`;
  }).join('');
  const typeLabels = {
    'geocoder':              { label: '📍 Lat/Lon Generator',  color: '#10b981', bg: 'rgba(16,185,129,0.2)',  c1: '#059669', c2: '#064e3b' },
    'reverse_geocoder':      { label: '🔄 Address Generator',  color: '#22d3ee', bg: 'rgba(34,211,238,0.2)',  c1: '#0891b2', c2: '#0c4a6e' },
    'varejo360':             { label: '📊 Varejo 360',         color: '#f59e0b', bg: 'rgba(245,158,11,0.2)',  c1: '#d97706', c2: '#7c2d12' },
    'varejo360_comparativo': { label: '📈 Attack Plan',    color: '#818cf8', bg: 'rgba(129,140,248,0.2)', c1: '#4f46e5', c2: '#1e1b4b' },
    'places_discovery':      { label: '🔎 Places Discovery',   color: '#c084fc', bg: 'rgba(192,132,252,0.2)', c1: '#9333ea', c2: '#3b0764' },
  };
  const tConf = typeLabels[m.map_type] || typeLabels['varejo360'];
  const periodoStr = m.periodo_label ? ` · ${m.periodo_label}` : '';
  const rowLabel = m.map_type === 'geocoder' ? 'pontos' : m.map_type === 'reverse_geocoder' ? 'endereços' : m.map_type === 'places_discovery' ? 'places' : m.map_type === 'varejo360_comparativo' ? 'bandeiras' : 'PDVs';
  card.innerHTML = `
    <div class="map-card-thumb" style="--thumb-c1:${tConf.c1};--thumb-c2:${tConf.c2}">
      <svg class="map-card-thumb-dots" viewBox="0 0 100 100" preserveAspectRatio="none">${dots}</svg>
      <div class="map-card-badge">${(m.row_count||0).toLocaleString('pt-BR')} ${rowLabel}</div>
      <div style="position:absolute;top:10px;left:10px;z-index:1;font-size:10px;font-weight:600;padding:4px 10px;border-radius:6px;background:rgba(0,0,0,0.6);color:${tConf.color};backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);letter-spacing:0.2px;">${tConf.label}</div>
    </div>
    <div class="map-card-body">
      <div class="map-card-name">${escHtml(m.name)}</div>
      <div class="map-card-desc">${escHtml(m.description||'Sem descrição')}</div>
      <div class="map-card-meta">
        <div>
          <div class="map-card-date">${date}${periodoStr}</div>
          <div class="map-card-user">${escHtml(m.created_by)}</div>
        </div>
        <button class="map-card-share" title="Compartilhar" onclick="event.stopPropagation();openShareModalFromCard('${m.id}')">🔗</button>
        <button class="map-card-del" title="Excluir" onclick="event.stopPropagation();deleteMap('${m.id}',this)">🗑</button>
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
    } else {
      applyGalleryFilters(true);
    }
  } catch(e) { alert('Erro ao excluir: '+e.message); btn.disabled=false; }
}

async function openSavedMap(mapId, name, mapType) {
  // Limpar pendências de geocoding anterior — evita save acidental
  window._pendingMapName = null;
  window._pendingMapDesc = null;
  window._pendingMapType = null;
  window._pendingPeriodo = null;
  rawCSVData = [];
  // Track open map for share feature
  window._currentOpenMapId = mapId;
  var shareBtn = document.getElementById('btn-share-map');
  if (shareBtn && !_isSharedMode) shareBtn.style.display = '';
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

  const overlay = document.getElementById('geocoding-overlay');
  overlay.classList.add('active');
  document.getElementById('geo-current').textContent = `Carregando "${name}"...`;
  document.getElementById('geo-fill').style.width = '0%';
  document.getElementById('geo-pct').textContent = '';
  document.getElementById('geo-ok').textContent = '';
  document.getElementById('geo-fail').textContent = '';
  document.getElementById('geo-eta').textContent = '';

  try {
    // Load map metadata (payload with search context)
    var mapMeta = await sbFetch('saved_maps?id=eq.' + mapId + '&select=payload');
    window._savedMapPayload = (Array.isArray(mapMeta) && mapMeta[0]?.payload) || null;
    window._savedMapId = mapId;

    let page = 0; const PAGE = 1000;
    allData = [];
      map.jumpTo({ center: [-47.93, -15.78], zoom: 4 });

    while (true) {
      const rows = await sbFetch(`map_pdvs?map_id=eq.${mapId}&select=*&offset=${page*PAGE}&limit=${PAGE}`);
      if (!rows || rows.length === 0) break;

      for (const r of rows) {
        allData.push(r);
        // pins adicionados via renderMarkers() após carregamento completo
      }

      const pct = Math.min(99, Math.round(allData.length/500*10));
      document.getElementById('geo-fill').style.width = pct+'%';
      document.getElementById('geo-current').textContent = `${allData.length.toLocaleString('pt-BR')} PDVs carregados...`;
      if (rows.length < PAGE) break;
      page++;
    }

    overlay.classList.remove('active');
  filteredData = [...allData];
  if (allData.length > 0) {
      const _pts = allData.filter(r => r.lat && r.lon);
      if (!_pts.length) return;
      const bounds = _pts.reduce((b, r) => b.extend([parseFloat(r.lon), parseFloat(r.lat)]),
        new maplibregl.LngLatBounds([parseFloat(_pts[0].lon), parseFloat(_pts[0].lat)], [parseFloat(_pts[0].lon), parseFloat(_pts[0].lat)]));
      map.fitBounds(bounds, { padding:[40,40] });
    }
    populateFilters(); updatePanels(); updateOverlay();
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
      updatePlacesBadge(allData.length);
    }
    // Renderizar pins — aguardar style estar pronto se necessário
    if (map.isStyleLoaded() && map.getSource('pdvs')) {
      renderMarkers();
    } else {
      map.once('styledata', () => renderMarkers());
    }
  } catch(e) {
    overlay.classList.remove('active');
    alert('Erro ao carregar mapa: '+e.message);
  }
}

// ─── Modal Salvar ─────────────────────────────────────────────────────────────
function showSaveMapDialog() {
  if (!currentUser || allData.length === 0) {
    console.warn('Cannot save: currentUser=', currentUser, 'allData.length=', allData.length);
    return;
  }
  // Pré-preencher com o nome digitado no step 2
  document.getElementById('save-name').value = window._pendingMapName || '';
  document.getElementById('save-desc').value = window._pendingMapDesc || '';
  document.getElementById('save-status').textContent = '';
  document.getElementById('save-btn').disabled = false;
  // Se já tem nome (Places Discovery always has one), salvar automaticamente
  if (window._pendingMapName) {
    autoSaveAndNotify();
    return;
  }
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
  document.getElementById('save-modal').classList.remove('active');
}

async function saveMapToSupabase() {
  const name = document.getElementById('save-name').value.trim();
  if (!name) { document.getElementById('save-status').textContent = '⚠️ Dê um nome ao mapa para salvar.'; return; }

  const btn = document.getElementById('save-btn');
  const status = document.getElementById('save-status');
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

async function initSharedMode() {
  var params = new URLSearchParams(location.search);
  var shareToken = params.get('share');
  if (!shareToken) return false;

  _isSharedMode = true;
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

    // Buscar PDVs
    var pdvs = [];
    var PAGE = 1000, page = 0;
    while (true) {
      var pdvUrl = SUPABASE_URL + '/rest/v1/map_pdvs?map_id=eq.' + mapMeta.id + '&select=*&offset=' + (page * PAGE) + '&limit=' + PAGE;
      var pResp = await fetch(pdvUrl, { headers: { 'apikey': SUPABASE_ANON, 'Accept': 'application/json' } });
      if (!pResp.ok) break;
      var batch = await pResp.json();
      if (!batch || !batch.length) break;
      pdvs = pdvs.concat(batch);
      if (batch.length < PAGE) break;
      page++;
    }

    // Montar app em modo read-only
    var appEl = document.getElementById('app');
    appEl.style.display = 'flex';
    applyMapMode(mapMeta.map_type || 'varejo360');

    // Header: mostrar nome do mapa, esconder botões de edição
    document.getElementById('logo-map-type').textContent = mapMeta.name || 'Mapa compartilhado';
    document.getElementById('btn-share-map').style.display = 'none';
    document.getElementById('btn-back-gallery').style.display = 'none';

    await new Promise(function(r) { setTimeout(r, 80); });
    if (!map) initMap(); else map.resize();

    allData = pdvs.map(function(r) {
      r.lat = parseFloat(r.lat); r.lon = parseFloat(r.lon);
      return r;
    }).filter(function(r) { return r.lat && r.lon; });
    filteredData = [...allData];

    populateFilters(); applyFilters(); updatePanels(); renderMarkers(); updateOverlay();

    // Zoom to data
    if (allData.length > 0 && map) {
      var bounds = allData.reduce(function(b, r) {
        return [[Math.min(b[0][0], r.lon), Math.min(b[0][1], r.lat)], [Math.max(b[1][0], r.lon), Math.max(b[1][1], r.lat)]];
      }, [[180, 90], [-180, -90]]);
      map.fitBounds(bounds, { padding: 60, maxZoom: 14 });
    }

    return true;
  } catch(e) {
    document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;min-height:100vh;font-family:sans-serif;color:#888;font-size:16px;text-align:center;padding:20px;">' +
      '<div><div style="font-size:48px;margin-bottom:16px;">🔒</div>' + escHtml(e.message) + '<br><br><a href="/" style="color:var(--accent-light,#3b9eff);">Ir para o Geocodify</a></div></div>';
    return true;
  }
}

// ─── Show share button when a saved map is open ─────────────────────────────
window._currentOpenMapId = null;

// ─── Re-enrich: detect and update unidentified PDVs ──────────────────────
function checkReenrichBar() {
  if (_isSharedMode || !currentUser) return;
  var bar = document.getElementById('reenrich-bar');
  if (!bar) return;
  var unidentified = allData.filter(function(r) {
    return r.cnpj && (!r.bandeira || r.bandeira === 'Não identificado' || r.bandeira === 'Carregando...' || r.bandeira === 'Desconhecido');
  });
  if (unidentified.length > 5) {
    document.getElementById('reenrich-count').textContent = unidentified.length;
    bar.style.display = '';
  } else {
    bar.style.display = 'none';
  }
}

function dismissReenrich() {
  var bar = document.getElementById('reenrich-bar');
  if (bar) bar.style.display = 'none';
}

async function startReenrich() {
  var btn = document.getElementById('reenrich-btn');
  btn.disabled = true;
  btn.textContent = 'Atualizando...';

  var needsEnrich = allData.filter(function(r) {
    return r.cnpj && (!r.bandeira || r.bandeira === 'Não identificado' || r.bandeira === 'Carregando...' || r.bandeira === 'Desconhecido');
  });
  if (needsEnrich.length === 0) { dismissReenrich(); return; }

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
  var BATCH = 25;

  for (var i = 0; i < keys.length; i += BATCH * 2) {
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

    btn.textContent = ok + ' atualizados · ' + Math.round(done / needsEnrich.length * 100) + '%';
  }

  // Update UI
  filteredData = [...allData];
  populateFilters(); applyFilters(); updatePanels(); renderMarkers();

  // Save updated PDVs to Supabase if map is saved
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

  btn.textContent = ok + ' nomes atualizados';
  btn.style.borderColor = 'var(--win)';
  btn.style.color = 'var(--win)';
  setTimeout(function() { checkReenrichBar(); btn.disabled = false; btn.textContent = 'Atualizar nomes'; btn.style.borderColor = ''; btn.style.color = ''; }, 3000);
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

// BR_CITIES: 1.708 cidades brasileiras > 20k hab (IBGE Censo 2022)
// Fonte: IBGE DOU 2023, Municipios POP2022
var BR_CITIES = {
  "AC":[["Rio Branco",364756],["Cruzeiro do Sul",91888],["Tarauacá",43467],["Sena Madureira",41343],["Feijó",35426],["Brasiléia",26000],["Senador Guiomard",21454]],
  "AL":[["Maceió",957916],["Arapiraca",234696],["Rio Largo",93927],["Palmeira dos Índios",71574],["Marechal Deodoro",60370],["União dos Palmares",59280],["Penedo",58593],["São Miguel dos Campos",51990],["Delmiro Gouveia",51318],["Coruripe",50414],["Santana do Ipanema",46087],["Teotônio Vilela",38053],["Atalaia",37512],["Girau do Ponciano",36238],["Pilar",35370],["Maragogi",32174],["Campo Alegre",32106],["São Sebastião",31730],["São Luís do Quitunde",30873],["São José da Tapera",30604],["Murici",25187],["Limoeiro de Anadia",24740],["Craíbas",24686],["Igaci",24594],["Satuba",24278],["Porto Calvo",24071],["Viçosa",23972],["Junqueiro",23907],["Matriz de Camaragibe",23857],["Pão de Açúcar",23823],["Traipu",23695],["Feira Grande",22712],["Piranhas",22609],["Mata Grande",21861],["Igreja Nova",21721],["Boca da Mata",21187],["São José da Laje",20813],["Olho d'Água das Flores",20715]],
  "AM":[["Manaus",2063689],["Itacoatiara",103598],["Manacapuru",101883],["Parintins",96372],["Tefé",73669],["Coari",70616],["Tabatinga",66764],["Maués",61204],["Iranduba",61163],["Humaitá",57473],["Manicoré",53914],["São Gabriel da Cachoeira",51795],["Lábrea",45448],["Autazes",41564],["Benjamin Constant",37648],["Boca do Acre",35447],["Eirunepé",33170],["Borba",33080],["São Paulo de Olivença",32967],["Barreirinha",31051],["Careiro",30792],["Presidente Figueiredo",30668],["Carauari",28742],["Santo Antônio do Içá",28211],["Nova Olinda do Norte",27062],["Fonte Boa",25871],["Jutaí",25172],["Rio Preto da Eva",24936],["Ipixuna",24311],["Urucurituba",23945],["Novo Aripuanã",23818],["Boa Vista do Ramos",23785],["Codajás",23549],["Beruri",20718],["Apuí",20647],["Nhamundá",20136]],
  "AP":[["Macapá",442933],["Santana",107618],["Laranjal do Jari",35114],["Oiapoque",27482],["Mazagão",21924]],
  "BA":[["Salvador",2417678],["Feira de Santana",616272],["Vitória da Conquista",370879],["Camaçari",300372],["Juazeiro",237821],["Lauro de Freitas",203331],["Itabuna",186708],["Ilhéus",178649],["Porto Seguro",168326],["Barreiras",159734],["Jequié",158813],["Alagoinhas",151055],["Teixeira de Freitas",145216],["Simões Filho",114559],["Eunápolis",113710],["Paulo Afonso",112870],["Luís Eduardo Magalhães",107909],["Santo Antônio de Jesus",103055],["Guanambi",87817],["Valença",85655],["Jacobina",82590],["Serrinha",80435],["Senhor do Bonfim",74523],["Irecê",74507],["Candeias",72382],["Casa Nova",72086],["Dias d'Ávila",71485],["Campo Formoso",71377],["Brumado",70510],["Conceição do Coité",67825],["Itapetinga",65897],["Bom Jesus da Lapa",65550],["Itaberaba",65073],["Euclides da Cunha",61456],["Cruz das Almas",60348],["Itamaraju",59605],["Ipirá",56876],["Santo Amaro",56012],["Ribeira do Pombal",53566],["Santo Estêvão",52276],["Caetité",52012],["Barra",51092],["Tucano",48736],["Araci",48294],["Poções",48293],["Catu",48148],["Monte Santo",47780],["Seabra",46160],["Jaguaquara",45964],["Xique-Xique",44757],["Livramento de Nossa Senhora",43903],["Mata de São João",42566],["Vera Cruz",42529],["Macaúbas",41859],["São Sebastião do Passé",40958],["Ipiaú",40706],["Remanso",40586],["São Gonçalo dos Campos",39513],["Nova Viçosa",39509],["São Francisco do Conde",38733],["Santa Maria da Vitória",38604],["Sento Sé",38154],["Entre Rios",38098],["Mucuri",37977],["Santaluz",37834],["Jeremoabo",37626],["Cansanção",37439],["Barra do Choça",36539],["Amargosa",36521],["Maragogipe",35859],["Rio Real",35362],["Pilão Arcado",35357],["Conceição do Jacuípe",35308],["Prado",35003],["Serra do Ramalho",34222],["Curaçá",34180],["Itiúba",33872],["Inhambupe",33790],["Morro do Chapéu",33594],["Riachão do Jacuípe",33386],["Capim Grosso",33235],["São Desidério",32828],["Jaguarari",32703],["Canavieiras",32683],["Esplanada",32554],["Correntina",32457],["Gandu",32178],["Pojuca",32136],["Itapicuru",31679],["Cícero Dantas",30749],["Riacho de Santana",30711],["Campo Alegre de Lourdes",30671],["Camamu",30469],["Paratinga",29252],["Cachoeira",29250],["Santa Cruz Cabrália",29185],["Carinhanha",28869],["Muritiba",28707],["Ruy Barbosa",28282],["Itabela",28165],["Irará",28043],["Presidente Tancredo Neves",27734],["Itacaré",27704],["Maracás",27620],["Santa Rita de Cássia",27390],["Nazaré",27060],["Coração de Maria",26692],["Paripiranga",26604],["Ibotirama",26309],["Barra da Estiva",26026],["Queimadas",25988],["Formosa do Rio Preto",25899],["Lapão",25736],["Sobradinho",25475],["Anagé",25438],["Ibirapitanga",25344],["Quijingue",25272],["Cândido Sales",25247],["João Dourado",24854],["Santana",24755],["Castro Alves",24712],["Uauá",24665],["Miguel Calmon",24661],["Iaçu",24607],["Alcobaça",24530],["Maraú",24527],["Wenceslau Guimarães",24474],["Itambé",24394],["Valente",24362],["Nova Soure",24236],["Canarana",24206],["Amélia Rodrigues",24138],["Iraquara",23879],["Conde",23654],["Planalto",23334],["Olindina",22633],["Camacan",22579],["Caculé",22462],["Medeiros Neto",22194],["Ituberá",21902],["Ibicaraí",21665],["Riachão das Neves",21642],["Macarani",21599],["Iguaí",21491],["Uruçuca",21420],["Teofilândia",21176],["Laje",21052],["Tanhaçu",21006],["Santa Bárbara",20952],["Conceição da Feira",20800],["Ibicoara",20785],["Oliveira dos Brejinhos",20715],["Governador Mangabeira",20605],["Caravelas",20580],["Paramirim",20351],["São Felipe",20283],["Belmonte",20121],["Piatã",20086],["Palmas de Monte Alto",20078],["Mutuípe",20037]],
  "CE":[["Fortaleza",2428708],["Caucaia",355679],["Juazeiro do Norte",286120],["Maracanaú",234509],["Sobral",203023],["Itapipoca",131123],["Crato",131050],["Maranguape",105093],["Iguatu",98064],["Quixadá",84168],["Quixeramobim",82177],["Pacatuba",81524],["Tianguá",81506],["Aquiraz",80645],["Crateús",76390],["Aracati",75113],["Barbalha",75033],["Horizonte",74755],["Canindé",74174],["Eusébio",74170],["Russas",72928],["Cascavel",72720],["Pacajus",70983],["Acaraú",65264],["Itaitinga",64650],["Icó",62642],["Camocim",62326],["Morada Nova",61443],["Tauá",61227],["Viçosa do Ceará",59712],["Limoeiro do Norte",59560],["Trairi",58415],["São Gonçalo do Amarante",54143],["Granja",53344],["Beberibe",53114],["Brejo Santo",51090],["Boa Viagem",50411],["São Benedito",47640],["Itapajé",46426],["Mauriti",45561],["Acopiara",44962],["Itarema",42957],["Amontada",42156],["Guaraciaba do Norte",42053],["Ipu",41081],["Pedra Branca",40187],["Santa Quitéria",40183],["Várzea Alegre",38984],["Paracuru",38980],["Pentecoste",37813],["Mombaça",37735],["Massapê",37697],["Missão Velha",36822],["Ipueiras",36798],["Baturité",35218],["Jaguaribe",33726],["Bela Cruz",32775],["Ubajara",32767],["Paraipaba",32216],["Jaguaruana",31701],["Parambu",31445],["Lavras da Mangabeira",30802],["Nova Russas",30699],["Tabuleiro do Norte",30652],["Santana do Acaraú",30628],["Cruz",29761],["Novo Oriente",27545],["Jardim",27411],["Redenção",27214],["Caririaçu",26320],["Milagres",25900],["Marco",25799],["Jijoca de Jericoacoara",25555],["Aracoiaba",25553],["Campos Sales",25135],["Tamboril",24815],["Ocara",24493],["Guaiúba",24325],["Senador Pompeu",24266],["Forquilha",24173],["Independência",24024],["Ibiapina",23965],["Jucás",23922],["Irauçuba",23915],["Aurora",23714],["Pindoretama",23391],["Morrinhos",22753],["Barreira",22392],["Cedro",22344],["Assaré",21697],["Icapuí",21433],["Coreaú",20953],["Quixeré",20874],["Itatira",20424],["Quiterianópolis",20213],["Uruburetama",20189],["Chorozinho",20163]],
  "DF":[["Brasília",2817381]],
  "ES":[["Serra",520653],["Vila Velha",467722],["Cariacica",353491],["Vitória",322869],["Cachoeiro de Itapemirim",185786],["Linhares",166786],["Guarapari",124656],["São Mateus",123752],["Colatina",120033],["Aracruz",94765],["Viana",73423],["Nova Venécia",49065],["Barra de São Francisco",42498],["Marataízes",41929],["Santa Maria de Jetibá",41636],["Itapemirim",39832],["Castelo",36930],["Domingos Martins",35416],["São Gabriel da Palha",32252],["Afonso Cláudio",30684],["Baixo Guandu",30674],["Anchieta",29984],["Guaçuí",29358],["Alegre",29177],["Jaguaré",28931],["Iúna",28590],["Conceição da Barra",27458],["Sooretama",26502],["Ibatiba",25380],["Mimoso do Sul",24475],["Pinheiros",23915],["Venda Nova do Imigrante",23831],["Santa Teresa",22808],["Piúma",22300],["Ecoporanga",21992],["Pedro Canário",21522]],
  "GO":[["Goiânia",1437366],["Aparecida de Goiânia",527796],["Anápolis",398869],["Rio Verde",225696],["Águas Lindas de Goiás",225693],["Luziânia",209129],["Valparaíso de Goiás",198861],["Senador Canedo",155635],["Trindade",142431],["Formosa",115901],["Catalão",114427],["Itumbiara",107970],["Jataí",105729],["Planaltina",105031],["Novo Gama",103804],["Caldas Novas",98622],["Cidade Ocidental",91767],["Goianésia",73707],["Santo Antônio do Descoberto",72127],["Goianira",71916],["Mineiros",70081],["Cristalina",62337],["Inhumas",52204],["Morrinhos",51351],["Quirinópolis",48447],["Jaraguá",45223],["Itaberaí",44734],["Porangatu",44317],["Uruaçu",42546],["Santa Helena de Goiás",38492],["Iporá",35684],["Goiatuba",35664],["Padre Bernardo",34967],["Niquelândia",34964],["Posse",34914],["Bela Vista de Goiás",34445],["São Luís de Montes Belos",33852],["Pires do Rio",32373],["Nerópolis",31932],["Palmeiras de Goiás",31858],["Hidrolândia",27742],["Minaçu",27075],["Alexânia",27008],["Pirenópolis",26690],["Itapuranga",26113],["Ipameri",25548],["Cocalzinho de Goiás",25016],["Piracanjuba",24883],["Goiás",24071],["Bom Jesus de Goiás",23958],["Silvânia",22245],["Ceres",22046],["São Miguel do Araguaia",21900],["Acreúna",21568],["Itapaci",21087]],
  "MA":[["São Luís",1037775],["Imperatriz",273110],["São José de Ribamar",244579],["Timon",174465],["Caxias",156973],["Paço do Lumiar",145643],["Codó",114275],["Açailândia",106550],["Bacabal",103711],["Balsas",101767],["Santa Inês",85014],["Pinheiro",84621],["Barra do Corda",84532],["Chapadinha",81386],["Grajaú",73872],["Barreirinhas",65589],["Itapecuru Mirim",60440],["Coroatá",59566],["Santa Luzia",57635],["Buriticupu",55499],["Tutóia",53356],["Viana",51442],["São Bento",46395],["Presidente Dutra",45155],["Lago da Pedra",44403],["Vargem Grande",43261],["Coelho Neto",41658],["Santa Helena",41561],["Zé Doca",40801],["Colinas",40316],["Araioses",39052],["São Mateus do Maranhão",38829],["Rosário",38475],["Turiaçu",37491],["Amarante do Maranhão",37085],["Pedreiras",37050],["Santa Rita",37035],["Tuntum",36251],["Brejo",34120],["São Domingos do Maranhão",34034],["Estreito",33294],["Bom Jardim",33100],["Urbano Santos",32812],["Penalva",32511],["Matões",32174],["Turilândia",31638],["Cururupu",31558],["Pindaré-Mirim",31429],["Parnarama",31250],["Vitorino Freire",30845],["Raposa",30839],["Vitória do Mearim",30805],["Buriti",29685],["Arari",29472],["Bom Jesus das Selvas",28599],["Monção",27751],["São Bernardo",26943],["Timbiras",26484],["Alto Alegre do Pindaré",25710],["Humberto de Campos",25680],["Arame",25517],["Anajatuba",25322],["São João dos Patos",25020],["Icatu",24794],["João Lisboa",24709],["Pedro do Rosário",24320],["Santa Luzia do Paruá",24307],["Cantanhede",24303],["Carutapera",24238],["Carolina",24062],["Alto Alegre do Maranhão",24048],["Santa Quitéria do Maranhão",23957],["Porto Franco",23903],["Miranda do Norte",23864],["Aldeias Altas",23286],["Governador Nunes Freire",23128],["Dom Pedro",23053],["Itinga do Maranhão",22513],["Trizidela do Vale",22484],["Buriti Bravo",22455],["Riachão",22145],["Matinha",22034],["Pio XII",21886],["Maracaçumé",21149],["Palmeirândia",21059],["Mirador",21030],["Peritoró",20479],["Paulo Ramos",20341]],
  "MG":[["Belo Horizonte",2315560],["Uberlândia",713224],["Contagem",621863],["Juiz de Fora",540756],["Montes Claros",414240],["Betim",411846],["Uberaba",337836],["Ribeirão das Neves",329794],["Governador Valadares",257171],["Divinópolis",231091],["Ipatinga",227731],["Sete Lagoas",227397],["Santa Luzia",219132],["Ibirité",170537],["Poços de Caldas",163742],["Patos de Minas",159235],["Pouso Alegre",152217],["Teófilo Otoni",137418],["Varginha",136467],["Conselheiro Lafaiete",131621],["Sabará",129380],["Vespasiano",129021],["Barbacena",125317],["Araguari",117808],["Itabira",113343],["Passos",111939],["Nova Lima",111697],["Araxá",111691],["Nova Serrana",105552],["Lavras",104761],["Coronel Fabriciano",104736],["Muriaé",104108],["Ubá",103365],["Ituiutaba",102217],["Itaúna",97669],["Pará de Minas",97139],["Paracatu",94023],["Itajubá",93073],["Manhuaçu",91886],["São João del Rei",90225],["Patrocínio",89826],["Caratinga",87360],["Unaí",86619],["Esmeraldas",85598],["Timóteo",81579],["Curvelo",80665],["João Monlevade",80187],["Alfenas",78970],["Viçosa",76430],["Três Corações",75485],["Lagoa Santa",75145],["Ouro Preto",74821],["São Sebastião do Paraíso",71796],["Janaúba",70699],["Formiga",68248],["Cataguases",66261],["Januária",65150],["Pedro Leopoldo",62580],["Mariana",61387],["Frutal",58588],["Ponte Nova",57776],["Pirapora",55606],["Três Pontas",55255],["Extrema",53482],["Itabirito",53365],["Congonhas",52890],["São Francisco",52762],["Campo Belo",52277],["Bom Despacho",51737],["Lagoa da Prata",51412],["Leopoldina",51145],["Guaxupé",50911],["Bocaiúva",48032],["Diamantina",47702],["Monte Carmelo",47692],["João Pinheiro",46801],["Igarapé",45847],["Santana do Paraíso",44800],["São Lourenço",44798],["Santos Dumont",42406],["Arcos",41416],["São Gotardo",40910],["Santa Rita do Sapucaí",40635],["Andradas",40553],["Almenara",40364],["Salinas",40178],["Boa Esperança",39848],["Capelinha",39626],["Oliveira",39262],["Visconde do Rio Branco",39160],["Brumadinho",38915],["Caeté",38776],["Ouro Branco",38724],["Iturama",38295],["Mateus Leme",37841],["Machado",37684],["Jaíba",37660],["Matozinhos",37618],["Porteirinha",37438],["Sarzedo",36844],["Piumhi",36062],["Nanuque",35038],["São Joaquim de Bicas",34348],["Araçuaí",34297],["Várzea da Palma",33744],["Taiobeiras",33050],["Itamarandiba",32948],["Guanhães",32244],["Ouro Fino",32094],["Brasília de Minas",32025],["Carangola",31240],["Pompéu",31047],["Barão de Cocais",30778],["Além Paraíba",30717],["Juatuba",30716],["Santa Bárbara",30466],["Espinosa",30443],["Cláudio",30159],["Cambuí",29536],["Carmo do Paranaíba",29011],["Três Marias",28895],["Coromandel",28894],["Conceição das Alagoas",28381],["Prata",28342],["Rio Pardo de Minas",28271],["Mutum",27635],["Santo Antônio do Monte",27295],["Novo Cruzeiro",26975],["Pitangui",26685],["Sacramento",26670],["Mantena",26535],["Elói Mendes",26336],["São José da Lapa",26315],["Campos Gerais",26105],["Camanducaia",26097],["São João Nepomuceno",25565],["Jacutinga",25525],["Tupaciguara",25470],["Coração de Jesus",25377],["Aimorés",25269],["Nepomuceno",25018],["Pedra Azul",24410],["Minas Novas",24405],["Paraopeba",24107],["Espera Feliz",24102],["Monte Sião",24089],["Buritis",24030],["Jequitinhonha",24007],["São Gonçalo do Sapucaí",23959],["São João da Ponte",23930],["Belo Oriente",23928],["Buritizeiro",23910],["São João do Paraíso",23910],["Carandaí",23812],["Bambuí",23546],["Corinto",23532],["Carmo do Cajuru",23479],["Francisco Sá",23476],["Raul Soares",23423],["Conceição do Mato Dentro",23163],["Inhapim",22692],["Abaeté",22675],["Ibiá",22229],["Serro",21952],["Muzambinho",21891],["Paraguaçu",21723],["Perdões",21384],["Caxambu",21056],["Itapecerica",21046],["Itambacuri",21042],["Santa Vitória",20973],["Carmo do Rio Claro",20954],["Monte Santo de Minas",20890],["Lajinha",20835],["Conselheiro Pena",20824],["Divino",20706],["Campestre",20696],["Manhumirim",20613],["Paraisópolis",20445],["Lambari",20414],["Jaboticatubas",20406],["Monte Azul",20328],["Ervália",20255],["Monte Alegre de Minas",20170],["Medina",20156],["Barroso",20080],["Turmalina",20000]],
  "MS":[["Campo Grande",898100],["Dourados",243367],["Três Lagoas",132152],["Corumbá",96268],["Ponta Porã",92017],["Naviraí",50457],["Nova Andradina",48563],["Sidrolândia",47118],["Aquidauana",46803],["Maracaju",45047],["Paranaíba",40957],["Amambai",39325],["Rio Brilhante",37601],["Coxim",32151],["Chapadão do Sul",30993],["Caarapó",30612],["São Gabriel do Oeste",29579],["Ivinhema",27821],["Aparecida do Taboado",27674],["Costa Rica",26037],["Miranda",25536],["Itaporã",24137],["Anastácio",24114],["Jardim",23981],["Bonito",23659],["Ribas do Rio Pardo",23150],["Bataguassu",23031],["Nova Alvorada do Sul",21822],["Bela Vista",21613],["Ladário",21522],["Cassilândia",20988],["Fátima do Sul",20609]],
  "MT":[["Cuiabá",650877],["Várzea Grande",300078],["Rondonópolis",244911],["Sinop",196312],["Sorriso",110635],["Tangará da Serra",106434],["Cáceres",89681],["Primavera do Leste",85146],["Lucas do Rio Verde",83798],["Barra do Garças",69210],["Alta Floresta",58613],["Nova Mutum",55839],["Pontes e Lacerda",52018],["Campo Novo do Parecis",45899],["Juína",45869],["Campo Verde",44585],["Confresa",35075],["Juara",34906],["Peixoto de Azevedo",32714],["Colíder",31370],["Poconé",31217],["Guarantã do Norte",31024],["Barra do Bugres",29403],["Água Boa",29219],["Sapezal",28944],["Jaciara",28569],["Mirassol d'Oeste",26785],["Querência",26769],["Paranatinga",26423],["Canarana",25858],["Colniza",25766],["Aripuanã",24626],["Nova Xavantina",24345],["Poxoréu",23283],["Diamantino",21941],["Matupá",20091]],
  "PA":[["Belém",1303403],["Ananindeua",478778],["Santarém",331942],["Parauapebas",267836],["Marabá",266533],["Castanhal",192256],["Abaetetuba",158188],["Cametá",134184],["Barcarena",126650],["Altamira",126279],["Itaituba",123314],["Bragança",123082],["Marituba",111785],["Breves",106968],["Paragominas",105550],["Tucuruí",91306],["Redenção",85597],["Moju",84094],["Canaã dos Carajás",77079],["Santa Izabel do Pará",73019],["Tailândia",72493],["Capanema",70394],["Alenquer",69377],["Oriximiná",68294],["Tomé-Açu",67585],["São Félix do Xingu",65418],["Igarapé-Miri",64831],["Benevides",63567],["Portel",62503],["Novo Repartimento",60732],["Monte Alegre",60012],["Acará",59023],["Viseu",58692],["Dom Eliseu",58484],["Capitão Poço",56506],["Rondon do Pará",53143],["São Miguel do Guamá",52894],["Xinguara",52893],["Óbidos",52229],["Baião",51641],["Juruti",50881],["Vigia",50832],["Itupiranga",49754],["Breu Branco",45712],["Muaná",45368],["Salinópolis",44772],["Conceição do Araguaia",44617],["Augusto Corrêa",44573],["Uruará",43558],["Curuçá",41262],["Pacajá",41097],["Porto de Moz",40597],["Tucumã",39550],["Ulianópolis",37972],["Afuá",37765],["Jacundá",37707],["Igarapé-Açu",35797],["Rurópolis",35769],["Prainha",35577],["Mãe do Rio",34353],["Almeirim",34280],["Curralinho",33903],["Oeiras do Pará",33844],["Novo Progresso",33638],["Ourilândia do Norte",32467],["Santana do Araguaia",32413],["Bagre",31892],["Anapu",31850],["Gurupá",31786],["Irituia",30955],["São Domingos do Capim",30599],["Ipixuna do Pará",30329],["Limoeiro do Ajuru",29569],["Tracuateua",28595],["Eldorado do Carajás",28192],["Anajás",28011],["Melgaço",27881],["Santo Antônio do Tauá",27461],["Mocajuba",27198],["Medicilândia",27094],["Concórdia do Pará",26881],["Marapanim",26573],["Goianésia do Pará",26362],["Maracanã",25971],["São Sebastião da Boa Vista",25643],["Ponta de Pedras",24984],["Brasil Novo",24718],["Garrafão do Norte",24703],["Santa Maria do Pará",24624],["Bujaru",24383],["São Geraldo do Araguaia",24255],["Soure",24204],["Salvaterra",24129],["Jacareacanga",24042],["Cachoeira do Arari",23981],["Aurora do Pará",23774],["Mojuí dos Campos",23501],["Senador José Porfírio",22576],["São Domingos do Araguaia",21092],["Santa Bárbara do Pará",21087],["Chaves",20757],["São João de Pirabas",20689],["Nova Esperança do Piriá",20478],["Santa Luzia do Pará",20370]],
  "PB":[["João Pessoa",833932],["Campina Grande",419379],["Santa Rita",149910],["Patos",103165],["Bayeux",82742],["Sousa",67259],["Cabedelo",66519],["Cajazeiras",63239],["Guarabira",57484],["Sapé",51306],["Queimadas",47658],["Mamanguape",44599],["Pombal",32473],["Monteiro",32277],["São Bento",32235],["Esperança",31231],["Catolé do Rocha",30661],["Pedras de Fogo",29662],["Lagoa Seca",27730],["Conde",27605],["Solânea",26774],["Alagoa Grande",26062],["Rio Tinto",24581],["Itaporanga",23940],["Itabaiana",23182],["Bananeiras",23134],["Areia",22633],["Alhandra",21730],["Mari",21512],["Caaporã",21193],["Princesa Isabel",21114],["Alagoa Nova",21013]],
  "PE":[["Recife",1488920],["Jaboatão dos Guararapes",644037],["Petrolina",386791],["Caruaru",377911],["Olinda",349976],["Paulista",342167],["Cabo de Santo Agostinho",203440],["Camaragibe",147771],["Garanhuns",142526],["Vitória de Santo Antão",134084],["Igarassu",115196],["São Lourenço da Mata",111249],["Ipojuca",98932],["Abreu e Lima",98462],["Santa Cruz do Capibaribe",98254],["Serra Talhada",92228],["Gravatá",86516],["Araripina",85088],["Goiana",81055],["Belo Jardim",79507],["Carpina",79293],["Arcoverde",77742],["Ouricuri",65245],["Surubim",64183],["Pesqueira",62610],["Salgueiro",62372],["Bezerros",61794],["Escada",59872],["Paudalho",56665],["Limoeiro",56510],["Moreno",55292],["Palmares",54584],["Buíque",52097],["São Bento do Una",49370],["Brejo da Madre de Deus",48645],["Timbaúba",46147],["Bom Conselho",44103],["Águas Belas",41548],["Toritama",41137],["Santa Maria da Boa Vista",40578],["Barreiros",40121],["Afogados da Ingazeira",40004],["Lajedo",39582],["Sirinhaém",37596],["Bom Jardim",37497],["Bonito",37316],["Custódia",37245],["São Caitano",37126],["Aliança",35741],["Itambé",34935],["São José do Belmonte",34843],["Bodocó",34478],["Petrolândia",34161],["Ribeirão",33507],["Sertânia",32729],["Catende",32156],["Exu",31843],["Itaíba",31611],["São José do Egito",31004],["Nazaré da Mata",30648],["Trindade",30321],["Cabrobó",30294],["Floresta",30069],["Ipubi",29009],["Glória do Goitá",28916],["Caetés",28827],["Passira",28340],["Itapissuma",27749],["João Alfredo",27725],["Tabira",27623],["Pombos",27552],["Ibimirim",27346],["Água Preta",26461],["Vicência",26355],["Inajá",25740],["Tupanatinga",25536],["Manari",25432],["Taquaritinga do Norte",24736],["Condado",24587],["Ilha de Itamaracá",24540],["Canhotinho",24344],["Lagoa Grande",24088],["Tacaratu",23902],["Macaparana",23879],["São João",23817],["Agrestina",23779],["Tamandaré",23561],["Cupira",23518],["Panelas",22991],["Pedra",22795],["Vertentes",21959],["Orobó",21841],["Feira Nova",21427],["Altinho",20674],["Riacho das Almas",20641],["Chã Grande",20546],["Flores",20347],["Rio Formoso",20009]],
  "PI":[["Teresina",866300],["Parnaíba",162159],["Picos",83090],["Piripiri",65538],["Floriano",62036],["Barras",47938],["Altos",47453],["União",46119],["Campo Maior",45793],["José de Freitas",42559],["Esperantina",40970],["São Raimundo Nonato",38934],["Oeiras",38161],["Pedro II",37894],["Miguel Alves",32150],["Luís Correia",30641],["Piracuruca",28846],["Bom Jesus",28796],["Cocal",28212],["Corrente",27278],["Batalha",26300],["Luzilândia",25375],["Uruçuí",25203],["Valença do Piauí",22279],["São João do Piauí",21421],["Paulistana",21055]],
  "PR":[["Curitiba",1773718],["Londrina",555965],["Maringá",409657],["Ponta Grossa",358371],["Cascavel",348051],["São José dos Pinhais",329628],["Foz do Iguaçu",285415],["Colombo",232212],["Guarapuava",182093],["Araucária",151666],["Toledo",150470],["Fazenda Rio Grande",148873],["Paranaguá",145829],["Campo Largo",136327],["Apucarana",130134],["Pinhais",127019],["Almirante Tamandaré",119825],["Arapongas",119138],["Piraquara",118730],["Sarandi",118455],["Umuarama",117095],["Cambé",107208],["Campo Mourão",99432],["Francisco Beltrão",96666],["Paranavaí",92001],["Pato Branco",91836],["Cianorte",79527],["Telêmaco Borba",75042],["Castro",73075],["Rolândia",71670],["Irati",59250],["Marechal Cândido Rondon",55836],["União da Vitória",55033],["Medianeira",54369],["Ibiporã",51603],["Prudentópolis",49393],["Palmas",48247],["Campina Grande do Sul",47825],["Paiçandu",45962],["Cornélio Procópio",45206],["Lapa",45003],["Dois Vizinhos",44869],["Santo Antônio da Platina",44369],["São Mateus do Sul",42366],["Guaratuba",42062],["Marialva",41851],["Jacarezinho",40375],["Matinhos",39259],["Rio Branco do Sul",37558],["Assis Chateaubriand",36808],["Mandaguari",36716],["Jaguariaíva",35141],["Palotina",35011],["Palmeira",33855],["Pitanga",33678],["Ivaiporã",32720],["Laranjeiras do Sul",32227],["Guaíra",32097],["Mandaguaçu",31457],["Rio Negro",31324],["Bandeirantes",31273],["Itaperuçu",31217],["Quedas do Iguaçu",30738],["Pontal do Paraná",30425],["Campo Magro",30160],["Imbituva",29924],["Pinhão",29886],["São Miguel do Iguaçu",29122],["Ibaiti",28830],["Goioerê",28437],["Mandirituba",27439],["Nova Esperança",26585],["Arapoti",25777],["Santa Helena",25492],["Astorga",25475],["Ubiratã",24749],["Reserva",24573],["Santa Terezinha de Itaipu",24262],["Ortigueira",24192],["Quatro Barras",24191],["Cruzeiro do Oeste",23831],["Santo Antônio do Sudoeste",23673],["Piraí do Sul",23651],["Coronel Vivida",23331],["Carambeí",23283],["Loanda",23225],["Cambará",23212],["Colorado",22896],["Siqueira Campos",22811],["Jandaia do Sul",21408],["Chopinzinho",21085],["Capanema",20481]],
  "RJ":[["Rio de Janeiro",6211223],["São Gonçalo",896744],["Duque de Caxias",808161],["Nova Iguaçu",785867],["Campos dos Goytacazes",483540],["Belford Roxo",483087],["Niterói",481749],["São João de Meriti",440962],["Petrópolis",278881],["Volta Redonda",261563],["Macaé",246391],["Magé",228127],["Itaboraí",224267],["Cabo Frio",222161],["Maricá",197277],["Nova Friburgo",189939],["Barra Mansa",169894],["Angra dos Reis",167434],["Mesquita",167127],["Teresópolis",165123],["Rio das Ostras",156491],["Nilópolis",146774],["Queimados",140523],["Araruama",129671],["Resende",129612],["Itaguaí",116841],["São Pedro da Aldeia",104029],["Itaperuna",101041],["Japeri",96289],["Barra do Piraí",92883],["Saquarema",89559],["Seropédica",80596],["Três Rios",78346],["Valença",68088],["Cachoeiras de Macacu",56943],["Rio Bonito",56276],["Guapimirim",51696],["Casimiro de Abreu",46110],["Paraty",45243],["São Francisco de Itabapoana",45059],["Paraíba do Sul",42063],["Paracambi",41375],["Santo Antônio de Pádua",41325],["Mangaratiba",41220],["Armação dos Búzios",40006],["São Fidélis",38961],["São João da Barra",36573],["Bom Jesus do Itabapoana",35173],["Vassouras",33976],["Tanguá",31086],["Arraial do Cabo",30986],["Itatiaia",30908],["Paty do Alferes",29619],["Bom Jardim",28102],["Iguaba Grande",27920],["Piraí",27474],["Miracema",26881],["Miguel Pereira",26582],["Pinheiral",24298],["Itaocara",22919],["Quissamã",22393],["São José do Vale do Rio Preto",22080],["Silva Jardim",21352],["Conceição de Macabu",21104],["Cordeiro",20783],["Porto Real",20373]],
  "RN":[["Natal",751300],["Mossoró",264577],["Parnamirim",252716],["São Gonçalo do Amarante",115838],["Macaíba",82249],["Ceará-Mirim",79115],["Extremoz",61635],["Caicó",61146],["Açu",56496],["São José de Mipibu",47286],["Currais Novos",41313],["Santa Cruz",37313],["Apodi",35897],["Nova Cruz",34204],["João Câmara",33290],["Touros",33035],["Nísia Floresta",31942],["Pau dos Ferros",30479],["Canguaretama",29668],["Macau",27369],["Baraúna",26913],["Goianinha",26741],["Areia Branca",24093],["São Miguel",23537],["Monte Alegre",23031],["Santo Antônio",22177],["Parelhas",21499]],
  "RO":[["Porto Velho",460434],["Ji-Paraná",124333],["Ariquemes",96833],["Vilhena",95832],["Cacoal",86887],["Rolim de Moura",56406],["Jaru",50591],["Guajará-Mirim",39387],["Pimenta Bueno",35079],["Ouro Preto do Oeste",35044],["Machadinho D'Oeste",30707],["Espigão D'Oeste",29414],["Buritis",27992],["Nova Mamoré",25444],["Candeias do Jamari",22310],["Alta Floresta D'Oeste",21494],["São Miguel do Guaporé",20746]],
  "RR":[["Boa Vista",413486],["Rorainópolis",32647],["Alto Alegre",21096],["Caracaraí",20957]],
  "RS":[["Porto Alegre",1332833],["Caxias do Sul",463501],["Canoas",347657],["Pelotas",325685],["Santa Maria",271735],["Gravataí",265074],["Novo Hamburgo",227646],["Viamão",224124],["São Leopoldo",217409],["Passo Fundo",206215],["Rio Grande",191900],["Alvorada",187315],["Cachoeirinha",136258],["Santa Cruz do Sul",133246],["Sapucaia do Sul",132107],["Bento Gonçalves",123151],["Bagé",117938],["Uruguaiana",117210],["Erechim",105705],["Lajeado",92951],["Guaíba",92924],["Ijuí",84780],["Sant'Ana do Livramento",84421],["Cachoeira do Sul",80070],["Santa Rosa",76963],["Santo Ângelo",76917],["Esteio",76137],["Sapiranga",75648],["Alegrete",72409],["Farroupilha",70286],["Venâncio Aires",68763],["Montenegro",64322],["Vacaria",64197],["Capão da Canoa",63594],["Campo Bom",62886],["Camaquã",62200],["Carazinho",61804],["São Borja",59676],["Cruz Alta",58913],["São Gabriel",58487],["Tramandaí",54387],["Taquara",53240],["Parobé",52052],["Canguçu",49680],["Canela",48946],["Santiago",48938],["Estância Velha",47924],["Osório",47396],["Marau",45124],["Panambi",43515],["Santo Antônio da Patrulha",42947],["São Lourenço do Sul",41989],["Torres",41751],["Gramado",40134],["Eldorado do Sul",39559],["Dom Pedrito",36981],["Rosário do Sul",36630],["Itaqui",35768],["Charqueadas",35012],["São Luiz Gonzaga",34752],["Rio Pardo",34654],["Garibaldi",34335],["Portão",34071],["Igrejinha",33321],["Palmeira das Missões",33216],["Teutônia",32797],["Frederico Westphalen",32627],["Caçapava do Sul",32515],["Estrela",32183],["Santa Vitória do Palmar",30983],["Flores da Cunha",30892],["Dois Irmãos",30709],["Carlos Barbosa",30420],["Soledade",29991],["Nova Santa Rita",29024],["Candelária",28906],["Lagoa Vermelha",27659],["Triunfo",27498],["Imbé",26824],["Vera Cruz",26714],["Jaguarão",26603],["Capão do Leão",26487],["Nova Prata",25692],["São José do Norte",25443],["Três Passos",25436],["Guaporé",25268],["Taquari",25198],["Três de Maio",24916],["Tapejara",24557],["São Sebastião do Caí",24428],["Veranópolis",24021],["Três Coroas",23920],["Encruzilhada do Sul",23819],["Quaraí",23500],["Nova Petrópolis",23300],["Ivoti",22983],["Encantado",22962],["Sarandi",22851],["Arroio do Meio",21958],["São Francisco de Paula",21893],["Ibirubá",21583],["Rolante",21253],["São Sepé",21219],["São Marcos",21084],["São Jerônimo",21028],["Nova Hartz",20088],["Tupanciretã",20005]],
  "SC":[["Joinville",616317],["Florianópolis",537211],["Blumenau",361261],["São José",270299],["Itajaí",264054],["Chapecó",254785],["Palhoça",222598],["Criciúma",214493],["Jaraguá do Sul",182660],["Lages",164981],["Brusque",141385],["Balneário Camboriú",139155],["Tubarão",110088],["Camboriú",103074],["Navegantes",86401],["São Bento do Sul",83277],["Concórdia",81646],["Biguaçu",76773],["Itapema",75940],["Caçador",73720],["Rio do Sul",72587],["Gaspar",72570],["Araranguá",71922],["Indaial",71549],["Içara",59035],["Videira",55466],["Mafra",55286],["Canoinhas",55016],["São Francisco do Sul",52674],["Imbituba",52579],["Xanxerê",51607],["Tijucas",51592],["Guaramirim",46711],["Timbó",46099],["Barra Velha",45369],["Araquari",45283],["São Miguel do Oeste",44330],["Laguna",42785],["Curitibanos",40045],["Rio Negrinho",39261],["Campos Novos",36932],["Pomerode",34289],["Braço do Norte",33773],["Penha",33663],["Fraiburgo",33481],["Porto União",32970],["São João Batista",32687],["Xaxim",31918],["Forquilhinha",31431],["Itapoá",30750],["Joaçaba",30146],["Sombrio",29991],["Garopaba",29959],["Maravilha",28251],["Porto Belo",27688],["Santo Amaro da Imperatriz",27272],["Balneário Piçarras",27127],["Ituporanga",26525],["São Joaquim",25939],["Bombinhas",25058],["São Lourenço do Oeste",24791],["Guabiruba",24543],["Capivari de Baixo",23975],["Orleans",23661],["Capinzal",23314],["Itaiópolis",22051],["Pinhalzinho",21972],["Herval d'Oeste",21724],["Urussanga",20919],["Jaguaruna",20375],["Schroeder",20061],["Presidente Getúlio",20010]],
  "SE":[["Aracaju",602757],["Nossa Senhora do Socorro",192330],["Itabaiana",103440],["Lagarto",101579],["São Cristóvão",95612],["Estância",65078],["Tobias Barreto",50905],["Simão Dias",42578],["Barra dos Coqueiros",41511],["Nossa Senhora da Glória",41147],["Itabaianinha",40678],["Itaporanga d'Ajuda",34411],["Poço Redondo",33439],["Capela",31645],["Canindé de São Francisco",26834],["Propriá",26618],["Porto da Folha",26576],["Nossa Senhora das Dores",24996],["Boquim",24636],["Laranjeiras",23975],["Umbaúba",23917],["Poço Verde",21794],["Salgado",20279],["Aquidabã",20131]],
  "SP":[["São Paulo",11451999],["Guarulhos",1291771],["Campinas",1139047],["São Bernardo do Campo",810729],["Santo André",748919],["Osasco",728615],["Sorocaba",723682],["Ribeirão Preto",698642],["São José dos Campos",697054],["São José do Rio Preto",480393],["Mogi das Cruzes",451505],["Jundiaí",443221],["Piracicaba",423323],["Santos",418608],["Mauá",418261],["Diadema",393237],["Carapicuíba",386984],["Bauru",379146],["Itaquaquecetuba",369275],["Franca",352536],["Praia Grande",349935],["São Vicente",329911],["Barueri",316473],["Taubaté",310739],["Suzano",307429],["Limeira",291869],["Guarujá",287634],["Sumaré",279545],["Cotia",274413],["Taboão da Serra",273542],["Indaiatuba",255748],["São Carlos",254857],["Embu das Artes",250691],["Araraquara",242228],["Jacareí",240275],["Marília",237627],["Americana",237240],["Hortolândia",236641],["Itapevi",232297],["Presidente Prudente",225668],["Rio Claro",201418],["Araçatuba",200124],["Santa Bárbara d'Oeste",183347],["Ferraz de Vasconcelos",179198],["Bragança Paulista",176811],["Itu",168240],["São Caetano do Sul",165655],["Pindamonhangaba",165428],["Francisco Morato",165139],["Atibaia",158647],["Itapecerica da Serra",158522],["Itapetininga",157790],["Santana de Parnaíba",154105],["Mogi Guaçu",153658],["Botucatu",145155],["Franco da Rocha",144849],["Caraguatatuba",134873],["Salto",134319],["Jaú",133497],["Araras",130866],["Votorantim",127923],["Sertãozinho",126887],["Valinhos",126373],["Tatuí",123942],["Barretos",122485],["Itatiba",121590],["Birigui",118979],["Jandira",118045],["Guaratinguetá",118044],["Catanduva",115791],["Várzea Paulista",115771],["Ribeirão Pires",115559],["Cubatão",112476],["Itanhaém",112476],["Paulínia",110537],["Ourinhos",103970],["Poá",103765],["Assis",101409],["Leme",98161],["Votuporanga",96634],["Caçapava",96202],["Caieiras",95032],["Mairiporã",93853],["Ubatuba",92981],["Avaré",92805],["Cajamar",92689],["Mogi Mirim",92558],["São João da Boa Vista",92547],["Itapeva",89728],["Arujá",86678],["Lorena",84855],["São Sebastião",81595],["São Roque",79484],["Matão",79033],["Campo Limpo Paulista",77632],["Vinhedo",76540],["Bebedouro",76373],["Ibiúna",75605],["Cruzeiro",74961],["Lins",74779],["Pirassununga",73545],["Itapira",72022],["Jaboticabal",71821],["Fernandópolis",71186],["Itupeva",70616],["Peruíbe",68352],["Amparo",68008],["Mococa",67681],["Embu-Guaçu",66970],["Lençóis Paulista",66505],["Monte Mor",64662],["Bertioga",64188],["Tupã",63928],["Mirassol",63337],["Nova Odessa",62019],["Mongaguá",61951],["Penápolis",61679],["Boituva",61081],["Ibitinga",60033],["Registro",59947],["Andradina",59783],["Cosmópolis",59773],["Jaguariúna",59347],["Batatais",58402],["Porto Feliz",56497],["Olímpia",55074],["Santa Isabel",53174],["Piedade",52970],["Porto Ferreira",52649],["Taquaritinga",52260],["São José do Rio Pardo",52205],["Louveira",51847],["Artur Nogueira",51456],["Tremembé",51173],["Vargem Grande Paulista",50415],["Capivari",50068],["Mairinque",50027],["Jales",48776],["São Joaquim da Barra",48558],["Monte Alto",47574],["Cabreúva",47011],["Campos do Jordão",46974],["Santa Cruz do Rio Pardo",46442],["Capão Bonito",46337],["Dracena",45474],["Jardinópolis",45282],["Pederneiras",44827],["Cerquilho",44695],["Itararé",44438],["Rio Grande da Serra",44170],["Serrana",43909],["Salto de Pirapora",43748],["Pedreira",43112],["Garça",42110],["Paraguaçu Paulista",41120],["Vargem Grande do Sul",40133],["Socorro",40122],["Espírito Santo do Pinhal",39816],["Presidente Epitácio",39505],["Itápolis",39493],["Guaíra",39279],["Novo Horizonte",38324],["Orlândia",38319],["São Pedro",38256],["Agudos",37680],["Tietê",37663],["Pontal",37607],["Ituverava",37571],["Jarinu",37535],["Guariba",37498],["São Manuel",37289],["José Bonifácio",36633],["Iperó",36459],["Presidente Venceslau",35201],["Promissão",35131],["Ilhabela",34934],["Santa Fé do Sul",34794],["Adamantina",34687],["Barra Bonita",34346],["Pitangueiras",33674],["Cravinhos",33281],["Américo Brasiliense",33019],["Aparecida",32569],["Araçoiaba da Serra",32443],["Ibaté",32178],["Barrinha",32092],["Aguaí",32072],["São Miguel Arcanjo",32039],["Descalvado",31756],["Bariri",31595],["Cachoeira Paulista",31564],["Rio das Pedras",31328],["Osvaldo Cruz",31272],["Guararema",31236],["Guararapes",31043],["Serra Negra",29894],["Biritiba Mirim",29683],["Cândido Mota",29449],["Piraju",29436],["Iguape",29115],["Santa Cruz das Palmeiras",28864],["Rancharia",28588],["Cajati",28515],["Conchal",28101],["Casa Branca",28083],["Mirandópolis",27983],["Morro Agudo",27933],["Pilar do Sul",27619],["Juquitiba",27404],["Bady Bassitt",27260],["Álvares Machado",27255],["Laranjal Paulista",26261],["Igarapava",26212],["Piracaia",26029],["Ilha Solteira",25549],["Pirapozinho",25348],["Tanabi",25265],["Brodowski",25201],["Itaí",25180],["Martinópolis",24881],["Santa Rita do Passa Quatro",24833],["Apiaí",24585],["Cordeirópolis",24514],["Dois Córregos",24510],["Taquarituba",24350],["Valparaíso",24241],["Pereira Barreto",24095],["Angatuba",24022],["Brotas",23898],["Cajuru",23830],["Santa Gertrudes",23611],["Santa Rosa de Viterbo",23411],["Santo Antônio de Posse",23244],["Igaraçu do Tietê",23106],["Capela do Alto",22866],["Pirajuí",22431],["Monte Aprazível",22280],["Teodoro Sampaio",22173],["Cunha",22110],["Bom Jesus dos Perdões",22006],["Iracemápolis",21967],["Guapiaçu",21711],["Araçariguama",21522],["Bastos",21503],["Cerqueira César",21469],["Tambaú",21435],["Junqueirópolis",20448],["Potim",20392],["Buri",20250],["Pompéia",20196],["Regente Feijó",20145],["Lucélia",20061]],
  "TO":[["Palmas",302692],["Araguaína",171301],["Gurupi",85125],["Porto Nacional",64418],["Paraíso do Tocantins",52360],["Colinas do Tocantins",34233],["Araguatins",31918],["Guaraí",24775],["Tocantinópolis",22615]],
};


var _placesMode = 'pin'; // 'pin' | 'states' | 'country'
var _selectedStates = new Set();
var _radiusPins = []; // [{lat, lon, radiusKm, marker, circleId}]
var _placesDiscoveryCancelled = false;
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
  _placesPanelMinimized = !_placesPanelMinimized;
  if (_placesPanelMinimized) {
    body.style.display = 'none';
    panel.style.width = 'auto';
    panel.style.padding = '10px 14px';
    title.textContent = '🔎';
    btn.textContent = '›';
    btn.title = 'Expandir painel';
  } else {
    body.style.display = '';
    panel.style.width = '320px';
    panel.style.padding = '16px';
    title.textContent = '🔎 Places Discovery';
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

function showPlacesSetup() {
  document.getElementById('gallery-screen').classList.add('hidden');
  document.getElementById('upload-zone').classList.add('hidden');
  window._pendingMapType = 'places_discovery';
  window._pendingPeriodo = null;
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
  _placesMode = 'pin';
  document.getElementById('places-query-input').value = '';
  document.getElementById('places-map-name').value = '';
  document.getElementById('places-setup-error').style.display = 'none';
  document.getElementById('places-results-section').style.display = 'none';
  document.getElementById('places-cost-info').style.display = 'none';
  document.getElementById('places-panel').style.display = 'block';
  setPlacesMode('pin');
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
  if (!map) return;
  map.getCanvas().style.cursor = 'crosshair';
  if (_placesClickHandler) map.off('click', _placesClickHandler);
  _placesClickHandler = function(e) {
    var features = map.queryRenderedFeatures(e.point, { layers: ['pdv-points', 'clusters'] });
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

function addRadiusPin(lat, lon) {
  var radiusKm = parseFloat(document.getElementById('pin-radius-km').value) || 5;
  var pinData = { lat: +lat.toFixed(5), lon: +lon.toFixed(5), radiusKm: radiusKm, marker: null, circleId: null };
  var el = document.createElement('div');
  el.style.cssText = 'width:14px;height:14px;background:var(--purple);border:2px solid var(--text-on-accent);border-radius:50%;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,0.5);';
  pinData.marker = new maplibregl.Marker({ element: el }).setLngLat([lon, lat]).addTo(map);
  var idx = _radiusPins.length;
  pinData.circleId = 'places-circle-' + idx + '-' + Date.now();
  var circle = generateCircleGeoJSON(lat, lon, radiusKm);
  if (map.isStyleLoaded()) {
    map.addSource(pinData.circleId, { type: 'geojson', data: circle });
    map.addLayer({ id: pinData.circleId, type: 'fill', source: pinData.circleId, paint: { 'fill-color': _cssVar('--purple'), 'fill-opacity': 0.1 } });
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


function getSearchAreas() {
  if (_placesMode === 'pin') {
    return { mode: 'pin', areas: _radiusPins.map(function(p) { return { lat: p.lat, lon: p.lon, radiusM: p.radiusKm * 1000 }; }) };
  }
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

function updatePlacesEstimate() {
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
    var config = getSearchAreas();
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

async function startPlacesDiscovery() {
  var query = (document.getElementById('places-query-input').value || '').trim();
  var mapName = (document.getElementById('places-map-name').value || '').trim();
  var errEl = document.getElementById('places-setup-error');
  errEl.style.color = ''; // Reset color from expand hint
  if (!query) { errEl.textContent = 'Digite o tipo de estabelecimento.'; errEl.style.display = 'block'; return; }
  if (!mapName && !_appendMode) { errEl.textContent = 'Dê um nome ao mapa.'; errEl.style.display = 'block'; return; }
  errEl.style.display = 'none';
  var searchConfig = getSearchAreas();
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
  document.getElementById('geo-pct').textContent = '0%';
  document.getElementById('geo-ok').textContent = '';
  document.getElementById('geo-fail').textContent = '';
  document.getElementById('geo-eta').textContent = '';
  _placesDiscoveryCancelled = false;
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
  var startTime = Date.now(), allPlaceIds = [];
  // Store allowed UFs for Phase 2 filtering (only for city/state mode)
  var allowedUFs = null;
  if (searchConfig.mode === 'cities') {
    allowedUFs = {};
    searchConfig.states.forEach(function(uf) { allowedUFs[uf] = true; });
  }
  window._allowedUFs = allowedUFs; // Store for retry function

  if (searchConfig.mode === 'pin') {
    // PIN MODE: search each pin area
    var areas = searchConfig.areas;
    var total = areas.length;
    for (var ai = 0; ai < areas.length; ai++) {
      if (_placesDiscoveryCancelled) break;
      var area = areas[ai], pageToken = null, pages = 0;
      do {
        try {
          var resp = await fetch('/api/places-search', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action:'textSearch', query: query+', Brasil', lat:area.lat, lon:area.lon, radius:area.radiusM, pageToken:pageToken }) });
          var data = await resp.json();
          if (resp.ok && data.placeIds) { for (var pi=0;pi<data.placeIds.length;pi++) { var pid=data.placeIds[pi]; if(!seenIds[pid]){seenIds[pid]=true;allPlaceIds.push(pid);}else{skippedDupes++;} } pageToken=data.nextPageToken; }
          else { errors++; pageToken=null; }
        } catch(e) { errors++; pageToken=null; }
        pages++;
      } while (pageToken && pages < 3 && !_placesDiscoveryCancelled);
      var pv = Math.round((ai+1)/total*50);
      document.getElementById('geo-fill').style.width = pv+'%';
      document.getElementById('geo-pct').textContent = pv+'%';
      document.getElementById('geo-ok').textContent = allPlaceIds.length+' novos';
      document.getElementById('geo-current').textContent = 'Buscando: '+(ai+1)+'/'+total+' · '+allPlaceIds.length+' novos' + (skippedDupes > 0 ? ' · ' + skippedDupes + ' dup' : '');
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
        taskQuery = query + ', ' + task.cityName + ', ' + task.uf + ', Brasil';
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
            } else { errors++; pageToken=null; success=true; }
          } catch(e) {
            if (attempt === 0) { await new Promise(function(r){setTimeout(r,500);}); }
            else { errors++; pageToken=null; success=true; }
          }
        }
        pages++;
      } while (pageToken && pages < 3 && !_placesDiscoveryCancelled);
      completed++;
      var pv = Math.round(completed/total*50);
      document.getElementById('geo-fill').style.width = pv+'%';
      document.getElementById('geo-pct').textContent = pv+'%';
      document.getElementById('geo-ok').textContent = allPlaceIds.length+' novos';
      document.getElementById('geo-current').textContent = task.label+'/'+task.uf+' ('+completed+'/'+total+') · '+allPlaceIds.length+' novos' + (skippedDupes > 0 ? ' · ' + skippedDupes + ' dup' : '');
    }
    
    // Process tasks in parallel batches of CONCURRENCY
    for (var bi = 0; bi < tasks.length; bi += CONCURRENCY) {
      if (_placesDiscoveryCancelled) break;
      var batch = tasks.slice(bi, bi + CONCURRENCY);
      await Promise.all(batch.map(runTask));
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
        // Track which IDs were successfully returned
        var returnedIds = {};
        for (var ri=0;ri<data2.places.length;ri++) {
          var p=data2.places[ri]; 
          if (p.place_id) returnedIds[p.place_id] = true;
          if(!p.lat||!p.lon)continue;
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
          allData.push({ nome:p.name, bandeira:p.name, geo_address:p.address, lat:p.lat, lon:p.lon, place_id:p.place_id, place_types:(p.types||[]).slice(0,3).join(', '), place_status:p.status||'', _mapId:allData.length }); found++;
        }
        // IDs that were sent but not returned = failed (rate limited or error)
        for (var fi=0;fi<batch.length;fi++) {
          if (!returnedIds[batch[fi]]) failedIds.push(batch[fi]);
        }
      } else {
        // Entire batch failed — add all to retry
        for (var fi=0;fi<batch.length;fi++) failedIds.push(batch[fi]);
        errors++;
      }
    } catch(e) {
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
    await new Promise(function(r){setTimeout(r,150);});
    var pv2 = 50+Math.round(enriched/allPlaceIds.length*50);
    document.getElementById('geo-fill').style.width = Math.min(pv2,99)+'%';
    document.getElementById('geo-pct').textContent = Math.min(pv2,99)+'%';
    document.getElementById('geo-ok').textContent = found+' \u2713';
    document.getElementById('geo-fail').textContent = failedIds.length>0?failedIds.length+' pendentes':'';
    document.getElementById('geo-current').textContent = 'Detalhes: '+enriched+'/'+allPlaceIds.length+' \u00b7 '+found+' novos' + (skippedDupes > 0 ? ' (' + skippedDupes + ' dup)' : '') + (failedIds.length > 0 ? ' (' + failedIds.length + ' retry)' : '');
    if (enriched%60===0||enriched>=allPlaceIds.length) { filteredData=allData.slice(); renderMarkers(); }
    var elapsed=Date.now()-startTime, rate=enriched/(elapsed/1000), remaining=allPlaceIds.length-enriched;
    var eta=remaining>0&&rate>0?Math.round(remaining/rate):0;
    document.getElementById('geo-eta').textContent = eta>0?'~'+eta+'s':'';
    await new Promise(function(r){setTimeout(r,200);});
  }
  
  // Store failed IDs for optional retry later
  window._pendingRetryIds = failedIds.length > 0 ? failedIds.slice() : [];
  // Store search stats for finish screen
  window._lastSearchStats = { newIds: allPlaceIds.length, skippedDupes: skippedDupes, found: found, errors: errors, existingCount: existingCount, filtered: filtered };
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
    document.getElementById('places-results-summary').innerHTML = summaryParts.join(' · ');
    
    // Show expansion detail banner when in append mode
    if (wasAppend) {
      var detailHtml = '<div style="margin-top:8px;padding:10px 12px;background:rgba(255,255,255,0.03);border:1px solid var(--glass-border);border-radius:8px;font-size:11px;color:var(--text-dim);line-height:1.6;">';
      detailHtml += '<span style="font-weight:600;color:var(--text);">Resultado da expansão:</span><br>';
      if (dupes > 0) detailHtml += '• ' + dupes.toLocaleString('pt-BR') + ' places já existiam no mapa (ignorados sem custo)<br>';
      if (newIds > 0) detailHtml += '• ' + newIds.toLocaleString('pt-BR') + ' IDs novos encontrados<br>';
      if (filteredGeo > 0) detailHtml += '• ' + filteredGeo + ' descartados por filtro geográfico (fora dos estados selecionados)<br>';
      if (foundDetails > 0) detailHtml += '• <span style="color:var(--win);font-weight:500;">' + foundDetails + ' novo' + (foundDetails !== 1 ? 's' : '') + ' place' + (foundDetails !== 1 ? 's' : '') + ' adicionado' + (foundDetails !== 1 ? 's' : '') + ' ao mapa</span><br>';
      if (newIds === 0 && dupes > 0) detailHtml += '• <span style="color:var(--text-muted);">A API retornou os mesmos places da busca original. Tente expandir para outros estados ou alterar a query.</span><br>';
      if (newIds === 0 && dupes === 0) detailHtml += '• <span style="color:var(--text-muted);">Nenhum place retornado pela API nesta busca.</span><br>';
      detailHtml += '</div>';
      document.getElementById('places-results-summary').innerHTML += detailHtml;
    }
    
    // Show/hide retry button
    var retryBtn = document.getElementById('btn-retry-pending');
    if (retryBtn) retryBtn.style.display = pendingCount > 0 ? 'block' : 'none';
    if (!wasAppend) {
      showSaveMapDialog();
    } else if (wasAppend && window._savedMapId) {
      // Auto-save new places to existing saved map
      autoSaveExpandedPlaces(window._savedMapId);
    }
  } else {
    document.getElementById('places-panel').style.display = 'block';
    if (_placesMode === 'pin') enablePinMode();
    var errEl = document.getElementById('places-setup-error');
    if (errEl) { errEl.textContent = 'Nenhum resultado encontrado. Tente outra busca ou amplie a área.'; errEl.style.display = 'block'; }
  }
  // Cleanup stats
  window._lastSearchStats = null;
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
    
    // Insert new places in chunks
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
      await sbFetch('map_pdvs', { method: 'POST', headers: { 'Prefer': 'return=minimal' }, body: JSON.stringify(chunk) });
    }
    
    // Update row_count and payload on saved_maps
    var updateBody = { row_count: allData.length };
    // Also update payload with latest search context
    if (window._placesSearchQuery) {
      updateBody.payload = {
        search_query: window._placesSearchQuery,
        search_mode: window._placesSearchMode || _placesMode,
        search_states: window._placesSearchStates || Array.from(_selectedStates),
        search_radius_km: parseFloat(document.getElementById('pin-radius-km')?.value) || 5,
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
  
  geocodingActive = true;
  _placesDiscoveryCancelled = false;
  var found = 0, processed = 0, newFailed = [];
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
        for (var fi = 0; fi < newBatch.length; fi++) newFailed.push(newBatch[fi]);
      }
    } catch(e) {
      for (var fi = 0; fi < newBatch.length; fi++) newFailed.push(newBatch[fi]);
    }
    processed += batch.length;
    var pv = Math.round(processed / ids.length * 100);
    document.getElementById('geo-fill').style.width = Math.min(pv, 99) + '%';
    document.getElementById('geo-pct').textContent = pv + '%';
    document.getElementById('geo-ok').textContent = found + ' novos';
    document.getElementById('geo-current').textContent = 'Recuperando: ' + processed + '/' + ids.length + ' · ' + found + ' novos · ' + newFailed.length + ' falharam';
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
  // Reset to pin mode
  setPlacesMode('pin');
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
  try { window.deleteMap = deleteMap; } catch(e) {}
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
  try { window.getSearchAreas = getSearchAreas; } catch(e) {}
  try { window.goToStep = goToStep; } catch(e) {}
  try { window.groupBy = groupBy; } catch(e) {}
  try { window.handleCSVFile = handleCSVFile; } catch(e) {}
  try { window.handleLoggedIn = handleLoggedIn; } catch(e) {}
  try { window.identificarBandeira = identificarBandeira; } catch(e) {}
  try { window.initAuth = initAuth; } catch(e) {}
  try { window.initMap = initMap; } catch(e) {}
  try { window.initMultiSelect = initMultiSelect; } catch(e) {}
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
  try { window.openShareModal = openShareModal; } catch(e) {}
  try { window.startReenrich = startReenrich; } catch(e) {}
  try { window.dismissReenrich = dismissReenrich; } catch(e) {}
  try { window.checkReenrichBar = checkReenrichBar; } catch(e) {}
  try { window.openShareModalFromCard = openShareModalFromCard; } catch(e) {}
  try { window.closeShareModal = closeShareModal; } catch(e) {}
  try { window.copyShareLink = copyShareLink; } catch(e) {}
  try { window.revokeShareLink = revokeShareLink; } catch(e) {}
  try { window.initSharedMode = initSharedMode; } catch(e) {}
  try { window._isSharedMode = _isSharedMode; } catch(e) {}
  try { window.showUploadZone = showUploadZone; } catch(e) {}
  try { window.startExpandSearch = startExpandSearch; } catch(e) {}
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

  // Shared state
  try { window.allData = allData; } catch(e) {}
  try { window.filteredData = filteredData; } catch(e) {}
  try { window.map = map; } catch(e) {}
  try { window.currentMapType = currentMapType; } catch(e) {}
  try { window.currentView = currentView; } catch(e) {}
  try { window.currentUser = currentUser; } catch(e) {}
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
  try { window.dropZone = dropZone; } catch(e) {}
  try { window._escForHtml = _escForHtml; } catch(e) {}
  try { window._cssVar = _cssVar; } catch(e) {}
  try { window.sbFetch = sbFetch; } catch(e) {}
  try { window.escHtml = escHtml; } catch(e) {}
})();
