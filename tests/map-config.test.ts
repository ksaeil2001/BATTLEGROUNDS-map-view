import { describe, expect, it } from 'vitest';
import {
  loadPublicMapDatasetConfig,
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
