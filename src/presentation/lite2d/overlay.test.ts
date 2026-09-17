import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { createLiteRouteOverlay } from './overlay';

/**
 * Minimal fake DOM sufficient for overlay.ts's element creation/attribute/
 * style/child-management usage, since this project's vitest environment is
 * 'node' (no jsdom/happy-dom dependency).
 */
class FakeElement {
  readonly attributes = new Map<string, string>();
  readonly children: FakeElement[] = [];
  readonly style: Record<string, string> = {};
  parentElement: FakeElement | null = null;
  className = '';
  textContent = '';

  constructor(
    readonly tagName: string,
    readonly namespaceURI: string | null = null,
  ) {}

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.has(name) ? this.attributes.get(name)! : null;
  }

  appendChild<T extends FakeElement>(child: T): T {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  replaceChildren(...nodes: FakeElement[]): void {
    for (const child of this.children) {
      child.parentElement = null;
    }
    this.children.length = 0;
    for (const node of nodes) {
      this.appendChild(node);
    }
  }

  remove(): void {
    if (this.parentElement) {
      const index = this.parentElement.children.indexOf(this);
      if (index >= 0) this.parentElement.children.splice(index, 1);
      this.parentElement = null;
    }
  }

  querySelector(selector: string): FakeElement | null {
    const match = (el: FakeElement): boolean => {
      const roleMatch = selector.match(/\[data-lite-route-role="([^"]+)"\]/);
      if (roleMatch) {
        return el.getAttribute('data-lite-route-role') === roleMatch[1];
      }
      return false;
    };
    for (const child of this.children) {
      if (match(child)) return child;
      const nested = child.querySelector(selector);
      if (nested) return nested;
    }
    return null;
  }
}

describe('createLiteRouteOverlay', () => {
  const originalDocument = (globalThis as { document?: unknown }).document;

  beforeEach(() => {
    (globalThis as { document?: unknown }).document = {
      createElement: (tagName: string) => new FakeElement(tagName),
      createElementNS: (ns: string, tagName: string) =>
        new FakeElement(tagName, ns),
    };
  });

  afterEach(() => {
    (globalThis as { document?: unknown }).document = originalDocument;
  });

  function setup() {
    const container = new FakeElement('div') as unknown as HTMLElement;
    const overlay = createLiteRouteOverlay(container, 1920, 1080);
    return { container, overlay };
  }

  it('mounts an SVG-bearing root into the container and sizes it', () => {
    const { container, overlay } = setup();

    expect((container as unknown as FakeElement).children).toContain(
      overlay.root as unknown as FakeElement,
    );
    const svg = (overlay.root as unknown as FakeElement).querySelector(
      '[data-lite-route-role="svg"]',
    );
    expect(svg?.getAttribute('width')).toBe('1920');
    expect(svg?.getAttribute('height')).toBe('1080');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 1920 1080');
    // Matches CSS background-size:cover on the fixed background image below.
    expect(svg?.getAttribute('preserveAspectRatio')).toBe('xMidYMid slice');
  });

  it('draws the base/glow/active paths and hides the head at progress 0', () => {
    const { overlay } = setup();
    overlay.setRoutePoints([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
      { x: 100, y: 100 },
    ]);

    const root = overlay.root as unknown as FakeElement;
    const activePath = root.querySelector('[data-lite-route-role="active-path"]');
    const head = root.querySelector('[data-lite-route-role="head"]');

    expect(activePath?.getAttribute('d')).toBe('M 0 0 L 100 0 L 100 100');
    expect(head?.style.display).toBe('none');
  });

  it('reveals a portion of the route and positions the head as progress advances', () => {
    const { overlay } = setup();
    overlay.setRoutePoints([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    overlay.setProgress(0.5, 'active');

    const root = overlay.root as unknown as FakeElement;
    const activePath = root.querySelector('[data-lite-route-role="active-path"]');
    const head = root.querySelector('[data-lite-route-role="head"]');

    expect(activePath?.getAttribute('stroke-dashoffset')).toBe('50');
    expect(head?.style.display).toBe('');
    expect(head?.getAttribute('cx')).toBe('50');
    expect(head?.getAttribute('cy')).toBe('0');
  });

  it('fully reveals the route and hides the head at progress 1', () => {
    const { overlay } = setup();
    overlay.setRoutePoints([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    overlay.setProgress(1, 'active');

    const root = overlay.root as unknown as FakeElement;
    const activePath = root.querySelector('[data-lite-route-role="active-path"]');
    const head = root.querySelector('[data-lite-route-role="head"]');

    expect(activePath?.getAttribute('stroke-dashoffset')).toBe('0');
    expect(head?.style.display).toBe('none');
  });

  it('dims the active/glow opacity under subtle emphasis', () => {
    const { overlay } = setup();
    overlay.setRoutePoints([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);

    overlay.setProgress(1, 'subtle');
    const root = overlay.root as unknown as FakeElement;
    const activePath = root.querySelector('[data-lite-route-role="active-path"]');
    expect(activePath?.getAttribute('opacity')).toBe('0.42');

    overlay.setProgress(1, 'active');
    expect(activePath?.getAttribute('opacity')).toBe('1');
  });

  it('creates one label element per entry with the given text', () => {
    const { overlay } = setup();
    overlay.setLabels([
      { id: 'a', x: 10, y: 20, text: '清滝駅' },
      { id: 'b', x: 30, y: 40, text: '高尾山頂' },
    ]);

    const root = overlay.root as unknown as FakeElement;
    const labelLayer = root.querySelector('[data-lite-route-role="labels"]');
    expect(labelLayer?.children).toHaveLength(2);
    expect(labelLayer?.children.map((el) => el.textContent)).toEqual([
      '清滝駅',
      '高尾山頂',
    ]);
  });

  it('updates the SVG size/viewBox on resize', () => {
    const { overlay } = setup();
    overlay.resize(800, 600);

    const root = overlay.root as unknown as FakeElement;
    const svg = root.querySelector('[data-lite-route-role="svg"]');
    expect(svg?.getAttribute('width')).toBe('800');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 800 600');
  });

  it('removes the root from its container on dispose', () => {
    const { container, overlay } = setup();
    overlay.dispose();

    expect((container as unknown as FakeElement).children).not.toContain(
      overlay.root as unknown as FakeElement,
    );
  });

  it('does not throw with an empty route or empty labels', () => {
    const { overlay } = setup();
    expect(() => overlay.setRoutePoints([])).not.toThrow();
    expect(() => overlay.setLabels([])).not.toThrow();
    expect(() => overlay.setProgress(0.5, 'active')).not.toThrow();
  });
});
