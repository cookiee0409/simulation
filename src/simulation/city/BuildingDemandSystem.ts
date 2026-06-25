import { requestBuilding } from "./BuildingConstruction";
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
  // 자재·공간이 확보될 때만 농장을 자동 부지 선정해 착공한다.
  return requestBuilding(state, config, "farm", random);
}

/**
 * 인구가 늘면 창고를 추가로 지어 식량 접근(동선)을 분산한다. 창고 하나에
 * 몰리는 병목을 막아 큰 마을도 모두가 식사할 수 있게 한다.
 */
export function buildNeededWarehouse(
  state: SimulationState,
  config: SimulationConfig,
  random: SeededRandom,
): boolean {
  const warehouses = state.buildings.filter(
    (b) => b.type === "warehouse",
  ).length;
  const desired = Math.max(1, Math.ceil(state.citizens.length / 16));
  if (warehouses >= desired) {
    return false;
  }
  // 짓는 중이면 대기.
  if (
    state.buildings.some(
      (b) => b.type === "warehouse" && b.constructionProgress < 100,
    )
  ) {
    return false;
  }
  return requestBuilding(state, config, "warehouse", random);
}
