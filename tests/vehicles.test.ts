import { describe, expect, it } from 'vitest';
import { loadPublicMapDatasetConfig } from '@/data/load-map-config';
import {
  loadPublicVehicles,
  validateVehicleDataset,
} from '@/data/load-vehicles';
import type { FixedVehicleSpawnRecord } from '@/domain/types';
import {
  getPublicVehicles,
  resolveVehicleSpawnPlacements,
} from '@/domain/vehicles';

function makeSampleVehicle(
  overrides: Partial<FixedVehicleSpawnRecord> &
    Pick<FixedVehicleSpawnRecord, 'id' | 'coord'>,
): FixedVehicleSpawnRecord {
  return {
    zoneId: 'palace',
    mapImageVersion: 'sample-v1',
    gameMode: 'all-verified',
    spawnType: 'garage',
    vehicleTypes: ['포니 쿠페', '사륜 차량'],
    notes: '샘플 지도 기능 검증용 차고지 고정 스폰 지점',
    provenance: {
      verificationStatus: 'verified',
      verificationSource: '자체 제작 샘플 지도(sample-v1) 검증 기준',
      verifiedGamePatch: 'sample-v1',
      verifiedAt: '2026-11-16',
    },
    ...overrides,
  };
}

const SAMPLE_VEHICLES: readonly FixedVehicleSpawnRecord[] = [
  makeSampleVehicle({
    id: 'palace-vehicle-01',
    zoneId: 'palace',
    coord: [4260, 2600],
    gameMode: 'all-verified',
    spawnType: 'garage',
  }),
  makeSampleVehicle({
    id: 'taego-wide-vehicle-01',
    zoneId: 'taego-wide',
    coord: [3680, 2750],
    gameMode: 'normal',
    spawnType: 'fixed-spot',
    vehicleTypes: ['포터', '다시야'],
  }),
  makeSampleVehicle({
    id: 'palace-vehicle-unverified-01',
    zoneId: 'palace',
    coord: [4180, 2900],
    provenance: {
      verificationStatus: 'unverified',
      verificationSource: '현장 대조 대기',
      verifiedGamePatch: 'unverified',
      verifiedAt: '2026-11-16',
    },
  }),
  makeSampleVehicle({
    id: 'palace-vehicle-recheck-01',
    zoneId: 'taego-wide',
    coord: [3800, 2850],
    provenance: {
      verificationStatus: 'needs-recheck',
      verificationSource: '패치 후 재확인 필요',
      verifiedGamePatch: '42.1',
      verifiedAt: '2026-11-16',
    },
  }),
];

describe('FixedVehicleSpawnPoint filtering and Canonical Pixel Space placement', () => {
  it('filters out non-verified records while keeping both Target Zone and taego-wide verified spawns', () => {
    const publicVehicles = getPublicVehicles(SAMPLE_VEHICLES);

    expect(publicVehicles.map((vehicle) => vehicle.id)).toEqual([
      'palace-vehicle-01',
      'taego-wide-vehicle-01',
    ]);
    expect(publicVehicles.map((vehicle) => vehicle.zoneId)).toEqual([
      'palace',
      'taego-wide',
    ]);
  });

  it('maps verified vehicle coordinates to identical Leaflet CRS.Simple tuples across 2048x2048 and 4096x4096 base images', () => {
    const publicVehicles = getPublicVehicles(SAMPLE_VEHICLES);
    const config2k = structuredClone(loadPublicMapDatasetConfig());
    config2k.baseImage.pixelWidth = 2048;
    config2k.baseImage.pixelHeight = 2048;

    const config4k = structuredClone(loadPublicMapDatasetConfig());
    config4k.baseImage.pixelWidth = 4096;
    config4k.baseImage.pixelHeight = 4096;

    const placements2k = resolveVehicleSpawnPlacements(
      publicVehicles,
      config2k.baseImage,
    );
    const placements4k = resolveVehicleSpawnPlacements(
      publicVehicles,
      config4k.baseImage,
    );

    expect(placements2k).toEqual([
      {
        id: 'palace-vehicle-01',
        spawnType: 'garage',
        latLng: [5592, 4260],
      },
      {
        id: 'taego-wide-vehicle-01',
        spawnType: 'fixed-spot',
        latLng: [5442, 3680],
      },
    ]);
    expect(placements4k).toEqual(placements2k);
  });
});

