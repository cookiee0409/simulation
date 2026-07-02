import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import { requestBuilding } from "../city/BuildingConstruction";
import { recordMemory } from "../life/LifeStorySystem";
import type {
  Citizen,
  ProfessionOpportunity,
  ProfessionOpportunityReason,
  SimulationState,
  VillageTaskType,
} from "../types";
import {
  PROFESSION_DEFINITIONS,
  type ProfessionDefinition,
} from "./professionDefinitions";

/** 직업별 관련 작업 종류(대기 작업량 평가용). */
const RELATED_TASK_TYPES: Record<string, VillageTaskType[]> = {
  farmer: ["farm_work"],
  lumberjack: ["gather_wood"],
  miner: ["gather_stone"],
  carpenter: ["build", "carpentry_work"],
  blacksmith: ["blacksmith_work"],
  merchant: ["market_work"],
};

/**
 * 수요·자원·노동력을 종합해 각 직업의 "기회 점수"를 계산하고, 임계값을 일정 기간
 * 초과한 직업에 한해 정착민 한 명을 전직시킨다. 인구 수만으로 직업을 열지 않는다.
 */
export function updateProfessionEmergence(
  state: SimulationState,
  config: SimulationConfig,
  random: SeededRandom,
  day = 0,
): ProfessionOpportunity[] {
  const previous = new Map(
    state.opportunities.map((o) => [o.profession, o.sustainedDays]),
  );
  const opportunities = PROFESSION_DEFINITIONS.map((def) =>
    scoreProfession(def, state, config, previous.get(def.id) ?? 0),
  );

  // 정규화(패널 표시용 0~1).
  const maxScore = Math.max(1, ...opportunities.map((o) => o.score));
  for (const opportunity of opportunities) {
    opportunity.normalizedScore =
      Math.round((Math.max(0, opportunity.score) / maxScore) * 100) / 100;
  }

  state.opportunities = opportunities;
  applyEmergence(state, config, opportunities, random, day);
  return opportunities;
}

function scoreProfession(
  def: ProfessionDefinition,
  state: SimulationState,
  config: SimulationConfig,
  priorSustainedDays: number,
): ProfessionOpportunity {
  const reasons: ProfessionOpportunityReason[] = [];
  const add = (factor: string, score: number) => {
    if (score !== 0) reasons.push({ factor, score: round(score) });
  };

  const related = state.needs.filter((need) =>
    def.relatedNeeds.includes(need.type),
  );
  const urgency = related.reduce((max, n) => Math.max(max, n.urgency), 0);
  add("미충족 수요", urgency);

  const backlog = countRelatedTaskBacklog(state, def);
  add("관련 작업 대기", Math.min(25, backlog * 4));

  // 목수는 건설 속도를 높이는 가치 직업 → 진행 중인 건설이 있으면 기회가 커진다.
  if (def.id === "carpenter") {
    const sites = state.buildings.filter(
      (b) => b.constructionProgress < 100,
    ).length;
    add("건설 진행 중", Math.min(45, sites * 22));
  }

  // 선행 직업이 없으면 아직 분화하지 않는다(예: 목수는 벌목꾼 이후).
  const prereqMissing = def.requiredProfessions.some(
    (req) => !state.citizens.some((c) => c.job === req),
  );
  if (prereqMissing) add("선행 직업 부재", -70);

  const hasWorkplace = def.requiredBuildingTypes.every((type) =>
    state.buildings.some(
      (b) => b.type === type && b.constructionProgress >= 100,
    ),
  );
  if (hasWorkplace) {
    add("작업장 보유", 12);
  } else if (def.targetBuildingType) {
    add("작업장 신설 필요", -8); // 창발 시 새로 짓는다
  } else {
    add("작업장 없음", -30);
  }

  const population = state.citizens.length;
  const current = state.citizens.filter((c) => c.job === def.id).length;
  const overRatio = current >= def.maxPopulationRatio * population;
  add("직업 과잉", overRatio ? -40 : 0);

  const ableSettlers = eligibleSettlers(state, config, def).length;
  add("여유 노동력", ableSettlers === 0 ? -50 : Math.min(8, ableSettlers));

  // 식량이 안정되기 전에는 식량 외 직업으로의 전직을 강하게 억제한다.
  // (먼저 농업으로 식량을 확보한 뒤에야 전문 직업이 분화한다.)
  const foodUrgency =
    state.needs.find((n) => n.type === "food")?.urgency ?? 0;
  if (!def.relatedNeeds.includes("food")) {
    const farmers = state.citizens.filter((c) => c.job === "farmer").length;
    const demand = state.citizens.length * config.foodPerCitizenPerDay;
    const spareSettlers = state.citizens.filter(
      (c) =>
        c.job === "settler" &&
        c.canWork &&
        c.age >= config.childMaturityYears,
    ).length;
    // 식량이 확보되고, 채집을 이어갈 여유 노동력이 남을 때만 전문 직업이 분화한다.
    const isBaseResourceJob = def.id === "lumberjack" || def.id === "miner";
    const foodSecure = isBaseResourceJob
      ? farmers > 0 &&
        foodUrgency < 60 &&
        state.resources.food > demand * 1.5 &&
        spareSettlers >= config.minForagersReserve
      : farmers >= Math.max(2, Math.ceil(state.citizens.length / 8)) &&
        foodUrgency < 25 &&
        state.resources.food > demand * 6 &&
        spareSettlers >= config.minForagersReserve + 1;
    if (!foodSecure) add("여유 노동력/식량 부족", -80);
  }

  const score = reasons.reduce((sum, r) => sum + r.score, 0);
  const eligibleIds = eligibleSettlers(state, config, def).map((c) => c.id);
  const sustainedDays =
    score >= config.opportunityThreshold ? priorSustainedDays + 1 : 0;

  return {
    profession: def.id,
    score: round(score),
    normalizedScore: 0,
    relatedNeeds: def.relatedNeeds,
    reasons,
    sustainedDays,
    eligibleCitizenIds: eligibleIds,
  };
}

