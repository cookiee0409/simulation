import type { SimulationState } from "../types";
import { WINTER_BALANCE } from "../scenarios/mountainWinter/winterBalance";

export function updateHeating(state: SimulationState): void {
  const runtime = state.scenario;
  if (!runtime) {
    return;
  }
  const occupancy = new Map<string, number>();
  for (const citizen of state.citizens) {
    if (citizen.homeId) {
      occupancy.set(citizen.homeId, (occupancy.get(citizen.homeId) ?? 0) + 1);
    }
  }

  for (const building of state.buildings) {
    if (
      building.constructionProgress < 100 ||
      (building.type !== "house" && building.type !== "warehouse")
    ) {
      continue;
    }
    const residents =
      building.type === "house"
        ? occupancy.get(building.id) ?? 0
        : state.citizens.filter(
            (citizen) =>
              citizen.goal === "rest" && citizen.targetId === building.id,
          ).length;
    const insulationFactor =
      1 -
      (building.winter.insulation / 100) *
        WINTER_BALANCE.insulationConsumptionReduction;
    const coldFactor = Math.max(
      0.25,
      (12 - runtime.currentTemperature) / 20,
    );
    const desiredFuel =
      residents <= 0
        ? 0
        : WINTER_BALANCE.dailyFirewoodPerHeatedBuilding *
          insulationFactor *
          coldFactor;
    const available =
      building.winter.firewoodStored + state.resources.firewood;
    const consumed = Math.min(desiredFuel, available);
    const fromBuilding = Math.min(
      building.winter.firewoodStored,
      consumed,
    );
    building.winter.firewoodStored -= fromBuilding;
    state.resources.firewood = Math.max(
      0,
      state.resources.firewood - (consumed - fromBuilding),
    );
    building.winter.heatingLevel =
      desiredFuel <= 0 ? 0 : consumed / desiredFuel;
    const occupantBonus =
      Math.min(residents, building.winter.maxOccupantsForHeating) *
      WINTER_BALANCE.occupantHeatBonus;
    const heatedTarget =
      runtime.currentTemperature +
      building.winter.insulation * 0.16 +
      building.winter.heatingLevel * 15 +
      occupantBonus;
    building.winter.indoorTemperature =
      building.winter.indoorTemperature *
        WINTER_BALANCE.indoorTemperatureLag +
      heatedTarget * (1 - WINTER_BALANCE.indoorTemperatureLag);
    building.winter.coldProtection = clamp(
      building.winter.insulation * 0.55 +
        building.winter.heatingLevel * 45,
      0,
      100,
    );
  }
}

export function insulationFirewoodDemand(
  insulation: number,
  outsideTemperature: number,
): number {
  const insulationFactor =
    1 -
    (insulation / 100) *
      WINTER_BALANCE.insulationConsumptionReduction;
  return (
    WINTER_BALANCE.dailyFirewoodPerHeatedBuilding *
    insulationFactor *
    Math.max(0.25, (12 - outsideTemperature) / 20)
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
