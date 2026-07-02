import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import {
  recordHouseholdLoss,
  recordMemory,
} from "../life/LifeStorySystem";
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
  day = 0,
): void {
  ageCitizens(state, config, day);
  applyOldAgeDeaths(state, config, random, day);
  applyBirths(state, config, random, day);
}

function ageCitizens(
  state: SimulationState,
  config: SimulationConfig,
  day: number,
): void {
  for (const citizen of state.citizens) {
    const before = citizen.age;
    citizen.age += config.agingYearsPerDay;
    if (
      before < config.childMaturityYears &&
      citizen.age >= config.childMaturityYears
    ) {
      recordMemory(
        citizen,
        day,
        "coming_of_age",
        `성년이 되었다 — 꿈은 ${citizen.aspiration.label}`,
        "good",
      );
    }
  }
}

function applyOldAgeDeaths(
  state: SimulationState,
  config: SimulationConfig,
  random: SeededRandom,
  day: number,
): void {
  const survivors: Citizen[] = [];
  for (const citizen of state.citizens) {
    const overAge = citizen.age - config.maxAgeYears;
    if (overAge > 0) {
      const chance =
        config.oldAgeDeathChancePerDay * (1 + overAge / 10);
      if (random.chance(chance)) {
        state.dailyMetrics.deaths += 1;
        recordHouseholdLoss(state, citizen, day, "death");
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
  day: number,
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
    const child = createChild(
      state.nextCitizenSerial,
      config,
      random,
      home,
      day,
    );
    state.citizens.push(child);
    state.nextCitizenSerial += 1;
    state.dailyMetrics.births += 1;
    // 같은 집 식구들에게 아기의 탄생을 기억으로 남긴다.
    for (const housemate of state.citizens) {
      if (
        housemate.id !== child.id &&
        housemate.homeId &&
        housemate.homeId === child.homeId
      ) {
        recordMemory(
          housemate,
          day,
          "family_birth",
          `집에 아기 ${child.name}이(가) 태어났다`,
          "good",
        );
      }
    }
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
