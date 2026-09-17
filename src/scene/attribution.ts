export const ATTRIBUTION_TEXT =
  '地形データ: 地理院タイル(標高タイル(基盤地図情報数値標高モデル))を加工して作成 - 国土地理院';
export const ATTRIBUTION_HREF =
  'https://www.gsi.go.jp/kikakuchousei/kikakuchousei40182.html';
export const AERIAL_ATTRIBUTION_TEXT = '地理院タイル（写真）を加工して作成';
export const AERIAL_ATTRIBUTION_HREF =
  'https://maps.gsi.go.jp/development/ichiran.html';
export const OSM_ATTRIBUTION_TEXT = '© OpenStreetMap contributors';
export const OSM_ATTRIBUTION_HREF =
  'https://www.openstreetmap.org/copyright';

export function mountAttributionOverlay(root: HTMLElement): HTMLAnchorElement {
  const overlay = document.createElement('div');
  const attribution = document.createElement('a');
  const aerialAttribution = document.createElement('a');
  const osmAttribution = document.createElement('a');

  attribution.href = ATTRIBUTION_HREF;
  attribution.textContent = ATTRIBUTION_TEXT;
  attribution.target = '_blank';
  attribution.rel = 'noopener noreferrer';
  attribution.style.color = 'rgba(255,255,255,0.85)';
  attribution.style.textDecoration = 'none';

  aerialAttribution.href = AERIAL_ATTRIBUTION_HREF;
  aerialAttribution.textContent = AERIAL_ATTRIBUTION_TEXT;
  aerialAttribution.target = '_blank';
  aerialAttribution.rel = 'noopener noreferrer';
  aerialAttribution.style.display = 'block';
  aerialAttribution.style.color = 'rgba(255,255,255,0.85)';
  aerialAttribution.style.textDecoration = 'none';

  osmAttribution.href = OSM_ATTRIBUTION_HREF;
  osmAttribution.textContent = OSM_ATTRIBUTION_TEXT;
  osmAttribution.target = '_blank';
  osmAttribution.rel = 'noopener noreferrer';
  osmAttribution.style.display = 'block';
  osmAttribution.style.color = 'rgba(255,255,255,0.85)';
  osmAttribution.style.textDecoration = 'none';

  overlay.style.position = 'fixed';
  overlay.style.right = '8px';
  overlay.style.bottom = '8px';
  overlay.style.zIndex = '20';
  overlay.style.fontSize = '11px';
  overlay.style.background = 'rgba(0,0,0,0.45)';
  overlay.style.padding = '2px 6px';
  overlay.style.borderRadius = '3px';
  overlay.style.fontFamily = 'sans-serif';
  overlay.style.pointerEvents = 'auto';
  overlay.style.whiteSpace = 'nowrap';

  overlay.append(attribution, aerialAttribution, osmAttribution);
  root.appendChild(overlay);
  return attribution;
}
