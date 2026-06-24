import { describe, expect, it } from "vitest";
import { SimulationEngine } from "./SimulationEngine";

describe("SimulationEngine", () => {
  it("100명의 NPC와 농장·완공 주택·창고를 생성한다", () => {
    const engine = new SimulationEngine({ seed: "creation-test" });
    const snapshot = engine.getSnapshot();

    expect(snapshot.citizens).toHaveLength(100);
    expect(
      snapshot.buildings.filter((item) => item.type === "farm"),
    ).toHaveLength(1);
    expect(
      snapshot.buildings.filter(
        (item) => item.type === "house" && item.constructionProgress >= 100,
      ),
    ).toHaveLength(9);
    expect(
      snapshot.buildings.filter((item) => item.type === "warehouse"),
    ).toHaveLength(1);
    expect(
      snapshot.buildings.some(
        (item) => item.type === "house" && item.constructionProgress < 100,
      ),
    ).toBe(true);
  });

  it("stepTick과 stepDay가 144틱 일자를 유지한다", () => {
    const engine = new SimulationEngine({ seed: "tick-api" });
    expect(engine.stepTick()).toBeUndefined();
    expect(engine.getSnapshot().tick).toBe(1);
    expect(engine.runTicks(143)).toHaveLength(1);
    expect(engine.getSnapshot().day).toBe(1);
    const nextDay = engine.stepDay();
    expect(nextDay.day).toBe(2);
    expect(engine.getSnapshot().tick).toBe(288);
  });

  it("하루 동안 실제 농사·식사 결과를 통계로 기록한다", () => {
    const engine = new SimulationEngine({ seed: "food-flow-test" });
    const before = engine.getSnapshot();
    const day = engine.stepDay();

    expect(day.day).toBe(1);
    expect(day.foodProduced).toBeGreaterThan(0);
    expect(day.foodConsumed).toBeGreaterThan(0);
    expect(day.foodConsumed).toBeLessThanOrEqual(100);
    expect(engine.getSnapshot().statistics).toHaveLength(1);
    expect(day.foodStock).not.toBe(before.resources.food);
  });

  it("식량 수요가 생산능력을 넘으면 농장과 농업 노동자가 증가한다", () => {
    const engine = new SimulationEngine({
      seed: "farm-demand-test",
      initialFarmers: 5,
      initialFarms: 1,
      farmWorkerCapacity: 5,
      foodPerFarmerPerDay: 2,
    });
    const before = engine.getLatestStatistics();
    const after = engine.stepDay();

    expect(after.farmCount).toBeGreaterThan(before.farmCount);
    expect(after.farmerCount).toBeGreaterThan(before.farmerCount);
  });

  it("주택 부족 시 건설 작업을 거쳐 주택이 완공된다", () => {
    const engine = new SimulationEngine({
      seed: "housing-demand-test",
      initialHouses: 8,
      houseCapacity: 10,
    });
    expect(engine.getSnapshot().tasks.some((task) => task.type === "build_house"))
      .toBe(true);

    engine.runDays(3);
    expect(engine.getLatestStatistics().houseCount).toBeGreaterThanOrEqual(10);
    expect(engine.getBuildingDemand().houses).toBe(0);
  });

  it("벌목장·채석장에서 나무와 돌을 채집해 마을 비축이 쌓인다", () => {
    const engine = new SimulationEngine({ seed: "resource-chain" });
    const initial = engine.getSnapshot();
    expect(initial.buildings.some((b) => b.type === "lumberjack")).toBe(true);
    expect(initial.buildings.some((b) => b.type === "quarry")).toBe(true);

    engine.runDays(5);
    const stats = engine.getLatestStatistics();
    expect(stats.lumberjackCount).toBeGreaterThan(0);
    expect(stats.minerCount).toBeGreaterThan(0);
    expect(stats.woodStock).toBeGreaterThan(0);
    expect(stats.stoneStock).toBeGreaterThan(0);
  });

  it("나무·돌이 없으면 주택을 착공하지 못한다", () => {
    const engine = new SimulationEngine({
      seed: "no-resources",
      initialHouses: 8,
      initialWood: 0,
      initialStone: 0,
      initialLumberyards: 0,
      initialQuarries: 0,
      initialLumberjacks: 0,
      initialMiners: 0,
      woodPerAction: 0,
      stonePerAction: 0,
    });
    expect(
      engine.getSnapshot().buildings.some(
        (b) => b.type === "house" && b.constructionProgress < 100,
      ),
    ).toBe(false);
    expect(engine.getBuildingDemand().houses).toBeGreaterThan(0);

    engine.runDays(3);
    expect(engine.getLatestStatistics().houseCount).toBeLessThanOrEqual(8);
  });

  it("식량 생산과 비축이 없으면 행복도와 인구가 감소한다", () => {
    const engine = new SimulationEngine({
      seed: "starvation-test",
      initialFood: 0,
      foodPerFarmerPerDay: 0,
      farmFoodPerAction: 0,
    });
    const initial = engine.getLatestStatistics();
    const final = engine.runDays(20).at(-1)!;

    expect(final.averageHappiness).toBeLessThan(initial.averageHappiness);
    expect(final.population).toBeLessThan(initial.population);
    expect(
      engine.getSnapshot().statistics.some((day) => day.unmetFoodDemand > 0),
    ).toBe(true);
  });

  it("서로 다른 시드는 서로 다른 사회 궤적을 만든다", () => {
    const a = new SimulationEngine({ seed: "divergence-a" });
    const b = new SimulationEngine({ seed: "divergence-b" });
    a.runDays(10);
    b.runDays(10);

    expect(a.getSnapshot().landFertility).not.toBe(
      b.getSnapshot().landFertility,
    );
    expect(a.getSnapshot().statistics).not.toEqual(b.getSnapshot().statistics);
  });

  it("동일한 설정과 시드에서 목표·경로·결과가 같다", () => {
    const first = new SimulationEngine({ seed: "replay-test" });
    const second = new SimulationEngine({ seed: "replay-test" });
    first.runDays(20);
    second.runDays(20);
    expect(first.getSnapshot()).toEqual(second.getSnapshot());
  }, 30_000);

  it("배속 설정과 무관하게 같은 날짜를 실행하면 결과가 같다", () => {
    const normal = new SimulationEngine({ seed: "speed-invariance" });
    const fast = new SimulationEngine({ seed: "speed-invariance" });
    normal.setSpeed(1);
    fast.setSpeed(100);
    normal.runDays(5);
    fast.runDays(5);
    fast.setSpeed(1);
    expect(normal.getSnapshot()).toEqual(fast.getSnapshot());
  });

  it("그래픽 없이 100일간 유한하고 음수가 아닌 통계를 만든다", () => {
    const engine = new SimulationEngine({ seed: "headless-test" });
    const statistics = engine.runDays(100);

    expect(statistics).toHaveLength(100);
    expect(statistics.at(-1)?.day).toBe(100);
    for (const day of statistics) {
      for (const value of Object.values(day)) {
        expect(Number.isFinite(value)).toBe(true);
      }
      expect(day.population).toBeGreaterThanOrEqual(0);
      expect(day.foodStock).toBeGreaterThanOrEqual(0);
      expect(day.averageHappiness).toBeGreaterThanOrEqual(0);
      expect(day.averageHappiness).toBeLessThanOrEqual(100);
    }
    expect(engine.getSnapshot().pathfinding.cacheHits).toBeGreaterThan(0);
  }, 20_000);
});
