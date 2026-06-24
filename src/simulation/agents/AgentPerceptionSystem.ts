import { calculateBuildingDemand } from "../city/BuildingDemandSystem";
import type { SimulationConfig } from "../core/SimulationConfig";
import { calculateFoodShortage } from "../tasks/TaskBoardSystem";
import type {
  Building,
  Citizen,
  SimulationState,
  VillageTask,
} from "../types";

export interface AgentPerception {
  citizen: Citizen;
  nearbyBuildings: Building[];
  availableTasks: VillageTask[];
  foodShortage: number;
  housingShortage: number;
  day: number;
  tickInDay: number;
}

export class AgentPerceptionSystem {
  observe(
    citizen: Citizen,
    state: SimulationState,
    config: SimulationConfig,
    day: number,
    tickInDay: number,
  ): AgentPerception {
    const nearbyBuildings = state.buildings
      .filter(
        (building) =>
          distance(citizen.position, building.entrance) <=
          config.perceptionRadius,
      )
      .sort((left, right) => left.id.localeCompare(right.id));
    const availableTasks = state.tasks
      .filter(
        (task) =>
          task.assignedCitizenIds.includes(citizen.id) ||
          task.assignedCitizenIds.length < task.capacity,
      )
      .sort(
        (left, right) =>
          right.priority - left.priority || left.id.localeCompare(right.id),
      );

    return {
      citizen,
      nearbyBuildings,
      availableTasks,
      foodShortage: calculateFoodShortage(state, config),
      housingShortage: calculateBuildingDemand(state, config).houses,
      day,
      tickInDay,
    };
  }
}

export function distance(
  left: { x: number; y: number },
  right: { x: number; y: number },
): number {
  return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}
