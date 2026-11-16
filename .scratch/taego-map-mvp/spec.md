# 태이고 건물·고정 차량 지도 MVP 개발 명세서

Status: ready-for-agent

> **근거 문서**: `GLOSSARY.md`, `AGENTS.md`, `docs/adr/0001`~`0003`, `태이고 건물 지도 MVP 기획서`
> **트래커 상태**: GitHub CLI(`gh`) 미설치 환경으로 인해 `docs/agents/issue-tracker.md` 폴백 규칙에 따라 로컬 명세서로 우선 발행됨 (추후 GitHub Issues `ksaeil2001/BATTLEGROUNDS-map-view` 동기화 가능).

---

## Problem Statement

1. 기존 PUBG 웹 지도는 지형과 구역 전체를 볼 수 있지만, 지붕만 보고서는 개별 건물의 **실제 외관, 층수, 옥상 접근 방식(`Rooftop Access`), 출입구 수와 방향**을 즉시 파악하기 어렵다.
2. 대다수 커뮤니티 지도는 핀이나 마커가 과도하게 겹쳐 지도 자체가 가려지거나, 확인되지 않은 파밍 등급·확률 등 추측성 정보를 섞어 보여준다.
3. 차량 출현 정보 역시 일반 도로변 랜덤 스폰과 **고정 차량 출현 지점(`Fixed Vehicle Spawn Point`)** 이 혼재되거나 "매 경기 100% 출현"처럼 부정확하게 안내되는 경우가 많다.
4. 또한 배경 지도 이미지 판본(`Map Image Version`)과 라이브 게임 패치(`Verified Game Patch`)가 다를 때 어느 구역과 데이터가 실제로 대조·검증되었는지 알 수 없다.

---

## Solution

사용자가 지도를 중심(전체 화면)으로 탐색하면서 **보이는 건물 지붕(`Roof Footprint`)을 직접 클릭·터치해 확인된 정보만 담긴 건물 정보 카드(`Building Card`)** 를 확인하고, 필요 시 **검증된 고정 차량 출현 지점(`Fixed Vehicle Spawn Point`) 레이어를 ON/OFF** 할 수 있는 모바일·PC 대응 인터랙티브 웹 지도를 제공한다.

- **단계적 검증 전략**: `Palace`(궁전) 또는 `Terminal`(터미널) 중 31.2 지도 이미지와 현재 인게임 배치가 일치하는 1곳을 `Target Zone`으로 확정한 뒤, 인접 **3개 건물(`Pilot Slice`)** 로 다각형 클릭 정확도·좌표 정합성·터치 UX를 먼저 검증하고 약 20개 건물 및 확인된 차량 지점으로 확장한다.
- **권리 게이트 및 샘플 지도 지원**: KRAFTON 지도 이미지 재배포 권한 확인 전에도 전체 기능 검증이 가능하도록, 자체 제작 샘플 지도(`sample` 자산 모드)와 실제 태이고 지도(`official` 자산 모드)를 동일한 좌표 규격으로 교체할 수 있게 설계한다.

---

## User Stories

### 지도 선택 및 전체 화면 탐색
1. As a PUBG player, I want to start from a simple map selection card showing the map name and preview, so that I can enter the interactive Taego map in one click/tap without navigating complex menus.
2. As a PUBG player, I want the map canvas to occupy nearly the entire viewport with only minimal back and reset-view controls, so that the map itself remains the primary focus on both desktop and mobile.
3. As a desktop user, I want to zoom with the mouse wheel and pan by dragging across the full Taego map, so that I can freely inspect any compound or terrain.
4. As a mobile user, I want to zoom with two-finger pinch and pan with single-finger drag smoothly without memory crashes, so that I can inspect roof shapes on a phone screen.

### 등록 구역 안내 및 이동
5. As a PUBG player exploring an `Unregistered Area`, I want a subtle `Target Zone` boundary indicator and a compact jump action, so that I know where verified buildings are available and can center the camera there in one action without mistaking unregistered roofs for broken clicks.
6. As a PUBG player, I want the viewer to avoid cluttering the map with dozens of permanent pins over every building, so that roof shapes remain clearly visible.

