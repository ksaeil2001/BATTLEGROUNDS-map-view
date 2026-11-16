# Issue #8 사전 조사: 태이고 지도 및 인게임 이미지 공개 배포 사용 권한 검토

- **관련 이슈**: [ksaeil2001/BATTLEGROUNDS-map-view#8](https://github.com/ksaeil2001/BATTLEGROUNDS-map-view/issues/8)
- **조사 일자(확인일)**: `2026-11-16`
- **조사 방법**: 1차 공식 출처(`pubg/api-assets` 저장소 `README.md`·커밋 메타데이터, PUBG Developer Portal `Terms of Use`, KRAFTON/PUBG 공식 `Content Creation Guideline`) 원문 대조 (`research` 스킬 적용)
- **최종 게이트 결론**: **공식 태이고 지도 PNG 및 가공본(WebP/타일)의 정적 팬 웹사이트 공개 호스팅은 약관상 `불명확(Ambiguous)` 영역이 해소되지 않았으므로, 사용 권한이 확보됐다고 판단하지 않는다.** 따라서 현행 `src/data/map-config.json`의 `assetMode: "sample"` 및 `rightsClearedForPublicDeploy: true`(자체 제작 샘플 자산 전용) / 공식 자산 배포 차단 원칙(`ADR-0001` 권리 게이트)을 유지한다.

---

## 1. 조사 대상 1차 출처 목록 및 원문 근거

| 출처명 | 공식 URL | 시행일 / 최종 확인 커밋 | 확인일 |
| :--- | :--- | :--- | :--- |
| **`pubg/api-assets` README & `Assets/Maps`** | https://github.com/pubg/api-assets<br>https://github.com/pubg/api-assets/blob/master/Assets/Maps/Taego_Main_High_Res.png | 커밋 `32b13b5` (`31.2 Map image update (#269)`, `2024-10-28`) | `2026-11-16` |
| **PUBG Developer Portal 이용약관 (`Terms of Use`)** | https://developer.pubg.com/tos<br>(참고: https://developer.pubg.com/docs/terms-of-use) | 현행 게시 약관 | `2026-11-16` |
| **PUBG / KRAFTON 공식 콘텐츠 제작 가이드라인 (`Content Creation Guideline`)** | 영문: https://pubg.com/en/content-creation-guideline (구 `player-created-content`)<br>국문 조항: https://pubg.com/ko/clause/content_creation_guideline<br>고객지원: https://support.pubg.com/ | 시행일 `2024-02-16` (`Effective date: 16th of Feb, 2024`) | `2026-11-16` |

### 1.1 `pubg/api-assets` 공식 저장소 (`README.md`) 원문 및 해석

- **원문 인용 (`README.md` 서두)**:
  > *"Art assets and data dictionaries for use with the PUBG API."*
  > *"Everything provided in this repository must be used according to the Terms of Use and Player-created Content."*
- **파일 현황 (`Assets/Maps` 직접 조회 결과)**:
  - `Taego_Main_High_Res.png` / `Taego_Main_No_Text_High_Res.png` (Git LFS 추적 고해상도 `8192 × 8192` 원본, ~101MB)
  - `Taego_Main_Low_Res.png` (`1,368,588` bytes) / `Taego_Main_No_Text_Low_Res.png` (`1,361,111` bytes)
  - 업데이트 이력: `31.2 Map image update (#269)` (`2024-10-28T07:36:51Z`, SHA `32b13b5`)
- **핵심 해석**:
  - 저장소에 별도의 오픈소스 라이선스(`LICENSE` - MIT/BSD/CC-BY 등)가 부여되어 있지 않다.
  - 저장소의 모든 에셋은 **"use with the PUBG API"** 맥락 아래 놓여 있으며, **Developer Portal `Terms of Use`** 와 **`Player-created Content`(현 `Content Creation Guideline`)** 두 규칙을 **모두** 충족해야 한다.

### 1.2 PUBG Developer Portal 이용약관 (`Terms of Use`) 주요 조항 및 원문

- **해당 조항 1 — `Grant of Rights for Applications`**:
  > *"You are granted a limited, non-exclusive, non-sublicensable, non-transferable, revocable, fully paid-up, worldwide right to use the website to access Data through the API for the purpose of developing software (an application) that will benefit the company's players' gaming experiences."*
- **해당 조항 2 — `Intellectual Property Rights`**:
  > *"The Website and its entire contents, features and functionality (including but not limited to all information, software, text, displays, images, video and audio, and the design, selection and arrangement thereof), are owned by the Company, its licensors or other providers of such material and are protected by United States and international copyright, trademark, patent, trade secret and other intellectual property or proprietary rights laws."*
  >
  > *"If you print, copy, modify, download or otherwise use or provide any other person with access to any part of the Website in breach of the Terms of Use, your right to use the Website and access the Data will cease immediately and you must, at our option, return or destroy any copies of the Data and any copies of our materials. No right, title or interest in or to the Website or the Data is granted to you other than as set forth herein. All rights not expressly granted are reserved by the Company."*
- **해당 조항 3 — `Prohibited Uses` 및 브랜드 제한**:
  - 약관에 명시되지 않은 모든 권리는 KRAFTON이 유보(`All rights not expressly granted are reserved by the Company`).
  - 데이터·자산을 고의적으로 부정확하거나 오해를 유발하거나 회사 명예를 훼손하는 방식으로 표시 금지.
  - 저작권·상표권 고지(`copyright, trademark, or other proprietary rights notices`) 삭제·변조 금지.
  - 공식 PUBG Developer API를 사칭하거나 경쟁 API 서비스 구축 금지.

### 1.3 KRAFTON 공식 콘텐츠 제작 가이드라인 (`Content Creation Guideline`) 주요 조항 및 원문

- **해당 조항 1 — `1. THE BASICS` (`How we define "Content"` / `IP` / `Creator License`)**:
  > *"How we define 'Content': It's simple: If the content you create uses Game IP (see below 'The definition of IP'), we consider this to be Game Content. This can range from fan-made art, sites, videos and streams, to anything else your creativity inspires you to make."*
  >
  > *"How we define IP (Intellectual Property): Company and the Game IP includes but is not limited to its lore, characters, images, music, and videos."*
  >
  > *"By creating content using Company IP, you agree to exempt Company from any legal conflict or related financial liability unless there is deliberate or gross negligence on our end."*
- **해당 조항 2 — `2. BEST PRACTICES WHEN CREATING CONTENT WITH GAME IP`**:
  > *"We like creativity! We're not fans of content which simply re-posts content we have already released. If you love our new trailer, add your own spin to it! And that goes for anything you create!"*
  >
  > *"Leaking upcoming Game information that is not authorized or not officially released is not ok, so please refrain from uploading anything that could be considered as such!"*
- **해당 조항 3 — `3. EARNING PROFIT BY USING COMPANY IP` (수익 창출 조건)**:
  > *"Passive revenue generated on the following platforms is allowed: Advertising revenue generated from a personal website using an ad platform such as Google AdSense; Advertising revenue generated from non-monetized videos uploaded on video sharing platforms such as YouTube, Facebook, etc.; Revenue generated from fan or viewer donations..."*
  - 금지되는 수익 창출:
    > *"The content containing Game IP is used in any way to promote or advertise non-Company game titles (including sponsored advertising); Content containing Game IP can be interpreted as being made for the sole purpose of seeking profit..."*
  - 유료 구독자 전용 페이월(Paywall) 잠금, 직접 유료 판매, 무단 상업적 머천다이징(굿즈 판매) 불허.
- **브랜드·공식 사칭 금지 원칙**:
  - 공식 KRAFTON/PUBG 웹사이트나 공식 채널로 오인·혼동될 수 있는 로고 사용, 도메인·서비스명 사칭 또는 공식 보증(`endorsed`/`affiliated`) 암시 금지.

---

## 2. 행위별 사용 권한 판정 요약표 (확인일: `2026-11-16`)

판정 기준: **허용** / **조건부 허용** / **불명확** / **불허**

| 구분 항목 | 판정 | 근거 조항 및 핵심 이유 | 공개 배포 전 필요 조치 |
| :--- | :---: | :--- | :--- |
| **1. 공식 태이고 지도 PNG(`pubg/api-assets` `Taego_Main_High_Res.png`)를 정적 팬 웹사이트에 사용하는 행위** | **불명확** | `Content Creation Guideline` Section 1은 `fan-made sites`를 게임 콘텐츠로 포용하지만, `pubg/api-assets` README가 **"use with the PUBG API"** 및 `Developer Portal Terms of Use`를 동시 적용 대상으로 명시하고 있음. `Terms of Use`의 `Grant of Rights for Applications`는 권리 부여 목적을 **"to access Data through the API for the purpose of developing software"**로 한정하고 `All rights not expressly granted are reserved`를 선언하므로, **PUBG Developer API 연동 없이 정적 JSON 데이터만 서빙하는 팬 사이트에 `api-assets` 지도 파일을 직접 호스팅하는 것이 약관 범위 내인지 문언상 단정 불가**. | PUBG 고객지원(`https://support.pubg.com/`) 또는 Developer Support에 *"API 키/실시간 API 호출 없이 `pubg/api-assets` 태이고 지도를 정적 팬 정보 지도 배경으로 공개 호스팅할 수 있는지"* 공식 서면 질의 |
| **2. 원본 PNG를 WebP 또는 고해상도 크롭/타일로 변환해 공개 호스팅하는 행위** | **불명확** | `Developer Portal Terms of Use` `Intellectual Property Rights` 조항은 약관 위반 범위의 **`copy, modify, download ... or provide any other person with access`** 시 권리 즉시 종료 및 파기를 규정함. 101MB 원본 PNG를 경량 WebP로 재인코딩하고 `Target Zone` 크롭/타일 이미지로 변형(`modify`)하여 웹 CDN/정적 파일로 불특정 다수에게 제공(`provide access`)하는 행위가 `Content Creation Guideline` Section 2의 창작 가공으로 허용되는지, 아니면 API 약관상 제한되는 원본 변형·재배포에 해당하는지 1차 문서만으로 명확히 확정 불가. | 위 1항 질의 시 **WebP 경량 변환 및 구역 크롭/타일 분할 호스팅 포함 여부**를 함께 명시하여 답변 확보 (확보 전까지 `public/maps/`에 공식 이미지 배치 금지) |
| **3. 게임에서 직접 촬영한 건물 외관 이미지(스크린샷)를 게시하는 행위** | **조건부 허용** | `Content Creation Guideline` Section 1·2에 따라, 정식 라이브/사용자 지정 매치·리플레이에서 플레이어가 직접 촬영한 인게임 스크린샷을 정보·가이드성 `fan-made sites`의 일부(`Building Card` 외관 참고 사진)로 게시하는 행위는 창작 활동 범주에 포함됨. 단, 아래 5가지 조건을 모두 충족해야 함. | ① 미출시/유출 정보 제외 ② 단순 이미지 나열이 아닌 검증된 건물 구조 분석·지도 UI와의 결합 ③ 비공식 팬 사이트 및 KRAFTON 저작권 고지 명시 ④ 유료 판매·페이월 금지 ⑤ 타 플레이어 닉네임 등 개인정보/HUD 제거 |
| **4. 비영리 운영 vs. 광고 수익화(Google AdSense 등) 여부에 따른 이용 조건** | **조건부 허용**<br>(일부 행위 **불허**) | • **비영리 팬 사이트 운영**: **조건부 허용** (`Content Creation Guideline` Section 1·2·3 준수 시)<br>• **개인 팬 웹사이트 내 광고(Google AdSense 등) 및 자발적 후원**: **조건부 허용** (`Section 3`에서 *"Advertising revenue generated from a personal website using an ad platform such as Google AdSense"* 및 *"fan or viewer donations"* 명시 허용)<br>• **페이월/유료 구독 잠금, 콘텐츠 직접 판매, 타사 게임 홍보 스폰서 광고, 영리 추구 단일 목적 사이트, 무단 굿즈 판매**: **불허** (`Section 3` 명시 금지) | 현행 프로젝트는 `GLOSSARY.md` 기준 **비영리 팬 프로젝트**로 운영하고, 향후 AdSense 도입 시에도 무료 전체 공개 원칙 및 타사 게임 광고 배제 규칙 유지 |

---

## 3. 비공식 팬 사이트 필수 고지 문구 및 금지 사항 체크리스트

향후 공식 이미지 또는 인게임 촬영 건물 외관 스크린샷을 포함해 사이트를 공개할 때 반드시 화면 하단/소개 영역에 포함해야 할 고지 원칙:

1. **필수 고지 문구 (국문/영문 병기 권장)**:
   - `"본 사이트는 KRAFTON, Inc. 및 PUBG Studios와 제휴하거나 공식 승인(endorsed)을 받지 않은 비공식 팬 제작 지도 프로젝트입니다."`
   - `"PUBG: BATTLEGROUNDS and all related in-game images and assets are trademarks and copyrights of KRAFTON, Inc. All rights reserved. Unofficial fan project — not affiliated with or endorsed by KRAFTON, Inc."`
2. **절대 금지 사항**:
   - 공식 PUBG/KRAFTON 로고를 사이트 대표 로고로 사용하여 공식 서비스로 오인하게 만드는 디자인
   - 미출시/테스트 서버 유출(`Leaks`) 정보, 미공개 건물·차량 데이터 게시
   - 사용자 유료 결제/구독 잠금 뒤에서만 건물 카드 또는 지도 열람을 허용하는 구조
   - 고의적 오정보 게시 또는 KRAFTON/PUBG 명예를 훼손하는 표현

---

## 4. 코드·배포 게이트 적용 원칙 (Issue #8 미결 시)

- `src/data/map-config.json`의 공식 지도 전환(`assetMode: "official"`)과 `public/` 경로로의 `Taego_Main_High_Res.png` / 변환 WebP 커밋·배포는 **KRAFTON 고객지원(`https://support.pubg.com/`)에서 정적 팬 사이트 호스팅 및 WebP/크롭 변환 허용 답변을 확보할 때까지 보류**한다.
- 만약 공식 지도 재배포가 불허되거나 답변이 지연되는 경우, 두 가지 합법적 대안을 검토한다:
  1. **PUBG Developer API 연계 앱 전환 검토**: 실제 매치 조회 등 Developer Portal `Terms of Use` 목적("software ... to access Data through the API")에 부합하는 최소 API 연동 기능을 추가할지 여부 평가(단, 현 MVP 명세상 `Out of Scope`이므로 재설계 필요).
  2. **독자 벡터/일러스트 지도 기반 공개**: 건물 `Roof Footprint`와 지형 개략도를 자체 제작 벡터/일러스트 지도(`assetMode: "sample"` 확장판)로 그려 공개 배포하고, 공식 `31.2` PNG는 로컬 개발·좌표 검수용으로만 사용.

---

## 5. KRAFTON 고객지원(`support.pubg.com`) 문의용 질의 초안 (사용자 제출용)

> **문의 제목**: `[IP/API 에셋 사용 문의] 비공식 태이고 건물·고정 차량 팬 웹 지도에서 pubg/api-assets 지도 PNG 정적 호스팅 및 WebP 변환 허용 여부`
>
> **질의 핵심 3가지**:
> 1. 공식 GitHub 저장소(`github.com/pubg/api-assets`)에 제공되는 `Assets/Maps/Taego_Main_High_Res.png` 이미지를, **PUBG Developer API를 실시간 호출하지 않는 무료·비공식 팬 정보 웹사이트**의 배경 지도로 사용할 수 있습니까?
> 2. 101MB 원본 PNG를 웹 로딩 최적화를 위해 **WebP 포맷 변환 및 구역 크롭/정적 타일 형태로 가공하여 팬 사이트 정적 호스팅(CDN/웹서버)으로 제공**하는 것이 콘텐츠 제작 가이드라인 및 API 이용약관상 허용됩니까?
> 3. 인게임 리플레이/사용자 지정 매치에서 플레이어가 직접 촬영한 태이고 건물 외관 스크린샷을, 무료 팬 웹 지도의 건물 상세 정보 카드(비공식 안내 및 KRAFTON 저작권 고지 포함)에 게시하는 것이 허용됩니까?
