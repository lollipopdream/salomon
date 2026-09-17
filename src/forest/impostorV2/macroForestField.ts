import { sampleTerrainSlopeRadians } from '../terrainHeightSampler';
import { sampleMaskCoverageV2 } from './forestMaskV2';
import { macroPatchField } from './macroNoise';
import type {
  ForestImpostorV2Config,
  ForestMaskV2Data,
  ImpostorBand,
  MacroForestCell,
  MacroForestField,
} from './types';

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function computeRidgeScore(
  sampleHeight: (x: number, z: number) => number,
  x: number,
  z: number,
  radiusMeters: number,
  referenceMeters: number,
): number {
  const centerHeight = sampleHeight(x, z);
  let surroundingHeight = 0;
  for (let direction = 0; direction < 8; direction += 1) {
    const angle = direction * Math.PI / 4;
    surroundingHeight += sampleHeight(
      x + radiusMeters * Math.cos(angle),
      z + radiusMeters * Math.sin(angle),
    );
  }
  return clamp01((centerHeight - surroundingHeight / 8) / referenceMeters);
}

export function buildMacroForestField(args: {
  mask: ForestMaskV2Data;
  sampleHeight: (x: number, z: number) => number;
  corridorDistance: (x: number, z: number) => number;
  config: ForestImpostorV2Config;
  densityScale: number;
}): MacroForestField {
  const { mask, sampleHeight, corridorDistance, config, densityScale } = args;
  const { macro, corridor, grove } = config;
  const cols = Math.ceil(mask.extentMeters / macro.cellMeters);
  const rows = cols;
  const cells: MacroForestCell[] = [];
  let acceptedCells = 0;
  let nearCells = 0;
  let midCells = 0;
  let ridgeCells = 0;
  let acceptedSpacingTotal = 0;

  for (let cellZ = 0; cellZ < rows; cellZ += 1) {
    for (let cellX = 0; cellX < cols; cellX += 1) {
      const index = cellZ * cols + cellX;
      const centerX = (cellX + 0.5) * macro.cellMeters;
      const centerZ = (cellZ + 0.5) * macro.cellMeters;
      const coverageTapOffset = macro.cellMeters / 4;
      const coverage = (
        sampleMaskCoverageV2(mask, centerX, centerZ)
        + sampleMaskCoverageV2(mask, centerX - coverageTapOffset, centerZ)
        + sampleMaskCoverageV2(mask, centerX + coverageTapOffset, centerZ)
        + sampleMaskCoverageV2(mask, centerX, centerZ - coverageTapOffset)
        + sampleMaskCoverageV2(mask, centerX, centerZ + coverageTapOffset)
      ) / 5;
      const slopeRad = sampleTerrainSlopeRadians(
        sampleHeight,
        centerX,
        centerZ,
        macro.slopeStepMeters,
      );
      const slopeDeg = slopeRad * 180 / Math.PI;
      const slopeDensity = slopeDeg <= macro.slopeFullDeg
        ? 1
        : slopeDeg >= macro.slopeZeroDeg
          ? 0
          : 1 - (slopeDeg - macro.slopeFullDeg) / (macro.slopeZeroDeg - macro.slopeFullDeg);
      const ridgeScore = computeRidgeScore(
        sampleHeight,
        centerX,
        centerZ,
        macro.reliefRadiusMeters,
        macro.reliefReferenceMeters,
      );
      const routeDistanceMeters = corridorDistance(centerX, centerZ);
      const patch = macroPatchField(cellX, cellZ, macro.seed, macro.patchNoiseScaleCells);

      let band: ImpostorBand;
      if (coverage < macro.minCoverage) {
        band = 'none';
      } else if (slopeDensity <= 0) {
        band = 'none';
      } else if (routeDistanceMeters <= corridor.nearMeters) {
        band = 'near';
      } else if (routeDistanceMeters <= corridor.farMeters) {
        band = 'mid';
      } else if (routeDistanceMeters <= corridor.ridgeMeters && ridgeScore >= macro.ridgeScoreMin) {
        band = 'ridge';
      } else {
        band = 'none';
      }

      const baseSpacing = band === 'near'
        ? grove.spacingNearMeters
        : band === 'mid'
          ? grove.spacingNearMeters
            + (grove.spacingFarMeters - grove.spacingNearMeters)
              * (routeDistanceMeters - corridor.nearMeters)
              / (corridor.farMeters - corridor.nearMeters)
          : grove.spacingRidgeMeters;
      const spacingMeters = baseSpacing
        * (1 + grove.patchSpacingBoost * (1 - patch))
        / Math.sqrt(Math.max(slopeDensity, 0.25))
        / Math.sqrt(Math.max(densityScale, 1e-6));
      const accepted = band !== 'none' && patch > macro.patchThreshold[band];

      cells.push({
        cellX,
        cellZ,
        index,
        centerX,
        centerZ,
        coverage,
        slopeRad,
        slopeDensity,
        ridgeScore,
        routeDistanceMeters,
        patch,
        band,
        spacingMeters,
        accepted,
      });

      if (accepted) {
        acceptedCells += 1;
        acceptedSpacingTotal += spacingMeters;
        if (band === 'near') nearCells += 1;
        else if (band === 'mid') midCells += 1;
        else if (band === 'ridge') ridgeCells += 1;
      }
    }
  }

  return {
    cols,
    rows,
    cellMeters: macro.cellMeters,
    extentMeters: mask.extentMeters,
    cells,
    stats: {
      acceptedCells,
      nearCells,
      midCells,
      ridgeCells,
      meanSpacingMeters: acceptedCells === 0 ? 0 : acceptedSpacingTotal / acceptedCells,
    },
  };
}