### 지붕 윤곽 클릭 및 건물 정보 카드
7. As a PUBG player, I want to click or tap directly inside a registered building's `Roof Footprint` polygon, so that only that building's outline highlights and its `Building Card` opens.
8. As a PUBG player, I want adjacent buildings with closely spaced roofs to open only their own `Building Card` when clicked, so that I never read details for the wrong structure.
9. As a PUBG player, I want clicks or taps on roads, empty ground, or unregistered buildings to ignore building selection (and close any currently open card), so that stray taps never open misleading data.
10. As a mobile user, I want panning or pinch-zooming the map never to trigger a `Building Card` accidentally, so that navigation stays uninterrupted.
11. As a desktop user, I want the `Building Card` to appear as a compact floating popup/panel without obscuring the selected roof, whereas as a mobile user I want it as a bottom card/sheet, so that both screen sizes stay readable.
12. As a PUBG player, I want the `Building Card` to display only verified facts (building type, verified exterior photo, floors, `Rooftop Access` method, confirmed entrances, and `Verified Game Patch` / date), so that I never rely on unverified guesses.
13. As a PUBG player, I want any unverified building attribute to remain hidden or explicitly marked as `Unverified State` rather than falsely shown as "impossible" or "none", so that I am never misled about whether a building has rooftop access or entrances.

### 고정 차량 출현 지점 레이어
14. As a PUBG player, I want a single ON/OFF toggle for the `Fixed Vehicle Spawn Point` layer, so that I can reveal or hide verified vehicle spots without cluttering roof exploration.
15. As a PUBG player, I want clicking a `Fixed Vehicle Spawn Point` marker to show concise verified details (`gameMode`, `spawnType`, `vehicleTypes`, `Verification Record`, `Verified Game Patch`) without unverified spawn percentages or false "100% every match" promises, so that I can plan rotations accurately.

### 데이터 판본·권리 안전 및 개발자 도구
16. As a maintainer, I want `Map Image Version` and `Verified Game Patch` tracked independently alongside `Verification Record`, so that future PUBG map patches only require updating affected zones rather than guessing which data is stale.
17. As a maintainer, I want the viewer to support swapping between a self-created sample map and official Taego map assets seamlessly in `Canonical Pixel Space`, so that functional testing proceeds without publicly redistributing uncleared game imagery.
18. As a developer working in local development mode, I want an in-app Polygon & Coordinate Picker (add vertex, undo last vertex, cancel selection, copy JSON, and suppress normal `Building Card` clicks while editing), so that I can author accurate `Roof Footprint` polygons and `Fixed Vehicle Spawn Point` coordinates directly on the rendered map.
19. As a site owner, I want the Polygon & Coordinate Picker completely excluded from production builds and unreachable in deployed environments, so that public users cannot access or see authoring controls.

---

## Implementation Decisions

### 1. 기능별 요구사항 및 완료 기준 (Functional Requirements & Acceptance Criteria)

#### FR-1. 전체 태이고 지도 탐색 및 2단계 하이브리드 이미지 표시
- **요구사항**:
  - 첫 화면은 맵 선택 카드(태이고 맵 이름·경량 미리보기·등록 범위 안내, 향후 다른 맵 카드 확장이 가능한 구조)를 제공한다.
  - 지도 화면은 뷰포트 대부분을 지도에 할당하고, 최소한의 컨트롤(뒤로 가기, 전체 보기/초기화, `Target Zone` 이동, 차량 레이어 토글)만 배치한다.
  - 모든 좌표는 좌상단 `(0, 0)` 기준 `Canonical Pixel Space`(`8192 × 8192`)로 통일하고, Leaflet `CRS.Simple`에서 `[8192 - y, x]`로 단 1회 변환한다.
  - 기본 전체 지도는 경량 WebP(약 1~2MB)를 로드하고, `Target Zone` 영역에는 고배율 확대 시 지붕 식별이 가능한 고해상도 크롭 WebP 오버레이를 동일 좌표 바운딩 박스에 중첩한다(ADR-0001). 정적 타일 피라미드(`L.tileLayer`)는 실제 기기 성능 측정 결과 병목이 확인될 때만 도입한다.
  - 공개 배포 권리 게이트를 만족하기 전까지 배포 가능한 공개 데모는 자체 제작 샘플 지도 자산(`assetMode: 'sample'`)을 사용할 수 있으며, 공식 지도 자산(`assetMode: 'official'`)과 동일한 `8192 × 8192` 바운딩 박스를 공유한다.
- **완료 기준**:
  - 101MB 원본 PNG를 브라우저 초기 로드에 직접 사용하지 않는다.
  - 전체 지도 이미지 해상도(예: `2048px` vs `4096px`)나 샘플/공식 지도 자산을 교체해도 모든 건물 윤곽과 차량 마커가 동일한 위치에 정렬된다.
  - 줌 인/아웃, 팬, 뷰포트 리사이즈 후에도 `Roof Footprint`가 지붕 이미지에서 1px 이상 밀리지 않는다.

