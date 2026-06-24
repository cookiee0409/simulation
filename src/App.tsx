import { useEffect, useRef, useState } from "react";
import { VillageCanvas } from "./game/VillageCanvas";
import {
  SIMULATION_SPEEDS,
  SimulationEngine,
  type SimulationSnapshot,
  type SimulationSpeed,
} from "./simulation";
import "./styles.css";

const DEFAULT_SEED = "village-001";

export default function App() {
  const engineRef = useRef(new SimulationEngine({ seed: DEFAULT_SEED }));
  const [snapshot, setSnapshot] = useState<SimulationSnapshot>(() =>
    engineRef.current.getSnapshot(),
  );

  useEffect(() => {
    let frameId = 0;
    let previousTime = performance.now();

    const frame = (currentTime: number) => {
      const elapsed = Math.min(250, currentTime - previousTime);
      previousTime = currentTime;
      const completedDays = engineRef.current.advanceRealTime(elapsed);
      if (completedDays > 0) {
        setSnapshot(engineRef.current.getSnapshot());
      }
      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const updateSnapshot = () => {
    setSnapshot(engineRef.current.getSnapshot());
  };

  const togglePaused = () => {
    engineRef.current.setPaused(!snapshot.paused);
    updateSnapshot();
  };

  const setSpeed = (speed: SimulationSpeed) => {
    engineRef.current.setSpeed(speed);
    updateSnapshot();
  };

  const stepOneDay = () => {
    engineRef.current.stepDay();
    updateSnapshot();
  };

  const resetSimulation = () => {
    engineRef.current = new SimulationEngine({ seed: DEFAULT_SEED });
    updateSnapshot();
  };

  const stats = snapshot.latestStatistics;
  const recentStatistics = snapshot.statistics.slice(-7).reverse();

  return (
    <main className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">SOCIAL VILLAGE LAB · SEED {snapshot.seed}</p>
          <h1>작은 사회 실험실</h1>
          <p className="subtitle">
            100명의 주민, 한정된 식량, 그리고 스스로 균형을 찾는 마을.
          </p>
        </div>
        <div className="day-card">
          <span>현재 날짜</span>
          <strong>DAY {snapshot.day}</strong>
        </div>
      </header>

      <section className="dashboard">
        <div className="village-panel">
          <VillageCanvas snapshot={snapshot} />
          <div className="legend" aria-label="지도 범례">
            <span><i className="dot farmer" /> 농부</span>
            <span><i className="dot citizen" /> 무직 주민</span>
            <span><i className="block farm" /> 농장</span>
            <span><i className="block house" /> 주택</span>
            <span><i className="block warehouse" /> 창고</span>
          </div>
        </div>

        <aside className="stats-panel">
          <div className="stats-heading">
            <div>
              <p className="eyebrow">DAILY SNAPSHOT</p>
              <h2>마을 현황</h2>
            </div>
            <span className={snapshot.paused ? "status paused" : "status"}>
              {snapshot.paused ? "일시정지" : `${snapshot.speed}배속 실행 중`}
            </span>
          </div>

          <div className="metric-grid">
            <Metric label="인구" value={`${stats.population}명`} />
            <Metric label="식량 재고" value={format(stats.foodStock)} />
            <Metric
              label="평균 행복도"
              value={`${format(stats.averageHappiness)}점`}
            />
            <Metric label="농부" value={`${stats.farmerCount}명`} />
            <Metric label="농장" value={`${stats.farmCount}개`} />
            <Metric
              label="주택 수요"
              value={`${stats.housingDemand}개`}
              warning={stats.housingDemand > 0}
            />
          </div>

          <div className="flow-card">
            <div>
              <span>오늘 생산</span>
              <strong>+{format(stats.foodProduced)}</strong>
            </div>
            <div>
              <span>오늘 소비</span>
              <strong>-{format(stats.foodConsumed)}</strong>
            </div>
            <div>
              <span>미충족 수요</span>
              <strong>{format(stats.unmetFoodDemand)}</strong>
            </div>
          </div>

          <div className="history">
            <h3>최근 일일 기록</h3>
            {recentStatistics.length === 0 ? (
              <p className="empty">하루를 진행하면 통계가 기록됩니다.</p>
            ) : (
              <div className="history-list">
                {recentStatistics.map((entry) => (
                  <div className="history-row" key={entry.day}>
                    <b>D{entry.day}</b>
                    <span>인구 {entry.population}</span>
                    <span>식량 {format(entry.foodStock)}</span>
                    <span>행복 {format(entry.averageHappiness)}</span>
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
        <button type="button" onClick={stepOneDay}>+ 하루</button>
        <button type="button" onClick={resetSimulation}>같은 시드로 초기화</button>
      </section>
    </main>
  );
}

interface MetricProps {
  label: string;
  value: string;
  warning?: boolean;
}

function Metric({ label, value, warning = false }: MetricProps) {
  return (
    <div className={warning ? "metric warning" : "metric"}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function format(value: number): string {
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 1,
  }).format(value);
}
