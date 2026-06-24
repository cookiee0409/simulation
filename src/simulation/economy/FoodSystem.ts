import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import type { Citizen, SimulationState } from "../types";

export interface FoodDayResult {
  produced: number;
  consumed: number;
  unmetDemand: number;
  populationLost: number;
}

export function processFoodDay(
  state: SimulationState,
  config: SimulationConfig,
  random: SeededRandom,
): FoodDayResult {
  const farmers = state.citizens.filter(
    (citizen) => citizen.job === "farmer" && citizen.canWork,
  );
  const productivityFactor =
    farmers.length === 0
      ? 0
      : farmers.reduce(
          (sum, citizen) => sum + Math.max(0.35, citizen.health / 100),
          0,
        ) / farmers.length;
  const produced =
    farmers.length * config.foodPerFarmerPerDay * productivityFactor;
  const storageCapacity = state.buildings
    .filter((building) => building.type === "warehouse")
    .reduce((sum, building) => sum + building.capacity, 0);

  state.resources.food = Math.min(
    storageCapacity,
    state.resources.food + produced,
  );

  const required =
    state.citizens.length * config.foodPerCitizenPerDay;
  const consumed = Math.min(required, state.resources.food);
  const satisfaction = required === 0 ? 1 : consumed / required;
  state.resources.food = Math.max(0, state.resources.food - consumed);

  for (const citizen of state.citizens) {
    updateCitizenNeeds(citizen, satisfaction, config);
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

  return {
    produced,
    consumed,
    unmetDemand: Math.max(0, required - consumed),
    populationLost,
  };
}

function updateCitizenNeeds(
  citizen: Citizen,
  foodSatisfaction: number,
  config: SimulationConfig,
): void {
  if (foodSatisfaction >= 0.999) {
    citizen.hunger = Math.max(0, citizen.hunger - config.hungerRecoveryPerDay);
    citizen.action = citizen.job === "farmer" ? "working" : "eating";
  } else {
    citizen.hunger = Math.min(
      100,
      citizen.hunger +
        (1 - foodSatisfaction) * config.hungerGainAtZeroFood,
    );
    citizen.action = "idle";
  }

  if (citizen.hunger > 55) {
    citizen.health = Math.max(0, citizen.health - (citizen.hunger - 55) * 0.08);
  } else {
    citizen.health = Math.min(100, citizen.health + 0.25);
  }

  const foodEffect = foodSatisfaction * 34;
  const hungerPenalty = citizen.hunger * 0.48;
  const healthEffect = citizen.health * 0.2;
  const employmentEffect = citizen.job === "farmer" ? 7 : -4;
  citizen.happiness = clamp(
    28 + foodEffect + healthEffect + employmentEffect - hungerPenalty,
    0,
    100,
  );
  citizen.canWork = citizen.health > 25;
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