#### FR-2. 건물 지붕 직접 클릭 다각형 선택 (`Roof Footprint`)
- **요구사항**:
  - 건물 위에 상시 핀/마커를 띄우지 않고 투명 SVG 다각형 레이어로 `Roof Footprint`를 배치한다.
  - 클릭·터치 시 해당 건물 윤곽만 강조 스타일(테두리 및 은은한 채움)로 전환된다.
  - 도로, 빈 땅, `Unregistered Area` 내 건물은 선택 이벤트를 발생시키지 않으며, 열린 `Building Card`가 있다면 닫는다.
  - `Pilot Slice`(인접 건물 3개)를 최우선 기능 검증 단위로 삼고, 통과 후 `Target Zone` 내 약 20개로 확대한다.
- **완료 기준**:
  - `Pilot Slice` 3개 인접 건물의 각 지붕 내부를 눌렀을 때 각각 자기 자신의 `Building Card`만 열린다.
  - 다각형 바운딩 박스 바깥(예: ㄱ자 건물 여백)이나 인접 도로, 미등록 건물 클릭 시 어떤 건물도 선택되지 않는다.

#### FR-3. 건물 상세 정보 표시 (`Building Card`) 및 미확인 상태 격리
- **요구사항**:
  - `Building Card`에는 `verified` 상태의 건물 및 `verified` 상태의 속성만 사용자에게 렌더링한다.
  - `floors`, `rooftopAccess`, `entrances`, `exteriorImage` 중 확인되지 않은 항목은 `Unverified State`(`status: 'unverified'`)로 유지하며, 절대 `'접근 불가'` 또는 `'없음'`으로 표시하지 않는다(ADR-0002).
  - 미확인 속성은 사용자 카드에서 생략하거나 명시적인 `"확인 중 / 미확인"` 배지로만 표기하며, 단정적 정보와 혼동되지 않게 구분한다.
  - 카드 하단 또는 메타 영역에 `Verified Game Patch`와 `verifiedAt`을 함께 노출한다.
- **완료 기준**:
  - `verificationStatus !== 'verified'`인 건물 레코드는 공개 뷰어 선택 레이어에 노출되지 않는다.
  - `rooftopAccess.status === 'unverified'`인 건물의 카드에 `"옥상 접근 불가"` 문자열이 절대 출력되지 않는다.
  - 외관 이미지가 `verified` 상태가 아닐 때 미확인/대체 상태가 안전하게 처리되며 깨진 이미지(`404`)가 발생하지 않는다.

#### FR-4. 검증된 고정 차량 출현 지점 레이어 (`Fixed Vehicle Spawn Point`)
- **요구사항**:
  - 기본 지도 가독성을 유지하기 위해 상단/모서리의 단일 `차량 위치 ON/OFF` 토글로 레이어를 제어한다.
  - `Fixed Vehicle Spawn Point`는 `Target Zone` 및 인접 도로의 실측 확인 데이터부터 시작하되, 데이터 스키마상 `zoneId`(또는 전역 목록)로 태이고 전역 확장을 수용한다.
  - 레코드마다 `gameMode`, `spawnType`(`garage` | `fixed-spot`), `vehicleTypes`, `verificationStatus`, `Verification Record`(`verificationSource`, `verifiedAt`), `Verified Game Patch`, `Map Image Version`을 구분 저장한다.
  - 확인되지 않은 위치는 개수 목표에 맞춰 임의 생성하지 않으며, 검증되지 않은 출현 확률이나 "매 경기 100% 출현" 표현을 사용하지 않는다.
- **완료 기준**:
  - 토글 OFF 시 차량 마커가 DOM/레이어에서 숨겨지고 지붕 클릭을 방해하지 않는다.
  - 토글 ON 시 검증된(`verified`) 고정 차량 스폰 마커만 표시되며, 클릭 시 모드·유형·차종·패치·확인 근거가 간결하게 표시된다.
  - 출현 확률 수치나 "100% 확정 출현" 문구가 UI와 데이터 스키마 어디에도 강제되지 않는다.

#### FR-5. PC·모바일 반응형 인터페이스 및 터치 가드
- **요구사항**:
  - PC(넓은 화면): 선택된 지붕 근처 플로팅 팝업 또는 좌우 가장자리를 최소 침범하는 컴팩트 카드로 `Building Card`를 표시한다.
  - 모바일(좁은 화면): 화면 하단 시트/카드 형태로 표시해 상단 지붕 위치를 계속 볼 수 있게 한다.
  - 모바일·트랙패드에서 드래그(팬) 또는 두 손가락 핀치 줌 직후 관성이나 터치 종료 이벤트로 인해 의도치 않게 `Roof Footprint`가 선택되지 않도록 제스처 가드를 적용한다.
