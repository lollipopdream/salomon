export type HotPathBlockName =
  | 'route-progress'
  | 'camera-update'
  | 'route-line-update'
  | 'route-head-marker'
  | 'label-occlusion'
  | 'spot-arrival'
  | 'arrival-card'
  | 'renderer-render';

export interface HotPathMeasureSummary {
  count: number;
  totalMs: number;
  avgMs: number;
  maxMs: number;
}

export interface HotPathProfiler {
  begin(block: HotPathBlockName): void;
  end(block: HotPathBlockName): void;
  getSummary(): Record<HotPathBlockName, HotPathMeasureSummary>;
  reset(): void;
}

const HOT_PATH_BLOCK_NAMES: HotPathBlockName[] = [
  'route-progress',
  'camera-update',
  'route-line-update',
  'route-head-marker',
  'label-occlusion',
  'spot-arrival',
  'arrival-card',
  'renderer-render',
];

function createEmptySummary(): HotPathMeasureSummary {
  return {
    count: 0,
    totalMs: 0,
    avgMs: 0,
    maxMs: 0,
  };
}

export function summarizeMeasuresByBlock(
  entries: Array<{ name: string; duration: number }>,
  blockNames: HotPathBlockName[],
): Record<HotPathBlockName, HotPathMeasureSummary> {
  const summary = Object.fromEntries(
    blockNames.map((block) => [block, createEmptySummary()]),
  ) as Record<HotPathBlockName, HotPathMeasureSummary>;

  entries.forEach((entry) => {
    const block = blockNames.find((blockName) => entry.name === `hp:${blockName}`);
    if (block === undefined) {
      return;
    }

    const blockSummary = summary[block];
    blockSummary.count += 1;
    blockSummary.totalMs += entry.duration;
    blockSummary.maxMs = Math.max(blockSummary.maxMs, entry.duration);
  });

  blockNames.forEach((block) => {
    const blockSummary = summary[block];
    blockSummary.avgMs = blockSummary.count > 0
      ? blockSummary.totalMs / blockSummary.count
      : 0;
  });

  return summary;
}

export function createHotPathProfiler(
  markFn: (name: string) => void,
  measureFn: (name: string, startMark: string, endMark: string) => void,
  getEntriesFn: () => Array<{ name: string; duration: number }>,
): HotPathProfiler {
  let resetEntryOffset = 0;

  return {
    begin(block) {
      markFn(`hp:${block}:start`);
    },

    end(block) {
      const measureName = `hp:${block}`;
      markFn(`${measureName}:end`);
      measureFn(measureName, `${measureName}:start`, `${measureName}:end`);
    },

    getSummary() {
      const entries = getEntriesFn();
      return summarizeMeasuresByBlock(entries.slice(resetEntryOffset), HOT_PATH_BLOCK_NAMES);
    },

    reset() {
      resetEntryOffset = getEntriesFn().length;
    },
  };
}