describe('Static vehicles.json dataset loader and runtime schema validation', () => {
  it('loads only verified sample vehicles for sample assetMode and excludes unverified records', () => {
    const sampleVehicles = loadPublicVehicles('sample');

    expect(sampleVehicles.map((vehicle) => vehicle.id)).toEqual([
      'palace-vehicle-01',
      'taego-wide-vehicle-01',
    ]);
    expect(sampleVehicles.map((vehicle) => vehicle.zoneId)).toEqual([
      'palace',
      'taego-wide',
    ]);
  });

  it('excludes sample-* vehicle records when assetMode is official', () => {
    expect(loadPublicVehicles('official')).toEqual([]);

    const sampleV2 = validateVehicleDataset([
      makeSampleVehicle({
        id: 'veh-sample-v2',
        coord: [4260, 2600],
        mapImageVersion: 'sample-v2',
      }),
    ]);
    expect(
      sampleV2.filter((vehicle) => !vehicle.mapImageVersion.startsWith('sample-')),
    ).toEqual([]);
  });

  it('rejects duplicate vehicle IDs', () => {
    const duplicated = [
      makeSampleVehicle({ id: 'veh-dup', coord: [4260, 2600] }),
      makeSampleVehicle({ id: 'veh-dup', coord: [3680, 2750] }),
    ];

    expect(() => validateVehicleDataset(duplicated)).toThrow(/duplicate/i);
  });

  it('rejects non-integer or out-of-range CanonicalPoint coordinates', () => {
    const outOfRange = [
      makeSampleVehicle({ id: 'veh-oob', coord: [9000, 2600] }),
    ];
    const nonInteger = [
      makeSampleVehicle({ id: 'veh-float', coord: [4260.5, 2600] }),
    ];

    expect(() => validateVehicleDataset(outOfRange)).toThrow(/0\.\.8192/i);
    expect(() => validateVehicleDataset(nonInteger)).toThrow(/integers/i);
  });

  it('rejects invalid gameMode or spawnType values', () => {
    const badMode = [
      {
        ...makeSampleVehicle({ id: 'veh-bad-mode', coord: [4260, 2600] }),
        gameMode: 'arcade',
      },
    ];
    const badSpawnType = [
      {
        ...makeSampleVehicle({ id: 'veh-bad-type', coord: [4260, 2600] }),
        spawnType: 'airdrop',
      },
    ];

    expect(() => validateVehicleDataset(badMode)).toThrow(/gameMode/i);
    expect(() => validateVehicleDataset(badSpawnType)).toThrow(/spawnType/i);
  });

  it('rejects empty vehicleTypes arrays', () => {
    const emptyTypes = [
      makeSampleVehicle({
        id: 'veh-empty-types',
        coord: [4260, 2600],
        vehicleTypes: [],
      }),
    ];

    expect(() => validateVehicleDataset(emptyTypes)).toThrow(/vehicleTypes/i);
  });

  it('rejects verified vehicle spawns when verifiedGamePatch is unverified', () => {
    const inconsistent = [
      makeSampleVehicle({
        id: 'veh-bad-patch',
        coord: [4260, 2600],
        provenance: {
          verificationStatus: 'verified',
          verificationSource: '샘플 확인',
          verifiedGamePatch: 'unverified',
          verifiedAt: '2026-11-16',
        },
      }),
    ];

    expect(() => validateVehicleDataset(inconsistent)).toThrow(
      /verifiedGamePatch/i,
    );
  });

  it('rejects unverified probability percentages or 100% guaranteed spawn claims in notes or vehicleTypes', () => {
    const percentageNotes = [
      makeSampleVehicle({
        id: 'veh-pct-note',
        coord: [4260, 2600],
        notes: '출현 확률 65% 고정 스팟',
      }),
    ];
    const guaranteedClaim = [
      makeSampleVehicle({
        id: 'veh-guaranteed',
        coord: [4260, 2600],
        notes: '매 경기 확정 출현 위치',
      }),
    ];
    const percentageVehicleType = [
      makeSampleVehicle({
        id: 'veh-pct-type',
        coord: [4260, 2600],
        vehicleTypes: ['포니 쿠페 100%'],
      }),
    ];

    expect(() => validateVehicleDataset(percentageNotes)).toThrow(
      /probability|guaranteed/i,
    );
    expect(() => validateVehicleDataset(guaranteedClaim)).toThrow(
      /probability|guaranteed/i,
    );
    expect(() => validateVehicleDataset(percentageVehicleType)).toThrow(
      /probability|guaranteed/i,
    );
  });

  it('allows explicit negated non-guarantee disclaimers while still rejecting guaranteed claims in verificationSource', () => {
    const withDisclaimer = validateVehicleDataset([
      makeSampleVehicle({
        id: 'veh-disclaimer',
        coord: [4260, 2600],
        notes: '차고 내부 고정 스팟 (매 경기 확정 출현 아님)',
      }),
    ]);
    expect(withDisclaimer).toHaveLength(1);

    const badSource = [
      makeSampleVehicle({
        id: 'veh-bad-source',
        coord: [4260, 2600],
        provenance: {
          verificationStatus: 'verified',
          verificationSource: '매 경기 100% 확정 출현 확인',
          verifiedGamePatch: 'sample-v1',
          verifiedAt: '2026-11-16',
        },
      }),
    ];
    expect(() => validateVehicleDataset(badSource)).toThrow(
      /probability|guaranteed/i,
    );
  });
});