- **완료 기준**:
  - 모바일 뷰포트에서 드래그 이동이나 핀치 줌 동작만 수행했을 때 `Building Card`가 열리지 않는다.
  - PC 및 모바일 뷰포트 모두에서 지도 외 UI가 뷰포트 대부분을 가리지 않으며 닫기/바깥 탭으로 카드를 즉시 닫을 수 있다.

#### FR-6. 개발 환경 전용 Polygon & Coordinate Picker
- **요구사항**:
  - `process.env.NODE_ENV === 'development'`일 때만 접근·렌더링되는 전용 편집 UI 및 모드를 제공한다(ADR-0003).
  - 프로덕션 빌드(`next build`) 시 Picker 모듈과 편집 UI가 번들 및 라우팅에서 완전히 배제되어 배포 환경에서 접근할 수 없어야 한다.
  - 제공 기능: ① 다각형(건물 `Roof Footprint`) 모드 및 단일 좌표(차량 스폰) 모드 선택, ② 지도 클릭으로 `Canonical Pixel Space` 정수 좌표 `[x, y]` 추가, ③ 마지막 점 되돌리기(Undo), ④ 현재 선택/편집 취소(Cancel), ⑤ 생성된 좌표 배열 또는 JSON 스니펫 클립보드 복사, ⑥ 편집 모드 활성 중 일반 건물/차량 선택 카드 오픈 억제.
- **완료 기준**:
  - 개발 모드에서 지붕 꼭짓점 클릭 → 마지막 점 되돌리기 → 취소 → JSON 복사가 정상 동작하고, 편집 중에는 `Building Card`가 열리지 않는다.
  - `NODE_ENV=production` 빌드 산출물과 실제 실행된 프로덕션 서버에서 Picker 관련 UI, 컨트롤, 개발 전용 라우트/쿼리에 접근할 수 없다.

#### FR-7. 아키텍처 경계 및 Next.js App Router SSR / Client 분리
- **모듈(Module) 및 심(Seam) 설계** (`codebase-design` 기준):
  1. **Domain & Coordinate Module (순수 TypeScript 모듈)**:
     - 인터페이스: 좌표 변환(`toLeafletLatLng`, `toCanonicalPixel`), 다각형 히트 테스트(`findBuildingAtPoint`), 데이터셋 검증·필터링(`getPublicBuildings`, `getPublicVehicles`).
     - 특징: DOM/Leaflet/React에 의존하지 않는 **Deep Module**로 설계해 빠른 단위 테스트와 해상도 불변성 검증을 수행한다.
  2. **Static Dataset Adapter (JSON 로더 및 스키마 검증 어댑터)**:
     - 분리된 정적 JSON(`buildings.json`, `vehicles.json`, `map-config.json`)을 로드하고 TypeScript/런타임 스키마 검증을 거쳐 `verified` 항목만 공개 뷰용으로 필터링한다.
  3. **Next.js App Router 경계 (검증된 Next.js 15+ 공식 규칙 반영)**:
     - **[확인된 사실]**: Next.js 15 이상 App Router에서는 **Server Component 내부에서 `next/dynamic(..., { ssr: false })`를 직접 호출하면 빌드/런타임 오류가 발생한다.**
     - 따라서 **Server Component**(페이지 엔트리)는 정적 데이터 검증 및 초기 메타데이터 로딩만 담당하고, 검증된 직렬화 props를 **전용 Client Shell Module(`'use client'`)** 에 전달한다.
     - **Client Shell Module** 내부에서 `next/dynamic(..., { ssr: false })`로 Leaflet 지도 캔버스 모듈을 지연·클라이언트 전용 마운트한다.
     - 개발 전용 Polygon Picker 역시 Client Shell 내부 또는 개발 전용 동적 분기에서 `process.env.NODE_ENV === 'development'` 상수 조건 가드를 통해 프로덕션 트리 셰이킹(Dead Code Elimination)으로 완전 제거되도록 경계를 둔다.

---

### 2. 데이터 모델 및 타입 설계 (Data Model & Type Shapes)

> 아래 TypeScript 타입 형태는 ADR-0001과 ADR-0002의 도메인 불변조건(좌표계 고정, 미확인 상태 분리, 판본·패치·검증 근거 분리)을 정확히 인코딩한 명세 기준 스키마입니다.

