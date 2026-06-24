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
          (sum, citizen) =>
            sum +
            Math.max(
              config.farmerHealthProductivityFloor,
              citizen.health / 100,
            ),
          0,
        ) / farmers.length;

  // 농장이 실제 생산을 좌우한다: 농장 총정원을 넘는 농부는 생산에 기여하지 못한다.
  const totalFarmCapacity = state.buildings
    .filter((building) => building.type === "farm")
    .reduce((sum, building) => sum + building.capacity, 0);
  const productiveFarmers = Math.min(farmers.length, totalFarmCapacity);

  // 매일 ±dailyProductionNoise 비율의 확률 요동(시드 기반, 음수는 0으로 보정).
  const noiseFactor = Math.max(
    0,
    1 + random.between(-config.dailyProductionNoise, config.dailyProductionNoise),
  );
  const produced =
    productiveFarmers *
    config.foodPerFarmerPerDay *
    productivityFactor *
    noiseFactor;
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
    citizen.job === "farmer"
      ? config.happinessEmployedBonus
      : config.happinessUnemployedPenalty;
  citizen.happiness = clamp(
    config.happinessBase +
      foodEffect +
      healthEffect +
      employmentEffect -
      hungerPenalty,
    0,
    100,
  );
  citizen.canWork = citizen.health > config.canWorkHealthThreshold;
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
