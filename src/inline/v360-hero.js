// ────────────────────────────────────────────────────────────────────────────
// V360 Hero — Fase 3: hero dinâmico no painel direito (tab Overview)
// + h2h card adaptativo (2 marcas = bars, 3+ marcas = matriz N×N)
// ────────────────────────────────────────────────────────────────────────────
// Funciona em conjunto com:
//   - V360Comp (lente + concorrentes selecionados)
//   - V360CompRender (getShareForBrand, brandsList, getTicketsFloor)
//   - app.js updatePanels (monkey-patched aqui pra disparar re-render)
//
// Estados do hero por # de marcas:
//   1 marca (Solo)  : esconde hero, mantém cards legados (Share Geral, Distrib)
//   2 marcas (Duelo): big number + 1 linha secundária + delta vs concorrente
//   3+ (Categoria)  : big number + N linhas secundárias + matriz h2h
//
// Quando há concorrentes (modo Duelo/Categoria), o hero substitui os blocos
// legados (mini-stats, Share Geral, Distribuição de Share) via flag no body
// `data-v360-hero="active"` (esconde via CSS).
// ────────────────────────────────────────────────────────────────────────────

(function() {
  'use strict';

  // Helper: busca brand_color em V360Comp.getState (não está exposto direto)
  function _getBrandColor(brandName) {
    const cm = window.V360CompRender?.brandsList?.()?.colorMap || {};
    return cm[brandName] || '#94a3b8';
  }

  // Helper: nome "curto" da marca (max 12 chars) pra cabeçalhos da matriz
  function _short(name) {
    const n = String(name || '');
    if (n.length <= 12) return n;
    return n.slice(0, 11) + '…';
  }

  // Helper: escape HTML
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function _isV360() {
    return window.currentMapType === 'varejo360';
  }

  // Lê marcas em ordem [lente, ...others]. Se V360CompRender não estiver pronto
  // ou não há base_brand, retorna null (hero não renderiza).
  function _selectedBrands() {
    if (!window.V360CompRender || !window._currentMapBaseBrand) return null;
    const b = window.V360CompRender.brandsList();
    if (!b || !b.perspective) return null;
    return [b.perspective].concat((b.others || []).filter(x => x && x !== b.perspective));
  }

  // Calcula share médio (em decimal 0-1) de uma marca em allData
  // usando V360CompRender.getShareForBrand. Marcas concorrentes que não
  // têm PDV mapeado contam como 0 (mesma lógica do protótipo).
  function _avgShareForBrand(allRows, brand) {
    const fn = window.V360CompRender?.getShareForBrand;
    if (!fn) return { avg: 0, coverage: 0, nzShares: [] };
    let sum = 0, n = 0, cov = 0;
    const nz = [];
    for (const row of allRows) {
      const data = fn(row, brand);
      const s = data && data.share != null ? data.share : 0;
      sum += s;
      n++;
      if (s > 0.005) { cov++; nz.push(s); }
    }
    return {
      avg: n > 0 ? sum / n : 0,
      coverage: cov,
      total: n,
      nzShares: nz,
    };
  }

  // ─── HERO ───────────────────────────────────────────────────────────────
  function renderHero() {
    const el = document.getElementById('hero');
    const section = document.getElementById('hero-section');
    if (!el || !section) return;

    const brands = _selectedBrands();
    const all = (window.allData || []);

    // Sem V360, sem mapa aberto, ou sem dados → esconde hero e mostra blocos legados
    if (!_isV360() || !brands || !brands.length || !all.length) {
      section.style.display = 'none';
      el.innerHTML = '';
      document.body.removeAttribute('data-v360-hero');
      return;
    }

    const lens = brands[0];
    const concs = brands.slice(1);
    const lensColor = _getBrandColor(lens);

    // Stats da lente
    const lensStats = _avgShareForBrand(all, lens);
    const lensAvg = lensStats.avg;
    const coverage = lensStats.coverage;
    const lensNZ = lensStats.nzShares;

    // Solo (sem concorrentes): esconde hero, mantém UI antiga.
    // Isso preserva comportamento de mapas que ainda não têm concorrente uploaded.
    if (concs.length === 0) {
      section.style.display = 'none';
      el.innerHTML = '';
      document.body.removeAttribute('data-v360-hero');
      return;
    }

    // A partir daqui: 2+ marcas. Hero ativo → esconde blocos legados.
    document.body.setAttribute('data-v360-hero', 'active');
    section.style.display = '';

    // Gap médio da lente vs média dos concorrentes (em pp)
    let avgGap = 0;
    if (concs.length > 0) {
      const gaps = all.map(row => {
        const ls = (window.V360CompRender.getShareForBrand(row, lens)?.share) || 0;
        const csum = concs.reduce((s, c) => s + ((window.V360CompRender.getShareForBrand(row, c)?.share) || 0), 0);
        const cAvg = csum / concs.length;
        return ls - cAvg;
      });
      avgGap = (gaps.reduce((s, v) => s + v, 0) / gaps.length) * 100;
    }

    // Linhas dos concorrentes (modo Duelo/Categoria)
    const allAvgs = brands.map(b => _avgShareForBrand(all, b).avg);
    const maxScale = Math.max.apply(null, allAvgs.concat(0.001));
    const secondaryRows = concs.map(c => {
      const color = _getBrandColor(c);
      const cAvg = _avgShareForBrand(all, c).avg;
      const gap = (lensAvg - cAvg) * 100;
      const w = (cAvg / maxScale * 100).toFixed(0);
      return `
        <div class="bs-row" style="color:${color}">
          <span class="bs-dot"></span>
          <span class="bs-name">${_esc(c)}</span>
          <div class="bs-bar-wrap"><div class="bs-bar" style="width:${w}%"></div></div>
          <div class="bs-val">
            ${(cAvg * 100).toFixed(1)}%
            <span class="gap ${gap > 0 ? 'pos' : gap < 0 ? 'neg' : ''}">${gap > 0 ? '+' : ''}${gap.toFixed(1)}pp</span>
          </div>
        </div>`;
    }).join('');
    const secondaryHtml = `<div class="brand-secondary">${secondaryRows}</div>`;

    // Histograma da lente — bins de share %
    const bins = [0, 2, 5, 10, 15, 20, 30, 50, 100];
    const lensSharesPct = all.map(row => ((window.V360CompRender.getShareForBrand(row, lens)?.share) || 0) * 100);
    const counts = bins.slice(0, -1).map((v, i) =>
      lensSharesPct.filter(s => s >= v && s < bins[i + 1]).length
    );
    const maxCount = Math.max.apply(null, counts.concat(1));
    const histBars = counts.map((c, i) => {
      const h = (c / maxCount * 100).toFixed(0);
      return `<div class="spark-bar ${i === 0 ? '' : 'accent'}" style="height:${Math.max(parseFloat(h), 2)}%" title="${bins[i]}–${bins[i + 1]}%: ${c.toLocaleString('pt-BR')} PDVs"></div>`;
    }).join('');
    const histLabels = bins.slice(0, -1).map((v, i) =>
      `<div>${v}-${bins[i + 1] === 100 ? '' : bins[i + 1]}</div>`
    ).join('');

    // Big number — divide em parte inteira + decimal
    const lensAvgPct = lensAvg * 100;
    const intVal = Math.floor(lensAvgPct);
    const decVal = (lensAvgPct % 1).toFixed(1).slice(2); // pega "5" de "X.5"

    // Delta — sempre presente em modo Duelo/Categoria
    const deltaLabel = concs.length === 1 ? `vs. ${_esc(concs[0])}` : 'vs. média conc.';
    const deltaHtml = `
      <div class="bp-right">
        <span class="bp-delta ${avgGap >= 0 ? 'pos' : 'neg'}">${avgGap > 0 ? '↑ +' : '↓ '}${Math.abs(avgGap).toFixed(1)}pp</span>
        <span class="bp-delta-label">${deltaLabel}</span>
      </div>
    `;

    // Sem zeros: média ex-zeros
    const lensNZAvg = lensNZ.length > 0 ? (lensNZ.reduce((s, v) => s + v, 0) / lensNZ.length * 100).toFixed(1) : '0.0';
    const absentCount = all.length - coverage;
    const covPct = all.length > 0 ? (coverage / all.length * 100).toFixed(0) : 0;

    el.innerHTML = `
      <div class="hero-top">
        <span class="hero-title" style="color:${lensColor}">
          <span class="dot"></span>${_esc(lens)}
        </span>
        <span class="hero-context">${all.length.toLocaleString('pt-BR')} PDVs · cobertura ${covPct}%</span>
      </div>
      <div class="brand-primary">
        <div class="bp-left">
          <div class="bp-brand-row" style="color:${lensColor}">
            <span class="pdot"></span>
            <span style="color:var(--text-dim)">Share médio (R$)</span>
          </div>
          <div class="bp-value-row">
            <span class="bp-value">${intVal}<span class="dec">.${decVal}</span></span>
            <span class="bp-unit">%</span>
          </div>
        </div>
        ${deltaHtml}
      </div>
      ${secondaryHtml}
      <div class="spark">
        <div class="spark-head">
          <span>Distribuição de share — ${_esc(lens)}</span>
          <span class="meta">${lensNZAvg}% médio ex. zeros · ${absentCount.toLocaleString('pt-BR')} sem presença</span>
        </div>
        <div class="spark-bars">${histBars}</div>
        <div class="spark-labels">${histLabels}</div>
      </div>
    `;
  }

  // ─── H2H CARD (Comparativo entre marcas) ────────────────────────────────
  function renderH2H() {
    const card = document.getElementById('h2hCard');
    if (!card) return;
    const titleEl = document.getElementById('h2hTitle');
    const content = document.getElementById('h2hContent');
    if (!titleEl || !content) return;

    const brands = _selectedBrands();
    const all = (window.allData || []);

    if (!_isV360() || !brands || brands.length < 2 || !all.length) {
      card.style.display = 'none';
      return;
    }
    card.style.display = '';

    const getShare = window.V360CompRender.getShareForBrand;

    if (brands.length === 2) {
      const [a, b] = brands;
      titleEl.textContent = `${a} vs ${b}`;
      const colorA = _getBrandColor(a);
      const colorB = _getBrandColor(b);

      let aWin = 0, bWin = 0, tied = 0;
      let aSum = 0, bSum = 0, compared = 0;
      for (const row of all) {
        const sA = (getShare(row, a)?.share) || 0;
        const sB = (getShare(row, b)?.share) || 0;
        if (sA < 0.005 && sB < 0.005) continue;
        compared++;
        aSum += sA; bSum += sB;
        if (Math.abs(sA - sB) < 0.005) tied++;
        else if (sA > sB) aWin++;
        else bWin++;
      }
      const totalCompetes = aWin + bWin;
      const aPct = totalCompetes > 0 ? Math.round(aWin / totalCompetes * 100) : 0;
      const bPct = totalCompetes > 0 ? Math.round(bWin / totalCompetes * 100) : 0;
      const aAvg = compared > 0 ? aSum / compared * 100 : 0;
      const bAvg = compared > 0 ? bSum / compared * 100 : 0;
      const maxBar = Math.max(aAvg, bAvg, 1);

      content.innerHTML = `
        <div class="h2h-pair">
          <div class="h2h-bar-row" style="color:${colorA}">
            <div class="h2h-bar-label">
              <div class="h2h-brand"><span class="dot"></span><span>${_esc(_short(a))}</span></div>
            </div>
            <div class="h2h-bar-track"><div class="h2h-bar-fill" style="width:${aAvg / maxBar * 100}%"></div></div>
            <div class="h2h-bar-val">${aAvg.toFixed(1)}%<span class="pct">${aWin.toLocaleString('pt-BR')} · ${aPct}%</span></div>
          </div>
          <div class="h2h-bar-row" style="color:${colorB}">
            <div class="h2h-bar-label">
              <div class="h2h-brand"><span class="dot"></span><span>${_esc(_short(b))}</span></div>
            </div>
            <div class="h2h-bar-track"><div class="h2h-bar-fill" style="width:${bAvg / maxBar * 100}%"></div></div>
            <div class="h2h-bar-val">${bAvg.toFixed(1)}%<span class="pct">${bWin.toLocaleString('pt-BR')} · ${bPct}%</span></div>
          </div>
          <div class="h2h-footer">
            <span>${compared.toLocaleString('pt-BR')} PDVs comparados</span>
            <span>${tied.toLocaleString('pt-BR')} empate${tied !== 1 ? 's' : ''}</span>
          </div>
        </div>
      `;
    } else {
      // Matriz N×N (3+ marcas)
      titleEl.textContent = 'Matriz cabeça-a-cabeça';
      const cols = brands.length;
      let html = `<div class="h2h-grid" style="grid-template-columns:auto repeat(${cols},minmax(0,1fr));">`;
      html += `<div class="h2h-cell h2h-corner">Vence ↓<br>Perde →</div>`;
      brands.forEach(b => {
        const color = _getBrandColor(b);
        html += `<div class="h2h-cell h2h-head" style="color:${color}"><span class="dot"></span>${_esc(_short(b))}</div>`;
      });
      brands.forEach(rowB => {
        const rowColor = _getBrandColor(rowB);
        html += `<div class="h2h-cell h2h-rowhead" style="color:${rowColor}"><span class="dot"></span>${_esc(_short(rowB))}</div>`;
        brands.forEach(colB => {
          if (rowB === colB) {
            html += `<div class="h2h-cell h2h-data same"><span class="num">—</span></div>`;
          } else {
            let wins = 0, total = 0;
            for (const row of all) {
              const sR = (getShare(row, rowB)?.share) || 0;
              const sC = (getShare(row, colB)?.share) || 0;
              if (sR < 0.005 && sC < 0.005) continue;
              total++;
              if (sR > sC) wins++;
            }
            const pct = total > 0 ? Math.round(wins / total * 100) : 0;
            html += `<div class="h2h-cell h2h-data ${pct > 50 ? 'win' : 'lose'}">
              <span class="num">${wins.toLocaleString('pt-BR')}</span>
              <span class="pct">${pct}%</span>
            </div>`;
          }
        });
      });
      html += `</div>`;
      content.innerHTML = html;
    }
  }

  // ─── Header hstat — Share médio (lente) (Fase 5) ────────────────────────
  // Só visível em modo Duelo/Categoria (lente = ponto de vista relevante).
  // Em Solo, a métrica de share médio já está na 2ª map pill — evita redundância.
  function renderHeaderLensStat() {
    const stat = document.getElementById('hstat-lens');
    const valEl = document.getElementById('h-lens-share');
    const labelEl = document.getElementById('h-lens-label');
    if (!stat || !valEl || !labelEl) return;

    const brands = _selectedBrands();
    const filtered = (window.filteredData || []);

    // Esconde em: não-V360, sem brands, Solo (1 marca), ou sem dados visíveis
    if (!_isV360() || !brands || brands.length < 2 || !filtered.length) {
      stat.style.display = 'none';
      return;
    }

    const lens = brands[0];
    const stats = _avgShareForBrand(filtered, lens);
    const pct = (stats.avg * 100).toFixed(1);
    valEl.textContent = pct + '%';
    labelEl.textContent = `Share médio (${lens.length > 10 ? lens.slice(0, 9) + '…' : lens})`;
    stat.style.display = '';
  }

  // ─── Map pill "Lente vence em X (Y%)" (Fase 5) ──────────────────────────
  // Só visível em modo Duelo/Categoria (precisa de 2+ marcas).
  function renderMapPillWins() {
    const pill = document.getElementById('overlay-lens-wins');
    const valEl = document.getElementById('overlay-lens-wins-val');
    const textEl = document.getElementById('overlay-lens-wins-text');
    const dotEl = document.getElementById('overlay-lens-wins-dot');
    if (!pill || !valEl || !textEl) return;

    const brands = _selectedBrands();
    const filtered = (window.filteredData || []);

    if (!_isV360() || !brands || brands.length < 2 || !filtered.length) {
      pill.style.display = 'none';
      return;
    }

    const lens = brands[0];
    const concs = brands.slice(1);
    const lensColor = _getBrandColor(lens);
    const getShare = window.V360CompRender.getShareForBrand;

    // Conta PDVs onde a lente vence pelo menos 1 concorrente (gap > 0)
    // OBS: usa filteredData (não allData) pra refletir filtros ativos
    let wins = 0, compared = 0;
    for (const row of filtered) {
      const ls = (getShare(row, lens)?.share) || 0;
      let anyConcShare = false;
      let lensWinsAll = true;
      for (const c of concs) {
        const cs = (getShare(row, c)?.share) || 0;
        if (ls < 0.005 && cs < 0.005) continue;
        anyConcShare = true;
        if (ls <= cs) { lensWinsAll = false; break; }
      }
      if (!anyConcShare && ls < 0.005) continue;
      compared++;
      if (lensWinsAll && ls > 0.005) wins++;
    }
    const pct = compared > 0 ? Math.round(wins / compared * 100) : 0;

    if (dotEl) dotEl.style.background = lensColor;
    const lensShort = lens.length > 12 ? lens.slice(0, 11) + '…' : lens;
    textEl.textContent = `${lensShort} vence:`;
    valEl.textContent = `${wins.toLocaleString('pt-BR')} (${pct}%)`;
    pill.style.display = '';
  }

  // ─── Orquestrador: chamado em todo updatePanels + eventos do módulo ─────
  function refreshAll() {
    try { renderHero(); } catch(e) { console.error('[v360-hero] renderHero:', e); }
    try { renderH2H(); } catch(e) { console.error('[v360-hero] renderH2H:', e); }
    try { renderHeaderLensStat(); } catch(e) { console.error('[v360-hero] headerLensStat:', e); }
    try { renderMapPillWins(); } catch(e) { console.error('[v360-hero] mapPillWins:', e); }
  }

  // Esconde tudo (chamado em map-closed/mode-switch pra sair de V360)
  function hideAll() {
    const heroSection = document.getElementById('hero-section');
    const h2hCard = document.getElementById('h2hCard');
    if (heroSection) heroSection.style.display = 'none';
    if (h2hCard) h2hCard.style.display = 'none';
    const heroEl = document.getElementById('hero');
    if (heroEl) heroEl.innerHTML = '';
    document.body.removeAttribute('data-v360-hero');
    // Fase 5: esconder hstat lens + map pill wins
    const lensStat = document.getElementById('hstat-lens');
    if (lensStat) lensStat.style.display = 'none';
    const pillWins = document.getElementById('overlay-lens-wins');
    if (pillWins) pillWins.style.display = 'none';
  }

  // ─── Init: hooks + listeners ────────────────────────────────────────────
  function init() {
    if (!window.V360Comp || !window.V360CompRender) {
      setTimeout(init, 100);
      return;
    }

    // Hook em updatePanels — refresh hero/h2h sempre que filtros/data mudam
    if (typeof window.updatePanels === 'function' && !window._v360HeroPanelHook) {
      const orig = window.updatePanels;
      window.updatePanels = function() {
        const r = orig.apply(this, arguments);
        // Pequeno delay pra deixar o app terminar update primeiro
        setTimeout(refreshAll, 60);
        return r;
      };
      window._v360HeroPanelHook = true;
    }

    // Reagir a mudanças de concorrentes/perspectiva
    window.addEventListener('v360:competitors-loaded', refreshAll);
    window.addEventListener('v360:perspective-changed', refreshAll);
    window.addEventListener('v360:map-closed', hideAll);

    // Render inicial
    refreshAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // API pública (smoke-testable + futuras integrações)
  window.V360Hero = {
    renderHero,
    renderH2H,
    renderHeaderLensStat,
    renderMapPillWins,
    refreshAll,
    hideAll,
  };

})();
