import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import type { Citizen, SimulationState } from "../types";

export interface FoodDayResult {
  produced: number;
  consumed: number;
  unmetDemand: number;
  populationLost: number;
}

/**
 * 틱 시스템이 기록한 실제 생산·식사량을 하루 단위 건강/행복/이탈 효과로 정산한다.
 * 생산과 소비 자체는 AgentExecutionSystem에서만 일어나므로 자원 중복 생성이 없다.
 */
export function processFoodDay(
  state: SimulationState,
  config: SimulationConfig,
  random: SeededRandom,
): FoodDayResult {
  const required = state.citizens.length * config.foodPerCitizenPerDay;
  const consumed = state.dailyMetrics.foodConsumed;
  const satisfaction = required === 0 ? 1 : Math.min(1, consumed / required);

  for (const citizen of state.citizens) {
    updateCitizenWellbeing(citizen, satisfaction, config);
  }

  const survivors: Citizen[] = [];
  let populationLost = 0;
  for (const citizen of state.citizens) {
    if (shouldLeaveFromHunger(citizen, config, random)) {
      citizen.action = "leaving";
      populationLost += 1;
    } else {
      survivors.push(citizen);
    }
  }
  state.citizens = survivors;
  state.dailyMetrics.populationLost += populationLost;

  return {
    produced: state.dailyMetrics.foodProduced,
    consumed,
    unmetDemand: Math.max(0, required - consumed),
    populationLost: state.dailyMetrics.populationLost,
  };
}

export function synchronizeVillageFood(state: SimulationState): void {
  state.resources.food = state.buildings
    .filter(
      (building) =>
        building.type === "warehouse" &&
        building.constructionProgress >= 100,
    )
    .reduce((sum, building) => sum + (building.inventory.food ?? 0), 0);
}

function updateCitizenWellbeing(
  citizen: Citizen,
  foodSatisfaction: number,
  config: SimulationConfig,
): void {
  if (citizen.hunger > config.hungerHealthThreshold) {
    citizen.health = Math.max(
      0,
      citizen.health -
        (citizen.hunger - config.hungerHealthThreshold) *
          config.healthLossPerHungerOverThreshold,
    );
  } else {
    citizen.health = Math.min(100, citizen.health + config.healthRecoveryPerDay);
  }

  const foodEffect = foodSatisfaction * config.happinessFoodWeight;
  const hungerPenalty = citizen.hunger * config.happinessHungerPenaltyWeight;
  const healthEffect = citizen.health * config.happinessHealthWeight;
  const employmentEffect =
    citizen.job === "unemployed"
      ? config.happinessUnemployedPenalty
      : config.happinessEmployedBonus;
  citizen.happiness = clamp(
    config.happinessBase +
      foodEffect +
      healthEffect +
      employmentEffect -
      hungerPenalty,
    0,
    100,
  );
  citizen.canWork =
    citizen.health > config.canWorkHealthThreshold &&
    citizen.age >= config.childMaturityYears;
}

function shouldLeaveFromHunger(
  citizen: Citizen,
  config: SimulationConfig,
  random: SeededRandom,
): boolean {
  if (citizen.health <= 0) {
    return true;
  }
  if (citizen.hunger < config.severeHungerThreshold) {
    return false;
  }
  const severity =
    (citizen.hunger - config.severeHungerThreshold) /
    Math.max(1, 100 - config.severeHungerThreshold);
  return random.chance(
    config.baseSevereHungerExitChance + severity * 0.16,
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
