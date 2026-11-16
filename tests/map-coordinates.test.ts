import { describe, expect, it } from 'vitest';
import { loadPublicMapDatasetConfig } from '@/data/load-map-config';
import {
  resolveMapLayerPlacement,
  toCanonicalPixel,
  toLeafletBounds,
  toLeafletLatLng,
} from '@/domain/map-coordinates';

describe('Canonical Pixel Space (8192x8192) coordinate system', () => {
  it('maps top-left (0, 0), center (4096, 4096), and bottom-right (8192, 8192) boundary points to [8192 - y, x]', () => {
    expect([
      toLeafletLatLng([0, 0]),
      toLeafletLatLng([4096, 4096]),
      toLeafletLatLng([8192, 8192]),
    ]).toEqual([
      [8192, 0],
      [4096, 4096],
      [0, 8192],
    ]);
  });

  it('maps top-right (8192, 0), bottom-left (0, 8192), and asymmetric canonical points', () => {
    expect([
      toLeafletLatLng([8192, 0]),
      toLeafletLatLng([0, 8192]),
      toLeafletLatLng([3600, 2200]),
    ]).toEqual([
      [8192, 8192],
      [0, 0],
      [5992, 3600],
    ]);
  });

  it('inverts Leaflet [lat, lng] coordinates back to CanonicalPoint [x, y]', () => {
    expect([
      toCanonicalPixel([8192, 0]),
      toCanonicalPixel([4096, 4096]),
      toCanonicalPixel([0, 8192]),
      toCanonicalPixel([5992, 3600]),
    ]).toEqual([
      [0, 0],
      [4096, 4096],
      [8192, 8192],
      [3600, 2200],
    ]);
  });

  it('converts CanonicalBounds [topLeft, bottomRight] to Leaflet [southWest, northEast] bounds', () => {
    expect([
      toLeafletBounds([
        [0, 0],
        [8192, 8192],
      ]),
      toLeafletBounds([
        [3600, 2200],
        [4400, 3000],
      ]),
    ]).toEqual([
      [
        [0, 0],
        [8192, 8192],
      ],
      [
        [5192, 3600],
        [5992, 4400],
      ],
    ]);
  });

  it('maps the same CanonicalPoint and layer bounds to identical Leaflet positions across 2048x2048 and 4096x4096 base images', () => {
    const config2k = structuredClone(loadPublicMapDatasetConfig());
    config2k.baseImage.pixelWidth = 2048;
    config2k.baseImage.pixelHeight = 2048;

    const config4k = structuredClone(loadPublicMapDatasetConfig());
    config4k.baseImage.pixelWidth = 4096;
    config4k.baseImage.pixelHeight = 4096;

    const placement2k = resolveMapLayerPlacement(config2k);
    const placement4k = resolveMapLayerPlacement(config4k);

    expect(placement2k.baseBounds).toEqual([
      [0, 0],
      [8192, 8192],
    ]);
    expect(placement2k.overlays[0]?.bounds).toEqual([
      [5192, 3600],
      [5992, 4400],
    ]);
    expect(placement4k).toEqual(placement2k);
  });

  it('rejects non-positive baseImage dimensions when resolving layer placement', () => {
    const invalidConfig = structuredClone(loadPublicMapDatasetConfig());
    invalidConfig.baseImage.pixelWidth = 0;

    expect(() => resolveMapLayerPlacement(invalidConfig)).toThrow(
      /positive finite numbers/i,
    );
  });
});
