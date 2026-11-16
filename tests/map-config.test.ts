import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  loadDevOfficialPreviewDatasetConfigIfAvailable,
  readDevLocalAssetFile,
} from '@/data/dev-local-assets';
import {
  DEV_LOCAL_ASSET_PREFIX,
  createDevOfficialPreviewDatasetConfig,
  loadPublicMapDatasetConfig,
  validateDevPreviewMapDatasetConfig,
  validateMapDatasetConfig,
} from '@/data/load-map-config';

describe('Static MapDatasetConfig loader and rightsClearedForPublicDeploy gate', () => {
  it('loads the static Taego sample dataset config cleared for public deploy', () => {
    const config = loadPublicMapDatasetConfig();

    expect({
      mapId: config.mapId,
      canonicalSize: config.canonicalSize,
      assetMode: config.assetMode,
      rightsCleared: config.baseImage.rightsClearedForPublicDeploy,
      zoneIds: config.targetZones.map((zone) => zone.id),
    }).toEqual({
      mapId: 'taego',
      canonicalSize: 8192,
      assetMode: 'sample',
      rightsCleared: true,
      zoneIds: ['palace'],
    });
  });

  it('rejects a dataset when baseImage.rightsClearedForPublicDeploy is false', () => {
    const unclearedSample = structuredClone(loadPublicMapDatasetConfig());
    unclearedSample.baseImage.rightsClearedForPublicDeploy = false;

    expect(() => validateMapDatasetConfig(unclearedSample)).toThrow(
      /rightsClearedForPublicDeploy/i,
    );
  });

  it('rejects an official dataset when rightsClearedForPublicDeploy is false', () => {
    const unclearedOfficial = structuredClone(loadPublicMapDatasetConfig());
    unclearedOfficial.assetMode = 'official';
    unclearedOfficial.baseImage.imagePath = '/maps/taego-official-31.2.webp';
    unclearedOfficial.baseImage.mapImageVersion = '31.2';
    unclearedOfficial.baseImage.rightsClearedForPublicDeploy = false;

    expect(() => validateMapDatasetConfig(unclearedOfficial)).toThrow(
      /rightsClearedForPublicDeploy/i,
    );
  });

  it('rejects non-finite baseImage pixel dimensions', () => {
    const nanDimensions = structuredClone(loadPublicMapDatasetConfig());
    nanDimensions.baseImage.pixelWidth = Number.NaN;

    expect(() => validateMapDatasetConfig(nanDimensions)).toThrow(
      /pixelWidth/i,
    );
  });

  it('rejects whitespace-only string fields', () => {
    const emptyPath = structuredClone(loadPublicMapDatasetConfig());
    emptyPath.baseImage.imagePath = '   ';

    expect(() => validateMapDatasetConfig(emptyPath)).toThrow(/imagePath/i);
  });

  it('rejects canonical bounds outside 0..8192', () => {
    const outOfRangeZone = structuredClone(loadPublicMapDatasetConfig());
    outOfRangeZone.targetZones[0].bounds = [
      [-10, 2200],
      [4400, 3000],
    ];

    expect(() => validateMapDatasetConfig(outOfRangeZone)).toThrow(/bounds/i);
  });

  it('rejects inverted canonical bounds where topLeft >= bottomRight', () => {
    const invertedZone = structuredClone(loadPublicMapDatasetConfig());
    invertedZone.targetZones[0].bounds = [
      [4400, 3000],
      [3600, 2200],
    ];

    expect(() => validateMapDatasetConfig(invertedZone)).toThrow(/bounds/i);
  });

  it('rejects a pilotReady TargetZone when verifiedGamePatch is unverified', () => {
    const inconsistentZone = structuredClone(loadPublicMapDatasetConfig());
    inconsistentZone.targetZones[0].pilotReady = true;
    inconsistentZone.targetZones[0].verifiedGamePatch = 'unverified';

    expect(() => validateMapDatasetConfig(inconsistentZone)).toThrow(
      /verifiedGamePatch/i,
    );
  });
});

