// ─── Geocoder ───────────────────────────────────────────────────────────────
// HERE API via proxy server-side /api/geocode. Key nunca sai do server.
// Suporta structured, freeform, reverse, com fallbacks e cache.

import { GEO_SCORE_MIN } from '../config.js';

const _cache = {};

/** Limpa cache (chamar entre sessões de geocoding) */
export function clearGeoCache() {
  Object.keys(_cache).forEach(k => delete _cache[k]);
}

/** Converte item HERE → formato interno */
function hereItemToResult(item, address) {
  return {
    lat: item.position.lat,
    lon: item.position.lng,
    geo_address: item.address?.label || address || '',
    geo_score: item.scoring?.queryScore || 0,
    uf: item.address?.stateCode || '',
    municipio: item.address?.city || item.address?.district || '',
    cep: item.address?.postalCode || '',
  };
}

/** Limpa ruído de endereços comerciais pra melhorar geocoding */
function cleanCommercialAddress(addr) {
  if (!addr) return addr;
  let s = addr;
  s = s.replace(/^[\w\sÀ-ÿ\.]+Shopping\s*-\s*/i, '');
  s = s.replace(/^Shopping\s+[\w\sÀ-ÿ]+\s*-\s*/i, '');
  s = s.replace(/\s*-?\s*Loja\s+\d+[A-Za-z]?\s*-?\s*/gi, ' ');
  s = s.replace(/\s+Piso\s+(?:Térreo|Trreo|Terreo|L\d+|\d+[ºª°]?\s*(?:Piso)?)\s*/gi, ' ');
  s = s.replace(/\s+\d+[ºª°]\s*(?:Andar|Piso)\s*/gi, ' ');
  s = s.replace(/\s+R\.\s+Eng\.\s*/g, ' ');
  s = s.replace(/\s+Gleba\s+\w+\s*/gi, ' ');
  s = s.replace(/\s+Ac\.\s+/g, ' ');
  s = s.replace(/\s+PAVMT?O?\d*\s*/gi, ' ');
  s = s.replace(/\s*-\s*-\s*/g, ' - ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

/**
 * Geocodifica endereço via /api/geocode (server-side proxy).
 * @param {string} address - Endereço freeform
 * @param {Object} [opts] - { street, city, state, district }
 * @returns {Object|null} { lat, lon, geo_address, uf, cep, geo_score, ... }
 */
export async function geocodeHERE(address, opts) {
  if (!address && !opts?.street) return null;

  const cacheExtra = opts ? `|${opts.city || ''}|${opts.state || ''}` : '';
  const key = (address || '').toLowerCase().trim() + cacheExtra;
  if (_cache[key] !== undefined) return _cache[key];

  try {
    let url;
    const hasStructured = opts && (opts.city || opts.state);

    if (hasStructured) {
      const parts = [];
      if (opts.street) parts.push('street=' + encodeURIComponent(opts.street));
      if (opts.district) parts.push('district=' + encodeURIComponent(opts.district));
      if (opts.city) parts.push('city=' + encodeURIComponent(opts.city));
      if (opts.state) parts.push('state=' + encodeURIComponent(opts.state));
      parts.push('country=Brasil');
      url = `/api/geocode?qq=${parts.join(';')}&limit=5&lang=pt-BR`;
    } else {
      url = `/api/geocode?q=${encodeURIComponent(address)}&in=countryCode:BRA&limit=5&lang=pt-BR`;
    }

    const resp = await fetch(url);
    if (!resp.ok) { _cache[key] = null; return null; }
    const d = await resp.json();
    if (!d.items?.length) { _cache[key] = null; return null; }

    const expectedUF = (opts?.state || '').toUpperCase();
    const expectedCity = (opts?.city || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Filtrar por UF esperada
    if (expectedUF) {
      const ufMatches = d.items
        .filter(it => (it.address?.stateCode || '').toUpperCase() === expectedUF)
        .map(it => hereItemToResult(it, address));

      if (ufMatches.length > 0) {
        if (expectedCity) {
          const cityMatch = ufMatches.find(r => {
            const rCity = (r.municipio || '').toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            return rCity === expectedCity;
          });
          if (cityMatch && cityMatch.geo_score >= GEO_SCORE_MIN) {
            _cache[key] = cityMatch;
            return cityMatch;
          }
        }
        const best = ufMatches.reduce((a, b) => b.geo_score > a.geo_score ? b : a);
        if (best.geo_score >= GEO_SCORE_MIN) {
          _cache[key] = best;
          return best;
        }
      }

      // Fallback freeform se structured não deu match
      if (hasStructured && address) {
        const fallUrl = `/api/geocode?q=${encodeURIComponent(address)}&in=countryCode:BRA&limit=5&lang=pt-BR`;
        const fallResp = await fetch(fallUrl);
        if (fallResp.ok) {
          const fallD = await fallResp.json();
          if (fallD.items?.length) {
            const fallUF = fallD.items
              .filter(it => (it.address?.stateCode || '').toUpperCase() === expectedUF)
              .map(it => hereItemToResult(it, address));
            if (fallUF.length > 0) {
              const best2 = fallUF.reduce((a, b) => b.geo_score > a.geo_score ? b : a);
              if (best2.geo_score >= GEO_SCORE_MIN) {
                _cache[key] = best2;
                return best2;
              }
            }
          }
        }
      }
    }

    // Sem UF ou sem match — primeiro resultado com score ok
    const first = hereItemToResult(d.items[0], address);
    if (first.geo_score >= GEO_SCORE_MIN) {
      if (expectedUF && first.uf.toUpperCase() !== expectedUF) {
        first._ufMismatch = true;
        first._expectedUF = expectedUF;
      }
      _cache[key] = first;
      return first;
    }

    // Endereço limpo (sem shopping/loja/piso)
    const cleanedAddr = cleanCommercialAddress(address);
    if (cleanedAddr && cleanedAddr !== address) {
      const cleanUrl = `/api/geocode?q=${encodeURIComponent(cleanedAddr)}&in=countryCode:BRA&limit=5&lang=pt-BR`;
      const cleanResp = await fetch(cleanUrl);
      if (cleanResp.ok) {
        const cleanD = await cleanResp.json();
        if (cleanD.items?.length) {
          if (expectedUF) {
            const cleanUF = cleanD.items
              .filter(it => (it.address?.stateCode || '').toUpperCase() === expectedUF)
              .map(it => hereItemToResult(it, address));
            if (cleanUF.length > 0) {
              const bestClean = cleanUF.reduce((a, b) => b.geo_score > a.geo_score ? b : a);
              if (bestClean.geo_score >= GEO_SCORE_MIN) {
                _cache[key] = bestClean;
                return bestClean;
              }
            }
          }
          const firstClean = hereItemToResult(cleanD.items[0], address);
          if (firstClean.geo_score >= GEO_SCORE_MIN) {
            if (expectedUF && firstClean.uf.toUpperCase() !== expectedUF) {
              firstClean._ufMismatch = true;
              firstClean._expectedUF = expectedUF;
            }
            _cache[key] = firstClean;
            return firstClean;
          }
        }
      }
    }

    // Último fallback: CEP
    const cepMatch = (address || '').match(/(\d{5}-?\d{3})/);
    if (cepMatch) {
      const cepUrl = `/api/geocode?q=${encodeURIComponent(cepMatch[1] + ' Brasil')}&in=countryCode:BRA&limit=1&lang=pt-BR`;
      const cepResp = await fetch(cepUrl);
      if (cepResp.ok) {
        const cepD = await cepResp.json();
        if (cepD.items?.length) {
          const cepResult = hereItemToResult(cepD.items[0], address);
          cepResult._cepFallback = true;
          _cache[key] = cepResult;
          return cepResult;
        }
      }
    }

    _cache[key] = null;
    return null;
  } catch {
    _cache[key] = null;
    return null;
  }
}

/** Reverse geocode: lat/lon → endereço */
export async function reverseGeocodeHERE(lat, lon) {
  const resp = await fetch(`/api/geocode?action=reverse&at=${lat},${lon}&lang=pt-BR&limit=1`);
  if (!resp.ok) return null;
  const d = await resp.json();
  const item = d.items?.[0];
  if (!item) return null;
  return {
    geo_address: item.address?.label || '',
    uf: item.address?.stateCode || '',
    cep: item.address?.postalCode || '',
  };
}
