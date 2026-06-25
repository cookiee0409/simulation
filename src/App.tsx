import { useEffect, useRef, useState } from "react";
import { VillageCanvas } from "./game/VillageCanvas";
import {
  SIMULATION_SPEEDS,
  SimulationEngine,
  type Citizen,
  type SimulationSnapshot,
  type SimulationSpeed,
} from "./simulation";
import "./styles.css";

const DEFAULT_SEED = "village-001";

const GOAL_LABELS: Record<Citizen["goal"], string> = {
  eat: "식사",
  forage: "채집",
  work_farm: "농사",
  gather_wood: "벌목",
  gather_stone: "채석",
  carry_food: "식량 운반",
  rest: "휴식",
  return_home: "귀가",
  seek_work: "일자리 탐색",
  build: "주택 건설",
  wander: "주변 살피기",
};

const JOB_LABELS: Record<Citizen["job"], string> = {
  settler: "정착민",
  farmer: "농부",
  lumberjack: "벌목공",
  miner: "채석공",
  unemployed: "무직",
};

const STAGE_LABELS: Record<SimulationSnapshot["stage"], string> = {
  camp: "야영지",
  hamlet: "정착촌",
  village: "마을",
  growing_village: "성장 마을",
  town: "소도시",
};

const NEED_LABELS: Record<string, string> = {
  food: "식량",
  shelter: "주거",
  wood: "목재",
  stone: "석재",
  tools: "도구",
  storage: "저장",
  trade: "교역",
  healthcare: "의료",
  security: "치안",
  education: "교육",
  transport: "운송",
};

const PROFESSION_LABELS: Record<string, string> = {
  farmer: "농부",
  lumberjack: "벌목꾼",
  miner: "채석공",
};

