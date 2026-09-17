import * as THREE from 'three';
import { describe, expect, it } from 'vitest';

import type {
  AppSettings,
  ElevationGrid,
  TerrainMaterialConfig,
} from '../types';
import { defaultSettings } from '../config/settings';
import {
  applyTerrainMaterial,
  computeElevationTintColors,
  computeHillshadeFactors,
  computeTerrainVertexColors,
  computeVertexNormalsApprox,
} from './terrainMaterial';

const grid: ElevationGrid = {
  cols: 3,
  rows: 3,
  values: Float32Array.from([
    100, 150, 200,
    100, 150, 200,
    100, 150, 200,
  ]),
  cellSizeMeters: 25,
  bounds: {
    north: 1,
    south: 0,
    east: 1,
    west: 0,
  },
};

const config: TerrainMaterialConfig = {
  lowElevationColor: 0x204060,
  highElevationColor: 0x80a0c0,
  roughness: 0.8,
  metalness: 0.1,
  hillshadeMinFactor: 0.3,
  hillshadeMaxFactor: 1.5,
};

function normalizedRgb(color: number): [number, number, number] {
  return [
    ((color >> 16) & 0xff) / 255,
    ((color >> 8) & 0xff) / 255,
    (color & 0xff) / 255,
  ];
}

function expectVertexColor(
  colors: Float32Array,
  vertexIndex: number,
  expected: readonly number[],
): void {
  const offset = vertexIndex * 3;
  expect(colors[offset]).toBeCloseTo(expected[0]);
  expect(colors[offset + 1]).toBeCloseTo(expected[1]);
  expect(colors[offset + 2]).toBeCloseTo(expected[2]);
}

describe('computeElevationTintColors', () => {
  it('maps the minimum elevation to the normalized low elevation color', () => {
    const colors = computeElevationTintColors(grid, config);

    expect(colors).toBeInstanceOf(Float32Array);
    expect(colors).toHaveLength(grid.rows * grid.cols * 3);
    expectVertexColor(colors, 0, normalizedRgb(config.lowElevationColor));
  });

  it('maps the maximum elevation to the normalized high elevation color', () => {
    const colors = computeElevationTintColors(grid, config);

    expectVertexColor(colors, 2, normalizedRgb(config.highElevationColor));
  });

  it('linearly interpolates a middle elevation to the RGB midpoint', () => {
    const colors = computeElevationTintColors(grid, config);
    const low = normalizedRgb(config.lowElevationColor);
    const high = normalizedRgb(config.highElevationColor);
    const midpoint = low.map((channel, index) => (
      (channel + high[index]) / 2
    ));

    expectVertexColor(colors, 1, midpoint);
  });

  it('uses the low elevation color for a uniform grid without producing NaN', () => {
    const uniformGrid: ElevationGrid = {
      ...grid,
      values: Float32Array.from({ length: 9 }, () => 150),
    };

    const colors = computeElevationTintColors(uniformGrid, config);
    const low = normalizedRgb(config.lowElevationColor);

    for (let vertexIndex = 0; vertexIndex < 9; vertexIndex += 1) {
      expectVertexColor(colors, vertexIndex, low);
    }
    expect(Array.from(colors).some(Number.isNaN)).toBe(false);
  });
});

describe('computeVertexNormalsApprox', () => {
  it('returns upward normals for a uniform grid', () => {
    const uniformGrid: ElevationGrid = {
      ...grid,
      values: Float32Array.from({ length: 9 }, () => 150),
    };

    const normals = computeVertexNormalsApprox(uniformGrid, defaultSettings);

    expect(normals).toBeInstanceOf(Float32Array);
    expect(normals).toHaveLength(uniformGrid.rows * uniformGrid.cols * 3);
    for (let vertexIndex = 0; vertexIndex < 9; vertexIndex += 1) {
      const offset = vertexIndex * 3;
      expect(normals[offset]).toBeCloseTo(0);
      expect(normals[offset + 1]).toBeCloseTo(1);
      expect(normals[offset + 2]).toBeCloseTo(0);
    }
  });

  it('returns the expected normalized slope normals for a linear column gradient', () => {
    const normals = computeVertexNormalsApprox(grid, defaultSettings);

    for (let vertexIndex = 0; vertexIndex < 9; vertexIndex += 1) {
      const offset = vertexIndex * 3;
      expect(normals[offset]).toBeCloseTo(-0.8944271909999159, 4);
      expect(normals[offset + 1]).toBeCloseTo(0.4472135954999579, 4);
      expect(normals[offset + 2]).toBeCloseTo(0, 4);
    }
  });
});

