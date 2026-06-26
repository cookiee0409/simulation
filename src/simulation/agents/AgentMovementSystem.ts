import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import type { GridPathfinder } from "../pathfinding/GridPathfinder";
import type { Citizen, GridPosition, SimulationState } from "../types";

export class AgentMovementSystem {
  constructor(private readonly pathfinder: GridPathfinder) {}

  updateCitizen(
    citizen: Citizen,
    state: SimulationState,
    config: SimulationConfig,
    random: SeededRandom,
  ): void {
    if (
      (citizen.actionState === "waiting" ||
        citizen.actionState === "deciding") &&
      citizen.goal !== "seek_work"
    ) {
      if (!citizen.targetPosition && citizen.goal === "wander") {
        citizen.targetPosition = createWanderTarget(citizen, state, config, random);
      }
      if (!citizen.targetPosition) {
        citizen.actionState = "failed";
        return;
      }
      const path = this.pathfinder.findPath(
        citizen.position,
        citizen.targetPosition,
        state.buildings,
        state.mapRevision,
      );
      if (path === null) {
        const fallback = findReachableFallback(
          citizen,
          state,
          config,
          random,
          this.pathfinder,
        );
        if (!fallback) {
          citizen.path = [];
          citizen.pathIndex = 0;
          citizen.actionState = "failed";
          return;
        }
        citizen.goal = fallback.goal;
        citizen.targetId = fallback.targetId;
        citizen.targetPosition = { ...fallback.targetPosition };
        citizen.path = fallback.path;
        citizen.pathIndex = 0;
        citizen.actionState = fallback.path.length === 0 ? "performing" : "moving";
        citizen.decisionReasons = [
          { factor: "경로 재탐색", score: 20 },
          { factor: fallback.reason, score: 15 },
        ];
        citizen.decisionScore = 35;
        return;
      }
      citizen.path = path;
      citizen.pathIndex = 0;
      citizen.actionState = path.length === 0 ? "performing" : "moving";
    }

    if (citizen.actionState !== "moving") {
      return;
    }
    citizen.movementBudget += movementSpeed(citizen, state, config);
    const stepsThisTick = Math.floor(citizen.movementBudget);
    if (stepsThisTick <= 0) {
      return;
    }
    citizen.movementBudget -= stepsThisTick;
    for (let step = 0; step < stepsThisTick; step += 1) {
      const nextPosition = citizen.path[citizen.pathIndex];
      if (!nextPosition) {
        citizen.actionState = "performing";
        citizen.actionProgress = 0;
        return;
      }
      citizen.position = { ...nextPosition };
      citizen.pathIndex += 1;
    }
    if (citizen.pathIndex >= citizen.path.length) {
      citizen.actionState = "performing";
      citizen.actionProgress = 0;
    }
  }
}

function createWanderTarget(
  citizen: Citizen,
  state: SimulationState,
  config: SimulationConfig,
  random: SeededRandom,
): GridPosition {
  const home = state.buildings.find((building) => building.id === citizen.homeId);
  if (
    home &&
    (citizen.age < config.childMaturityYears ||
      citizen.winter.bodyTemperature < 36 ||
      citizen.winter.coldExposure >= 35)
  ) {
    return random.pick([
      home.entrance,
      { x: home.entrance.x - config.gridSize, y: home.entrance.y },
      { x: home.entrance.x + config.gridSize, y: home.entrance.y },
      { x: home.entrance.x, y: home.entrance.y + config.gridSize },
    ]);
  }
  const centerX =
    Math.round(config.mapWidth / 2 / config.gridSize) * config.gridSize;
  const centerY =
    Math.round(config.mapHeight / 2 / config.gridSize) * config.gridSize;
  return random.pick([
    { x: centerX, y: centerY - config.gridSize },
    { x: centerX - config.gridSize, y: centerY },
    { x: centerX + config.gridSize, y: centerY },
    { x: centerX, y: centerY + config.gridSize },
  ]);
}

interface FallbackRoute {
  goal: Citizen["goal"];
  targetId?: string;
  targetPosition: GridPosition;
  path: GridPosition[];
  reason: string;
}

function findReachableFallback(
  citizen: Citizen,
  state: SimulationState,
  config: SimulationConfig,
  random: SeededRandom,
  pathfinder: GridPathfinder,
): FallbackRoute | undefined {
  const candidates: Array<{
    goal: Citizen["goal"];
    targetId?: string;
    targetPosition: GridPosition;
    reason: string;
  }> = [];
  const home = state.buildings.find((building) => building.id === citizen.homeId);
  if (home) {
    candidates.push({
      goal: "return_home",
      targetId: home.id,
      targetPosition: home.entrance,
      reason: "집으로 우회",
    });
  }
  for (const warehouse of state.buildings.filter(
    (building) => building.type === "warehouse" && building.constructionProgress >= 100,
  )) {
    candidates.push({
      goal: "wander",
      targetId: warehouse.id,
      targetPosition: warehouse.entrance,
      reason: "창고 출입구로 우회",
    });
  }
  for (const zone of shuffled([...state.layout.zones], random)) {
    candidates.push({
      goal: "wander",
      targetPosition: zone.gate,
      reason: `${zone.label} 출입구로 우회`,
    });
  }

  return candidates
    .sort(
      (left, right) =>
        distance(citizen.position, left.targetPosition) -
        distance(citizen.position, right.targetPosition),
    )
    .map((candidate) => {
      const path = pathfinder.findPath(
        citizen.position,
        candidate.targetPosition,
        state.buildings,
        state.mapRevision,
      );
      return path === null ? undefined : { ...candidate, path };
    })
    .find((candidate): candidate is FallbackRoute => candidate !== undefined);
}

function movementSpeed(
  citizen: Citizen,
  state: SimulationState,
  config: SimulationConfig,
): number {
  if (!state.scenario) {
    return config.movementCellsPerTick;
  }
  const bodyTemperature = citizen.winter.bodyTemperature;
  const coldPenalty =
    bodyTemperature >= 36
      ? 1
      : bodyTemperature >= 35
        ? 0.78
        : bodyTemperature >= 34
          ? 0.52
          : bodyTemperature >= 33
            ? 0.34
            : 0.18;
  const fatiguePenalty = 1 - Math.min(0.45, citizen.fatigue / 220);
  const illnessPenalty = 1 - Math.min(0.35, citizen.winter.illness / 260);
  const childPenalty = citizen.age < config.childMaturityYears ? 0.82 : 1;
  return Math.max(
    0.12,
    config.movementCellsPerTick *
      coldPenalty *
      fatiguePenalty *
      illnessPenalty *
      childPenalty,
  );
}

function distance(left: GridPosition, right: GridPosition): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function shuffled<T>(items: T[], random: SeededRandom): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = random.integer(0, index);
    [items[index], items[swapIndex]] = [items[swapIndex]!, items[index]!];
  }
  return items;
}