export default function App() {
  const engineRef = useRef(new SimulationEngine({ seed: DEFAULT_SEED }));
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() =>
    engineRef.current.getSnapshot(),
  );
  const [selectedCitizenId, setSelectedCitizenId] = useState<string>();

  useEffect(() => {
    let frameId = 0;
    let previousTime = performance.now();
    const frame = (currentTime: number) => {
      const elapsed = Math.min(250, currentTime - previousTime);
      previousTime = currentTime;
      const completedTicks = engineRef.current.advanceRealTime(elapsed);
      if (completedTicks > 0) {
        setSnapshot(engineRef.current.getSnapshot());
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const refresh = () => setSnapshot(engineRef.current.getSnapshot());
  const togglePaused = () => {
    engineRef.current.setPaused(!snapshot.paused);
    refresh();
  };
  const setSpeed = (speed: SimulationSpeed) => {
    engineRef.current.setSpeed(speed);
    refresh();
  };
  const stepOneTick = () => {
    engineRef.current.stepTick();
    refresh();
  };
  const stepOneDay = () => {
    engineRef.current.stepDay();
    refresh();
  };
  const resetSimulation = () => {
    engineRef.current = new SimulationEngine({ seed: DEFAULT_SEED });
    setSelectedCitizenId(undefined);
    refresh();
  };

  const stats = snapshot.latestStatistics;
  const selectedCitizen = snapshot.citizens.find(
    (citizen) => citizen.id === selectedCitizenId,
  );
  const recentStatistics = snapshot.recentStatistics.slice(-5).reverse();

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">GROWING VILLAGE · SEED {snapshot.seed}</p>
          <h1>자라나는 작은 마을</h1>
          <p className="subtitle">
            열 명에서 시작해 농사·채집·출산으로 인구가 늘고 마을이 커집니다.
          </p>
        </div>
        <div className="day-card">
          <span>현재 단계 · DAY {snapshot.day}</span>
          <strong>{STAGE_LABELS[snapshot.stage]}</strong>
          <small>인구 {stats.population}명 · {formatClock(snapshot.minuteOfDay)}</small>
        </div>
      </header>

      <section className="dashboard">
        <div className="village-panel">
          <VillageCanvas
            snapshot={snapshot}
            selectedCitizenId={selectedCitizenId}
            onCitizenSelect={setSelectedCitizenId}
          />
          <div className="legend" aria-label="지도 범례">
            <span>🌾 농사</span>
            <span>🍞 식사</span>
            <span>📦 운반</span>
            <span>🔨 건설</span>
            <span>💤 휴식</span>
            <span>흰 점: 건물 입구</span>
          </div>
        </div>

        <aside className="stats-panel">
          <div className="stats-heading">
            <div>
              <p className="eyebrow">LIVE AGENT STATE</p>
              <h2>마을 관찰판</h2>
            </div>
            <span className={snapshot.paused ? "status paused" : "status"}>
              {snapshot.paused ? "일시정지" : `${snapshot.speed}배속 실행 중`}
            </span>
          </div>

          <div className="metric-grid">
            <Metric label="인구" value={`${stats.population}명`} />
            <Metric label="정착민" value={`${stats.settlerCount}명`} />
            <Metric label="아이" value={`${stats.childrenCount}명`} />
            <Metric label="직업 종류" value={`${stats.professionCount}종`} />
            <Metric label="건물 종류" value={`${stats.buildingTypeCount}종`} />
            <Metric label="완공 주택" value={`${stats.houseCount}채`} />
            <Metric
              label="최대 미충족 수요"
              value={topNeedLabel(snapshot)}
              warning={stats.topNeedUrgency >= 50}
            />
            <Metric label="창고 식량" value={format(stats.foodStock)} />
          </div>

          <ProfessionBoard snapshot={snapshot} />
          <ActivityBoard snapshot={snapshot} />

          {selectedCitizen ? (
            <CitizenPanel citizen={selectedCitizen} />
          ) : (
            <div className="citizen-panel empty-selection">
              지도에서 주민을 클릭하면 목표, 경로와 판단 이유를 볼 수 있습니다.
            </div>
          )}

          <div className="history">
            <h3>최근 일일 기록</h3>
            {recentStatistics.length === 0 ? (
              <p className="empty">첫날이 끝나면 통계가 기록됩니다.</p>
            ) : (
              <div className="history-list">
                {recentStatistics.map((entry) => (
                  <div className="history-row" key={entry.day}>
                    <b>D{entry.day}</b>
                    <span>인구 {entry.population}</span>
                    <span>출생 +{entry.births}</span>
                    <span>사망 -{entry.deaths}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="controls" aria-label="시뮬레이션 시간 조작">
        <button className="primary" type="button" onClick={togglePaused}>
          {snapshot.paused ? "▶ 시작" : "Ⅱ 일시정지"}
        </button>
        <div className="speed-controls">
          {SIMULATION_SPEEDS.map((speed) => (
            <button
              className={snapshot.speed === speed ? "active" : ""}
              type="button"
              key={speed}
              onClick={() => setSpeed(speed)}
            >
              {speed}×
            </button>
          ))}
        </div>
        <button type="button" onClick={stepOneTick}>+ 10분</button>
        <button type="button" onClick={stepOneDay}>+ 하루</button>
        <button type="button" onClick={resetSimulation}>같은 시드로 초기화</button>
      </section>
    </main>
  );
}

function topNeedLabel(snapshot: SimulationSnapshot): string {
  const top = [...snapshot.needs].sort((a, b) => b.urgency - a.urgency)[0];
  if (!top || top.urgency < 1) return "없음";
  return `${NEED_LABELS[top.type] ?? top.type} ${Math.round(top.urgency)}`;
}

function ProfessionBoard({ snapshot }: { snapshot: SimulationSnapshot }) {
  const counts = new Map<string, number>();
  for (const citizen of snapshot.citizens) {
    counts.set(citizen.job, (counts.get(citizen.job) ?? 0) + 1);
  }
  const order = ["settler", "farmer", "lumberjack", "miner"];
  const present = order.filter((job) => (counts.get(job) ?? 0) > 0);
  const opportunities = [...snapshot.opportunities].sort(
    (a, b) => b.normalizedScore - a.normalizedScore,
  );
  return (
    <div className="profession-board">
      <div className="profession-current">
        <b>현재 구성</b>
        <div className="profession-tags">
          {present.map((job) => (
            <span key={job}>
              {JOB_LABELS[job as Citizen["job"]]} {counts.get(job)}
            </span>
          ))}
        </div>
      </div>
      <div className="profession-opportunities">
        <b>새 직업 가능성</b>
        {opportunities.map((opportunity) => (
          <div className="opportunity-row" key={opportunity.profession}>
            <span>
              {PROFESSION_LABELS[opportunity.profession] ??
                opportunity.profession}
            </span>
            <div className="opportunity-bar">
              <i
                style={{
                  width: `${Math.round(opportunity.normalizedScore * 100)}%`,
                }}
              />
            </div>
            <strong>{Math.round(opportunity.normalizedScore * 100)}%</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityBoard({ snapshot }: { snapshot: SimulationSnapshot }) {
  const items = [
    ["이동 중", snapshot.activitySummary.moving],
    ["농사 중", snapshot.activitySummary.farming],
    ["식사 중", snapshot.activitySummary.eating],
    ["운반 중", snapshot.activitySummary.carrying],
    ["건설 중", snapshot.activitySummary.building],
    ["휴식 중", snapshot.activitySummary.resting],
    ["대기 중", snapshot.activitySummary.waiting],
  ];
  return (
    <div className="activity-board">
      {items.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function CitizenPanel({ citizen }: { citizen: Citizen }) {
  return (
    <section className="citizen-panel">
      <div className="citizen-title">
        <div>
          <p className="eyebrow">SELECTED CITIZEN</p>
          <h3>{citizen.id}</h3>
        </div>
        <span>
          {citizen.age < 15 ? "아이" : JOB_LABELS[citizen.job]} · {Math.floor(citizen.age)}세
        </span>
      </div>
      <dl className="citizen-facts">
        <div><dt>현재 목표</dt><dd>{GOAL_LABELS[citizen.goal]}</dd></div>
        <div><dt>행동 상태</dt><dd>{citizen.actionState}</dd></div>
        <div><dt>목적지</dt><dd>{citizen.targetId ?? "없음"}</dd></div>
        <div><dt>진행률</dt><dd>{Math.round(citizen.actionProgress * 100)}%</dd></div>
        <div><dt>배고픔</dt><dd>{format(citizen.hunger)}</dd></div>
        <div><dt>피로</dt><dd>{format(citizen.fatigue)}</dd></div>
        <div><dt>건강</dt><dd>{format(citizen.health)}</dd></div>
        <div><dt>행복도</dt><dd>{format(citizen.happiness)}</dd></div>
        <div><dt>보유 식량</dt><dd>{format(citizen.carriedFood)}</dd></div>
      </dl>
      <div className="decision-reasons">
        <b>행동 선택 이유 · 최종 {format(citizen.decisionScore)}</b>
        {citizen.decisionReasons.map((reason) => (
          <div key={`${reason.factor}-${reason.score}`}>
            <span>{reason.factor}</span>
            <strong className={reason.score >= 0 ? "positive" : "negative"}>
              {reason.score >= 0 ? "+" : ""}{format(reason.score)}
            </strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  warning = false,
}: {
  label: string;
  value: string;
  warning?: boolean;
}) {
  return (
    <div className={warning ? "metric warning" : "metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatClock(minutes: number): string {
  const hours = Math.floor(minutes / 60) % 24;
  const remainder = minutes % 60;
  return `${String(hours).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function format(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 1,
  }).format(value);
}
