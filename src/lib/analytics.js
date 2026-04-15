// ─── Analytics ──────────────────────────────────────────────────────────────
// Overview, Ranking, Analysis tabs + chart rendering.
// Recebe filteredData como parâmetro pra não depender de global.

import { avg, groupBy, cssVar } from './utils.js';

let charts = {};
let _lastFilteredHash = '';
let _panelRafId = null;

// ── Public API ──────────────────────────────────────────────────────────────

export function updateOverlay(filteredData) {
  const data = filteredData || window.filteredData || [];
  const el = document.getElementById('overlay-count');
  if (el) el.textContent = data.length.toLocaleString('pt-BR');
  const shareAvg = avg(data, 'share_reais_sku_dimensao') * 100;
  const shareEl = document.getElementById('overlay-share');
  if (shareEl) shareEl.textContent = shareAvg.toFixed(1) + '%';
}

export function updatePanels(filteredData) {
  const data = filteredData || window.filteredData || [];
  const hash = data.length + '_' + (data[0]?.cnpj || '') + '_' + (data[data.length - 1]?.cnpj || '');
  if (hash === _lastFilteredHash) return;
  _lastFilteredHash = hash;

  if (_panelRafId) cancelAnimationFrame(_panelRafId);
  _panelRafId = requestAnimationFrame(() => {
    updateHeader(data);
    updateOverview(data);
    setTimeout(() => { updateRanking(data); updateAnalysis(data); }, 50);
    _panelRafId = null;
  });
}

export function resetAnalyticsCache() {
  _lastFilteredHash = '';
}

// ── Header stats ────────────────────────────────────────────────────────────

function updateHeader(filteredData) {
  const winCount = filteredData.filter(r => parseFloat(r.percentual_diff_media_dimensao || 0) > 2).length;
  const shareAvg = avg(filteredData, 'share_reais_sku_dimensao') * 100;
  const bandeiras = new Set(filteredData.map(r => r.bandeira || 'Outros')).size;

  const el = id => document.getElementById(id);
  if (el('h-pdvs')) el('h-pdvs').textContent = filteredData.length.toLocaleString('pt-BR');
  if (el('h-share')) el('h-share').textContent = shareAvg.toFixed(1) + '%';
  if (el('h-win')) el('h-win').textContent = winCount.toLocaleString('pt-BR');
  if (el('h-bandeiras')) el('h-bandeiras').textContent = bandeiras;
}

// ── Overview Tab ─────────────────────────────────────────────────────────────

function updateOverview(filteredData) {
  const shareAvg = avg(filteredData, 'share_reais_sku_dimensao') * 100;
  const diffAvg = avg(filteredData, 'percentual_diff_media_dimensao');

  const valEl = document.getElementById('ov-share-val');
  if (valEl) valEl.textContent = shareAvg.toFixed(1);
  const deltaEl = document.getElementById('ov-share-delta');
  if (deltaEl) {
    deltaEl.textContent = (diffAvg > 0 ? '+' : '') + diffAvg.toFixed(1) + '% vs. média';
    deltaEl.className = 'share-delta ' + (diffAvg >= 0 ? 'pos' : 'neg');
  }

  const shareR = avg(filteredData, 'share_reais_sku_dimensao') * 100;
  const shareV = avg(filteredData, 'share_volume_sku_dimensao') * 100;
  const shareU = avg(filteredData, 'share_unidades_sku_dimensao') * 100;
  renderBarChart('chart-shares', ['Reais', 'Volume', 'Unidades'],
    [shareR, shareV, shareU],
    [cssVar('--accent'), cssVar('--accent-light'), cssVar('--blue-light')]
  );

  const grp = groupBy(filteredData, 'bandeira');
  const bandSort = Object.entries(grp).sort((a, b) => b[1].length - a[1].length).slice(0, 8);
  renderHorizBarChart('chart-bandeiras', bandSort.map(e => e[0]), bandSort.map(e => e[1].length));

  const bins = [0, 2, 5, 10, 15, 20, 30, 50, 100];
  const labels = bins.slice(0, -1).map((v, i) => `${v}–${bins[i + 1]}%`);
  const counts = bins.slice(0, -1).map((v, i) => filteredData.filter(r => {
    const s = parseFloat(r.share_reais_sku_dimensao || 0) * 100;
    return s >= v && s < bins[i + 1];
  }).length);
  renderHistChart('chart-dist', labels, counts);
}

// ── Ranking Tab ──────────────────────────────────────────────────────────────

