// ────────────────────────────────────────────────────────────────────────────
// V360 Competitors — PR2: Modos automáticos de render + Overview comparativa
// ────────────────────────────────────────────────────────────────────────────
// Detecta modo (Solo / Duelo / Categoria) baseado em quantos competitors estão
// carregados. Modo Solo: comportamento original do app (não interfere).
// Modo Duelo (1 competitor): pinos coloridos por gap base vs competitor.
// Modo Categoria (2+ competitors): pinos coloridos pela marca líder no PDV.
//
// Não modifica HTML do index.html nem CSS. Tudo via DOM dinâmico + injeção
// de painel comparativo no topo da Overview e enriquecimento do popup.
// ────────────────────────────────────────────────────────────────────────────

(function() {
  'use strict';

  // ─── Constantes de classificação ────────────────────────────────────────
  // Estados competitivos (Duelo: base vs único competitor)
  const STATE = {
    DOMINANCE:    'dominance',     // base ≥ 1.5x competitor
    LEADERSHIP:   'leadership',    // base > competitor, gap < 1.5x
    DISPUTE:      'dispute',       // |gap| < 2pp, ambos > 0
    BEHIND:       'behind',        // competitor > base, gap < 1.5x
    VULNERABLE:   'vulnerable',    // competitor ≥ 1.5x base
    OPPORTUNITY:  'opportunity',   // base share=0 (ou tickets < piso) E competitor > 0
    EXCLUSIVE:    'exclusive',     // só base vende (competitor = 0)
    WHITESPACE:   'whitespace',    // ambos = 0 ou tickets insuficientes
  };

  const STATE_COLORS = {
    // Paleta HYPR semântica (Fase 5) + ajuste dark (Fase 8).
    // Hex direto porque MapLibre paint properties não resolvem CSS vars.
    // Mapeia 1:1 com tokens em src/styles/app.css :root.
    dominance:   '#018376', // --win (verde HYPR escuro)
    leadership:  '#4CB050', // --win-hi (verde HYPR brilhante, distingue de dominância)
    dispute:     '#E89A28', // warm orange (Fase 8: substituiu #EDD900 que berrava no dark)
    behind:      '#FF5528', // --lose-hi (laranja-vermelho HYPR, distingue de vulnerável)
    vulnerable:  '#F5272B', // --lose (vermelho HYPR puro)
    opportunity: '#3397B9', // --accent (teal HYPR)
    exclusive:   '#5F25FF', // --purple (índigo HYPR)
    whitespace:  '#78909C', // --absent (cinza HYPR) — escondido por padrão no mapa
  };

  const STATE_LABELS = {
    dominance:   'Dominância',
    leadership:  'Liderança',
    dispute:     'Disputa',
    behind:      'Atrás',
    vulnerable:  'Vulnerável',
    opportunity: 'Oportunidade aberta',
    exclusive:   'Exclusividade',
    whitespace:  'Whitespace',
  };

  const STATE_DESCRIPTIONS = {
    dominance:   'Marca base com 1.5× ou mais o share do principal concorrente',
    leadership:  'Marca base à frente, mas com margem menor que 1.5×',
    dispute:     'Diferença menor que 2pp entre marca base e concorrente',
    behind:      'Concorrente à frente da marca base, gap < 1.5×',
    vulnerable:  'Concorrente com 1.5× ou mais o share da marca base',
    opportunity: 'Marca base ausente ou com amostra insuficiente, concorrente vendendo',
    exclusive:   'Somente marca base vende neste PDV',
    whitespace:  'Categoria não desenvolvida (ambos sem amostra significativa)',
  };

  // ─── Estado interno ─────────────────────────────────────────────────────
  let _hookActive = false;
  let _ticketsFloor = 5; // sobrescrito pelo state de V360Comp

  // PR3: getter dinâmico - permite slider de piso atualizar em tempo real
  function getTicketsFloor() {
    if (window._v360TicketsFloorOverride != null) return window._v360TicketsFloorOverride;
    if (window.V360Comp?.getState) {
      const st = window.V360Comp.getState();
      if (st && st.ticketsFloor != null) return st.ticketsFloor;
    }
    return _ticketsFloor;
  }
  let _classifyCache = new Map(); // cnpj_14 -> { state, leaderBrand, gap }
  let _classifyCacheKey = '';

  function getMode() {
    if (!window.V360Comp) return 'solo';
    const st = window.V360Comp.getState();
    if (!st || !st.competitors || st.competitors.length === 0) return 'solo';
    if (st.competitors.length === 1) return 'duelo';
    return 'categoria';
  }

  function getBaseBrand() {
    return (window._currentMapBaseBrand || '').toUpperCase().trim();
  }

  function getPerspectiveBrand() {
    const st = window.V360Comp?.getState();
    return st?.perspectiveBrand || getBaseBrand();
  }

  // Retorna a "marca da perspectiva" + lista das outras (ordenadas)
  function brandsList() {
    const st = window.V360Comp?.getState();
    if (!st) return { perspective: getBaseBrand(), others: [] };
    const persp = st.perspectiveBrand || getBaseBrand();
    const all = [getBaseBrand(), ...st.competitors.map(c => c.brand_name)];
    return {
      perspective: persp,
      others: all.filter(b => b && b !== persp),
      all,
      colorMap: buildColorMap(),
    };
  }

  function buildColorMap() {
    // Mapa marca -> cor (base + competitors)
    const map = {};
    const baseBrand = getBaseBrand();
    if (baseBrand) map[baseBrand] = '#111827'; // base sempre preta/cinza escuro
    const st = window.V360Comp?.getState();
    if (st) {
      for (const c of st.competitors) {
        map[c.brand_name] = c.brand_color || '#6b7280';
      }
    }
    return map;
  }

  // Pega share da marca X num CNPJ. Marca = base usa row do allData;
  // marca != base usa competitor pdvs.
  function getShareForBrand(row, brandName) {
    if (!row) return null;
    if (brandName === getBaseBrand()) {
      const s = row.share_reais_sku_dimensao;
      const t = row.tickets_amostra;
      return {
        share: s != null ? parseFloat(s) : null,
        tickets: t != null ? parseInt(t) : null,
        diffMedia: parseFloat(row.share_reais_sku_diff_media_dimensao || 0),
      };
    }
    // Competitor
    let cnpj14 = row.cnpj_14;
    if (!cnpj14) {
      // Fallback: extrai do campo cnpj (mapas antigos não têm cnpj_14 em allData)
      const s = String(row.cnpj || '');
      const m = s.match(/\b(\d{14})\b/);
      cnpj14 = m ? m[1] : (s.replace(/\D/g, '').slice(0, 14) || null);
      if (cnpj14 && cnpj14.length === 14) row.cnpj_14 = cnpj14; // hidrata em memória
      else cnpj14 = null;
    }
    if (!cnpj14 || !window.V360Comp) return null;
    const pdv = window.V360Comp.getCompetitorPdv(brandName, cnpj14);
    if (!pdv) return null;
    return {
      share: pdv.share_reais_sku_dimensao != null ? parseFloat(pdv.share_reais_sku_dimensao) : null,
      tickets: pdv.tickets_amostra,
      diffMedia: parseFloat(pdv.share_reais_sku_diff_media_dimensao || 0),
    };
  }

  // Share "válido" = tickets >= floor (sem isso = "sem dado")
  function validShare(brandData, floor) {
    if (!brandData) return null;
    if (brandData.tickets != null && brandData.tickets < floor) return null;
    return brandData.share;
  }

  // ─── Classificação por modo ──────────────────────────────────────────────
  function classifyRow(row, mode, persp, others, floor) {
    const cacheKey = mode + '|' + persp + '|' + floor + '|' + others.join(',');
    if (cacheKey !== _classifyCacheKey) {
      _classifyCache.clear();
      _classifyCacheKey = cacheKey;
    }
    const cnpj14 = row.cnpj_14;
    if (cnpj14 && _classifyCache.has(cnpj14)) return _classifyCache.get(cnpj14);

    let result;
    if (mode === 'duelo') {
      result = classifyDuelo(row, persp, others[0], floor);
    } else if (mode === 'categoria') {
      result = classifyCategoria(row, persp, others, floor);
    } else {
      result = null;
    }
    if (cnpj14) _classifyCache.set(cnpj14, result);
    return result;
  }

  function classifyDuelo(row, baseBrand, otherBrand, floor) {
    const baseData = getShareForBrand(row, baseBrand);
    const otherData = getShareForBrand(row, otherBrand);
    const baseShare = validShare(baseData, floor);
    const otherShare = validShare(otherData, floor);

    if (baseShare == null && otherShare == null) {
      return { state: STATE.WHITESPACE, leaderBrand: null, gap: 0, baseShare: 0, otherShare: 0 };
    }
    if (baseShare == null || baseShare === 0) {
      if (otherShare == null || otherShare === 0) {
        return { state: STATE.WHITESPACE, leaderBrand: null, gap: 0, baseShare: 0, otherShare: 0 };
      }
      return { state: STATE.OPPORTUNITY, leaderBrand: otherBrand, gap: -otherShare, baseShare: 0, otherShare };
    }
    if (otherShare == null || otherShare === 0) {
      return { state: STATE.EXCLUSIVE, leaderBrand: baseBrand, gap: baseShare, baseShare, otherShare: 0 };
    }

    const gap = baseShare - otherShare;
    const gapAbs = Math.abs(gap);

    // Disputa: gap < 2pp
    if (gapAbs < 0.02) {
      return { state: STATE.DISPUTE, leaderBrand: baseShare >= otherShare ? baseBrand : otherBrand, gap, baseShare, otherShare };
    }

    if (baseShare > otherShare) {
      const ratio = otherShare > 0 ? baseShare / otherShare : 999;
      return {
        state: ratio >= 1.5 ? STATE.DOMINANCE : STATE.LEADERSHIP,
        leaderBrand: baseBrand,
        gap,
        baseShare,
        otherShare,
      };
    } else {
      const ratio = baseShare > 0 ? otherShare / baseShare : 999;
      return {
        state: ratio >= 1.5 ? STATE.VULNERABLE : STATE.BEHIND,
        leaderBrand: otherBrand,
        gap,
        baseShare,
        otherShare,
      };
    }
  }

  function classifyCategoria(row, baseBrand, others, floor) {
    // Em categoria, calcula share válido pra todas as marcas e identifica líder
    const baseData = getShareForBrand(row, baseBrand);
    const baseShare = validShare(baseData, floor) || 0;
    const shares = [{ brand: baseBrand, share: baseShare }];
    for (const o of others) {
      const od = getShareForBrand(row, o);
      const s = validShare(od, floor) || 0;
      shares.push({ brand: o, share: s });
    }
    shares.sort((a,b) => b.share - a.share);
    const top = shares[0];
    const second = shares[1];

    if (top.share === 0) {
      return { state: STATE.WHITESPACE, leaderBrand: null, gap: 0, allShares: shares };
    }
    if (second && second.share === 0) {
      // Só uma marca vende
      return {
        state: top.brand === baseBrand ? STATE.EXCLUSIVE : STATE.OPPORTUNITY,
        leaderBrand: top.brand,
        gap: top.share,
        allShares: shares,
      };
    }
    const gap = top.share - second.share;
    const gapAbs = Math.abs(gap);
    // Disputa: top vs 2º < 2pp
    if (gapAbs < 0.02) {
      return { state: STATE.DISPUTE, leaderBrand: top.brand, gap, allShares: shares };
    }
    // Top vs 2º: ratio determina força
    const ratio = second.share > 0 ? top.share / second.share : 999;
    let state;
    if (top.brand === baseBrand) {
      state = ratio >= 1.5 ? STATE.DOMINANCE : STATE.LEADERSHIP;
    } else {
      // Avalia gap entre líder e base (não 2º)
      const baseEntry = shares.find(s => s.brand === baseBrand);
      const baseToLeaderRatio = baseEntry && baseEntry.share > 0 ? top.share / baseEntry.share : 999;
      state = baseToLeaderRatio >= 1.5 ? STATE.VULNERABLE : STATE.BEHIND;
    }
    return { state, leaderBrand: top.brand, gap, allShares: shares };
  }

  // ─── Hook: pinColor (PR2 sobrescreve Solo só quando há competitors) ─────
  function pinColor(row, defaultColors) {
    if (!_hookActive) return null;
    const mode = getMode();
    if (mode === 'solo') return null; // deixa pinColor original rodar

    const persp = getPerspectiveBrand();
    const brands = brandsList();
    const others = brands.others;
    const cls = classifyRow(row, mode, persp, others, getTicketsFloor());
    if (!cls) return null;

    if (mode === 'duelo') {
      return STATE_COLORS[cls.state] || defaultColors.neutral;
    }
    // Categoria: cor da marca líder
    if (mode === 'categoria') {
      if (cls.state === STATE.WHITESPACE) return STATE_COLORS.whitespace;
      const colorMap = brands.colorMap;
      return colorMap[cls.leaderBrand] || defaultColors.neutral;
    }
    return null;
  }

  // ─── Hook: popup extension (Fase 4 — bloco completo com state badge,
  //     share por marca, gap em pp e share-of-shelf da lente) ────────────
  function buildPopupExtension(row) {
    if (!_hookActive) return '';
    const mode = getMode();
    if (mode === 'solo') return '';

    const brands = brandsList();
    const colorMap = brands.colorMap;
    const baseBrand = getBaseBrand();
    const persp = brands.perspective;
    const others = (brands.others || []).filter(b => b && b !== persp);
    const allBrands = [persp].concat(others); // ordem visual: lente primeiro

    // Coleta share de cada marca (ordem: lente, depois concorrentes)
    const floor = getTicketsFloor();
    const rows = [];
    for (const b of allBrands) {
      const bd = getShareForBrand(row, b);
      rows.push({
        brand: b,
        share: bd?.share != null ? bd.share : null,
        tickets: bd?.tickets || 0,
        isBase: b === baseBrand,
        isLens: b === persp,
        lowConf: bd?.tickets != null && bd.tickets > 0 && bd.tickets < floor,
        color: colorMap[b] || '#94a3b8',
      });
    }

    const maxShare = Math.max.apply(null, rows.map(r => r.share || 0).concat(0.01));

    // Gap da lente vs média dos concorrentes (em pp). Se não há concorrentes,
    // gap é vs zero — usamos só share absoluto da lente.
    const lensShare = (rows.find(r => r.isLens)?.share) || 0;
    const concShares = rows.filter(r => !r.isLens).map(r => r.share || 0);
    const avgConc = concShares.length ? concShares.reduce((s, v) => s + v, 0) / concShares.length : 0;
    const gap = lensShare - avgConc;
    const gapPP = gap * 100;

    // Share-of-shelf da lente dentro do mix selecionado:
    //   shareOfShelf = lensShare / sum(allShares)
    const sumShares = rows.reduce((s, r) => s + (r.share || 0), 0);
    const sos = sumShares > 0 ? (lensShare / sumShares) * 100 : 0;

    // Classificação atual (estado competitivo)
    const cls = classifyRow(row, mode, persp, brands.others, floor);
    const stateKey = cls ? cls.state : null;
    const stateLabel = stateKey ? STATE_LABELS[stateKey] : '';
    // Mapear state key → class name no CSS (sem acentos, lowercase)
    const stateCssClass = stateKey || '';

    // Meta da state row
    const concCount = concShares.length;
    let metaText = '';
    if (concCount > 0) {
      const refBrand = concCount === 1 ? others[0] : 'média';
      const sign = gapPP > 0 ? '+' : '';
      metaText = `${sign}${gapPP.toFixed(1)}pp vs. ${refBrand}`;
    }

    // Brand rows do bloco
    const brandRowsHtml = rows.map(r => {
      const sharePct = r.share != null ? r.share * 100 : null;
      const wPct = sharePct != null ? Math.min(sharePct / (maxShare * 100) * 100, 100) : 0;
      const valLabel = sharePct == null ? '—' : sharePct.toFixed(1) + '%';
      const nameClass = r.isLens ? 'name lens' : 'name';
      const lowConfBadge = r.lowConf
        ? `<span class="lowconf" title="Amostra baixa (${r.tickets} tickets)">⚠</span>`
        : '';
      return `
        <div class="popup-brand-row" style="color:${r.color}">
          <span class="pdot"></span>
          <span class="${nameClass}">${_esc(r.brand)}${r.isBase ? '<span class="base-tag">base</span>' : ''}</span>
          <div class="bar-wrap"><div class="bar-fill" style="width:${wPct}%"></div></div>
          <span class="val">${valLabel}${lowConfBadge}</span>
        </div>
      `;
    }).join('');

    // Metric cards (gap + share-of-shelf)
    // Whitespace: lensShare=0 E sumShares=0. Mostra "—" em vez de "0.0pp" e "0%"
    // que dão impressão errada (valor real é "não há amostra").
    const isWhitespaceRow = lensShare === 0 && sumShares === 0;
    const gapClass = gapPP > 0.05 ? 'pos' : gapPP < -0.05 ? 'neg' : '';
    const gapVal = isWhitespaceRow
      ? '—'
      : (concCount > 0
          ? `${gapPP > 0 ? '+' : ''}${gapPP.toFixed(1)}pp`
          : `${(lensShare * 100).toFixed(1)}%`);
    const gapLabel = concCount > 0 ? 'Gap vs. concorrentes' : 'Share absoluto';
    const sosVal = isWhitespaceRow ? '—' : `${sos.toFixed(0)}%`;
    const sosLabel = concCount > 0
      ? `${_esc(persp)} no mix de ${rows.length} marcas`
      : `${_esc(persp)} no mix`;

    // Tickets na amostra — pega da lente (Fase 4: métrica permanente, destacada)
    const lensRow = rows.find(r => r.isLens);
    const lensTickets = lensRow?.tickets || 0;
    const ticketsLowConf = lensRow?.lowConf;
    const ticketsHtml = `
      <div class="popup-ext-tickets ${ticketsLowConf ? 'lowconf' : ''}">
        <span class="v">${lensTickets.toLocaleString('pt-BR')}</span>
        <span class="l">Tickets na amostra${ticketsLowConf ? ` <span class="warn" title="Abaixo do piso de ${floor} tickets">⚠ baixa</span>` : ''}</span>
      </div>
    `;

    return `
      <div class="v360-popup-ext">
        <div class="popup-state-row">
          ${stateLabel ? `<span class="state-badge ${stateCssClass}">${_esc(stateLabel)}</span>` : ''}
          ${metaText ? `<span class="meta">${metaText}</span>` : ''}
        </div>
        <div class="popup-brands">
          <div class="popup-brands-head">
            <span>Share por marca (R$)</span>
            <span class="hint">${rows.length} marca${rows.length !== 1 ? 's' : ''}</span>
          </div>
          ${brandRowsHtml}
        </div>
        <div class="popup-ext-metrics">
          <div class="popup-ext-metric">
            <div class="v ${gapClass}">${gapVal}</div>
            <div class="l">${gapLabel}</div>
          </div>
          <div class="popup-ext-metric">
            <div class="v">${sosVal}</div>
            <div class="l">${sosLabel}</div>
          </div>
        </div>
        ${ticketsHtml}
      </div>
    `;
  }

  // Escape HTML básico
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ─── Painel comparativo: substitui mini-stats da Overview quando há comp ─
  // Estratégia: insere um container ANTES de .overview-mini-stats e esconde
  // o original. Restaura ao remover competitors.
  const COMP_PANEL_ID = 'v360-comp-overview-panel';

  function renderCompOverview() {
    const tcOverview = document.getElementById('tc-overview');
    if (!tcOverview) return;
    const originalMiniStats = tcOverview.querySelector('.overview-mini-stats');
    if (!originalMiniStats) return;

    const mode = getMode();
    let panel = document.getElementById(COMP_PANEL_ID);

    if (mode === 'solo') {
      // Restaura UI original
      if (panel) panel.style.display = 'none';
      originalMiniStats.style.display = '';
      return;
    }

    // Esconde mini-stats originais
    originalMiniStats.style.display = 'none';

    if (!panel) {
      panel = document.createElement('div');
      panel.id = COMP_PANEL_ID;
      panel.style.cssText = 'margin-bottom:16px;';
      originalMiniStats.parentNode.insertBefore(panel, originalMiniStats);
    }
    panel.style.display = '';

    const data = window.filteredData || window.allData || [];
    // Mini-stats e cards usam dados SEM state filter (pra contagens sempre totais)
    // O state filter atua só no mapa
    const persp = getPerspectiveBrand();
    const brands = brandsList();

    if (mode === 'duelo') {
      renderDueloOverview(panel, data, persp, brands.others[0]);
    } else {
      renderCategoriaOverview(panel, data, persp, brands.others, brands.colorMap);
    }
  }

  function renderDueloOverview(panel, data, baseBrand, otherBrand) {
    // Defesa: se baseBrand vier vazio (ex: mapa antigo sem base_brand setado)
    baseBrand = baseBrand || 'Marca base';
    otherBrand = otherBrand || 'Concorrente';
    // Conta por estado
    const counts = {};
    for (const k of Object.values(STATE)) counts[k] = 0;
    let totalBaseShare = 0, totalOtherShare = 0, pdvsCount = 0;
    let baseWins = 0, otherWins = 0, ties = 0, baseTickets = 0;

    for (const row of data) {
      const cls = classifyRow(row, 'duelo', baseBrand, [otherBrand], getTicketsFloor());
      if (!cls) continue;
      counts[cls.state]++;
      if (cls.baseShare > 0 || cls.otherShare > 0) {
        totalBaseShare += cls.baseShare || 0;
        totalOtherShare += cls.otherShare || 0;
        pdvsCount++;
        if (cls.baseShare > cls.otherShare + 0.005) baseWins++;
        else if (cls.otherShare > cls.baseShare + 0.005) otherWins++;
        else ties++;
      }
    }

    const baseAvg = pdvsCount ? totalBaseShare / pdvsCount * 100 : 0;
    const otherAvg = pdvsCount ? totalOtherShare / pdvsCount * 100 : 0;
    const baseColor = brandsList().colorMap[baseBrand] || '#111';
    const otherColor = brandsList().colorMap[otherBrand] || '#dc2626';

    const headlineNum = baseWins + counts[STATE.DOMINANCE] + counts[STATE.LEADERSHIP] + counts[STATE.EXCLUSIVE];
    const opportunityNum = counts[STATE.OPPORTUNITY];
    const vulnerableNum = counts[STATE.VULNERABLE];

    panel.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px;">
        <div style="padding:10px 12px;border-radius:10px;background:linear-gradient(135deg,${baseColor}15,${baseColor}05);border:1px solid ${baseColor}30;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="width:8px;height:8px;border-radius:50%;background:${baseColor};"></span>
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;color:var(--text-muted);">${baseBrand}</span>
          </div>
          <div style="font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;color:${baseColor};">${baseAvg.toFixed(1)}%</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Share médio onde compete</div>
        </div>
        <div style="padding:10px 12px;border-radius:10px;background:linear-gradient(135deg,${otherColor}15,${otherColor}05);border:1px solid ${otherColor}30;">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
            <span style="width:8px;height:8px;border-radius:50%;background:${otherColor};"></span>
            <span style="font-size:10px;text-transform:uppercase;letter-spacing:0.05em;font-weight:600;color:var(--text-muted);">${otherBrand}</span>
          </div>
          <div style="font-size:22px;font-weight:700;font-variant-numeric:tabular-nums;color:${otherColor};">${otherAvg.toFixed(1)}%</div>
          <div style="font-size:10px;color:var(--text-muted);margin-top:2px;">Share médio onde compete</div>
        </div>
      </div>

      <div class="overview-mini-stats" style="grid-template-columns:repeat(4,1fr);">
        ${miniStat('Vence', counts[STATE.DOMINANCE] + counts[STATE.LEADERSHIP] + counts[STATE.EXCLUSIVE], '#16a34a', 'state-win')}
        ${miniStat('Disputa', counts[STATE.DISPUTE], '#eab308', 'state-dispute')}
        ${miniStat('Perde', counts[STATE.BEHIND] + counts[STATE.VULNERABLE], '#dc2626', 'state-lose')}
        ${miniStat('Oportunidade', counts[STATE.OPPORTUNITY], '#3b82f6', 'state-opportunity')}
      </div>

      ${renderStateLegend('duelo')}
    `;
    wireStateFilters(panel);
  }

  function renderCategoriaOverview(panel, data, baseBrand, others, colorMap) {
    const brandWins = {};
    const brandShares = {};
    const brandCounts = {};
    const allBrands = [baseBrand, ...others];
    for (const b of allBrands) { brandWins[b] = 0; brandShares[b] = 0; brandCounts[b] = 0; }
    let whitespaceCount = 0;

    for (const row of data) {
      const cls = classifyRow(row, 'categoria', baseBrand, others, getTicketsFloor());
      if (!cls) continue;
      if (cls.state === STATE.WHITESPACE) { whitespaceCount++; continue; }
      if (cls.leaderBrand) brandWins[cls.leaderBrand] = (brandWins[cls.leaderBrand] || 0) + 1;
      if (cls.allShares) {
        for (const s of cls.allShares) {
          if (s.share > 0) {
            brandShares[s.brand] = (brandShares[s.brand] || 0) + s.share;
            brandCounts[s.brand] = (brandCounts[s.brand] || 0) + 1;
          }
        }
      }
    }

    // Cards por marca (ordenados pela perspectiva primeiro)
    const persp = getPerspectiveBrand();
    const sortedBrands = [persp, ...allBrands.filter(b => b !== persp)];
    let cardsHtml = '';
    for (const b of sortedBrands) {
      const c = colorMap[b] || '#6b7280';
      const wins = brandWins[b] || 0;
      const avg = brandCounts[b] ? brandShares[b] / brandCounts[b] * 100 : 0;
      const isPersp = b === persp;
      cardsHtml += `
        <div style="padding:8px 10px;border-radius:8px;background:${c}12;border:1px solid ${c}30;${isPersp ? `outline:2px solid ${c}60;outline-offset:-2px;` : ''}">
          <div style="display:flex;align-items:center;gap:5px;margin-bottom:2px;">
            <span style="width:7px;height:7px;border-radius:50%;background:${c};"></span>
            <span style="font-size:10px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.04em;">${b}${b === baseBrand ? ' · base' : ''}</span>
          </div>
          <div style="font-size:18px;font-weight:700;font-variant-numeric:tabular-nums;color:${c};">${wins.toLocaleString('pt-BR')}</div>
          <div style="font-size:9px;color:var(--text-muted);margin-top:1px;">PDVs liderados · ${avg.toFixed(1)}% share méd.</div>
        </div>
      `;
    }
    panel.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(${Math.min(sortedBrands.length, 4)},1fr);gap:6px;margin-bottom:12px;">
        ${cardsHtml}
      </div>

      <div style="padding:8px 10px;border-radius:8px;background:rgba(148,163,184,0.1);border:1px solid rgba(148,163,184,0.25);margin-bottom:12px;display:flex;align-items:center;gap:8px;">
        <span style="width:7px;height:7px;border-radius:50%;background:#94a3b8;"></span>
        <span style="font-size:11px;color:var(--text-muted);flex:1;">Whitespace (nenhuma marca com amostra)</span>
        <span style="font-size:14px;font-weight:600;color:var(--text);">${whitespaceCount.toLocaleString('pt-BR')}</span>
      </div>

      <div id="v360-headtohead" style="margin-bottom:12px;"></div>
      ${renderStateLegend('categoria')}
    `;
    renderHeadToHeadMatrix(panel.querySelector('#v360-headtohead'), data, allBrands, colorMap);
    wireStateFilters(panel);
  }

  function renderHeadToHeadMatrix(container, data, brands, colorMap) {
    if (!container) return;
    const n = brands.length;
    // matrix[i][j] = quantos PDVs marca i lidera sobre marca j (gap > 0)
    const matrix = Array.from({length: n}, () => new Array(n).fill(0));
    for (const row of data) {
      const sharesByBrand = {};
      for (const b of brands) {
        const bd = getShareForBrand(row, b);
        const s = validShare(bd, getTicketsFloor());
        sharesByBrand[b] = s || 0;
      }
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (i === j) continue;
          if (sharesByBrand[brands[i]] > sharesByBrand[brands[j]] + 0.001 && sharesByBrand[brands[i]] > 0) {
            matrix[i][j]++;
          }
        }
      }
    }

    let html = `<div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);font-weight:600;margin-bottom:8px;">Matriz cabeça a cabeça</div>`;
    html += `<div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border,#e5e7eb);">`;
    html += `<table style="width:100%;border-collapse:collapse;font-size:11px;">`;
    html += `<thead><tr><th style="text-align:left;padding:6px 8px;font-weight:500;color:var(--text-muted);font-size:10px;background:var(--bg-subtle,#f9fafb);">Vence ↓ / Perde →</th>`;
    for (const b of brands) {
      html += `<th style="text-align:center;padding:6px 8px;font-weight:600;color:${colorMap[b] || '#111'};background:var(--bg-subtle,#f9fafb);font-size:10px;">${b}</th>`;
    }
    html += `</tr></thead><tbody>`;
    for (let i = 0; i < n; i++) {
      html += `<tr><td style="padding:6px 8px;font-weight:600;color:${colorMap[brands[i]] || '#111'};background:var(--bg-subtle,#f9fafb);font-size:10px;">${brands[i]}</td>`;
      for (let j = 0; j < n; j++) {
        if (i === j) {
          html += `<td style="padding:6px 8px;text-align:center;color:var(--text-muted);">—</td>`;
        } else {
          const v = matrix[i][j];
          const total = matrix[i][j] + matrix[j][i];
          const pct = total > 0 ? (v / total * 100).toFixed(0) : '0';
          const bg = v > matrix[j][i] ? '#16a34a15' : v < matrix[j][i] ? '#dc262615' : '#eab30815';
          const color = v > matrix[j][i] ? '#15803d' : v < matrix[j][i] ? '#991b1b' : '#854d0e';
          html += `<td style="padding:6px 8px;text-align:center;background:${bg};color:${color};font-variant-numeric:tabular-nums;"><div style="font-weight:600;">${v.toLocaleString('pt-BR')}</div><div style="font-size:9px;opacity:0.7;">${pct}%</div></td>`;
        }
      }
      html += `</tr>`;
    }
    html += `</tbody></table></div>`;
    html += `<div style="font-size:10px;color:var(--text-muted);margin-top:6px;">Cada célula: nº de PDVs onde a marca da linha vence a marca da coluna (% do total entre ambas).</div>`;
    container.innerHTML = html;
  }

  function miniStat(label, value, color, key) {
    return `
      <div class="overview-mini-stat clickable" data-state-filter="${key}" title="Filtrar PDVs nesse estado">
        <div class="overview-mini-stat-val" style="color:${color};">${value.toLocaleString('pt-BR')}</div>
        <div class="overview-mini-stat-label">${label}</div>
      </div>
    `;
  }

  function renderStateLegend(mode) {
    const states = mode === 'duelo'
      ? [STATE.DOMINANCE, STATE.LEADERSHIP, STATE.DISPUTE, STATE.BEHIND, STATE.VULNERABLE, STATE.OPPORTUNITY, STATE.EXCLUSIVE, STATE.WHITESPACE]
      : [STATE.DOMINANCE, STATE.LEADERSHIP, STATE.DISPUTE, STATE.OPPORTUNITY, STATE.EXCLUSIVE, STATE.WHITESPACE];
    let html = `<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border,#e5e7eb);"><div style="font-size:10px;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-muted);font-weight:600;margin-bottom:6px;">Legenda de estados</div><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 12px;">`;
    for (const s of states) {
      html += `<div style="display:flex;align-items:center;gap:6px;font-size:10.5px;" title="${STATE_DESCRIPTIONS[s]}">
        <span style="width:8px;height:8px;border-radius:50%;background:${STATE_COLORS[s]};flex-shrink:0;"></span>
        <span style="color:var(--text);">${STATE_LABELS[s]}</span>
      </div>`;
    }
    html += `</div></div>`;
    return html;
  }

  // ─── State filter (clique nos mini-stats do PR2) ────────────────────────
  let _activeStateFilter = null;

  function wireStateFilters(panel) {
    panel.querySelectorAll('[data-state-filter]').forEach(el => {
      el.style.cursor = 'pointer';
      if (el.dataset.stateFilter === _activeStateFilter) {
        el.style.outline = '2px solid var(--accent,#2563eb)';
        el.style.outlineOffset = '-1px';
        el.style.borderRadius = '8px';
      }
      el.onclick = () => {
        if (_activeStateFilter === el.dataset.stateFilter) {
          _activeStateFilter = null;
        } else {
          _activeStateFilter = el.dataset.stateFilter;
        }
        rerenderMap();
        renderCompOverview();
      };
    });
  }

  function passStateFilter(row) {
    if (!_activeStateFilter) return true;
    const mode = getMode();
    if (mode === 'solo') return true;
    const brands = brandsList();
    const cls = classifyRow(row, mode, brands.perspective, brands.others, getTicketsFloor());
    if (!cls) return true;
    switch (_activeStateFilter) {
      case 'state-win': return cls.state === STATE.DOMINANCE || cls.state === STATE.LEADERSHIP || cls.state === STATE.EXCLUSIVE;
      case 'state-dispute': return cls.state === STATE.DISPUTE;
      case 'state-lose': return cls.state === STATE.BEHIND || cls.state === STATE.VULNERABLE;
      case 'state-opportunity': return cls.state === STATE.OPPORTUNITY;
      default: return true;
    }
  }

  // ─── Filter pipeline integration ────────────────────────────────────────
  // Hook into filtered data: when state filter is active, slice further.
  function getFilteredWithState() {
    const data = window.filteredData || [];
    if (!_activeStateFilter) return data;
    return data.filter(passStateFilter);
  }

  // ─── Re-render map markers usando classificação PR2 ─────────────────────
  function rerenderMap() {
    // Limpa cache pra forçar reclassificação
    _classifyCache.clear();
    _classifyCacheKey = '';
    try {
      if (typeof window.renderMarkers === 'function') window.renderMarkers();
    } catch(_) {}
  }

  // Hook em renderMarkers: substitui filteredData temporariamente se houver state filter
  function installRenderHook() {
    if (window._v360CompRenderHookInstalled) return;
    const origRender = window.renderMarkers;
    if (typeof origRender !== 'function') return;
    window.renderMarkers = function() {
      if (_activeStateFilter && _hookActive && getMode() !== 'solo') {
        const orig = window.filteredData;
        window.filteredData = orig.filter(passStateFilter);
        try { origRender.apply(this, arguments); } finally { window.filteredData = orig; }
      } else {
        return origRender.apply(this, arguments);
      }
    };
    window._v360CompRenderHookInstalled = true;
  }

  // ─── Activation lifecycle ───────────────────────────────────────────────
  function activate() {
    _hookActive = true;
    if (window.V360Comp) {
      const st = window.V360Comp.getState();
      _ticketsFloor = st?.ticketsFloor || 5;
    }
    installRenderHook();
    renderCompOverview();
    swapSidePanelLegend(true);
    rerenderMap();
  }

  function deactivate() {
    _hookActive = false;
    _activeStateFilter = null;
    renderCompOverview(); // restaura mini-stats originais
    swapSidePanelLegend(false);
    rerenderMap();
  }

  // Substitui a legenda original (Acima/Abaixo/Na média/Sem presença) por uma
  // dinâmica de estados competitivos em modo Duelo/Categoria.
  function swapSidePanelLegend(active) {
    const orig = document.querySelector('.filter-group .color-legend');
    if (!orig) return;
    const origGroup = orig.closest('.filter-group');
    if (!origGroup) return;

    let compLegend = document.getElementById('v360-comp-side-legend');

    if (!active) {
      // Restaura original
      orig.style.display = '';
      if (compLegend) compLegend.style.display = 'none';
      return;
    }

    // Esconde original
    orig.style.display = 'none';

    // Cria/atualiza legenda comparativa
    if (!compLegend) {
      compLegend = document.createElement('div');
      compLegend.id = 'v360-comp-side-legend';
      compLegend.className = 'color-legend';
      orig.parentNode.appendChild(compLegend);
    }
    compLegend.style.display = '';

    const mode = getMode();
    const states = mode === 'duelo'
      ? [STATE.DOMINANCE, STATE.LEADERSHIP, STATE.DISPUTE, STATE.BEHIND, STATE.VULNERABLE, STATE.OPPORTUNITY, STATE.EXCLUSIVE, STATE.WHITESPACE]
      : [STATE.DOMINANCE, STATE.LEADERSHIP, STATE.DISPUTE, STATE.OPPORTUNITY, STATE.EXCLUSIVE, STATE.WHITESPACE];
    compLegend.innerHTML = states.map(s => `
      <div class="legend-item" title="${STATE_DESCRIPTIONS[s]}">
        <div class="legend-dot" style="background:${STATE_COLORS[s]}"></div>${STATE_LABELS[s]}
      </div>
    `).join('');
  }

  // ─── Event wiring ───────────────────────────────────────────────────────
  function onCompetitorsLoaded() {
    const st = window.V360Comp?.getState();
    if (st && st.competitors.length > 0) {
      activate();
    } else {
      deactivate();
    }
  }

  function onPerspectiveChanged() {
    _classifyCache.clear();
    _classifyCacheKey = '';
    rerenderMap();
    renderCompOverview();
  }

  function onFiltersChanged() {
    renderCompOverview();
  }

  // Hook em updatePanels pra atualizar overview comparativa quando filtros mudam
  function installPanelHook() {
    if (window._v360CompPanelHookInstalled) return;
    const orig = window.updatePanels;
    if (typeof orig !== 'function') return;
    window.updatePanels = function() {
      const result = orig.apply(this, arguments);
      if (_hookActive && getMode() !== 'solo') {
        // Re-render overview comparativa após update
        setTimeout(renderCompOverview, 60);
      }
      return result;
    };
    window._v360CompPanelHookInstalled = true;
  }

  // ─── Inicialização (espera V360Comp estar disponível) ──────────────────
  function init() {
    if (!window.V360Comp) {
      // V360Comp ainda não carregou, tenta de novo
      setTimeout(init, 100);
      return;
    }
    installRenderHook();
    installPanelHook();
    window.addEventListener('v360:competitors-loaded', onCompetitorsLoaded);
    window.addEventListener('v360:perspective-changed', onPerspectiveChanged);
    // Re-render quando adicionar/remover concorrente também
    const origRenderHeaderUI = window.V360Comp.renderHeaderUI;
    if (origRenderHeaderUI) {
      window.V360Comp.renderHeaderUI = function() {
        const r = origRenderHeaderUI.apply(this, arguments);
        onCompetitorsLoaded();
        return r;
      };
    }
    // Reset on map close
    window.addEventListener('v360:map-closed', deactivate);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ─── API pública ────────────────────────────────────────────────────────
  window.V360CompRender = {
    pinColor,
    buildPopupExtension,
    getMode,
    classifyRow: (row) => {
      const brands = brandsList();
      return classifyRow(row, getMode(), brands.perspective, brands.others, getTicketsFloor());
    },
    // Lista de marcas + colorMap (consumido pelos donut clusters em modo Categoria)
    brandsList,
    // Lê share/tickets/diffMedia de uma marca específica num row de allData (Fase 3 - hero)
    getShareForBrand,
    // Floor de tickets atual (Fase 3 - hero usa pra filtrar shares válidos)
    getTicketsFloor,
    STATE,
    STATE_COLORS,
    STATE_LABELS,
  };

})();
