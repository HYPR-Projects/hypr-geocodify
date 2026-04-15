// ─── Normalização de Bandeiras ──────────────────────────────────────────────

const _groupMap = {};

/** Normaliza nome removendo sufixos jurídicos e descritivos */
export function normalizeBandeira(nome) {
  if (!nome) return nome;
  let n = nome.toUpperCase().trim();

  n = n.replace(/\s*[-–—]\s*(COMERCIO|COMÉRCIO|COM\.?|DIST\.?|IND\.?)\s+DE\s+.+$/i, '');

  let prev = '';
  while (prev !== n) {
    prev = n;
    n = n.replace(/\s+(LTDA\.?|ME\.?|EPP\.?|EIRELI\.?|SLU\.?|SS\.?|S\.?\s*A\.?|S\/A|CIA\.?)\.?$/i, '');
    n = n.replace(/\s+(COMERCIAL|DISTRIBUIDORA|SUPERMERCADOS?|HIPERMERCADOS?|ATACADISTA|ATACADO|VAREJO|VAREJISTA|MERCADO|MERCEARIA|EMPORIO|MINIMERCADO)$/i, '');
    n = n.replace(/\s+(COMERCIO|COMÉRCIO|COM\.?)\s+(DE|E)\s+.+$/i, '');
    n = n.replace(/\s+(ALIMENTOS|BEBIDAS|PRODUTOS|GENEROS|GÊNEROS|CEREAIS|FRIOS|HORTIFRUTI).*$/i, '');
    n = n.replace(/\s+(IND\.?\s*(E|&)\s*COM\.?|COM\.?\s*(E|&)\s*IND\.?).*$/i, '');
  }

  return n.replace(/[\.\,\-]+$/, '').trim().replace(/\s+/g, ' ');
}

/** Constrói mapa de agrupamento. Retorna { display, originals, count } por grupo */
export function buildBandeiraGroups(data) {
  Object.keys(_groupMap).forEach(k => delete _groupMap[k]);
  const groups = {};

  data.forEach(r => {
    if (!r.bandeira || r.bandeira === 'Não identificado' || r.bandeira === 'Carregando...') return;
    const key = normalizeBandeira(r.bandeira);
    if (!groups[key]) groups[key] = { display: null, originals: new Set(), count: 0 };
    groups[key].originals.add(r.bandeira);
    groups[key].count++;
    if (!groups[key].display || r.bandeira.length < groups[key].display.length) {
      groups[key].display = r.bandeira;
    }
  });

  Object.values(groups).forEach(g => {
    g.originals.forEach(orig => { _groupMap[orig] = g.display; });
  });

  return groups;
}

/** Nome de display normalizado */
export function getDisplayBandeira(original) {
  return _groupMap[original] || original;
}