describe('computeHillshadeFactors', () => {
  const flatNormals = Float32Array.from([
    0, 1, 0,
    0, 1, 0,
    0, 1, 0,
  ]);

  it('returns full illumination for flat normals under overhead light', () => {
    const hillshade = computeHillshadeFactors(
      flatNormals,
      { x: 0, y: 1, z: 0 },
    );

    for (const factor of hillshade) {
      expect(factor).toBeCloseTo(1);
    }
  });

  it('returns zero for flat normals under side light', () => {
    const hillshade = computeHillshadeFactors(
      flatNormals,
      { x: 1, y: 0, z: 0 },
    );

    for (const factor of hillshade) {
      expect(factor).toBeCloseTo(0);
    }
  });
});

describe('computeHillshadeFactors (contrast stretch)', () => {
  it('stretches the actual dot-product range to use the full 0..1 range', () => {
    // 3 rows x 9 cols grid (each row identical), so that NEIGHBOR_STEP=2 sampling still
    // captures three distinct slope regions without edge-clamping distorting the comparison.
    // A steady slope of 5/cell from col0 to col4 is followed by a flat region.
    const slopeGrid: ElevationGrid = {
      cols: 9,
      rows: 3,
      values: Float32Array.from([
        0, 5, 10, 15, 20, 20, 20, 20, 20,
        0, 5, 10, 15, 20, 20, 20, 20, 20,
        0, 5, 10, 15, 20, 20, 20, 20, 20,
      ]),
      cellSizeMeters: 10,
      bounds: { north: 1, south: 0, east: 1, west: 0 },
    };
    const settingsWithUnitScale: AppSettings = {
      ...defaultSettings,
      elevationScale: 1,
    };
    const normals = computeVertexNormalsApprox(slopeGrid, settingsWithUnitScale);
    const hillshade = computeHillshadeFactors(normals, { x: 0, y: 1, z: 0 });

    // With two-cell sampling, col0 and col2 both have dHdCol=0.5 and therefore
    // share the scene's minimum dot. Col6 samples only the flat region and has dot=1.
    const rowOffset = 1 * slopeGrid.cols;
    expect(hillshade[rowOffset + 0]).toBeCloseTo(0, 2);
    expect(hillshade[rowOffset + 2]).toBeCloseTo(0, 2);
    expect(hillshade[rowOffset + 6]).toBeCloseTo(1, 2);
  });
});

