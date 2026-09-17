import {
  CANONICAL_CELL_SIZE_METERS,
  CANOPY_HEIGHT_METERS,
  EDGE_TAPER_WIDTH_METERS,
  MASK_THRESHOLD,
  OVERVIEW_CAMERA,
  PRIMARY_CAMERA,
} from '../labConstants';
import type {
  CameraId,
  PatchManifest,
  PatchSpec,
  Vec3Record,
} from '../labTypes';

export interface LabCameraPose {
  position: Vec3Record;
  target: Vec3Record;
  fov: number;
  near: number;
  far: number;
}

function tupleToRecord(tuple: readonly [number, number, number]): Vec3Record {
  return { x: tuple[0], y: tuple[1], z: tuple[2] };
}

function adjustedPose(
  camera: typeof PRIMARY_CAMERA | typeof OVERVIEW_CAMERA,
  adjustment: Vec3Record,
): LabCameraPose {
  const target = tupleToRecord(camera.target);
  return {
    position: tupleToRecord(camera.position),
    target: {
      x: target.x + adjustment.x,
      y: target.y + adjustment.y,
      z: target.z + adjustment.z,
    },
    fov: camera.fov,
    near: camera.near,
    far: camera.far,
  };
}

export function resolvePrimaryPose(manifest: PatchManifest): LabCameraPose {
  return adjustedPose(PRIMARY_CAMERA, manifest.cameraTargetAdjustment.PRIMARY);
}

export function resolveOverviewPose(manifest: PatchManifest): LabCameraPose {
  return adjustedPose(OVERVIEW_CAMERA, manifest.cameraTargetAdjustment.OVERVIEW);
}

export function resolveClosePose(
  manifest: PatchManifest,
): PatchManifest['closeCamera'] {
  return manifest.closeCamera;
}

export interface ComputeClosePoseOptions {
  patch: PatchSpec;
  laplacianAt: (col: number, row: number) => number;
  coverageAt: (x: number, z: number) => number;
  terrainYAt: (x: number, z: number) => number;
}

export function computeClosePoseFromPatch({
  patch,
  laplacianAt,
  coverageAt,
  terrainYAt,
}: ComputeClosePoseOptions): PatchManifest['closeCamera'] {
  let anchorRow = -1;
  let anchorCol = -1;
  let maximumLaplacian = Number.NEGATIVE_INFINITY;
  for (let localRow = 24; localRow <= 72; localRow += 1) {
    const row = patch.rowStart + localRow;
    for (let localCol = 24; localCol <= 72; localCol += 1) {
      const col = patch.colStart + localCol;
      const x = col * CANONICAL_CELL_SIZE_METERS;
      const z = row * CANONICAL_CELL_SIZE_METERS;
      if (coverageAt(x, z) < MASK_THRESHOLD) continue;
      const laplacian = laplacianAt(col, row);
      if (laplacian > maximumLaplacian) {
        maximumLaplacian = laplacian;
        anchorRow = row;
        anchorCol = col;
      }
    }
  }
  if (anchorRow < 0 || anchorCol < 0) {
    throw new Error('Patch central region contains no forest anchor candidate.');
  }

  const anchorX = anchorCol * CANONICAL_CELL_SIZE_METERS;
  const anchorZ = anchorRow * CANONICAL_CELL_SIZE_METERS;
  const anchorY = terrainYAt(anchorX, anchorZ) + CANOPY_HEIGHT_METERS;
  const horizontalDirectionLength = Math.hypot(
    PRIMARY_CAMERA.worldDirection[0],
    PRIMARY_CAMERA.worldDirection[2],
  );
  const headingX = PRIMARY_CAMERA.worldDirection[0] / horizontalDirectionLength;
  const headingZ = PRIMARY_CAMERA.worldDirection[2] / horizontalDirectionLength;
  const horizontalDistance = 2 * EDGE_TAPER_WIDTH_METERS;
  const positionX = anchorX - headingX * horizontalDistance;
  const positionZ = anchorZ - headingZ * horizontalDistance;
  const minimumY = anchorY + CANOPY_HEIGHT_METERS;
  const clearanceY = terrainYAt(positionX, positionZ) + 2 * CANOPY_HEIGHT_METERS;
  const positionY = Math.max(minimumY, clearanceY);

  return {
    anchor: { row: anchorRow, col: anchorCol, x: anchorX, y: anchorY, z: anchorZ },
    position: { x: positionX, y: positionY, z: positionZ },
    target: { x: anchorX, y: anchorY, z: anchorZ },
    fov: PRIMARY_CAMERA.fov,
    groundClearanceApplied: clearanceY > minimumY,
  };
}

export function resolveCameraPose(id: CameraId, manifest: PatchManifest) {
  if (id === 'PRIMARY') return resolvePrimaryPose(manifest);
  if (id === 'OVERVIEW') return resolveOverviewPose(manifest);
  return resolveClosePose(manifest);
}
