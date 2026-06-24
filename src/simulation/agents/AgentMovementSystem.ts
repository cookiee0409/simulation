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
        citizen.targetPosition = createWanderTarget(citizen, config, random);
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
        citizen.path = [];
        citizen.pathIndex = 0;
        citizen.actionState = "failed";
        return;
      }
      citizen.path = path;
      citizen.pathIndex = 0;
      citizen.actionState = path.length === 0 ? "performing" : "moving";
    }

    if (citizen.actionState !== "moving") {
      return;
    }
    for (
      let step = 0;
      step < config.movementCellsPerTick;
      step += 1
    ) {
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
  _citizen: Citizen,
  config: SimulationConfig,
  random: SeededRandom,
): GridPosition {
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
