# 사회 실험형 마을 시뮬레이터 — 1차 구현

100명의 주민이 식량을 생산하고 소비하는 과정을 재현 가능한 규칙으로 계산하고, Phaser로 최소 마을 화면을 보여 주는 브라우저 기반 시뮬레이터입니다.

이번 저장소는 요청서의 **28. 첫 작업 요청**까지만 구현합니다. 시장, 세금, 이민, 범죄, 저장, 촬영 모드 등은 아직 구현하지 않았습니다.

## 실행 방법

```bash
npm install
npm run dev
```

Vite가 출력한 로컬 주소를 브라우저에서 열면 됩니다.

```bash
npm run build          # TypeScript 검사 + 프로덕션 빌드
npm test               # 단위/통합 테스트
npm run simulate:100   # 렌더링 없는 100일 실행 및 JSON 보고서
```

## 이번에 구현한 기능

- React + TypeScript + Vite + Phaser 초기화
- React/Phaser와 의존성이 없는 순수 TypeScript 시뮬레이션 엔진
- 문자열 시드를 지원하는 `SeededRandom`
- 일시정지, 1/5/20/100배속, 하루 진행을 지원하는 `SimulationClock`
- 시드 기반 NPC 100명 생성
- 농부의 식량 생산, 전 주민의 식량 소비, 창고 용량 제한
- 식량 부족에 따른 배고픔·건강·행복도 저하 및 주민 이탈
- 식량 수요에 따른 농장 자동 증설과 무직자의 농부 전환
- 농장·주택·창고 데이터 구조
- 주택 부족에 따른 주택 건설 수요 계산
- 하루 단위 통계 스냅샷
- Phaser 기반 최소 마을 화면과 시간 조작 UI
- 그래픽 없는 100일 실행, 동일 시드 재현성 검증

## 구조

```text
src/
├─ simulation/                 # React/Phaser를 import하지 않는 계산 계층
│  ├─ core/                    # 엔진, 시계, 시드 난수, 설정
│  ├─ population/              # NPC 생성, 농업 인력 전환
│  ├─ economy/                 # 식량 생산·소비
│  ├─ city/                    # 건물 생성, 건물 수요
│  ├─ statistics/              # 하루 통계
│  └─ types.ts
├─ game/                       # Phaser 렌더링 계층
│  ├─ scenes/VillageScene.ts
│  └─ VillageCanvas.tsx
├─ App.tsx                     # React UI와 엔진 실행 조정
└─ main.tsx
scripts/
└─ run-headless.ts             # 100일 헤드리스 실행
```

렌더링 계층은 엔진의 읽기 전용 스냅샷만 전달받습니다. 헤드리스 스크립트와 테스트는 DOM, React, Phaser 없이 `SimulationEngine`만 실행합니다.

## 주요 밸런스 설정

모든 1차 경제 수치는 `src/simulation/core/SimulationConfig.ts`에 있습니다. `SimulationEngine` 생성 시 일부 값을 덮어쓸 수 있습니다.

```ts
const engine = new SimulationEngine({
  seed: "experiment-a",
  initialPopulation: 100,
  initialFood: 250,
  foodPerFarmerPerDay: 5.3,
  initialHouses: 9,
});
```

기본 마을은 12명의 농부와 농장 1개로 시작합니다. 초기 생산력이 수요보다 낮기 때문에 첫날 이후 농장이 증설되고 농업 노동자가 늘어납니다. 주택은 90명분만 있어 주택 1채의 건설 수요가 계산되지만, 주택 자동 건설은 다음 단계 범위로 남겨 두었습니다.

## 테스트 범위

- 시드 난수 재현성
- 렌더 시간과 시뮬레이션 시간 분리
- NPC 100명 및 세 건물 유형 생성
- 식량 생산·소비와 일일 통계
- 식량 수요에 따른 농장·농부 증가
- 주택 부족에 따른 건설 수요
- 식량 0 조건에서 행복도·인구 감소
- 동일 시드 100일 결과 일치
- 헤드리스 100일 동안 음수, `NaN`, 무한대 방지

## 다음 단계 체크리스트

아래 항목은 이번 1차 결과물에 구현하지 않았습니다.

- [ ] 주택 자동 건설과 건설 단계 시각화
- [ ] 나무·돌·돈 자원 및 벌목장·시장·병원
- [ ] 식량 가격, 시장, 세금, 재산 분배
- [ ] 직업 전체 목록과 임금 기반 직업 이동
- [ ] 이민·이탈 정책과 주택 연계
- [ ] 행복도 확장, 빈부격차, 범죄율
- [ ] 중요 사건 감지·원인 기록·타임라인
- [ ] Web Worker 기반 백그라운드 계산
- [ ] IndexedDB 저장·불러오기와 JSON/CSV 내보내기
- [ ] 실제 타일맵, 경로 이동, 자동 성장 애니메이션
- [ ] 9:16 촬영 모드, 자동 카메라, 결과 카드
- [ ] 비교 실험 모드
- [ ] 1,000일 및 동일 설정 100회 장시간 검증
