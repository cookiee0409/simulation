import type { SimulationConfig } from "../../core/SimulationConfig";
import type { SeededRandom } from "../../core/SeededRandom";
import type { Citizen, SimulationState } from "../../types";
import type { ScenarioDefinition } from "../ScenarioDefinition";

export function scenarioConfigOverrides(
  definition: ScenarioDefinition,
): Partial<SimulationConfig> {
  const count = (type: string) =>
    definition.initialBuildings.find((preset) => preset.type === type)?.count ??
    0;
  return {
    initialPopulation: definition.initialPopulation,
    initialFood: definition.initialResources.food ?? 0,
    initialWood: definition.initialResources.wood ?? 0,
    initialStone: definition.initialResources.stone ?? 0,
    initialHouses: count("house"),
    initialWarehouses: count("warehouse"),
    initialFarms: count("farm"),
    initialLumberyards: count("lumberjack"),
    initialQuarries: count("quarry"),
    founderAgeMin: definition.citizenGeneration.ageMin,
    founderAgeMax: definition.citizenGeneration.ageMax,
    housingGrowthBuffer: 0,
    birthChancePerDay: 0,
  };
}

export function initializeMountainWinterState(
  state: SimulationState,
  definition: ScenarioDefinition,
  random: SeededRandom,
): void {
  state.resources.firewood = definition.initialResources.firewood ?? 0;
  state.resources.medicine = definition.initialResources.medicine ?? 0;
  state.resources.warm_clothing =
    definition.initialResources.warm_clothing ?? 0;
  const clothingCount = Math.floor(state.resources.warm_clothing);

  const citizens = [...state.citizens].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  for (let index = 0; index < citizens.length; index += 1) {
    const citizen = citizens[index]!;
    citizen.age = scenarioAge(index, citizens.length, definition, random);
    citizen.job =
      index < 7
        ? "farmer"
        : index < 12
          ? "lumberjack"
          : index < 15
            ? "carpenter"
            : "settler";
    boostJobSkills(citizen);
    citizen.winter.clothingWarmth += index < clothingCount ? 25 : 0;
    citizen.canWork = citizen.age >= 15 && citizen.age < 68;
    citizen.groupId = citizen.homeId
      ? `household-${citizen.homeId}`
      : `household-${Math.floor(index / 4) + 1}`;
  }
}

function scenarioAge(
  index: number,
  count: number,
  definition: ScenarioDefinition,
  random: SeededRandom,
): number {
  const childCount = Math.round(
    count * definition.citizenGeneration.childRatio,
  );
  const elderCount = Math.round(
    count * definition.citizenGeneration.elderRatio,
  );
  if (index < childCount) {
    return random.integer(8, 14);
  }
  if (index >= count - elderCount) {
    return random.integer(61, 72);
  }
  return random.integer(18, 58);
}

function boostJobSkills(citizen: Citizen): void {
  if (citizen.job === "farmer") {
    citizen.skills.farming = Math.max(citizen.skills.farming, 68);
  } else if (citizen.job === "lumberjack") {
    citizen.skills.logging = Math.max(citizen.skills.logging, 68);
  } else if (citizen.job === "carpenter") {
    citizen.skills.construction = Math.max(
      citizen.skills.construction,
      72,
    );
  }
  if (citizen.traits.empathy >= 65) {
    citizen.skills.medicine = Math.max(citizen.skills.medicine, 45);
  }
}
