import { useEffect, useRef, useState } from "react";
import { VillageCanvas } from "./game/VillageCanvas";
import {
  SIMULATION_SPEEDS,
  SimulationEngine,
  mountainWinterScenario,
  type Citizen,
  type SimulationSnapshot,
  type SimulationSpeed,
} from "./simulation";
import type { ScenarioDefinition } from "./simulation/scenarios/ScenarioDefinition";
import "./styles.css";

const DEFAULT_SEED = "mountain-winter-001";
const DEFAULT_SETTINGS: SetupSettings = {
  seed: DEFAULT_SEED,
  npcCount: 10,
  winterStartDay: 20,
  winterEndDay: 55,
};

interface SetupSettings {
  seed: string;
  npcCount: number;
  winterStartDay: number;
  winterEndDay: number;
}

const GOAL_LABELS: Record<Citizen["goal"], string> = {
  eat: "식사",
  forage: "채집",
  work_farm: "농사",
  gather_wood: "벌목",
  gather_stone: "채석",
  work_carpentry: "목공",
  work_blacksmith: "대장일",
  work_market: "장사",
  process_firewood: "땔감 가공",
  heat_home: "주택 난방",
  repair_shelter: "주택 수리",
  insulate_shelter: "단열 보강",
  care_sick: "환자 돌봄",
  migrate: "개인 이주",
  forge_tools: "도구 제작",
  trade_supplies: "교역",
  carry_food: "식량 운반",
  rest: "휴식",
  return_home: "귀가",
  seek_work: "일 찾기",
  build: "건설",
  wander: "대기",
};

const JOB_LABELS: Record<Citizen["job"], string> = {
  settler: "주민",
  farmer: "농부",
  lumberjack: "벌목공",
  miner: "채석공",
  carpenter: "목수",
  blacksmith: "대장장이",
  merchant: "상인",
  unemployed: "무직",
};

