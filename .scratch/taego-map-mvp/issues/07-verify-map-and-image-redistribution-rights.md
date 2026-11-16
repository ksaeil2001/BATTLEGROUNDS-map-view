## Parent

Part of #1 (`[Spec] 태이고 건물·고정 차량 지도 MVP 개발 명세서`)

## What to build

실제 태이고 지도 이미지(`pubg/api-assets` 기반)와 인게임 촬영 외관 스크린샷을 웹사이트에 포함해 **공개 배포하기 전 반드시 통과해야 하는 법적·라이선스 권리 검증 작업**이다. 게임 데이터 검증(`#7`) 및 샘플 지도 구현(`#2`~`#6`)과 독립적으로 병렬 진행할 수 있다.

- **KRAFTON 공식 가이드라인 vs 개발자 에셋 약관 원문 대조**:
  1. `KRAFTON / PUBG 공식 콘텐츠 제작 가이드라인` 상 비영리 팬 사이트의 인게임 리플레이 스크린샷·로고·지명 활용 조건 및 필수 고지 문구 확인.
  2. `github.com/pubg/api-assets` README가 인용하는 `PUBG Developer Portal Terms of Use` 상 *"API 데이터 전송·표시와 연계된 사용"* 조항이 **PUBG Developer API를 직접 호출하지 않는 순수 정적 지도 웹사이트**의 `Taego_Main_High_Res.png` 가공(WebP/크롭) 및 공개 재호스팅을 허용하는지 공식 고객센터(PUBG Support / Developer Support) 또는 최신 약관 원문을 통해 확인.
- **공개 배포 가능 범위 판정**:
  - 허용 확인 시: 필수 저작권·비공식 팬 사이트 면책 문구와 허용 조건을 기록하고 `rightsClearedForPublicDeploy = true` 기준을 확정한다.
  - 불허 또는 불명확 시: 공식 지도 이미지 공개 배포를 차단(`rightsClearedForPublicDeploy = false` 유지)하고 자체 제작/대체 지도 전략을 결정한다.

## Acceptance criteria

- [ ] KRAFTON 공식 콘텐츠 제작 가이드라인(국문/영문 최신판)에서 요구하는 비영리 팬 사이트 필수 고지 문구 및 금지 사항이 정리된다.
- [ ] `pubg/api-assets` 태이고 지도 원본 및 WebP 가공본을 PUBG API 미연동 정적 웹사이트에 공개 호스팅하는 것에 대한 공식 약관 검토 또는 공식 지원 채널 답변 근거가 기록된다.
- [ ] 확인된 사실과 미확인 경계를 구분한 최종 판정 결과(`rightsClearedForPublicDeploy`: 허용 / 조건부 허용 / 불가)가 이슈에 남는다.

## Blocked by

None (can start immediately; runs in parallel with #2~#6 and #7)
