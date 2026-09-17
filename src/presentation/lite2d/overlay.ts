export interface OverlayScreenPoint {
  x: number;
  y: number;
}

export interface OverlayLabel {
  id: string;
  x: number;
  y: number;
  text: string;
}

export type RouteEmphasis = 'subtle' | 'active';

export interface LiteRouteOverlay {
  root: HTMLElement;
  setRoutePoints(points: readonly OverlayScreenPoint[]): void;
  setProgress(progress: number, emphasis: RouteEmphasis): void;
  setLabels(labels: readonly OverlayLabel[]): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

const ACTIVE_COLOR = '#33E6FF';
const HEAD_COLOR = '#E8FCFF';
const BASE_COLOR = '#E6EEF2';
const BASE_OPACITY = '0.28';
const ACTIVE_CORE_OPACITY = '1';
const ACTIVE_GLOW_OPACITY = '0.55';
const SUBTLE_CORE_OPACITY = '0.42';
const SUBTLE_GLOW_OPACITY = '0.16';

let nextFilterId = 0;

function createSvgElement<K extends keyof SVGElementTagNameMap>(
  tagName: K,
): SVGElementTagNameMap[K] {
  return document.createElementNS(SVG_NAMESPACE, tagName);
}

function setSharedPathAttributes(path: SVGPathElement): void {
  path.setAttribute('fill', 'none');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
}

function formatNumber(value: number): string {
  return String(Number(value.toFixed(4)));
}

function buildPathData(points: readonly OverlayScreenPoint[]): string {
  if (points.length === 0) return '';

  return points
    .map(
      (point, index) =>
        `${index === 0 ? 'M' : 'L'} ${formatNumber(point.x)} ${formatNumber(point.y)}`,
    )
    .join(' ');
}

/**
 * Creates a route whose progress is measured by cumulative screen-space path
 * length. The moving head is shown only while 0 < progress < 1.
 */
export function createLiteRouteOverlay(
  container: HTMLElement,
  initialWidth: number,
  initialHeight: number,
): LiteRouteOverlay {
  const root = document.createElement('div');
  root.className = 'lite-route-overlay';
  root.style.position = 'absolute';
  root.style.inset = '0';
  root.style.width = '100%';
  root.style.height = '100%';
  root.style.overflow = 'hidden';
  root.style.pointerEvents = 'none';
  root.setAttribute('aria-hidden', 'true');

  const svg = createSvgElement('svg');
  svg.setAttribute('data-lite-route-role', 'svg');
  // Matches CSS `background-size: cover` on the fixed background image this
  // overlay sits above, so both crop/scale in lockstep on any resize with no
  // JS recalculation needed -- resize() is expected to be called once with
  // the background image's own natural pixel dimensions, not live viewport
  // dimensions.
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  svg.style.position = 'absolute';
  svg.style.inset = '0';
  svg.style.width = '100%';
  svg.style.height = '100%';
  svg.style.pointerEvents = 'none';

  const defs = createSvgElement('defs');
  const glowFilter = createSvgElement('filter');
  const filterId = `lite-route-glow-${nextFilterId++}`;
  glowFilter.setAttribute('id', filterId);
  glowFilter.setAttribute('x', '-50%');
  glowFilter.setAttribute('y', '-50%');
  glowFilter.setAttribute('width', '200%');
  glowFilter.setAttribute('height', '200%');
  glowFilter.setAttribute('color-interpolation-filters', 'sRGB');

  const blur = createSvgElement('feGaussianBlur');
  blur.setAttribute('in', 'SourceGraphic');
  blur.setAttribute('stdDeviation', '3.5');
  blur.setAttribute('result', 'blurred-source');
  glowFilter.appendChild(blur);

  const merge = createSvgElement('feMerge');
  const blurredNode = createSvgElement('feMergeNode');
  blurredNode.setAttribute('in', 'blurred-source');
  merge.appendChild(blurredNode);
  const sourceNode = createSvgElement('feMergeNode');
  sourceNode.setAttribute('in', 'SourceGraphic');
  merge.appendChild(sourceNode);
  glowFilter.appendChild(merge);
  defs.appendChild(glowFilter);
  svg.appendChild(defs);

  const basePath = createSvgElement('path');
  basePath.setAttribute('data-lite-route-role', 'base-path');
  basePath.setAttribute('stroke', BASE_COLOR);
  basePath.setAttribute('stroke-width', '1.5');
  basePath.setAttribute('opacity', BASE_OPACITY);
  setSharedPathAttributes(basePath);
  svg.appendChild(basePath);

  const glowPath = createSvgElement('path');
  glowPath.setAttribute('data-lite-route-role', 'glow-path');
  glowPath.setAttribute('stroke', ACTIVE_COLOR);
  glowPath.setAttribute('stroke-width', '8');
  glowPath.setAttribute('opacity', ACTIVE_GLOW_OPACITY);
  glowPath.setAttribute('filter', `url(#${filterId})`);
  setSharedPathAttributes(glowPath);
  svg.appendChild(glowPath);

  const activePath = createSvgElement('path');
  activePath.setAttribute('data-lite-route-role', 'active-path');
  activePath.setAttribute('stroke', ACTIVE_COLOR);
  activePath.setAttribute('stroke-width', '3.25');
  activePath.setAttribute('opacity', ACTIVE_CORE_OPACITY);
  setSharedPathAttributes(activePath);
  svg.appendChild(activePath);

  const head = createSvgElement('circle');
  head.setAttribute('data-lite-route-role', 'head');
  head.setAttribute('r', '4.5');
  head.setAttribute('fill', HEAD_COLOR);
  head.setAttribute('stroke', ACTIVE_COLOR);
  head.setAttribute('stroke-width', '2');
  head.setAttribute('filter', `url(#${filterId})`);
  head.style.display = 'none';
  svg.appendChild(head);

  // Labels live INSIDE the SVG as a foreignObject, not as a separate sibling
  // div. The route paths above are positioned in the SVG's own viewBox
  // coordinate space and get transformed by `preserveAspectRatio` in
  // lockstep with the background image on every resize automatically; a
  // sibling HTML layer positioned with plain CSS left/top pixel values would
  // NOT receive that same transform and would drift from the route/
  // background as soon as the viewport aspect ratio differs from the
  // image's own aspect ratio. Nesting the label layer in a foreignObject
  // whose own x/y/width/height are kept equal to the viewBox makes it
  // inherit the identical scale/crop as everything else in the SVG.
  const XHTML_NAMESPACE = 'http://www.w3.org/1999/xhtml';
  const labelForeignObject = createSvgElement('foreignObject');
  labelForeignObject.setAttribute('data-lite-route-role', 'labels-fo');
  labelForeignObject.setAttribute('x', '0');
  labelForeignObject.setAttribute('y', '0');
  const labelLayer = document.createElementNS(XHTML_NAMESPACE, 'div') as HTMLDivElement;
  labelLayer.className = 'lite-route-labels';
  labelLayer.setAttribute('data-lite-route-role', 'labels');
  labelLayer.style.position = 'relative';
  labelLayer.style.width = '100%';
  labelLayer.style.height = '100%';
  labelLayer.style.pointerEvents = 'none';
  labelForeignObject.appendChild(labelLayer);
  svg.appendChild(labelForeignObject);

  root.appendChild(svg);
  container.appendChild(root);

  let routePoints: OverlayScreenPoint[] = [];
  let cumulativeLengths: number[] = [];
  let totalLength = 0;
  let currentProgress = 0;
  let currentEmphasis: RouteEmphasis = 'active';

  function updateProgressVisual(): void {
    const drawnLength = totalLength * currentProgress;
    const dashOffset = totalLength - drawnLength;
    const dashArrayValue = `${formatNumber(totalLength)} ${formatNumber(totalLength)}`;
    const dashOffsetValue = formatNumber(dashOffset);

    for (const path of [glowPath, activePath]) {
      path.setAttribute('stroke-dasharray', dashArrayValue);
      path.setAttribute('stroke-dashoffset', dashOffsetValue);
    }

    const isSubtle = currentEmphasis === 'subtle';
    activePath.setAttribute(
      'opacity',
      isSubtle ? SUBTLE_CORE_OPACITY : ACTIVE_CORE_OPACITY,
    );
    glowPath.setAttribute(
      'opacity',
      isSubtle ? SUBTLE_GLOW_OPACITY : ACTIVE_GLOW_OPACITY,
    );
    head.setAttribute('opacity', isSubtle ? '0.55' : '1');

    if (
      totalLength <= 0 ||
      routePoints.length < 2 ||
      currentProgress <= 0 ||
      currentProgress >= 1
    ) {
      head.style.display = 'none';
      return;
    }

    const targetLength = drawnLength;
    for (let index = 1; index < routePoints.length; index += 1) {
      const segmentEnd = cumulativeLengths[index];
      if (targetLength > segmentEnd) continue;

      const segmentStart = cumulativeLengths[index - 1];
      const segmentLength = segmentEnd - segmentStart;
      if (segmentLength <= 0) continue;

      const start = routePoints[index - 1];
      const end = routePoints[index];
      const fraction = (targetLength - segmentStart) / segmentLength;
      head.setAttribute('cx', formatNumber(start.x + (end.x - start.x) * fraction));
      head.setAttribute('cy', formatNumber(start.y + (end.y - start.y) * fraction));
      head.style.display = '';
      return;
    }

    head.style.display = 'none';
  }

  const overlay: LiteRouteOverlay = {
    root,
    setRoutePoints(points): void {
      routePoints = points.map(({ x, y }) => ({ x, y }));
      cumulativeLengths = routePoints.length === 0 ? [] : [0];
      totalLength = 0;

      for (let index = 1; index < routePoints.length; index += 1) {
        const previous = routePoints[index - 1];
        const current = routePoints[index];
        totalLength += Math.hypot(
          current.x - previous.x,
          current.y - previous.y,
        );
        cumulativeLengths.push(totalLength);
      }

      const pathData = buildPathData(routePoints);
      basePath.setAttribute('d', pathData);
      glowPath.setAttribute('d', pathData);
      activePath.setAttribute('d', pathData);
      updateProgressVisual();
    },
    setProgress(progress, emphasis): void {
      currentProgress = Number.isFinite(progress)
        ? Math.min(1, Math.max(0, progress))
        : 0;
      currentEmphasis = emphasis;
      updateProgressVisual();
    },
    setLabels(labels): void {
      const elements = labels.map((label) => {
        const element = document.createElement('div');
        element.className = 'lite-route-label';
        element.setAttribute('data-label-id', label.id);
        element.textContent = label.text;
        element.style.position = 'absolute';
        element.style.left = `${formatNumber(label.x)}px`;
        element.style.top = `${formatNumber(label.y)}px`;
        element.style.transform = 'translate(-50%, calc(-100% - 8px))';
        element.style.pointerEvents = 'none';
        element.style.backgroundColor = 'rgba(7, 14, 20, 0.68)';
        element.style.color = '#f4fbfd';
        element.style.padding = '4px 9px';
        element.style.border = '1px solid rgba(216, 242, 247, 0.58)';
        element.style.borderRadius = '4px';
        element.style.backdropFilter = 'blur(6px)';
        element.style.boxShadow = '0 4px 14px rgba(0, 0, 0, 0.24)';
        element.style.fontFamily =
          'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
        element.style.fontSize = '12px';
        element.style.fontWeight = '600';
        element.style.letterSpacing = '0.04em';
        element.style.lineHeight = '1.35';
        element.style.textShadow = '0 1px 3px rgba(0, 0, 0, 0.8)';
        element.style.whiteSpace = 'nowrap';
        return element;
      });
      labelLayer.replaceChildren(...elements);
    },
    resize(width, height): void {
      svg.setAttribute('width', formatNumber(width));
      svg.setAttribute('height', formatNumber(height));
      svg.setAttribute(
        'viewBox',
        `0 0 ${formatNumber(width)} ${formatNumber(height)}`,
      );
      // Keep the label foreignObject's own box equal to the viewBox so its
      // HTML content is positioned in the exact same coordinate space as
      // the route paths, and therefore receives the identical
      // preserveAspectRatio transform.
      labelForeignObject.setAttribute('width', formatNumber(width));
      labelForeignObject.setAttribute('height', formatNumber(height));
    },
    dispose(): void {
      root.remove();
      routePoints = [];
      cumulativeLengths = [];
      totalLength = 0;
    },
  };

  overlay.resize(initialWidth, initialHeight);
  overlay.setRoutePoints([]);
  return overlay;
}
