## Parent

Part of #1 (`[Spec] 태이고 건물·고정 차량 지도 MVP 개발 명세서`)

## What to build

샘플 지도 위에서 `Target Zone` 내 **인접한 건물 3개(`Pilot Slice`)** 의 `Roof Footprint` 다각형을 직접 클릭해 건물 윤곽만 강조하고, 검증된 정보만 표시하는 `Building Card`를 여는 핵심 사용자 경험을 구현·검증한다.

- **핀 없는 다각형 클릭 선택**: 건물 위에 상시 핀/마커를 띄우지 않고 투명 SVG `Roof Footprint` 폴리곤을 배치하며, 선택된 건물의 윤곽만 강조한다.
- **정확한 히트 판정 및 오선택 방지**: ㄱ자/인접 건물을 포함한 지붕 내부 클릭 시 해당 건물만 선택되고, 도로·빈 땅·`Unregistered Area` 클릭 시에는 선택을 무시하고 열려 있는 카드를 닫는다.
- **검증 중심 `Building Card` 및 `Unverified State` 격리**: `buildings.json` 스키마(`VerifiableField<T>`, `VerificationRecord`, `Map Image Version`, `Verified Game Patch`)를 적용해 `verificationStatus === 'verified'`인 건물과 속성(건물 유형, 외관 이미지, 층수, `Rooftop Access`, 출입구 수·방향, 패치 버전·확인일)만 노출한다. 확인되지 않은 속성은 `'unverified'` 상태를 보존하며 절대 `'접근 불가'`나 `'없음'`으로 표시하지 않는다.

## Acceptance criteria

- [ ] `Pilot Slice` 인접 건물 3개 데이터가 샘플 지도 기준 `Canonical Pixel Space` 좌표로 등록되며, 이 중 1개 이상에 `Unverified State` 속성과 `verified` 속성이 함께 포함되어 미확인 상태 처리가 검증된다.
- [ ] **Seam 1 테스트**: 다각형 히트 판정 모듈이 오목(ㄱ자) 다각형 내부, 인접 건물 경계, 다각형 외부/여백 좌표에서 정확한 건물 ID 또는 `null`을 반환한다.
- [ ] **Seam 1 테스트**: `verificationStatus !== 'verified'` 레코드가 공개 목록에서 제외되고, `rooftopAccess.status === 'unverified'`가 `'inaccessible'`로 변환되지 않는다.
- [ ] **Seam 2 테스트**: 브라우저에서 `Pilot Slice` 3개 건물의 지붕을 각각 클릭하면 자기 자신의 `Building Card`만 열리고 해당 지붕 윤곽만 강조된다.
- [ ] **Seam 2 테스트**: 도로, 빈 땅, 미등록 건물 클릭 시 어떤 `Building Card`도 열리지 않으며 기존에 열린 카드가 닫힌다.
- [ ] **Seam 2 테스트**: 줌 인/아웃, 팬, 배경 이미지 해상도 변경 후에도 `Roof Footprint`가 동일 지붕 위치에서 어긋나지 않는다.

## Blocked by

- Blocked by #2
