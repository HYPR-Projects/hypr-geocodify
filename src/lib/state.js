// ─── App State ──────────────────────────────────────────────────────────────
// Single source of truth for all shared mutable state.
// Import getters/setters instead of touching window.* globals.
//
// Migration note: during the transition, we sync to window.* so inline
// code that hasn't been migrated yet still works. Once migration is
// complete, remove all window.* syncs.

// ── Core data ───────────────────────────────────────────────────────────────

let _allData = [];
let _filteredData = [];
let _rawCSVData = null;

export function getAllData() { return _allData; }
export function setAllData(d) { _allData = d; window.allData = d; }

export function getFilteredData() { return _filteredData; }
export function setFilteredData(d) { _filteredData = d; window.filteredData = d; }

export function getRawCSV() { return _rawCSVData; }
export function setRawCSV(d) { _rawCSVData = d; window.rawCSVData = d; }

// ── Map ─────────────────────────────────────────────────────────────────────

let _map = null;
let _mapStyles = null;
let _activeLayer = 'dark';
let _popup = null;

export function getMap() { return _map; }
export function setMap(m) { _map = m; window.map = m; }

export function getMapStyles() { return _mapStyles; }
export function setMapStyles(s) { _mapStyles = s; window.MAP_STYLES = s; }

export function getActiveLayer() { return _activeLayer; }
export function setActiveLayer(l) { _activeLayer = l; window.activeLayer = l; }

export function getPopup() { return _popup; }
export function setPopup(p) { _popup = p; window._popup = p; }

// ── App mode ────────────────────────────────────────────────────────────────

let _currentMapType = null;
let _currentView = 'map';

export function getCurrentMapType() { return _currentMapType; }
export function setCurrentMapType(t) { _currentMapType = t; window.currentMapType = t; }

export function getCurrentView() { return _currentView; }
export function setCurrentView(v) { _currentView = v; window.currentView = v; }

// ── Geocoding ───────────────────────────────────────────────────────────────

let _geocodingActive = false;
let _geocodingCancelled = false;

export function isGeocodingActive() { return _geocodingActive; }
export function setGeocodingActive(v) { _geocodingActive = v; window.geocodingActive = v; }

export function isGeocodingCancelled() { return _geocodingCancelled; }
export function setGeocodingCancelled(v) { _geocodingCancelled = v; window.geocodingCancelled = v; }

// ── Places Discovery ────────────────────────────────────────────────────────

let _placesMode = 'pin';
let _selectedStates = new Set();
let _radiusPins = [];
let _placesDiscoveryCancelled = false;
let _appendMode = false;
let _placesPanelMinimized = false;
let _regionFilter = null;
let _placesClickHandler = null;

export function getPlacesMode() { return _placesMode; }
export function setPlacesMode(m) { _placesMode = m; window._placesMode = m; }

export function getSelectedStates() { return _selectedStates; }
// No setter — mutate the Set directly via .add() / .delete() / .clear()

export function getRadiusPins() { return _radiusPins; }
export function setRadiusPins(p) { _radiusPins = p; window._radiusPins = p; }

export function isPlacesCancelled() { return _placesDiscoveryCancelled; }
export function setPlacesCancelled(v) { _placesDiscoveryCancelled = v; window._placesDiscoveryCancelled = v; }

export function isAppendMode() { return _appendMode; }
export function setAppendMode(v) { _appendMode = v; window._appendMode = v; }

export function isPlacesPanelMinimized() { return _placesPanelMinimized; }
export function setPlacesPanelMinimized(v) { _placesPanelMinimized = v; }

export function getRegionFilter() { return _regionFilter; }
export function setRegionFilter(v) { _regionFilter = v; window._regionFilter = v; }

export function getPlacesClickHandler() { return _placesClickHandler; }
export function setPlacesClickHandler(h) { _placesClickHandler = h; window._placesClickHandler = h; }

// ── Charts ──────────────────────────────────────────────────────────────────

let _charts = {};

export function getCharts() { return _charts; }
export function setChart(key, chart) { _charts[key] = chart; }
export function destroyChart(key) {
  if (_charts[key]) { _charts[key].destroy(); delete _charts[key]; }
}
export function destroyAllCharts() {
  Object.values(_charts).forEach(c => c.destroy());
  _charts = {};
}

// ── Gallery ─────────────────────────────────────────────────────────────────

let _galleryMaps = [];
let _galleryFiltered = [];
let _galleryPage = 1;

export function getGalleryMaps() { return _galleryMaps; }
export function setGalleryMaps(m) { _galleryMaps = m; window._galleryMaps = m; }

export function getGalleryFiltered() { return _galleryFiltered; }
export function setGalleryFiltered(f) { _galleryFiltered = f; }

export function getGalleryPage() { return _galleryPage; }
export function setGalleryPage(p) { _galleryPage = p; }

// ── Misc ────────────────────────────────────────────────────────────────────

let _geoToastTimer = null;

export function getGeoToastTimer() { return _geoToastTimer; }
export function setGeoToastTimer(t) { _geoToastTimer = t; }

// ── Bootstrap sync ──────────────────────────────────────────────────────────
// Call once at app start to seed window.* for inline code compatibility.

export function syncToWindow() {
  window.allData = _allData;
  window.filteredData = _filteredData;
  window.map = _map;
  window.currentMapType = _currentMapType;
  window.currentView = _currentView;
  window.geocodingActive = _geocodingActive;
  window.geocodingCancelled = _geocodingCancelled;
  window._placesMode = _placesMode;
  window._selectedStates = _selectedStates;
  window._radiusPins = _radiusPins;
  window._appendMode = _appendMode;
  window._galleryMaps = _galleryMaps;
  window.charts = _charts;
  window.MAP_STYLES = _mapStyles;
  window.activeLayer = _activeLayer;
}
