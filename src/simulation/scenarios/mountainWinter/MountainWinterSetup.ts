import type { SimulationConfig } from "../../core/SimulationConfig";
import type { SeededRandom } from "../../core/SeededRandom";
import type { Citizen, CitizenJob, SimulationState } from "../../types";
import type { ScenarioDefinition } from "../ScenarioDefinition";
import { createBuilding } from "../../city/BuildingFactory";

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
    movementCellsPerTick: 2,
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
  const jobPlan = assignWinterJobs(citizens.length);
  for (let index = 0; index < citizens.length; index += 1) {
    const citizen = citizens[index]!;
    citizen.age = scenarioAge(index, citizens.length, definition, random);
    citizen.job = jobPlan[index] ?? "settler";
    boostJobSkills(citizen);
    citizen.specialty = dominantSkill(citizen.skills);
    citizen.winter.clothingWarmth += index < clothingCount ? 25 : 0;
    citizen.canWork = citizen.age >= 15 && citizen.age < 68;
    citizen.groupId = citizen.homeId
      ? `household-${citizen.homeId}`
      : `household-${Math.floor(index / 4) + 1}`;
  }

  addWinterWorkshops(state, random);
}

/**
 * 작업 영역 안에 전용 시설을 세운다. 대장간은 도구를, 교역소는 외부 행상과의
 * 교환을 담당한다. 울타리·동선과 겹치지 않도록 영역 내부에 배치한다.
 */
function addWinterWorkshops(
  state: SimulationState,
  random: SeededRandom,
): void {
  const work = state.layout?.zones.find((zone) => zone.type === "work");
  if (!work) {
    return;
  }
  const at = (fx: number, fy: number) => ({
    x: Math.round((work.rect.x + work.rect.width * fx) / 20) * 20,
    y: Math.round((work.rect.y + work.rect.height * fy) / 20) * 20,
  });
  const specs: Array<{ type: "blacksmith" | "market"; pos: { x: number; y: number } }> = [
    { type: "blacksmith", pos: at(0.32, 0.62) },
    { type: "market", pos: at(0.68, 0.62) },
  ];
  for (const spec of specs) {
    if (state.buildings.some((b) => b.type === spec.type)) {
      continue;
    }
    state.buildings.push(
      createBuilding(spec.type, 0, 3, random, undefined, 100, spec.pos),
    );
  }
  state.mapRevision += 1;
}

function dominantSkill(skills: Citizen["skills"]): Citizen["specialty"] {
  return (Object.keys(skills) as Array<keyof Citizen["skills"]>).sort(
    (left, right) => skills[right] - skills[left] || left.localeCompare(right),
  )[0]!;
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

/**
 * 인구 규모와 무관하게 모든 직업이 등장하도록 비율 기반으로 배정한다(소규모 설정 호환).
 * 생존에 직접 기여하는 농부·벌목꾼·목수를 우선하고, 대장장이(도구·수리)·상인(결속)도 포함한다.
 */
function assignWinterJobs(count: number): CitizenJob[] {
  const order: CitizenJob[] = [];
  const push = (job: CitizenJob, ratio: number, min: number) => {
    const n = Math.max(min, Math.round(count * ratio));
    for (let i = 0; i < n; i += 1) order.push(job);
  };
  push("farmer", 0.34, 1);
  push("lumberjack", 0.2, 1);
  push("carpenter", 0.12, 1);
  push("blacksmith", 0.08, count >= 8 ? 1 : 0);
  push("merchant", 0.08, count >= 10 ? 1 : 0);
  while (order.length < count) order.push("settler");
  return order.slice(0, count);
}

function boostJobSkills(citizen: Citizen): void {
  if (citizen.job === "farmer") {
    citizen.skills.farming = Math.max(citizen.skills.farming, 68);
  } else if (citizen.job === "lumberjack") {
    citizen.skills.logging = Math.max(citizen.skills.logging, 68);
  } else if (citizen.job === "carpenter") {
    citizen.skills.construction = Math.max(citizen.skills.construction, 72);
  } else if (citizen.job === "blacksmith") {
    // 대장장이: 도구·연장을 다뤄 수리·건축과 벌목에 강하다.
    citizen.skills.construction = Math.max(citizen.skills.construction, 64);
    citizen.skills.logging = Math.max(citizen.skills.logging, 52);
  } else if (citizen.job === "merchant") {
    // 상인: 교섭·통솔로 마을 결속을 돕는다(이주 억제·사기).
    citizen.skills.negotiation = Math.max(citizen.skills.negotiation, 68);
    citizen.skills.leadership = Math.max(citizen.skills.leadership, 58);
  }
  if (citizen.traits.empathy >= 65) {
    citizen.skills.medicine = Math.max(citizen.skills.medicine, 45);
  }
}
