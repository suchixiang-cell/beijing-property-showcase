import { createTiandituStyle, TIANDITU_ATTRIBUTION, TIANDITU_MAX_ZOOM, TIANDITU_MIN_ZOOM } from './tianditu.js';

const BEIJING_CENTER = [116.4074, 39.9042];

export const LOCAL_PLACEHOLDER_STYLE = {
  version: 8,
  sources: {},
  layers: [{ id: 'background', type: 'background', paint: { 'background-color': '#e8edf0' } }],
};

export function getBasemapConfig(env = {}) {
  const style = createTiandituStyle(env.VITE_TIANDITU_KEY);
  return {
    style: style ?? LOCAL_PLACEHOLDER_STYLE,
    hasConfiguredBasemap: Boolean(style),
    attribution: style ? TIANDITU_ATTRIBUTION : '',
    center: BEIJING_CENTER,
    zoom: 9.6,
    minZoom: TIANDITU_MIN_ZOOM,
    maxZoom: TIANDITU_MAX_ZOOM,
  };
}

export function attachBasemapStatus(map, configured, onStatus) {
  let stopped = false;
  onStatus(configured ? 'loading' : 'missing-key');
  // 远程错误可能含浏览器 Key，因此不记录原始错误或 URL
  map.on('error', () => {
    if (stopped) return;
    stopped = true;
    onStatus('failed');
    if (configured) queueMicrotask(() => map.setStyle(LOCAL_PLACEHOLDER_STYLE));
  });
  map.on('idle', () => {
    if (configured && !stopped) onStatus('ready');
  });
}
