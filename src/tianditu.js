export const TIANDITU_HOST = 'https://t4.tianditu.gov.cn';
export const TIANDITU_MIN_ZOOM = 2;
export const TIANDITU_MAX_ZOOM = 18;
export const TIANDITU_ATTRIBUTION =
  '引自天地图 · <a href="https://www.tianditu.gov.cn/" target="_blank" rel="noopener noreferrer">www.tianditu.gov.cn</a>';

function normalizeKey(value) {
  const key = typeof value === 'string' ? value.trim() : '';
  return key === 'YOUR_TIANDITU_KEY' ? '' : key;
}

export function createTiandituStyle(value) {
  const key = normalizeKey(value);
  if (!key) return null;

  function source(layer) {
    return {
      type: 'raster',
      tiles: [
        `${TIANDITU_HOST}/${layer}_w/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&tk=${encodeURIComponent(key)}`,
      ],
      tileSize: 256,
      minzoom: TIANDITU_MIN_ZOOM,
      maxzoom: TIANDITU_MAX_ZOOM,
      attribution: TIANDITU_ATTRIBUTION,
    };
  }

  return {
    version: 8,
    sources: { 'tianditu-vec': source('vec'), 'tianditu-cva': source('cva') },
    layers: [
      { id: 'tianditu-vec', type: 'raster', source: 'tianditu-vec' },
      { id: 'tianditu-cva', type: 'raster', source: 'tianditu-cva' },
    ],
  };
}
