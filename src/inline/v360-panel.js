/**
 * V360 Panel — Share por Tipo + Top Redes (Fase 7)
 * ===================================================
 *
 * Adiciona 2 cards do protótipo ao Overview do right panel:
 *
 * 1) #v360-sbt-card "Share por Tipo" — bars horizontais empilhadas
 *    HEI:BUD:AMS com % inline + "X% outras" no final.
 *    Renderiza Reais / Volume / Unidades.
 *
 * 2) #v360-topredes-card "Top Redes por PDVs" — lista numerada
 *    com nome da rede + count de PDVs + share da lente + bar.
 *
 * Hooks em window.updatePanels (padrão dos outros módulos V360).
 * Esconde os blocos legados pesados quando há concorrentes
 * via classe body[data-v360-panel="active"].
 */

(function() {
  'use strict';

  function _isV360() { return window.currentMapType === 'varejo360'; }

  function _selectedBrands() {
    try {
      if (!window.V360CompRender) return null;
      const b = window.V360CompRender.brandsList();
      if (!b || !b.perspective) return null;
      const others = (b.others || []).filter(x => x && x !== b.perspective);
      return [b.perspective].concat(others);
    } catch (e) { return null; }
  }

  function _colorMap() {
    try { return window.V360CompRender.brandsList().colorMap || {}; } catch (e) { return {}; }
  }

  // ─── Card 1: Share por Tipo (bars empilhadas) ──────────────────────────
  // Lê share_reais_sku_dimensao, share_volume_sku_dimensao, share_unidades_sku_dimensao
  // de allData (ou filteredData se filtrado), agrega por marca.
  function renderShareByType() {
    const card = document.getElementById('v360-sbt-card');
    const el = document.getElementById('sbtRows');
    if (!card || !el) return;

    const brands = _selectedBrands();
    const filtered = window.filteredData || [];

    // (Fase 9) Esconde em não-V360, sem dados, OU em modo Solo (legados cobrem).
    const hasComp = window.V360CompRender
      && window.V360CompRender.getMode
      && window.V360CompRender.getMode() !== 'solo';
    if (!_isV360() || !hasComp || !brands || !brands.length || !filtered.length) {
      card.style.display = 'none';
      return;
    }
    card.style.display = '';

    const colorMap = _colorMap();
    const lens = brands[0];
    const concs = brands.slice(1);
    const getShare = window.V360CompRender?.getShareForBrand;

    // 3 tipos: Reais (share principal) + Volume + Unidades
    const types = [
      { label: 'Reais',    key: 'share_reais_sku_dimensao' },
      { label: 'Volume',   key: 'share_volume_sku_dimensao' },
      { label: 'Unidades', key: 'share_unidades_sku_dimensao' },
    ];

    el.innerHTML = types.map(t => {
      // Para a lente: usa getShareForBrand quando há concorrentes; senão
      // usa o campo direto do row (modo Solo).
      let lensSum = 0, lensN = 0;
      for (const r of filtered) {
        const v = parseFloat(r[t.key] || 0);
        if (!isNaN(v)) { lensSum += v; lensN++; }
      }
      const lensAvg = lensN > 0 ? lensSum / lensN : 0;

      // Para concorrentes: aproxima via mult constante por tipo
      // (Volume é ~88% do Reais, Unidades ~76%). Em Solo sem concorrentes,
      // só renderiza a lente.
      let segments = [
        { brand: lens, color: colorMap[lens] || '#018376', avg: lensAvg },
      ];
      if (getShare && concs.length) {
        // Para concorrentes usa share médio do mesmo campo via getShareForBrand
        for (const c of concs) {
          let cSum = 0, cN = 0;
          for (const r of filtered) {
            const data = getShare(r, c);
            // getShareForBrand retorna share Reais. Pra Volume/Unidades não
            // tem fonte separada — usa mesmo Reais (limitação do dataset).
            if (data?.share != null) { cSum += data.share; cN++; }
          }
          const cAvg = cN > 0 ? cSum / cN : 0;
          segments.push({ brand: c, color: colorMap[c] || '#94a3b8', avg: cAvg });
        }
      }

      const total = segments.reduce((s, x) => s + x.avg, 0);
      const rest = Math.max(0, 1 - total);
      const restPct = (rest * 100).toFixed(0);

      const segsHtml = segments.map(s => {
        const wNum = s.avg * 100;
        const w = wNum.toFixed(1);
        // (Fix) Padding e label só em segmentos >=8% — abaixo disso o padding
        // (16px) sobrepunha a largura calculada e marcas microscópicas (ex:
        // 0.1%) ocupavam ~10% visual, mentindo sobre proporção. Agora:
        //   - >=8%: padding 0 8px, label "X%" inline
        //   - <8% e >=1%: sem padding, sem label, fica só barra de cor
        //   - <1%: força min-width via CSS pra continuar visível/hoverable,
        //          sem distorcer proporção (continua hover-able com tooltip
        //          mostrando o valor exato)
        const isWide = wNum >= 8;
        const label = isWide ? `${wNum.toFixed(0)}%` : '';
        const padStyle = isWide ? '' : 'padding:0;';
        return `<div class="sbt-seg${isWide ? '' : ' sbt-seg-thin'}" style="background:${s.color};width:${w}%;${padStyle}" data-brand="${_esc(s.brand)}" data-color="${s.color}" data-pct="${w}">${label}</div>`;
      }).join('');

      const restPctExact = (rest * 100).toFixed(1);
      return `
        <div class="sbt-row">
          <span class="sbt-label">${t.label}</span>
          <div class="sbt-bars">${segsHtml}<div class="sbt-rest" data-brand="Outras marcas" data-pct="${restPctExact}">${restPct}% outras</div></div>
        </div>
      `;
    }).join('');

    _ensureSbtTooltipWired();
  }

  // ─── Tooltip custom pra Share por Tipo ─────────────────────────────────────
  // Delegação no card; bind feito uma vez. Pega data-brand / data-pct do alvo
  // (segmento ou "outras") e mostra um tooltip flutuante ancorado acima.
  let _sbtTooltipEl = null;
  let _sbtTooltipWired = false;
  function _getSbtTooltip() {
    if (_sbtTooltipEl && document.body.contains(_sbtTooltipEl)) return _sbtTooltipEl;
    _sbtTooltipEl = document.createElement('div');
    _sbtTooltipEl.className = 'sbt-tooltip';
    _sbtTooltipEl.style.display = 'none';
    document.body.appendChild(_sbtTooltipEl);
    return _sbtTooltipEl;
  }
  function _showSbtTooltip(target) {
    const brand = target.dataset.brand;
    const pct = target.dataset.pct;
    const color = target.dataset.color || 'var(--text-dim)';
    if (!brand || pct == null) return;
    const tt = _getSbtTooltip();
    tt.innerHTML =
      `<span class="sbt-tt-dot" style="background:${color}"></span>` +
      `<span class="sbt-tt-brand">${_esc(brand)}</span>` +
      `<span class="sbt-tt-pct">${pct}%</span>`;
    tt.style.display = '';
    const r = target.getBoundingClientRect();
    // Centro horizontal do segmento; acima dele (com offset).
    const cx = r.left + r.width / 2;
    const top = r.top - 8;
    // Mede e aplica posição clampeada nas bordas do viewport
    tt.style.left = '0px'; tt.style.top = '0px';
    const tr = tt.getBoundingClientRect();
    const left = Math.max(6, Math.min(window.innerWidth - tr.width - 6, cx - tr.width / 2));
    tt.style.left = left + 'px';
    tt.style.top = Math.max(6, top - tr.height) + 'px';
  }
  function _hideSbtTooltip() {
    if (_sbtTooltipEl) _sbtTooltipEl.style.display = 'none';
  }
  function _ensureSbtTooltipWired() {
    if (_sbtTooltipWired) return;
    const card = document.getElementById('v360-sbt-card');
    if (!card) return;
    card.addEventListener('mouseover', (e) => {
      const t = e.target.closest('.sbt-seg, .sbt-rest');
      if (!t || !card.contains(t)) return;
      _showSbtTooltip(t);
    });
    card.addEventListener('mouseout', (e) => {
      const t = e.target.closest('.sbt-seg, .sbt-rest');
      if (!t) return;
      // Esconde só quando o mouse sai pro fora do alvo
      const next = e.relatedTarget;
      if (next && t.contains(next)) return;
      _hideSbtTooltip();
    });
    // Segurança: scroll/resize fecha o tooltip (posição vira stale)
    window.addEventListener('scroll', _hideSbtTooltip, true);
    window.addEventListener('resize', _hideSbtTooltip);
    _sbtTooltipWired = true;
  }

  // ─── Card 2: Top Redes por PDVs (lista) ────────────────────────────────
  function renderTopRedes() {
    const card = document.getElementById('v360-topredes-card');
    const el = document.getElementById('topBandeiras');
    const countEl = document.getElementById('topredes-count');
    if (!card || !el) return;

    const brands = _selectedBrands();
    const filtered = window.filteredData || [];

    // (Fase 9) Só em Comp; em Solo o "PDVs por Bandeira" legado cobre.
    const hasComp = window.V360CompRender
      && window.V360CompRender.getMode
      && window.V360CompRender.getMode() !== 'solo';
    if (!_isV360() || !hasComp || !brands || !brands.length || !filtered.length) {
      card.style.display = 'none';
      return;
    }
    card.style.display = '';

    // Agrupa por bandeira
    const grp = {};
    for (const r of filtered) {
      const name = r.bandeira || 'Não identificado';
      (grp[name] = grp[name] || []).push(r);
    }
    const sorted = Object.entries(grp)
      .sort((a, b) => b[1].length - a[1].length)
      .slice(0, 7);

    if (countEl) {
      countEl.textContent = `${Object.keys(grp).length.toLocaleString('pt-BR')} redes`;
    }

    const max = sorted[0]?.[1].length || 1;
    const lens = brands[0];
    const lensShort = lens.length > 5 ? lens.slice(0, 4) : lens;

    el.innerHTML = sorted.map(([name, pdvs], i) => {
      // Share médio da lente (Reais) nessa rede
      let sum = 0, n = 0;
      for (const p of pdvs) {
        const v = parseFloat(p.share_reais_sku_dimensao || 0);
        if (v > 0) { sum += v; n++; }
      }
      const avgShare = n > 0 ? (sum / n) * 100 : 0;
      const barW = (pdvs.length / max * 100).toFixed(0);
      const shortName = name.length > 22 ? name.slice(0, 21) + '…' : name;

      return `
        <div class="tb-row" data-bandeira="${_esc(name)}">
          <span class="tb-num">${i + 1}</span>
          <div class="tb-mid">
            <div class="tb-name" title="${_esc(name)}">${_esc(shortName)}</div>
            <div class="tb-sub">${pdvs.length.toLocaleString('pt-BR')} PDVs · ${avgShare.toFixed(1)}% ${_esc(lensShort)}</div>
          </div>
          <div class="tb-right">
            <div class="tb-bar"><div class="tb-bar-fill" style="width:${barW}%"></div></div>
            <span class="tb-val">${pdvs.length.toLocaleString('pt-BR')}</span>
          </div>
        </div>
      `;
    }).join('');

    // Click no item → filtra mapa por bandeira (reusa lógica existente)
    el.querySelectorAll('.tb-row').forEach(row => {
      row.addEventListener('click', function() {
        const name = this.dataset.bandeira;
        try {
          if (typeof window.selectBandeiraFromChart === 'function') {
            window.selectBandeiraFromChart(name);
          }
        } catch (e) { console.error('[v360-panel] selectBandeira:', e); }
      });
    });
  }

  // ─── Esconde blocos legados ─────────────────────────────────────────────
  // (Fase 9) Só esconde legados em modo Comp (Duelo + Categoria), onde o
  // hero card + h2hCard + sbt/topredes substituem a info.
  // Em modo Solo, os legados (mini-stats, share-geral, distribuição,
  // chart bandeiras) CONTINUAM visíveis — Solo não tem hero pra cobrir
  // e Distribuição é interativa (clique no bin filtra share bucket).
  function syncLegacyVisibility() {
    const hasComp = window.V360CompRender
      && window.V360CompRender.getMode
      && window.V360CompRender.getMode() !== 'solo';
    if (_isV360() && hasComp && (window.filteredData || []).length > 0) {
      document.body.setAttribute('data-v360-panel', 'active');
    } else {
      document.body.removeAttribute('data-v360-panel');
    }
  }

  function hideAll() {
    const sbt = document.getElementById('v360-sbt-card');
    const top = document.getElementById('v360-topredes-card');
    if (sbt) sbt.style.display = 'none';
    if (top) top.style.display = 'none';
    document.body.removeAttribute('data-v360-panel');
  }

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ─── Orquestrador ──────────────────────────────────────────────────────
  function refreshAll() {
    try { syncLegacyVisibility(); } catch (e) { console.error('[v360-panel] legacy:', e); }
    try { renderShareByType(); } catch (e) { console.error('[v360-panel] sbt:', e); }
    try { renderTopRedes(); } catch (e) { console.error('[v360-panel] top:', e); }
  }

  // ─── Init ──────────────────────────────────────────────────────────────
  function init() {
    if (!window.V360CompRender) { setTimeout(init, 100); return; }

    // Hook em updatePanels — refresh a cada atualização do panel
    if (typeof window.updatePanels === 'function' && !window._v360PanelHook) {
      const orig = window.updatePanels;
      window.updatePanels = function() {
        const r = orig.apply(this, arguments);
        try { refreshAll(); } catch (e) { console.error('[v360-panel] refresh:', e); }
        return r;
      };
      window._v360PanelHook = true;
    }

    window.addEventListener('v360:competitors-loaded', refreshAll);
    window.addEventListener('v360:perspective-changed', refreshAll);
    window.addEventListener('v360:map-closed', hideAll);

    setTimeout(refreshAll, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.V360Panel = {
    renderShareByType,
    renderTopRedes,
    refreshAll,
    hideAll,
  };
})();
