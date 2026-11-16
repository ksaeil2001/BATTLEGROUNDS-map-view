## Parent

Part of #1 (`[Spec] 태이고 건물·고정 차량 지도 MVP 개발 명세서`)

## What to build

샘플 지도 개발 흐름(`#2`~`#6`)과 독립적으로 병렬 진행하는 **인게임 현장 데이터 및 지도 판본 일치 검증 작업**이다. 확인되지 않은 정보나 추측은 절대 기록하지 않는다.

- **지도 판본 대조 및 `Target Zone` 1곳 확정**: `pubg/api-assets`의 `31.2` 태이고 지도(`Taego_Main_High_Res.png`)와 현재 라이브 게임 내 지형·지붕 배치를 비교하여, **궁전(`Palace`)** 과 **터미널(`Terminal`)** 중 건물·지붕 배치가 100% 일치하는 구역 1곳을 `Target Zone`으로 확정한다.
- **인게임 건물 실사 및 속성 검증**: 확정된 `Target Zone` 내 `Pilot Slice` 인접 건물 3개 및 약 20개 건물에 대해 인게임 리플레이/사용자 지정 매치로 직접 진입·촬영하여 ① 외관 스크린샷(WebP), ② 층수, ③ `Rooftop Access` 방식, ④ 출입구 수·방향, ⑤ `Verification Record`(확인 근거, `Verified Game Patch`, 검증일)를 수집한다. 아직 확인하지 못한 속성은 반드시 `Unverified State`로 남겨둔다.
- **`Fixed Vehicle Spawn Point` 실측 수집**: 해당 `Target Zone` 및 인접 도로의 고정 차량 출현 지점(차고 및 지정 고정 스팟)을 인게임/공식 패치노트 기반으로 확인하여 좌표·`gameMode`·`spawnType`·`vehicleTypes`·`Verification Record`를 기록한다.

## Acceptance criteria

- [ ] `Palace`와 `Terminal` 중 31.2 지도 이미지와 현재 라이브 게임의 지붕 배치가 정확히 일치하는 1개 `Target Zone`이 확정되고 대조 근거(스크린샷 및 확인 패치 버전)가 이슈 코멘트/자료로 기록된다.
- [ ] `Pilot Slice` 인접 건물 3개를 포함한 대상 건물 약 20개의 확인된 속성(직접 촬영 외관 이미지, 층수, `Rooftop Access`, 출입구)과 `Verification Record`가 수집되며, 미확인 항목은 `'접근 불가'`/`'없음'`이 아닌 `unverified`로 분리 표기된다.
- [ ] `Target Zone` 및 인접 도로에서 실제 확인된 `Fixed Vehicle Spawn Point` 위치만 `gameMode`, `spawnType`, `vehicleTypes`, `Verified Game Patch`, `verificationSource`와 함께 정리된다(임의 추정 위치 및 미검증 확률 제외).

## Blocked by

None (can start immediately; runs in parallel with #2~#6 and #8)
