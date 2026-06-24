import type { SimulationConfig } from "../core/SimulationConfig";
import type { SimulationState } from "../types";

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
    (dailyDemand * 1.05) / config.foodPerFarmerPerDay,
  );
  const currentFarmers = state.citizens.filter(
    (citizen) => citizen.job === "farmer",
  ).length;
  const farmCapacity = state.buildings
    .filter((building) => building.type === "farm")
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
