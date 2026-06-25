import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import type { Building, Citizen, SimulationState } from "../types";
import { createChild } from "./PopulationFactory";

/**
 * 마을 인구를 자라게 하는 핵심 시스템. 매일 한 번 실행되어
 * 노화 → 노령 사망 → 출산 순으로 인구를 변화시킨다.
 * 식량 여유와 주택 여유가 있을 때만 아이가 태어나므로, 생산·건설이
 * 인구 성장의 속도를 자연스럽게 제약한다.
 */
export function updatePopulationDynamics(
  state: SimulationState,
  config: SimulationConfig,
  random: SeededRandom,
): void {
  ageCitizens(state, config);
  applyOldAgeDeaths(state, config, random);
  applyBirths(state, config, random);
}

function ageCitizens(state: SimulationState, config: SimulationConfig): void {
  for (const citizen of state.citizens) {
    citizen.age += config.agingYearsPerDay;
  }
}

function applyOldAgeDeaths(
  state: SimulationState,
  config: SimulationConfig,
  random: SeededRandom,
): void {
  const survivors: Citizen[] = [];
  for (const citizen of state.citizens) {
    const overAge = citizen.age - config.maxAgeYears;
    if (overAge > 0) {
      const chance =
        config.oldAgeDeathChancePerDay * (1 + overAge / 10);
      if (random.chance(chance)) {
        state.dailyMetrics.deaths += 1;
        continue;
      }
    }
    survivors.push(citizen);
  }
  state.citizens = survivors;
}

function applyBirths(
  state: SimulationState,
  config: SimulationConfig,
  random: SeededRandom,
): void {
  const population = state.citizens.length;
  if (population === 0) {
    return;
  }

  const fertileAdults = state.citizens.filter(
    (citizen) =>
      citizen.age >= config.fertilityMinAge &&
      citizen.age <= config.fertilityMaxAge &&
      citizen.canWork,
  ).length;
  if (fertileAdults < 2) {
    return;
  }

  const housingCapacity = completedHouses(state).reduce(
    (sum, house) => sum + house.capacity,
    0,
  );
  const freeHousing = housingCapacity - population;
  if (freeHousing <= 0) {
    return;
  }

  const foodPerCapita = state.resources.food / population;
  if (foodPerCapita < config.birthFoodPerCapita) {
    return;
  }

  const slots = Math.min(
    config.maxBirthsPerDay,
    Math.floor(fertileAdults / 2),
    freeHousing,
  );
  for (let index = 0; index < slots; index += 1) {
    if (!random.chance(config.birthChancePerDay)) {
      continue;
    }
    // 빈자리가 있는 실제 집이 있어야만 출산한다(아이가 집 입구에서 시작 → 발 묶임 방지).
    const home = findHomeWithRoom(state);
    if (!home) {
      break;
    }
    state.citizens.push(
      createChild(state.nextCitizenSerial, config, random, home),
    );
    state.nextCitizenSerial += 1;
    state.dailyMetrics.births += 1;
  }
}

function completedHouses(state: SimulationState): Building[] {
  return state.buildings.filter(
    (building) =>
      building.type === "house" && building.constructionProgress >= 100,
  );
}

function findHomeWithRoom(state: SimulationState): Building | undefined {
  const occupancy = new Map<string, number>();
  for (const citizen of state.citizens) {
    if (citizen.homeId) {
      occupancy.set(citizen.homeId, (occupancy.get(citizen.homeId) ?? 0) + 1);
    }
  }
  return completedHouses(state)
    .sort((left, right) => left.id.localeCompare(right.id))
    .find((house) => (occupancy.get(house.id) ?? 0) < house.capacity);
}
