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
    (building) => building.type === "farm",
  ).length;
  const houseCount = state.buildings.filter(
    (building) => building.type === "house",
  ).length;
  const desiredFarmers =
    config.foodPerFarmerPerDay <= 0
      ? 0
      : Math.ceil(
          (state.citizens.length * config.foodPerCitizenPerDay * 1.05) /
            config.foodPerFarmerPerDay,
        );
  const desiredFarms = Math.ceil(
    desiredFarmers / Math.max(1, config.farmWorkerCapacity),
  );
  const desiredHouses = Math.ceil(
    state.citizens.length / Math.max(1, config.houseCapacity),
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
    createBuilding("farm", farmIndex, config.farmWorkerCapacity, random),
  );
  return true;
}
