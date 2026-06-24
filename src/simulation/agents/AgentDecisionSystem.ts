import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import { distance, type AgentPerception } from "./AgentPerceptionSystem";
import type {
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
    const shouldDecide =
      emergency ||
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
    citizen.targetId = decision.task?.targetId;
    citizen.targetPosition = decision.task
      ? { ...decision.task.targetPosition }
      : undefined;
    citizen.path = [];
    citizen.pathIndex = 0;
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

  if (citizen.canWork && citizen.job === "farmer") {
    for (const task of tasksByType("farm_work")) {
      const reasons = [
        reason("농부 직업", 48),
        reason("마을 식량 부족", perception.foodShortage * 0.7),
        reason("농장 작업 수요", task.priority * 0.42),
        reason("배고픔", -citizen.hunger * 0.72),
        reason("피로", -citizen.fatigue * 0.32),
        reason("거리", -distance(citizen.position, task.targetPosition) * 0.07),
      ];
      candidates.push(candidate("work_farm", task, reasons));
    }
  }

  if (citizen.canWork) {
    for (const task of tasksByType("carry_food_to_warehouse")) {
      const reasons = [
        reason("운반 작업 우선도", task.priority * 0.6),
        reason("마을 식량 부족", perception.foodShortage * 0.35),
        reason("협력 성향", citizen.traits.cooperation * 0.12),
        reason("배고픔", -citizen.hunger * 0.62),
        reason("거리", -distance(citizen.position, task.targetPosition) * 0.07),
      ];
      candidates.push(candidate("carry_food", task, reasons));
    }
    for (const task of tasksByType("build_house")) {
      const reasons = [
        reason("주택 부족", perception.housingShortage * 55),
        reason("건설 작업 우선도", task.priority * 0.58),
        reason("협력 성향", citizen.traits.cooperation * 0.15),
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
    (citizen.fatigue >= 60 || perception.tickInDay >= 112)
  ) {
    const nightBonus = perception.tickInDay >= 112 ? 42 : 0;
    const reasons = [
      reason("피로", citizen.fatigue * 1.6),
      reason("야간", nightBonus),
      reason("긴급 식량 작업", -perception.foodShortage * 0.22),
      reason("거리", -distance(citizen.position, homeTask.targetPosition) * 0.05),
    ];
    candidates.push(candidate("rest", homeTask, reasons));
  }

  if (citizen.job === "unemployed" && citizen.canWork) {
    candidates.push({
      goal: "seek_work",
      score: 44 + perception.foodShortage * 0.35,
      reasons: [
        reason("무직", 44),
        reason("마을 식량 부족", perception.foodShortage * 0.35),
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

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
