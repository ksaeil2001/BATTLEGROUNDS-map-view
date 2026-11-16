## Parent

Part of #1 (`[Spec] 태이고 건물·고정 차량 지도 MVP 개발 명세서`)

## What to build

샘플 지도 기능·E2E 검증(`#6`)과 인게임 현장 검증(`#7`)이 완료된 뒤, 실제 태이고 `Target Zone` 데이터를 등록하고 고해상도 구역 오버레이를 연동한다. 공개 배포 시에는 지도 이미지 권리 검증(`#8`) 통과를 필수 게이트로 적용한다.

- **검증 완료 데이터 반영**: `#7`에서 확인된 `Target Zone` 내 `Pilot Slice` 3개 및 약 20개 건물의 `Roof Footprint` 다각형을 개발 전용 Picker(`#5`)로 `Canonical Pixel Space` 좌표에 정확히 추출해 `buildings.json`에 등록하고, 확인된 `Fixed Vehicle Spawn Point`만 `vehicles.json`에 등록한다. 미확인 속성은 `Unverified State` 그대로 둔다.
- **2단계 하이브리드 지도 이미지 연동 (ADR-0001)**:
  - `pubg/api-assets` 31.2 원본을 경량 전체 지도 WebP(약 1~2MB)로 변환하고, 확정된 `Target Zone` 영역만 `8192 × 8192` 원본 해상도 크롭 WebP 오버레이로 중첩한다.
  - 실제 PC·모바일 기기에서 로딩 속도·메모리·줌 프레임을 실측하여 기록하고, 병목이 확인되는 경우에만 정적 타일(`L.tileLayer`) 전환 여부를 판단한다.
- **권리 게이트 기반 공개 배포 (`#8` 연동)**: `#8`에서 공개 배포 권한이 최종 확인(`rightsClearedForPublicDeploy = true`)된 경우에만 공식 지도·외관 자산을 공개 배포 빌드에 포함하며, 미통과 상태에서는 공개 배포를 자체 샘플 지도로만 제한한다.

## Acceptance criteria

- [ ] `#7`에서 인게임 일치 확인된 `Target Zone`의 건물(~20개)과 확인된 고정 차량 스폰 위치가 `mapImageVersion`, `verifiedGamePatch`, `Verification Record`와 함께 `buildings.json` / `vehicles.json`에 등록된다.
- [ ] 경량 전체 지도 WebP와 `Target Zone` 고해상도 크롭 WebP 오버레이가 `Canonical Pixel Space` 좌표 위에서 어긋남 없이 정렬되며, 기존 테스트 스위트(Seam 1, Seam 2, Seam 3)가 모두 통과한다.
- [ ] 실제 기기/환경 기준 초기 로딩 속도 및 모바일 메모리/반응성 측정 결과가 기록된다.
- [ ] `#8`의 권리 확인 결과에 따라 `rightsClearedForPublicDeploy` 게이트가 정확히 동작하며, 권리 미확인 상태의 공식 지도 자산이 공개 배포 경로에 노출되지 않는다.

## Blocked by

- Blocked by #6
- Blocked by #7
- Blocked by #8
