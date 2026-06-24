import type { SimulationConfig } from "../core/SimulationConfig";
import type { BuildingType, CitizenJob, SimulationState } from "../types";

/**
 * 나무·돌 재고가 목표치 아래일 때 무직자를 벌목공·채석공으로 전환해
 * 채집장 정원을 채운다. 식량 인력(adjustFarmWorkforce)과 동일하게
 * 결정적 순서(위험 선호도 → id)로 후보를 고른다.
 */
export function adjustResourceWorkforce(
  state: SimulationState,
  config: SimulationConfig,
): void {
  assignResourceJob(
    state,
    config,
    "lumberjack",
    "lumberjack",
    config.lumberjackWorkerCapacity,
    state.resources.wood < config.woodStockTarget,
  );
  assignResourceJob(
    state,
    config,
    "miner",
    "quarry",
    config.quarryWorkerCapacity,
    state.resources.stone < config.stoneStockTarget,
  );
}

function assignResourceJob(
  state: SimulationState,
  config: SimulationConfig,
  job: CitizenJob,
  buildingType: BuildingType,
  workerCapacityPerBuilding: number,
  needsMoreOutput: boolean,
): void {
  if (!needsMoreOutput) {
    return;
  }
  const totalCapacity = state.buildings
    .filter(
      (building) =>
        building.type === buildingType && building.constructionProgress >= 100,
    )
    .reduce((sum) => sum + workerCapacityPerBuilding, 0);
  const current = state.citizens.filter(
    (citizen) => citizen.job === job,
  ).length;
  const transfers = Math.min(
    config.maxResourceWorkerTransfersPerDay,
    Math.max(0, totalCapacity - current),
  );
  if (transfers <= 0) {
    return;
  }

  const candidates = state.citizens
    .filter((citizen) => citizen.job === "unemployed" && citizen.canWork)
    .sort(
      (left, right) =>
        right.traits.riskTolerance - left.traits.riskTolerance ||
        left.id.localeCompare(right.id),
    )
    .slice(0, transfers);

  for (const citizen of candidates) {
    citizen.job = job;
    citizen.action = "working";
  }
}