```typescript
/** Canonical Pixel Space: 8192x8192 원본 좌상단 (0,0) 기준 정수 픽셀 좌표 */
export type CanonicalPoint = readonly [x: number, y: number];

export type VerificationStatus = 'verified' | 'unverified' | 'needs-recheck';

/** 미확인 상태를 '없음/불가'와 절대 혼동하지 않기 위한 3상태 래퍼 */
export type VerifiableField<T> =
  | { status: 'verified'; value: T }
  | { status: 'unverified'; note?: string };

export interface VerificationRecord {
  verificationStatus: VerificationStatus;
  verificationSource: string; // 예: "인게임 리플레이 직접 확인", "공식 Update 38.2 패치노트 + 인게임 대조"
  verifiedGamePatch: string;  // 예: "42.2"
  verifiedAt: string;         // ISO 날짜 "YYYY-MM-DD"
}

export type MapAssetMode = 'sample' | 'official';

export interface MapOverlayLayer {
  id: string;
  label: string;
  imagePath: string;
  mapImageVersion: string; // 예: "31.2" 또는 "sample-v1"
  bounds: readonly [topLeft: CanonicalPoint, bottomRight: CanonicalPoint];
  minDisplayZoom?: number;
}

export interface TargetZone {
  id: string;              // 예: "palace" | "terminal"
  displayName: string;     // 예: "궁전 (Palace)"
  bounds: readonly [topLeft: CanonicalPoint, bottomRight: CanonicalPoint];
  pilotReady: boolean;
  verifiedGamePatch: string;
}

export interface MapDatasetConfig {
  mapId: 'taego';
  canonicalSize: 8192;
  assetMode: MapAssetMode;
  baseImage: {
    imagePath: string;
    mapImageVersion: string;
    pixelWidth: number;
    pixelHeight: number;
    rightsClearedForPublicDeploy: boolean;
  };
  highResOverlays: MapOverlayLayer[];
  targetZones: TargetZone[];
}

export type RooftopAccessValue =
  | { kind: 'interior-stairs'; summary: string }
  | { kind: 'exterior-climb'; summary: string }
  | { kind: 'inaccessible'; summary: string };

export interface BuildingExteriorImage {
  imagePath: string;
  credit: string; // 예: "직접 인게임 리플레이 촬영 (KRAFTON IP)"
  capturedPatch: string;
}

export interface BuildingRecord {
  id: string;                 // 예: "palace-01"
  zoneId: string;             // 예: "palace"
  isPilotSlice: boolean;      // Pilot Slice 3개 건물 식별
  buildingType: string;       // 예: "2층 발코니 상가"
  footprint: CanonicalPoint[]; // 시계/반시계 닫힌 다각형 꼭짓점 (>= 3)
  mapImageVersion: string;    // 이 좌표를 추출한 배경 지도 판본
  provenance: VerificationRecord;
  attributes: {
    floors: VerifiableField<number>;
    rooftopAccess: VerifiableField<RooftopAccessValue>;
    entrances: VerifiableField<{
      count: number;
      directionsSummary: string; // 예: "남쪽 정문 1, 북쪽 후문 1"
    }>;
    exteriorImage: VerifiableField<BuildingExteriorImage>;
  };
}

export type VehicleGameMode = 'normal' | 'ranked' | 'esports' | 'all-verified';
export type VehicleSpawnType = 'garage' | 'fixed-spot';

export interface FixedVehicleSpawnRecord {
  id: string;
  zoneId: string | 'taego-wide'; // Target Zone으로 시작해 전역 확장 수용
  coord: CanonicalPoint;
  mapImageVersion: string;
  gameMode: VehicleGameMode;
  spawnType: VehicleSpawnType;
  vehicleTypes: string[];        // 예: ["포니 쿠페", "포터", "사륜 차량"]
  notes?: string;                // 예: "차고 내부 고정 스팟 (매 경기 확정 출현 아님)"
  provenance: VerificationRecord;
}
```

---

### 3. 화면 구성 (Screen Composition)

1. **진입 화면 (맵 선택 뷰)**
   - 단일 카드 기반 레이아웃: `태이고 (Taego)` 맵 이름, 경량 미리보기 썸네일, 1차 등록 범위 짧은 안내(`등록 구역 · 검증된 건물 및 고정 차량 위치 제공`), 비공식 팬 프로젝트 및 저작권 안내.
   - 카드 전체 클릭/탭 시 지도 뷰어로 이동(향후 다른 맵 카드 추가에 열린 구조).
