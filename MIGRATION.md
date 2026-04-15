# Migração JS Inline → ES Modules

## Estado atual

- **index.html**: 5.350 linhas de JS inline (Block 4: linhas 892-5389)
- **src/lib/**: 15 módulos ES com ~2.050 linhas (já extraídos Sprint 2-6)
- **Problema**: 35 funções duplicadas, 50 variáveis globais via `window.*`, Vite só importa CSS
- **main.js**: importa apenas `app.css`

## Arquitetura alvo

```
src/main.js                    ← Entry point (importa tudo, expõe ao HTML)
src/lib/state.js               ← State store centralizado (getters/setters)
src/lib/supabase.js            ← Client Supabase (✓ já existe, remover duplicata)
src/lib/auth.js                ← OAuth Google (✓ já existe, remover duplicata)
src/lib/theme.js               ← Dark/light mode (✓ já existe, remover duplicata)
src/lib/utils.js               ← Helpers puros (✓ já existe, remover duplicata)
src/lib/config.js              ← Constantes (✓ já existe)
src/lib/csv-parser.js          ← Parse CSV (✓ já existe, adicionar parseLine/handleCSVFile)
src/lib/bandeira.js            ← Bandeira/marca (✓ já existe)
src/lib/geocoder.js            ← HERE geocoding (✓ já existe, adicionar inline helpers)
src/lib/receita.js             ← CNPJ lookup (✓ já existe, adicionar inline helpers)
src/lib/map-engine.js          ← MapLibre (✓ já existe, expandir com fns inline)
src/lib/analytics.js           ← Charts/panels (✓ já existe, expandir)
src/lib/panels.js              ← UI panels (✓ já existe)
src/lib/gallery.js             ← Gallery (✓ já existe, expandir)
src/lib/save-load.js           ← Supabase persistence (✓ já existe, expandir)
src/lib/export.js              ← CSV download (✓ já existe)
src/lib/geo-data.js            ← BR_STATES/BR_CITIES (✓ já existe)
src/lib/filters.js             ← NEW: populateFilters, applyFilters, badges, multi-select
src/lib/geocoding-flow.js      ← NEW: startGeocoding, enrichRow, steps, toast
src/lib/places-discovery.js    ← NEW: places setup, discovery, pin mode, search areas
src/lib/modals.js              ← NEW: map type modal, save modal, varejo sub-modal
src/lib/upload.js              ← NEW: drop zone, templates, CSV file handling
```

## Fases

### Fase 0 — State store (✓ feito)
- Criado `src/lib/state.js` com getters/setters para os 50 globals
- `syncToWindow()` mantém compatibilidade com inline durante transição

### Fase 1 — Eliminar duplicatas (quick wins)
**Esforço: ~2h | Impacto: remove ~800 linhas inline**

As 35 funções duplicadas podem ser eliminadas imediatamente:
1. Em `main.js`, importar os módulos e expor via `window.*` para o inline restante
2. Deletar as versões inline

Funções a deletar do inline:
- `throttle`, `pct`, `pctRaw`, `avg`, `groupBy`, `_escForHtml` → usar de `utils.js`
- `pinColor`, `renderMarkers`, `buildPopup` → usar de `map-engine.js`
- `parseCSV`, `detectAndNormalize` → usar de `csv-parser.js`
- `normalizeBandeira`, `buildBandeiraGroups` → usar de `bandeira.js`
- `updateOverlay`, `updatePanels` → usar de `analytics.js`
- `setTab`, `initResizablePanels`, `toggleFullMap`, `toggleSidebar`, `togglePanel` → usar de `panels.js`
- `doGoogleLogin`, `initAuth` → usar de `auth.js`
- `downloadGeocoderCSV` → usar de `export.js`
- `reverseGeocodeHERE`, `geocodeHERE` → usar de `geocoder.js`
- `aplicarReceita`, `buscarReceita` → usar de `receita.js`
- `loadGallery`, `applyGalleryFilters`, `buildMapCard` → usar de `gallery.js`
- `deleteMap`, `saveMapToSupabase`, `autoSaveExpandedPlaces` → usar de `save-load.js`
- `toggleTheme` → usar de `theme.js`
- `escHtml` → usar de `utils.js`

### Fase 2 — Criar módulos para funções exclusivas
**Esforço: ~6-8h | Impacto: migra ~3.500 linhas**

#### 2a. filters.js (7 funções, ~250 linhas)
`populateFilters`, `applyFilters`, `toggleBadge`, `resetFilters`,
`toggleAdvancedFilters`, `setRegionFilter`, `syncTicketRange`
+ multi-select: `initMultiSelect`, `updateMsDisplay`, `toggleMultiSelect`,
  `filterMultiSelect`, `msSelectAll`, `msClearAll`, `msGetSelected`, `msReset`

#### 2b. geocoding-flow.js (12 funções, ~600 linhas)
`startGeocoding`, `startReverseGeocoding`, `startGeocodingFromStep2`,
`enrichRow`, `updateEnrichUI`, `cancelGeocoding`,
`extrairEndereco`, `identificarBandeira`,
`showGeoToast`, `dismissGeoToast`, `goToStep`,
`_hereItemToResult`, `_cleanCommercialAddress`

#### 2c. places-discovery.js (18 funções, ~800 linhas)
`togglePlacesPanel`, `showPlacesSetup`, `setPlacesMode`,
`enablePinMode`, `disablePinMode`, `addRadiusPin`, `removeRadiusPin`,
`clearAllPins`, `renderRadiusPinTags`, `buildStateGrid`, `toggleState`,
`generateCircleGeoJSON`, `getSearchAreas`, `updatePlacesEstimate`,
`startPlacesDiscovery`, `startExpandSearch`, `finishPlacesDiscovery`,
`retryPendingIds`, `resetPlacesForNewSearch`, `enrichBatch`, `updatePlacesBadge`

#### 2d. modals.js (8 funções, ~200 linhas)
`openMapTypeModal`, `closeMapTypeModal`, `selectMapType`,
`openVarejoSubModal`, `closeVarejoSubModal`, `selectVarejoSubType`,
`showSaveMapDialog`, `closeSaveModal`, `openSaveModalFromToast`

#### 2e. upload.js (5 funções, ~150 linhas)
`handleCSVFile`, `showUploadZone`, `renderUploadTemplate`,
`downloadTemplate`, `loadData`

#### 2f. Expandir módulos existentes
- `map-engine.js` += `_buildSatelliteStyle`, `_initMapStyles`, `initMap`,
  `applyMapMode`, `setMapView`, inline `_setupMapSources/Interactions`
- `analytics.js` += `updateHeader`, `updateOverview`, `updateRanking`,
  `renderRankList`, `updateAnalysis`, `destroyChart`, chart renderers
- `gallery.js` += `showGallery`, `renderGalleryPage`, `buildPageNumbers`,
  `openSavedMap`
- `save-load.js` += `autoSaveAndNotify`

### Fase 3 — Wire main.js + eliminar inline
**Esforço: ~3h | Impacto: index.html fica só HTML**

1. `main.js` importa tudo e registra event handlers via JS (não `onclick=`)
2. Bloco `<script>` do inline fica vazio (ou no máximo o theme flash-prevention)
3. Remover blocks 2-5 do index.html
4. Remover todo `window.*` sync do state.js

### Fase 4 — Cleanup
- Remover `netlify/` e `netlify.toml`
- Mover Supabase URL/key para `VITE_` env vars
- Remover `_HERE_SAT_KEY` e `H` do inline (isso é a key exposta)
- Atualizar `deploy.md` e `README.md`
- Rodar `vite build` e verificar bundle size

## Ordem de execução recomendada

1. **Fase 1** primeiro — elimina duplicatas, dá confiança que o wire funciona
2. **Fase 2a** (filters) — domínio mais isolado, bom pra validar padrão
3. **Fase 2d** (modals) — pequeno, autocontido
4. **Fase 2e** (upload) — pequeno, autocontido
5. **Fase 2b** (geocoding-flow) — core feature, mais complexo
6. **Fase 2c** (places-discovery) — maior módulo, mais estado
7. **Fase 2f** (expandir existentes) — pode ir em paralelo com 2b-2c
8. **Fase 3** — wire final
9. **Fase 4** — cleanup

## Padrão de migração para cada função

```js
// 1. No módulo novo: importar state + deps
import { getAllData, getFilteredData, setFilteredData } from './state.js';
import { cssVar } from './utils.js';

// 2. Trocar referências a globals por getters
//    allData         → getAllData()
//    filteredData    → getFilteredData()
//    map             → getMap()
//    currentMapType  → getCurrentMapType()

// 3. Trocar mutações por setters
//    filteredData = x  → setFilteredData(x)
//    map = x           → setMap(x)

// 4. Export a função
export function applyFilters() {
  const data = getAllData();
  // ... lógica ...
  setFilteredData(result);
}
```

```js
// 5. Em main.js: importar e expor pra window (fase de transição)
import { applyFilters } from './lib/filters.js';
window.applyFilters = applyFilters;

// 6. Na Fase 3: trocar onclick="applyFilters()" por addEventListener
```
