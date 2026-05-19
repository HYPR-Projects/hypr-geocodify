/**
 * V360 Sidebar Enhancements (Fase 6 - sidebar redesign)
 * =====================================================
 *
 * Adiciona:
 * - Lens Presets ("Tudo", "Oportunidades", "Whitespace", "Domínio", "Risco")
 *   — botões que aplicam combinações pré-definidas de filtros legados
 * - Busca global (#globalSearch) — filtra por bandeira/CNPJ/cidade
 * - Contadores na legenda de estados
 * - Sincroniza visibilidade de lentes rápidas com modo do mapa (V360)
 *
 * Hook em window.updatePanels (mesmo padrão de v360-hero.js).
 * Lê sempre window.filteredData / window.allData.
 */

(function() {
  'use strict';

  // ─── Helpers ─────────────────────────────────────────────────────────────
  function _isV360() { return window.currentMapType === 'varejo360'; }

  function _activeLensFilters() {
    // Retorna {preset: 'all'|'oport'|'white'|'domain'|'risk'|null}
    const btn = document.querySelector('.preset.active');
    return { preset: btn?.dataset?.preset || null };
  }

  // ─── Lens Preset Counts ─────────────────────────────────────────────────
  // Calcula contadores dos cards de lentes rápidas com base em allData.
  // OBS: NÃO usa filteredData (queremos saber o tamanho ANTES de aplicar
  // o preset). Em Solo (sem concorrentes), Oportunidades/Domínio caem de
  // volta pra estados de performance (acima/abaixo da média).
  function renderPresetCounts() {
    if (!_isV360()) return;
    const all = window.allData || [];
    if (!all.length) return;

    let oport = 0, white = 0, domain = 0, risk = 0;
    const hasComp = window.V360CompRender
      && window.V360CompRender.getMode
      && window.V360CompRender.getMode() !== 'solo';

    if (hasComp) {
      const classify = window.V360CompRender.classifyRow;
      const STATE = window.V360CompRender.STATE;
      for (const row of all) {
        const cls = classify(row);
        if (!cls) continue;
        const s = cls.state;
        if (s === STATE.OPPORTUNITY) oport++;
        else if (s === STATE.WHITESPACE) white++;
        else if (s === STATE.DOMINANCE || s === STATE.LEADERSHIP) domain++;
        else if (s === STATE.VULNERABLE) risk++;
      }
    } else {
      // Solo: aproxima via diff vs média e share
      for (const row of all) {
        const diff = parseFloat(row.percentual_diff_media_dimensao || 0);
        const share = parseFloat(row.share_reais_sku_dimensao || 0);
        if (diff > 2) domain++;
        else if (share <= 0) white++;
        else if (diff < -2) risk++;
        // Oportunidade em Solo ~ "acima da média com baixo penetração"
        if (diff > 2 && share < 0.05) oport++;
      }
    }

    const set = (id, txt) => {
      const el = document.getElementById(id);
      if (el) el.textContent = txt;
    };
    set('preset-count-all', `${all.length.toLocaleString('pt-BR')} PDVs`);
    set('preset-count-oport', `${oport.toLocaleString('pt-BR')} vence`);
    set('preset-count-white', `${white.toLocaleString('pt-BR')} sem amostra`);
    set('preset-count-domain', `${domain.toLocaleString('pt-BR')} lideram`);
    set('preset-count-risk', `${risk.toLocaleString('pt-BR')} PDVs · perdem para todos`);
  }

  // ─── Apply Lens Preset ───────────────────────────────────────────────────
  // Aplica filtros legados via badges existentes. Não inventa estado novo:
  // delega a applyFilters() que já existe e cuida do filteredData.
  window.applyLensPreset = function(preset) {
    // Toggle: clicando no preset ativo, volta pra 'all'
    const currentBtn = document.querySelector('.preset.active');
    const isReToggle = currentBtn && currentBtn.dataset.preset === preset;
    const target = isReToggle ? 'all' : preset;

    // Marca o botão ativo
    document.querySelectorAll('.preset').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.preset[data-preset="${target}"]`);
    if (btn) btn.classList.add('active');

    // Reseta badges legados primeiro (perf + oport)
    const setBadge = (containerId, val) => {
      const container = document.getElementById(containerId);
      if (!container) return;
      container.querySelectorAll('.badge').forEach(b => b.classList.remove('active'));
      const sel = container.querySelector(`.badge[data-v="${val}"]`);
      if (sel) sel.classList.add('active');
    };

    switch (target) {
      case 'all':
        setBadge('f-perf', '');
        setBadge('f-oport', '');
        break;
      case 'oport':
        setBadge('f-perf', 'acima');
        setBadge('f-oport', 'alta');
        break;
      case 'white':
        setBadge('f-perf', 'sem_presenca');
        setBadge('f-oport', '');
        break;
      case 'domain':
        setBadge('f-perf', 'acima');
        setBadge('f-oport', '');
        break;
      case 'risk':
        setBadge('f-perf', 'abaixo');
        setBadge('f-oport', '');
        break;
    }
    // Dispara apply
    try { window.applyFilters && window.applyFilters(); } catch (e) {}
  };

  // ─── Busca global ────────────────────────────────────────────────────────
  // Filtra allData por bandeira/CNPJ/cidade. Implementa client-side simples;
  // se filteredData é gerenciada por applyFilters, fazemos override temporário.
  let _searchTerm = '';
  window._sbGlobalSearch = function(term) {
    _searchTerm = (term || '').trim().toLowerCase();
    try { window.applyFilters && window.applyFilters(); } catch (e) {}
  };

  // Hook em applyFilters: pós-filtro, aplicamos busca global
  function installSearchHook() {
    if (window._v360SidebarSearchHook) return;
    const orig = window.applyFilters;
    if (typeof orig !== 'function') return;
    window.applyFilters = function() {
      const r = orig.apply(this, arguments);
      if (_searchTerm && Array.isArray(window.filteredData)) {
        window.filteredData = window.filteredData.filter(row => {
          const b = (row.bandeira || '').toLowerCase();
          const c = (row.cnpj || row.cnpj_14 || '').toLowerCase();
          const city = (row.geo_address || row.municipio || '').toLowerCase();
          return b.includes(_searchTerm) || c.includes(_searchTerm) || city.includes(_searchTerm);
        });
        // re-render dependentes
        try { window.renderMarkers && window.renderMarkers(); } catch (e) {}
        try { window.updatePanels && window.updatePanels(); } catch (e) {}
      }
      return r;
    };
    window._v360SidebarSearchHook = true;
  }

  // ─── Legend counts ───────────────────────────────────────────────────────
  // Atualiza contadores ao lado de cada item da legenda (Solo: acima/abaixo/
  // média/sem; Duelo/Categoria: 7-8 estados competitivos)
  function renderLegendCounts() {
    if (!_isV360()) return;
    const filtered = window.filteredData || [];
    if (!filtered.length) return;

    const hasComp = window.V360CompRender
      && window.V360CompRender.getMode
      && window.V360CompRender.getMode() !== 'solo';

    if (hasComp) {
      // Re-renderiza a legenda inteira com estados competitivos
      _renderCompLegend(filtered);
    } else {
      _renderSoloLegendCounts(filtered);
    }
  }

  function _renderSoloLegendCounts(filtered) {
    let acima = 0, abaixo = 0, media = 0, absent = 0;
    for (const row of filtered) {
      const share = parseFloat(row.share_reais_sku_dimensao || 0);
      const diff = parseFloat(row.percentual_diff_media_dimensao || 0);
      if (share <= 0) absent++;
      else if (diff > 2) acima++;
      else if (diff < -2) abaixo++;
      else media++;
    }
    const list = document.getElementById('color-legend-list');
    if (!list) return;
    // Garante que estamos no formato Solo (caso tenha mudado pra Duelo antes)
    if (list.dataset.mode !== 'solo') {
      list.dataset.mode = 'solo';
      list.innerHTML = `
        <div class="legend-item"><div class="legend-dot" style="background:var(--win)"></div>Acima da média<span class="legend-count" id="legend-count-acima"></span></div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--lose)"></div>Abaixo da média<span class="legend-count" id="legend-count-abaixo"></span></div>
        <div class="legend-item"><div class="legend-dot" style="background:var(--neutral)"></div>Na média (±2pp)<span class="legend-count" id="legend-count-media"></span></div>
        <div class="legend-item"><div class="legend-dot" style="background:#94a3b8"></div>Sem presença<span class="legend-count" id="legend-count-absent"></span></div>
      `;
    }
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v.toLocaleString('pt-BR'); };
    set('legend-count-acima', acima);
    set('legend-count-abaixo', abaixo);
    set('legend-count-media', media);
    set('legend-count-absent', absent);

    const total = acima + abaixo + media + absent;
    const meta = document.getElementById('legend-meta-count');
    if (meta) meta.textContent = total > 0 ? `${total.toLocaleString('pt-BR')} PDVs` : '';
  }

  function _renderCompLegend(filtered) {
    if (!window.V360CompRender) return;
    const STATE = window.V360CompRender.STATE;
    const LABELS = window.V360CompRender.STATE_LABELS;
    const COLORS = window.V360CompRender.STATE_COLORS;
    const classify = window.V360CompRender.classifyRow;

    const counts = {};
    for (const k of Object.keys(STATE)) counts[STATE[k]] = 0;

    for (const row of filtered) {
      const cls = classify(row);
      if (cls && cls.state) counts[cls.state] = (counts[cls.state] || 0) + 1;
    }

    const order = [
      STATE.DOMINANCE, STATE.LEADERSHIP, STATE.EXCLUSIVE,
      STATE.DISPUTE,
      STATE.OPPORTUNITY,
      STATE.BEHIND, STATE.VULNERABLE,
      STATE.WHITESPACE,
    ];

    const list = document.getElementById('color-legend-list');
    if (!list) return;
    list.dataset.mode = 'comp';
    list.innerHTML = order.map(s => `
      <div class="legend-item">
        <div class="legend-dot" style="background:${COLORS[s]}"></div>
        ${LABELS[s]}
        <span class="legend-count">${(counts[s] || 0).toLocaleString('pt-BR')}</span>
      </div>
    `).join('');

    const total = Object.values(counts).reduce((s, v) => s + v, 0);
    const meta = document.getElementById('legend-meta-count');
    if (meta) meta.textContent = total > 0 ? `${total.toLocaleString('pt-BR')} PDVs` : '';
  }

  // ─── Visibilidade da seção lentes rápidas ───────────────────────────────
  function syncSectionVisibility() {
    const lenses = document.getElementById('sb-lenses');
    if (lenses) lenses.style.display = _isV360() ? 'block' : 'none';
  }

  // ─── Orquestrador ────────────────────────────────────────────────────────
  function refreshAll() {
    try { syncSectionVisibility(); } catch (e) { console.error('[v360-sb] visibility:', e); }
    try { renderPresetCounts(); } catch (e) { console.error('[v360-sb] preset counts:', e); }
    try { renderLegendCounts(); } catch (e) { console.error('[v360-sb] legend:', e); }
  }

  // ─── Init ────────────────────────────────────────────────────────────────
  function init() {
    if (typeof window.applyFilters !== 'function') {
      setTimeout(init, 100);
      return;
    }

    installSearchHook();

    // Hook em updatePanels — refresh sempre que filtros/data mudam
    if (typeof window.updatePanels === 'function' && !window._v360SbPanelHook) {
      const orig = window.updatePanels;
      window.updatePanels = function() {
        const r = orig.apply(this, arguments);
        try { refreshAll(); } catch (e) { console.error('[v360-sb] refresh:', e); }
        return r;
      };
      window._v360SbPanelHook = true;
    }

    // Listeners aos eventos do módulo V360Comp
    window.addEventListener('v360:competitors-loaded', refreshAll);
    window.addEventListener('v360:perspective-changed', refreshAll);
    window.addEventListener('v360:map-closed', function() {
      const lenses = document.getElementById('sb-lenses');
      if (lenses) lenses.style.display = 'none';
      // Reseta busca
      const search = document.getElementById('globalSearch');
      if (search) search.value = '';
      _searchTerm = '';
    });

    // Atalho ⌘K / Ctrl+K → foco na busca
    document.addEventListener('keydown', function(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        const search = document.getElementById('globalSearch');
        if (search) {
          e.preventDefault();
          search.focus();
          search.select();
        }
      }
    });

    // Primeira render
    setTimeout(refreshAll, 200);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // API pública (smoke tests)
  window.V360Sidebar = {
    applyLensPreset: window.applyLensPreset,
    renderPresetCounts,
    renderLegendCounts,
    refreshAll,
  };
})();
