import type { SimulationConfig } from "../core/SimulationConfig";
import type {
  SimulationState,
  WinterNeedState,
} from "../types";
import { insulationFirewoodDemand } from "./HeatingSystem";

export function updateWinterNeeds(
  state: SimulationState,
  config: SimulationConfig,
): WinterNeedState[] {
  const runtime = state.scenario;
  if (!runtime) {
    state.winterNeeds = [];
    return [];
  }
  const remainingWinterDays = Math.max(
    1,
    runtime.durationDays - runtime.currentDay,
  );
  const shelters = state.buildings.filter(
    (building) =>
      (building.type === "house" || building.type === "warehouse") &&
      building.constructionProgress >= 100,
  );
  const projectedFirewood = shelters.reduce(
    (sum, building) =>
      sum +
      insulationFirewoodDemand(
        building.winter.insulation,
        runtime.expectedMinimumTemperature,
      ) *
        remainingWinterDays,
    0,
  );
  const dailyFood = Math.max(
    0.1,
    state.citizens.length * config.foodPerCitizenPerDay,
  );
  const vulnerable = state.citizens.filter(
    (citizen) =>
      citizen.age < 15 ||
      citizen.age >= 60 ||
      citizen.winter.illness >= 35 ||
      citizen.health < 55,
  ).length;
  const worstCondition = shelters.reduce(
    (minimum, building) =>
      Math.min(minimum, building.winter.structuralCondition),
    100,
  );
  const worstInsulation = shelters.reduce(
    (minimum, building) => Math.min(minimum, building.winter.insulation),
    100,
  );
  const outlook =
    runtime.foodSecurityDays + runtime.firewoodSecurityDays;

  state.winterNeeds = [
    need(
      "warmth",
      clamp(
        -runtime.apparentTemperature * 2 +
          vulnerable * 2.5 -
          runtime.villageHeatSecurity * 0.35,
        0,
        100,
      ),
      runtime.villageHeatSecurity,
      100,
      "낮은 체감 온도",
    ),
    need(
      "firewood",
      clamp((1 - state.resources.firewood / Math.max(1, projectedFirewood)) * 100, 0, 100),
      state.resources.firewood,
      projectedFirewood,
      "남은 혹한기 난방 수요",
    ),
    need(
      "winter_food",
      clamp((1 - state.resources.food / (dailyFood * remainingWinterDays)) * 100, 0, 100),
      state.resources.food,
      dailyFood * remainingWinterDays,
      "겨울 식량 전망",
    ),
    need(
      "shelter_repair",
      clamp(100 - worstCondition, 0, 100),
      worstCondition,
      100,
      "주택 구조 상태",
    ),
    need(
      "insulation",
      clamp(100 - worstInsulation, 0, 100),
      worstInsulation,
      100,
      "주택 단열 상태",
    ),
    need(
      "medicine",
      clamp(vulnerable * 5 - state.resources.medicine * 4, 0, 100),
      state.resources.medicine,
      vulnerable,
      "취약 주민과 환자",
    ),
    need(
      "migration",
      clamp(
        (18 - outlook) * 3 +
          Math.max(0, -runtime.apparentTemperature) * 0.8,
        0,
        100,
      ),
      outlook,
      18,
      "식량·땔감 생존 전망",
    ),
  ];
  return state.winterNeeds;
}

function need(
  type: WinterNeedState["type"],
  urgency: number,
  currentSupply: number,
  projectedDemand: number,
  factor: string,
): WinterNeedState {
  return {
    type,
    urgency: round(urgency),
    currentSupply: round(currentSupply),
    projectedDemand: round(projectedDemand),
    reasons: [{ factor, score: round(urgency) }],
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
