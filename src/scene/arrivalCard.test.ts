import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { SpotArrivalState } from '../route/spotArrival';
import type { ArrivalCardConfig } from '../types';
import { createArrivalCard } from './arrivalCard';

class TestElement {
  readonly children: TestElement[] = [];
  readonly styleWriteCounts = new Map<string, number>();
  readonly style: Record<string, string>;
  parentNode: TestElement | null = null;

  private classNameValue = '';
  private textContentValue: string | null = null;
  classNameWriteCount = 0;
  textContentWriteCount = 0;

  constructor() {
    this.style = new Proxy<Record<string, string>>({}, {
      set: (target, property, value: string) => {
        const name = String(property);
        this.styleWriteCounts.set(
          name,
          (this.styleWriteCounts.get(name) ?? 0) + 1,
        );
        target[name] = value;
        return true;
      },
    });
  }

  get className(): string {
    return this.classNameValue;
  }

  set className(value: string) {
    this.classNameWriteCount += 1;
    this.classNameValue = value;
  }

  get textContent(): string | null {
    return this.textContentValue;
  }

  set textContent(value: string | null) {
    this.textContentWriteCount += 1;
    this.textContentValue = value;
  }

  appendChild(child: TestElement): TestElement {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }

  remove(): void {
    if (this.parentNode === null) return;

    const index = this.parentNode.children.indexOf(this);
    if (index !== -1) this.parentNode.children.splice(index, 1);
    this.parentNode = null;
  }
}

const config: ArrivalCardConfig = {
  enabled: true,
  position: 'bottom-center',
  bottomMarginPx: 48,
  fadeMs: 320,
  slideOffsetPx: 12,
  backgroundColor: 'rgba(15, 15, 15, 0.88)',
  textColor: '#ffffff',
  accentColor: 0xe30613,
};

function createState(
  overrides: Partial<SpotArrivalState> = {},
): SpotArrivalState {
  return {
    poiId: 'kiyotaki',
    tier: 'primary',
    phase: 'idle',
    intensity: 0,
    isActive: false,
    isPrimaryActive: false,
    ...overrides,
  };
}

describe('createArrivalCard', () => {
  const originalDocument = globalThis.document;

  beforeEach(() => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: {
        createElement: () => new TestElement(),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      value: originalDocument,
    });
  });

  function createController() {
    const container = new TestElement();
    const controller = createArrivalCard({
      container: container as unknown as HTMLElement,
      config,
      poiDisplayTextById: new Map([
        ['kiyotaki', '清滝駅'],
        ['summit', '高尾山頂'],
      ]),
    });

    return {
      container,
      controller,
      element: controller.element as unknown as TestElement,
    };
  }

  it('shows the display name for a primary arrive state', () => {
    const { controller, element } = createController();

    controller.update([
      createState({
        phase: 'arrive',
        intensity: 1,
        isActive: true,
        isPrimaryActive: true,
      }),
    ]);

    expect(element.textContent).toBe('清滝駅');
    expect(element.style.opacity).toBe('1');
    expect(element.style.transform).toBe('translateX(-50%) translateY(0)');
  });

  it('stays hidden when all states are idle or not primary', () => {
    const { controller, element } = createController();

    controller.update([
      createState(),
      createState({
        poiId: 'summit',
        phase: 'arrive',
        intensity: 1,
        isActive: true,
      }),
    ]);

    expect(element.style.opacity).toBe('0');
    expect(element.style.transform).toBe(
      'translateX(-50%) translateY(12px)',
    );
  });

  it('stays hidden during the primary approach phase', () => {
    const { controller, element } = createController();

    controller.update([
      createState({
        phase: 'approach',
        intensity: 0.8,
        isActive: true,
        isPrimaryActive: true,
      }),
    ]);

    expect(element.style.opacity).toBe('0');
    expect(element.textContent).toBeNull();
  });

  it('applies the card surface shadow and border', () => {
    const { element } = createController();

    expect(element.style.boxShadow).toBe(
      '0 4px 18px rgba(0, 0, 0, 0.35)',
    );
    expect(element.style.border).toBe(
      '2px solid rgba(255, 184, 77, 0.5)',
    );
    expect(element.style.fontSize).toBe('20px');
  });

  it('uses the state intensity as opacity during depart', () => {
    const { controller, element } = createController();

    controller.update([
      createState({
        phase: 'depart',
        intensity: 0.5,
        isActive: true,
        isPrimaryActive: true,
      }),
    ]);

    expect(element.style.opacity).toBe('0.5');
  });

  it('shows summit with the same state-driven logic as every other POI', () => {
    const { controller, element } = createController();

    controller.update([
      createState({
        poiId: 'summit',
        phase: 'dwell',
        intensity: 1,
        isActive: true,
        isPrimaryActive: true,
      }),
    ]);

    expect(element.textContent).toBe('高尾山頂');
    expect(element.style.opacity).toBe('1');
  });

  it('does not repeat guarded DOM writes for identical states', () => {
    const { controller, element } = createController();
    const states = [
      createState({
        phase: 'arrive',
        intensity: 1,
        isActive: true,
        isPrimaryActive: true,
      }),
    ];

    controller.update(states);
    const classNameWrites = element.classNameWriteCount;
    const textContentWrites = element.textContentWriteCount;
    const transformWrites = element.styleWriteCounts.get('transform');

    controller.update(states);
    controller.update(states);

    expect(element.classNameWriteCount).toBe(classNameWrites);
    expect(element.textContentWriteCount).toBe(textContentWrites);
    expect(element.styleWriteCounts.get('transform')).toBe(transformWrites);
  });

  it('creates one reusable element and removes it on dispose', () => {
    const { container, controller, element } = createController();

    expect(container.children).toEqual([element]);
    controller.update([
      createState({
        phase: 'arrive',
        intensity: 1,
        isActive: true,
        isPrimaryActive: true,
      }),
    ]);
    controller.update([]);
    expect(container.children).toEqual([element]);

    controller.dispose();
    expect(container.children).toEqual([]);
  });
});
