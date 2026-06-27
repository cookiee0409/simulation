# Visual System Guide

이 문서는 `src/game` 렌더링 계층의 교체 가능한 시각 시스템 규격이다. `src/simulation`의 결정론적 상태와 밸런스는 렌더링과 분리하며, 화면은 `SimulationSnapshot`을 읽어 표현만 갱신한다.

## 색상 팔레트

- 지면: `#9fbf84`, `#8eb073`, `#b2c893`, `#7fa267`
- 흙/작업 흔적: `#8b6743`
- 길: `#c7b184`, 가장자리 `#9d865e`
- 외곽선: `#27331f`
- 선택 강조: `#f9f5c7`
- 게임 내 텍스트 배경: `rgba(21, 32, 24, 0.68~0.82)`

실제 값은 [RenderConfig.ts](../src/game/rendering/RenderConfig.ts)에서 관리한다.

## 권장 에셋 크기

- terrain tile: `64x64`
- house: `128x128`
- farm: `160x112`
- large facility: `144~160px`
- citizen frame: `32x48`
- status icon: `24x24`
- speech bubble corner radius: `16px` 이상

현재 임시 SVG 에셋은 [public/assets/visual](../public/assets/visual)에 있으며, 경로는 [AssetManifest.ts](../src/game/assets/AssetManifest.ts)에서 관리한다.

## 레이어 순서

1. 지면
2. 도로와 밭
3. 바닥 장식물
4. 건물 그림자
5. 건물
6. NPC 그림자
7. NPC
8. 효과
9. 상태 아이콘
10. 말풍선과 선택 UI

건물과 NPC는 `y` 좌표 기반 depth를 사용해 위/아래 관계가 자연스럽게 보이도록 한다.

## 줌 단계와 LOD

- far: 건물 상세 라벨과 작은 장식을 줄이고 전체 형태 위주 표시
- default: 건물 이름, NPC 작업 상태 최소 표시
- near: 상세 라벨, 작업 진행률, 디테일 장식 표시

줌 기준은 `RENDER_CONFIG.zoom`에서 관리한다. 마우스 휠 줌 범위는 `0.7~2.5`다.

## 글씨 크기

- 일반 게임 UI: 14px 이상
- 보조 정보: 12px 이상
- 중요 수치/HUD: 14~16px
- 게임 오브젝트 라벨: 14px, `resolution: 2`, 어두운 반투명 배경

폰트 스택은 `Pretendard, "Noto Sans KR", Inter, "Malgun Gothic", system-ui, sans-serif`를 사용한다.

## 새 건물 추가 방법

1. `public/assets/visual/{building}.svg`를 추가한다.
2. [AssetManifest.ts](../src/game/assets/AssetManifest.ts)에 경로를 등록한다.
3. [RenderConfig.ts](../src/game/rendering/RenderConfig.ts)의 `building.sizes`에 권장 표시 크기를 추가한다.
4. [BuildingSprite.ts](../src/game/entities/BuildingSprite.ts)에 라벨과 디테일 렌더링 함수를 추가한다.

SVG에는 최소한 그림자, 외곽선, 재질 패턴, 문/창문 또는 기능을 보여주는 소품을 포함한다.

## 새 NPC 직업 외형 추가 방법

1. [CitizenSprite.ts](../src/game/entities/CitizenSprite.ts)의 `JOB_LABELS`에 직업명을 추가한다.
2. `jobColor`, `drawTool`, `hairOrHatColor`에 직업별 색상과 도구를 추가한다.
3. 애니메이션은 기존 idle/walk/work/carry 표현을 공유하고, 필요한 경우 도구 그래픽만 확장한다.

NPC 외형은 `citizen.id` 기반 해시로 결정되어 같은 seed와 같은 citizen id에서 동일하게 보인다.

## 성능 규칙

- 지형은 seed/map/snow 변화가 있을 때만 다시 그린다.
- 건물은 `BuildingSprite` 단위로 보존하고 상태만 갱신한다.
- NPC는 기존 오브젝트를 재사용하고 위치 보간만 수행한다.
- 효과 이벤트는 id 기반으로 한 번만 재생한다.
- 말풍선과 파티클은 개수를 제한하고 짧은 수명만 가진다.
- 줌 아웃 시 텍스트와 작은 디테일을 숨긴다.

## 시뮬레이션 분리 원칙

렌더링 파일은 `SimulationSnapshot`을 읽을 수 있지만 `src/simulation` 상태를 직접 변경하지 않는다. 시각 보정, 애니메이션, 툴팁, 카메라 이동은 모두 렌더링 전용이어야 한다.

