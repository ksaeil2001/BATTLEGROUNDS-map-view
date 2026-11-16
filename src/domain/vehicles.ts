import {
  assertPositiveDimensions,
  isRecordCompatibleWithAssetMode,
  toLeafletLatLng,
} from './map-coordinates';
import type {
  FixedVehicleSpawnRecord,
  ImageDimensions,
  LeafletLatLngTuple,
  MapAssetMode,
  VehicleSpawnType,
} from './types';

export interface VehicleSpawnPlacement {
  id: string;
  spawnType: VehicleSpawnType;
  latLng: LeafletLatLngTuple;
}

/**
 * Filter fixed vehicle spawn records to only those verified for public view
 * and compatible with the active map asset mode.
 */
export function getPublicVehicles(
  vehicles: readonly FixedVehicleSpawnRecord[],
  assetMode: MapAssetMode = 'sample',
): FixedVehicleSpawnRecord[] {
  return vehicles.filter(
    (vehicle) =>
      vehicle.provenance.verificationStatus === 'verified' &&
      isRecordCompatibleWithAssetMode(vehicle.mapImageVersion, assetMode),
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
