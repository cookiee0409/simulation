import { describe, expect, it } from "vitest";
import { SimulationEngine } from "./SimulationEngine";

describe("SimulationEngine", () => {
  it("100명의 NPC와 농장·주택·창고를 생성한다", () => {
    const engine = new SimulationEngine({ seed: "creation-test" });
    const snapshot = engine.getSnapshot();

    expect(snapshot.citizens).toHaveLength(100);
    expect(snapshot.buildings.filter((item) => item.type === "farm")).toHaveLength(1);
    expect(snapshot.buildings.filter((item) => item.type === "house")).toHaveLength(9);
    expect(
      snapshot.buildings.filter((item) => item.type === "warehouse"),
    ).toHaveLength(1);
  });

  it("하루마다 식량을 생산·소비하고 통계를 기록한다", () => {
    const engine = new SimulationEngine({ seed: "food-flow-test" });
    const before = engine.getSnapshot();
    const day = engine.stepDay();

    expect(day.day).toBe(1);
    expect(day.foodProduced).toBeGreaterThan(0);
    expect(day.foodConsumed).toBe(100);
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

  it("주택이 부족하면 주택 건설 수요를 계산한다", () => {
    const engine = new SimulationEngine({
      seed: "housing-demand-test",
      initialHouses: 8,
      houseCapacity: 10,
    });

    expect(engine.getBuildingDemand().houses).toBe(2);
    expect(engine.getLatestStatistics().housingDemand).toBe(2);
  });

  it("식량 생산과 비축이 없으면 행복도와 인구가 감소한다", () => {
    const engine = new SimulationEngine({
      seed: "starvation-test",
      initialFood: 0,
      foodPerFarmerPerDay: 0,
    });
    const initial = engine.getLatestStatistics();
    const final = engine.runDays(20).at(-1);

    expect(final).toBeDefined();
    expect(final!.averageHappiness).toBeLessThan(initial.averageHappiness);
    expect(final!.population).toBeLessThan(initial.population);
    expect(final!.unmetFoodDemand).toBeGreaterThan(0);
  });

  it("동일한 설정과 시드에서 100일 결과가 완전히 같다", () => {
    const first = new SimulationEngine({ seed: "replay-test" });
    const second = new SimulationEngine({ seed: "replay-test" });

    first.runDays(100);
    second.runDays(100);

    expect(first.getSnapshot()).toEqual(second.getSnapshot());
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
  });
});
