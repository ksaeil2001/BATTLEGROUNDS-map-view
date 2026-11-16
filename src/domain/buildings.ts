import { assertPositiveDimensions, toLeafletLatLng } from './map-coordinates';
import type {
  BuildingRecord,
  CanonicalPoint,
  ImageDimensions,
  LeafletLatLngTuple,
} from './types';

const SEGMENT_EPSILON = 1e-9;

export interface BuildingFootprintPlacement {
  id: string;
  latLngs: LeafletLatLngTuple[];
}

function isFinitePoint([x, y]: CanonicalPoint): boolean {
  return Number.isFinite(x) && Number.isFinite(y);
}

function isPointOnSegment(
  point: CanonicalPoint,
  a: CanonicalPoint,
  b: CanonicalPoint,
): boolean {
  const [px, py] = point;
  const [ax, ay] = a;
  const [bx, by] = b;

  const cross = (py - ay) * (bx - ax) - (px - ax) * (by - ay);
  if (Math.abs(cross) > SEGMENT_EPSILON) {
    return false;
  }

  return (
    px >= Math.min(ax, bx) - SEGMENT_EPSILON &&
    px <= Math.max(ax, bx) + SEGMENT_EPSILON &&
    py >= Math.min(ay, by) - SEGMENT_EPSILON &&
    py <= Math.max(ay, by) + SEGMENT_EPSILON
  );
}

/**
 * Even-odd point-in-polygon hit test in Canonical Pixel Space.
 * Boundary edges and vertices are treated deterministically as inside.
 */
export function isPointInPolygon(
  point: CanonicalPoint,
  polygon: readonly CanonicalPoint[],
): boolean {
  if (!isFinitePoint(point) || polygon.length < 3) {
    return false;
  }

  const [px, py] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const current = polygon[i]!;
    const previous = polygon[j]!;

    if (isPointOnSegment(point, previous, current)) {
      return true;
    }

    const [xi, yi] = current;
    const [xj, yj] = previous;
    const crossesRay =
      (yi > py) !== (yj > py) &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (crossesRay) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Filter building records to only those explicitly verified for public view.
 */
export function getPublicBuildings(
  buildings: readonly BuildingRecord[],
): BuildingRecord[] {
  return buildings.filter(
    (building) => building.provenance.verificationStatus === 'verified',
  );
}

/**
 * Find the verified building whose Roof Footprint contains the canonical point,
 * or return null for unregistered/unverified space, roads, alleys, and cutouts.
 */
export function findBuildingAtPoint(
  point: CanonicalPoint,
  buildings: readonly BuildingRecord[],
): BuildingRecord | null {
  for (const building of getPublicBuildings(buildings)) {
    if (isPointInPolygon(point, building.footprint)) {
      return building;
    }
  }
  return null;
}

/**
 * Resolve Leaflet CRS.Simple polygon placements for verified buildings without
 * depending on the base image pixel dimensions.
 */
export function resolveBuildingFootprintPlacements(
  buildings: readonly BuildingRecord[],
  baseImage: ImageDimensions,
): BuildingFootprintPlacement[] {
  assertPositiveDimensions(baseImage);

  return getPublicBuildings(buildings).map((building) => ({
    id: building.id,
    latLngs: building.footprint.map(toLeafletLatLng),
  }));
}
