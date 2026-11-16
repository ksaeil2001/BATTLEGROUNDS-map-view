import {
  CANONICAL_MAP_SIZE,
  type CanonicalBounds,
  type CanonicalPoint,
  type ImageDimensions,
  type LeafletBoundsTuple,
  type LeafletLatLngTuple,
  type MapDatasetConfig,
} from './types';

export interface ResolvedOverlayPlacement {
  id: string;
  imagePath: string;
  bounds: LeafletBoundsTuple;
  minDisplayZoom?: number;
}

export interface ResolvedTargetZonePlacement {
  id: string;
  displayName: string;
  bounds: LeafletBoundsTuple;
}

export interface MapLayerPlacement {
  baseImagePath: string;
  baseBounds: LeafletBoundsTuple;
  paddedMaxBounds: LeafletBoundsTuple;
  overlays: ResolvedOverlayPlacement[];
  targetZones: ResolvedTargetZonePlacement[];
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

function assertPositiveDimensions({
  pixelWidth,
  pixelHeight,
}: ImageDimensions): void {
  if (
    !Number.isFinite(pixelWidth) ||
    !Number.isFinite(pixelHeight) ||
    pixelWidth <= 0 ||
    pixelHeight <= 0
  ) {
    throw new Error('Image pixel dimensions must be positive finite numbers.');
  }
}

/**
 * Normalize raw pixel coordinates from an image of arbitrary resolution into
 * the 8192 x 8192 Canonical Pixel Space.
 */
export function imagePixelToCanonicalPoint(
  [pixelX, pixelY]: readonly [number, number],
  dimensions: ImageDimensions,
): CanonicalPoint {
  assertPositiveDimensions(dimensions);
  return [
    (pixelX / dimensions.pixelWidth) * CANONICAL_MAP_SIZE,
    (pixelY / dimensions.pixelHeight) * CANONICAL_MAP_SIZE,
  ];
}

/**
 * Project a Canonical Pixel Space point into the native pixel coordinates of
 * a specific image asset resolution (e.g., 2048x2048 vs 4096x4096).
 */
export function canonicalPointToImagePixel(
  [x, y]: CanonicalPoint,
  dimensions: ImageDimensions,
): [pixelX: number, pixelY: number] {
  assertPositiveDimensions(dimensions);
  return [
    (x / CANONICAL_MAP_SIZE) * dimensions.pixelWidth,
    (y / CANONICAL_MAP_SIZE) * dimensions.pixelHeight,
  ];
}

/**
 * Resolve all Leaflet CRS.Simple bounds for the base map, padded panning limit,
 * high-resolution overlays, and target zones in Canonical Pixel Space.
 */
export function resolveMapLayerPlacement(
  config: MapDatasetConfig,
): MapLayerPlacement {
  const padding = 2048;

  return {
    baseImagePath: config.baseImage.imagePath,
    baseBounds: toLeafletBounds([
      [0, 0],
      [config.canonicalSize, config.canonicalSize],
    ]),
    paddedMaxBounds: toLeafletBounds([
      [-padding, -padding],
      [config.canonicalSize + padding, config.canonicalSize + padding],
    ]),
    overlays: config.highResOverlays.map((overlay) => ({
      id: overlay.id,
      imagePath: overlay.imagePath,
      bounds: toLeafletBounds(overlay.bounds),
      minDisplayZoom: overlay.minDisplayZoom,
    })),
    targetZones: config.targetZones.map((zone) => ({
      id: zone.id,
      displayName: zone.displayName,
      bounds: toLeafletBounds(zone.bounds),
    })),
  };
}
