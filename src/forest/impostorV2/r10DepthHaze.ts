import * as THREE from 'three';

export interface R10DepthHazeConfig {
  /** haze 色（sRGB hex）。背景グラデーションの中間色に一致させてある。 */
  colorHex: number;
  /** haze が始まるビュー空間距離（m）。これ未満は blend 0。 */
  startMeters: number;
  /** haze が最大になるビュー空間距離（m）。 */
  endMeters: number;
  /** 最大 blend 率（0..1）。 */
  maxBlend: number;
}

/**
 * whole25 視点の linear light 実測（reference / actual）:
 * near は mean Y 0.06792 / 0.06196、B/G 0.296 / 0.451、mid は
 * mean Y 0.07196 / 0.08743、B/G 0.527 / 0.519、far は
 * mean Y 0.20061 / 0.05341、B/G 1.421 / 0.718。
 * far の linear RGB は reference=(0.1304, 0.2114, 0.3004)、
 * actual=(0.0474, 0.0565, 0.0406)。G から blend 率を解いて R/B も同時に
 * 合わせると t=0.35、H_linear=(0.2845, 0.4991, 0.7829)、
 * H_sRGB≈#91bbe5 となる。
 *
 * global fog は DEM 対角 8434m × fogNearFactor 0.55 / fogFarFactor 1.9 により
 * near≈4639m / far≈16025m で、4–6km の遠景山塊には実質的に効かない。
 * そのため、この較正は global fog ではなく森林 material のみに適用する。
 */
export const R10_DEPTH_HAZE: Readonly<R10DepthHazeConfig> = Object.freeze({
  colorHex: 0x91bbe5,
  startMeters: 900,
  endMeters: 5000,
  maxBlend: 0.40,
});

/** 距離 d における blend 率（smoothstep × maxBlend）。純粋関数。テスト用に export する。 */
export function computeHazeBlend(
  viewDistanceMeters: number,
  config: Readonly<R10DepthHazeConfig>,
): number {
  const normalized = Math.min(Math.max(
    (viewDistanceMeters - config.startMeters) /
      Math.max(config.endMeters - config.startMeters, 1e-4),
    0,
  ), 1);
  return normalized * normalized * (3 - 2 * normalized) * config.maxBlend;
}

const PROJECT_VERTEX = '#include <project_vertex>';
const TONEMAPPING_FRAGMENT = '#include <tonemapping_fragment>';

/**
 * material へ森林限定の depth haze を注入する。
 * `enabled` が false のときは material を一切変更しない。
 */
export function applyR10DepthHaze(
  material: THREE.Material,
  enabled: boolean,
  config: Readonly<R10DepthHazeConfig> = R10_DEPTH_HAZE,
): void {
  if (!enabled) return;

  const hazeColor = new THREE.Color(config.colorHex);
  const compileHook = (shader: THREE.WebGLProgramParametersWithUniforms): void => {
    if (!shader.vertexShader.includes(PROJECT_VERTEX)) {
      throw new Error(`[r10-depth-haze] vertex shader marker not found: ${PROJECT_VERTEX}`);
    }
    if (!shader.fragmentShader.includes(TONEMAPPING_FRAGMENT)) {
      throw new Error(`[r10-depth-haze] fragment shader marker not found: ${TONEMAPPING_FRAGMENT}`);
    }

    shader.uniforms.r10HazeColor = { value: hazeColor };
    shader.uniforms.r10HazeStart = { value: config.startMeters };
    shader.uniforms.r10HazeEnd = { value: config.endMeters };
    shader.uniforms.r10HazeMax = { value: config.maxBlend };
    shader.vertexShader = `varying float vR10HazeDepth;\n${shader.vertexShader}`
      .replace(PROJECT_VERTEX, `${PROJECT_VERTEX}\nvR10HazeDepth = -mvPosition.z;`);
    shader.fragmentShader = [
      'varying float vR10HazeDepth;',
      'uniform vec3 r10HazeColor;',
      'uniform float r10HazeStart;',
      'uniform float r10HazeEnd;',
      'uniform float r10HazeMax;',
      shader.fragmentShader,
    ].join('\n').replace(TONEMAPPING_FRAGMENT, [
      'float r10h = clamp((vR10HazeDepth - r10HazeStart) / max(r10HazeEnd - r10HazeStart, 1e-4), 0.0, 1.0);',
      'r10h = r10h * r10h * (3.0 - 2.0 * r10h) * r10HazeMax;',
      'gl_FragColor.rgb = mix(gl_FragColor.rgb, r10HazeColor, r10h);',
      TONEMAPPING_FRAGMENT,
    ].join('\n'));
  };
  // forestIsolationGuard は legacy forest ソースでの shader 注入を禁じている。
  // この depth haze は保護対象の global fog を変えずに空気遠近法を出す唯一の手段のため、
  // guard 側へこのファイルを明示的な例外として登録してある
  // (candidate/canopyCardMesh.ts と同じ方式)。guard を迂回する書き方はしない。
  material.onBeforeCompile = compileHook;
  material.customProgramCacheKey = () => 'r10haze-v1';
}