describe('Dev-only official 31.2 preview MapDatasetConfig validation', () => {
  it('accepts an official 31.2 dev preview config with rightsClearedForPublicDeploy=false and dev-local-assets paths in development', () => {
    const devConfig = createDevOfficialPreviewDatasetConfig('development');
    const validated = validateDevPreviewMapDatasetConfig(
      devConfig,
      'development',
    );

    expect(validated).toEqual(devConfig);
    expect(validated.assetMode).toBe('official');
    expect(validated.baseImage.rightsClearedForPublicDeploy).toBe(false);
    expect(validated.baseImage.imagePath.startsWith(DEV_LOCAL_ASSET_PREFIX)).toBe(
      true,
    );
    expect(validated.targetZones).toEqual([
      {
        id: 'palace',
        displayName: '궁전 (Palace)',
        bounds: [
          [2750, 3400],
          [3350, 3950],
        ],
        pilotReady: false,
        verifiedGamePatch: 'unverified',
      },
      {
        id: 'terminal',
        displayName: '터미널 (Terminal)',
        bounds: [
          [4300, 3400],
          [4950, 3880],
        ],
        pilotReady: false,
        verifiedGamePatch: 'unverified',
      },
    ]);
  });

  it('rejects dev official preview config outside development mode', () => {
    const devConfig = createDevOfficialPreviewDatasetConfig('development');

    expect(() =>
      validateDevPreviewMapDatasetConfig(devConfig, 'production'),
    ).toThrow(/development/i);
    expect(() =>
      createDevOfficialPreviewDatasetConfig('production'),
    ).toThrow(/development/i);
  });

  it('rejects dev preview configs whose base or overlay paths point to public/ maps instead of dev-local-assets', () => {
    const publicPathBase = structuredClone(
      createDevOfficialPreviewDatasetConfig('development'),
    );
    publicPathBase.baseImage.imagePath = '/maps/taego-official-31.2.png';

    expect(() =>
      validateDevPreviewMapDatasetConfig(publicPathBase, 'development'),
    ).toThrow(/dev-local-assets/i);

    const publicPathOverlay = structuredClone(
      createDevOfficialPreviewDatasetConfig('development'),
    );
    publicPathOverlay.highResOverlays[0]!.imagePath =
      '/maps/palace-31.2-crop.png';

    expect(() =>
      validateDevPreviewMapDatasetConfig(publicPathOverlay, 'development'),
    ).toThrow(/dev-local-assets/i);
  });
});

describe('Local-only dev asset loader and path whitelist', () => {
  it('always returns null outside development mode', () => {
    expect(
      loadDevOfficialPreviewDatasetConfigIfAvailable(
        process.cwd(),
        'production',
      ),
    ).toBeNull();
    expect(
      readDevLocalAssetFile(
        'taego-31.2-base-preview.png',
        process.cwd(),
        'production',
      ),
    ).toBeNull();
    expect(
      readDevLocalAssetFile(
        'palace-31.2-highres-crop.png',
        process.cwd(),
        'test',
      ),
    ).toBeNull();
  });

  it('rejects unlisted filenames and path traversal attempts', () => {
    expect(
      readDevLocalAssetFile('../map-config.json', process.cwd(), 'development'),
    ).toBeNull();
    expect(
      readDevLocalAssetFile(
        '..\\src\\data\\map-config.json',
        process.cwd(),
        'development',
      ),
    ).toBeNull();
    expect(
      readDevLocalAssetFile(
        'Taego_Main_High_Res.png',
        process.cwd(),
        'development',
      ),
    ).toBeNull();
  });

  it('loads the validated 31.2 dev preview config and reads PNG buffers from a local asset root without touching repo files', () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'taego-dev-assets-'));
    const assetDir = path.join(tmpRoot, '.local-assets', 'taego-31.2');
    fs.mkdirSync(assetDir, { recursive: true });

    const pngHeader = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const requiredFiles = [
      'taego-31.2-base-preview.png',
      'palace-31.2-highres-crop.png',
      'terminal-31.2-highres-crop.png',
    ];

    try {
      // Missing files return null cleanly (safe on clean CI checkouts)
      expect(
        loadDevOfficialPreviewDatasetConfigIfAvailable(tmpRoot, 'development'),
      ).toBeNull();

      for (const filename of requiredFiles) {
        fs.writeFileSync(path.join(assetDir, filename), pngHeader);
      }

      const config = loadDevOfficialPreviewDatasetConfigIfAvailable(
        tmpRoot,
        'development',
      );
      expect(config).not.toBeNull();
      expect(config?.assetMode).toBe('official');
      expect(config?.baseImage.mapImageVersion).toBe('31.2');
      expect(config?.baseImage.rightsClearedForPublicDeploy).toBe(false);

      for (const filename of requiredFiles) {
        const buffer = readDevLocalAssetFile(filename, tmpRoot, 'development');
        expect(buffer).not.toBeNull();
        expect(buffer!.subarray(0, 4)).toEqual(
          Buffer.from([0x89, 0x50, 0x4e, 0x47]),
        );
      }
    } finally {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    }
  });
});
