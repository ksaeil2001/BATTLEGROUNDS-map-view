import { describe, expect, it } from 'vitest';
import {
  loadPublicMapDatasetConfig,
  validateMapDatasetConfig,
} from '@/data/load-map-config';
import type { MapDatasetConfig } from '@/domain/types';

function makeValidSampleConfig(): MapDatasetConfig {
  return {
    mapId: 'taego',
    canonicalSize: 8192,
    assetMode: 'sample',
    baseImage: {
      imagePath: '/maps/taego-sample-base.svg',
      mapImageVersion: 'sample-v1',
      pixelWidth: 2048,
      pixelHeight: 2048,
      rightsClearedForPublicDeploy: true,
    },
    highResOverlays: [
      {
        id: 'palace-sample-crop',
        label: '궁전 (Palace) 샘플 고해상도 영역',
        imagePath: '/maps/taego-sample-palace-overlay.svg',
        mapImageVersion: 'sample-v1',
        bounds: [
          [3600, 2200],
          [4400, 3000],
        ],
      },
    ],
    targetZones: [
      {
        id: 'palace',
        displayName: '궁전 (Palace)',
        bounds: [
          [3600, 2200],
          [4400, 3000],
        ],
        pilotReady: false,
        verifiedGamePatch: 'sample-only',
      },
    ],
  };
}

describe('Static MapDatasetConfig loader and rightsClearedForPublicDeploy gate', () => {
  it('loads the static Taego sample dataset config cleared for public deploy', () => {
    const config = loadPublicMapDatasetConfig();

    expect(config.mapId).toBe('taego');
    expect(config.canonicalSize).toBe(8192);
    expect(config.assetMode).toBe('sample');
    expect(config.baseImage.rightsClearedForPublicDeploy).toBe(true);
    expect(config.targetZones.some((zone) => zone.id === 'palace')).toBe(true);
    expect(config.highResOverlays.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects any dataset whose base image is not cleared for public deployment', () => {
    const unclearedSample = makeValidSampleConfig();
    unclearedSample.baseImage.rightsClearedForPublicDeploy = false;

    expect(() => validateMapDatasetConfig(unclearedSample)).toThrow(
      /rightsClearedForPublicDeploy/i,
    );

    const unclearedOfficial: MapDatasetConfig = {
      ...makeValidSampleConfig(),
      assetMode: 'official',
      baseImage: {
        ...makeValidSampleConfig().baseImage,
        imagePath: '/maps/taego-official-31.2.webp',
        mapImageVersion: '31.2',
        rightsClearedForPublicDeploy: false,
      },
    };

    expect(() => validateMapDatasetConfig(unclearedOfficial)).toThrow(
      /rightsClearedForPublicDeploy/i,
    );
  });

  it('rejects TargetZone or highResOverlays bounds outside 0..8192 or inverted rectangles', () => {
    const outOfRangeZone = makeValidSampleConfig();
    outOfRangeZone.targetZones[0].bounds = [
      [-10, 2200],
      [4400, 3000],
    ];
    expect(() => validateMapDatasetConfig(outOfRangeZone)).toThrow(/bounds/i);

    const oversizedOverlay = makeValidSampleConfig();
    oversizedOverlay.highResOverlays[0].bounds = [
      [3600, 2200],
      [8200, 3000],
    ];
    expect(() => validateMapDatasetConfig(oversizedOverlay)).toThrow(/bounds/i);

    const invertedZone = makeValidSampleConfig();
    invertedZone.targetZones[0].bounds = [
      [4400, 3000],
      [3600, 2200],
    ];
    expect(() => validateMapDatasetConfig(invertedZone)).toThrow(/bounds/i);
  });
});
