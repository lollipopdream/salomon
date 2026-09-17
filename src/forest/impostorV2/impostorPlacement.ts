import type {
  ForestImpostorV2Config,
  ForestImpostorV2Flags,
  ForestMaskV2Data,
  ImpostorCellRef,
  ImpostorPlacementResult,
  MacroForestField,
} from './types';
import { createSeededRandom, hashIndexTo01 } from '../forestRandom';
import { sampleTerrainSlopeRadians } from '../terrainHeightSampler';
import { isFootprintInsideMask } from './forestMaskV2';
import {
  R10_COMPOSITION_FIELD,
  computeSpeciesField,
  selectSpeciesGroupKey,
} from './r10CompositionPreset';

interface PlacedPrimitive {
  globalIndex: number;
  kind: 'grove' | 'tree';
  x: number;
  y: number;
  z: number;
  yawRadians: number;
  widthMeters: number;
  heightMeters: number;
  mirrored: number;
  cellSlot: number;
}

interface GridPoint {
  x: number;
  z: number;
}

class ProximityGrid {
  private readonly buckets = new Map<string, GridPoint[]>();

  constructor(private readonly bucketMeters: number) {}

  add(x: number, z: number): void {
    const key = this.key(Math.floor(x / this.bucketMeters), Math.floor(z / this.bucketMeters));
    const bucket = this.buckets.get(key);
    if (bucket) bucket.push({ x, z });
    else this.buckets.set(key, [{ x, z }]);
  }

  hasWithin(x: number, z: number, distanceMeters: number): boolean {
    const bucketX = Math.floor(x / this.bucketMeters);
    const bucketZ = Math.floor(z / this.bucketMeters);
    const distanceSquared = distanceMeters * distanceMeters;
    for (let dz = -1; dz <= 1; dz += 1) {
      for (let dx = -1; dx <= 1; dx += 1) {
        const bucket = this.buckets.get(this.key(bucketX + dx, bucketZ + dz));
        if (!bucket) continue;
        for (const point of bucket) {
          const offsetX = point.x - x;
          const offsetZ = point.z - z;
          if (offsetX * offsetX + offsetZ * offsetZ < distanceSquared) return true;
        }
      }
    }
    return false;
  }

  private key(x: number, z: number): string {
    return `${x}:${z}`;
  }
}

