import rawBuildings from './buildings.json';
import {
  assertEnumValue,
  assertNonEmptyString,
  assertValidCanonicalPoint,
  isRecord,
  validateUniqueRecordArray,
  validateVerificationRecord,
} from './validation-helpers';
import { getPublicBuildings } from '@/domain/buildings';
import type {
  BuildingAttributes,
  BuildingEntrancesValue,
  BuildingExteriorImage,
  BuildingRecord,
  RooftopAccessKind,
  RooftopAccessValue,
  VerifiableField,
} from '@/domain/types';

const VALID_ROOFTOP_ACCESS_KINDS: readonly RooftopAccessKind[] = [
  'interior-stairs',
  'exterior-climb',
  'inaccessible',
];

function validateVerifiableField<T>(
  candidate: unknown,
  label: string,
  validateValue: (value: unknown, valueLabel: string) => T,
): VerifiableField<T> {
  if (!isRecord(candidate)) {
    throw new Error(`Invalid ${label}: expected VerifiableField object.`);
  }

  if (candidate.status === 'unverified') {
    if (
      candidate.note !== undefined &&
      (typeof candidate.note !== 'string' || candidate.note.trim().length === 0)
    ) {
      throw new Error(`Invalid ${label}.note: expected non-empty string.`);
    }
    return candidate.note !== undefined
      ? { status: 'unverified', note: candidate.note }
      : { status: 'unverified' };
  }

  if (candidate.status === 'verified') {
    return {
      status: 'verified',
      value: validateValue(candidate.value, `${label}.value`),
    };
  }

  throw new Error(
    `Invalid ${label}.status: expected "verified" or "unverified".`,
  );
}

function validateFloorsValue(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid ${label}: expected an integer >= 1.`);
  }
  return value;
}

function validateRooftopAccessValue(
  value: unknown,
  label: string,
): RooftopAccessValue {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${label}: expected object.`);
  }

  const kind = assertEnumValue(
    value.kind,
    VALID_ROOFTOP_ACCESS_KINDS,
    `${label}.kind`,
  );

  const summary = assertNonEmptyString(value.summary, `${label}.summary`);
  return {
    kind,
    summary,
  };
}

function validateEntrancesValue(
  value: unknown,
  label: string,
): BuildingEntrancesValue {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${label}: expected object.`);
  }

  if (
    typeof value.count !== 'number' ||
    !Number.isInteger(value.count) ||
    value.count < 0
  ) {
    throw new Error(`Invalid ${label}.count: expected an integer >= 0.`);
  }

  const directionsSummary = assertNonEmptyString(
    value.directionsSummary,
    `${label}.directionsSummary`,
  );

  return {
    count: value.count,
    directionsSummary,
  };
}

function validateExteriorImageValue(
  value: unknown,
  label: string,
): BuildingExteriorImage {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${label}: expected object.`);
  }

  return {
    imagePath: assertNonEmptyString(value.imagePath, `${label}.imagePath`),
    credit: assertNonEmptyString(value.credit, `${label}.credit`),
    capturedPatch: assertNonEmptyString(
      value.capturedPatch,
      `${label}.capturedPatch`,
    ),
  };
}

function validateAttributes(
  value: unknown,
  buildingId: string,
): BuildingAttributes {
  if (!isRecord(value)) {
    throw new Error(`Invalid building:${buildingId}.attributes: expected object.`);
  }

  return {
    floors: validateVerifiableField(
      value.floors,
      `building:${buildingId}.attributes.floors`,
      validateFloorsValue,
    ),
    rooftopAccess: validateVerifiableField(
      value.rooftopAccess,
      `building:${buildingId}.attributes.rooftopAccess`,
      validateRooftopAccessValue,
    ),
    entrances: validateVerifiableField(
      value.entrances,
      `building:${buildingId}.attributes.entrances`,
      validateEntrancesValue,
    ),
    exteriorImage: validateVerifiableField(
      value.exteriorImage,
      `building:${buildingId}.attributes.exteriorImage`,
      validateExteriorImageValue,
    ),
  };
}

function validateBuildingRecord(value: unknown, index: number): BuildingRecord {
  if (!isRecord(value)) {
    throw new Error(`Invalid buildings[${index}]: expected an object.`);
  }

  const id = assertNonEmptyString(value.id, `buildings[${index}].id`);
  const zoneId = assertNonEmptyString(value.zoneId, `building:${id}.zoneId`);

  if (typeof value.isPilotSlice !== 'boolean') {
    throw new Error(`Invalid building:${id}.isPilotSlice: expected boolean.`);
  }

  const buildingType = assertNonEmptyString(
    value.buildingType,
    `building:${id}.buildingType`,
  );

  if (!Array.isArray(value.footprint) || value.footprint.length < 3) {
    throw new Error(
      `Invalid building:${id}.footprint: expected at least 3 CanonicalPoint vertices.`,
    );
  }

  const footprint = value.footprint.map((point, pointIndex) =>
    assertValidCanonicalPoint(point, `building:${id}.footprint[${pointIndex}]`),
  );

  const mapImageVersion = assertNonEmptyString(
    value.mapImageVersion,
    `building:${id}.mapImageVersion`,
  );

  return {
    id,
    zoneId,
    isPilotSlice: value.isPilotSlice,
    buildingType,
    footprint,
    mapImageVersion,
    provenance: validateVerificationRecord(value.provenance, `building:${id}`),
    attributes: validateAttributes(value.attributes, id),
  };
}

/**
 * Validate an unknown static buildings dataset at runtime.
 */
export function validateBuildingDataset(candidate: unknown): BuildingRecord[] {
  return validateUniqueRecordArray(
    candidate,
    'buildings',
    'building',
    validateBuildingRecord,
  );
}

/**
 * Server-side loader returning only verified buildings for the public viewer.
 */
export function loadPublicBuildings(): BuildingRecord[] {
  return getPublicBuildings(validateBuildingDataset(rawBuildings));
}
