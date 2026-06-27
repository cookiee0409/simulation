import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import { distance, type AgentPerception } from "./AgentPerceptionSystem";
import type {
  Building,
  Citizen,
  CitizenDecisionReason,
  CitizenGoal,
  SimulationState,
  VillageTask,
} from "../types";
import { TaskBoardSystem } from "../tasks/TaskBoardSystem";

interface DecisionCandidate {
  goal: CitizenGoal;
  task?: VillageTask;
  score: number;
  reasons: CitizenDecisionReason[];
}

export class AgentDecisionSystem {
  constructor(private readonly taskBoard: TaskBoardSystem) {}

  updateCitizen(
    citizen: Citizen,
    perception: AgentPerception,
    state: SimulationState,
    config: SimulationConfig,
    random: SeededRandom,
  ): void {
    if (!this.shouldReconsider(citizen, state, config)) {
      return;
    }
    this.decideCitizen(citizen, perception, state, config, random);
  }

  shouldReconsider(
    citizen: Citizen,
    state: SimulationState,
    config: SimulationConfig,
  ): boolean {
    citizen.decisionCooldown = Math.max(0, citizen.decisionCooldown - 1);
    const taskExists =
      !citizen.taskId ||
      state.tasks.some((task) => task.id === citizen.taskId);
    if (!taskExists) {
      citizen.actionState = "failed";
    }

    const emergency =
      citizen.hunger >= config.emergencyHungerThreshold &&
      citizen.goal !== "eat";
    const coldEmergency =
      state.scenario !== undefined &&
      (citizen.winter.bodyTemperature < 35.8 ||
        citizen.winter.coldExposure >= 45 ||
        (citizen.age < config.childMaturityYears &&
          state.scenario.phase === "winter")) &&
      citizen.goal !== "rest" &&
      citizen.goal !== "return_home" &&
      citizen.goal !== "eat";
    const shouldDecide =
      emergency ||
      coldEmergency ||
      citizen.actionState === "completed" ||
      citizen.actionState === "failed" ||
      citizen.actionState === "deciding" ||
      (citizen.decisionCooldown === 0 &&
        citizen.actionState !== "performing" &&
        citizen.actionState !== "moving" &&
        citizen.actionState !== "waiting");
    return shouldDecide;
  }

  decideCitizen(
    citizen: Citizen,
    perception: AgentPerception,
    state: SimulationState,
    config: SimulationConfig,
    random: SeededRandom,
  ): void {
    this.taskBoard.unassignCitizen(state, citizen);
    const decision = chooseGoal(citizen, perception, config, random);
    if (decision.task) {
      const liveTask = state.tasks.find((task) => task.id === decision.task!.id);
      if (!liveTask || !this.taskBoard.assignCitizen(liveTask, citizen)) {
        citizen.actionState = "failed";
        citizen.decisionCooldown = 1;
        return;
      }
    }

    citizen.goal = decision.goal;
    citizen.temporaryRole = temporaryRoleFor(decision.goal);
    citizen.targetId = decision.task?.targetId;
    citizen.targetPosition = decision.task
      ? { ...decision.task.targetPosition }
      : undefined;
    if (decision.goal === "forage" && !citizen.targetPosition) {
      const spot = nearestForageSpot(citizen, state);
      citizen.targetId = spot?.id;
      citizen.targetPosition = spot ? { ...spot.entrance } : undefined;
    }
    citizen.path = [];
    citizen.pathIndex = 0;
    citizen.movementBudget = 0;
    citizen.actionProgress = 0;
    citizen.decisionScore = round(decision.score);
    citizen.decisionReasons = decision.reasons.map((reason) => ({ ...reason }));
    citizen.decisionCooldown = config.decisionCooldownTicks;
    citizen.actionState = decision.goal === "seek_work" ? "performing" : "waiting";
    citizen.carryStage =
      decision.goal === "carry_food" ? "to_farm" : undefined;
  }
}

