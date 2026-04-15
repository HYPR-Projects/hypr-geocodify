// ─── Receita Federal ────────────────────────────────────────────────────────
// Busca dados de CNPJ via BrasilAPI → publica.cnpj.ws.
// Suporta CNPJ completo (14 dígitos) e CNPJ raiz (8 dígitos).

const _cache = {};
let _inFlight = 0;
let _pending = 0;

/** Retorna contadores de estado (pra UI de progresso) */
export function getReceitaState() {
  return { inFlight: _inFlight, pending: _pending };
}

/** Limpa cache entre sessões */
export function clearReceitaCache() {
  Object.keys(_cache).forEach(k => delete _cache[k]);
}

/** Aplica dados da Receita a um row — única fonte autoritativa de bandeira/nome */
export function aplicarReceita(row, receita) {
  if (!receita) {
    if (row.bandeira === 'Carregando...') row.bandeira = 'Não identificado';
    return;
  }
  const nomeReal = receita.nome_exibicao || receita.nome_fantasia || receita.razao_social || '';
  row.nome_fantasia = receita.nome_fantasia || '';
  row.razao_social = receita.razao_social || '';
  row.bandeira = nomeReal || row.cnpj || 'Não identificado';
  if (receita.municipio) row.cidade = receita.municipio;
  if (receita.uf_receita) row.uf = receita.uf_receita;
  if (receita.cep) row.cep = receita.cep;
  if (receita.situacao) row.situacao = receita.situacao;
  if (receita.atividade) row.atividade = receita.atividade;
  if (receita.endereco_receita) row.endereco_receita = receita.endereco_receita;
}

/**
 * Busca CNPJ na Receita Federal.
 * CNPJ raiz (8 dígitos): busca filial ativa via /estabelecimentos.
 * CNPJ completo (14 dígitos): BrasilAPI → publica.cnpj.ws.
 */
export async function buscarReceita(cnpjCol) {
  const cnpjNum = (cnpjCol.split(' - ')[0] || '').replace(/\D/g, '').slice(0, 14);
  if (!cnpjNum) return null;

  // CNPJ Raiz (8 dígitos)
  if (cnpjNum.length === 8) {
    const cacheKey = 'raiz_' + cnpjNum;
    if (_cache[cacheKey] !== undefined) return _cache[cacheKey];
    if (_inFlight >= 5) await new Promise(r => setTimeout(r, 300));
    _inFlight++;
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 10000);
      const resp = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjNum}/estabelecimentos?quantidade=5`, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      clearTimeout(tid);
      if (resp.status === 429) {
        _inFlight--;
        await new Promise(r => setTimeout(r, 2000));
        return buscarReceita(cnpjCol);
      }
      if (!resp.ok) { _cache[cacheKey] = null; _inFlight--; return null; }
      const d = await resp.json();
      const estabs = Array.isArray(d) ? d : (d.estabelecimentos || d.data || []);
      const ativa = estabs.find(e => /ativa/i.test(e.situacao_cadastral || '')) || estabs[0];
      if (!ativa) { _cache[cacheKey] = null; _inFlight--; return null; }
      const result = normalizeEstab(ativa, d.razao_social || ativa.razao_social || '');
      _cache[cacheKey] = result;
      _inFlight--;
      _pending = Math.max(0, _pending - 1);
      return result;
    } catch {
      _cache['raiz_' + cnpjNum] = null;
      _inFlight = Math.max(0, _inFlight - 1);
      _pending = Math.max(0, _pending - 1);
      return null;
    }
  }

  if (cnpjNum.length < 14) return null;

  // Cache por CNPJ completo
  if (_cache[cnpjNum] !== undefined) return _cache[cnpjNum];
  if (_inFlight >= 5) await new Promise(r => setTimeout(r, 300));
  _inFlight++;

  try {
    // PRIMARY: BrasilAPI
    const result = await fetchBrasilAPI(cnpjNum);
    if (result) {
      _cache[cnpjNum] = result;
      _inFlight--;
      _pending = Math.max(0, _pending - 1);
      return result;
    }

    // FALLBACK: publica.cnpj.ws
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`https://publica.cnpj.ws/cnpj/${cnpjNum}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(tid);

    if (resp.status === 429) {
      _inFlight--;
      await new Promise(r => setTimeout(r, 2000));
      return buscarReceita(cnpjCol);
    }
    if (!resp.ok) {
      _cache[cnpjNum] = null;
      _inFlight--;
      _pending = Math.max(0, _pending - 1);
      return null;
    }

    const d = await resp.json();
    const estab = d.estabelecimento || {};
    const fallback = normalizeEstab(estab, d.razao_social || '');
    _cache[cnpjNum] = fallback;
    _inFlight--;
    _pending = Math.max(0, _pending - 1);
    return fallback;
  } catch {
    _cache[cnpjNum] = null;
    _inFlight = Math.max(0, _inFlight - 1);
    _pending = Math.max(0, _pending - 1);
    return null;
  }
}

// ─── Internal helpers ───────────────────────────────────────────────────────

function normalizeEstab(estab, razaoSocial) {
  const nomeFantasia = (estab.nome_fantasia || '').trim();
  const razao = (razaoSocial || estab.razao_social || '').trim();
  const logradouro = [estab.tipo_logradouro, estab.logradouro, estab.numero, estab.complemento]
    .filter(Boolean).join(' ');
  const bairro = (estab.bairro || '').trim();
  const cidade = estab.cidade?.nome || '';
  const uf = estab.estado?.sigla || '';
  const cep = (estab.cep || '').replace(/\D/g, '');
  return {
    nome_fantasia: nomeFantasia,
    razao_social: razao,
    nome_exibicao: nomeFantasia || razao,
    endereco_receita: [logradouro, bairro, cidade, uf, 'Brasil'].filter(Boolean).join(', '),
    municipio: cidade,
    uf_receita: uf,
    cep,
    situacao: estab.situacao_cadastral || '',
    atividade: estab.atividade_principal?.descricao || estab.cnae_fiscal_descricao || '',
    logradouro,
    bairro,
    numero: estab.numero || '',
  };
}

async function fetchBrasilAPI(cnpjNum) {
  try {
    const controller = new AbortController();
    const tid = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpjNum}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json' },
    });
    clearTimeout(tid);
    if (!resp.ok) return null;
    const d = await resp.json();
    const nomeFantasia = (d.nome_fantasia || '').trim();
    const razao = (d.razao_social || '').trim();
    const logradouro = [d.descricao_tipo_logradouro, d.logradouro, d.numero, d.complemento]
      .filter(Boolean).join(' ');
    return {
      nome_fantasia: nomeFantasia,
      razao_social: razao,
      nome_exibicao: nomeFantasia || razao,
      endereco_receita: [logradouro, d.bairro, d.municipio, d.uf, 'Brasil'].filter(Boolean).join(', '),
      municipio: (d.municipio || '').trim(),
      uf_receita: (d.uf || '').trim(),
      cep: (d.cep || '').replace(/\D/g, ''),
      situacao: d.descricao_situacao_cadastral || '',
      atividade: d.cnae_fiscal_descricao || '',
      logradouro,
      bairro: (d.bairro || '').trim(),
      numero: d.numero || '',
    };
  } catch {
    return null;
  }
}
