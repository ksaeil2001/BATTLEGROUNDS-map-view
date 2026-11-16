import rawMapConfig from './map-config.json';
import {
  CANONICAL_MAP_SIZE,
  type CanonicalBounds,
  type MapDatasetConfig,
  type MapOverlayLayer,
  type TargetZone,
} from '@/domain/types';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function assertNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${label}: expected a non-empty string.`);
  }
  return value;
}

function assertPositiveFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${label}: expected a positive finite number.`);
  }
  return value;
}

function isWithinCanonicalRange(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= CANONICAL_MAP_SIZE
  );
}

function assertValidCanonicalBounds(
  value: unknown,
  label: string,
): CanonicalBounds {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !Array.isArray(value[0]) ||
    value[0].length !== 2 ||
    !Array.isArray(value[1]) ||
    value[1].length !== 2
  ) {
    throw new Error(
      `Invalid ${label} bounds: expected [[x1, y1], [x2, y2]] tuple.`,
    );
  }

  const [topLeft, bottomRight] = value as [
    [unknown, unknown],
    [unknown, unknown],
  ];

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

  return [
    [topLeft[0], topLeft[1]],
    [bottomRight[0], bottomRight[1]],
  ];
}

function validateOverlayLayer(value: unknown, index: number): MapOverlayLayer {
  if (!isRecord(value)) {
    throw new Error(`Invalid highResOverlays[${index}]: expected an object.`);
  }

  const id = assertNonEmptyString(value.id, `highResOverlays[${index}].id`);
  const label = assertNonEmptyString(
    value.label,
    `highResOverlays[${index}].label`,
  );
  const imagePath = assertNonEmptyString(
    value.imagePath,
    `highResOverlays[${index}].imagePath`,
  );
  const mapImageVersion = assertNonEmptyString(
    value.mapImageVersion,
    `highResOverlays[${index}].mapImageVersion`,
  );

  const bounds = assertValidCanonicalBounds(value.bounds, `overlay:${id}`);
  const minDisplayZoom =
    value.minDisplayZoom === undefined
      ? undefined
      : typeof value.minDisplayZoom === 'number' &&
          Number.isFinite(value.minDisplayZoom)
        ? value.minDisplayZoom
        : (() => {
            throw new Error(
              `Invalid overlay:${id}.minDisplayZoom: expected a finite number.`,
            );
          })();

  return {
    id,
    label,
    imagePath,
    mapImageVersion,
    bounds,
    minDisplayZoom,
  };
}

function validateTargetZone(value: unknown, index: number): TargetZone {
  if (!isRecord(value)) {
    throw new Error(`Invalid targetZones[${index}]: expected an object.`);
  }

  const id = assertNonEmptyString(value.id, `targetZones[${index}].id`);
  const displayName = assertNonEmptyString(
    value.displayName,
    `targetZones[${index}].displayName`,
  );
  const bounds = assertValidCanonicalBounds(value.bounds, `targetZone:${id}`);

  if (typeof value.pilotReady !== 'boolean') {
    throw new Error(`Invalid targetZone:${id}.pilotReady: expected boolean.`);
  }

  const verifiedGamePatch = assertNonEmptyString(
    value.verifiedGamePatch,
    `targetZone:${id}.verifiedGamePatch`,
  );

  if (value.pilotReady && verifiedGamePatch === 'unverified') {
    throw new Error(
      `Invalid targetZone:${id}: pilotReady zone requires a verifiedGamePatch other than "unverified".`,
    );
  }

  return {
    id,
    displayName,
    bounds,
    pilotReady: value.pilotReady,
    verifiedGamePatch,
  };
}

/**
 * Validate an unknown static MapDatasetConfig input at runtime and enforce
 * the public deployment rights gate for public map imagery.
 */
export function validateMapDatasetConfig(candidate: unknown): MapDatasetConfig {
  if (!isRecord(candidate)) {
    throw new Error('Invalid MapDatasetConfig: expected an object.');
  }

  if (candidate.mapId !== 'taego') {
    throw new Error(`Unsupported mapId: ${String(candidate.mapId)}`);
  }

  const displayName = assertNonEmptyString(
    candidate.displayName,
    'displayName',
  );

  if (candidate.canonicalSize !== CANONICAL_MAP_SIZE) {
    throw new Error(
      `Invalid canonicalSize: expected ${CANONICAL_MAP_SIZE}, got ${String(candidate.canonicalSize)}.`,
    );
  }

  if (candidate.assetMode !== 'sample' && candidate.assetMode !== 'official') {
    throw new Error(`Invalid assetMode: ${String(candidate.assetMode)}.`);
  }

  if (!isRecord(candidate.baseImage)) {
    throw new Error('Invalid baseImage: expected an object.');
  }

  if (candidate.baseImage.rightsClearedForPublicDeploy !== true) {
    throw new Error(
      'Map baseImage failed rightsClearedForPublicDeploy gate for public deployment.',
    );
  }

  const baseImage = {
    imagePath: assertNonEmptyString(
      candidate.baseImage.imagePath,
      'baseImage.imagePath',
    ),
    mapImageVersion: assertNonEmptyString(
      candidate.baseImage.mapImageVersion,
      'baseImage.mapImageVersion',
    ),
    pixelWidth: assertPositiveFiniteNumber(
      candidate.baseImage.pixelWidth,
      'baseImage.pixelWidth',
    ),
    pixelHeight: assertPositiveFiniteNumber(
      candidate.baseImage.pixelHeight,
      'baseImage.pixelHeight',
    ),
    rightsClearedForPublicDeploy: true,
  };

  if (!Array.isArray(candidate.highResOverlays)) {
    throw new Error('Invalid highResOverlays: expected an array.');
  }
  const highResOverlays = candidate.highResOverlays.map((overlay, index) =>
    validateOverlayLayer(overlay, index),
  );

  if (
    !Array.isArray(candidate.targetZones) ||
    candidate.targetZones.length === 0
  ) {
    throw new Error('MapDatasetConfig must declare at least one TargetZone.');
  }
  const targetZones = candidate.targetZones.map((zone, index) =>
    validateTargetZone(zone, index),
  );

  return {
    mapId: 'taego',
    displayName,
    canonicalSize: CANONICAL_MAP_SIZE,
    assetMode: candidate.assetMode,
    baseImage,
    highResOverlays,
    targetZones,
  };
}

/**
 * Server-side loader for the validated public MapDatasetConfig.
 */
export function loadPublicMapDatasetConfig(): MapDatasetConfig {
  return validateMapDatasetConfig(rawMapConfig);
}
