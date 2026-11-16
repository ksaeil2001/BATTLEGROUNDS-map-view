## Parent

Part of #1 (`[Spec] 태이고 건물·고정 차량 지도 MVP 개발 명세서`)

## What to build

첫 번째 구현 슬라이스로서 Next.js(App Router, TypeScript) 기본 프로젝트와 테스트 환경을 구성하고, **정적 샘플 지도** 위에서 태이고 전체 지도 탐색(확대·축소·이동·초기화)과 `Canonical Pixel Space`(`8192 × 8192`) 기준 좌표 변환을 구현한다.

- **맵 선택 → 전체 화면 지도 진입**: 맵 이름(`태이고`), 경량 미리보기, 1차 등록 범위 안내, 비공식 팬 프로젝트 고지가 담긴 맵 선택 카드에서 클릭 시 전체 화면 지도 뷰어로 진입한다.
- **Next.js 15+ 공식 SSR/Client 경계**: `Server Component`에서 정적 지도 메타데이터(`MapDatasetConfig`)를 검증해 직렬화 가능한 props로 전달하고, `'use client'` 래퍼 모듈 내부에서 `next/dynamic(..., { ssr: false })`로 Leaflet 캔버스를 마운트한다.
- **기준 좌표계 및 하이브리드 이미지 구조**: 좌상단 `(0, 0)` 기준 `8192 × 8192` 픽셀 좌표를 Leaflet `CRS.Simple`의 `[8192 - y, x]`로 1회 변환해, 자체 샘플 지도(`assetMode: 'sample'`)와 향후 고해상도 크롭 오버레이가 해상도와 무관하게 동일한 위치에 정렬되도록 구성한다.
- **최소 제어 UI**: 화면 대부분을 지도에 할당하고 `← 맵 목록`, `전체 보기(Reset)`, `Target Zone` 점선 경계 및 이동 버튼(`flyToBounds`)만 간결하게 배치한다.

## Acceptance criteria

- [ ] Next.js(App Router, TypeScript) 프로젝트 기본 설정과 단위/통합 테스트 러너 및 Playwright E2E 테스트 환경이 구성된다.
- [ ] `Server Component`가 `next/dynamic(..., { ssr: false })`를 직접 호출하지 않고 `'use client'` 경계를 통해 Leaflet 캔버스를 마운트하며, `next build`와 dev 서버가 SSR 오류 없이 동작한다.
- [ ] **Seam 1 테스트**: `Canonical Pixel Space`(`8192 × 8192`) ↔ `[8192 - y, x]` 변환이 좌상단 `(0,0)`, 중앙 `(4096,4096)`, 우하단 `(8192,8192)` 경계값에서 정확히 일치한다.
- [ ] **Seam 1 테스트**: 배경 샘플 지도 이미지의 실제 픽셀 해상도(예: `2048×2048` vs `4096×4096`)가 달라도 동일 `CanonicalPoint`가 동일한 Leaflet 지도 위치에 매핑된다.
- [ ] **Seam 2 테스트**: 맵 선택 카드 클릭 → 전체 화면 샘플 지도 진입 → 휠 줌/드래그 팬/전체 보기 초기화/`Target Zone` 이동이 오류 없이 동작한다.
- [ ] KRAFTON 권리 확인 전 공개 배포에도 안전한 자체 제작 샘플 지도 자산(`rightsClearedForPublicDeploy`)으로 동작한다.

## Blocked by

None (can start immediately)
