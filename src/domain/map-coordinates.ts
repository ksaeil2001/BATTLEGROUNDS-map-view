import {
  CANONICAL_MAP_SIZE,
  type CanonicalBounds,
  type CanonicalPoint,
  type LeafletBoundsTuple,
  type LeafletLatLngTuple,
  type MapDatasetConfig,
} from './types';

export interface ImageDimensions {
  pixelWidth: number;
  pixelHeight: number;
}

export interface MapLayerPlacement {
  baseLeafletBounds: LeafletBoundsTuple;
  pointLatLng: LeafletLatLngTuple;
  overlayBounds: Array<{ id: string; leafletBounds: LeafletBoundsTuple }>;
  targetZoneBounds: Array<{ id: string; leafletBounds: LeafletBoundsTuple }>;
}

/**
 * Convert a top-left Canonical Pixel Space coordinate [x, y] into a Leaflet
 * CRS.Simple tuple [lat, lng] = [8192 - y, x].
 */
export function toLeafletLatLng([x, y]: CanonicalPoint): LeafletLatLngTuple {
  return [CANONICAL_MAP_SIZE - y, x];
}

/**
 * Convert a Leaflet CRS.Simple tuple [lat, lng] back into Canonical Pixel Space [x, y].
 */
export function toCanonicalPixel([lat, lng]: LeafletLatLngTuple): CanonicalPoint {
  return [lng, CANONICAL_MAP_SIZE - lat];
}

/**
 * Convert a canonical [topLeft, bottomRight] bounding box into Leaflet
 * [southWest, northEast] bounds.
 */
export function toLeafletBounds([
  topLeft,
  bottomRight,
]: CanonicalBounds): LeafletBoundsTuple {
  const southWest: LeafletLatLngTuple = [
    CANONICAL_MAP_SIZE - bottomRight[1],
    topLeft[0],
  ];
  const northEast: LeafletLatLngTuple = [
    CANONICAL_MAP_SIZE - topLeft[1],
    bottomRight[0],
  ];
  return [southWest, northEast];
}

/**
 * Normalize raw pixel coordinates from an image of arbitrary resolution into
 * the 8192 x 8192 Canonical Pixel Space.
 */
export function imagePixelToCanonicalPoint(
  [pixelX, pixelY]: readonly [number, number],
  { pixelWidth, pixelHeight }: ImageDimensions,
): CanonicalPoint {
  if (pixelWidth <= 0 || pixelHeight <= 0) {
    throw new Error('Image pixel dimensions must be positive numbers.');
  }

  return [
    (pixelX / pixelWidth) * CANONICAL_MAP_SIZE,
    (pixelY / pixelHeight) * CANONICAL_MAP_SIZE,
  ];
}

/**
 * Resolve Leaflet CRS.Simple bounds and point placement purely in Canonical Pixel Space,
 * remaining invariant across base image resolutions (e.g., 2048x2048 vs 4096x4096).
 */
export function resolveMapLayerPlacement(
  config: MapDatasetConfig,
  point: CanonicalPoint,
): MapLayerPlacement {
  const fullBounds: CanonicalBounds = [
    [0, 0],
    [config.canonicalSize, config.canonicalSize],
  ];

  return {
    baseLeafletBounds: toLeafletBounds(fullBounds),
    pointLatLng: toLeafletLatLng(point),
    overlayBounds: config.highResOverlays.map((overlay) => ({
      id: overlay.id,
      leafletBounds: toLeafletBounds(overlay.bounds),
    })),
    targetZoneBounds: config.targetZones.map((zone) => ({
      id: zone.id,
      leafletBounds: toLeafletBounds(zone.bounds),
    })),
  };
}
