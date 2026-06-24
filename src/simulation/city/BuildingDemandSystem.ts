import { createBuilding } from "./BuildingFactory";
import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import type { SimulationState } from "../types";

export interface BuildingDemand {
  farms: number;
  houses: number;
}

export function calculateBuildingDemand(
  state: SimulationState,
  config: SimulationConfig,
): BuildingDemand {
  const farmCount = state.buildings.filter(
    (building) =>
      building.type === "farm" && building.constructionProgress >= 100,
  ).length;
  const houseCount = state.buildings.filter(
    (building) =>
      building.type === "house" && building.constructionProgress >= 100,
  ).length;
  const desiredFarmers =
    config.foodPerFarmerPerDay <= 0
      ? 0
      : Math.ceil(
          (state.citizens.length *
            config.foodPerCitizenPerDay *
            config.farmerSurplusRatio) /
            config.foodPerFarmerPerDay,
        );
  const desiredFarms = Math.ceil(
    desiredFarmers / Math.max(1, config.farmWorkerCapacity),
  );
  // 인구보다 약간 앞서 주택을 지어 출산이 멈추지 않도록 여유분을 더한다.
  const desiredHouses = Math.ceil(
    (state.citizens.length + config.housingGrowthBuffer) /
      Math.max(1, config.houseCapacity),
  );

  return {
    farms: Math.max(0, desiredFarms - farmCount),
    houses: Math.max(0, desiredHouses - houseCount),
  };
}

export function buildOneNeededFarm(
  state: SimulationState,
  config: SimulationConfig,
  random: SeededRandom,
): boolean {
  const demand = calculateBuildingDemand(state, config);
  if (demand.farms <= 0) {
    return false;
  }

  const farmIndex = state.buildings.filter(
    (building) => building.type === "farm",
  ).length;
  state.buildings.push(
    createBuilding(
      "farm",
      farmIndex,
      config.farmWorkerCapacity,
      random,
      config,
    ),
  );
  state.mapRevision += 1;
  return true;
}
