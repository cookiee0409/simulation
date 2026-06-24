import type { SimulationConfig } from "../core/SimulationConfig";
import type { Building, SimulationState } from "../types";

export function adjustFarmWorkforce(
  state: SimulationState,
  config: SimulationConfig,
): number {
  if (config.foodPerFarmerPerDay <= 0 || state.citizens.length === 0) {
    return 0;
  }

  const dailyDemand =
    state.citizens.length * config.foodPerCitizenPerDay;
  const desiredFarmers = Math.ceil(
    (dailyDemand * config.farmerSurplusRatio) / config.foodPerFarmerPerDay,
  );
  const currentFarmers = state.citizens.filter(
    (citizen) => citizen.job === "farmer",
  ).length;
  const farmCapacity = state.buildings
    .filter(
      (building) =>
        building.type === "farm" && building.constructionProgress >= 100,
    )
    .reduce((sum, building) => sum + building.capacity, 0);
  const transfersNeeded = Math.min(
    config.maxFarmerTransfersPerDay,
    Math.max(0, desiredFarmers - currentFarmers),
    Math.max(0, farmCapacity - currentFarmers),
  );

  const candidates = state.citizens
    .filter((citizen) => citizen.job === "unemployed" && citizen.canWork)
    .sort(
      (left, right) =>
        right.traits.riskTolerance - left.traits.riskTolerance ||
        left.id.localeCompare(right.id),
    )
    .slice(0, transfersNeeded);

  for (const citizen of candidates) {
    citizen.job = "farmer";
    citizen.action = "working";
  }

  return candidates.length;
}

/**
 * 농부를 농장 정원만큼 결정적 순서로 배치한다. 정원을 넘는 농부는 어느 농장에도
 * 배치되지 않으며, FoodSystem이 농장 총정원으로 생산 인력을 상한 처리한다.
 */
export function assignWorkersToFarms(state: SimulationState): void {
  const farms = state.buildings.filter(
    (building): building is Building =>
      building.type === "farm" && building.constructionProgress >= 100,
  );
  for (const farm of farms) {
    farm.workers = [];
  }

  const farmers = state.citizens.filter((citizen) => citizen.job === "farmer");
  let farmIndex = 0;
  for (const farmer of farmers) {
    while (
      farmIndex < farms.length &&
      farms[farmIndex]!.workers.length >= farms[farmIndex]!.capacity
    ) {
      farmIndex += 1;
    }
    farms[farmIndex]?.workers.push(farmer.id);
  }
}