export function chooseGoal(
  citizen: Citizen,
  perception: AgentPerception,
  config: SimulationConfig,
  random: SeededRandom,
): DecisionCandidate {
  const candidates: DecisionCandidate[] = [];
  const tasksByType = (type: VillageTask["type"]) =>
    perception.availableTasks.filter((task) => task.type === type);
  const winterUrgency = (type: string) =>
    perception.winterNeeds?.find((need) => need.type === type)?.urgency ?? 0;

  if (
    citizen.hunger >= config.eatHungerThreshold &&
    citizen.lastMealDay < perception.day
  ) {
    for (const task of tasksByType("eat_food")) {
      const reasons = [
        reason("배고픔", citizen.hunger * 2.4),
        reason("음식 이용 가능", 38),
        reason("거리", -distance(citizen.position, task.targetPosition) * 0.08),
        reason(
          "현재 작업 중단 비용",
          citizen.actionState === "performing" ? -24 : 0,
        ),
      ];
      candidates.push(candidate("eat", task, reasons));
    }
  }

  if (
    citizen.canWork &&
    (citizen.job === "farmer" ||
      (perception.scenario &&
        (citizen.skills.farming >= 55 || winterUrgency("winter_food") >= 62)))
  ) {
    for (const task of tasksByType("farm_work")) {
      const reasons = [
        reason("농부 직업", citizen.job === "farmer" ? 48 : 12),
        reason("농사 기술", citizen.skills.farming * 0.28),
        reason("전문 분야", specialtyBonus(citizen, "farming", 18)),
        reason("마을 식량 부족", perception.foodShortage * 0.7),
        reason("겨울 식량 비축", winterUrgency("winter_food") * 0.86),
        reason("농장 작업 수요", task.priority * 0.42),
        reason("배고픔", -citizen.hunger * 0.72),
        reason("피로", -citizen.fatigue * 0.32),
        reason("거리", -distance(citizen.position, task.targetPosition) * 0.07),
      ];
      candidates.push(candidate("work_farm", task, reasons));
    }
  }

  if (citizen.canWork && citizen.job === "lumberjack") {
    for (const task of tasksByType("gather_wood")) {
      const reasons = [
        reason("벌목공 직업", 46),
        reason("벌목 기술", citizen.skills.logging * 0.22),
        reason("전문 분야", specialtyBonus(citizen, "logging", 16)),
        reason("겨울 땔감 비축", winterUrgency("firewood") * 0.74),
        reason("채집 작업 수요", task.priority * 0.42),
        reason("배고픔", -citizen.hunger * 0.72),
        reason("피로", -citizen.fatigue * 0.32),
        reason("거리", -distance(citizen.position, task.targetPosition) * 0.07),
      ];
      candidates.push(candidate("gather_wood", task, reasons));
    }
  }

  if (perception.scenario && citizen.canWork) {
    for (const task of tasksByType("gather_wood")) {
      if (citizen.job === "lumberjack") {
        continue;
      }
      const reasons = [
        reason("땔감 비축 필요", winterUrgency("firewood") * 0.82),
        reason("벌목 기술", citizen.skills.logging * 0.42),
        reason("전문 분야", specialtyBonus(citizen, "logging", 18)),
        reason("마을 협력 성향", citizen.traits.cooperation * 0.18),
        reason("추위 노출 위험", -perception.scenario.outdoorRisk * 42),
        reason("피로", -citizen.fatigue * 0.32),
      ];
      candidates.push(candidate("gather_wood", task, reasons));
    }
    for (const task of tasksByType("process_firewood")) {
      const reasons = [
        reason("땔감 부족", winterUrgency("firewood") * 0.55),
        reason("벌목 기술", citizen.skills.logging * 0.28),
        reason("전문 분야", specialtyBonus(citizen, "logging", 12)),
        reason("실내 작업 안전성", perception.scenario.outdoorRisk * 24),
        reason("농사 전문성 유지", citizen.job === "farmer" ? -42 : 0),
        reason("피로", -citizen.fatigue * 0.25),
      ];
      candidates.push(candidate("process_firewood", task, reasons));
    }
    for (const task of tasksByType("heat_home")) {
      const reasons = [
        reason("주민 보온 필요", winterUrgency("warmth") * 0.62),
        reason("공감 성향", citizen.traits.empathy * 0.25),
        reason("요리/살림 기술", citizen.skills.cooking * 0.08),
        reason("규칙 준수", citizen.traits.ruleFollowing * 0.12),
        reason("피로", -citizen.fatigue * 0.18),
      ];
      candidates.push(candidate("heat_home", task, reasons));
    }
    for (const task of tasksByType("care_sick")) {
      if (task.targetId === citizen.id) {
        continue;
      }
      if (
        citizen.skills.medicine < 22 &&
        citizen.traits.empathy < 58
      ) {
        continue;
      }
      const reasons = [
        reason("환자 돌봄 필요", winterUrgency("medicine") * 0.45),
        reason("의료 기술", citizen.skills.medicine * 0.55),
        reason("전문 분야", specialtyBonus(citizen, "medicine", 18)),
        reason("공감 성향", citizen.traits.empathy * 0.2),
        reason("이기성", -citizen.traits.selfishness * 0.18),
      ];
      candidates.push(candidate("care_sick", task, reasons));
    }
    for (const task of tasksByType("forge_tools")) {
      const isSmith = citizen.job === "blacksmith";
      const reasons = [
        reason("대장장이 직업", isSmith ? 86 : 8),
        reason("연장·건축 기술", citizen.skills.construction * 0.4),
        reason("준비기 여유", perception.scenario.phase === "preparation" ? 22 : 0),
        reason("피로", -citizen.fatigue * 0.18),
        reason("배고픔", -citizen.hunger * 0.2),
      ];
      candidates.push(candidate("forge_tools", task, reasons));
    }
    for (const task of tasksByType("trade_supplies")) {
      const isMerchant = citizen.job === "merchant";
      const reasons = [
        reason("상인 직업", isMerchant ? 88 : 8),
        reason("교섭 기술", citizen.skills.negotiation * 0.42),
        reason("전문 분야", specialtyBonus(citizen, "negotiation", 16)),
        reason("보급 필요", winterUrgency("winter_food") * 0.22),
        reason("피로", -citizen.fatigue * 0.16),
      ];
      candidates.push(candidate("trade_supplies", task, reasons));
    }
    if (perception.day >= 4) {
      for (const task of tasksByType("migrate")) {
        const migrationIntent = clamp(
          winterUrgency("migration") * 0.55 +
            citizen.traits.riskTolerance * 0.2 +
            citizen.traits.selfishness * 0.22 -
            citizen.traits.attachmentToVillage * 0.55 -
            citizen.traits.patience * 0.12 +
            citizen.winter.illness * 0.45 +
            citizen.winter.coldExposure * 0.25 +
            Math.max(0, 55 - citizen.health) * 0.45,
          0,
          100,
        );
        citizen.winter.migrationIntent = migrationIntent;
        const reasons = [
          reason("생존 전망 악화", winterUrgency("migration") * 0.75),
          reason("개인 이주 의향", migrationIntent * 0.8),
          reason("마을 애착", -citizen.traits.attachmentToVillage * 0.42),
          reason("혹한 이동 위험", -perception.scenario.outdoorRisk * 28),
        ];
        candidates.push(candidate("migrate", task, reasons));
      }
    }
  }

  if (citizen.canWork && citizen.job === "miner") {
    for (const task of tasksByType("gather_stone")) {
      const reasons = [
        reason("채석공 직업", 46),
        reason("전문 분야", specialtyBonus(citizen, "construction", 8)),
        reason("채집 작업 수요", task.priority * 0.42),
        reason("배고픔", -citizen.hunger * 0.72),
        reason("피로", -citizen.fatigue * 0.32),
        reason("거리", -distance(citizen.position, task.targetPosition) * 0.07),
      ];
      candidates.push(candidate("gather_stone", task, reasons));
    }
  }

  addWorkshopCandidate(candidates, citizen, "carpenter", "carpentry_work", "work_carpentry", "목수 직업", tasksByType);
  addWorkshopCandidate(candidates, citizen, "blacksmith", "blacksmith_work", "work_blacksmith", "대장장이 직업", tasksByType);
  addWorkshopCandidate(candidates, citizen, "merchant", "market_work", "work_market", "상인 직업", tasksByType);

  if (citizen.canWork) {
    for (const task of tasksByType("carry_food_to_warehouse")) {
      const reasons = [
        reason("운반 작업 우선도", task.priority * 0.6),
        reason("마을 식량 부족", perception.foodShortage * 0.35),
        reason("협력 성향", citizen.traits.cooperation * 0.12),
        reason("체계적 운반", specialtyBonus(citizen, "cooking", 6)),
        reason("배고픔", -citizen.hunger * 0.62),
        reason("거리", -distance(citizen.position, task.targetPosition) * 0.07),
      ];
      candidates.push(candidate("carry_food", task, reasons));
    }
    for (const task of tasksByType("build")) {
      const reasons = [
        reason("건설 대기", 20 + perception.housingShortage * 35),
        reason("건설 작업 우선도", task.priority * 0.58),
        reason(
          "협력 성향",
          citizen.traits.cooperation * (citizen.job === "carpenter" ? 0.3 : 0.15),
        ),
        reason("건축 기술", citizen.skills.construction * 0.22),
        reason("전문 분야", specialtyBonus(citizen, "construction", 12)),
        reason("배고픔", -citizen.hunger * 0.7),
        reason("거리", -distance(citizen.position, task.targetPosition) * 0.07),
      ];
      candidates.push(candidate("build", task, reasons));
    }
  }

  const homeTask = perception.availableTasks.find(
    (task) =>
      task.type === "rest_at_home" &&
      (task.targetId === citizen.homeId || !citizen.homeId),
  );
  if (
    homeTask &&
    (citizen.fatigue >= 60 ||
      perception.tickInDay >= 112 ||
      (perception.scenario &&
        (citizen.winter.bodyTemperature < 36.1 ||
          citizen.winter.coldExposure >= 35 ||
          citizen.winter.illness >= 18 ||
          citizen.age < config.childMaturityYears)))
  ) {
    const nightBonus = perception.tickInDay >= 112 ? 42 : 0;
    const coldBonus = perception.scenario
      ? Math.max(0, 36.4 - citizen.winter.bodyTemperature) * 45 +
        citizen.winter.coldExposure * 0.75
      : 0;
    const vulnerableBonus =
      citizen.age < config.childMaturityYears || citizen.age >= 65 ? 34 : 0;
    const reasons = [
      reason("피로", citizen.fatigue * 1.6),
      reason("야간", nightBonus),
      reason("추위 회피", coldBonus),
      reason("취약 주민 보호", vulnerableBonus),
      reason("질병 회복", citizen.winter.illness * 0.5),
      reason("긴급 식량 작업", -perception.foodShortage * 0.22),
      reason("거리", -distance(citizen.position, homeTask.targetPosition) * 0.05),
    ];
    candidates.push(candidate("rest", homeTask, reasons));
  }

  if (citizen.job === "settler" && citizen.canWork) {
    candidates.push({
      goal: "forage",
      score:
        38 + perception.foodShortage * 0.5 - citizen.fatigue * 0.2,
      reasons: [
        reason("정착민 생존 채집", 38),
        reason("수렵/정찰 기술", Math.max(citizen.skills.hunting, citizen.skills.scouting) * 0.12),
        reason("마을 식량 부족", perception.foodShortage * 0.5),
        reason("피로", -citizen.fatigue * 0.2),
      ],
    });
  }

  candidates.push({
    goal: "wander",
    score: 6,
    reasons: [reason("짧은 대기", 6)],
  });

  const maxScore = Math.max(...candidates.map((item) => item.score));
  const tied = candidates
    .filter((item) => Math.abs(item.score - maxScore) < 0.0001)
    .sort((left, right) => {
      const leftKey = `${left.goal}:${left.task?.id ?? ""}`;
      const rightKey = `${right.goal}:${right.task?.id ?? ""}`;
      return leftKey.localeCompare(rightKey);
    });
  return tied.length === 1 ? tied[0]! : random.pick(tied);
}