function updateRanking(filteredData) {
  const grp = groupBy(filteredData, 'bandeira');
  const ranked = Object.entries(grp).map(([b, rows]) => ({
    name: b, count: rows.length,
    shareAvg: avg(rows, 'share_reais_sku_dimensao') * 100,
    diffAvg: avg(rows, 'percentual_diff_media_dimensao'),
    oportAvg: avg(rows, 'oportunidade_dimensao'),
  })).sort((a, b) => b.shareAvg - a.shareAvg);

  const maxShare = Math.max(...ranked.map(r => r.shareAvg), 1);
  const top = ranked.slice(0, 7);
  const bottom = [...ranked].sort((a, b) => a.shareAvg - b.shareAvg).slice(0, 7);
  const topOport = [...ranked].sort((a, b) => b.oportAvg - a.oportAvg).slice(0, 7);

  function renderRankList(id, items, valueKey, badgeFn) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = items.map((item, i) => {
      const val = item[valueKey];
      const badge = badgeFn ? badgeFn(item) : '';
      const barColor = item.diffAvg > 2 ? cssVar('--win') : item.diffAvg < -2 ? cssVar('--lose') : cssVar('--neutral');
      return `<div class="rank-item">
        <span class="rank-num">${i + 1}</span>
        <span class="rank-name" title="${item.name}">${item.name}</span>
        <div class="rank-bar-wrap"><div class="rank-bar" style="width:${Math.min(val / maxShare * 100, 100)}%;background:${barColor}"></div></div>
        <span class="rank-val" style="color:${barColor}">${val.toFixed(1)}%</span>
        ${badge}
      </div>`;
    }).join('');
  }

  const badgeFn = item => {
    const cls = item.diffAvg > 2 ? 'win' : item.diffAvg < -2 ? 'lose' : 'neutral';
    const label = item.diffAvg > 2 ? '▲ ganha' : item.diffAvg < -2 ? '▼ perde' : '→ neutro';
    return `<span class="rank-badge ${cls}">${label}</span>`;
  };

  renderRankList('rank-top', top, 'shareAvg', badgeFn);
  renderRankList('rank-bottom', bottom, 'shareAvg', badgeFn);

  const maxOport = Math.max(...topOport.map(r => r.oportAvg), 1);
  const el = document.getElementById('rank-oport');
  if (el) {
    el.innerHTML = topOport.map((item, i) => `
      <div class="rank-item">
        <span class="rank-num">${i + 1}</span>
        <span class="rank-name" title="${item.name}">${item.name}</span>
        <div class="rank-bar-wrap"><div class="rank-bar" style="width:${Math.min(item.oportAvg / maxOport * 100, 100)}%;background:var(--accent)"></div></div>
        <span class="rank-val" style="color:var(--accent-light)">${item.oportAvg.toFixed(2)}</span>
        <span class="rank-badge neutral">${item.count} PDVs</span>
      </div>
    `).join('');
  }
}

// ── Analysis Tab ─────────────────────────────────────────────────────────────

function updateAnalysis(filteredData) {
  const grp = groupBy(filteredData, 'bandeira');
  const ranked = Object.entries(grp).map(([b, rows]) => ({
    name: b, count: rows.length,
    shareAvg: avg(rows, 'share_reais_sku_dimensao') * 100,
    diffAvg: avg(rows, 'percentual_diff_media_dimensao'),
    oportTotal: rows.reduce((s, r) => s + parseFloat(r.oportunidade_dimensao || 0), 0),
  }));

  const winBandeiras = ranked.filter(r => r.diffAvg > 3).sort((a, b) => b.diffAvg - a.diffAvg).slice(0, 3);
  const loseBandeiras = ranked.filter(r => r.diffAvg < -3).sort((a, b) => a.diffAvg - b.diffAvg).slice(0, 3);
  const bestOport = [...ranked].sort((a, b) => b.oportTotal - a.oportTotal).slice(0, 3);

  const totalPDVs = filteredData.length;
  const winCount = filteredData.filter(r => parseFloat(r.percentual_diff_media_dimensao || 0) > 2).length;
  const loseCount = filteredData.filter(r => parseFloat(r.percentual_diff_media_dimensao || 0) < -2).length;
  const winPct = totalPDVs ? (winCount / totalPDVs * 100).toFixed(0) : 0;
  const losePct = totalPDVs ? (loseCount / totalPDVs * 100).toFixed(0) : 0;

  const cards = [
    { icon: '📈', title: 'Onde a marca ganha share',
      body: winBandeiras.length
        ? `A marca está <span class="analysis-highlight win">acima da média</span> em ${winCount} PDVs (${winPct}% do total). ${winBandeiras.length ? `Melhor performance em: <span class="analysis-highlight">${winBandeiras.map(b => b.name).join(', ')}</span>.` : ''}`
        : `Nenhuma bandeira com performance significativamente acima da média nos filtros selecionados.` },
    { icon: '📉', title: 'Onde a marca perde share',
      body: loseBandeiras.length
        ? `A marca está <span class="analysis-highlight lose">abaixo da média</span> em ${loseCount} PDVs (${losePct}% do total). Risco concentrado em: <span class="analysis-highlight">${loseBandeiras.map(b => b.name).join(', ')}</span>.`
        : `Nenhuma bandeira com performance significativamente abaixo da média.` },
    { icon: '🎯', title: 'Maior oportunidade de investimento',
      body: bestOport.length
        ? `Priorizando bandeiras com maior score de oportunidade: <span class="analysis-highlight">${bestOport.map(b => `${b.name} (${b.count} PDVs)`).join(', ')}</span>. Esses PDVs têm maior potencial de crescimento de share.`
        : `Sem dados de oportunidade disponíveis.` },
    { icon: '⚖️', title: 'Balanço geral',
      body: `De ${totalPDVs.toLocaleString('pt-BR')} PDVs visíveis, <span class="analysis-highlight win">${winPct}% ganham</span> e <span class="analysis-highlight lose">${losePct}% perdem</span> share vs. a média da dimensão. ${parseFloat(winPct) > parseFloat(losePct) ? 'Cenário <span class="analysis-highlight win">favorável</span> para a marca.' : 'Há espaço relevante para <span class="analysis-highlight">recuperação de share</span>.'}` },
  ];

  const cardsEl = document.getElementById('analysis-cards');
  if (cardsEl) {
    cardsEl.innerHTML = cards.map(c => `
      <div class="analysis-card">
        <div class="analysis-card-header"><span class="analysis-card-icon">${c.icon}</span><span class="analysis-card-title">${c.title}</span></div>
        <div class="analysis-card-body">${c.body}</div>
      </div>
    `).join('');
  }

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
    .sort((a, b) => b.count - a.count).slice(0, 10);
  const maxUf = Math.max(...ufRanked.map(r => r.count), 1);
  const ufEl = document.getElementById('rank-uf');
  if (ufEl) {
    ufEl.innerHTML = ufRanked.map((item, i) => `
      <div class="rank-item">
        <span class="rank-num">${i + 1}</span>
        <span class="rank-name">${item.name}</span>
        <div class="rank-bar-wrap"><div class="rank-bar" style="width:${item.count / maxUf * 100}%;background:var(--accent)"></div></div>
        <span class="rank-val" style="color:var(--text-dim)">${item.count}</span>
        <span class="rank-badge neutral">${item.shareAvg.toFixed(1)}%</span>
      </div>
    `).join('');
  }
}

