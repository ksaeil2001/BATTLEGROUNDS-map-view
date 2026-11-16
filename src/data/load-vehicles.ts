import rawVehicles from './vehicles.json';
import {
  assertEnumValue,
  assertNonEmptyString,
  assertValidCanonicalPoint,
  isRecord,
  validateUniqueRecordArray,
  validateVerificationRecord,
} from './validation-helpers';
import type {
  FixedVehicleSpawnRecord,
  MapAssetMode,
  VehicleGameMode,
  VehicleSpawnType,
} from '@/domain/types';
import { getPublicVehicles } from '@/domain/vehicles';

const VALID_GAME_MODES: readonly VehicleGameMode[] = [
  'normal',
  'ranked',
  'esports',
  'all-verified',
];

const VALID_SPAWN_TYPES: readonly VehicleSpawnType[] = ['garage', 'fixed-spot'];

const NEGATED_GUARANTEE_PATTERN =
  /(?:매\s*경기\s*)?(?:확정\s*출현|항상\s*출현)\s*(?:이\s*)?(?:아님|아닙니다|아니며|보장되지|보장하지)/gi;

const FORBIDDEN_SPAWN_CLAIM_PATTERN =
  /%|확정\s*출현|항상\s*출현|guaranteed(?!\s*(?:not|no))/i;

function assertNoUnverifiedSpawnClaim(value: string, label: string): string {
  const withoutNegatedDisclaimer = value.replace(NEGATED_GUARANTEE_PATTERN, '');
  if (FORBIDDEN_SPAWN_CLAIM_PATTERN.test(withoutNegatedDisclaimer)) {
    throw new Error(
      `Invalid ${label}: unverified probability percentages or guaranteed spawn claims are not permitted.`,
    );
  }
  return value;
}

function validateVehicleRecord(
  value: unknown,
  index: number,
): FixedVehicleSpawnRecord {
  if (!isRecord(value)) {
    throw new Error(`Invalid vehicles[${index}]: expected an object.`);
  }

  const id = assertNonEmptyString(value.id, `vehicles[${index}].id`);
  const recordLabel = `vehicle:${id}`;

  const zoneId = assertNonEmptyString(value.zoneId, `${recordLabel}.zoneId`);
  const coord = assertValidCanonicalPoint(value.coord, `${recordLabel}.coord`);
  const mapImageVersion = assertNonEmptyString(
    value.mapImageVersion,
    `${recordLabel}.mapImageVersion`,
  );
  const gameMode = assertEnumValue(
    value.gameMode,
    VALID_GAME_MODES,
    `${recordLabel}.gameMode`,
  );
  const spawnType = assertEnumValue(
    value.spawnType,
    VALID_SPAWN_TYPES,
    `${recordLabel}.spawnType`,
  );

  if (!Array.isArray(value.vehicleTypes) || value.vehicleTypes.length === 0) {
    throw new Error(
      `Invalid ${recordLabel}.vehicleTypes: expected a non-empty string array.`,
    );
  }

  const vehicleTypes = value.vehicleTypes.map((entry, entryIndex) => {
    const typeName = assertNonEmptyString(
      entry,
      `${recordLabel}.vehicleTypes[${entryIndex}]`,
    );
    return assertNoUnverifiedSpawnClaim(
      typeName,
      `${recordLabel}.vehicleTypes[${entryIndex}]`,
    );
  });

  const notes =
    value.notes === undefined
      ? undefined
      : assertNoUnverifiedSpawnClaim(
          assertNonEmptyString(value.notes, `${recordLabel}.notes`),
          `${recordLabel}.notes`,
        );

  const provenance = validateVerificationRecord(value.provenance, recordLabel);
  assertNoUnverifiedSpawnClaim(
    provenance.verificationSource,
    `${recordLabel}.provenance.verificationSource`,
  );

  return {
    id,
    zoneId,
    coord,
    mapImageVersion,
    gameMode,
    spawnType,
    vehicleTypes,
    ...(notes !== undefined ? { notes } : {}),
    provenance,
  };
}

/**
 * Validate an unknown static fixed vehicle spawn dataset at runtime.
 */
export function validateVehicleDataset(
  candidate: unknown,
): FixedVehicleSpawnRecord[] {
  return validateUniqueRecordArray(
    candidate,
    'vehicles',
    'vehicle',
    validateVehicleRecord,
  );
}

/**
 * Server-side loader returning only verified vehicle spawns compatible with the active asset mode.
 */
export function loadPublicVehicles(
  assetMode: MapAssetMode,
): FixedVehicleSpawnRecord[] {
  return getPublicVehicles(validateVehicleDataset(rawVehicles), assetMode);
}
