// ────────────────────────────────────────────────────────────────────────────
// V360 Competitors — PR3: Tickets floor + Oportunidades + CSV + Por bandeira
// ────────────────────────────────────────────────────────────────────────────
// Adiciona 4 features sobre PR1+PR2, todas gated em modo Duelo/Categoria
// (quando há ao menos 1 concorrente carregado):
//
//   1. Slider de piso de tickets no painel de filtros (persiste em
//      saved_maps.tickets_floor, dispara reclassificação)
//   2. Sub-seção "Oportunidades priorizadas" na aba Análise — top 50 PDVs
//      ranqueados por share_concorrente × tickets_amostra (potencial absoluto
//      de venda perdida). Clicável -> fly to + popup.
//   3. Botão "Baixar CSV comparativo" no kebab menu — exporta CNPJ, bandeira,
//      estado competitivo, share de cada marca, tickets.
//   4. Sub-seção "Análise por bandeira" — agrupa por rede, mostra para cada
//      uma: PDVs liderados pela marca base, oportunidades, share médio relativo.
//
// Zero modificação em app.js / index.html. Tudo via DOM dinâmico.
// ────────────────────────────────────────────────────────────────────────────

(function() {
  'use strict';

  let _saveDebounce = null;

  // ─── Helpers ────────────────────────────────────────────────────────────
  function isV360() { return window.currentMapType === 'varejo360'; }
  function isShared() { return !!window._isSharedMode; }
  function hasCompetitors() {
    const st = window.V360Comp?.getState?.();
    return !!(st && st.competitors && st.competitors.length > 0);
  }
  function getMode() {
    return window.V360CompRender?.getMode?.() || 'solo';
  }
  function getBaseBrand() { return (window._currentMapBaseBrand || '').toUpperCase().trim(); }
  function fmtInt(n) { return Number(n || 0).toLocaleString('pt-BR'); }
  function fmtPct(v) { return (Number(v || 0) * 100).toFixed(1) + '%'; }
  function classify(row) {
    return window.V360CompRender?.classifyRow?.(row) || null;
  }

  // ─── 1. Slider de piso de tickets ───────────────────────────────────────
  function ensureTicketsFloorSlider() {
    if (!isV360() || !hasCompetitors() || isShared()) {
      const el = document.getElementById('v360-floor-wrap');
      if (el) el.style.display = 'none';
      return;
    }
    let wrap = document.getElementById('v360-floor-wrap');
    const st = window.V360Comp.getState();
    const currentFloor = st.ticketsFloor || 5;

    if (!wrap) {
      const anchor = document.querySelector('.filter-group-minrede');
      if (!anchor) return;
      wrap = document.createElement('div');
      wrap.className = 'filter-group';
      wrap.id = 'v360-floor-wrap';
      wrap.innerHTML = `
        <div class="filter-label" title="Mínimo de tickets na amostra para considerar share válido em comparativos. Amostras menores caem em Whitespace.">Piso de tickets (comparativo)</div>
        <div class="range-row">
          <input type="range" id="v360-floor-slider" aria-label="Piso de tickets" min="1" max="30" value="${currentFloor}" step="1">
          <span class="range-label" id="v360-floor-label">${currentFloor}</span>
        </div>
      `;
      anchor.parentNode.insertBefore(wrap, anchor.nextSibling);
      const slider = wrap.querySelector('#v360-floor-slider');
      const label = wrap.querySelector('#v360-floor-label');
      slider.oninput = () => {
        const v = parseInt(slider.value, 10);
        label.textContent = v;
        applyTicketsFloor(v);
      };
    } else {
      wrap.style.display = '';
      const slider = wrap.querySelector('#v360-floor-slider');
      const label = wrap.querySelector('#v360-floor-label');
      if (slider && parseInt(slider.value, 10) !== currentFloor) slider.value = currentFloor;
      if (label) label.textContent = currentFloor;
    }
  }

  function applyTicketsFloor(value) {
    // Atualiza state interno do V360Comp
    if (window.V360Comp?.setTicketsFloor) {
      window.V360Comp.setTicketsFloor(value);
    }
    // Limpa override caso tenha sido setado
    window._v360TicketsFloorOverride = null;
    // Re-render via evento
    try { window.dispatchEvent(new CustomEvent('v360:perspective-changed', { detail: { tickets_floor: value } })); } catch(_) {}

    // Persiste em saved_maps com debounce
    if (_saveDebounce) clearTimeout(_saveDebounce);
    _saveDebounce = setTimeout(async () => {
      const mapId = window._currentOpenMapId;
      if (!mapId) return;
      try {
        await window.sbFetch('saved_maps?id=eq.' + mapId, {
          method: 'PATCH',
          headers: { 'Prefer': 'return=minimal' },
          body: JSON.stringify({ tickets_floor: value })
        });
      } catch(e) {
        console.warn('[v360-pr3] tickets_floor save failed:', e.message);
      }
    }, 500);
  }

  // ─── 2. Oportunidades priorizadas ───────────────────────────────────────
  // Score: share_concorrente_lider * tickets_amostra
  // Filtra PDVs onde marca base está ausente (share=0) OU perdendo forte
  // (estados OPPORTUNITY, VULNERABLE, BEHIND, em modo Duelo)
  // Em modo Categoria: PDVs onde a perspectiva atual NÃO é líder

  function computeOpportunities(data, limit) {
    if (!hasCompetitors()) return [];
    const mode = getMode();
    if (mode === 'solo') return [];
    const persp = (window.V360Comp.getState().perspectiveBrand || getBaseBrand()).toUpperCase();
    const baseBrand = getBaseBrand();

    const ops = [];
    for (const row of data) {
      const cls = classify(row);
      if (!cls) continue;
      // Só considera PDVs onde a perspectiva NÃO está vencendo
      if (mode === 'duelo') {
        if (!['opportunity','vulnerable','behind','dispute'].includes(cls.state)) continue;
      } else {
        // Categoria: perspectiva não é líder
        if (cls.leaderBrand === persp) continue;
        if (cls.state === 'whitespace' || cls.state === 'exclusive') continue;
      }
      // Score: share do líder × tickets
      const leaderShare = cls.allShares
        ? (cls.allShares.find(s => s.brand === cls.leaderBrand)?.share || 0)
        : Math.abs(cls.otherShare || 0);
      const tickets = parseInt(row.tickets_amostra || 0);
      const score = leaderShare * tickets;
      if (score <= 0) continue;

      // Share da perspectiva nesse PDV
      let perspShare = 0;
      if (persp === baseBrand) {
        perspShare = parseFloat(row.share_reais_sku_dimensao || 0);
      } else if (cls.allShares) {
        perspShare = cls.allShares.find(s => s.brand === persp)?.share || 0;
      } else if (mode === 'duelo' && persp === baseBrand) {
        perspShare = cls.baseShare;
      }

      ops.push({
        row,
        cnpj_14: row.cnpj_14,
        bandeira: row.bandeira || 'Não identificado',
        leaderBrand: cls.leaderBrand,
        leaderShare,
        perspShare,
        tickets,
        score,
        state: cls.state,
      });
    }
    ops.sort((a, b) => b.score - a.score);
    return ops.slice(0, limit || 50);
  }

  function renderOpportunitiesSection() {
    if (!isV360() || !hasCompetitors() || getMode() === 'solo') {
      const el = document.getElementById('v360-opportunities-section');
      if (el) el.style.display = 'none';
      return;
    }
    const tcAnalysis = document.getElementById('tc-analysis');
    if (!tcAnalysis) return;

    let section = document.getElementById('v360-opportunities-section');
    if (!section) {
      section = document.createElement('div');
      section.id = 'v360-opportunities-section';
      section.className = 'panel-section';
      tcAnalysis.insertBefore(section, tcAnalysis.firstChild);
    }
    section.style.display = '';

    const data = window.filteredData || [];
    const ops = computeOpportunities(data, 50);
    const persp = window.V360Comp.getState().perspectiveBrand || getBaseBrand();
    const colorMap = buildColorMap();
    const perspColor = colorMap[persp.toUpperCase()] || 'var(--accent)';

    if (!ops.length) {
      section.innerHTML = `
        <div class="panel-section-title">Oportunidades priorizadas · ${persp}</div>
        <div style="padding:12px;text-align:center;color:var(--text-muted);font-size:11.5px;">
          Nenhuma oportunidade detectada no filtro atual.
        </div>
      `;
      return;
    }

    const totalPotential = ops.reduce((sum, o) => sum + o.score, 0);
    const top10Potential = ops.slice(0, 10).reduce((sum, o) => sum + o.score, 0);
    const top10Pct = totalPotential ? (top10Potential / totalPotential * 100).toFixed(0) : 0;

    let rowsHtml = '';
    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      const leaderColor = colorMap[op.leaderBrand?.toUpperCase()] || 'var(--lose)';
      const stateLabel = window.V360CompRender?.STATE_LABELS?.[op.state] || op.state;
      const stateColor = window.V360CompRender?.STATE_COLORS?.[op.state] || 'var(--absent)';
      const isAbsent = op.perspShare <= 0;

      rowsHtml += `
        <div class="v360-op-row" data-cnpj="${op.cnpj_14}" data-idx="${i}">
          <div class="v360-op-rank">${i+1}</div>
          <div class="v360-op-mid">
            <div class="v360-op-bandeira">${op.bandeira}</div>
            <div class="v360-op-cnpj">${op.cnpj_14}</div>
          </div>
          <div class="v360-op-right">
            <div class="v360-op-leader">
              <span class="v360-op-dot" style="background:${leaderColor};"></span>
              <span class="v360-op-leader-val" style="color:${leaderColor};">${(op.leaderShare * 100).toFixed(1)}%</span>
            </div>
            <div class="v360-op-meta">${fmtInt(op.tickets)} tickets · ${isAbsent ? `<span class="v360-op-state" style="color:${stateColor};">${stateLabel}</span>` : `você ${(op.perspShare*100).toFixed(1)}%`}</div>
          </div>
        </div>
      `;
    }

    section.innerHTML = `
      <div class="panel-section-title">Oportunidades priorizadas · <span style="color:${perspColor};">${persp}</span></div>
      <div class="v360-op-subtitle">
        Top ${ops.length} PDVs ranqueados por <b>share × tickets</b> onde a marca não está vencendo. Os top 10 concentram <b>${top10Pct}%</b> do potencial.
      </div>
      <div id="v360-op-list" class="v360-op-list">
        ${rowsHtml}
      </div>
      <div class="v360-op-actions">
        <button id="v360-op-export" class="v360-op-export">Baixar CSV das oportunidades</button>
      </div>
    `;

    // Wire up clicks: fly to + popup
    section.querySelectorAll('.v360-op-row').forEach(el => {
      el.onclick = () => {
        const idx = parseInt(el.dataset.idx, 10);
        const op = ops[idx];
        if (!op) return;
        flyToPdv(op.row);
      };
    });
    const exportBtn = section.querySelector('#v360-op-export');
    if (exportBtn) exportBtn.onclick = () => exportOpportunitiesCSV(ops, persp);
  }

  function flyToPdv(row) {
    if (!window.map || !window.maplibregl) return;
    const lat = parseFloat(row.lat);
    const lon = parseFloat(row.lon);
    if (!lat || !lon) return;
    window.map.flyTo({ center: [lon, lat], zoom: Math.max(window.map.getZoom(), 14), duration: 800 });
    setTimeout(() => {
      try {
        // Fecha popups abertos antes de abrir novo
        const existing = document.querySelectorAll('.maplibregl-popup');
        existing.forEach(p => p.remove());
        const html = window.buildPopup(row);
        new window.maplibregl.Popup({ maxWidth: '340px', closeButton: true, anchor: 'bottom' })
          .setLngLat([lon, lat])
          .setHTML(html)
          .addTo(window.map);
      } catch(e) { console.warn('[v360-pr3] fly popup failed:', e); }
    }, 900);
  }

  // ─── 3. Export CSV comparativo ─────────────────────────────────────────
  function exportComparativeCSV() {
    if (!hasCompetitors()) return;
    const data = window.filteredData || [];
    const persp = window.V360Comp.getState().perspectiveBrand || getBaseBrand();
    const baseBrand = getBaseBrand();
    const competitors = window.V360Comp.getState().competitors;
    const brands = [baseBrand, ...competitors.map(c => c.brand_name)];

    // Header
    const header = [
      'cnpj_14', 'bandeira', 'razao_social', 'uf', 'cidade',
      'estado_competitivo', 'marca_lider', 'tickets_amostra',
    ];
    for (const b of brands) header.push(`share_${b.toLowerCase().replace(/\s+/g,'_')}`);

    const lines = [header.join(',')];
    for (const row of data) {
      const cls = classify(row);
      const sharesByBrand = {};
      // base
      sharesByBrand[baseBrand] = parseFloat(row.share_reais_sku_dimensao || 0);
      for (const c of competitors) {
        const pdv = window.V360Comp.getCompetitorPdv(c.brand_name, row.cnpj_14);
        sharesByBrand[c.brand_name] = pdv?.share_reais_sku_dimensao != null
          ? parseFloat(pdv.share_reais_sku_dimensao) : 0;
      }
      const stateLabel = window.V360CompRender?.STATE_LABELS?.[cls?.state] || '';
      const fields = [
        csvEsc(row.cnpj_14),
        csvEsc(row.bandeira || ''),
        csvEsc(row.razao_social || ''),
        csvEsc(row.uf || ''),
        csvEsc(row.cidade || ''),
        csvEsc(stateLabel),
        csvEsc(cls?.leaderBrand || ''),
        row.tickets_amostra || 0,
      ];
      for (const b of brands) fields.push((sharesByBrand[b] || 0).toFixed(6));
      lines.push(fields.join(','));
    }
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const fname = `comparativo_${persp}_${new Date().toISOString().slice(0,10)}.csv`;
    triggerDownload(url, fname);
  }

  function exportOpportunitiesCSV(ops, persp) {
    const header = ['rank','cnpj_14','bandeira','marca_lider','share_lider','tickets','score','estado','seu_share'];
    const lines = [header.join(',')];
    ops.forEach((op, i) => {
      lines.push([
        i+1,
        csvEsc(op.cnpj_14),
        csvEsc(op.bandeira),
        csvEsc(op.leaderBrand || ''),
        op.leaderShare.toFixed(6),
        op.tickets,
        op.score.toFixed(2),
        csvEsc(window.V360CompRender?.STATE_LABELS?.[op.state] || op.state),
        op.perspShare.toFixed(6),
      ].join(','));
    });
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    triggerDownload(url, `oportunidades_${persp}_${new Date().toISOString().slice(0,10)}.csv`);
  }

  function csvEsc(v) {
    if (v == null) return '';
    const s = String(v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function triggerDownload(url, filename) {
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 100);
  }

  // Insere item no kebab menu
  function ensureKebabItem() {
    if (!isV360() || !hasCompetitors() || isShared()) {
      const el = document.getElementById('menu-item-comp-csv');
      if (el) el.style.display = 'none';
      return;
    }
    let item = document.getElementById('menu-item-comp-csv');
    if (!item) {
      const csvItem = document.getElementById('menu-item-csv');
      if (!csvItem) return;
      item = document.createElement('button');
      item.id = 'menu-item-comp-csv';
      item.className = 'hdr-dropdown-item';
      item.setAttribute('role', 'menuitem');
      item.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="9" x2="15" y2="9"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/></svg>Baixar CSV comparativo`;
      item.onclick = () => {
        const closeFn = window.closeMoreMenu;
        if (typeof closeFn === 'function') closeFn();
        exportComparativeCSV();
      };
      csvItem.parentNode.insertBefore(item, csvItem);
    }
    item.style.display = '';
  }

  // ─── 4. Análise por bandeira ────────────────────────────────────────────
  // Agrupa filteredData por bandeira, computa para cada uma:
  // - PDVs liderados pela perspectiva
  // - PDVs onde está atrás/vulnerável
  // - Oportunidades abertas
  // - Share médio relativo (perspectiva ÷ líder)

  function computeByBandeira(data, minPdvs) {
    const persp = (window.V360Comp.getState().perspectiveBrand || getBaseBrand()).toUpperCase();
    const baseBrand = getBaseBrand();
    const groups = {};
    for (const row of data) {
      const cls = classify(row);
      if (!cls) continue;
      const band = row.bandeira || 'Não identificado';
      if (!groups[band]) {
        groups[band] = { name: band, total: 0, wins: 0, loses: 0, opportunities: 0, disputes: 0, whitespace: 0, perspShares: [], leaderShares: [] };
      }
      const g = groups[band];
      g.total++;
      const isLeader = cls.leaderBrand && cls.leaderBrand.toUpperCase() === persp;
      const state = cls.state;
      if (isLeader && (state === 'dominance' || state === 'leadership' || state === 'exclusive')) g.wins++;
      else if (state === 'dispute') g.disputes++;
      else if (state === 'opportunity') g.opportunities++;
      else if (state === 'whitespace') g.whitespace++;
      else if (state === 'behind' || state === 'vulnerable') g.loses++;

      // Share da perspectiva
      let ps = 0;
      if (persp === baseBrand) {
        ps = parseFloat(row.share_reais_sku_dimensao || 0);
      } else if (cls.allShares) {
        ps = cls.allShares.find(s => s.brand === persp)?.share || 0;
      } else if (getMode() === 'duelo' && persp === baseBrand) {
        ps = cls.baseShare;
      } else {
        const pdv = window.V360Comp.getCompetitorPdv(persp, row.cnpj_14);
        ps = pdv?.share_reais_sku_dimensao != null ? parseFloat(pdv.share_reais_sku_dimensao) : 0;
      }
      if (ps > 0) g.perspShares.push(ps);
      const leaderShare = cls.allShares
        ? (cls.allShares.find(s => s.brand === cls.leaderBrand)?.share || 0)
        : Math.max(cls.baseShare || 0, cls.otherShare || 0);
      if (leaderShare > 0) g.leaderShares.push(leaderShare);
    }
    // Filtra mínimo e calcula
    const list = Object.values(groups).filter(g => g.total >= minPdvs);
    for (const g of list) {
      g.winRate = g.total ? g.wins / g.total : 0;
      g.loseRate = g.total ? g.loses / g.total : 0;
      g.opRate = g.total ? g.opportunities / g.total : 0;
      g.perspAvgShare = g.perspShares.length ? g.perspShares.reduce((a,b)=>a+b,0) / g.perspShares.length : 0;
      g.leaderAvgShare = g.leaderShares.length ? g.leaderShares.reduce((a,b)=>a+b,0) / g.leaderShares.length : 0;
      g.netScore = g.winRate - g.loseRate;
    }
    return list;
  }

  function renderByBandeiraSection() {
    if (!isV360() || !hasCompetitors() || getMode() === 'solo') {
      const el = document.getElementById('v360-by-bandeira-section');
      if (el) el.style.display = 'none';
      return;
    }
    const tcAnalysis = document.getElementById('tc-analysis');
    if (!tcAnalysis) return;

    let section = document.getElementById('v360-by-bandeira-section');
    if (!section) {
      section = document.createElement('div');
      section.id = 'v360-by-bandeira-section';
      section.className = 'panel-section';
      // Insere depois da seção de oportunidades
      const opSection = document.getElementById('v360-opportunities-section');
      if (opSection && opSection.nextSibling) {
        tcAnalysis.insertBefore(section, opSection.nextSibling);
      } else if (opSection) {
        tcAnalysis.appendChild(section);
      } else {
        tcAnalysis.insertBefore(section, tcAnalysis.firstChild);
      }
    }
    section.style.display = '';

    const data = window.filteredData || [];
    // Reusa o filtro de mínimo de PDVs por rede do painel principal
    const minPdvsEl = document.getElementById('f-min-pdvs-rede');
    const minPdvs = minPdvsEl ? parseInt(minPdvsEl.value, 10) : 3;
    const groups = computeByBandeira(data, minPdvs);

    if (!groups.length) {
      section.innerHTML = `
        <div class="panel-section-title">Análise por bandeira</div>
        <div style="padding:12px;text-align:center;color:var(--text-muted);font-size:11.5px;">
          Nenhuma bandeira atinge o mínimo de ${minPdvs} PDVs no filtro atual.
        </div>
      `;
      return;
    }

    // Sort por netScore (ranking de força)
    groups.sort((a,b) => b.netScore - a.netScore);

    const persp = window.V360Comp.getState().perspectiveBrand || getBaseBrand();
    const colorMap = buildColorMap();
    const perspColor = colorMap[persp.toUpperCase()] || 'var(--accent)';

    // Renderiza com toggle Top vencedores / Top desafios
    let rowsHtml = '';
    for (const g of groups.slice(0, 30)) {
      const winBar = (g.winRate * 100).toFixed(0);
      const loseBar = (g.loseRate * 100).toFixed(0);
      const opBar = (g.opRate * 100).toFixed(0);
      const netClass = g.netScore > 0.05 ? 'pos' : g.netScore < -0.05 ? 'neg' : 'neu';
      const netSign = g.netScore >= 0 ? '+' : '';
      rowsHtml += `
        <div class="v360-bandeira-row" data-bandeira="${csvEsc(g.name).replace(/"/g,'')}">
          <div class="v360-band-head">
            <div class="v360-band-name">${g.name}</div>
            <div class="v360-band-meta">
              <span class="v360-band-pdvs">${fmtInt(g.total)} PDVs</span>
              <span class="v360-band-net v360-band-net-${netClass}">${netSign}${(g.netScore*100).toFixed(0)}</span>
            </div>
          </div>
          <div class="v360-band-stats">
            <div class="v360-band-stat" title="Lidera com share alto">
              <div class="v360-band-stat-label">Vence</div>
              <div class="v360-band-stat-bar">
                <div class="v360-band-bar v360-band-bar-track"><div class="v360-band-bar-fill v360-band-bar-win" style="width:${winBar}%;"></div></div>
                <span class="v360-band-stat-val v360-band-val-win">${fmtInt(g.wins)}</span>
              </div>
            </div>
            <div class="v360-band-stat" title="Está atrás/vulnerável">
              <div class="v360-band-stat-label">Perde</div>
              <div class="v360-band-stat-bar">
                <div class="v360-band-bar v360-band-bar-track"><div class="v360-band-bar-fill v360-band-bar-lose" style="width:${loseBar}%;"></div></div>
                <span class="v360-band-stat-val v360-band-val-lose">${fmtInt(g.loses)}</span>
              </div>
            </div>
            <div class="v360-band-stat" title="Concorrente vende e perspectiva não">
              <div class="v360-band-stat-label">Oportun.</div>
              <div class="v360-band-stat-bar">
                <div class="v360-band-bar v360-band-bar-track"><div class="v360-band-bar-fill v360-band-bar-op" style="width:${opBar}%;"></div></div>
                <span class="v360-band-stat-val v360-band-val-op">${fmtInt(g.opportunities)}</span>
              </div>
            </div>
          </div>
          ${g.perspAvgShare > 0 || g.leaderAvgShare > 0 ? `
          <div class="v360-band-foot">
            Share méd. — <span style="color:${perspColor};font-weight:600;">${persp}: ${(g.perspAvgShare*100).toFixed(1)}%</span> · líder: ${(g.leaderAvgShare*100).toFixed(1)}%
          </div>` : ''}
        </div>
      `;
    }

    section.innerHTML = `
      <div class="panel-section-title">Análise por bandeira · <span style="color:${perspColor};">${persp}</span></div>
      <div class="v360-band-subtitle">
        Score = % vence − % perde (em PDVs com mín. ${minPdvs}). Clique para filtrar mapa pela bandeira.
      </div>
      <div id="v360-band-list" class="v360-band-list">${rowsHtml}</div>
    `;

    // Click → filtra mapa pela bandeira
    section.querySelectorAll('.v360-bandeira-row').forEach(el => {
      el.onmouseover = () => el.style.background = 'var(--bg-subtle,rgba(0,0,0,0.04))';
      el.onmouseout = () => el.style.background = '';
      el.onclick = () => filterByBandeira(el.dataset.bandeira);
    });
  }

  function filterByBandeira(bandeira) {
    if (typeof window.selectBandeiraFromChart === 'function') {
      window.selectBandeiraFromChart(bandeira);
      return;
    }
    // Fallback: limpa filtro de bandeira atual via API msReset + DOM
    try {
      if (typeof window.msReset === 'function') window.msReset('ms-bandeira');
      const wrap = document.getElementById('ms-bandeira');
      if (wrap) {
        const opt = wrap.querySelector('.ms-opt[data-value="' + CSS.escape(bandeira) + '"]');
        if (opt) opt.click();
      }
      if (typeof window.applyFilters === 'function') window.applyFilters();
    } catch(e) { console.warn('[v360-pr3] filter bandeira fallback:', e); }
  }

  // ─── Color map (compartilhado entre seções) ─────────────────────────────
  function buildColorMap() {
    const map = {};
    const baseBrand = getBaseBrand();
    if (baseBrand) {
      // (Fase 10) Base com paleta HYPR (não #111827).
      const persisted = window._savedMapPayload?.base_brand_color;
      if (persisted) {
        map[baseBrand.toUpperCase()] = persisted;
      } else if (window.V360Comp?.pickBrandColor) {
        map[baseBrand.toUpperCase()] = window.V360Comp.pickBrandColor(baseBrand);
      } else {
        map[baseBrand.toUpperCase()] = 'var(--accent)';
      }
    }
    const st = window.V360Comp?.getState();
    if (st) {
      for (const c of st.competitors) {
        map[c.brand_name.toUpperCase()] = c.brand_color || 'var(--absent)';
      }
    }
    return map;
  }

  // ─── Coordenador: chama todos os renderers ──────────────────────────────
  function refreshAll() {
    ensureTicketsFloorSlider();
    ensureKebabItem();
    renderOpportunitiesSection();
    renderByBandeiraSection();
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────
  function init() {
    if (!window.V360Comp || !window.V360CompRender) {
      setTimeout(init, 100);
      return;
    }

    // Listeners
    window.addEventListener('v360:competitors-loaded', refreshAll);
    window.addEventListener('v360:perspective-changed', refreshAll);
    window.addEventListener('v360:map-closed', () => {
      const ids = ['v360-floor-wrap','v360-opportunities-section','v360-by-bandeira-section','menu-item-comp-csv'];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
      }
    });

    // Hook em updatePanels pra refresh sections quando filtros mudam
    if (typeof window.updatePanels === 'function' && !window._v360Pr3PanelHook) {
      const orig = window.updatePanels;
      window.updatePanels = function() {
        const r = orig.apply(this, arguments);
        if (hasCompetitors() && getMode() !== 'solo') {
          setTimeout(refreshAll, 80);
        }
        return r;
      };
      window._v360Pr3PanelHook = true;
    }

    // Estado inicial
    refreshAll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.V360CompPr3 = {
    refreshAll,
    exportComparativeCSV,
    computeOpportunities,
    computeByBandeira,
  };
})();
