import { assertPositiveDimensions, toLeafletLatLng } from './map-coordinates';
import type {
  FixedVehicleSpawnRecord,
  ImageDimensions,
  LeafletLatLngTuple,
  VehicleSpawnType,
} from './types';

export interface VehicleSpawnPlacement {
  id: string;
  spawnType: VehicleSpawnType;
  latLng: LeafletLatLngTuple;
}

/**
 * Filter fixed vehicle spawn records to only those verified for public view.
 */
export function getPublicVehicles(
  vehicles: readonly FixedVehicleSpawnRecord[],
): FixedVehicleSpawnRecord[] {
  return vehicles.filter(
    (vehicle) => vehicle.provenance.verificationStatus === 'verified',
  );
}

/**
 * Resolve Leaflet CRS.Simple marker coordinates for verified vehicle spawns
 * independently of the base image pixel dimensions.
 */
export function resolveVehicleSpawnPlacements(
  vehicles: readonly FixedVehicleSpawnRecord[],
  baseImage: ImageDimensions,
): VehicleSpawnPlacement[] {
  assertPositiveDimensions(baseImage);

  return getPublicVehicles(vehicles).map((vehicle) => ({
    id: vehicle.id,
    spawnType: vehicle.spawnType,
    latLng: toLeafletLatLng(vehicle.coord),
  }));
}