2. **메인 지도 화면 (전체 화면 뷰포트)**
   - **지도 캔버스(화면 90% 이상)**: Leaflet `CRS.Simple` 기반 전체 화면 인터랙티브 지도, 은은한 `Target Zone` 점선 경계, 클릭 시 강조되는 `Roof Footprint` SVG 폴리곤.
   - **좌측 상단 미니 컨트롤**: `← 맵 목록`, `전체 보기(Reset)`, 컴팩트 배지(`등록 구역: [구역명] · 이동` 버튼 — 미등록 영역 탐색 시 길잡이).
   - **우측 상단 레이어 컨트롤**: `차량 위치 ON/OFF` 단일 토글 버튼 및 활성 시 표시되는 `Fixed Vehicle Spawn Point` 마커(클릭 시 간결한 툴팁/팝오버 표시).
   - **상세 정보 뷰 (`Building Card`)**:
     - PC: 선택된 지붕과 겹치지 않게 위치 보정된 컴팩트 플로팅 팝업/사이드 카드.
     - 모바일: 하단 고정 바텀 카드(닫기 버튼 + 드래그/지도 빈 곳 탭으로 닫기).
     - 표시 항목: 건물 유형, 검증된 외관 사진(없거나 미확인 시 안전 안내), 층수, `Rooftop Access` 방식, 출입구 수·방향, `Verified Game Patch` 및 확인일.
   - **하단 최소 고정 안내**: 비공식 팬 프로젝트 고지 및 이미지 자산 모드(`샘플 지도` / `KRAFTON IP 저작권 표기`).
   - **개발 모드 전용 플로팅 툴바 (`NODE_ENV === 'development'`일 때만 존재)**: `다각형 그리기` / `차량 좌표 찍기` 모드 전환, `점 되돌리기(Undo)`, `취소(Cancel)`, `JSON 복사` 버튼 및 꼭짓점 미리보기 레이어.

---

## Testing Decisions

좋은 테스트는 **외부에서 관찰 가능한 동작(Public Interface)** 만 검증하며, 내부 상태 구조나 Leaflet private API 구현 상세에 결합하지 않는다. 기대값은 구현 코드를 역산하지 않고 독립적인 기하학 예제·명세 규칙에서 도출한다.

본 명세는 사전 합의된 **3개의 상위 Seam** 에서 테스트를 구성한다.

### Seam 1: 도메인·좌표 모듈 인터페이스 (Unit & Integration Tests)
- **대상**: 좌표 변환, 다각형 히트 판정, 데이터 검증 및 `Unverified State` 필터링 모듈.
- **검증 기준**:
  1. `Canonical Pixel Space`(`8192 × 8192`) → Leaflet `[8192 - y, x]` 변환이 좌상단 `(0,0)`, 중앙 `(4096,4096)`, 우하단 `(8192,8192)` 경계값에서 정확히 일치하는지 검증.
  2. 배경 지도 이미지 실제 픽셀 해상도가 `2048×2048`에서 `4096×4096` 또는 크롭 오버레이로 바뀌어도 동일 `CanonicalPoint`에 대한 Leaflet 좌표가 불변인지 검증.
  3. 인접한 3개 `Pilot Slice` 폴리곤(오목 ㄱ자/ㄷ자 다각형 포함)에서 내부 점은 자기 건물 ID만 반환하고, 경계 밖 여백·인접 건물·미등록 좌표는 `null`을 반환하는지 검증.
  4. `verificationStatus !== 'verified'` 레코드가 공개 목록에서 제외되는지, 그리고 `rooftopAccess.status === 'unverified'`가 `'inaccessible'`로 변환되지 않는지 검증.

### Seam 2: 인터랙티브 지도 UI 인터페이스 (Component / Playwright E2E Tests)
- **대상**: 렌더링된 브라우저 지도 뷰어(PC 데스크톱 뷰포트 + 모바일 에뮬레이션 뷰포트).
- **검증 기준**:
  1. **건물 클릭 정확도**: `Pilot Slice` 3개 건물의 각 지붕 중심을 클릭할 때 해당 `Building Card`만 열리고 다른 건물 카드는 열리지 않음. 도로·빈 땅 클릭 시 카드가 열리지 않고 열린 카드가 닫힘.
  2. **확대·이동·리사이즈 정합성**: 줌 인/아웃, 지도 드래그 이동, 브라우저 창 크기 변경 후에도 같은 지붕 픽셀 위치 클릭 시 동일 건물이 선택됨.
  3. **모바일 터치 가드**: 모바일 뷰포트에서 지붕 위에서 시작한 드래그(팬) 또는 두 손가락 핀치 줌 제스처 수행 시 `Building Card`가 열리지 않음.
  4. **차량 레이어 토글**: 초기 OFF 상태에서 차량 마커가 보이지 않고, ON 토글 후에만 검증된 `Fixed Vehicle Spawn Point` 마커가 표시되며 클릭 시 `gameMode`·`spawnType`·`vehicleTypes`·`Verified Game Patch`가 표시되고 확률/100% 문구가 없음.
  5. **등록 구역 이동**: `Unregistered Area`로 이동한 뒤 구역 이동 버튼 클릭 시 `Target Zone` 범위로 지도가 이동함.

