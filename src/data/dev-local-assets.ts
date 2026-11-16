import fs from 'node:fs';
import path from 'node:path';
import {
  DEV_LOCAL_ASSET_FILES,
  createDevOfficialPreviewDatasetConfig,
} from './load-map-config';
import type { MapDatasetConfig } from '@/domain/types';

const DEV_LOCAL_ASSET_DIR_SEGMENTS = ['.local-assets', 'taego-31.2'] as const;

export const ALLOWED_DEV_LOCAL_ASSETS: ReadonlySet<string> = new Set(
  Object.values(DEV_LOCAL_ASSET_FILES),
);

function resolveDevLocalAssetPath(
  assetName: string,
  rootDir: string,
  nodeEnv: string | undefined,
): string | null {
  if (nodeEnv !== 'development' || !ALLOWED_DEV_LOCAL_ASSETS.has(assetName)) {
    return null;
  }

  return path.join(rootDir, ...DEV_LOCAL_ASSET_DIR_SEGMENTS, assetName);
}

/**
 * Check whether all required local-only 31.2 Taego verification assets exist
 * on disk in development mode.
 */
export function hasDevLocalOfficialAssets(
  rootDir: string = process.cwd(),
  nodeEnv: string | undefined = process.env.NODE_ENV,
): boolean {
  if (nodeEnv !== 'development') {
    return false;
  }

  for (const assetName of ALLOWED_DEV_LOCAL_ASSETS) {
    const filePath = resolveDevLocalAssetPath(assetName, rootDir, nodeEnv);
    if (!filePath || !fs.existsSync(filePath)) {
      return false;
    }
  }
  return true;
}

/**
 * Load the development-only official 31.2 preview dataset config when all
 * local-only assets are present on disk. Always returns null outside development.
 */
export function loadDevOfficialPreviewDatasetConfigIfAvailable(
  rootDir: string = process.cwd(),
  nodeEnv: string | undefined = process.env.NODE_ENV,
): MapDatasetConfig | null {
  if (!hasDevLocalOfficialAssets(rootDir, nodeEnv)) {
    return null;
  }
  return createDevOfficialPreviewDatasetConfig(nodeEnv);
}

/**
 * Read a whitelisted local-only Taego 31.2 verification asset in development.
 * Always returns null outside development or for unlisted/traversal filenames.
 */
export function readDevLocalAssetFile(
  assetName: string,
  rootDir: string = process.cwd(),
  nodeEnv: string | undefined = process.env.NODE_ENV,
): Buffer | null {
  const filePath = resolveDevLocalAssetPath(assetName, rootDir, nodeEnv);
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  return fs.readFileSync(filePath);
}
