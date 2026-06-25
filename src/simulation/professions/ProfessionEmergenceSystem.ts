import type { SimulationConfig } from "../core/SimulationConfig";
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
};

/**
 * 수요·자원·노동력을 종합해 각 직업의 "기회 점수"를 계산하고, 임계값을 일정 기간
 * 초과한 직업에 한해 정착민 한 명을 전직시킨다. 인구 수만으로 직업을 열지 않는다.
 */
export function updateProfessionEmergence(
  state: SimulationState,
  config: SimulationConfig,
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
  applyEmergence(state, config, opportunities);
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

  const hasWorkplace = def.requiredBuildingTypes.every((type) =>
    state.buildings.some(
      (b) => b.type === type && b.constructionProgress >= 100,
    ),
  );
  add("작업장 보유", hasWorkplace ? 12 : -30);

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
    const foodSecure =
      farmers > 0 &&
      foodUrgency < 25 &&
      state.resources.food > demand * 3;
    if (!foodSecure) add("식량 미확보", -80);
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
): void {
  const ready = opportunities
    .filter(
      (o) =>
        o.score >= config.opportunityThreshold &&
        o.sustainedDays >= config.emergenceSustainedDays &&
        o.eligibleCitizenIds.length > 0,
    )
    .sort((a, b) => b.score - a.score || a.profession.localeCompare(b.profession));

  let emerged = 0;
  for (const opportunity of ready) {
    if (emerged >= config.maxEmergencePerDay) break;
    const def = PROFESSION_DEFINITIONS.find(
      (d) => d.id === opportunity.profession,
    )!;
    const candidate = pickCandidate(state, config, def);
    if (!candidate) continue;
    candidate.job = def.id;
    candidate.action = "working";
    opportunity.sustainedDays = 0;
    emerged += 1;
  }
}

function eligibleSettlers(
  state: SimulationState,
  config: SimulationConfig,
  _def: ProfessionDefinition,
): Citizen[] {
  return state.citizens.filter(
    (c) =>
      c.job === "settler" &&
      c.canWork &&
      c.age >= config.childMaturityYears,
  );
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
