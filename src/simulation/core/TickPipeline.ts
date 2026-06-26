import { AgentDecisionSystem } from "../agents/AgentDecisionSystem";
import { AgentExecutionSystem } from "../agents/AgentExecutionSystem";
import { AgentMovementSystem } from "../agents/AgentMovementSystem";
import { AgentNeedsSystem } from "../agents/AgentNeedsSystem";
import { AgentPerceptionSystem } from "../agents/AgentPerceptionSystem";
import { synchronizeVillageFood } from "../economy/FoodSystem";
import { getBuildingHalfSize } from "../city/BuildingFactory";
import type { GridPathfinder } from "../pathfinding/GridPathfinder";
import { TaskBoardSystem } from "../tasks/TaskBoardSystem";
import type { SimulationConfig } from "./SimulationConfig";
import type { SeededRandom } from "./SeededRandom";
import type { SimulationState } from "../types";
import { updateBodyTemperatures } from "../survival/BodyTemperatureSystem";

export class TickPipeline {
  readonly taskBoard = new TaskBoardSystem();
  readonly perception = new AgentPerceptionSystem();
  readonly decision = new AgentDecisionSystem(this.taskBoard);
  readonly movement: AgentMovementSystem;
  readonly needs = new AgentNeedsSystem();
  readonly execution = new AgentExecutionSystem();
  private tickCounter = 0;

  constructor(pathfinder: GridPathfinder) {
    this.movement = new AgentMovementSystem(pathfinder);
  }

  update(
    state: SimulationState,
    config: SimulationConfig,
    random: SeededRandom,
    day: number,
    tickInDay: number,
  ): void {
    if (this.tickCounter % 2 === 0) {
      this.taskBoard.update(state, config, random);
    }
    this.tickCounter += 1;
    const citizens = [...state.citizens].sort((left, right) =>
      left.id.localeCompare(right.id),
    );

    for (const citizen of citizens) {
      unstickFromBuildings(citizen, state, config);
      this.needs.updateCitizen(citizen, config);
      if (this.decision.shouldReconsider(citizen, state, config)) {
        const perception = this.perception.observe(
          citizen,
          state,
          config,
          day,
          tickInDay,
        );
        this.decision.decideCitizen(
          citizen,
          perception,
          state,
          config,
          random,
        );
      }
      this.movement.updateCitizen(citizen, state, config, random);
      this.execution.updateCitizen(citizen, state, config, day, random);
    }
    updateBodyTemperatures(state, config);
    synchronizeVillageFood(state);
  }
}

/**
 * 건물 면적 안에 갇힌 주민을 그 건물 입구로 내보낸다(통행 가능 칸). 출생·건물 배치 등
 * 어떤 이유로 갇히든 매 틱 안전망으로 풀어 줘 식량·집 접근 불능에 의한 아사를 막는다.
 */
function unstickFromBuildings(
  citizen: { position: { x: number; y: number }; path: unknown[]; pathIndex: number },
  state: SimulationState,
  config: SimulationConfig,
): void {
  for (const building of state.buildings) {
    const half = getBuildingHalfSize(building.type, config.gridSize);
    if (
      Math.abs(citizen.position.x - building.position.x) <= half.x &&
      Math.abs(citizen.position.y - building.position.y) <= half.y
    ) {
      citizen.position = { ...building.entrance };
      citizen.path = [];
      citizen.pathIndex = 0;
      return;
    }
  }
}
