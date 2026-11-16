import { describe, expect, it } from 'vitest';
import {
  imagePixelToCanonicalPoint,
  resolveMapLayerPlacement,
  toCanonicalPixel,
  toLeafletBounds,
  toLeafletLatLng,
} from '@/domain/map-coordinates';
import type { MapDatasetConfig } from '@/domain/types';

function createTestConfig(pixelSize: number): MapDatasetConfig {
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

describe('Canonical Pixel Space (8192x8192) <-> Leaflet CRS.Simple conversion', () => {
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

  it('normalizes source image pixels across 2048x2048 and 4096x4096 resolutions into identical canonical and Leaflet coordinates', () => {
    const centerFrom2k = imagePixelToCanonicalPoint([1024, 1024], {
      pixelWidth: 2048,
      pixelHeight: 2048,
    });
    const centerFrom4k = imagePixelToCanonicalPoint([2048, 2048], {
      pixelWidth: 4096,
      pixelHeight: 4096,
    });

    expect(centerFrom2k).toEqual([4096, 4096]);
    expect(centerFrom4k).toEqual([4096, 4096]);
    expect(toLeafletLatLng(centerFrom2k)).toEqual([4096, 4096]);
    expect(toLeafletLatLng(centerFrom4k)).toEqual([4096, 4096]);

    const quarterFrom2k = imagePixelToCanonicalPoint([512, 1536], {
      pixelWidth: 2048,
      pixelHeight: 2048,
    });
    const quarterFrom4k = imagePixelToCanonicalPoint([1024, 3072], {
      pixelWidth: 4096,
      pixelHeight: 4096,
    });

    expect(quarterFrom2k).toEqual([2048, 6144]);
    expect(quarterFrom4k).toEqual([2048, 6144]);
    expect(toLeafletLatLng(quarterFrom2k)).toEqual([2048, 2048]);
    expect(toLeafletLatLng(quarterFrom4k)).toEqual([2048, 2048]);
  });

  it('keeps base map, high-res overlay, target zone, and point placement invariant when base image resolution changes from 2048x2048 to 4096x4096', () => {
    const placement2k = resolveMapLayerPlacement(createTestConfig(2048), [
      3920, 2540,
    ]);
    const placement4k = resolveMapLayerPlacement(createTestConfig(4096), [
      3920, 2540,
    ]);

    expect(placement2k.baseLeafletBounds).toEqual([
      [0, 0],
      [8192, 8192],
    ]);
    expect(placement2k.pointLatLng).toEqual([5652, 3920]);
    expect(placement2k).toEqual(placement4k);
  });
});
