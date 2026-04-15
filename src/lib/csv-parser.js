// ─── CSV Parser ─────────────────────────────────────────────────────────────
// Parsing com detecção de formato, encoding e separador.
// Puro — sem dependência de DOM ou state.

/** Parse CSV text → array de objetos */
export function parseCSV(text) {
  const lines = text.trim().split('\n');

  let headerIdx = 0;
  for (let i = 0; i < Math.min(lines.length, 5); i++) {
    const clean = lines[i].replace(/^\uFEFF/, '').toLowerCase();
    if (
      clean.includes('marca') || clean.includes('lat') || clean.includes('lon') ||
      clean.includes('cnpj') || clean.includes('enderec') || clean.includes('address') ||
      clean.includes('nome') || clean.includes('name')
    ) {
      headerIdx = i;
      break;
    }
  }

  const raw = lines[headerIdx].replace(/^\uFEFF/, '');
  const sep = (raw.match(/;/g) || []).length > (raw.match(/,/g) || []).length ? ';' : ',';
  const header = raw.split(sep).map(h =>
    h.trim().replace(/"/g, '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  function parseLine(line) {
    const values = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      if (line[i] === '"') { inQ = !inQ; continue; }
      if (line[i] === sep && !inQ) { values.push(cur.trim()); cur = ''; continue; }
      cur += line[i];
    }
    values.push(cur.trim());
    const obj = {};
    header.forEach((h, i) => (obj[h] = values[i] || ''));
    return obj;
  }

  return lines.slice(headerIdx + 1).filter(l => l.trim()).map(parseLine);
}

/** Detecta formato e normaliza → { rows, formato, info } */
export function detectAndNormalize(rows) {
  if (!rows.length) return { rows: [], formato: 'vazio', info: 'Sem dados' };
  const keys = Object.keys(rows[0]);
  const find = (...terms) => keys.find(k => terms.some(t => k.includes(t)));

  const latKey = find('lat', 'latitude');
  const lonKey = find('lon', 'lng', 'longitude');
  const cnpjRaizKey = keys.find(k => k === 'cnpj_raiz');
  const cnpjKey = !cnpjRaizKey ? find('cnpj') : null;
  const endKey = find('endereco', 'endereço', 'address', 'logradouro', 'rua');
  const nomeKey = find('nome', 'name', 'marca', 'brand', 'loja', 'razao', 'fantasia');

  // Formato 0: Varejo 360 com cnpj_raiz
  if (cnpjRaizKey && rows.some(r => (r[cnpjRaizKey] || '').replace(/\D/g, '').length >= 8)) {
    const marcaKey = keys.find(k => k === 'marca') || nomeKey;
    const norm = rows.map(r => ({
      cnpj: r[cnpjRaizKey],
      _cnpj_raiz: (r[cnpjRaizKey] || '').replace(/\D/g, '').padStart(8, '0'),
      marca: r[marcaKey] || '',
      bandeira: 'Carregando...',
      ...r,
    }));
    return { rows: norm, formato: 'cnpj_raiz', info: `${norm.length} PDVs por CNPJ Raiz` };
  }

  // Formato 1: lat/lon direto
  if (latKey && lonKey && rows.some(r => parseFloat(r[latKey]) && parseFloat(r[lonKey]))) {
    const norm = rows.map(r => ({
      cnpj: r[cnpjKey] || '', nome: r[nomeKey] || '', marca: r[nomeKey] || '',
      bandeira: r[nomeKey] || 'Desconhecido',
      lat: parseFloat(r[latKey]), lon: parseFloat(r[lonKey]),
      geo_address: r[endKey] || '', ...r,
    }));
    return { rows: norm, formato: 'latlon', info: `${norm.length} pontos com coordenadas` };
  }

  // Formato 2: HYPR/Kantar
  if (cnpjKey && rows.some(r => (r[cnpjKey] || '').includes(' - '))) {
    const marcaKey = keys.find(k => k === 'marca') || nomeKey;
    const norm = rows.map(r => ({ ...r, marca: r[marcaKey] || '', bandeira: 'Carregando...' }));
    return { rows: norm, formato: 'hypr', info: `${norm.length} PDVs formato HYPR/Kantar` };
  }

  // Formato 3: Endereço livre
  if (endKey) {
    const norm = rows.map(r => ({
      cnpj: r[cnpjKey] || '',
      _endereco_livre: [r[endKey], r[find('bairro', 'neighborhood') || ''],
        r[find('cidade', 'city', 'municipio') || ''],
        r[find('uf', 'estado', 'state') || ''], 'Brasil'].filter(Boolean).join(', '),
      nome: r[nomeKey] || '', marca: r[nomeKey] || '',
      bandeira: r[nomeKey] || 'Desconhecido', ...r,
    }));
    return { rows: norm, formato: 'endereco', info: `${norm.length} endereços livres` };
  }

  // Formato 4: CNPJ puro
  if (cnpjKey && rows.some(r => r[cnpjKey]?.replace(/\D/g, '').length >= 8)) {
    const norm = rows.map(r => ({
      cnpj: r[cnpjKey], marca: r[nomeKey] || '',
      bandeira: r[nomeKey] || r[cnpjKey] || 'Desconhecido', ...r,
    }));
    return { rows: norm, formato: 'cnpj_puro', info: `${norm.length} CNPJs` };
  }

  return { rows, formato: 'hypr', info: `${rows.length} linhas (formato genérico)` };
}

/** Detecta encoding de ArrayBuffer → string decodificada */
export function decodeFileBuffer(buffer) {
  const bytes = new Uint8Array(buffer);

  try {
    return new TextDecoder('UTF-8', { fatal: true }).decode(bytes);
  } catch { /* não é UTF-8 */ }

  // Detectar MacRoman vs Windows-1252
  let macHits = 0, winHits = 0;
  const macLetters = new Set([
    0x87, 0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8e, 0x8f,
    0x90, 0x91, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97,
    0x98, 0x99, 0x9a, 0x9b, 0x9c, 0x9d, 0x9e, 0x9f,
  ]);

  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] >= 0x80 && bytes[i] <= 0x9f) {
      if (macLetters.has(bytes[i])) macHits++;
      else winHits++;
    }
  }

  if (macHits > winHits && macHits > 0) return decodeMacRoman(bytes);

  try {
    return new TextDecoder('windows-1252').decode(bytes);
  } catch {
    return new TextDecoder('ISO-8859-1').decode(bytes);
  }
}

function decodeMacRoman(bytes) {
  const macMap = {
    0x80:0xC4,0x81:0xC5,0x82:0xC7,0x83:0xC9,0x84:0xD1,0x85:0xD6,0x86:0xDC,
    0x87:0xE1,0x88:0xE0,0x89:0xE2,0x8A:0xE4,0x8B:0xE3,0x8C:0xE5,0x8D:0xE7,
    0x8E:0xE9,0x8F:0xE8,0x90:0xEA,0x91:0xEB,0x92:0xED,0x93:0xEC,0x94:0xEE,
    0x95:0xEF,0x96:0xF1,0x97:0xF3,0x98:0xF2,0x99:0xF4,0x9A:0xF6,0x9B:0xF5,
    0x9C:0xFA,0x9D:0xF9,0x9E:0xFB,0x9F:0xFC,
  };
  return Array.from(bytes, b =>
    b < 0x80 ? String.fromCharCode(b)
      : macMap[b] ? String.fromCharCode(macMap[b])
        : String.fromCharCode(b)
  ).join('');
}
