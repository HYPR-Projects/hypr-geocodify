// ─── Save / Load ────────────────────────────────────────────────────────────
// Persistência de mapas no Supabase (saved_maps + map_pdvs).

import { sbFetch } from './supabase.js';
import { DB_CHUNK_SIZE, DB_PAGE_SIZE, THUMB_COLORS } from '../config.js';

/**
 * Salva mapa no Supabase. Cria um registro em saved_maps e insere os PDVs em lotes.
 * @param {Object} opts - { name, description, mapType, allData, userEmail, periodo, placesContext }
 * @param {Function} onProgress - callback(pctNumber) pra atualizar UI
 * @returns {string} mapId
 */
export async function saveMapToSupabase(opts, onProgress) {
  const { name, description, mapType, allData, userEmail, periodo, placesContext } = opts;
  if (!name) throw new Error('Nome do mapa é obrigatório');

  const colorIdx = Math.floor(Math.random() * THUMB_COLORS.length);

  const saved = await sbFetch('saved_maps', {
    method: 'POST',
    body: JSON.stringify({
      name,
      description: description || null,
      created_by: userEmail,
      row_count: allData.length,
      thumbnail_color: THUMB_COLORS[colorIdx],
      map_type: mapType || 'varejo360',
      periodo_mes: periodo?.mes || null,
      periodo_ano: periodo?.ano || null,
      periodo_label: periodo?.label || null,
      payload: placesContext || null,
    }),
  });
  const mapId = Array.isArray(saved) ? saved[0].id : saved.id;

  const saveable = allData.filter(r => r.lat != null && r.lon != null && parseFloat(r.lat) && parseFloat(r.lon));

  for (let i = 0; i < saveable.length; i += DB_CHUNK_SIZE) {
    const chunk = saveable.slice(i, i + DB_CHUNK_SIZE).map(r => ({
      map_id: mapId,
      cnpj: r.cnpj || null, bandeira: r.bandeira || null,
      nome: r.nome || null,
      lat: r.lat, lon: r.lon,
      geo_address: r.geo_address || null,
      marca: r.marca || null, uf: r.uf || null,
      nome_fantasia: r.nome_fantasia || null,
      razao_social: r.razao_social || null,
      situacao: r.situacao || null,
      atividade: r.atividade || null,
      cep: r.cep || null,
      place_id: r.place_id || null,
      place_types: r.place_types || null,
      place_status: r.place_status || null,
      percentual_dimensao: parseFloat(r.percentual_dimensao) || null,
      percentual_marca_dimensao: parseFloat(r.percentual_marca_dimensao) || null,
      percentual_diff_media_dimensao: parseFloat(r.percentual_diff_media_dimensao) || null,
      oportunidade_dimensao: r.oportunidade_dimensao || null,
      share_reais_sku: parseFloat(r.share_reais_sku) || null,
      share_volume_sku: parseFloat(r.share_volume_sku) || null,
      share_unidades_sku: parseFloat(r.share_unidades_sku) || null,
      share_reais_dimensao: parseFloat(r.share_reais_dimensao) || null,
      share_volume_dimensao: parseFloat(r.share_volume_dimensao) || null,
      share_unidades_dimensao: parseFloat(r.share_unidades_dimensao) || null,
      share_reais_sku_dimensao: parseFloat(r.share_reais_sku_dimensao) || null,
      share_volume_sku_dimensao: parseFloat(r.share_volume_sku_dimensao) || null,
      share_unidades_sku_dimensao: parseFloat(r.share_unidades_sku_dimensao) || null,
      share_reais_sku_diff_media_dimensao: parseFloat(r.share_reais_sku_diff_media_dimensao) || null,
      share_volume_sku_diff_media_dimensao: parseFloat(r.share_volume_sku_diff_media_dimensao) || null,
      share_unidades_sku_diff_media_dimensao: parseFloat(r.share_unidades_sku_diff_media_dimensao) || null,
      tickets_amostra: parseInt(r.tickets_amostra) || null,
    }));
    await sbFetch('map_pdvs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(chunk) });
    const pct = Math.round((i + chunk.length) / saveable.length * 100);
    onProgress?.(pct);
  }

  return mapId;
}

/**
 * Carrega PDVs de um mapa salvo, em páginas de DB_PAGE_SIZE.
 * @param {string} mapId
 * @param {Function} onProgress - callback(loadedCount)
 * @returns {Array} PDVs
 */
export async function loadMapPDVs(mapId, onProgress) {
  let all = [];
  let offset = 0;

  while (true) {
    const chunk = await sbFetch(
      `map_pdvs?map_id=eq.${mapId}&select=*&limit=${DB_PAGE_SIZE}&offset=${offset}`
    );
    if (!chunk || chunk.length === 0) break;
    all = all.concat(chunk);
    offset += chunk.length;
    onProgress?.(all.length);
    if (chunk.length < DB_PAGE_SIZE) break;
  }

  return all;
}

/**
 * Deleta mapa e seus PDVs (cascade via FK).
 * @param {string} mapId
 */
export async function deleteMap(mapId) {
  await sbFetch(`saved_maps?id=eq.${mapId}`, {
    method: 'DELETE',
    headers: { Prefer: 'return=minimal' },
  });
}

/**
 * Auto-save incrementa PDVs de um Places Discovery expandido.
 * @param {string} mapId - ID do mapa existente
 * @param {Array} newPDVs - Novos PDVs a adicionar
 * @param {Function} onProgress - callback(pctNumber)
 */
export async function autoSaveExpandedPlaces(mapId, newPDVs, onProgress) {
  const saveable = newPDVs.filter(r => r.lat != null && r.lon != null && parseFloat(r.lat) && parseFloat(r.lon));
  if (saveable.length === 0) return;

  for (let i = 0; i < saveable.length; i += DB_CHUNK_SIZE) {
    const chunk = saveable.slice(i, i + DB_CHUNK_SIZE).map(r => ({
      map_id: mapId,
      cnpj: r.cnpj || null, bandeira: r.bandeira || null,
      nome: r.nome || null,
      lat: r.lat, lon: r.lon,
      geo_address: r.geo_address || null,
      place_id: r.place_id || null,
      place_types: r.place_types || null,
      place_status: r.place_status || null,
    }));
    await sbFetch('map_pdvs', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(chunk) });
    const pct = Math.round((i + chunk.length) / saveable.length * 100);
    onProgress?.(pct);
  }

  // Atualizar row_count no mapa
  const current = await sbFetch(`saved_maps?id=eq.${mapId}&select=row_count`);
  const currentCount = current?.[0]?.row_count || 0;
  await sbFetch(`saved_maps?id=eq.${mapId}`, {
    method: 'PATCH',
    body: JSON.stringify({ row_count: currentCount + saveable.length }),
  });
}
