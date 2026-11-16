import { describe, expect, it } from 'vitest';
import {
  loadPublicBuildings,
  validateBuildingDataset,
} from '@/data/load-buildings';
import { loadPublicMapDatasetConfig } from '@/data/load-map-config';
import {
  findBuildingAtPoint,
  getPublicBuildings,
  isPointInPolygon,
  resolveBuildingFootprintPlacements,
} from '@/domain/buildings';
import type { BuildingRecord, CanonicalPoint } from '@/domain/types';

function makeSampleBuilding(
  overrides: Partial<BuildingRecord> & Pick<BuildingRecord, 'id' | 'footprint'>,
): BuildingRecord {
  return {
    zoneId: 'palace',
    isPilotSlice: true,
    buildingType: '샘플 건물',
    mapImageVersion: 'sample-v1',
    provenance: {
      verificationStatus: 'verified',
      verificationSource: '샘플 SVG 도해 확인',
      verifiedGamePatch: 'sample-v1',
      verifiedAt: '2026-11-16',
    },
    attributes: {
      floors: { status: 'verified', value: 2 },
      rooftopAccess: {
        status: 'verified',
        value: {
          kind: 'interior-stairs',
          summary: '중앙 내부 계단으로 옥상 진입',
        },
      },
      entrances: {
        status: 'verified',
        value: {
          count: 2,
          directionsSummary: '남쪽 정문 1, 동쪽 측문 1',
        },
      },
      exteriorImage: {
        status: 'verified',
        value: {
          imagePath: '/buildings/palace-01-sample.svg',
          credit: '자체 제작 샘플 외관 도해',
          capturedPatch: 'sample-v1',
        },
      },
    },
    ...overrides,
  };
}

const PALACE_01_FOOTPRINT: readonly CanonicalPoint[] = [
  [3700, 2300],
  [3940, 2300],
  [3940, 2430],
  [3840, 2430],
  [3840, 2520],
  [3700, 2520],
];

const PALACE_02_FOOTPRINT: readonly CanonicalPoint[] = [
  [3960, 2300],
  [4200, 2300],
  [4200, 2490],
  [3960, 2490],
];

const PALACE_03_FOOTPRINT: readonly CanonicalPoint[] = [
  [3700, 2540],
  [3940, 2540],
  [3940, 2700],
  [3700, 2700],
];

const PALACE_04_UNVERIFIED_FOOTPRINT: readonly CanonicalPoint[] = [
  [4080, 2800],
  [4280, 2800],
  [4280, 2930],
  [4080, 2930],
];

const SAMPLE_BUILDINGS: readonly BuildingRecord[] = [
  makeSampleBuilding({
    id: 'palace-01',
    buildingType: '서측 ㄱ자 행랑',
    footprint: PALACE_01_FOOTPRINT,
  }),
  makeSampleBuilding({
    id: 'palace-02',
    buildingType: '북동 정전',
    footprint: PALACE_02_FOOTPRINT,
    attributes: {
      floors: { status: 'verified', value: 2 },
      rooftopAccess: {
        status: 'unverified',
        note: '옥상 진입 경로 샘플 대조 미완료',
      },
      entrances: {
        status: 'verified',
        value: {
          count: 2,
          directionsSummary: '남쪽 정문 1, 서쪽 문 1',
        },
      },
      exteriorImage: {
        status: 'unverified',
        note: '외관 도해 미등록 상태',
      },
    },
  }),
  makeSampleBuilding({
    id: 'palace-03',
    buildingType: '남서 별당',
    footprint: PALACE_03_FOOTPRINT,
  }),
  makeSampleBuilding({
    id: 'palace-04',
    isPilotSlice: false,
    buildingType: '남동 미검증 별관',
    footprint: PALACE_04_UNVERIFIED_FOOTPRINT,
    provenance: {
      verificationStatus: 'unverified',
      verificationSource: '미검증',
      verifiedGamePatch: 'unverified',
      verifiedAt: '2026-11-16',
    },
  }),
];

