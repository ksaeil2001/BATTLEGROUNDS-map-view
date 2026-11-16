## Parent

Part of #1 (`[Spec] 태이고 건물·고정 차량 지도 MVP 개발 명세서`)

## What to build

건물 지붕 다각형(`#3`) 등록과 향후 좌표 추출을 정확하게 수행하기 위해, **로컬 개발 환경 전용 Polygon & Coordinate Picker**를 구현하고 **프로덕션 빌드에서는 완전히 배제**되도록 격리한다.

- **개발 전용 편집 모드 (`process.env.NODE_ENV === 'development'`)**: 개발 환경에서만 활성화되는 플로팅 편집 툴바를 통해 ① 건물 `Roof Footprint`(다각형) 추출 모드 또는 차량 좌표(단일 점) 추출 모드를 선택하고, ② 지도 클릭으로 `Canonical Pixel Space` 정수 좌표 `[x, y]`를 순서대로 추가하며, ③ 마지막 점 되돌리기(Undo), ④ 선택/편집 취소(Cancel), ⑤ JSON 스니펫 클립보드 복사 기능을 제공한다.
- **편집 중 클릭 충돌 차단**: Picker 편집 모드가 활성화되어 있는 동안에는 지붕 내부를 클릭해도 일반 `Building Card` 선택 이벤트가 발생하지 않도록 이벤트를 격리한다.
- **프로덕션 완전 배제**: `next build` 및 `next start` 프로덕션 환경에서는 Picker 코드와 UI가 트리 셰이킹으로 제거되며 어떠한 경로·쿼리·버튼으로도 접근할 수 없어야 한다.

## Acceptance criteria

- [ ] **Seam 3 (개발 모드) 테스트**: 개발 환경에서 Picker를 켜고 지도 위 여러 점을 클릭하면 `Canonical Pixel Space` 정수 좌표 `[x, y]` 다각형 미리보기가 순서대로 그려진다.
- [ ] **Seam 3 (개발 모드) 테스트**: `Undo` 실행 시 마지막 꼭짓점만 제거되고, `Cancel` 실행 시 현재 편집 좌표가 모두 초기화되며, `Copy JSON` 실행 시 유효한 좌표 배열 JSON이 클립보드에 복사된다.
- [ ] **Seam 3 (개발 모드) 테스트**: Picker 편집 모드 활성 중 기존 등록된 건물 지붕 위를 클릭해도 `Building Card`가 열리지 않고 좌표 점만 추가된다.
- [ ] **Seam 3 (프로덕션 격리) 테스트**: `NODE_ENV=production`으로 `next build`를 실행한 뒤 `.next/static/` 클라이언트 번들 청크에 Picker 전용 식별자/UI 문자열이 포함되지 않음을 자동 검증한다.
- [ ] **Seam 3 (프로덕션 격리) 테스트**: `next start` 프로덕션 서버에서 Picker 관련 UI, 컨트롤, 개발 전용 라우트/쿼리로 접근할 수 없음을 확인한다.

## Blocked by

- Blocked by #3