### Seam 3: 프로덕션 빌드 격리 및 개발 전용 Picker 검증 (Build & Dev Mode Tests)
- **대상**: Next.js 개발 서버(`NODE_ENV=development`) 및 프로덕션 빌드(`next build` / `NODE_ENV=production`).
- **검증 기준**:
  1. **개발 모드 동작**: Picker 활성화 시 클릭한 순서대로 꼭짓점이 추가되고, `Undo` 시 마지막 점만 제거되며, `Cancel` 시 초기화되고, `Copy JSON` 시 유효한 `CanonicalPoint[]` JSON이 복사되며, 편집 중에는 지붕 내부를 클릭해도 `Building Card`가 열리지 않음.
  2. **프로덕션 격리 (필수 게이트)**: `next build` 실행 후 생성된 프로덕션 클라이언트 번들 청크(`.next/static/`)에 Picker 전용 문자열/식별자가 포함되지 않음을 검사하고, 프로덕션 실행 서버(`next start`)에서 Picker UI·토글·단축키·쿼리로 접근할 수 없음을 Playwright로 검증.

---

## Out of Scope

- 서버 데이터베이스, 사용자 인증/계정, 사용자 제보 실시간 저장 API
- PUBG Developer API 실시간 매치/텔레메트리 연동
- 3D 건물 뷰어 또는 층별 내부 도면(블루프린트) 렌더링
- 비밀방 위치, 파밍 확률·티어 점수, 검증되지 않은 차량 출현 확률
- 확인되지 않은 건물 정보나 임의 생성된(더미/추측) 차량 스폰 좌표
- 제3자 팬 사이트(`PUBG.GS`, `PUBGMAPS` 등)가 가공한 타일·이미지 무단 크롤링 및 재배포
- 태이고 외 다른 맵(에란겔, 미라마 등)의 실제 데이터 구현(단, 맵 선택 카드 UI는 확장 가능하게 유지)

---

## Further Notes

### 1. 주요 기술적 위험 및 완화·검증 방법

| 기술적 위험 | 영향 | 완화 및 검증 방법 |
| :--- | :--- | :--- |
| **31.2 지도 이미지 vs 현재 라이브 게임 불일치** | 구버전 지붕 위에 다각형이 어긋나거나 존재하지 않는 건물 표시 | **구현/등록 전 필수 사전 검증**: 인게임 리플레이/사용자 지정 매치로 `Palace` 및 `Terminal` 건물 배치를 31.2 이미지와 대조해 100% 일치하는 구역 1곳만 `Target Zone`으로 확정 |
| **101MB 원본 PNG로 인한 모바일 메모리/로딩 실패** | 모바일 브라우저 강제 종료 및 초기 로딩 수십 초 지연 | 전체 지도는 경량 WebP(1~2MB) + `Target Zone` 고해상도 크롭 WebP 오버레이로 분리. 실제 저사양 모바일 기기/에뮬레이터 메모리·FPS 측정 후 필요 시에만 정적 타일로 전환 |
| **Next.js 15+ `ssr: false` 오류 및 Leaflet CSS/마커 누락** | `Server Component`에서 `next/dynamic(..., { ssr: false })` 호출 시 빌드 실패; 기본 마커 아이콘 404 | Server Component → Client Wrapper(`'use client'`) → `next/dynamic(..., { ssr: false })` 2단 경계 적용. Leaflet 마커는 기본 이미지 경로 의존 대신 `L.divIcon` 또는 인라인 SVG 아이콘 사용 |
| **모바일 드래그/핀치 중 오선택** | 사용자가 지도를 움직이려다 원치 않는 `Building Card`가 계속 열림 | Leaflet `movestart`/`zoomstart`부터 `moveend`/`zoomend` 직후 짧은 쿨다운 구간 동안 클릭/탭 핸들러를 무시하고, Playwright 터치 시뮬레이션으로 검증 |
| **지도·스크린샷 저작권 및 재배포 제약** | KRAFTON 약관(`pubg/api-assets` Terms of Use vs 콘텐츠 제작 가이드라인) 위반 위험 | `rightsClearedForPublicDeploy` 플래그로 게이트 관리. 권리 확인 전까지는 자체 제작 샘플 지도로 기능 개발·데모를 수행하고, 공식 이미지는 권리 확인 완료 후 공개 배포에 포함 |

