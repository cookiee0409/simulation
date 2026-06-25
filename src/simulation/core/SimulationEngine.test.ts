import { describe, expect, it } from "vitest";
import { SimulationEngine } from "./SimulationEngine";

describe("SimulationEngine", () => {
  it("작은 마을(10명)과 농장·주택·창고·채집장을 생성한다", () => {
    const engine = new SimulationEngine({ seed: "creation-test" });
    const snapshot = engine.getSnapshot();

    expect(snapshot.citizens).toHaveLength(10);
    expect(
      snapshot.buildings.filter((item) => item.type === "farm"),
    ).toHaveLength(1);
    expect(
      snapshot.buildings.filter(
        (item) => item.type === "house" && item.constructionProgress >= 100,
      ),
    ).toHaveLength(3);
    expect(
      snapshot.buildings.filter((item) => item.type === "warehouse"),
    ).toHaveLength(1);
    expect(
      snapshot.buildings.some((item) => item.type === "lumberjack"),
    ).toBe(true);
    expect(snapshot.buildings.some((item) => item.type === "quarry")).toBe(true);
  });

  it("식량과 주택 여유가 있으면 아이가 태어나 인구가 늘어난다", () => {
    const engine = new SimulationEngine({ seed: "growth-test" });
    const start = engine.getSnapshot().citizens.length;
    expect(start).toBe(10);

    engine.runDays(80);
    const stats = engine.getLatestStatistics();
    const totalBirths = engine
      .getSnapshot()
      .statistics.reduce((sum, day) => sum + day.births, 0);

    expect(totalBirths).toBeGreaterThan(0);
    expect(stats.population).toBeGreaterThan(start);
    expect(stats.childrenCount).toBeGreaterThan(0);
    // 인구가 늘면 주택도 인구를 앞서 더 지어진다.
    expect(stats.houseCount).toBeGreaterThan(3);
  });

  it("아이는 성년이 되기 전에는 일하지 못한다", () => {
    const engine = new SimulationEngine({ seed: "child-labor-test" });
    engine.runDays(60);
    const child = engine
      .getSnapshot()
      .citizens.find((citizen) => citizen.age < 15);
    expect(child).toBeDefined();
    expect(child!.canWork).toBe(false);
    expect(child!.job).toBe("settler");
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
    void before;
  });

  it("시작 시 정식 직업이 없고, 식량 수요가 지속되면 정착민이 농부로 창발한다", () => {
    const engine = new SimulationEngine({ seed: "farmer-emergence" });
    const start = engine.getSnapshot();
    expect(start.citizens.every((c) => c.job === "settler")).toBe(true);
    expect(start.citizens.some((c) => c.job === "farmer")).toBe(false);

    engine.runDays(25);
    const stats = engine.getLatestStatistics();
    expect(stats.farmerCount).toBeGreaterThan(0);
    expect(stats.professionCount).toBeGreaterThan(0);
  });

  it("시간이 지나며 직업 종류가 정착민에서 분화한다", () => {
    const engine = new SimulationEngine({ seed: "diversity" });
    const start = engine.getLatestStatistics();
    expect(start.professionCount).toBe(0);
    expect(engine.getSnapshot().stage).toBe("camp");

    engine.runDays(30);
    const later = engine.getLatestStatistics();
    expect(later.professionCount).toBeGreaterThanOrEqual(2);
  });

  it("수요가 누적되면 전문 직업과 전문 시설이 등장해 마을 단계가 오른다", () => {
    const engine = new SimulationEngine({ seed: "growth-test" });
    engine.runDays(250);
    const snap = engine.getSnapshot();
    const stats = engine.getLatestStatistics();

    expect(stats.population).toBeGreaterThan(20);
    expect(["village", "growing_village", "town"]).toContain(snap.stage);
    expect(stats.professionCount).toBeGreaterThanOrEqual(4);
    // 2차 산업 시설(목공소·대장간·시장)이 하나 이상 들어선다.
    const specialized = snap.buildings.filter(
      (b) =>
        (b.type === "carpentry" ||
          b.type === "blacksmith" ||
          b.type === "market") &&
        b.constructionProgress >= 100,
    );
    expect(specialized.length).toBeGreaterThan(0);
  }, 20_000);

  it("주택이 부족하면 건설 작업을 거쳐 주택이 추가로 완공된다", () => {
    const engine = new SimulationEngine({
      seed: "housing-demand-test",
      initialHouses: 1,
    });
    expect(engine.getBuildingDemand().houses).toBeGreaterThan(0);
    expect(engine.getSnapshot().tasks.some((task) => task.type === "build"))
      .toBe(true);

    engine.runDays(6);
    expect(engine.getLatestStatistics().houseCount).toBeGreaterThan(1);
  });

  it("벌목장·채석장에서 나무와 돌을 채집해 마을 비축이 쌓인다", () => {
    const engine = new SimulationEngine({ seed: "resource-chain" });
    const initial = engine.getSnapshot();
    expect(initial.buildings.some((b) => b.type === "lumberjack")).toBe(true);
    expect(initial.buildings.some((b) => b.type === "quarry")).toBe(true);

    engine.runDays(14);
    const stats = engine.getLatestStatistics();
    expect(stats.lumberjackCount).toBeGreaterThan(0);
    expect(stats.minerCount).toBeGreaterThan(0);
    expect(stats.woodStock).toBeGreaterThan(0);
    expect(stats.stoneStock).toBeGreaterThan(0);
  });

  it("나무·돌이 없으면 주택을 착공하지 못한다", () => {
    const engine = new SimulationEngine({
      seed: "no-resources",
      initialHouses: 1,
      initialWood: 0,
      initialStone: 0,
      initialLumberyards: 0,
      initialQuarries: 0,
      woodPerAction: 0,
      stonePerAction: 0,
    });
    expect(engine.getBuildingDemand().houses).toBeGreaterThan(0);
    expect(
      engine.getSnapshot().buildings.some(
        (b) => b.type === "house" && b.constructionProgress < 100,
      ),
    ).toBe(false);

    engine.runDays(3);
    expect(engine.getLatestStatistics().houseCount).toBeLessThanOrEqual(1);
  });

  it("식량 생산과 비축이 없으면 행복도와 인구가 감소한다", () => {
    const engine = new SimulationEngine({
      seed: "starvation-test",
      initialFood: 0,
      foodPerFarmerPerDay: 0,
      farmFoodPerAction: 0,
      forageFoodPerAction: 0,
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