function addWorkshopCandidate(
  candidates: DecisionCandidate[],
  citizen: Citizen,
  job: Citizen["job"],
  taskType: VillageTask["type"],
  goal: CitizenGoal,
  jobLabel: string,
  tasksByType: (type: VillageTask["type"]) => VillageTask[],
): void {
  if (!citizen.canWork || citizen.job !== job) {
    return;
  }
  for (const task of tasksByType(taskType)) {
    const relatedSkill =
      goal === "work_carpentry"
        ? "construction"
        : goal === "work_blacksmith"
          ? "construction"
          : "negotiation";
    const reasons = [
      reason(jobLabel, 46),
      reason(
        "관련 기술",
        (relatedSkill === "construction"
          ? citizen.skills.construction
          : citizen.skills.negotiation) * 0.18,
      ),
      reason("전문 분야", specialtyBonus(citizen, relatedSkill, 12)),
      reason("작업장 수요", task.priority * 0.42),
      reason("배고픔", -citizen.hunger * 0.72),
      reason("피로", -citizen.fatigue * 0.3),
      reason("거리", -distance(citizen.position, task.targetPosition) * 0.07),
    ];
    candidates.push(candidate(goal, task, reasons));
  }
}

/** 채집 목적지: 가까운 경작지(농장) 입구, 없으면 창고 주변. */
function nearestForageSpot(
  citizen: Citizen,
  state: SimulationState,
): Building | undefined {
  const candidates = state.buildings.filter(
    (b) =>
      (b.type === "farm" || b.type === "warehouse") &&
      b.constructionProgress >= 100,
  );
  return candidates.sort((left, right) => {
    const dl =
      Math.abs(citizen.position.x - left.entrance.x) +
      Math.abs(citizen.position.y - left.entrance.y);
    const dr =
      Math.abs(citizen.position.x - right.entrance.x) +
      Math.abs(citizen.position.y - right.entrance.y);
    return dl - dr || left.id.localeCompare(right.id);
  })[0];
}

function candidate(
  goal: CitizenGoal,
  task: VillageTask,
  reasons: CitizenDecisionReason[],
): DecisionCandidate {
  return {
    goal,
    task,
    reasons,
    score: reasons.reduce((sum, item) => sum + item.score, 0),
  };
}

function reason(factor: string, score: number): CitizenDecisionReason {
  return { factor, score: round(score) };
}

function specialtyBonus(
  citizen: Citizen,
  skill: keyof Citizen["skills"],
  bonus: number,
): number {
  return citizen.specialty === skill ? bonus : 0;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function temporaryRoleFor(goal: CitizenGoal): Citizen["temporaryRole"] {
  switch (goal) {
    case "work_farm":
    case "forage":
    case "carry_food":
      return "food_gatherer";
    case "gather_wood":
    case "process_firewood":
      return "wood_gatherer";
    case "repair_shelter":
    case "insulate_shelter":
      return "builder";
    case "care_sick":
      return "caregiver";
    default:
      return undefined;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