### 2. 사전 검증 · 구현 · 배포 단계별 의존성

```text
[Phase 0: 사전 검증 (코드 외 선행 조건)]
  ├── (0-A) 인게임 대조: 31.2 지도 이미지 vs 현재 라이브 패치(Palace / Terminal) 일치 확인 → Target Zone 1곳 확정
  └── (0-B) 자산 권리 확인: KRAFTON 공식 가이드라인/개발자 약관 범위 확인 (미확인 시 Sample Map 모드로 진행)
        │
        ▼
[Phase 1: 기반 코어 및 Next.js 지도 뷰어 (Sample/Verified 자산 지원)]
  └── Domain/Coordinate Deep Module + Next.js App Router SSR/Client 경계 + 전체 지도 탐색
        │
        ▼
[Phase 2: 개발 전용 Polygon Picker + Pilot Slice(건물 3개) 검증]
  ├── Dev-only Picker 구현 (추가/되돌리기/취소/복사/클릭 차단)
  └── (0-A) 완료 구역 내 인접 건물 3개 좌표 추출 및 클릭 정확도·인접 분리 테스트 통과
        │
        ▼
[Phase 3: 건물 카드 + 모바일 터치 가드 + 고정 차량 레이어]
  ├── Building Card (PC 팝업 / 모바일 하단 카드, 미확인 상태 격리)
  └── Fixed Vehicle Spawn Point 레이어 ON/OFF + 모바일 팬/핀치 가드 E2E 검증
        │
        ▼
[Phase 4: 데이터 확장 (약 20개 건물 + 확인된 차량 스폰)]
  └── Target Zone 내 검증 완료 건물 ~20개 및 구역·인접 도로 고정 차량 스폰 등록 (실측 성능 점검 → 필요 시 타일 검토)
        │
        ▼
[Phase 5: 공개 배포 게이트 (Production Gate)]
  ├── 프로덕션 빌드 내 Picker 완전 배제 검증 (`next build` + `next start`)
  └── (0-B) 공식 지도·외관 이미지 공개 사용 권리 확인 완료 (미해결 시 공개 배포는 자체 샘플 지도로만 제한)
```

### 3. 실제 개발을 위한 권장 작업 순서

1. **사전 현장 검증(Phase 0)**:
   - 인게임에서 `Palace`와 `Terminal`을 확인하여 `31.2` 지도와 지붕 배치가 100% 일치하는 `Target Zone` 1곳 선정 및 인접 `Pilot Slice` 3개 건물 구조·외관 스샷 촬영.
   - 동시에 크래프톤 고객센터/약관 원문으로 `pubg/api-assets` 이미지의 정적 웹 사이트 사용 조건 확인 착수.
2. **프로젝트 부트스트랩 및 테스트 러너 구성**:
   - Next.js(App Router, TypeScript) 최소 셋업, 단위/통합 테스트 도구 및 Playwright E2E 환경 구성.
3. **Seam 1 구현 (Domain & Coordinate Module TDD)**:
   - `8192 × 8192` ↔ `[8192 - y, x]` 좌표 변환, Point-in-Polygon 판정, 데이터 스키마·`unverified` 필터링 함수를 테스트 우선(Red-Green)으로 구현.
4. **지도 캔버스 & Next.js 경계 구현**:
   - 맵 선택 카드 → Client Shell(`'use client'`) → `dynamic(..., { ssr: false })` Leaflet 뷰어 구축(우선 경량 샘플 지도 또는 로컬 검증용 31.2 WebP 연결).
5. **Seam 3 개발 전용 Picker 구현**:
   - `NODE_ENV === 'development'` 가드 하에 좌표 추출·되돌리기·취소·복사·일반 클릭 억제 구현.
6. **`Pilot Slice` 3개 등록 및 Seam 2 집중 검증**:
   - Picker로 3개 인접 건물 `Roof Footprint`를 추출해 `buildings.json`에 등록하고, PC·모바일에서 인접 분리, 오클릭 무시, 드래그/핀치 가드 검증 통과.
7. **`Building Card`, `Target Zone` 안내, `Fixed Vehicle Spawn Point` 레이어 완성 및 ~20개 확장**:
   - 검증 완료된 건물 약 20개와 인게임 확인 고정 차량 좌표(구역 및 인접 도로)만 단계적으로 등록하고, 모바일 실측 성능 확인(필요 시에만 정적 타일 전환).
8. **프로덕션 격리 및 공개 배포 게이트 통과**:
   - `next build` 번들 및 프로덕션 실행 환경에서 Picker 미노출 검증 완료 후, 권리 확인 상태에 따라 공개 배포 진행.
