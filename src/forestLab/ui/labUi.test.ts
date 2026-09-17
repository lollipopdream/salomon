import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLabUi } from './labUi';

class FakeStyle {
  display = '';
  margin = '';
  opacity = '';
  private values = new Map<string, string>();

  get cssText(): string {
    return [...this.values.entries()].map(([key, value]) => `${key}: ${value};`).join(' ')
      + ` display: ${this.display}; margin: ${this.margin}; opacity: ${this.opacity};`;
  }

  setProperty(key: string, value: string): void {
    this.values.set(key, value);
  }
}

class FakeElement {
  children: FakeElement[] = [];
  style = new FakeStyle();
  dataset: Record<string, string> = {};
  textContent = '';
  type = '';
  removed = false;
  listeners = new Map<string, EventListener[]>();

  appendChild(child: FakeElement): FakeElement {
    this.children.push(child);
    return child;
  }

  addEventListener(type: string, listener: EventListener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  remove(): void {
    this.removed = true;
  }
}

describe('lab UI', () => {
  const windowListeners = new Map<string, EventListener>();

  beforeEach(() => {
    vi.stubGlobal('document', {
      createElement: () => new FakeElement(),
    });
    vi.stubGlobal('window', {
      addEventListener: (type: string, listener: EventListener) => windowListeners.set(type, listener),
      removeEventListener: (type: string) => windowListeners.delete(type),
    });
  });

  afterEach(() => {
    windowListeners.clear();
    vi.unstubAllGlobals();
  });

  it('omits PATCH B and never creates motion CSS', () => {
    const container = new FakeElement();
    const ui = createLabUi({
      container: container as unknown as HTMLElement,
      onCandidate: vi.fn(),
      onCamera: vi.fn(),
      onPatch: vi.fn(),
      onReset: vi.fn(),
      patches: ['A'],
    });
    const labels = (ui.element as unknown as FakeElement).children.map((child) => child.textContent);
    expect(labels).toContain('PATCH A');
    expect(labels).not.toContain('PATCH B');
    const css = [ui.element, ...(ui.element.children as unknown as HTMLElement[])]
      .map((entry) => entry.style.cssText)
      .join(' ')
      .toLowerCase();
    expect(css).not.toContain('transition');
    expect(css).not.toContain('animation');
  });

  it('hides with display and does not touch opacity', () => {
    const ui = createLabUi({
      container: new FakeElement() as unknown as HTMLElement,
      onCandidate: vi.fn(),
      onCamera: vi.fn(),
      onPatch: vi.fn(),
      onReset: vi.fn(),
      patches: ['A'],
    });
    ui.hide();
    expect(ui.element.style.display).toBe('none');
    expect(ui.element.style.opacity).toBe('');
    ui.show();
    expect(ui.element.style.display).toBe('');
  });

  it('exposes exactly the six candidate buttons in order, with LEGACY only on 1/2/3', () => {
    const ui = createLabUi({
      container: new FakeElement() as unknown as HTMLElement,
      onCandidate: vi.fn(),
      onCamera: vi.fn(),
      onPatch: vi.fn(),
      onReset: vi.fn(),
      patches: ['A'],
    });
    const buttonLabels = (ui.element as unknown as FakeElement).children
      .filter((child) => child.type === 'button')
      .map((child) => child.textContent);
    const candidateLabels = buttonLabels.slice(0, 6);
    expect(candidateLabels).toEqual([
      '0 CONTROL',
      '4 CLUSTER_ONLY',
      '5 HIERARCHICAL_FOREST',
      '1 SHELL_BASE (LEGACY)',
      '2 SHELL_CROWN_FIELD (LEGACY)',
      '3 HYBRID (LEGACY)',
    ]);
    for (const label of ['0 CONTROL', '4 CLUSTER_ONLY', '5 HIERARCHICAL_FOREST']) {
      expect(label).not.toContain('LEGACY');
    }
    for (const label of ['1 SHELL_BASE (LEGACY)', '2 SHELL_CROWN_FIELD (LEGACY)', '3 HYBRID (LEGACY)']) {
      expect(label).toContain('LEGACY');
    }
  });

  it('accepts keys 4 and 5 as candidate switches, but not 6', () => {
    const onCandidate = vi.fn();
    createLabUi({
      container: new FakeElement() as unknown as HTMLElement,
      onCandidate,
      onCamera: vi.fn(),
      onPatch: vi.fn(),
      onReset: vi.fn(),
      patches: ['A'],
    });
    const keydown = windowListeners.get('keydown')!;
    keydown({ key: '4', repeat: false } as KeyboardEvent);
    keydown({ key: '5', repeat: false } as KeyboardEvent);
    keydown({ key: '6', repeat: false } as KeyboardEvent);
    expect(onCandidate).toHaveBeenCalledWith(4);
    expect(onCandidate).toHaveBeenCalledWith(5);
    expect(onCandidate).not.toHaveBeenCalledWith(6);
    expect(onCandidate).toHaveBeenCalledTimes(2);
  });

  it('appends cluster status lines only when the values are supplied', () => {
    const ui = createLabUi({
      container: new FakeElement() as unknown as HTMLElement,
      onCandidate: vi.fn(),
      onCamera: vi.fn(),
      onPatch: vi.fn(),
      onReset: vi.fn(),
      patches: ['A'],
    });
    ui.setStatus({
      candidate: 0,
      camera: 'PRIMARY',
      patch: 'A',
      shellTriangleCount: 1,
      detailCount: 2,
      buildMs: 3,
    });
    const statusElement = (ui.element as unknown as FakeElement).children.find(
      (child) => child.dataset.forestLabStatus === 'true',
    )!;
    expect(statusElement.textContent).not.toContain('cluster count');
    expect(statusElement.textContent).not.toContain('member count');
    expect(statusElement.textContent).not.toContain('visible instances');

    ui.setStatus({
      candidate: 4,
      camera: 'PRIMARY',
      patch: 'A',
      shellTriangleCount: 1,
      detailCount: 2,
      buildMs: 3,
      clusterCount: 10,
      memberCount: 20,
      visibleInstanceCount: 30,
    });
    expect(statusElement.textContent).toContain('cluster count: 10');
    expect(statusElement.textContent).toContain('member count: 20');
    expect(statusElement.textContent).toContain('visible instances: 30');
  });
});
