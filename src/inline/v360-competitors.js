// ────────────────────────────────────────────────────────────────────────────
// V360 Competitors — PR1: Upload + Storage Infrastructure
// ────────────────────────────────────────────────────────────────────────────
// Reusa: SUPABASE_URL, SUPABASE_ANON, _supa, sbFetch, ensureXLSX, parseCSV
// (todos definidos globalmente em src/inline/app.js)
//
// Escopo PR1:
//   - Botão "+ Concorrente" no header (varejo360, não-shared)
//   - Modal de upload XLSX/CSV
//   - Parse + validação + match contra allData (CNPJs do mapa atual)
//   - Persistência em map_competitors + map_competitor_pdvs
//   - Dropdown "Perspectiva" (a partir do 1º concorrente)
//   - Carregamento ao abrir mapa salvo
//   - Suporte a shared mode (read-only)
//   - Detecção de marca base no upload original (popula saved_maps.base_brand)
//
// Fora do escopo (vai pro PR2):
//   - Reclassificação de pinos por modo (Solo/Duelo/Categoria)
//   - Overview adaptativa
//   - Visualizações comparativas (matriz, scatter, etc)
// ────────────────────────────────────────────────────────────────────────────

(function() {
  'use strict';

  // ─── Estado ─────────────────────────────────────────────────────────────
  const state = {
    competitors: [],          // [{ id, brand_name, brand_color, row_count, matched_count, unmatched_count, pdvs: Map<cnpj_14, row> }]
    perspectiveBrand: null,   // marca atualmente selecionada como "ponto de vista"
    ticketsFloor: 5,          // piso de tickets pra considerar share válido (PR2 usa)
    loadedForMapId: null,     // pra evitar reload redundante
  };

  // Paleta padrão de cores por marca (case-insensitive match no nome).
  // (Fase 10) Realinhada com paleta HYPR semântica. Antes usava hex
  // arbitrários (#16a34a Heineken vs --win #018376 HYPR) e tinha colisão
  // (BUDWEISER=AMSTEL=#dc2626). Agora cada marca tem cor única HYPR.
  const BRAND_COLOR_PRESETS = {
    'HEINEKEN':      '#018376', // --win (verde HYPR)
    'BUDWEISER':     '#F5272B', // --lose (vermelho HYPR)
    'AMSTEL':        '#FF5528', // --lose-hi (laranja-vermelho HYPR)
    'STELLA':        '#E89A28', // warm orange
    'STELLA ARTOIS': '#E89A28',
    'BRAHMA':        '#3397B9', // --accent (teal HYPR)
    'SKOL':          '#FFB347', // warm yellow
    'CORONA':        '#FFD24A', // amarelo claro
    'ANTARCTICA':    '#246C84', // teal escuro
    'EISENBAHN':     '#7C2D12', // marrom (mantém)
    'PETRA':         '#B11C1F', // vermelho escuro
    'ITAIPAVA':      '#FACC15', // amarelo
  };

  // Paleta fallback HYPR (rodízio quando não tem preset).
  // Cores distintas o suficiente pra não confundir entre si.
  const FALLBACK_COLORS = [
    '#5F25FF', // --purple (índigo HYPR)
    '#3397B9', // --accent (teal)
    '#018376', // --win
    '#E89A28', // warm orange
    '#5DD6E6', // accent-hi (cyan claro)
    '#4CB050', // win-hi (verde brilhante)
  ];

  // (Fix bug crítico) Hash determinístico do nome da marca → índice estável no
  // FALLBACK_COLORS. Antes usávamos `_fallbackIdx++` mutável, o que fazia a
  // mesma marca receber cores diferentes em chamadas sucessivas (qualquer
  // re-render embaralhava as cores de marcas sem preset). Agora a cor é
  // função pura do nome: pickBrandColor('LOREAL') sempre retorna o mesmo hex.
  function _hashBrandToIdx(name) {
    const norm = String(name || '').toUpperCase().trim();
    let h = 5381;
    for (let i = 0; i < norm.length; i++) {
      h = ((h << 5) + h) + norm.charCodeAt(i); // djb2
      h = h | 0; // força int32
    }
    return Math.abs(h) % FALLBACK_COLORS.length;
  }

  function pickBrandColor(brandName) {
    const norm = String(brandName || '').toUpperCase().trim();
    if (BRAND_COLOR_PRESETS[norm]) return BRAND_COLOR_PRESETS[norm];
    for (const key in BRAND_COLOR_PRESETS) {
      if (norm.includes(key) || key.includes(norm)) return BRAND_COLOR_PRESETS[key];
    }
    return FALLBACK_COLORS[_hashBrandToIdx(norm)];
  }

  // ─── Util ───────────────────────────────────────────────────────────────
  function extractCnpj14(value) {
    // Aceita "44480747000160 - PARADA PINTO...", "44.480.747/0001-60",
    // "44480747000160" puro, ou objetos com chaves cnpj/CNPJ/cnpj_14
    if (value == null) return null;
    if (typeof value === 'object') {
      return extractCnpj14(value.cnpj_14 || value.cnpj || value.CNPJ);
    }
    const s = String(value);
    // Tenta primeiro \b\d{14}\b (CNPJ "limpo" delimitado)
    let m = s.match(/\b(\d{14})\b/);
    if (m) return m[1];
    // Fallback: strip de tudo que não for dígito e pega primeiros 14
    const digits = s.replace(/\D/g, '');
    if (digits.length >= 14) return digits.slice(0, 14);
    return null;
  }

  // Garante que allData tenha cnpj_14 populado em todos os rows.
  // Idempotente: hidrata o campo em memória se faltar. Retorna nº de rows válidos.
  function ensureAllDataCnpj14() {
    const allData = window.allData || [];
    let valid = 0;
    for (const r of allData) {
      if (!r.cnpj_14) {
        const c = extractCnpj14(r);
        if (c) r.cnpj_14 = c;
      }
      if (r.cnpj_14 && /^\d{14}$/.test(r.cnpj_14)) valid++;
    }
    return valid;
  }

  function safeNum(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function getCurrentUserEmail() {
    try {
      const session = window._supa?.auth?.getSession?.() || null;
      return window._currentUserEmail || null;
    } catch(e) { return null; }
  }

  function isV360() {
    return window.currentMapType === 'varejo360';
  }

  function isSharedMode() {
    return !!window._isSharedMode;
  }

  // ─── Modal HTML (injetado uma vez) ──────────────────────────────────────
  function ensureModal() {
    if (document.getElementById('v360-comp-modal')) return;

    const modal = document.createElement('div');
    modal.id = 'v360-comp-modal';
    modal.className = 'v360-comp-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.45);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);align-items:center;justify-content:center;';
    modal.innerHTML = `
      <div class="v360-comp-modal-box" style="background:var(--glass-bg-strong);backdrop-filter:blur(40px) saturate(1.6);-webkit-backdrop-filter:blur(40px) saturate(1.6);border:1px solid var(--glass-border);color:var(--text);border-radius:16px;width:560px;max-width:92vw;max-height:88vh;overflow:auto;box-shadow:var(--glass-shadow),var(--glass-edge);font-family:'Urbanist',system-ui,sans-serif;">
        <div style="padding:18px 22px 14px;border-bottom:1px solid var(--border,#e5e7eb);display:flex;align-items:center;justify-content:space-between;">
          <div>
            <div style="font-size:16px;font-weight:600;letter-spacing:-0.01em;">Adicionar marca concorrente</div>
            <div style="font-size:11.5px;color:var(--text-muted,#6b7280);margin-top:3px;">Faça upload de uma base no mesmo formato do Varejo 360 (XLSX ou CSV)</div>
          </div>
          <button id="v360-comp-modal-close" style="background:none;border:none;font-size:22px;cursor:pointer;color:var(--text-muted,#6b7280);line-height:1;padding:0 4px;">×</button>
        </div>

        <div style="padding:20px 22px;">
          <!-- Drop zone -->
          <div id="v360-comp-drop" style="border:2px dashed var(--border,#d1d5db);border-radius:12px;padding:32px 20px;text-align:center;cursor:pointer;transition:all 0.15s;background:var(--bg-subtle,#fafafa);">
            <div style="font-size:13.5px;font-weight:500;margin-bottom:4px;">Arraste o arquivo aqui ou clique</div>
            <div style="font-size:11.5px;color:var(--text-muted,#6b7280);">XLSX ou CSV · até ~50MB</div>
            <input type="file" id="v360-comp-file" accept=".xlsx,.xls,.csv" style="display:none;" />
          </div>

          <!-- Preview area (preenchido após parse) -->
          <div id="v360-comp-preview" style="display:none;margin-top:18px;"></div>

          <!-- Error area -->
          <div id="v360-comp-error" style="display:none;margin-top:14px;padding:10px 12px;border-radius:8px;background:var(--lose-bg);color:var(--lose-hi);font-size:12px;"></div>
        </div>

        <div style="padding:14px 22px 18px;border-top:1px solid var(--border,#e5e7eb);display:flex;gap:8px;justify-content:flex-end;">
          <button id="v360-comp-cancel" style="padding:8px 14px;border-radius:8px;border:1px solid var(--border,#d1d5db);background:transparent;color:var(--text,#111);font-size:12.5px;cursor:pointer;">Cancelar</button>
          <button id="v360-comp-confirm-replace" style="display:none;padding:8px 16px;border-radius:8px;border:1px solid var(--lose,#dc2626);background:transparent;color:var(--lose,#dc2626);font-size:12.5px;font-weight:500;cursor:pointer;">Substituir tudo</button>
          <button id="v360-comp-confirm" disabled style="padding:8px 16px;border-radius:8px;border:none;background:var(--accent,#2563eb);color:#fff;font-size:12.5px;font-weight:500;cursor:pointer;opacity:0.5;">Adicionar ao mapa</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    // Eventos
    modal.querySelector('#v360-comp-modal-close').onclick = closeModal;
    modal.querySelector('#v360-comp-cancel').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    const dropZone = modal.querySelector('#v360-comp-drop');
    const fileInput = modal.querySelector('#v360-comp-file');
    dropZone.onclick = () => fileInput.click();
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--accent,#2563eb)'; dropZone.style.background = 'rgba(37,99,235,0.06)'; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = ''; dropZone.style.background = ''; };
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.style.borderColor = '';
      dropZone.style.background = '';
      if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
    };
    fileInput.onchange = (e) => { if (e.target.files[0]) handleFile(e.target.files[0]); };

    modal.querySelector('#v360-comp-confirm').onclick = () => onConfirm('auto');
    const _replaceBtn = modal.querySelector('#v360-comp-confirm-replace');
    if (_replaceBtn) _replaceBtn.onclick = () => onConfirm('replace');
  }

  function openModal() {
    ensureModal();
    document.getElementById('v360-comp-modal').style.display = 'flex';
    resetModalState();
  }

  function closeModal() {
    const m = document.getElementById('v360-comp-modal');
    if (m) m.style.display = 'none';
  }

  function resetModalState() {
    const preview = document.getElementById('v360-comp-preview');
    const err = document.getElementById('v360-comp-error');
    const confirm = document.getElementById('v360-comp-confirm');
    const replaceBtn = document.getElementById('v360-comp-confirm-replace');
    const fileInput = document.getElementById('v360-comp-file');
    if (preview) { preview.style.display = 'none'; preview.innerHTML = ''; }
    if (err) { err.style.display = 'none'; err.textContent = ''; }
    if (confirm) { confirm.disabled = true; confirm.style.opacity = '0.5'; confirm.textContent = 'Adicionar ao mapa'; }
    if (replaceBtn) { replaceBtn.style.display = 'none'; replaceBtn.disabled = false; replaceBtn.style.opacity = '1'; }
    if (fileInput) fileInput.value = '';
    delete window._v360CompPending;
  }

  function showError(msg) {
    const err = document.getElementById('v360-comp-error');
    if (err) { err.style.display = 'block'; err.textContent = msg; }
  }

  // ─── Parsing ────────────────────────────────────────────────────────────
  async function handleFile(file) {
    resetModalState();
    const isXLSX = /\.xlsx?$/i.test(file.name);
    const isCSV = /\.csv$/i.test(file.name);
    if (!isXLSX && !isCSV) {
      showError('Formato não suportado. Use XLSX ou CSV.');
      return;
    }

    try {
      let rows;
      if (isXLSX) {
        if (typeof window.ensureXLSX === 'function') await window.ensureXLSX();
        rows = await parseXLSX(file);
      } else {
        rows = await parseCSVFile(file);
      }
      if (!rows || !rows.length) {
        showError('Arquivo vazio ou sem linhas de dados reconhecíveis.');
        return;
      }
      // Filtra a linha "TODOS OS CNPJS FILTRADOS" e linhas sem cnpj_14 válido
      const dataRows = rows.filter(r => {
        const c = extractCnpj14(r.cnpj || r.CNPJ);
        return !!c;
      });
      if (!dataRows.length) {
        showError('Não foi possível extrair nenhum CNPJ válido (14 dígitos) da coluna "cnpj".');
        return;
      }

      // Detecta marca (1ª linha de dados)
      const detectedBrand = String(dataRows[0].marca || dataRows[0].Marca || '').toUpperCase().trim();
      if (!detectedBrand) {
        showError('Coluna "marca" não encontrada ou vazia na primeira linha de dados.');
        return;
      }

      // Valida formato: precisa ter share_reais_sku_dimensao OU share_reais_dimensao
      const sample = dataRows[0];
      if (sample.share_reais_sku_dimensao == null && sample.share_reais_dimensao == null) {
        showError('Arquivo não tem coluna "share_reais_sku_dimensao". Verifique se é uma base no formato Varejo 360.');
        return;
      }

      // Match contra allData (universo do mapa atual)
      // Primeiro hidrata cnpj_14 em allData (mapas antigos podem não ter o campo)
      ensureAllDataCnpj14();
      const universeSet = new Set();
      const allData = window.allData || [];
      for (const r of allData) {
        const c = r.cnpj_14 || extractCnpj14(r);
        if (c) universeSet.add(c);
      }
      if (universeSet.size === 0) {
        showError('Não foi possível extrair CNPJs do mapa atual. Verifique se o mapa foi carregado completamente.');
        return;
      }

      let matched = 0;
      let withShare = 0;
      const cnpjsSeen = new Set();
      const normalizedRows = [];
      for (const r of dataRows) {
        const cnpj14 = extractCnpj14(r.cnpj || r.CNPJ);
        if (!cnpj14) continue;
        if (cnpjsSeen.has(cnpj14)) continue;
        cnpjsSeen.add(cnpj14);

        const matched_flag = universeSet.has(cnpj14);
        if (matched_flag) matched++;

        const shareR = safeNum(r.share_reais_sku_dimensao);
        if (shareR != null && shareR > 0) withShare++;

        normalizedRows.push({
          cnpj_14: cnpj14,
          matched: matched_flag,
          share_reais_sku_dimensao: shareR,
          share_volume_sku_dimensao: safeNum(r.share_volume_sku_dimensao),
          share_unidades_sku_dimensao: safeNum(r.share_unidades_sku_dimensao),
          share_reais_sku_diff_media_dimensao: safeNum(r.share_reais_sku_diff_media_dimensao),
          share_volume_sku_diff_media_dimensao: safeNum(r.share_volume_sku_diff_media_dimensao),
          share_unidades_sku_diff_media_dimensao: safeNum(r.share_unidades_sku_diff_media_dimensao),
          tickets_amostra: r.tickets_amostra != null ? parseInt(r.tickets_amostra, 10) : null,
          percentual_dimensao: safeNum(r.percentual_dimensao),
          percentual_marca_dimensao: safeNum(r.percentual_marca_dimensao),
          oportunidade_dimensao: r.oportunidade_dimensao != null ? String(r.oportunidade_dimensao) : null,
        });
      }

      const total = normalizedRows.length;
      const unmatched = total - matched;
      const matchPct = total ? (matched / total * 100) : 0;

      // Verifica se essa marca já está carregada
      const existingComp = state.competitors.find(c => c.brand_name === detectedBrand);
      const alreadyLoaded = !!existingComp;
      const isBaseBrand = (window._currentMapBaseBrand || '').toUpperCase() === detectedBrand;

      // Quando a marca já existe: quantos CNPJs do arquivo são NOVOS vs já
      // presentes (estes seriam apenas atualizados pelo upsert, não somam).
      let newInBrand = 0, dupInBrand = 0;
      if (existingComp && existingComp.pdvs) {
        for (const r of normalizedRows) {
          if (existingComp.pdvs.has(r.cnpj_14)) dupInBrand++;
          else newInBrand++;
        }
      }

      const suggestedColor = pickBrandColor(detectedBrand);

      window._v360CompPending = {
        brandName: detectedBrand,
        color: suggestedColor,
        filename: file.name,
        rows: normalizedRows,
        rowCount: total,
        matchedCount: matched,
        unmatchedCount: unmatched,
        withShareCount: withShare,
        newInBrand,
        dupInBrand,
      };

      renderPreview({
        brandName: detectedBrand,
        color: suggestedColor,
        filename: file.name,
        total,
        matched,
        unmatched,
        matchPct,
        withShare,
        alreadyLoaded,
        newInBrand,
        dupInBrand,
        isBaseBrand,
      });
    } catch(e) {
      console.error('[v360-comp] parse error:', e);
      showError('Erro ao ler arquivo: ' + (e.message || e));
    }
  }

  async function parseXLSX(file) {
    const buf = await file.arrayBuffer();
    const data = new Uint8Array(buf);
    const wb = XLSX.read(data, { type: 'array' });
    // Procura sheet "Dados" primeiro, senão usa a primeira
    let sheetName = wb.SheetNames.find(n => /dados/i.test(n)) || wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    // Detecta header row
    const knownCols = ['marca','cnpj','share_reais','tickets_amostra','percentual_dimensao'];
    let headerRow = 0;
    for (let r = 0; r < Math.min(aoa.length, 10); r++) {
      const cells = (aoa[r] || []).map(c => String(c||'').toLowerCase().trim());
      const matches = cells.filter(c => knownCols.some(kc => c.includes(kc))).length;
      if (matches >= 2) { headerRow = r; break; }
    }
    const headers = (aoa[headerRow] || []).map(h => String(h||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().replace(/\s+/g,'_'));
    const rows = [];
    for (let r = headerRow + 1; r < aoa.length; r++) {
      const row = aoa[r];
      if (!row || !row.some(v => v !== '' && v != null)) continue;
      const obj = {};
      headers.forEach((h,i) => { obj[h] = row[i] != null ? row[i] : ''; });
      rows.push(obj);
    }
    return rows;
  }

  async function parseCSVFile(file) {
    const text = await file.text();
    if (typeof window.parseCSV === 'function') return window.parseCSV(text);
    // Fallback simples (não deveria ser usado: parseCSV existe global)
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (!lines.length) return [];
    const headers = lines[0].split(',').map(h => h.toLowerCase().trim());
    return lines.slice(1).map(line => {
      const vals = line.split(',');
      const obj = {};
      headers.forEach((h,i) => { obj[h] = vals[i] || ''; });
      return obj;
    });
  }

  function renderPreview({ brandName, color, filename, total, matched, unmatched, matchPct, withShare, alreadyLoaded, newInBrand, dupInBrand, isBaseBrand }) {
    const preview = document.getElementById('v360-comp-preview');
    const confirm = document.getElementById('v360-comp-confirm');
    const matchColor = matchPct >= 90 ? '#16a34a' : matchPct >= 60 ? '#f59e0b' : '#dc2626';

    let warning = '';
    if (alreadyLoaded) {
      const nothingNew = (newInBrand === 0);
      const breakdown = nothingNew
        ? `<div style="margin-top:6px;color:#b45309;"><b>Nenhum CNPJ novo neste arquivo</b> — os ${dupInBrand.toLocaleString('pt-BR')} CNPJs já estão em ${brandName}. Adicionar só atualizaria os valores; o total de PDVs não muda. Se queria incluir outra praça (ex.: outro estado), confira se o arquivo é o certo.</div>`
        : `<div style="margin-top:6px;color:var(--text);"><b>${newInBrand.toLocaleString('pt-BR')}</b> CNPJ${newInBrand===1?'':'s'} novo${newInBrand===1?'':'s'} serão somados${dupInBrand>0?` · ${dupInBrand.toLocaleString('pt-BR')} já existentes serão atualizados`:''}.</div>`;
      warning = `<div style="margin-top:10px;padding:8px 10px;background:var(--neutral-bg);color:var(--neutral);border-radius:6px;font-size:11.5px;line-height:1.5;">A marca <b>${brandName}</b> já está nesse mapa. <b>Adicionar aos dados</b> faz merge por CNPJ; <b>Substituir tudo</b> apaga os atuais e usa só este arquivo.${breakdown}</div>`;
    } else if (isBaseBrand) {
      warning = `<div style="margin-top:10px;padding:8px 10px;background:rgba(220,38,38,0.1);color:#991b1b;border-radius:6px;font-size:11.5px;">⚠️ A marca <b>${brandName}</b> é a marca base desse mapa. Não é possível adicioná-la como concorrente.</div>`;
    }

    preview.style.display = 'block';
    preview.innerHTML = `
      <div style="background:var(--bg-subtle,#f9fafb);border:1px solid var(--border,#e5e7eb);border-radius:10px;padding:14px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
          <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></div>
          <div style="flex:1;min-width:0;">
            <div style="font-size:14px;font-weight:600;letter-spacing:-0.01em;">${brandName}</div>
            <div style="font-size:11px;color:var(--text-muted,#6b7280);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${filename}</div>
          </div>
          <button id="v360-comp-color-btn" style="background:transparent;border:1px solid var(--border,#d1d5db);border-radius:6px;padding:4px 8px;font-size:10.5px;cursor:pointer;color:var(--text-muted,#6b7280);">Trocar cor</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;">
          <div>
            <div style="font-size:10px;color:var(--text-muted,#6b7280);text-transform:uppercase;letter-spacing:0.04em;">Linhas</div>
            <div style="font-size:18px;font-weight:600;margin-top:2px;">${total.toLocaleString('pt-BR')}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-muted,#6b7280);text-transform:uppercase;letter-spacing:0.04em;">Match c/ mapa</div>
            <div style="font-size:18px;font-weight:600;margin-top:2px;color:${matchColor};">${matchPct.toFixed(1)}%</div>
            <div style="font-size:10px;color:var(--text-muted,#6b7280);">${matched.toLocaleString('pt-BR')} de ${total.toLocaleString('pt-BR')}</div>
          </div>
          <div>
            <div style="font-size:10px;color:var(--text-muted,#6b7280);text-transform:uppercase;letter-spacing:0.04em;">Com share &gt; 0</div>
            <div style="font-size:18px;font-weight:600;margin-top:2px;">${withShare.toLocaleString('pt-BR')}</div>
            <div style="font-size:10px;color:var(--text-muted,#6b7280);">${total ? (withShare/total*100).toFixed(0) : 0}% das linhas</div>
          </div>
        </div>
        ${unmatched > 0 ? `<div style="margin-top:10px;font-size:11px;color:var(--text-muted,#6b7280);">${unmatched.toLocaleString('pt-BR')} CNPJ${unmatched===1?'':'s'} fora do universo do mapa (${(unmatched/total*100).toFixed(1)}%) — serão salvos mas marcados como "não casados"</div>` : ''}
        ${warning}
      </div>
    `;

    // Wire up color picker
    const colorBtn = preview.querySelector('#v360-comp-color-btn');
    if (colorBtn) {
      colorBtn.onclick = () => promptColorChange(brandName);
    }

    const replaceBtn = document.getElementById('v360-comp-confirm-replace');
    if (isBaseBrand) {
      confirm.disabled = true;
      confirm.style.opacity = '0.5';
      if (replaceBtn) replaceBtn.style.display = 'none';
    } else {
      confirm.disabled = false;
      confirm.style.opacity = '1';
      confirm.textContent = alreadyLoaded ? 'Adicionar aos dados' : 'Adicionar ao mapa';
      if (replaceBtn) {
        replaceBtn.style.display = alreadyLoaded ? '' : 'none';
        replaceBtn.disabled = false;
        replaceBtn.style.opacity = '1';
      }
    }
  }

  function promptColorChange(brandName) {
    const colors = ['#dc2626','#16a34a','#eab308','#3b82f6','#7c3aed','#0891b2','#db2777','#65a30d','#ea580c','#f59e0b'];
    const html = colors.map(c => `<button data-color="${c}" style="width:28px;height:28px;border-radius:50%;border:2px solid transparent;background:${c};cursor:pointer;margin:2px;" onmouseover="this.style.borderColor='#000'" onmouseout="this.style.borderColor='transparent'"></button>`).join('');
    const popup = document.createElement('div');
    popup.style.cssText = 'position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center;';
    popup.innerHTML = `<div style="background:#fff;padding:18px;border-radius:12px;text-align:center;"><div style="font-size:12px;margin-bottom:10px;font-weight:500;">Escolha a cor de ${brandName}</div>${html}<div><button id="v360-color-cancel" style="margin-top:10px;padding:5px 12px;background:transparent;border:1px solid #d1d5db;border-radius:6px;cursor:pointer;font-size:11px;">Cancelar</button></div></div>`;
    document.body.appendChild(popup);
    popup.querySelectorAll('button[data-color]').forEach(b => {
      b.onclick = () => {
        const c = b.dataset.color;
        if (window._v360CompPending) window._v360CompPending.color = c;
        // Atualiza preview dot
        const dot = document.querySelector('#v360-comp-preview > div > div:first-child > div:first-child');
        if (dot) dot.style.background = c;
        popup.remove();
      };
    });
    popup.querySelector('#v360-color-cancel').onclick = () => popup.remove();
    popup.onclick = (e) => { if (e.target === popup) popup.remove(); };
  }

  // ─── Geocode dos PDVs do concorrente sem ponto no mapa ───────────────────
  // Para os CNPJs do arquivo que ainda não existem em map_pdvs, busca lat/lon
  // no cnpj_cache (base permanente compartilhada) e insere como PDV de
  // whitespace da marca base (marca = base, sem share base). Faz a praça
  // aparecer no mapa mesmo antes de a base ter dados ali. Camada 1: só cache,
  // sem geocode online (HERE) — cobertura parcial por design. lat/lon são NOT
  // NULL em map_pdvs, então só entram os CNPJs que têm coordenada no cache.
  async function geocodeUnmatchedViaCache(rows, mapId) {
    const empty = { plotted: 0, missing: 0, plottedCnpjs: [] };
    try {
      if (typeof window.bulkCnpjGeocodeLookup !== 'function' || !Array.isArray(window.allData)) return empty;
      const baseBrand = window._currentMapBaseBrand || null;

      // CNPJs já presentes no mapa (têm ponto).
      const present = new Set();
      for (const r of window.allData) {
        const c = r.cnpj_14 || (window._normalizeCnpj14 ? window._normalizeCnpj14(r.cnpj || '') : null);
        if (c) present.add(c);
      }
      // CNPJs do arquivo sem ponto no mapa.
      const unmatched = [];
      const seen = new Set();
      for (const r of rows) {
        const c = r.cnpj_14;
        if (c && !present.has(c) && !seen.has(c)) { seen.add(c); unmatched.push(c); }
      }
      if (!unmatched.length) return empty;

      const hits = await window.bulkCnpjGeocodeLookup(unmatched);
      const newRows = [];
      const plottedCnpjs = [];
      for (const c of unmatched) {
        const h = hits.get(c);
        if (!h || h.lat == null || h.lon == null) continue;
        newRows.push({
          map_id: mapId,
          cnpj: c,                 // 14 dígitos; cnpj_14 é coluna gerada no banco
          marca: baseBrand,        // whitespace da base: ponto existe, base ausente
          lat: h.lat,
          lon: h.lon,
          uf: h.uf_geocode || null,
          geo_address: h.geo_address || null,
        });
        plottedCnpjs.push(c);
      }
      if (!newRows.length) return { plotted: 0, missing: unmatched.length, plottedCnpjs: [] };

      const CHUNK = 500;
      for (let i = 0; i < newRows.length; i += CHUNK) {
        await window.sbFetch('map_pdvs?on_conflict=map_id,cnpj_14', {
          method: 'POST',
          headers: { 'Prefer': 'resolution=ignore-duplicates,return=minimal' },
          body: JSON.stringify(newRows.slice(i, i + CHUNK)),
        });
      }
      // Espelha em allData pro render imediato (mesmo shape das linhas do mapa).
      const ad = window.allData || [];
      for (const r of newRows) {
        ad.push({ cnpj: r.cnpj, cnpj_14: r.cnpj, marca: r.marca, lat: r.lat, lon: r.lon, uf: r.uf, geo_address: r.geo_address });
      }
      window.allData = ad; // setter (Object.defineProperty) propaga pro módulo
      return { plotted: newRows.length, missing: unmatched.length - newRows.length, plottedCnpjs };
    } catch (e) {
      console.warn('[v360-comp] geocode via cache falhou:', e && e.message);
      return empty;
    }
  }

  // ─── Confirm & Save ──────────────────────────────────────────────────────
  async function onConfirm(forceMode) {
    const pending = window._v360CompPending;
    if (!pending) return;
    const mapId = window._currentOpenMapId;
    if (!mapId) {
      showError('Mapa não está salvo. Salve o mapa antes de adicionar concorrentes.');
      return;
    }

    // Resolve o modo: marca nova => 'new'; marca existente => 'append' (default
    // não-destrutivo) ou 'replace' (botão "Substituir tudo", forceMode).
    const existing = state.competitors.find(c => c.brand_name === pending.brandName);
    const mode = !existing ? 'new' : (forceMode === 'replace' ? 'replace' : 'append');
    const isAppend = mode === 'append';

    const confirmBtn = document.getElementById('v360-comp-confirm');
    const replaceBtn = document.getElementById('v360-comp-confirm-replace');
    const activeBtn = (mode === 'replace') ? replaceBtn : confirmBtn;
    [confirmBtn, replaceBtn].forEach(b => { if (b) { b.disabled = true; b.style.opacity = '0.5'; } });
    if (activeBtn) activeBtn.textContent = 'Salvando...';

    try {
      let competitorId;
      if (isAppend) {
        // Reusa o competitor existente; não deleta nada.
        competitorId = existing.id;
      } else {
        // 'replace' apaga o competitor (cascateia os PDVs) antes de recriar.
        if (mode === 'replace') {
          await window.sbFetch('map_competitors?id=eq.' + existing.id, {
            method: 'DELETE',
            headers: { 'Prefer': 'return=minimal' }
          });
        }
        const userEmail = window._currentUserEmail || 'unknown@hypr.mobi';
        const created = await window.sbFetch('map_competitors', {
          method: 'POST',
          headers: { 'Prefer': 'return=representation' },
          body: JSON.stringify([{
            map_id: mapId,
            brand_name: pending.brandName,
            brand_color: pending.color,
            source_filename: pending.filename,
            row_count: pending.rowCount,
            matched_count: pending.matchedCount,
            unmatched_count: pending.unmatchedCount,
            created_by: userEmail,
          }])
        });
        competitorId = Array.isArray(created) ? created[0].id : created.id;
      }

      // No append, upsert por (competitor_id, cnpj_14) — idempotente, sem
      // duplicar CNPJ e seguro contra re-upload acidental da mesma base.
      const pdvPath = isAppend
        ? 'map_competitor_pdvs?on_conflict=competitor_id,cnpj_14'
        : 'map_competitor_pdvs';
      const pdvPrefer = isAppend
        ? 'return=minimal,resolution=merge-duplicates'
        : 'return=minimal';

      // Chunks de 500, processados em paralelo (4 simultâneos)
      const CHUNK = 500;
      const PARALLEL = 4;
      const totalRows = pending.rows.length;
      const payloads = [];
      for (let i = 0; i < totalRows; i += CHUNK) {
        payloads.push(pending.rows.slice(i, i+CHUNK).map(r => ({
          competitor_id: competitorId,
          cnpj_14: r.cnpj_14,
          matched: r.matched,
          share_reais_sku_dimensao: r.share_reais_sku_dimensao,
          share_volume_sku_dimensao: r.share_volume_sku_dimensao,
          share_unidades_sku_dimensao: r.share_unidades_sku_dimensao,
          share_reais_sku_diff_media_dimensao: r.share_reais_sku_diff_media_dimensao,
          share_volume_sku_diff_media_dimensao: r.share_volume_sku_diff_media_dimensao,
          share_unidades_sku_diff_media_dimensao: r.share_unidades_sku_diff_media_dimensao,
          tickets_amostra: r.tickets_amostra,
          percentual_dimensao: r.percentual_dimensao,
          percentual_marca_dimensao: r.percentual_marca_dimensao,
          oportunidade_dimensao: r.oportunidade_dimensao,
        })));
      }
      let saved = 0;
      for (let i = 0; i < payloads.length; i += PARALLEL) {
        const batch = payloads.slice(i, i + PARALLEL);
        await Promise.all(batch.map(payload =>
          window.sbFetch(pdvPath, {
            method: 'POST',
            headers: { 'Prefer': pdvPrefer },
            body: JSON.stringify(payload)
          })
        ));
        saved += batch.reduce((s, p) => s + p.length, 0);
        if (activeBtn) activeBtn.textContent = `Salvando ${saved.toLocaleString('pt-BR')}/${totalRows.toLocaleString('pt-BR')}...`;
      }

      // ─── Atualiza state local ───────────────────────────────────────────
      let resultMatched;
      if (isAppend) {
        // Merge no Map existente (a nova linha sobrescreve a antiga do mesmo CNPJ).
        for (const r of pending.rows) existing.pdvs.set(r.cnpj_14, r);
        // Recalcula contadores a partir do Map mergeado (fonte de verdade,
        // espelha o banco após o upsert). Somar cego erraria com CNPJ repetido.
        const total = existing.pdvs.size;
        let matched = 0;
        for (const v of existing.pdvs.values()) if (v.matched) matched++;
        existing.row_count = total;
        existing.matched_count = matched;
        existing.unmatched_count = total - matched;
        resultMatched = matched;
        // Persiste os contadores recalculados no competitor.
        try {
          await window.sbFetch('map_competitors?id=eq.' + competitorId, {
            method: 'PATCH',
            headers: { 'Prefer': 'return=minimal' },
            body: JSON.stringify({
              row_count: total,
              matched_count: matched,
              unmatched_count: total - matched,
            })
          });
        } catch(e) { console.warn('[v360-comp] counter patch failed:', e.message); }
      } else {
        if (existing) {
          state.competitors = state.competitors.filter(c => c.id !== existing.id);
        }
        const pdvMap = new Map();
        for (const r of pending.rows) pdvMap.set(r.cnpj_14, r);
        state.competitors.push({
          id: competitorId,
          brand_name: pending.brandName,
          brand_color: pending.color,
          row_count: pending.rowCount,
          matched_count: pending.matchedCount,
          unmatched_count: pending.unmatchedCount,
          pdvs: pdvMap,
        });
        resultMatched = pending.matchedCount;
      }

      // Detecta + persiste base_brand se ainda não setado
      await ensureBaseBrandPersisted();

      // Geocodifica via cache os PDVs do concorrente que ainda não têm ponto
      // no mapa e os plota como whitespace da base. Faz a praça nova aparecer.
      if (activeBtn) activeBtn.textContent = 'Mapeando PDVs...';
      const geoRes = await geocodeUnmatchedViaCache(pending.rows, mapId);

      // Os CNPJs que ganharam ponto agora passam a casar — atualiza o state.
      if (geoRes.plotted) {
        const comp = state.competitors.find(c => c.brand_name === pending.brandName);
        if (comp && comp.pdvs) {
          for (const c of geoRes.plottedCnpjs) {
            const pdv = comp.pdvs.get(c);
            if (pdv) pdv.matched = true;
          }
          let m = 0; for (const v of comp.pdvs.values()) if (v.matched) m++;
          comp.matched_count = m;
          comp.unmatched_count = comp.pdvs.size - m;
        }
      }

      closeModal();
      _showColorUpdateBanner('Recalculando mapa com nova marca…');
      try { window._invalidateOpenedMapCache && window._invalidateOpenedMapCache(mapId); } catch(_) {}
      // Re-renderiza os pins do mapa pra mostrar os PDVs recém-plotados.
      try { if (typeof window.applyFilters === 'function') window.applyFilters(); } catch(_) {}
      renderHeaderUI();
      try {
        window.dispatchEvent(new CustomEvent('v360:competitors-loaded', {
          detail: { count: state.competitors.length, source: isAppend ? 'append' : 'add' }
        }));
      } catch(_) {}
      setTimeout(_hideColorUpdateBanner, 800);
      const geoSuffix = geoRes.plotted
        ? ` · +${geoRes.plotted.toLocaleString('pt-BR')} no mapa${geoRes.missing ? ` (${geoRes.missing.toLocaleString('pt-BR')} sem coordenada ainda)` : ''}`
        : (geoRes.missing ? ` · ${geoRes.missing.toLocaleString('pt-BR')} sem coordenada no cache` : '');
      if (isAppend) {
        const nv = pending.newInBrand || 0;
        const dp = pending.dupInBrand || 0;
        const msg = nv > 0
          ? `${pending.brandName}: +${nv.toLocaleString('pt-BR')} PDV${nv===1?'':'s'} novo${nv===1?'':'s'}${dp>0?` · ${dp.toLocaleString('pt-BR')} atualizados`:''}${geoSuffix}`
          : `${pending.brandName}: 0 novos — ${dp.toLocaleString('pt-BR')} CNPJs já existiam${geoSuffix || '. Verifique se o arquivo é o da praça certa.'}`;
        showToast(msg);
      } else {
        const verb = (mode === 'replace') ? 'substituído' : 'adicionado';
        showToast(`Concorrente "${pending.brandName}" ${verb} · ${resultMatched.toLocaleString('pt-BR')} PDVs com match${geoSuffix}`);
      }
    } catch(e) {
      console.error('[v360-comp] save error:', e);
      showError('Erro ao salvar: ' + (e.message || e));
      [confirmBtn, replaceBtn].forEach(b => { if (b) { b.disabled = false; b.style.opacity = '1'; } });
      if (confirmBtn) confirmBtn.textContent = existing ? 'Adicionar aos dados' : 'Adicionar ao mapa';
      if (replaceBtn && existing) replaceBtn.textContent = 'Substituir tudo';
    }
  }

  async function ensureBaseBrandPersisted() {
    if (window._currentMapBaseBrand) return;
    const allData = window.allData || [];
    if (!allData.length) return;
    // Pega marca mais frequente em allData
    const counts = {};
    for (const r of allData) {
      const m = String(r.marca || '').toUpperCase().trim();
      if (!m) continue;
      counts[m] = (counts[m] || 0) + 1;
    }
    const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
    if (!sorted.length) return;
    const baseBrand = sorted[0][0];
    try {
      await window.sbFetch('saved_maps?id=eq.' + window._currentOpenMapId, {
        method: 'PATCH',
        headers: { 'Prefer': 'return=minimal' },
        body: JSON.stringify({ base_brand: baseBrand })
      });
      window._currentMapBaseBrand = baseBrand;
      if (!state.perspectiveBrand) state.perspectiveBrand = baseBrand;
    } catch(e) {
      console.warn('[v360-comp] base_brand persist failed:', e.message);
    }
  }

  // ─── Header UI ──────────────────────────────────────────────────────────
  // Fase 2: tudo unificado em uma única cápsula central (#perspBar).
  // Funções antigas (renderCompetitorButton, renderPerspectiveDropdown,
  // renderCompetitorChips) foram substituídas por renderPerspBar().
  function renderHeaderUI() {
    renderPerspBar();
    // Limpa elementos legados que possam estar no DOM de sessões anteriores
    // (caso o módulo seja recarregado num browser que já tinha rendered antigo)
    _removeLegacyHeaderEls();
  }

  function _removeLegacyHeaderEls() {
    const legacy = ['btn-add-competitor', 'v360-perspective-wrap', 'v360-comp-chips'];
    for (const id of legacy) {
      const el = document.getElementById(id);
      if (el && el.parentNode) el.parentNode.removeChild(el);
    }
  }

  // Renderiza a perspective bar (cápsula central do header) com:
  //   [chip lente · LENTE] [chip concorrente · ×] ... [+]
  // Visível só em V360 com mapa aberto. Em outros modos: display:none.
  function renderPerspBar() {
    const bar = document.getElementById('perspBar');
    if (!bar) return;

    const baseBrand = window._currentMapBaseBrand;
    const shouldShow = isV360() && !!baseBrand && !!window._currentOpenMapId;
    if (!shouldShow) {
      bar.style.display = 'none';
      bar.innerHTML = '';
      _closeLensMenu();
      return;
    }

    // Lente = perspectiveBrand (default = base_brand)
    const lens = state.perspectiveBrand || baseBrand;
    const canEdit = !isSharedMode();

    // (Fase 10) Resolve cor da base: persistida em payload OU pickBrandColor.
    function _baseColor(bname) {
      if (!bname) return 'var(--absent)';
      const persisted = window._savedMapPayload?.base_brand_color;
      if (persisted) return persisted;
      return pickBrandColor(bname);
    }

    // Lista ordenada: lente primeiro, depois os outros (base + competitors, sem duplicar lente)
    const others = [];
    if (baseBrand && baseBrand !== lens) {
      others.push({ name: baseBrand, color: _baseColor(baseBrand), isBase: true, compId: null, matched: null });
    }
    for (const c of state.competitors) {
      if (c.brand_name === lens) continue; // pula se for a lente
      others.push({ name: c.brand_name, color: c.brand_color || pickBrandColor(c.brand_name), isBase: false, compId: c.id, matched: c.matched_count });
    }

    // Contagem da lente:
    //   - se é a base: total de PDVs do mapa (allData.length, fallback a window._allDataLength)
    //   - se é um concorrente: matched_count
    let lensColor = (lens === baseBrand)
      ? _baseColor(lens)
      : pickBrandColor(lens);
    let lensCount = null;
    if (lens === baseBrand) {
      lensCount = (window.allData && window.allData.length) || null;
    } else {
      const lensComp = state.competitors.find(c => c.brand_name === lens);
      if (lensComp) {
        lensColor = lensComp.brand_color || lensColor;
        lensCount = lensComp.matched_count;
      }
    }

    // Render
    const lensChipHTML = `
      <button type="button" class="persp-chip lens" data-lens-chip="1" aria-expanded="false" aria-haspopup="menu"
              title="Lente: ${_esc(lens)} — clique pra trocar a perspectiva"
              style="color:${lensColor}">
        <span class="persp-dot" aria-hidden="true"></span>
        <span class="persp-name">${_esc(lens)}</span>
        ${lensCount != null ? `<span class="persp-count">${lensCount.toLocaleString('pt-BR')}</span>` : ''}
        <span class="lens-tag">lente</span>
        ${others.length > 0 ? `<span class="lens-caret" aria-hidden="true"><svg width="10" height="10" viewBox="0 0 12 12"><path fill="currentColor" d="M6 8L1 3h10z"/></svg></span>` : ''}
      </button>
    `;

    const otherChipsHTML = others.map(o => `
      <span class="persp-chip${canEdit && o.compId ? ' is-draggable' : ''}" data-brand="${_esc(o.name)}"${canEdit && o.compId ? ` data-comp-id="${o.compId}" draggable="true"` : ''} style="color:${o.color}">
        <span class="persp-dot" aria-hidden="true"></span>
        <span class="persp-name">${_esc(o.name)}</span>
        ${o.matched != null ? `<span class="persp-count">${o.matched.toLocaleString('pt-BR')}</span>` : ''}
        ${canEdit && o.compId ? `<button type="button" class="x" data-del-comp="${o.compId}" title="Remover concorrente" aria-label="Remover ${_esc(o.name)}">×</button>` : ''}
      </span>
    `).join('');

    const addBtnHTML = canEdit
      ? `<button type="button" class="persp-add" data-persp-add="1" title="Adicionar marca concorrente" aria-label="Adicionar marca concorrente">+</button>`
      : '';

    bar.innerHTML = lensChipHTML + otherChipsHTML + addBtnHTML;
    bar.style.display = 'inline-flex';

    // Bindings
    const lensChip = bar.querySelector('[data-lens-chip="1"]');
    if (lensChip) {
      lensChip.onclick = (e) => {
        e.stopPropagation();
        // Só abre menu se há outras opções
        if (others.length === 0) return;
        _toggleLensMenu(lensChip);
      };
    }
    bar.querySelectorAll('button[data-del-comp]').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        const id = b.dataset.delComp;
        const comp = state.competitors.find(c => c.id === id);
        if (!comp) return;
        if (!confirm(`Remover concorrente "${comp.brand_name}" deste mapa?`)) return;
        deleteCompetitor(id);
      };
    });
    const addBtn = bar.querySelector('[data-persp-add="1"]');
    if (addBtn) addBtn.onclick = (e) => { e.stopPropagation(); openModal(); };

    // Drag-and-drop pra reordenar concorrentes
    if (canEdit) _wireDragReorder(bar);

    // (Fase 10) Click na bolinha persp-dot abre color picker.
    // Não propaga: clicando no dot, NÃO abre menu da lente nem deleta competitor.
    if (canEdit) {
      bar.querySelectorAll('.persp-chip .persp-dot').forEach(dot => {
        dot.style.cursor = 'pointer';
        dot.title = 'Clique pra mudar a cor';
        dot.onclick = (e) => {
          e.stopPropagation();
          e.preventDefault();
          const chip = dot.closest('.persp-chip');
          if (!chip) return;
          // Resolve brand: lente ou data-brand
          let brand;
          if (chip.dataset.lensChip === '1') {
            brand = lens;
          } else {
            brand = chip.dataset.brand;
          }
          if (!brand) return;

          // (Fix) Cor atual do chip. Antes usávamos `chip.style.color || lensColor`,
          // o que caía no `lensColor` quando o inline style ainda não estava
          // resolvido no DOM (timing entre render e click handler em alguns
          // browsers). Resultado: picker abria com cor da lente em vez da cor
          // do chip clicado, gerando confusão visual.
          // Solução: derivar cor diretamente do estado canônico (state.competitors
          // ou _baseColor), com fallback final em `getComputedStyle`.
          let currentColor;
          if (chip.dataset.lensChip === '1') {
            currentColor = lensColor;
          } else {
            const compRow = state.competitors.find(c => c.brand_name === brand);
            if (compRow && compRow.brand_color) {
              currentColor = compRow.brand_color;
            } else if (brand === baseBrand) {
              currentColor = _baseColor(brand);
            } else {
              currentColor = pickBrandColor(brand);
            }
          }
          // Normaliza pra hex (currentColor pode vir como rgb() em alguns edge cases)
          const m = /^#[0-9a-fA-F]{6}$/.exec(currentColor)
            ? currentColor
            : (function() {
                const rgb = /rgb\((\d+),\s*(\d+),\s*(\d+)\)/.exec(currentColor);
                if (rgb) {
                  return '#' + [rgb[1], rgb[2], rgb[3]]
                    .map(x => parseInt(x, 10).toString(16).padStart(2, '0'))
                    .join('').toUpperCase();
                }
                return '#3397B9';
              })();
          if (window.V360ColorPicker) {
            // (Fix #3) Loading state: dot ganha spinner, chip fica não-clicável,
            // banner discreto aparece. Restaurado no fim do updateBrandColor (sucesso ou erro).
            window.V360ColorPicker.open(dot, m, async (newHex) => {
              _setChipLoading(chip, true);
              _showColorUpdateBanner();
              try {
                await updateBrandColor(brand, newHex);
              } finally {
                _setChipLoading(chip, false);
                _hideColorUpdateBanner();
              }
            });
          }
        };
      });
    }
  }

  // ─── Dropdown da lente (trocar perspectiva) ─────────────────────────────
  function _toggleLensMenu(lensChip) {
    const existing = document.getElementById('persp-lens-menu');
    if (existing) { _closeLensMenu(); return; }

    const baseBrand = window._currentMapBaseBrand;
    const current = state.perspectiveBrand || baseBrand;
    const all = [];
    if (baseBrand) {
      const persisted = window._savedMapPayload?.base_brand_color;
      const baseCol = persisted || pickBrandColor(baseBrand);
      all.push({ name: baseBrand, color: baseCol, isBase: true });
    }
    for (const c of state.competitors) {
      if (c.brand_name === baseBrand) continue;
      all.push({ name: c.brand_name, color: c.brand_color || pickBrandColor(c.brand_name), isBase: false });
    }

    const menu = document.createElement('div');
    menu.id = 'persp-lens-menu';
    menu.className = 'persp-lens-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = all.map(b => `
      <button type="button" class="persp-lens-menu-item ${b.name === current ? 'current' : ''}"
              data-set-lens="${_esc(b.name)}" role="menuitem">
        <span class="pdot" style="color:${b.color};background:${b.color}"></span>
        <span>${_esc(b.name)}${b.isBase ? ' (base)' : ''}</span>
      </button>
    `).join('');
    // Append no body para escapar do overflow:hidden do header. Posiciona
    // ancorado abaixo do chip via getBoundingClientRect (position: fixed).
    document.body.appendChild(menu);
    const rect = lensChip.getBoundingClientRect();
    menu.style.top = (rect.bottom + 8) + 'px';
    menu.style.left = Math.max(8, Math.min(window.innerWidth - 220, rect.left)) + 'px';
    // Stash da ref do chip pra _closeLensMenu atualizar aria-expanded
    menu._lensChip = lensChip;
    lensChip.setAttribute('aria-expanded', 'true');

    menu.querySelectorAll('button[data-set-lens]').forEach(b => {
      b.onclick = (e) => {
        e.stopPropagation();
        const newLens = b.dataset.setLens;
        if (newLens === current) { _closeLensMenu(); return; }
        state.perspectiveBrand = newLens;
        try { window.dispatchEvent(new CustomEvent('v360:perspective-changed', { detail: { brand: newLens } })); } catch(_) {}
        _closeLensMenu();
        renderPerspBar();
      };
    });

    // Fechar ao clicar fora
    setTimeout(() => {
      document.addEventListener('click', _onDocClickCloseLensMenu, { once: true });
    }, 0);
  }

  function _closeLensMenu() {
    const m = document.getElementById('persp-lens-menu');
    if (m) {
      // menu agora vive em <body>; o chip âncora é guardado em _lensChip
      if (m._lensChip) {
        try { m._lensChip.setAttribute('aria-expanded', 'false'); } catch(_) {}
      }
      m.remove();
    }
    document.removeEventListener('click', _onDocClickCloseLensMenu);
  }

  function _onDocClickCloseLensMenu() {
    _closeLensMenu();
  }

  // Escape básico pra evitar quebra em nomes com aspas/HTML
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // ─── Drag-and-drop pra reordenar concorrentes ──────────────────────────
  // Chips com data-comp-id (concorrentes) são arrastáveis. O drop em outro
  // chip insere antes (metade esquerda) ou depois (metade direita). Persiste
  // em saved_maps.payload.competitor_order (array de brand_name).
  function _wireDragReorder(bar) {
    // Idempotência: renderPerspBar() roda toda vez que algo muda (drop, color,
    // perspectiva, etc) e re-chama _wireDragReorder. Sem este guard, cada
    // render acumula um novo set de listeners — depois de N drags, o drop
    // dispara N vezes e o state.competitors fica embaralhado.
    if (bar._dragReorderWired) return;
    bar._dragReorderWired = true;
    let draggingId = null;
    let beforeRects = null;
    bar.addEventListener('dragstart', (e) => {
      const chip = e.target.closest('.persp-chip.is-draggable');
      if (!chip) return;
      draggingId = chip.dataset.compId || null;
      if (!draggingId) return;
      try {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', draggingId);
      } catch(_) {}
      // Snapshot pra FLIP animation no drop
      beforeRects = new Map();
      bar.querySelectorAll('.persp-chip.is-draggable').forEach(c => {
        beforeRects.set(c.dataset.compId, c.getBoundingClientRect());
      });
      // is-dragging só aplica opacity no original; ghost padrão do browser
      // segue o cursor com o chip em aparência normal (feedback claro pro user).
      // Aplica num rAF pra não interferir com a captura do ghost.
      requestAnimationFrame(() => chip.classList.add('is-dragging'));
    });
    bar.addEventListener('dragend', () => {
      bar.querySelectorAll('.persp-chip.is-dragging').forEach(c => c.classList.remove('is-dragging'));
      bar.querySelectorAll('.persp-chip.drop-before, .persp-chip.drop-after').forEach(c => c.classList.remove('drop-before', 'drop-after'));
      draggingId = null;
      beforeRects = null;
    });
    bar.addEventListener('dragover', (e) => {
      if (!draggingId) return;
      const target = e.target.closest('.persp-chip.is-draggable');
      if (!target || target.dataset.compId === draggingId) return;
      e.preventDefault();
      try { e.dataTransfer.dropEffect = 'move'; } catch(_) {}
      bar.querySelectorAll('.persp-chip.drop-before, .persp-chip.drop-after').forEach(c => c.classList.remove('drop-before', 'drop-after'));
      const rect = target.getBoundingClientRect();
      const before = (e.clientX - rect.left) < rect.width / 2;
      target.classList.add(before ? 'drop-before' : 'drop-after');
    });
    bar.addEventListener('drop', (e) => {
      if (!draggingId) return;
      const target = e.target.closest('.persp-chip.is-draggable');
      if (!target || target.dataset.compId === draggingId) return;
      e.preventDefault();
      const rect = target.getBoundingClientRect();
      const before = (e.clientX - rect.left) < rect.width / 2;
      const fromIdx = state.competitors.findIndex(c => c.id === draggingId);
      if (fromIdx < 0) return;
      const [moved] = state.competitors.splice(fromIdx, 1);
      let insertAt = state.competitors.findIndex(c => c.id === target.dataset.compId);
      if (insertAt < 0) { state.competitors.splice(fromIdx, 0, moved); return; }
      if (!before) insertAt += 1;
      state.competitors.splice(insertAt, 0, moved);
      const snapshot = beforeRects;
      _persistCompetitorOrder();
      // Cache stale com ordem antiga — invalida
      try { window._invalidateOpenedMapCache && window._invalidateOpenedMapCache(window._currentOpenMapId); } catch(_) {}
      renderHeaderUI();
      _flipAnimateChips(bar, snapshot);
      try {
        window.dispatchEvent(new CustomEvent('v360:competitors-loaded', {
          detail: { count: state.competitors.length, source: 'reorder' }
        }));
      } catch(_) {}
    });
  }

  // FLIP animation: depois do re-render, anima cada chip da posição antiga
  // pra nova com translateX. Dá sensação de "deslizou pro lugar" em vez de
  // "teletransportou".
  function _flipAnimateChips(bar, beforeRects) {
    if (!beforeRects) return;
    bar.querySelectorAll('.persp-chip.is-draggable').forEach(c => {
      const id = c.dataset.compId;
      const before = beforeRects.get(id);
      if (!before) return;
      const after = c.getBoundingClientRect();
      const dx = before.left - after.left;
      if (Math.abs(dx) < 1) return;
      c.style.transition = 'none';
      c.style.transform = `translateX(${dx}px)`;
      // Force reflow pra aplicar o transform inicial antes da transição
      void c.offsetWidth;
      c.style.transition = 'transform 320ms cubic-bezier(.2,.9,.2,1)';
      c.style.transform = '';
      setTimeout(() => {
        c.style.transition = '';
        c.style.transform = '';
      }, 360);
    });
  }

  async function _persistCompetitorOrder() {
    const mapId = window._currentOpenMapId || window._savedMapId;
    if (!mapId) return;
    try {
      const payload = window._savedMapPayload || {};
      payload.competitor_order = state.competitors.map(c => c.brand_name);
      window._savedMapPayload = payload;
      await window.sbFetch(`saved_maps?id=eq.${mapId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
        body: JSON.stringify({ payload }),
      });
    } catch(e) { console.warn('[v360-comp] PATCH competitor_order failed:', e); }
  }

  // Reordena state.competitors pelo payload.competitor_order (se houver).
  // Concorrentes não listados (adicionados depois) vão pro fim, mantendo
  // ordem de inserção (created_at).
  function _applyCompetitorOrder() {
    const order = window._savedMapPayload?.competitor_order;
    if (!Array.isArray(order) || !order.length) return;
    const idx = new Map(order.map((b, i) => [b, i]));
    state.competitors.sort((a, b) => {
      const ai = idx.has(a.brand_name) ? idx.get(a.brand_name) : Number.MAX_SAFE_INTEGER;
      const bi = idx.has(b.brand_name) ? idx.get(b.brand_name) : Number.MAX_SAFE_INTEGER;
      return ai - bi;
    });
  }

  async function deleteCompetitor(id) {
    try {
      await window.sbFetch('map_competitors?id=eq.' + id, {
        method: 'DELETE',
        headers: { 'Prefer': 'return=minimal' }
      });
      state.competitors = state.competitors.filter(c => c.id !== id);
      // Se perspectiva atual foi removida, volta pra base
      if (state.perspectiveBrand && !state.competitors.some(c => c.brand_name === state.perspectiveBrand) && state.perspectiveBrand !== window._currentMapBaseBrand) {
        state.perspectiveBrand = window._currentMapBaseBrand;
      }
      try { window._invalidateOpenedMapCache && window._invalidateOpenedMapCache(window._currentOpenMapId); } catch(_) {}
      renderHeaderUI();
      try {
        window.dispatchEvent(new CustomEvent('v360:competitors-loaded', {
          detail: { count: state.competitors.length, source: 'remove' }
        }));
      } catch(_) {}
      showToast('Concorrente removido');
    } catch(e) {
      console.error('[v360-comp] delete error:', e);
      showToast('Erro ao remover: ' + (e.message || e), true);
    }
  }

  function showToast(msg, isError) {
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);padding:10px 18px;border-radius:8px;background:${isError?'#dc2626':'#111'};color:#fff;font-size:12.5px;font-family:'Urbanist',sans-serif;z-index:10001;box-shadow:0 8px 24px rgba(0,0,0,0.25);`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
  }

  // ─── Load on map open ───────────────────────────────────────────────────
  async function loadForMap(mapId, sharedMode) {
    if (!mapId) {
      reset();
      try { window.dispatchEvent(new CustomEvent('v360:competitors-loaded', { detail: { count: 0 } })); } catch(_) {}
      return;
    }
    // Helper: usa window._savedMapMeta (prefetchado em openSavedMap) quando
    // disponível e dedo certo, evitando round-trip duplicado em saved_maps.
    async function _getMapMeta() {
      if (window._savedMapMeta && window._currentOpenMapId === mapId) {
        return [window._savedMapMeta];
      }
      try {
        return await window.sbFetch('saved_maps?id=eq.' + mapId + '&select=base_brand,tickets_floor');
      } catch(_) { return null; }
    }

    if (state.loadedForMapId === mapId) {
      // Mesmo mapa já carregado — só atualiza meta (base_brand pode ter mudado
      // por upload/auto-detect anterior). Usa cache se disponível.
      try {
        const meta = await _getMapMeta();
        if (Array.isArray(meta) && meta[0]) {
          if (meta[0].base_brand) window._currentMapBaseBrand = meta[0].base_brand;
          state.ticketsFloor = meta[0].tickets_floor || state.ticketsFloor;
        }
      } catch(_) {}
      renderHeaderUI();
      try { window.dispatchEvent(new CustomEvent('v360:competitors-loaded', { detail: { count: state.competitors.length } })); } catch(_) {}
      return;
    }
    reset();
    state.loadedForMapId = mapId;

    // base_brand do saved_maps (usa cache quando disponível)
    try {
      const meta = await _getMapMeta();
      if (Array.isArray(meta) && meta[0]) {
        window._currentMapBaseBrand = meta[0].base_brand || null;
        state.ticketsFloor = meta[0].tickets_floor || 5;
      }
      // Auto-detect: se base_brand está vazio mas temos allData carregado com marca,
      // detecta marca dominante e persiste (fix retroativo pra mapas antigos)
      if (!window._currentMapBaseBrand && !sharedMode) {
        const allData = window.allData || [];
        if (allData.length > 0) {
          const counts = {};
          for (const r of allData) {
            const m = String(r.marca || '').toUpperCase().trim();
            if (m) counts[m] = (counts[m] || 0) + 1;
          }
          const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
          if (sorted.length && sorted[0][1] > allData.length * 0.5) {
            const detected = sorted[0][0];
            window._currentMapBaseBrand = detected;
            try {
              await window.sbFetch('saved_maps?id=eq.' + mapId, {
                method: 'PATCH',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify({ base_brand: detected })
              });
              console.log(`[v360-comp] Auto-detected base_brand="${detected}" for map ${mapId}`);
            } catch(_) {}
          }
        }
      }
    } catch(e) {
      console.warn('[v360-comp] load meta failed:', e.message);
    }

    // Competitors + PDVs
    try {
      const comps = await window.sbFetch('map_competitors?map_id=eq.' + mapId + '&select=*&order=created_at.asc');
      if (!Array.isArray(comps) || !comps.length) {
        renderHeaderUI();
        try { window.dispatchEvent(new CustomEvent('v360:competitors-loaded', { detail: { count: 0 } })); } catch(_) {}
        return;
      }
      // Garante cnpj_14 em allData antes de qualquer cálculo de match
      ensureAllDataCnpj14();
      const _universeSet = new Set();
      for (const r of (window.allData || [])) {
        const c = r.cnpj_14 || extractCnpj14(r);
        if (c) _universeSet.add(c);
      }

      const compStates = await Promise.all(comps.map(async (c) => {
        const compState = {
          id: c.id,
          brand_name: c.brand_name,
          brand_color: c.brand_color || pickBrandColor(c.brand_name),
          row_count: c.row_count || 0,
          matched_count: c.matched_count || 0,
          unmatched_count: c.unmatched_count || 0,
          pdvs: new Map(),
        };
        // Paginar pdvs
        let page = 0;
        const PAGE = 1000;
        let actualMatched = 0;
        const pdvIdsToFix = [];
        while (true) {
          const pdvs = await window.sbFetch(`map_competitor_pdvs?competitor_id=eq.${c.id}&select=*&offset=${page*PAGE}&limit=${PAGE}`);
          if (!pdvs || !pdvs.length) break;
          for (const p of pdvs) {
            // Recalcula matched contra o universo atual
            const shouldMatch = _universeSet.has(p.cnpj_14);
            if (shouldMatch && !p.matched) {
              pdvIdsToFix.push(p.id);
              p.matched = true;
            }
            if (shouldMatch) actualMatched++;
            compState.pdvs.set(p.cnpj_14, p);
          }
          if (pdvs.length < PAGE) break;
          page++;
        }

        // Backfill: se matched_count salvo está errado, corrige no banco (silent)
        if (pdvIdsToFix.length > 0 && _universeSet.size > 0 && !sharedMode) {
          compState.matched_count = actualMatched;
          compState.unmatched_count = compState.row_count - actualMatched;
          try {
            window.sbFetch('map_competitors?id=eq.' + c.id, {
              method: 'PATCH',
              headers: { 'Prefer': 'return=minimal' },
              body: JSON.stringify({
                matched_count: actualMatched,
                unmatched_count: compState.row_count - actualMatched,
              })
            }).catch(() => {});
            // Update matched=true em chunks (IN clause)
            const CHUNK = 200;
            for (let i = 0; i < pdvIdsToFix.length; i += CHUNK) {
              const chunk = pdvIdsToFix.slice(i, i+CHUNK);
              window.sbFetch('map_competitor_pdvs?id=in.(' + chunk.join(',') + ')', {
                method: 'PATCH',
                headers: { 'Prefer': 'return=minimal' },
                body: JSON.stringify({ matched: true })
              }).catch(() => {});
            }
            console.log(`[v360-comp] Backfilled matched em ${pdvIdsToFix.length} PDVs de "${c.brand_name}" (matched_count: ${c.matched_count} → ${actualMatched})`);
          } catch(_) {}
        }

        return compState;
      }));
      for (const cs of compStates) state.competitors.push(cs);
      _applyCompetitorOrder();
      if (!state.perspectiveBrand && window._currentMapBaseBrand) {
        state.perspectiveBrand = window._currentMapBaseBrand;
      }
      renderHeaderUI();
      try { window.dispatchEvent(new CustomEvent('v360:competitors-loaded', { detail: { count: state.competitors.length } })); } catch(_) {}
    } catch(e) {
      console.warn('[v360-comp] load competitors failed:', e.message);
    }
  }

  function reset() {
    state.competitors = [];
    state.perspectiveBrand = null;
    state.loadedForMapId = null;
    state.ticketsFloor = 5;
    // (Removido _fallbackIdx — agora pickBrandColor é puro/determinístico via hash)
    // Limpa também o base_brand global pra não vazar entre mapas
    window._currentMapBaseBrand = null;
    // limpa UI: esconde perspective bar + remove qualquer dropdown da lente aberto
    const bar = document.getElementById('perspBar');
    if (bar) { bar.style.display = 'none'; bar.innerHTML = ''; }
    _closeLensMenu();
    // limpa elementos legados (caso ainda existam de versões antigas)
    _removeLegacyHeaderEls();
  }

  // ─── Color picker handlers ──────────────────────────────────────────────

  // (Fix #3) Loading state helpers — feedback visual durante PATCH + re-render.
  // Sem isso, usuário clica em "Aplicar" no picker e fica sem saber se travou.
  function _setChipLoading(chip, loading) {
    if (!chip) return;
    if (loading) {
      chip.classList.add('persp-chip-loading');
      chip.style.pointerEvents = 'none';
      chip.style.opacity = '0.6';
    } else {
      chip.classList.remove('persp-chip-loading');
      chip.style.pointerEvents = '';
      chip.style.opacity = '';
    }
  }

  function _showColorUpdateBanner(message) {
    let banner = document.getElementById('v360-update-banner');
    if (banner) banner.remove();
    banner = document.createElement('div');
    banner.id = 'v360-update-banner';
    banner.style.cssText = 'position:fixed;top:64px;left:50%;transform:translateX(-50%);' +
      'background:rgba(28,38,47,0.95);backdrop-filter:blur(16px) saturate(1.6);' +
      '-webkit-backdrop-filter:blur(16px) saturate(1.6);' +
      'border:1px solid rgba(255,255,255,0.08);border-radius:10px;padding:8px 14px;' +
      'color:#E5EBF2;font-family:Urbanist,sans-serif;font-size:12px;line-height:1.4;' +
      'box-shadow:0 8px 24px rgba(0,0,0,0.32);z-index:10000;display:flex;align-items:center;gap:10px;';
    banner.innerHTML =
      '<span class="v360-spinner" style="display:inline-block;width:12px;height:12px;' +
      'border:2px solid rgba(51,151,185,0.25);border-top-color:#3397B9;border-radius:50%;' +
      'animation:v360spin 0.8s linear infinite;"></span>' +
      '<span>' + (message || 'Atualizando…') + '</span>';
    // Injeta keyframes do spinner (uma vez)
    if (!document.getElementById('v360-spinner-style')) {
      const st = document.createElement('style');
      st.id = 'v360-spinner-style';
      st.textContent = '@keyframes v360spin{to{transform:rotate(360deg)}}';
      document.head.appendChild(st);
    }
    document.body.appendChild(banner);
  }

  function _hideColorUpdateBanner() {
    const banner = document.getElementById('v360-update-banner');
    if (banner) banner.remove();
  }

  // Expõe pra uso externo (ex: onConfirm de adição de marca)
  window._v360ShowUpdateBanner = _showColorUpdateBanner;
  window._v360HideUpdateBanner = _hideColorUpdateBanner;

  // Atualiza cor de uma marca (base ou competitor). Persiste no Supabase.
  //   brand: nome da marca
  //   color: hex novo
  // Para base: salva em saved_maps.payload.base_brand_color
  // Para competitor: PATCH em map_competitors.brand_color
  async function updateBrandColor(brand, color) {
    // Identifica como base se brand matchear o baseBrand atual OU se nenhum
    // competitor tem esse nome (significa que é a base).
    const comp = state.competitors.find(c =>
      c.brand_name.toUpperCase() === String(brand).toUpperCase()
    );

    if (comp) {
      // É competitor — PATCH
      comp.brand_color = color;
      try {
        await window.sbFetch(`map_competitors?id=eq.${comp.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ brand_color: color }),
        });
      } catch(e) {
        console.warn('[v360-comp] PATCH competitor color failed:', e);
        // (Fix) Em caso de erro, reverte cor local pra não enganar usuário.
        // O catch silencioso anterior deixava state local diferente do Supabase.
        const reverted = await window.sbFetch(`map_competitors?id=eq.${comp.id}&select=brand_color`)
          .catch(() => null);
        if (reverted && reverted[0]) {
          comp.brand_color = reverted[0].brand_color;
        }
        alert('Falha ao salvar a nova cor. A cor anterior foi restaurada.');
      }
    } else {
      // É base — persiste em saved_maps.payload.base_brand_color
      const mapId = window._currentOpenMapId || window._savedMapId;
      if (!mapId) return;
      try {
        const payload = window._savedMapPayload || {};
        payload.base_brand_color = color;
        window._savedMapPayload = payload;
        await window.sbFetch(`saved_maps?id=eq.${mapId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
          body: JSON.stringify({ payload }),
        });
      } catch(e) {
        console.warn('[v360-comp] PATCH base color failed:', e);
        alert('Falha ao salvar a nova cor da marca base.');
      }
    }

    // Cache stale com cor antiga — invalida
    try { window._invalidateOpenedMapCache && window._invalidateOpenedMapCache(window._currentOpenMapId); } catch(_) {}
    // Dispara re-render APÓS o PATCH (ou catch) ter concluído.
    // (Fix) Antes o renderPerspBar() rodava antes do await resolver, então
    // se o PATCH falhasse o estado local ficava certo mas Supabase errado.
    try { renderPerspBar(); } catch(_) {}
    try {
      window.dispatchEvent(new CustomEvent('v360:competitors-loaded', {
        detail: { count: state.competitors.length, colorChanged: true },
      }));
    } catch(_) {}
  }

  // ─── API pública ────────────────────────────────────────────────────────
  window.V360Comp = {
    loadForMap,
    reset,
    renderHeaderUI,
    openModal,
    pickBrandColor,
    updateBrandColor,
    getState: () => ({
      competitors: state.competitors.slice(),
      perspectiveBrand: state.perspectiveBrand,
      ticketsFloor: state.ticketsFloor,
    }),
    getCompetitorPdv: (brandName, cnpj14) => {
      const c = state.competitors.find(x => x.brand_name === brandName);
      return c ? c.pdvs.get(cnpj14) : null;
    },
    setTicketsFloor: (v) => {
      state.ticketsFloor = parseInt(v, 10) || 5;
    },
    setPerspective: (brand) => {
      state.perspectiveBrand = brand;
    },
    // ─── Cache de 1 slot: snapshot/restore p/ reabertura instantânea ─────
    // Snapshot retorna refs diretas (pdvs Map não é mutado pós-load).
    // Restore reseta state e repopula sem refetch. Caller é responsável por
    // restaurar window._currentMapBaseBrand antes de chamar restore.
    snapshotCompetitors: () => {
      return {
        competitors: state.competitors.map(c => ({
          id: c.id,
          brand_name: c.brand_name,
          brand_color: c.brand_color,
          row_count: c.row_count,
          matched_count: c.matched_count,
          unmatched_count: c.unmatched_count,
          pdvs: c.pdvs,
        })),
        perspectiveBrand: state.perspectiveBrand,
        ticketsFloor: state.ticketsFloor,
      };
    },
    restoreCompetitors: (snap, mapId) => {
      if (!snap || !mapId) return;
      reset();
      for (const c of (snap.competitors || [])) state.competitors.push(c);
      state.perspectiveBrand = snap.perspectiveBrand || window._currentMapBaseBrand || null;
      state.ticketsFloor = snap.ticketsFloor || 5;
      state.loadedForMapId = mapId;
      renderHeaderUI();
      try {
        window.dispatchEvent(new CustomEvent('v360:competitors-loaded', {
          detail: { count: state.competitors.length, source: 'cache-restore' }
        }));
      } catch(_) {}
    },
  };

  // ─── Auto-hook em entry points ──────────────────────────────────────────
  // Quando openSavedMap rodar, dispara carregamento via window event
  // (app.js dispara via setHeaderMapName/_resetPlacesOverlayFields wrappers)
  window.addEventListener('v360:map-opened', (e) => {
    const { mapId, sharedMode } = e.detail || {};
    loadForMap(mapId, sharedMode);
  });
  window.addEventListener('v360:map-closed', () => {
    reset();
  });

})();