describe('Building geometry hit testing and verification isolation', () => {
  it('matches interior and boundary points of a concave L-shaped roof while rejecting its concave notch', () => {
    // Upper wing, lower wing, and interior corner-adjacent area
    expect(isPointInPolygon([3890, 2360], PALACE_01_FOOTPRINT)).toBe(true);
    expect(isPointInPolygon([3760, 2475], PALACE_01_FOOTPRINT)).toBe(true);
    expect(isPointInPolygon([3820, 2410], PALACE_01_FOOTPRINT)).toBe(true);

    // Concave notch inside bounding box [3700..3940, 2300..2520] must NOT match
    expect(isPointInPolygon([3890, 2475], PALACE_01_FOOTPRINT)).toBe(false);

    // Deterministic boundary vertex and edge hits
    expect(isPointInPolygon([3700, 2300], PALACE_01_FOOTPRINT)).toBe(true);
    expect(isPointInPolygon([3840, 2430], PALACE_01_FOOTPRINT)).toBe(true);
    expect(isPointInPolygon([3940, 2360], PALACE_01_FOOTPRINT)).toBe(true);
  });

  it('distinguishes adjacent Pilot Slice buildings and returns null on narrow alleys, roads, and Unregistered Area', () => {
    const publicBuildings = getPublicBuildings(SAMPLE_BUILDINGS);

    expect(findBuildingAtPoint([3890, 2360], publicBuildings)?.id).toBe(
      'palace-01',
    );
    expect(findBuildingAtPoint([3760, 2475], publicBuildings)?.id).toBe(
      'palace-01',
    );
    expect(findBuildingAtPoint([4080, 2395], publicBuildings)?.id).toBe(
      'palace-02',
    );
    expect(findBuildingAtPoint([3820, 2620], publicBuildings)?.id).toBe(
      'palace-03',
    );

    // Concave notch & narrow 20px alleys between adjacent roofs
    expect(findBuildingAtPoint([3890, 2475], publicBuildings)).toBeNull();
    expect(findBuildingAtPoint([3950, 2360], publicBuildings)).toBeNull();
    expect(findBuildingAtPoint([3760, 2530], publicBuildings)).toBeNull();

    // Courtyard road and Unregistered Area (NW)
    expect(findBuildingAtPoint([4010, 2750], publicBuildings)).toBeNull();
    expect(findBuildingAtPoint([1610, 1600], publicBuildings)).toBeNull();
  });

  it('excludes verificationStatus !== verified records and preserves unverified rooftopAccess without converting to inaccessible', () => {
    const needsRecheck = makeSampleBuilding({
      id: 'palace-05',
      footprint: [
        [4300, 2800],
        [4380, 2800],
        [4380, 2900],
        [4300, 2900],
      ],
      provenance: {
        verificationStatus: 'needs-recheck',
        verificationSource: '패치 후 재확인 필요',
        verifiedGamePatch: '42.1',
        verifiedAt: '2026-11-16',
      },
    });

    const allBuildings = [...SAMPLE_BUILDINGS, needsRecheck];
    const publicBuildings = getPublicBuildings(allBuildings);

    expect(publicBuildings.map((b) => b.id)).toEqual([
      'palace-01',
      'palace-02',
      'palace-03',
    ]);

    // Even if passed directly, unverified buildings are ignored by findBuildingAtPoint
    expect(findBuildingAtPoint([4180, 2865], allBuildings)).toBeNull();
    expect(findBuildingAtPoint([4340, 2850], allBuildings)).toBeNull();

    const palace02 = publicBuildings.find((b) => b.id === 'palace-02');
    expect(palace02?.attributes.rooftopAccess).toEqual({
      status: 'unverified',
      note: '옥상 진입 경로 샘플 대조 미완료',
    });
    expect(palace02?.attributes.rooftopAccess.status).not.toBe('verified');
  });

  it('resolves identical Leaflet CRS.Simple polygon coordinates regardless of baseImage pixel resolution', () => {
    const publicBuildings = getPublicBuildings(SAMPLE_BUILDINGS);
    const config2k = structuredClone(loadPublicMapDatasetConfig());
    config2k.baseImage.pixelWidth = 2048;
    config2k.baseImage.pixelHeight = 2048;

    const config4k = structuredClone(loadPublicMapDatasetConfig());
    config4k.baseImage.pixelWidth = 4096;
    config4k.baseImage.pixelHeight = 4096;

    const placements2k = resolveBuildingFootprintPlacements(
      publicBuildings,
      config2k.baseImage,
    );
    const placements4k = resolveBuildingFootprintPlacements(
      publicBuildings,
      config4k.baseImage,
    );

    expect(placements2k).toHaveLength(3);
    expect(placements2k[0]?.latLngs).toEqual([
      [5892, 3700],
      [5892, 3940],
      [5762, 3940],
      [5762, 3840],
      [5672, 3840],
      [5672, 3700],
    ]);
    expect(placements4k).toEqual(placements2k);
  });
});