function hash32(a: number, b: number): number {
  return (Math.imul(a | 0, 73856093) ^ Math.imul(b | 0, 19349663)) >>> 0;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function lerp(from: number, to: number, unit: number): number {
  return from + (to - from) * unit;
}

function emptyResult(elapsedMs: number): ImpostorPlacementResult {
  return {
    count: 0,
    positions: new Float32Array(),
    yawRadians: new Float32Array(),
    widthMeters: new Float32Array(),
    heightMeters: new Float32Array(),
    mirrored: new Uint8Array(),
    cellSlots: new Uint16Array(),
    stats: {
      groveCount: 0,
      treeCount: 0,
      attempted: 0,
      accepted: 0,
      kept: 0,
      thinned: false,
      rejectedByMask: 0,
      rejectedByRoute: 0,
      rejectedBySpacing: 0,
      perCellCounts: {},
      elapsedMs,
    },
  };
}

function treeSpacing(
  cell: MacroForestField['cells'][number],
  config: ForestImpostorV2Config,
  densityScale: number,
): number {
  return config.tree.spacingMeters
    * (1 + config.grove.patchSpacingBoost * (1 - cell.patch))
    / Math.sqrt(Math.max(cell.slopeDensity, 0.25))
    / Math.sqrt(Math.max(densityScale, 1e-6));
}

function isTreeDomain(
  cell: MacroForestField['cells'][number],
  config: ForestImpostorV2Config,
): boolean {
  if (!cell.accepted || cell.band === 'none') return false;
  const threshold = config.macro.patchThreshold[cell.band];
  return cell.routeDistanceMeters <= config.tree.nearRouteMeters
    || Math.abs(cell.patch - threshold) < config.tree.patchEdgeBand
    || cell.ridgeScore >= config.tree.ridgeScoreMin;
}

function selectTreeVariant(
  unit: number,
  nearRoute: boolean,
  config: ForestImpostorV2Config,
): string | undefined {
  const configured = config.tree.variantWeights;
  const ordered = [
    ...['FIR_A', 'FIR_C', 'BL'].filter((variant) => variant in configured),
    ...Object.keys(configured).filter((variant) => variant !== 'FIR_A' && variant !== 'FIR_C' && variant !== 'BL'),
  ];
  if (ordered.length === 0) return undefined;

  const weights = ordered.map((variant) => Math.max(0, configured[variant] ?? 0));
  if (nearRoute && 'BL' in configured) {
    const broadleafIndex = ordered.indexOf('BL');
    const coniferTotal = Math.max(0, configured.FIR_A ?? 0) + Math.max(0, configured.FIR_C ?? 0);
    for (let index = 0; index < ordered.length; index += 1) weights[index] = 0;
    weights[broadleafIndex] = clamp01(config.tree.nearRouteBroadleafFraction);
    const remaining = 1 - weights[broadleafIndex];
    if (coniferTotal > 0) {
      const firstIndex = ordered.indexOf('FIR_A');
      const secondIndex = ordered.indexOf('FIR_C');
      if (firstIndex >= 0) weights[firstIndex] = remaining * Math.max(0, configured.FIR_A ?? 0) / coniferTotal;
      if (secondIndex >= 0) weights[secondIndex] = remaining * Math.max(0, configured.FIR_C ?? 0) / coniferTotal;
    }
  }

  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (total <= 0) return undefined;
  const target = unit * total;
  let cumulative = 0;
  for (let index = 0; index < ordered.length; index += 1) {
    cumulative += weights[index];
    if (target < cumulative || index === ordered.length - 1) return ordered[index];
  }
  return ordered[ordered.length - 1];
}

export function createImpostorPlacement(args: {
  field: MacroForestField;
  cells: readonly ImpostorCellRef[];
  mask: ForestMaskV2Data;
  sampleHeight: (x: number, z: number) => number;
  routeExclusionDistance: (x: number, z: number) => number;
  config: ForestImpostorV2Config;
  flags: ForestImpostorV2Flags;
  now?: () => number;
}): ImpostorPlacementResult {
  const clock = args.now ?? Date.now;
  const startedAt = clock();
  if (!args.flags.enabled) return emptyResult(clock() - startedAt);

  const orderedCells = [...args.field.cells].sort((left, right) => left.index - right.index);
  const groveLookup = new Map<string, number>();
  const treeLookup = new Map<string, number>();
  for (let index = 0; index < args.cells.length; index += 1) {
    const cell = args.cells[index];
    if (cell.kind === 'grove' && cell.groveConfig !== null) {
      groveLookup.set(`${cell.groveConfig}:${cell.yawDeg}`, index);
    } else if (cell.kind === 'tree' && cell.sourceVariant !== null) {
      treeLookup.set(`${cell.sourceVariant}:${cell.yawDeg}`, index);
    }
  }

  const maximumGroveSpacing = orderedCells.reduce(
    (maximum, cell) => cell.accepted
      ? Math.max(maximum, cell.spacingMeters * args.config.grove.minSpacingRatio)
      : maximum,
    args.config.tree.groveClearanceMeters,
  );
  const treeDomainCells = orderedCells.filter((cell) => isTreeDomain(cell, args.config));
  const maximumTreeSpacing = treeDomainCells.reduce(
    (maximum, cell) => Math.max(
      maximum,
      treeSpacing(cell, args.config, args.flags.densityScale) * args.config.tree.minSpacingRatio,
    ),
    1,
  );
  const groveGrid = new ProximityGrid(Math.max(maximumGroveSpacing, 1e-6));
  const treeGrid = new ProximityGrid(Math.max(maximumTreeSpacing, 1e-6));
  const primitives: PlacedPrimitive[] = [];
  let groveCount = 0;
  let treeCount = 0;
  let attempted = 0;
  let rejectedByMask = 0;
  let rejectedByRoute = 0;
  let rejectedBySpacing = 0;
  const cellMeters = args.field.cellMeters;
  const yawSlots = [0, 90, 180, 270] as const;
  // preview-only cap override(`r10dense=1` 経由)。未指定なら production default のまま。
  const maxGrovePrimitives = Math.max(
    0,
    Math.floor(args.flags.maxGrovePrimitivesOverride ?? args.config.limits.maxGrovePrimitives),
  );
  const maxTreePrimitives = Math.max(
    0,
    Math.floor(args.flags.maxTreePrimitivesOverride ?? args.config.limits.maxTreePrimitives),
  );

  if (args.flags.kinds !== 'tree' && maxGrovePrimitives > 0) {
    grovePass: for (const fieldCell of orderedCells) {
      if (!fieldCell.accepted) continue;
      const random = createSeededRandom(
        (args.config.macro.seed ^ hash32(fieldCell.cellX, fieldCell.cellZ)) >>> 0,
      );
      const target = Math.max(1, Math.round(
        cellMeters * cellMeters / (fieldCell.spacingMeters * fieldCell.spacingMeters),
      ));
      const minSpacing = fieldCell.spacingMeters * args.config.grove.minSpacingRatio;
      const legacyGroup = args.flags.r10Broad === true
        ? undefined
        : (() => {
            const groupUnit = hashIndexTo01(
              fieldCell.index,
              (args.config.macro.seed ^ 0x2545f491) >>> 0,
            );
            return groupUnit < args.config.grove.speciesGroupSplit.conifer
              ? args.config.grove.speciesGroups.conifer
              : groupUnit < args.config.grove.speciesGroupSplit.mixed
                ? args.config.grove.speciesGroups.mixed
                : args.config.grove.speciesGroups.broadleaf;
          })();

      for (let targetIndex = 0; targetIndex < target; targetIndex += 1) {
        for (let attempt = 0; attempt < args.config.grove.dartAttemptsPerTarget; attempt += 1) {
          attempted += 1;
          const ux = random();
          const uz = random();
          const uScale = random();
          const uYaw = random();
          const uMirror = random();
          const uCell = random();
          const uYawSlot = random();
          const uSpare = random();

          const x = fieldCell.cellX * cellMeters + ux * cellMeters;
          const z = fieldCell.cellZ * cellMeters + uz * cellMeters;
          const group = legacyGroup ?? args.config.grove.speciesGroups[selectSpeciesGroupKey(
            computeSpeciesField(x, z, args.config.macro.seed, R10_COMPOSITION_FIELD),
            uSpare,
            R10_COMPOSITION_FIELD,
          )];
          if (group.length === 0) continue;
          const groveConfig = group[Math.min(group.length - 1, Math.floor(uCell * group.length))];
          const yawSlot = yawSlots[Math.min(3, Math.floor(uYawSlot * 4))];
          const cellSlot = groveLookup.get(`${groveConfig}:${yawSlot}`);
          if (cellSlot === undefined) continue;

          const slopeRad = sampleTerrainSlopeRadians(
            args.sampleHeight,
            x,
            z,
            args.config.macro.slopeStepMeters,
          );
          const slopeDeg = slopeRad * 180 / Math.PI;
          const scale = lerp(args.config.grove.scaleMin, args.config.grove.scaleMax, uScale)
            * (1 - args.config.grove.ridgeScalePenalty * fieldCell.ridgeScore)
            * (1 - args.config.grove.slopeScalePenalty * clamp01((slopeDeg - 20) / 30));
          const cellRef = args.cells[cellSlot];
          const widthMeters = cellRef.tightWorldWidth * scale;
          const heightMeters = cellRef.tightWorldHeight * scale;

          if (!isFootprintInsideMask(
            args.mask,
            x,
            z,
            0.35 * widthMeters,
            args.config.macro.minCoverage,
            args.config.macro.minCoverageEdge,
          )) {
            rejectedByMask += 1;
            continue;
          }
          if (args.routeExclusionDistance(x, z) < args.config.corridor.routeClearanceMeters
            + (widthMeters / 2) * args.config.corridor.clearanceFootprintFactor) {
            rejectedByRoute += 1;
            continue;
          }
          if (groveGrid.hasWithin(x, z, minSpacing)) {
            rejectedBySpacing += 1;
            continue;
          }

          const sink = args.config.grove.sinkBaseMeters
            + (widthMeters * 0.5) * Math.tan(slopeRad) * args.config.grove.slopeSinkFactor;
          primitives.push({
            globalIndex: primitives.length,
            kind: 'grove',
            x,
            y: args.sampleHeight(x, z) - sink,
            z,
            yawRadians: uYaw * Math.PI * 2,
            widthMeters,
            heightMeters,
            mirrored: uMirror < 0.5 ? 1 : 0,
            cellSlot,
          });
          groveGrid.add(x, z);
          groveCount += 1;
          if (groveCount >= maxGrovePrimitives) break grovePass;
          break;
        }
      }
    }
  }

  if (args.flags.kinds !== 'grove'
    && args.config.tree.enabled
    && maxTreePrimitives > 0) {
    treePass: for (const fieldCell of treeDomainCells) {
      const spacing = treeSpacing(fieldCell, args.config, args.flags.densityScale);
      const minSpacing = spacing * args.config.tree.minSpacingRatio;
      const target = Math.max(1, Math.round(cellMeters * cellMeters / (spacing * spacing)));
      const random = createSeededRandom(
        (args.config.macro.seed ^ 0x5bf03635 ^ hash32(fieldCell.cellX, fieldCell.cellZ)) >>> 0,
      );

      for (let targetIndex = 0; targetIndex < target; targetIndex += 1) {
        for (let attempt = 0; attempt < args.config.tree.dartAttemptsPerTarget; attempt += 1) {
          attempted += 1;
          const ux = random();
          const uz = random();
          const uScale = random();
          const uYaw = random();
          const uMirror = random();
          const uCell = random();
          const uYawSlot = random();
          const uSpare = random();
          void uSpare;

          const variant = selectTreeVariant(
            uCell,
            fieldCell.routeDistanceMeters <= args.config.tree.nearRouteMeters,
            args.config,
          );
          if (variant === undefined) continue;
          const yawSlot = yawSlots[Math.min(3, Math.floor(uYawSlot * 4))];
          const cellSlot = treeLookup.get(`${variant}:${yawSlot}`);
          if (cellSlot === undefined) continue;

          const x = fieldCell.cellX * cellMeters + ux * cellMeters;
          const z = fieldCell.cellZ * cellMeters + uz * cellMeters;
          const slopeRad = sampleTerrainSlopeRadians(
            args.sampleHeight,
            x,
            z,
            args.config.macro.slopeStepMeters,
          );
          const slopeDeg = slopeRad * 180 / Math.PI;
          const scale = lerp(args.config.tree.scaleMin, args.config.tree.scaleMax, uScale)
            * (1 - args.config.tree.slopeScalePenalty * clamp01((slopeDeg - 20) / 30));
          const cellRef = args.cells[cellSlot];
          const widthMeters = cellRef.tightWorldWidth * scale;
          const heightMeters = cellRef.tightWorldHeight * scale;

          if (!isFootprintInsideMask(
            args.mask,
            x,
            z,
            0.35 * widthMeters,
            args.config.macro.minCoverage,
            args.config.macro.minCoverageEdge,
          )) {
            rejectedByMask += 1;
            continue;
          }
          if (args.routeExclusionDistance(x, z) < args.config.corridor.routeClearanceMeters
            + (widthMeters / 2) * args.config.corridor.clearanceFootprintFactor) {
            rejectedByRoute += 1;
            continue;
          }
          if (treeGrid.hasWithin(x, z, minSpacing)
            || groveGrid.hasWithin(x, z, args.config.tree.groveClearanceMeters)) {
            rejectedBySpacing += 1;
            continue;
          }

          const sink = args.config.tree.sinkBaseMeters
            + (widthMeters * 0.5) * Math.tan(slopeRad) * args.config.tree.slopeSinkFactor;
          primitives.push({
            globalIndex: primitives.length,
            kind: 'tree',
            x,
            y: args.sampleHeight(x, z) - sink,
            z,
            yawRadians: uYaw * Math.PI * 2,
            widthMeters,
            heightMeters,
            mirrored: uMirror < 0.5 ? 1 : 0,
            cellSlot,
          });
          treeGrid.add(x, z);
          treeCount += 1;
          if (treeCount >= maxTreePrimitives) break treePass;
          break;
        }
      }
    }
  }

  const accepted = primitives.length;
  const maximumTotal = Math.max(
    0,
    Math.floor(args.flags.maxPrimitivesOverride ?? args.config.limits.maxPrimitives),
  );
  let kept = primitives;
  let thinned = false;
  if (primitives.length > maximumTotal) {
    thinned = true;
    kept = [...primitives]
      .sort((left, right) => {
        const leftRank = hashIndexTo01(
          left.globalIndex,
          (args.config.macro.seed ^ 0x9e3779b9) >>> 0,
        );
        const rightRank = hashIndexTo01(
          right.globalIndex,
          (args.config.macro.seed ^ 0x9e3779b9) >>> 0,
        );
        return leftRank - rightRank || left.globalIndex - right.globalIndex;
      })
      .slice(0, maximumTotal)
      .sort((left, right) => left.globalIndex - right.globalIndex);
  }

  const positions = new Float32Array(kept.length * 3);
  const yawRadians = new Float32Array(kept.length);
  const widthMeters = new Float32Array(kept.length);
  const heightMeters = new Float32Array(kept.length);
  const mirrored = new Uint8Array(kept.length);
  const cellSlots = new Uint16Array(kept.length);
  const perCellCounts: Record<string, number> = {};
  groveCount = 0;
  treeCount = 0;
  for (let index = 0; index < kept.length; index += 1) {
    const primitive = kept[index];
    positions[index * 3] = primitive.x;
    positions[index * 3 + 1] = primitive.y;
    positions[index * 3 + 2] = primitive.z;
    yawRadians[index] = primitive.yawRadians;
    widthMeters[index] = primitive.widthMeters;
    heightMeters[index] = primitive.heightMeters;
    mirrored[index] = primitive.mirrored;
    cellSlots[index] = primitive.cellSlot;
    const key = args.cells[primitive.cellSlot].key;
    perCellCounts[key] = (perCellCounts[key] ?? 0) + 1;
    if (primitive.kind === 'grove') groveCount += 1;
    else treeCount += 1;
  }

  return {
    count: kept.length,
    positions,
    yawRadians,
    widthMeters,
    heightMeters,
    mirrored,
    cellSlots,
    stats: {
      groveCount,
      treeCount,
      attempted,
      accepted,
      kept: kept.length,
      thinned,
      rejectedByMask,
      rejectedByRoute,
      rejectedBySpacing,
      perCellCounts,
      elapsedMs: clock() - startedAt,
    },
  };
}
