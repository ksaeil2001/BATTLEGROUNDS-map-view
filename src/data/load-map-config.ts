import rawMapConfig from './map-config.json';
import {
  assertNonEmptyString,
  assertPositiveFiniteNumber,
  assertValidCanonicalBounds,
  isRecord,
} from './validation-helpers';
import {
  CANONICAL_MAP_SIZE,
  type MapDatasetConfig,
  type MapOverlayLayer,
  type TargetZone,
} from '@/domain/types';

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

export const DEV_LOCAL_ASSET_PREFIX = '/api/dev-local-assets/' as const;

export const DEV_LOCAL_ASSET_FILES = {
  basePreview: 'taego-31.2-base-preview.png',
  palaceCrop: 'palace-31.2-highres-crop.png',
  terminalCrop: 'terminal-31.2-highres-crop.png',
} as const;

const PALACE_31_2_CANDIDATE_BOUNDS = [
  [2750, 3400],
  [3350, 3950],
] as const;

const TERMINAL_31_2_CANDIDATE_BOUNDS = [
  [4300, 3400],
  [4950, 3880],
] as const;

function assertDevLocalAssetPath(imagePath: string, label: string): string {
  if (!imagePath.startsWith(DEV_LOCAL_ASSET_PREFIX)) {
    throw new Error(
      `Invalid ${label}: dev preview images must start with "${DEV_LOCAL_ASSET_PREFIX}".`,
    );
  }
  return imagePath;
}

function validateMapDatasetConfigInternal(
  candidate: unknown,
  allowUnverifiedDevPreview: boolean,
): MapDatasetConfig {
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

  const rightsCleared = candidate.baseImage.rightsClearedForPublicDeploy;
  if (allowUnverifiedDevPreview) {
    if (candidate.assetMode !== 'official') {
      throw new Error('Dev official preview requires assetMode "official".');
    }
    if (typeof rightsCleared !== 'boolean') {
      throw new Error(
        'Invalid baseImage.rightsClearedForPublicDeploy: expected boolean.',
      );
    }
  } else if (rightsCleared !== true) {
    throw new Error(
      'Map baseImage failed rightsClearedForPublicDeploy gate for public deployment.',
    );
  }

  const rawBaseImagePath = assertNonEmptyString(
    candidate.baseImage.imagePath,
    'baseImage.imagePath',
  );
  const baseImagePath = allowUnverifiedDevPreview
    ? assertDevLocalAssetPath(rawBaseImagePath, 'baseImage.imagePath')
    : rawBaseImagePath;

  const baseImage = {
    imagePath: baseImagePath,
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
    rightsClearedForPublicDeploy: rightsCleared,
  };

  if (!Array.isArray(candidate.highResOverlays)) {
    throw new Error('Invalid highResOverlays: expected an array.');
  }
  const highResOverlays = candidate.highResOverlays.map((overlay, index) => {
    const validatedOverlay = validateOverlayLayer(overlay, index);
    if (allowUnverifiedDevPreview) {
      assertDevLocalAssetPath(
        validatedOverlay.imagePath,
        `highResOverlays[${index}].imagePath`,
      );
    }
    return validatedOverlay;
  });

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
 * Validate an unknown static MapDatasetConfig input at runtime and enforce
 * the public deployment rights gate for public map imagery.
 */
export function validateMapDatasetConfig(candidate: unknown): MapDatasetConfig {
  return validateMapDatasetConfigInternal(candidate, false);
}

/**
 * Validate a development-only official Taego preview config served strictly
 * from local-only assets outside public/ and production builds.
 */
export function validateDevPreviewMapDatasetConfig(
  candidate: unknown,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): MapDatasetConfig {
  if (nodeEnv !== 'development') {
    throw new Error(
      'Dev-only official map preview is restricted to development environment.',
    );
  }
  return validateMapDatasetConfigInternal(candidate, true);
}

/**
 * Build and validate the local-only official 31.2 Taego preview dataset config
 * for side-by-side Palace/Terminal coordinate verification in development.
 */
export function createDevOfficialPreviewDatasetConfig(
  nodeEnv: string | undefined = process.env.NODE_ENV,
): MapDatasetConfig {
  return validateDevPreviewMapDatasetConfig(
    {
      mapId: 'taego',
      displayName: '태이고 (Taego)',
      canonicalSize: CANONICAL_MAP_SIZE,
      assetMode: 'official',
      baseImage: {
        imagePath: `${DEV_LOCAL_ASSET_PREFIX}${DEV_LOCAL_ASSET_FILES.basePreview}`,
        mapImageVersion: '31.2',
        pixelWidth: 2048,
        pixelHeight: 2048,
        rightsClearedForPublicDeploy: false,
      },
      highResOverlays: [
        {
          id: 'palace-31.2-crop',
          label: '궁전 (Palace) 31.2 고해상도 영역',
          imagePath: `${DEV_LOCAL_ASSET_PREFIX}${DEV_LOCAL_ASSET_FILES.palaceCrop}`,
          mapImageVersion: '31.2',
          bounds: PALACE_31_2_CANDIDATE_BOUNDS,
          minDisplayZoom: -2,
        },
        {
          id: 'terminal-31.2-crop',
          label: '터미널 (Terminal) 31.2 고해상도 영역',
          imagePath: `${DEV_LOCAL_ASSET_PREFIX}${DEV_LOCAL_ASSET_FILES.terminalCrop}`,
          mapImageVersion: '31.2',
          bounds: TERMINAL_31_2_CANDIDATE_BOUNDS,
          minDisplayZoom: -2,
        },
      ],
      targetZones: [
        {
          id: 'palace',
          displayName: '궁전 (Palace)',
          bounds: PALACE_31_2_CANDIDATE_BOUNDS,
          pilotReady: false,
          verifiedGamePatch: 'unverified',
        },
        {
          id: 'terminal',
          displayName: '터미널 (Terminal)',
          bounds: TERMINAL_31_2_CANDIDATE_BOUNDS,
          pilotReady: false,
          verifiedGamePatch: 'unverified',
        },
      ],
    },
    nodeEnv,
  );
}

/**
 * Server-side loader for the validated public MapDatasetConfig.
 */
export function loadPublicMapDatasetConfig(): MapDatasetConfig {
  return validateMapDatasetConfig(rawMapConfig);
}