describe('computeTerrainVertexColors', () => {
  it('exactly preserves elevation tint colors when hillshade is disabled', () => {
    const disabledConfig: TerrainMaterialConfig = {
      ...config,
      hillshadeMinFactor: 1,
      hillshadeMaxFactor: 1,
    };

    const colors = computeTerrainVertexColors(
      grid,
      defaultSettings,
      disabledConfig,
      { x: 1, y: 0, z: 0 },
    );

    expect(colors).toEqual(computeElevationTintColors(grid, disabledConfig));
  });

  it('multiplies elevation tint colors by hillshadeMinFactor in a degenerate flat case', () => {
    const uniformGrid: ElevationGrid = {
      ...grid,
      values: Float32Array.from({ length: 9 }, () => 150),
    };
    const degenerateConfig: TerrainMaterialConfig = {
      ...config,
      hillshadeMinFactor: 0.4,
      hillshadeMaxFactor: 1.2,
    };
    const elevationColors = computeElevationTintColors(
      uniformGrid,
      degenerateConfig,
    );

    const colors = computeTerrainVertexColors(
      uniformGrid,
      defaultSettings,
      degenerateConfig,
      { x: 1, y: 0, z: 0 },
    );

    for (let offset = 0; offset < colors.length; offset += 1) {
      expect(colors[offset]).toBeCloseTo(
        elevationColors[offset] * degenerateConfig.hillshadeMinFactor,
      );
    }
  });

  it('blends boundary vertex colors toward the configured edge fade color', () => {
    const edgeFadeColor = 0x0a1420;
    const edgeFadeConfig: TerrainMaterialConfig = {
      ...config,
      edgeFade: {
        enabled: true,
        fadeStartFactor: 0.5,
        fadeColor: edgeFadeColor,
      },
    };
    const lightDirection = { x: 1, y: 0, z: 0 };
    const unfadedColors = computeTerrainVertexColors(
      grid,
      defaultSettings,
      config,
      lightDirection,
    );
    const fadedColors = computeTerrainVertexColors(
      grid,
      defaultSettings,
      edgeFadeConfig,
      lightDirection,
    );
    const fadeColor = normalizedRgb(edgeFadeColor);

    expectVertexColor(fadedColors, 0, fadeColor);
    for (let channel = 0; channel < 3; channel += 1) {
      expect(Math.abs(fadedColors[channel] - fadeColor[channel])).toBeLessThan(
        Math.abs(unfadedColors[channel] - fadeColor[channel]),
      );
    }
  });

  it('returns identical colors when textureTintStrength is omitted', () => {
    const withoutArg = computeTerrainVertexColors(
      grid,
      defaultSettings,
      config,
      { x: 1, y: 0, z: 0 },
    );
    const withUndefinedArg = computeTerrainVertexColors(
      grid,
      defaultSettings,
      config,
      { x: 1, y: 0, z: 0 },
      undefined,
    );

    expect(withUndefinedArg).toEqual(withoutArg);
  });

  it('blends colors toward white when textureTintStrength is provided', () => {
    const lightDirection = { x: 1, y: 0, z: 0 };
    const untinted = computeTerrainVertexColors(
      grid,
      defaultSettings,
      config,
      lightDirection,
    );
    const tinted = computeTerrainVertexColors(
      grid,
      defaultSettings,
      config,
      lightDirection,
      0.5,
    );

    for (let offset = 0; offset < tinted.length; offset += 1) {
      expect(tinted[offset]).toBeGreaterThanOrEqual(untinted[offset]);
    }
    // At least one channel should have visibly moved toward white.
    expect(
      Array.from(tinted).some((value, offset) => value > untinted[offset] + 1e-6),
    ).toBe(true);
  });
});

