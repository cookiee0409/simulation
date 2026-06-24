import { AgentDecisionSystem } from "../agents/AgentDecisionSystem";
import { AgentExecutionSystem } from "../agents/AgentExecutionSystem";
import { AgentMovementSystem } from "../agents/AgentMovementSystem";
import { AgentNeedsSystem } from "../agents/AgentNeedsSystem";
import { AgentPerceptionSystem } from "../agents/AgentPerceptionSystem";
import { synchronizeVillageFood } from "../economy/FoodSystem";
import type { GridPathfinder } from "../pathfinding/GridPathfinder";
import { TaskBoardSystem } from "../tasks/TaskBoardSystem";
import type { SimulationConfig } from "./SimulationConfig";
import type { SeededRandom } from "./SeededRandom";
import type { SimulationState } from "../types";

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
    synchronizeVillageFood(state);
  }
}
