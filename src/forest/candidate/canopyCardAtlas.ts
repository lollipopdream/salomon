import * as THREE from 'three';

import { computeCrownLayout } from './crownLayout';
import type {
  ForestCandidateConfig,
  ForestCandidateSpeciesId,
  SpriteRect,
} from './types';

export interface CanopyCardAtlasResult {
  texture: THREE.CanvasTexture;
  uvRects: Float32Array;
  cellSize: number;
  columns: number;
  rows: number;
  dispose(): void;
}

type AtlasBakeConfig = Pick<ForestCandidateConfig, 'atlas' | 'crown'>;

export function bakeCanopyCardAtlas(args: {
  sources: {
    species: ForestCandidateSpeciesId;
    diff: CanvasImageSource;
    alpha: CanvasImageSource;
    spriteRects: SpriteRect[];
  }[];
  config: AtlasBakeConfig;
  seed: number;
}): CanopyCardAtlasResult {
  const { cellSize, columns, variantsPerSpecies } = args.config.atlas;
  const rows = 2;
  const gutter = 2;
  let atlasCanvas: HTMLCanvasElement | undefined = createCanvas(columns * cellSize, rows * cellSize);
  const atlasContext = getContext(atlasCanvas, 'atlas');
  const mergedCanvases: HTMLCanvasElement[] = [];
  const uvRects = new Float32Array(rows * columns * 4);
  const speciesOrder: readonly ForestCandidateSpeciesId[] = ['conifer', 'broadleaf'];

  for (let speciesIndex = 0; speciesIndex < speciesOrder.length; speciesIndex += 1) {
    const species = speciesOrder[speciesIndex];
    const source = args.sources.find((candidate) => candidate.species === species);
    if (!source || source.spriteRects.length === 0) {
      throw new Error(`Cannot bake canopy atlas: ${species} has no source sprites.`);
    }
    const mergedCanvas = mergeDiffuseAndAlpha(source.diff, source.alpha);
    mergedCanvases.push(mergedCanvas);

    for (let variantIndex = 0; variantIndex < variantsPerSpecies; variantIndex += 1) {
      const cellX = variantIndex * cellSize;
      const cellY = speciesIndex * cellSize;
      atlasContext.save();
      atlasContext.beginPath();
      atlasContext.rect(cellX + gutter, cellY + gutter, cellSize - gutter * 2, cellSize - gutter * 2);
      atlasContext.clip();

      const crown = args.config.crown[species];
      const placements = computeCrownLayout({
        ...crown,
        spriteIndexCount: source.spriteRects.length,
        seed: args.seed + speciesIndex * 1000 + variantIndex,
        shape: species === 'conifer' ? 'cone' : 'round',
      });
      for (const placement of placements) {
        const rect = source.spriteRects[placement.spriteIndex];
        const longSide = placement.scale * cellSize;
        const width = rect.width >= rect.height ? longSide : longSide * rect.width / rect.height;
        const height = rect.height >= rect.width ? longSide : longSide * rect.height / rect.width;
        atlasContext.save();
        atlasContext.globalAlpha = 1;
        atlasContext.filter = `brightness(${placement.brightness})`;
        atlasContext.translate(
          cellX + placement.centerX * cellSize,
          cellY + placement.centerY * cellSize,
        );
        atlasContext.rotate(placement.rotationRad);
        atlasContext.scale(placement.mirrored ? -1 : 1, 1);
        atlasContext.drawImage(
          mergedCanvas,
          rect.x,
          rect.y,
          rect.width,
          rect.height,
          -width / 2,
          -height / 2,
          width,
          height,
        );
        atlasContext.restore();
      }
      atlasContext.restore();
    }
  }

  for (let speciesIndex = 0; speciesIndex < rows; speciesIndex += 1) {
    for (let variantIndex = 0; variantIndex < columns; variantIndex += 1) {
      const offset = (speciesIndex * columns + variantIndex) * 4;
      uvRects[offset] = (variantIndex * cellSize + gutter) / atlasCanvas.width;
      // CanvasTexture.flipY is true: v=0 addresses the bottom of the source image.
      uvRects[offset + 1] = 1
        - ((speciesIndex + 1) * cellSize - gutter) / atlasCanvas.height;
      uvRects[offset + 2] = (cellSize - gutter * 2) / atlasCanvas.width;
      uvRects[offset + 3] = (cellSize - gutter * 2) / atlasCanvas.height;
    }
  }

  const texture = new THREE.CanvasTexture(atlasCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.premultiplyAlpha = false;
  texture.needsUpdate = true;
  let disposed = false;

  return {
    texture,
    uvRects,
    cellSize,
    columns,
    rows,
    dispose(): void {
      if (disposed) return;
      disposed = true;
      texture.dispose();
      texture.image = null;
      if (atlasCanvas) {
        atlasCanvas.width = 1;
        atlasCanvas.height = 1;
        atlasCanvas = undefined;
      }
      for (const canvas of mergedCanvases) {
        canvas.width = 1;
        canvas.height = 1;
      }
      mergedCanvases.length = 0;
    },
  };
}

function mergeDiffuseAndAlpha(
  diffuse: CanvasImageSource,
  alpha: CanvasImageSource,
): HTMLCanvasElement {
  const width = sourceDimension(diffuse, 'width');
  const height = sourceDimension(diffuse, 'height');
  const mergedCanvas = createCanvas(width, height);
  const alphaCanvas = createCanvas(width, height);
  const mergedContext = getContext(mergedCanvas, 'diffuse');
  const alphaContext = getContext(alphaCanvas, 'alpha');
  mergedContext.drawImage(diffuse, 0, 0, width, height);
  alphaContext.drawImage(alpha, 0, 0, width, height);
  const mergedPixels = mergedContext.getImageData(0, 0, width, height);
  const alphaPixels = alphaContext.getImageData(0, 0, width, height).data;
  for (let index = 0; index < width * height; index += 1) {
    mergedPixels.data[index * 4 + 3] = alphaPixels[index * 4];
  }
  mergedContext.putImageData(mergedPixels, 0, 0);
  alphaCanvas.width = 1;
  alphaCanvas.height = 1;
  return mergedCanvas;
}

function sourceDimension(source: CanvasImageSource, key: 'width' | 'height'): number {
  const dimensions = source as unknown as {
    width?: number;
    height?: number;
    naturalWidth?: number;
    naturalHeight?: number;
    videoWidth?: number;
    videoHeight?: number;
  };
  const value = key === 'width'
    ? dimensions.naturalWidth ?? dimensions.videoWidth ?? dimensions.width
    : dimensions.naturalHeight ?? dimensions.videoHeight ?? dimensions.height;
  if (!value || value <= 0) throw new Error(`Canopy ${key} is unavailable.`);
  return value;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getContext(canvas: HTMLCanvasElement, label: string): CanvasRenderingContext2D {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error(`Canopy ${label} canvas 2D context is unavailable.`);
  return context;
}