describe('applyTerrainMaterial', () => {
  const lightDirection = { x: 1, y: 0, z: 0 };

  const reliefGrid: ElevationGrid = {
    cols: 9,
    rows: 3,
    values: Float32Array.from([
      0, 5, 10, 15, 20, 20, 20, 20, 20,
      0, 5, 10, 15, 20, 20, 20, 20, 20,
      0, 5, 10, 15, 20, 20, 20, 20, 20,
    ]),
    cellSizeMeters: 10,
    bounds: { north: 1, south: 0, east: 1, west: 0 },
  };
  const reliefSettings: AppSettings = {
    ...defaultSettings,
    elevationScale: 1,
  };
  const constantTintConfig: TerrainMaterialConfig = {
    ...config,
    lowElevationColor: 0x808080,
    highElevationColor: 0x808080,
    hillshadeMinFactor: 0.42,
    hillshadeMaxFactor: 1.5,
  };
  const overheadLightDirection = { x: 0, y: 1, z: 0 };

  function getRedChannel(
    geometry: THREE.BufferGeometry,
    vertexIndex: number,
  ): number {
    const colorAttribute = geometry.getAttribute('color');
    return colorAttribute.getX(vertexIndex);
  }

  it('preserves existing material properties when texture is omitted', () => {
    const geometry = new THREE.BufferGeometry();

    const material = applyTerrainMaterial(
      geometry,
      grid,
      defaultSettings,
      config,
      lightDirection,
    );

    expect(material.map).toBeNull();
    expect(material.vertexColors).toBe(true);
    expect(material.color.getHex()).toBe(0xffffff);
    expect(material.roughness).toBe(config.roughness);
    expect(material.metalness).toBe(config.metalness);
  });

  it('uses the provided texture while preserving vertex colors and material properties', () => {
    const geometry = new THREE.BufferGeometry();
    const texture = new THREE.Texture();

    const material = applyTerrainMaterial(
      geometry,
      grid,
      defaultSettings,
      config,
      lightDirection,
      texture,
    );

    expect(material.map).toBe(texture);
    expect(material.vertexColors).toBe(true);
    expect(material.color.getHex()).toBe(0xffffff);
    expect(material.roughness).toBe(config.roughness);
    expect(material.metalness).toBe(config.metalness);
  });

  it('does not crush unfavorable coarse-normal vertices when a texture is present', () => {
    const geometry = new THREE.BufferGeometry();

    applyTerrainMaterial(
      geometry,
      reliefGrid,
      reliefSettings,
      constantTintConfig,
      overheadLightDirection,
      new THREE.Texture(),
    );

    const rowOffset = reliefGrid.cols;
    const darkest = getRedChannel(geometry, rowOffset);
    const brightest = getRedChannel(geometry, rowOffset + 6);

    expect(darkest / brightest).toBeGreaterThan(0.9);
    expect(darkest / brightest).toBeCloseTo(1);
  });

  it('preserves the full configured hillshade contrast when no texture is present', () => {
    const geometry = new THREE.BufferGeometry();

    applyTerrainMaterial(
      geometry,
      reliefGrid,
      reliefSettings,
      constantTintConfig,
      overheadLightDirection,
    );

    const rowOffset = reliefGrid.cols;
    const darkest = getRedChannel(geometry, rowOffset);
    const brightest = getRedChannel(geometry, rowOffset + 6);

    expect(darkest / brightest).toBeCloseTo(0.42 / 1.5);
  });

  it('still forces hillshade to 1/1 with a texture when textureHillshadeMinFactor/MaxFactor are unset', () => {
    const geometry = new THREE.BufferGeometry();

    applyTerrainMaterial(
      geometry,
      reliefGrid,
      reliefSettings,
      constantTintConfig,
      overheadLightDirection,
      new THREE.Texture(),
    );

    const rowOffset = reliefGrid.cols;
    const darkest = getRedChannel(geometry, rowOffset);
    const brightest = getRedChannel(geometry, rowOffset + 6);

    expect(darkest / brightest).toBeCloseTo(1);
  });

  it('uses textureHillshadeMinFactor/MaxFactor as the hillshade range when a texture is present', () => {
    const geometry = new THREE.BufferGeometry();
    const configWithTextureHillshade: TerrainMaterialConfig = {
      ...constantTintConfig,
      textureHillshadeMinFactor: 0.5,
      textureHillshadeMaxFactor: 1.2,
    };

    applyTerrainMaterial(
      geometry,
      reliefGrid,
      reliefSettings,
      configWithTextureHillshade,
      overheadLightDirection,
      new THREE.Texture(),
    );

    const rowOffset = reliefGrid.cols;
    const darkest = getRedChannel(geometry, rowOffset);
    const brightest = getRedChannel(geometry, rowOffset + 6);

    expect(darkest / brightest).toBeCloseTo(0.5 / 1.2);
  });

  it('blends toward white via textureTintStrength only when a texture is present', () => {
    const uniformGrid: ElevationGrid = {
      ...grid,
      values: Float32Array.from({ length: 9 }, () => 150),
    };
    const geometryWithTexture = new THREE.BufferGeometry();
    const geometryWithoutTexture = new THREE.BufferGeometry();
    // hillshadeMinFactor/MaxFactor of 1/1 keeps hillshade an identity multiplier
    // (and matches what a texture would force it to anyway), isolating the
    // effect of textureTintStrength alone.
    const tintConfig: TerrainMaterialConfig = {
      ...config,
      hillshadeMinFactor: 1,
      hillshadeMaxFactor: 1,
      textureTintStrength: 0.5,
    };

    applyTerrainMaterial(
      geometryWithTexture,
      uniformGrid,
      defaultSettings,
      tintConfig,
      lightDirection,
      new THREE.Texture(),
    );
    applyTerrainMaterial(
      geometryWithoutTexture,
      uniformGrid,
      defaultSettings,
      tintConfig,
      lightDirection,
    );

    const withTexture = getRedChannel(geometryWithTexture, 0);
    const withoutTexture = getRedChannel(geometryWithoutTexture, 0);

    // With a texture, textureTintStrength should be applied (color pulled toward white).
    // Without a texture, textureTintStrength is ignored, so the color should be darker/unchanged.
    expect(withTexture).toBeGreaterThan(withoutTexture);
  });
});
