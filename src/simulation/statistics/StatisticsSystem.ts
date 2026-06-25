import type { SimulationConfig } from "../core/SimulationConfig";
import type {
  BuildingType,
  DailyStatistics,
  SimulationState,
} from "../types";
import type { FoodDayResult } from "../economy/FoodSystem";
import { calculateBuildingDemand } from "../city/BuildingDemandSystem";

export function createDailyStatistics(
  day: number,
  state: SimulationState,
  config: SimulationConfig,
  foodResult: FoodDayResult,
): DailyStatistics {
  const population = state.citizens.length;
  const childrenCount = state.citizens.filter(
    (citizen) => citizen.age < config.childMaturityYears,
  ).length;
  const settlerCount = state.citizens.filter(
    (citizen) => citizen.job === "settler",
  ).length;
  const professionCount = new Set(
    state.citizens
      .filter((c) => c.job !== "settler" && c.job !== "unemployed")
      .map((c) => c.job),
  ).size;
  const buildingTypeCount = new Set(
    state.buildings
      .filter((b) => b.constructionProgress >= 100)
      .map((b) => b.type),
  ).size;
  const topNeedUrgency = state.needs.reduce(
    (max, need) => Math.max(max, need.urgency),
    0,
  );
  const farmerCount = state.citizens.filter(
    (citizen) => citizen.job === "farmer",
  ).length;
  const lumberjackCount = state.citizens.filter(
    (citizen) => citizen.job === "lumberjack",
  ).length;
  const minerCount = state.citizens.filter(
    (citizen) => citizen.job === "miner",
  ).length;
  const farmCount = countBuildings(state, "farm");
  const houseCount = countBuildings(state, "house");
  const warehouseCount = countBuildings(state, "warehouse");
  const lumberjackBuildingCount = countBuildings(state, "lumberjack");
  const quarryCount = countBuildings(state, "quarry");
  const housingCapacity = state.buildings
    .filter(
      (building) =>
        building.type === "house" && building.constructionProgress >= 100,
    )
    .reduce((sum, building) => sum + building.capacity, 0);

  // 생성 시 동결: 스냅샷이 깊은 복사 없이 불변 참조를 공유할 수 있게 한다.
  return Object.freeze({
    day,
    population,
    foodStock: round(state.resources.food),
    woodStock: round(state.resources.wood),
    stoneStock: round(state.resources.stone),
    foodProduced: round(foodResult.produced),
    foodConsumed: round(foodResult.consumed),
    unmetFoodDemand: round(foodResult.unmetDemand),
    averageHunger: round(average(state.citizens.map((citizen) => citizen.hunger))),
    averageHappiness: round(
      average(state.citizens.map((citizen) => citizen.happiness)),
    ),
    averageAge: round(average(state.citizens.map((citizen) => citizen.age))),
    births: state.dailyMetrics.births,
    deaths: state.dailyMetrics.deaths,
    childrenCount,
    settlerCount,
    professionCount,
    buildingTypeCount,
    topNeedUrgency: round(topNeedUrgency),
    farmerCount,
    lumberjackCount,
    minerCount,
    unemployedCount:
      population - farmerCount - lumberjackCount - minerCount,
    farmCount,
    houseCount,
    warehouseCount,
    lumberjackBuildingCount,
    quarryCount,
    housingCapacity,
    housingDemand: calculateBuildingDemand(state, config).houses,
    populationLost: foodResult.populationLost,
  });
}

export function createInitialStatistics(
  state: SimulationState,
  config: SimulationConfig,
): DailyStatistics {
  return createDailyStatistics(0, state, config, {
    produced: 0,
    consumed: 0,
    unmetDemand: 0,
    populationLost: 0,
  });
}

function countBuildings(
  state: SimulationState,
  type: BuildingType,
): number {
  return state.buildings.filter(
    (building) =>
      building.type === type && building.constructionProgress >= 100,
  ).length;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