function applyEmergence(
  state: SimulationState,
  config: SimulationConfig,
  opportunities: ProfessionOpportunity[],
  random: SeededRandom,
  day: number,
): void {
  const isFood = (profession: string) =>
    PROFESSION_DEFINITIONS.find((d) => d.id === profession)?.relatedNeeds.includes(
      "food",
    ) ?? false;

  const ready = opportunities
    .filter((o) => {
      // 식량 직업(농부)은 생존에 직결되므로 더 빠르게, 더 많이 창발할 수 있다.
      const required = isFood(o.profession)
        ? Math.max(1, config.emergenceSustainedDays - 2)
        : config.emergenceSustainedDays;
      return (
        o.score >= config.opportunityThreshold &&
        o.sustainedDays >= required &&
        o.eligibleCitizenIds.length > 0
      );
    })
    .sort((a, b) => b.score - a.score || a.profession.localeCompare(b.profession));

  let emergedNonFood = 0;
  let emergedFood = 0;
  for (const opportunity of ready) {
    const food = isFood(opportunity.profession);
    if (food && emergedFood >= config.maxFoodEmergencePerDay) continue;
    if (!food && emergedNonFood >= config.maxEmergencePerDay) continue;
    const def = PROFESSION_DEFINITIONS.find(
      (d) => d.id === opportunity.profession,
    )!;
    // 인구 대비 상한을 하드 캡으로 강제(특정 직업이 마을을 잠식하는 것 방지).
    const current = state.citizens.filter((c) => c.job === def.id).length;
    if (current >= Math.ceil(def.maxPopulationRatio * state.citizens.length)) {
      continue;
    }
    const candidate = pickCandidate(state, config, def);
    if (!candidate) continue;

    // 작업장이 필요한 직업은 창발과 함께 작업장 신설을 요청한다.
    if (
      def.targetBuildingType &&
      !state.buildings.some((b) => b.type === def.targetBuildingType)
    ) {
      const placed = requestBuilding(
        state,
        config,
        def.targetBuildingType,
        random,
      );
      if (!placed) continue; // 자재·공간이 없으면 이번엔 보류
    }

    candidate.job = def.id;
    candidate.action = "working";
    recordMemory(
      candidate,
      day,
      "job_change",
      `마을에 ${def.label}의 일이 생겨 ${def.label}가 되었다`,
      "good",
    );
    opportunity.sustainedDays = 0;
    if (food) emergedFood += 1;
    else emergedNonFood += 1;
  }
}

function eligibleSettlers(
  state: SimulationState,
  config: SimulationConfig,
  def: ProfessionDefinition,
): Citizen[] {
  const adults = state.citizens.filter(
    (c) => c.canWork && c.age >= config.childMaturityYears,
  );
  const settlers = adults.filter((c) => c.job === "settler");
  // 식량 위기 시에는 비식량 직업(벌목꾼·채석공)이 농사로 복귀할 수 있다.
  const foodUrgency =
    state.needs.find((n) => n.type === "food")?.urgency ?? 0;
  if (def.relatedNeeds.includes("food") && foodUrgency > 55) {
    const reverters = adults.filter(
      (c) => c.job === "lumberjack" || c.job === "miner",
    );
    return [...settlers, ...reverters];
  }
  return settlers;
}

function pickCandidate(
  state: SimulationState,
  config: SimulationConfig,
  def: ProfessionDefinition,
): Citizen | undefined {
  // 적성이 높은 정착민을 결정적으로 선택(동점은 id).
  return eligibleSettlers(state, config, def).sort(
    (a, b) =>
      b.traits[def.aptitudeTrait] - a.traits[def.aptitudeTrait] ||
      a.id.localeCompare(b.id),
  )[0];
}

function countRelatedTaskBacklog(
  state: SimulationState,
  def: ProfessionDefinition,
): number {
  const types = RELATED_TASK_TYPES[def.id] ?? [];
  return state.tasks
    .filter((task) => types.includes(task.type))
    .reduce(
      (sum, task) =>
        sum + Math.max(0, task.capacity - task.assignedCitizenIds.length),
      0,
    );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