export default function App() {
  const engineRef = useRef(createEngine(DEFAULT_SETTINGS, true));
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() =>
    engineRef.current.getSnapshot(),
  );
  const [selectedCitizenId, setSelectedCitizenId] = useState<string>();
  const [setup, setSetup] = useState<SetupSettings>(DEFAULT_SETTINGS);
  const [activeSetup, setActiveSetup] = useState<SetupSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    let frameId = 0;
    let previousTime = performance.now();
    const frame = (currentTime: number) => {
      const elapsed = Math.min(250, currentTime - previousTime);
      previousTime = currentTime;
      if (engineRef.current.advanceRealTime(elapsed) > 0) {
        setSnapshot(engineRef.current.getSnapshot());
      }
      frameId = requestAnimationFrame(frame);
    };
    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const refresh = () => setSnapshot(engineRef.current.getSnapshot());
  const scenario = snapshot.scenario;
  const selectedCitizen = snapshot.citizens.find(
    (citizen) => citizen.id === selectedCitizenId,
  );
  const heatedHouses = snapshot.buildings.filter(
    (building) =>
      building.type === "house" && building.winter.heatingLevel >= 0.5,
  ).length;
  const sickResidents = snapshot.citizens.filter(
    (citizen) => citizen.winter.illness >= 25,
  ).length;
  const houseCount = snapshot.buildings.filter(
    (building) => building.type === "house",
  ).length;

  const setSpeed = (speed: SimulationSpeed) => {
    engineRef.current.setSpeed(speed);
    refresh();
  };
  const reset = () => {
    engineRef.current = createEngine(activeSetup, true);
    setSelectedCitizenId(undefined);
    refresh();
  };
  const applySetup = () => {
    const next = sanitizeSetup(setup);
    setSetup(next);
    setActiveSetup(next);
    engineRef.current = createEngine(next, false);
    setSelectedCitizenId(undefined);
    setSnapshot(engineRef.current.getSnapshot());
  };

  return (
    <main className="app-shell">
      <header className="hero winter-hero">
        <div>
          <p className="eyebrow">MOUNTAIN WINTER · SEED {snapshot.seed}</p>
          <h1>혹한이 다가오는 산골 마을</h1>
          <p className="subtitle">
            {activeSetup.winterStartDay}일 동안 겨울을 준비하고,
            이어지는 {activeSetup.winterEndDay - activeSetup.winterStartDay}일의 혹한을 견디세요.
            주민들은 상황과 성향에 따라 스스로 일하고 돌보거나 떠납니다.
          </p>
        </div>
        <div className="day-card">
          <span>DAY {snapshot.day} · {phaseLabel(scenario?.phase)}</span>
          <strong>{scenario ? `${scenario.currentTemperature.toFixed(1)}°C` : "—"}</strong>
          <small>
            {scenario?.phase === "preparation"
              ? `겨울까지 ${scenario.daysUntilWinter}일`
              : `예상 최저 ${scenario?.expectedMinimumTemperature ?? -24}°C`}
          </small>
        </div>
      </header>

      <section className="setup-panel" aria-label="시뮬레이션 시작 설정">
        <div>
          <p className="eyebrow">SETUP</p>
          <h2>시작 전 세부 설정</h2>
          <p>NPC 수, 혹한기 시작/종료일, 시드를 바꾸고 새 시뮬레이션을 시작합니다.</p>
        </div>
        <label>
          <span>시드</span>
          <input
            value={setup.seed}
            onChange={(event) =>
              setSetup((current) => ({ ...current, seed: event.target.value }))
            }
          />
        </label>
        <label>
          <span>NPC 수</span>
          <input
            type="number"
            min={1}
            max={100}
            value={setup.npcCount}
            onChange={(event) =>
              setSetup((current) => ({
                ...current,
                npcCount: Number(event.target.value),
              }))
            }
          />
        </label>
        <label>
          <span>혹한 시작일</span>
          <input
            type="number"
            min={1}
            max={180}
            value={setup.winterStartDay}
            onChange={(event) =>
              setSetup((current) => ({
                ...current,
                winterStartDay: Number(event.target.value),
              }))
            }
          />
        </label>
        <label>
          <span>종료일</span>
          <input
            type="number"
            min={2}
            max={240}
            value={setup.winterEndDay}
            onChange={(event) =>
              setSetup((current) => ({
                ...current,
                winterEndDay: Number(event.target.value),
              }))
            }
          />
        </label>
        <button className="primary" type="button" onClick={applySetup}>
          설정 적용 후 시작
        </button>
      </section>

      <section className="dashboard">
        <div className="village-panel">
          <VillageCanvas
            snapshot={snapshot}
            selectedCitizenId={selectedCitizenId}
            onCitizenSelect={setSelectedCitizenId}
          />
          <div className="legend">
            <span>🌾 농사</span><span>🪓 벌목</span><span>🔥 난방</span>
            <span>🔨 수리</span><span>🩺 돌봄</span><span>🚶 이주</span>
          </div>
        </div>

        <aside className="stats-panel">
          <div className="stats-heading">
            <div><p className="eyebrow">WINTER SURVIVAL</p><h2>마을 생존 현황</h2></div>
            <span className={snapshot.paused ? "status paused" : "status"}>
              {snapshot.paused ? "일시정지" : `${snapshot.speed}배속`}
            </span>
          </div>

          <div className="metric-grid">
            <Metric label="생존 주민" value={`${snapshot.citizens.length}명`} />
            <Metric label="환자" value={`${sickResidents}명`} warning={sickResidents > 0} />
            <Metric label="식량" value={format(snapshot.resources.food)} />
            <Metric label="땔감" value={format(snapshot.resources.firewood)} warning={snapshot.resources.firewood < 8} />
            <Metric label="원목" value={format(snapshot.resources.wood)} />
            <Metric label="의약품" value={format(snapshot.resources.medicine)} />
            <Metric label="난방 주택" value={`${heatedHouses}/${houseCount}`} />
            <Metric label="이주" value={`${scenario?.migrated ?? 0}명`} />
          </div>

          <WinterNeeds snapshot={snapshot} />
          {selectedCitizen ? (
            <CitizenPanel citizen={selectedCitizen} />
          ) : (
            <div className="citizen-panel empty-selection">
              지도에서 주민을 선택하면 체온, 질병, 기술과 의사결정 이유를 볼 수 있습니다.
            </div>
          )}
          <EventTimeline snapshot={snapshot} />
          {scenario?.outcome && <OutcomeCard snapshot={snapshot} />}
        </aside>
      </section>

      <section className="controls" aria-label="시뮬레이션 시간 조작">
        <button className="primary" type="button" onClick={() => {
          engineRef.current.setPaused(!snapshot.paused);
          refresh();
        }}>
          {snapshot.paused ? "계속" : "일시정지"}
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
        <button type="button" onClick={() => { engineRef.current.stepTick(); refresh(); }}>+ 10분</button>
        <button type="button" onClick={() => { engineRef.current.stepDay(); refresh(); }}>+ 하루</button>
        <button type="button" onClick={reset}>현재 설정으로 초기화</button>
      </section>
    </main>
  );
}

function createEngine(settings: SetupSettings, paused = false): SimulationEngine {
  const engine = new SimulationEngine(
    {
      seed: settings.seed || DEFAULT_SEED,
      initialPopulation: settings.npcCount,
    },
    createScenario(settings),
  );
  engine.setPaused(paused);
  return engine;
}

function createScenario(settings: SetupSettings): ScenarioDefinition {
  return {
    ...mountainWinterScenario,
    durationDays: settings.winterEndDay,
    preparationDays: settings.winterStartDay,
    initialPopulation: settings.npcCount,
  };
}

function sanitizeSetup(settings: SetupSettings): SetupSettings {
  const npcCount = clampInteger(settings.npcCount, 1, 100);
  const winterStartDay = clampInteger(settings.winterStartDay, 1, 180);
  const winterEndDay = Math.max(
    winterStartDay + 1,
    clampInteger(settings.winterEndDay, 2, 240),
  );
  return {
    seed: settings.seed.trim() || DEFAULT_SEED,
    npcCount,
    winterStartDay,
    winterEndDay,
  };
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.min(max, Math.max(min, Math.round(value)));
}

