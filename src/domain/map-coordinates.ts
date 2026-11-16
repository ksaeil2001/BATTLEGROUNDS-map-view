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
  const [northLat, westLng] = toLeafletLatLng(topLeft);
  const [southLat, eastLng] = toLeafletLatLng(bottomRight);
  return [
    [southLat, westLng],
    [northLat, eastLng],
  ];
}

export function assertPositiveDimensions({
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
 * Resolve all Leaflet CRS.Simple bounds for the base map, padded panning limit,
 * high-resolution overlays, and target zones in Canonical Pixel Space.
 */
export function resolveMapLayerPlacement(
  config: MapDatasetConfig,
): MapLayerPlacement {
  assertPositiveDimensions(config.baseImage);

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
