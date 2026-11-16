# 0002. Verification-First Domain Schema and Tri-State Attributes

- Status: accepted

## Context

건물의 층수·옥상 접근·출입구·외관 사진이나 고정 차량 출현 지점은 인게임 현장 검증 속도에 따라 일부 속성만 먼저 확인되거나 패치 이후 재검증이 필요할 수 있다. 확인되지 않은 값을 `'없음'`이나 `'접근 불가'`로 저장하면 사용자에게 오정보를 제공하게 되며, 고정 차량 스폰 위치를 '매 경기 100% 확정 출현'으로 오인하거나 미검증 확률을 표시하는 것 역시 사실 기반 탐색 원칙에 위배된다.

## Decision

1. **정적 JSON 분리 저장**: 건물 데이터(`buildings.json`)와 고정 차량 출현 지점 데이터(`vehicles.json`)를 별도의 정적 JSON 파일로 분리해 관리하고 TypeScript 스키마로 검증한다.
2. **미확인 상태(`unverified`) 명시적 허용**: 건물의 `floors`, `rooftopAccess`, `entrances`, `exteriorImage` 등 모든 속성은 미확인 상태(`status: 'unverified'` 등)를 독립 값으로 표현하며, 절대 `'접근 불가'`나 `0`/`없음`으로 치환하지 않는다.
3. **판본 및 검증 근거 이력 분리**: 모든 건물·차량 레코드는 `mapImageVersion`(배경 지도 판본), `verifiedGamePatch`(인게임 검증 패치), `verificationSource`(확인 근거), `verifiedAt`(검증 날짜), `verificationStatus`를 분리 저장한다.
4. **고정 차량 스폰의 엄격한 모델링**: `Fixed Vehicle Spawn Point`는 `gameMode`(예: 일반/경쟁전/이스포츠), `spawnType`(차고/고정 스팟), `vehicleTypes`(가능 차종), `verificationStatus`, `verificationSource`, `verifiedGamePatch`, `verifiedAt`을 구분해 기록하고, 검증되지 않은 출현 확률이나 매 경기 100% 확정 출현 문구는 저장·표시하지 않는다.
5. **검증 정보만 노출**: 사용자 UI(`Building Card` 및 차량 정보 뷰)에는 `verified` 상태로 확인된 항목만 렌더링한다.

## Considered Options

- 미확인 항목을 `null` 또는 기본값(`접근 불가`, `0층`)으로 처리하는 단순 평면 스키마 (미확인과 부정 사실의 혼동 위험으로 기각)
- 건물과 차량을 단일 GeoJSON FeatureCollection으로 통합 관리하는 방식 (차량의 전역 확장과 검증 메타데이터 스키마 분리 관리가 불리해 기각)

## Consequences

- 건물 또는 차량 데이터를 임의로 개수에 맞춰 채워 넣지 않고, 확인된 속성부터 점진적으로 채우면서 안전하게 배포할 수 있다.
- 향후 태이고 전역으로 차량 스폰 데이터를 확장할 때 기존 건물 스키마나 좌표 체계를 수정하지 않고 `vehicles.json`에 레코드만 추가할 수 있다.
