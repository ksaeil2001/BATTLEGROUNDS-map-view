import { describe, expect, it } from 'vitest';
import {
  canonicalPointToImagePixel,
  imagePixelToCanonicalPoint,
  resolveMapLayerPlacement,
  toCanonicalPixel,
  toLeafletBounds,
  toLeafletLatLng,
} from '@/domain/map-coordinates';
import type { MapDatasetConfig } from '@/domain/types';

function createSampleDataset(pixelSize: number): MapDatasetConfig {
  return {
    mapId: 'taego',
    canonicalSize: 8192,
    assetMode: 'sample',
    baseImage: {
      imagePath: '/maps/taego-sample-base.svg',
      mapImageVersion: 'sample-v1',
      pixelWidth: pixelSize,
      pixelHeight: pixelSize,
      rightsClearedForPublicDeploy: true,
    },
    highResOverlays: [
      {
        id: 'palace-sample-crop',
        label: '궁전 (Palace) 샘플 고해상도 영역',
        imagePath: '/maps/taego-sample-palace-overlay.svg',
        mapImageVersion: 'sample-v1',
        rightsClearedForPublicDeploy: true,
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
        verifiedGamePatch: null,
      },
    ],
  };
}

describe('Canonical Pixel Space (8192x8192) coordinate system', () => {
  it('maps top-left (0, 0), center (4096, 4096), and bottom-right (8192, 8192) boundary points', () => {
    expect(toLeafletLatLng([0, 0])).toEqual([8192, 0]);
    expect(toLeafletLatLng([4096, 4096])).toEqual([4096, 4096]);
    expect(toLeafletLatLng([8192, 8192])).toEqual([0, 8192]);
  });

  it('maps remaining map corners and asymmetric canonical coordinates', () => {
    expect(toLeafletLatLng([8192, 0])).toEqual([8192, 8192]);
    expect(toLeafletLatLng([0, 8192])).toEqual([0, 0]);
    expect(toLeafletLatLng([3600, 2200])).toEqual([5992, 3600]);
  });

  it('inverts Leaflet [lat, lng] coordinates back to CanonicalPoint [x, y]', () => {
    expect(toCanonicalPixel([8192, 0])).toEqual([0, 0]);
    expect(toCanonicalPixel([4096, 4096])).toEqual([4096, 4096]);
    expect(toCanonicalPixel([0, 8192])).toEqual([8192, 8192]);
    expect(toCanonicalPixel([5992, 3600])).toEqual([3600, 2200]);
  });

  it('converts CanonicalBounds [topLeft, bottomRight] to Leaflet [southWest, northEast] bounds', () => {
    expect(
      toLeafletBounds([
        [0, 0],
        [8192, 8192],
      ]),
    ).toEqual([
      [0, 0],
      [8192, 8192],
    ]);

    expect(
      toLeafletBounds([
        [3600, 2200],
        [4400, 3000],
      ]),
    ).toEqual([
      [5192, 3600],
      [5992, 4400],
    ]);
  });

  it('maps a CanonicalPoint across 2048x2048 and 4096x4096 source images while landing on the exact same Leaflet coordinate', () => {
    const config2k = createSampleDataset(2048);
    const config4k = createSampleDataset(4096);

    const pixel2k = canonicalPointToImagePixel([3920, 2540], config2k.baseImage);
    const pixel4k = canonicalPointToImagePixel([3920, 2540], config4k.baseImage);

    expect(pixel2k).toEqual([980, 635]);
    expect(pixel4k).toEqual([1960, 1270]);

    const normalizedFrom2k = imagePixelToCanonicalPoint(
      pixel2k,
      config2k.baseImage,
    );
    const normalizedFrom4k = imagePixelToCanonicalPoint(
      pixel4k,
      config4k.baseImage,
    );

    expect(normalizedFrom2k).toEqual([3920, 2540]);
    expect(normalizedFrom4k).toEqual([3920, 2540]);
    expect(toLeafletLatLng(normalizedFrom2k)).toEqual([5652, 3920]);
    expect(toLeafletLatLng(normalizedFrom4k)).toEqual([5652, 3920]);

    const placement2k = resolveMapLayerPlacement(config2k);
    const placement4k = resolveMapLayerPlacement(config4k);
    expect(placement2k.baseBounds).toEqual([
      [0, 0],
      [8192, 8192],
    ]);
    expect(placement2k).toEqual(placement4k);
  });
});
