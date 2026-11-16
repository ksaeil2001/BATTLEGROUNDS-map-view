## Parent

Part of #1 (`[Spec] 태이고 건물·고정 차량 지도 MVP 개발 명세서`)

## What to build

건물 클릭 기능(`#3`)과 독립적으로, 기본 지도를 가리지 않는 ON/OFF 토글 방식의 **`Fixed Vehicle Spawn Point` 레이어**와 확장 가능한 차량 데이터 모델을 구현한다.

- **전역 확장 가능한 정적 스키마**: `vehicles.json`은 `zoneId` 또는 `'taego-wide'`를 지원해 초기 `Target Zone`·인접 도로에서 시작해 향후 태이고 전역의 고정 차량 출현 지점으로 구조 변경 없이 확장할 수 있도록 설계한다.
- **엄격한 사실 구분**: 각 `Fixed Vehicle Spawn Point`는 `gameMode`, `spawnType`(`garage` | `fixed-spot`), `vehicleTypes`, `Verification Record`(`verificationSource`, `verifiedAt`), `Verified Game Patch`, `Map Image Version`을 구분 저장한다. 매 경기 100% 확정 출현으로 취급하거나 검증되지 않은 출현 확률 수치를 저장·표시하지 않는다.
- **레이어 ON/OFF 및 간결한 정보 표시**: 우측 상단 단일 토글 버튼(`차량 위치 ON/OFF`)으로 레이어를 켜고 끄며, 토글 ON 시 `verified` 차량 마커만 표시(SVG/`L.divIcon` 사용으로 Leaflet 기본 아이콘 경로 오류 방지)하고 클릭 시 모드·유형·차종·패치·근거만 간결하게 보여준다.

## Acceptance criteria

- [ ] `vehicles.json` 스키마 및 정적 어댑터가 `zoneId` / `'taego-wide'`, `gameMode`, `spawnType`, `vehicleTypes`, `Verification Record`를 검증하고 `verificationStatus === 'verified'` 레코드만 반환한다.
- [ ] **Seam 1 테스트**: `verificationStatus !== 'verified'` 차량 스폰 레코드가 공개 레이어 목록에서 제외된다.
- [ ] **Seam 2 테스트**: 초기 상태(또는 토글 OFF)에서 차량 마커가 렌더링되지 않으며 지도 탐색을 방해하지 않는다.
- [ ] **Seam 2 테스트**: 토글 ON 시 검증된 샘플 차량 스폰 마커가 `Canonical Pixel Space` 좌표에 정확히 표시되고, 마커 클릭 시 `gameMode`·`spawnType`·`vehicleTypes`·`Verified Game Patch`·`verificationSource`가 간결하게 표시된다.
- [ ] UI와 데이터 어디에도 검증되지 않은 출현 확률(%)이나 "매 경기 100% 확정 출현" 문구가 포함되지 않는다.
- [ ] 확인되지 않은 임의의 차량 스폰 데이터를 목표 개수 맞추기용으로 추가하지 않는다(기능 검증용 샘플 데이터는 `assetMode: 'sample'`에 한정).

## Blocked by

- Blocked by #2
