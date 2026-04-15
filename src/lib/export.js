// ─── Export ─────────────────────────────────────────────────────────────────
// Download de CSV geocodificado.

/** Gera e baixa CSV dos dados geocodificados */
export function downloadGeocoderCSV(data, mapType) {
  if (!data.length) { alert('Nenhum dado para exportar.'); return; }

  const { cols, labels } = getColumnsForType(mapType);
  const esc = v => v == null ? '' : `"${String(v).replace(/"/g, '""')}"`;

  const rows = [
    labels.join(','),
    ...data.map(r => cols.map(c => {
      if (c === '_status') {
        return esc(
          r._geocodeFailed ? 'Não identificado'
            : r._ufMismatch ? `UF Mismatch (${r._expectedUF}→${r.uf || '?'})`
              : 'OK'
        );
      }
      if (c === '_input') {
        return esc(r.endereco_geocode || r._endereco_livre || r.endereco || r['endereço'] || r.address || '');
      }
      return esc(r[c]);
    }).join(',')),
  ];

  const blob = new Blob([rows.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: `geocodify_${mapType}_${Date.now()}.csv`,
  });
  a.click();
  URL.revokeObjectURL(url);
}

function getColumnsForType(mapType) {
  switch (mapType) {
    case 'geocoder':
      return {
        cols: ['_input', 'lat', 'lon', 'geo_address', 'uf', 'cep', '_status'],
        labels: ['Endereco_Original', 'Latitude', 'Longitude', 'Endereco_Geocodificado', 'UF', 'CEP', 'Status'],
      };
    case 'reverse_geocoder':
      return {
        cols: ['nome', 'input_lat', 'input_lon', 'geo_address', 'uf', 'cep', '_status'],
        labels: ['Nome', 'Lat_Input', 'Lon_Input', 'Endereco', 'UF', 'CEP', 'Status'],
      };
    case 'places_discovery':
      return {
        cols: ['nome', 'geo_address', 'lat', 'lon', 'place_id', 'place_types', 'place_status'],
        labels: ['Nome', 'Endereco', 'Latitude', 'Longitude', 'Google_Place_ID', 'Tipos', 'Status'],
      };
    default:
      return {
        cols: ['bandeira', 'cnpj', 'lat', 'lon', 'geo_address', 'uf', 'nome_fantasia', 'razao_social', 'cep'],
        labels: ['Bandeira', 'CNPJ', 'Latitude', 'Longitude', 'Endereco', 'UF', 'Nome_Fantasia', 'Razao_Social', 'CEP'],
      };
  }
}