// ── Chart Renderers ──────────────────────────────────────────────────────────

function getChartDefaults() {
  return {
    plugins: { legend: { display: false }, tooltip: {
      backgroundColor: cssVar('--surface-solid'), borderColor: cssVar('--border'), borderWidth: 1,
      titleColor: cssVar('--text'), bodyColor: cssVar('--text-dim'), padding: 10, cornerRadius: 6,
    }},
  };
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

function renderBarChart(id, labels, data, colors) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return;
  const ctx = el.getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 4, borderSkipped: false }] },
    options: { ...getChartDefaults(), responsive: true, maintainAspectRatio: false,
      scales: { x: { grid: { color: cssVar('--surface-subtle') }, ticks: { color: cssVar('--text-muted'), font: { size: 10 } } },
        y: { grid: { color: cssVar('--surface-subtle') }, ticks: { color: cssVar('--text-muted'), font: { size: 10 }, callback: v => v.toFixed(1) + '%' } } }
    }
  });
}

function renderHorizBarChart(id, labels, data) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return;
  const ctx = el.getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: cssVar('--accent'), borderRadius: 3, borderSkipped: false }] },
    options: { ...getChartDefaults(), indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: cssVar('--surface-subtle') }, ticks: { color: cssVar('--text-muted'), font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { color: cssVar('--text-dim'), font: { size: 10 }, callback: v => v.length > 14 ? v.slice(0, 14) + '…' : v } }
      }
    }
  });
}

function renderHistChart(id, labels, data) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return;
  const ctx = el.getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: cssVar('--accent-chart'), borderRadius: 2 }] },
    options: { ...getChartDefaults(), responsive: true, maintainAspectRatio: false,
      scales: { x: { grid: { display: false }, ticks: { color: cssVar('--text-muted'), font: { size: 9 }, maxRotation: 45 } },
        y: { grid: { color: cssVar('--surface-subtle') }, ticks: { color: cssVar('--text-muted'), font: { size: 10 } } } }
    }
  });
}

function renderWinLoseChart(id, labels, wins, loses) {
  destroyChart(id);
  const el = document.getElementById(id);
  if (!el) return;
  const ctx = el.getContext('2d');
  charts[id] = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Ganho', data: wins, backgroundColor: cssVar('--win-chart'), borderRadius: 3 },
        { label: 'Perda', data: loses, backgroundColor: cssVar('--lose-chart'), borderRadius: 3 },
      ]
    },
    options: { ...getChartDefaults(), indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { ...getChartDefaults().plugins, legend: { display: true, labels: { color: cssVar('--text-dim'), font: { size: 10 } } } },
      scales: {
        x: { stacked: false, grid: { color: cssVar('--surface-subtle') }, ticks: { color: cssVar('--text-muted'), font: { size: 10 } } },
        y: { grid: { display: false }, ticks: { color: cssVar('--text-dim'), font: { size: 10 }, callback: v => v.length > 12 ? v.slice(0, 12) + '…' : v } }
      }
    }
  });
}
