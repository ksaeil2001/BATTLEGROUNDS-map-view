import {
  CANONICAL_MAP_SIZE,
  type CanonicalBounds,
  type CanonicalPoint,
  type VerificationRecord,
  type VerificationStatus,
} from '@/domain/types';

const VALID_VERIFICATION_STATUSES: readonly VerificationStatus[] = [
  'verified',
  'unverified',
  'needs-recheck',
];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`Invalid ${label}: expected a non-empty string.`);
  }
  return value;
}

export function assertPositiveFiniteNumber(
  value: unknown,
  label: string,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid ${label}: expected a positive finite number.`);
  }
  return value;
}

export function assertEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  label: string,
): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`Invalid ${label}: ${String(value)}.`);
  }
  return value as T;
}

function isCanonicalInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= CANONICAL_MAP_SIZE
  );
}

export function assertValidCanonicalPoint(
  value: unknown,
  label: string,
): CanonicalPoint {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(`Invalid ${label}: expected [x, y] coordinate tuple.`);
  }

  const [x, y] = value as [unknown, unknown];
  if (!isCanonicalInteger(x) || !isCanonicalInteger(y)) {
    throw new Error(
      `Invalid ${label}: coordinates must be integers within 0..${CANONICAL_MAP_SIZE}.`,
    );
  }

  return [x, y];
}

export function assertValidCanonicalBounds(
  value: unknown,
  label: string,
): CanonicalBounds {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error(
      `Invalid ${label} bounds: expected [[x1, y1], [x2, y2]] tuple.`,
    );
  }

  const topLeft = assertValidCanonicalPoint(
    value[0],
    `${label} bounds.topLeft`,
  );
  const bottomRight = assertValidCanonicalPoint(
    value[1],
    `${label} bounds.bottomRight`,
  );

  if (topLeft[0] >= bottomRight[0] || topLeft[1] >= bottomRight[1]) {
    throw new Error(
      `Invalid ${label} bounds: topLeft must be strictly less than bottomRight.`,
    );
  }

  return [topLeft, bottomRight];
}

export function validateVerificationRecord(
  value: unknown,
  recordLabel: string,
): VerificationRecord {
  if (!isRecord(value)) {
    throw new Error(`Invalid ${recordLabel}.provenance: expected object.`);
  }

  const verificationStatus = assertEnumValue(
    value.verificationStatus,
    VALID_VERIFICATION_STATUSES,
    `${recordLabel}.provenance.verificationStatus`,
  );

  const verificationSource = assertNonEmptyString(
    value.verificationSource,
    `${recordLabel}.provenance.verificationSource`,
  );
  const verifiedGamePatch = assertNonEmptyString(
    value.verifiedGamePatch,
    `${recordLabel}.provenance.verifiedGamePatch`,
  );
  const verifiedAt = assertNonEmptyString(
    value.verifiedAt,
    `${recordLabel}.provenance.verifiedAt`,
  );

  if (!/^\d{4}-\d{2}-\d{2}$/.test(verifiedAt)) {
    throw new Error(
      `Invalid ${recordLabel}.provenance.verifiedAt: expected YYYY-MM-DD.`,
    );
  }

  if (verificationStatus === 'verified' && verifiedGamePatch === 'unverified') {
    throw new Error(
      `Invalid ${recordLabel}: verified record requires a verifiedGamePatch other than "unverified".`,
    );
  }

  return {
    verificationStatus,
    verificationSource,
    verifiedGamePatch,
    verifiedAt,
  };
}

export function validateUniqueRecordArray<T extends { id: string }>(
  candidate: unknown,
  datasetName: string,
  itemLabel: string,
  validateItem: (entry: unknown, index: number) => T,
): T[] {
  if (!Array.isArray(candidate)) {
    throw new Error(`Invalid ${datasetName} dataset: expected an array.`);
  }

  const seenIds = new Set<string>();
  return candidate.map((entry, index) => {
    const record = validateItem(entry, index);
    if (seenIds.has(record.id)) {
      throw new Error(
        `Duplicate ${itemLabel} id "${record.id}" in ${datasetName} dataset.`,
      );
    }
    seenIds.add(record.id);
    return record;
  });
}
