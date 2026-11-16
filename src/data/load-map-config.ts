import rawMapConfig from './map-config.json';
import {
  CANONICAL_MAP_SIZE,
  type CanonicalBounds,
  type MapDatasetConfig,
} from '@/domain/types';

function isWithinCanonicalRange(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= CANONICAL_MAP_SIZE;
}

function assertValidCanonicalBounds(
  bounds: CanonicalBounds,
  label: string,
): void {
  const [topLeft, bottomRight] = bounds;

  if (
    !isWithinCanonicalRange(topLeft[0]) ||
    !isWithinCanonicalRange(topLeft[1]) ||
    !isWithinCanonicalRange(bottomRight[0]) ||
    !isWithinCanonicalRange(bottomRight[1])
  ) {
    throw new Error(
      `Invalid ${label} bounds: coordinates must lie within 0..${CANONICAL_MAP_SIZE}.`,
    );
  }

  if (topLeft[0] >= bottomRight[0] || topLeft[1] >= bottomRight[1]) {
    throw new Error(
      `Invalid ${label} bounds: topLeft must be strictly less than bottomRight.`,
    );
  }
}

/**
 * Validate a static MapDatasetConfig and enforce the public deployment
 * copyright/rights gate before passing metadata to client map components.
 */
export function validateMapDatasetConfig(
  candidate: MapDatasetConfig,
): MapDatasetConfig {
  if (candidate.mapId !== 'taego') {
    throw new Error(`Unsupported mapId: ${String(candidate.mapId)}`);
  }

  if (candidate.canonicalSize !== CANONICAL_MAP_SIZE) {
    throw new Error(
      `Invalid canonicalSize: expected ${CANONICAL_MAP_SIZE}, got ${String(candidate.canonicalSize)}.`,
    );
  }

  if (candidate.assetMode !== 'sample' && candidate.assetMode !== 'official') {
    throw new Error(`Invalid assetMode: ${String(candidate.assetMode)}.`);
  }

  if (candidate.baseImage.rightsClearedForPublicDeploy !== true) {
    throw new Error(
      'Map baseImage failed rightsClearedForPublicDeploy gate for public deployment.',
    );
  }

  if (
    candidate.baseImage.pixelWidth <= 0 ||
    candidate.baseImage.pixelHeight <= 0
  ) {
    throw new Error('Map baseImage pixel dimensions must be positive numbers.');
  }

  if (candidate.targetZones.length === 0) {
    throw new Error('MapDatasetConfig must declare at least one TargetZone.');
  }

  for (const overlay of candidate.highResOverlays) {
    assertValidCanonicalBounds(overlay.bounds, `overlay:${overlay.id}`);
  }

  for (const zone of candidate.targetZones) {
    assertValidCanonicalBounds(zone.bounds, `targetZone:${zone.id}`);
  }

  return candidate;
}

/**
 * Server-side loader for the validated public MapDatasetConfig.
 */
export function loadPublicMapDatasetConfig(): MapDatasetConfig {
  return validateMapDatasetConfig(rawMapConfig as unknown as MapDatasetConfig);
}