function WinterNeeds({ snapshot }: { snapshot: SimulationSnapshot }) {
  return (
    <div className="profession-board">
      <b>겨울 대비 필요도</b>
      <div className="profession-opportunities">
        {[...snapshot.winterNeeds].sort((a, b) => b.urgency - a.urgency).map((need) => (
          <div className="opportunity-row" key={need.type}>
            <span>{winterNeedLabel(need.type)}</span>
            <div className="opportunity-bar"><i style={{ width: `${need.urgency}%` }} /></div>
            <strong>{Math.round(need.urgency)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function CitizenPanel({ citizen }: { citizen: Citizen }) {
  return (
    <section className="citizen-panel">
      <div className="citizen-title">
        <div><p className="eyebrow">SELECTED CITIZEN</p><h3>{citizen.id}</h3></div>
        <span>{citizen.age < 15 ? "아이" : JOB_LABELS[citizen.job]} · {Math.floor(citizen.age)}세</span>
      </div>
      <dl className="citizen-facts">
        <div><dt>행동</dt><dd>{GOAL_LABELS[citizen.goal]}</dd></div>
        <div><dt>임시 역할</dt><dd>{citizen.temporaryRole ?? "없음"}</dd></div>
        <div><dt>전문 분야</dt><dd>{skillLabel(citizen.specialty)}</dd></div>
        <div><dt>현재 생각</dt><dd>{citizen.thought?.label ?? "안정"}</dd></div>
        <div><dt>체온</dt><dd>{citizen.winter.bodyTemperature.toFixed(1)}°C</dd></div>
        <div><dt>추위 노출</dt><dd>{format(citizen.winter.coldExposure)}</dd></div>
        <div><dt>질병</dt><dd>{format(citizen.winter.illness)}</dd></div>
        <div><dt>건강</dt><dd>{format(citizen.health)}</dd></div>
        <div><dt>벌목 기술</dt><dd>{format(citizen.skills.logging)}</dd></div>
        <div><dt>건축 기술</dt><dd>{format(citizen.skills.construction)}</dd></div>
        <div><dt>의료 기술</dt><dd>{format(citizen.skills.medicine)}</dd></div>
        <div><dt>마을 애착</dt><dd>{format(citizen.traits.attachmentToVillage)}</dd></div>
      </dl>
      <div className="decision-reasons">
        <b>행동 선택 점수 {format(citizen.decisionScore)}</b>
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

function skillLabel(skill: Citizen["specialty"]): string {
  return {
    farming: "농사",
    logging: "벌목",
    construction: "건축",
    hunting: "수렵",
    medicine: "의료",
    cooking: "조리",
    scouting: "정찰",
    negotiation: "협상",
    leadership: "리더십",
  }[skill];
}

function EventTimeline({ snapshot }: { snapshot: SimulationSnapshot }) {
  const events = snapshot.scenario?.events.slice(-5).reverse() ?? [];
  return (
    <div className="history">
      <h3>주요 사건</h3>
      {events.length === 0 ? <p className="empty">아직 기록된 사건이 없습니다.</p> : (
        <div className="history-list">
          {events.map((event) => (
            <div className="history-row" key={event.id}>
              <b>D{event.day}</b><span>{event.title}</span><span>{event.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OutcomeCard({ snapshot }: { snapshot: SimulationSnapshot }) {
  const outcome = snapshot.scenario!.outcome!;
  return (
    <div className="citizen-panel">
      <p className="eyebrow">SCENARIO COMPLETE</p>
      <h3>{outcome.survivors > 0 ? "마을이 겨울을 견뎠습니다" : "마을이 비었습니다"}</h3>
      <p>생존 {outcome.survivors}명 · 사망 {outcome.deaths}명 · 이주 {outcome.migrated}명</p>
      <p>수리 {outcome.repairsCompleted}회 · 단열 {outcome.insulationUpgrades}회 · 돌봄 {outcome.careActions}회</p>
    </div>
  );
}

function Metric({ label, value, warning = false }: { label: string; value: string; warning?: boolean }) {
  return <div className={warning ? "metric warning" : "metric"}><span>{label}</span><strong>{value}</strong></div>;
}

function phaseLabel(phase?: string): string {
  if (phase === "preparation") return "준비기";
  if (phase === "winter") return "혹한기";
  if (phase === "ended") return "종료";
  return "시나리오";
}

function winterNeedLabel(type: string): string {
  return ({
    warmth: "보온",
    firewood: "땔감",
    winter_food: "겨울 식량",
    shelter_repair: "주택 수리",
    insulation: "단열",
    medicine: "의료",
    migration: "이주 압력",
  } as Record<string, string>)[type] ?? type;
}

function format(value: number): string {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value);
}
