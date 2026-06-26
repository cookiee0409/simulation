import type { SimulationConfig } from "../core/SimulationConfig";
import type { SimulationState } from "../types";
import { getBuildingHalfSize } from "../city/BuildingFactory";
import { WINTER_BALANCE } from "../scenarios/mountainWinter/winterBalance";

export function updateBodyTemperatures(
  state: SimulationState,
  config: SimulationConfig,
): void {
  const runtime = state.scenario;
  if (!runtime || runtime.phase === "ended") {
    return;
  }
  for (const citizen of state.citizens) {
    const shelter = findShelter(citizen, state);
    const isIndoor =
      shelter !== undefined &&
      isAtShelter(citizen, shelter, config) &&
      (citizen.goal === "rest" ||
        citizen.goal === "return_home" ||
        citizen.goal === "heat_home" ||
        citizen.actionState === "performing" ||
        citizen.actionState === "waiting");
    const ambient = isIndoor
      ? shelter.winter.indoorTemperature
      : runtime.apparentTemperature;
    const vulnerability =
      ageVulnerability(citizen.age) +
      citizen.hunger / 250 +
      citizen.fatigue / 300 +
      citizen.winter.illness / 250 +
      citizen.winter.wetness / 160 -
      citizen.winter.clothingWarmth / 160;
    const targetTemperature = isIndoor
      ? 36.7 + Math.max(-2.5, (ambient - 12) * 0.055)
      : 36.6 + Math.max(-6, (ambient - 8) * 0.075);
    const rate = isIndoor
      ? WINTER_BALANCE.indoorRecoveryPerTick
      : WINTER_BALANCE.outdoorColdExposurePerTick *
        (1 + runtime.outdoorRisk + vulnerability);
    citizen.winter.bodyTemperature +=
      (targetTemperature - citizen.winter.bodyTemperature) * rate;
    citizen.winter.bodyTemperature = clamp(
      citizen.winter.bodyTemperature,
      29,
      37.2,
    );
    const cold = Math.max(0, 36.2 - citizen.winter.bodyTemperature);
    citizen.winter.coldExposure = clamp(
      citizen.winter.coldExposure +
        (isIndoor ? -0.5 : cold * (0.35 + runtime.outdoorRisk)),
      0,
      100,
    );
    citizen.winter.frostbiteRisk = clamp(
      cold * 18 +
        citizen.winter.coldExposure * 0.45 -
        citizen.winter.clothingWarmth * 0.25,
      0,
      100,
    );
    citizen.winter.warmth = clamp(
      100 -
        cold * 20 +
        citizen.winter.clothingWarmth * 0.35 +
        (isIndoor ? shelter.winter.coldProtection * 0.35 : 0),
      0,
      100,
    );
    if (citizen.winter.bodyTemperature < 34.5) {
      citizen.canWork = false;
    } else if (
      citizen.health > config.canWorkHealthThreshold &&
      citizen.age >= config.childMaturityYears
    ) {
      citizen.canWork = true;
    }
  }
}

function findShelter(
  citizen: SimulationState["citizens"][number],
  state: SimulationState,
) {
  if (citizen.targetId) {
    const target = state.buildings.find(
      (building) => building.id === citizen.targetId,
    );
    if (target?.type === "house" || target?.type === "warehouse") {
      return target;
    }
  }
  return state.buildings.find((building) => building.id === citizen.homeId);
}

function isAtShelter(
  citizen: SimulationState["citizens"][number],
  shelter: SimulationState["buildings"][number],
  config: SimulationConfig,
): boolean {
  const half = getBuildingHalfSize(shelter.type, config.gridSize);
  const insideBuilding =
    Math.abs(citizen.position.x - shelter.position.x) <= half.x + config.gridSize &&
    Math.abs(citizen.position.y - shelter.position.y) <= half.y + config.gridSize;
  const nearEntrance =
    Math.abs(citizen.position.x - shelter.entrance.x) <= config.gridSize &&
    Math.abs(citizen.position.y - shelter.entrance.y) <= config.gridSize;
  return insideBuilding || nearEntrance;
}

function ageVulnerability(age: number): number {
  if (age < 15) return 0.35;
  if (age >= 65) return 0.45;
  if (age >= 55) return 0.18;
  return 0;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
