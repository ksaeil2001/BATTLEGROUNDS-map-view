/** Canonical Pixel Space edge length (8192 x 8192, origin at top-left). */
export const CANONICAL_MAP_SIZE = 8192 as const;

/** Canonical Pixel Space: 8192x8192 top-left (0, 0) pixel coordinate. */
export type CanonicalPoint = readonly [x: number, y: number];

/** Canonical rectangular region defined by [topLeft, bottomRight]. */
export type CanonicalBounds = readonly [
  topLeft: CanonicalPoint,
  bottomRight: CanonicalPoint,
];

/** Leaflet CRS.Simple coordinate tuple [lat, lng] mapped from [8192 - y, x]. */
export type LeafletLatLngTuple = readonly [lat: number, lng: number];

/** Leaflet CRS.Simple bounding box [southWest, northEast]. */
export type LeafletBoundsTuple = readonly [
  southWest: LeafletLatLngTuple,
  northEast: LeafletLatLngTuple,
];

export type MapAssetMode = 'sample' | 'official';

export interface MapOverlayLayer {
  id: string;
  label: string;
  imagePath: string;
  mapImageVersion: string;
  bounds: CanonicalBounds;
  minDisplayZoom?: number;
}

export interface TargetZone {
  id: string;
  displayName: string;
  bounds: CanonicalBounds;
  pilotReady: boolean;
  verifiedGamePatch: string;
}

export interface MapBaseImage {
  imagePath: string;
  mapImageVersion: string;
  pixelWidth: number;
  pixelHeight: number;
  rightsClearedForPublicDeploy: boolean;
}

export interface MapDatasetConfig {
  mapId: 'taego';
  canonicalSize: typeof CANONICAL_MAP_SIZE;
  assetMode: MapAssetMode;
  baseImage: MapBaseImage;
  highResOverlays: MapOverlayLayer[];
  targetZones: TargetZone[];
}