describe('Static buildings.json dataset loader and runtime schema validation', () => {
  it('loads the 3 verified Pilot Slice buildings while filtering out unverified records and preserving unverified attributes', () => {
    const publicBuildings = loadPublicBuildings();

    expect(publicBuildings.map((b) => b.id)).toEqual([
      'palace-01',
      'palace-02',
      'palace-03',
    ]);
    expect(publicBuildings.every((b) => b.isPilotSlice)).toBe(true);

    const palace02 = publicBuildings.find((b) => b.id === 'palace-02');
    expect(palace02?.attributes.rooftopAccess.status).toBe('unverified');
    expect(palace02?.attributes.exteriorImage.status).toBe('unverified');

    const palace03 = publicBuildings.find((b) => b.id === 'palace-03');
    expect(palace03?.attributes.entrances.status).toBe('unverified');
  });

  it('rejects duplicate building IDs', () => {
    const duplicated = [
      makeSampleBuilding({ id: 'palace-dup', footprint: PALACE_01_FOOTPRINT }),
      makeSampleBuilding({ id: 'palace-dup', footprint: PALACE_02_FOOTPRINT }),
    ];

    expect(() => validateBuildingDataset(duplicated)).toThrow(/duplicate/i);
  });

  it('rejects footprints with fewer than 3 vertices', () => {
    const tooShort = [
      makeSampleBuilding({
        id: 'palace-short',
        footprint: [
          [3700, 2300],
          [3940, 2300],
        ],
      }),
    ];

    expect(() => validateBuildingDataset(tooShort)).toThrow(/footprint/i);
  });

  it('rejects footprint coordinates outside 0..8192 Canonical Pixel Space', () => {
    const outOfRange = [
      makeSampleBuilding({
        id: 'palace-oob',
        footprint: [
          [3700, 2300],
          [8200, 2300],
          [3940, 2500],
        ],
      }),
    ];

    expect(() => validateBuildingDataset(outOfRange)).toThrow(/0\.\.8192/i);
  });

  it('rejects verified buildings when verifiedGamePatch is unverified', () => {
    const inconsistent = [
      makeSampleBuilding({
        id: 'palace-bad-patch',
        footprint: PALACE_01_FOOTPRINT,
        provenance: {
          verificationStatus: 'verified',
          verificationSource: '샘플 확인',
          verifiedGamePatch: 'unverified',
          verifiedAt: '2026-11-16',
        },
      }),
    ];

    expect(() => validateBuildingDataset(inconsistent)).toThrow(
      /verifiedGamePatch/i,
    );
  });

  it('rejects invalid rooftopAccess.value.kind values', () => {
    const invalidKind = structuredClone(SAMPLE_BUILDINGS[0]!);
    (
      invalidKind.attributes.rooftopAccess as {
        status: 'verified';
        value: { kind: string; summary: string };
      }
    ).value.kind = 'parachute-only';

    expect(() => validateBuildingDataset([invalidKind])).toThrow(
      /rooftopAccess/i,
    );
  });

  it('rejects non-integer footprint coordinates in Canonical Pixel Space', () => {
    const fractionalCoord = [
      makeSampleBuilding({
        id: 'palace-float',
        footprint: [
          [3700.5, 2300],
          [3940, 2300],
          [3940, 2500],
        ],
      }),
    ];

    expect(() => validateBuildingDataset(fractionalCoord)).toThrow(/integers/i);
  });
});
