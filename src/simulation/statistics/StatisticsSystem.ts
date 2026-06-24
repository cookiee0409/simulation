import type { SimulationConfig } from "../core/SimulationConfig";
import type {
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
  const farmerCount = state.citizens.filter(
    (citizen) => citizen.job === "farmer",
  ).length;
  const farmCount = countBuildings(state, "farm");
  const houseCount = countBuildings(state, "house");
  const warehouseCount = countBuildings(state, "warehouse");
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
    foodProduced: round(foodResult.produced),
    foodConsumed: round(foodResult.consumed),
    unmetFoodDemand: round(foodResult.unmetDemand),
    averageHunger: round(average(state.citizens.map((citizen) => citizen.hunger))),
    averageHappiness: round(
      average(state.citizens.map((citizen) => citizen.happiness)),
    ),
    farmerCount,
    unemployedCount: population - farmerCount,
    farmCount,
    houseCount,
    warehouseCount,
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
  type: "farm" | "house" | "warehouse",
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
