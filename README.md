# 사회 실험형 마을 시뮬레이터 — 2차 구현

100명의 주민이 자신의 욕구와 마을 작업 수요를 관찰하고, Utility AI로 목표를 선택해 실제 지도 위를 이동하며 농사·운반·식사·휴식·주택 건설을 수행하는 브라우저 시뮬레이터입니다.

외부 LLM API 없이 모든 행동이 규칙과 수치로 결정됩니다. 동일한 설정과 시드에서는 NPC별 목표, 이동 경로와 최종 결과가 재현됩니다.

## 실행

```bash
npm install
npm run dev
```

```bash
npm run build          # TypeScript 검사 + 프로덕션 빌드
npm test               # 단위/통합 테스트
npm run simulate:100   # 렌더링 없는 100일 실행 및 JSON 보고서
```

## 2차 구현 기능

- 10분 단위 144틱/일 시간 시스템
- `stepTick`, `stepDay`, `runTicks`, `runDays` API
- 마을 작업 수요를 생성하는 `TaskBoardSystem`
- 개인 상태·가까운 건물·작업 수요를 읽는 `AgentPerceptionSystem`
- 행동 후보별 점수와 이유를 기록하는 Utility AI
- 작업 정원 기반 중복 배정 방지
- 균일 비용 그리드 최단 경로 및 목적지별 경로 필드 캐시
- NPC 이동·수행·완료·실패 상태 머신
- 농장 작업 후 농장 인벤토리에 식량 생산
- 농장 식량을 수령해 창고까지 운반
- 창고로 이동해 식사하고 배고픔 감소
- 주택 예정지 생성, 건설 작업, 진행률과 완공
- 귀가 및 휴식
- NPC별 Phaser 게임 오브젝트와 위치 보간
- 행동 아이콘, 작업 진행 표시, 선택 경로와 목적지 표시
- NPC 클릭 패널: 목표·상태·욕구·행동 선택 이유
- 행동 종류별 실시간 주민 수 집계
- 1/5/20/100배속 결과 불변성

## 구조

```text
src/
├─ simulation/                       # React/Phaser에 의존하지 않는 계산 계층
│  ├─ core/
│  │  ├─ SimulationEngine.ts
│  │  ├─ SimulationClock.ts
│  │  ├─ TickPipeline.ts
│  │  └─ SystemPipeline.ts
│  ├─ agents/
│  │  ├─ AgentPerceptionSystem.ts
│  │  ├─ AgentDecisionSystem.ts
│  │  ├─ AgentMovementSystem.ts
│  │  ├─ AgentExecutionSystem.ts
│  │  └─ AgentNeedsSystem.ts
│  ├─ tasks/TaskBoardSystem.ts
│  ├─ pathfinding/GridPathfinder.ts
│  ├─ map/GridMap.ts
│  ├─ strategy/VillageStrategyProvider.ts
│  ├─ city/
│  ├─ economy/
│  ├─ population/
│  ├─ statistics/
│  └─ types.ts
├─ game/
│  ├─ entities/CitizenSprite.ts
│  ├─ scenes/VillageScene.ts
│  └─ VillageCanvas.tsx
└─ App.tsx
```

렌더링 계층은 엔진의 깊은 복사 스냅샷만 소비합니다. 헤드리스 실행은 DOM, React, Phaser 없이 동일한 `SimulationEngine`을 사용합니다.

## NPC 판단 방식

NPC는 다음 조건에서만 목표를 다시 판단합니다.

- 목표 완료 또는 실패
- 작업이나 목적지가 사라짐
- 심각한 배고픔 발생
- 판단 쿨다운 종료

각 후보는 배고픔, 직업, 마을 식량 부족, 주택 부족, 작업 우선도, 피로, 거리와 협력 성향을 조합해 점수를 계산합니다. 최종 선택의 모든 가감 요인은 `decisionReasons`에 저장됩니다. 동점은 `SeededRandom`으로 해소합니다.

## 이동과 작업

지도는 20px 그리드입니다. 건물 면적은 통과할 수 없고 모든 건물은 접근 가능한 입구 좌표를 갖습니다. 경로 탐색기는 목적지에서 역방향 최단 경로 필드를 생성하여 같은 건물을 향하는 100명의 NPC가 공유합니다.

생산된 식량은 즉시 마을 재고에 더해지지 않습니다.

```text
농장 작업 → 농장 인벤토리 → 운반자가 수령 → 창고 도착 → 창고 재고
```

## 주요 설정

모든 시간·행동·밸런스 수치는 `src/simulation/core/SimulationConfig.ts`에서 조정합니다.

```ts
const engine = new SimulationEngine({
  seed: "experiment-a",
  initialPopulation: 100,
  ticksPerDay: 144,
  millisecondsPerTick: 120,
  decisionCooldownTicks: 8,
});
```

## 테스트 범위

- 시드 난수와 전체 목표·경로 재현성
- 144틱 일자와 기존 일 단위 API 호환
- 배고픈 NPC의 식사 선택
- 식량 부족 시 농부의 농사 선택
- 운반 작업 생성과 작업 정원
- 사라진 목표 재판단
- 목적지 이동과 도착 상태 전환
- 건물 장애물 우회와 도달 불가 처리
- 경로 캐시
- 농사·운반·식사·건설 실행
- 중단 행동의 자원 중복 생성 방지
- 주택 수요에서 실제 완공까지
- 1배속/100배속 결과 일치
- NPC 100명 헤드리스 100일 실행

## 이번 단계 제외 및 다음 체크리스트

- [ ] 나무·돌·돈 자원과 건설 비용
- [ ] 벌목장·채석장·시장·병원
- [ ] 가격·시장·세금·재산 분배
- [ ] 이민·이탈 정책과 직업 전체 목록
- [ ] 범죄·공공서비스·사건 타임라인
- [ ] Web Worker 기반 백그라운드 계산
- [ ] IndexedDB 저장·불러오기와 내보내기
- [ ] 다수 NPC 간 국소 충돌 회피
- [ ] 9:16 촬영 모드와 비교 실험
- [ ] 외부 LLM 전략 제공자 구현
