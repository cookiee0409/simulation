import { calculateBuildingDemand } from "../city/BuildingDemandSystem";
import { requestBuilding } from "../city/BuildingConstruction";
import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import type {
  BuildingType,
  Citizen,
  SimulationState,
  VillageTask,
  VillageTaskType,
} from "../types";

export class TaskBoardSystem {
  update(
    state: SimulationState,
    config: SimulationConfig,
    random: SeededRandom,
  ): void {
    this.ensureConstructionSite(state, config, random);
    const aliveIds = new Set(state.citizens.map((citizen) => citizen.id));
    const previousAssignments = new Map(
      state.tasks.map((task) => [
        task.id,
        task.assignedCitizenIds.filter((id) => aliveIds.has(id)),
      ]),
    );
    const foodShortage = calculateFoodShortage(state, config);
    const tasks: VillageTask[] = [];

    for (const farm of state.buildings
      .filter(
        (building) =>
          building.type === "farm" && building.constructionProgress >= 100,
      )
      .sort((left, right) => left.id.localeCompare(right.id))) {
      tasks.push(
        createTask(
          `farm-work:${farm.id}`,
          "farm_work",
          farm.id,
          farm.entrance,
          55 + foodShortage * 0.45,
          farm.capacity,
          previousAssignments,
        ),
      );
      const storedFood = farm.inventory.food ?? 0;
      const previousCarriers =
        previousAssignments.get(`carry-food:${farm.id}`) ?? [];
      if (storedFood >= 0.25 || previousCarriers.length > 0) {
        tasks.push(
          createTask(
            `carry-food:${farm.id}`,
            "carry_food_to_warehouse",
            farm.id,
            farm.entrance,
            50 + Math.min(45, storedFood * 5) + foodShortage * 0.25,
            Math.max(
              previousCarriers.length,
              1,
              Math.min(5, Math.ceil(storedFood / config.carryCapacity)),
            ),
            previousAssignments,
          ),
        );
      }
    }

    if (state.resources.wood < config.woodStockTarget) {
      for (const lumberyard of state.buildings
        .filter(
          (building) =>
            building.type === "lumberjack" &&
            building.constructionProgress >= 100,
        )
        .sort((left, right) => left.id.localeCompare(right.id))) {
        tasks.push(
          createTask(
            `gather-wood:${lumberyard.id}`,
            "gather_wood",
            lumberyard.id,
            lumberyard.entrance,
            52,
            lumberyard.capacity,
            previousAssignments,
          ),
        );
      }
    }

    if (state.resources.stone < config.stoneStockTarget) {
      for (const quarry of state.buildings
        .filter(
          (building) =>
            building.type === "quarry" &&
            building.constructionProgress >= 100,
        )
        .sort((left, right) => left.id.localeCompare(right.id))) {
        tasks.push(
          createTask(
            `gather-stone:${quarry.id}`,
            "gather_stone",
            quarry.id,
            quarry.entrance,
            50,
            quarry.capacity,
            previousAssignments,
          ),
        );
      }
    }

    for (const warehouse of state.buildings
      .filter(
        (building) =>
          building.type === "warehouse" &&
          building.constructionProgress >= 100 &&
          (building.inventory.food ?? 0) >= config.foodPerMeal,
      )
      .sort((left, right) => left.id.localeCompare(right.id))) {
      tasks.push(
        createTask(
          `eat-food:${warehouse.id}`,
          "eat_food",
          warehouse.id,
          warehouse.entrance,
          75,
          Math.max(
            1,
            Math.floor(
              (warehouse.inventory.food ?? 0) /
                Math.max(0.001, config.foodPerMeal),
            ),
          ),
          previousAssignments,
        ),
      );
    }

    for (const house of state.buildings
      .filter(
        (building) =>
          building.type === "house" && building.constructionProgress >= 100,
      )
      .sort((left, right) => left.id.localeCompare(right.id))) {
      tasks.push(
        createTask(
          `rest-home:${house.id}`,
          "rest_at_home",
          house.id,
          house.entrance,
          25,
          house.capacity,
          previousAssignments,
        ),
      );
    }

    // 종류와 무관하게 짓는 중인 모든 건물에 건설 작업을 연다.
    for (const site of state.buildings
      .filter((building) => building.constructionProgress < 100)
      .sort((left, right) => left.id.localeCompare(right.id))) {
      tasks.push(
        createTask(
          `build:${site.id}`,
          "build",
          site.id,
          site.entrance,
          90,
          config.buildTaskCapacity,
          previousAssignments,
        ),
      );
    }

    // 2차 산업 작업장(목공소·대장간·시장).
    addWorkshopTasks(tasks, state, "carpentry", "carpentry_work", 54, previousAssignments);
    addWorkshopTasks(tasks, state, "blacksmith", "blacksmith_work", 52, previousAssignments);
    addWorkshopTasks(tasks, state, "market", "market_work", 48, previousAssignments);

    state.tasks = tasks;
    this.removeInvalidAssignments(state);
  }

  assignCitizen(
    task: VillageTask,
    citizen: Citizen,
  ): boolean {
    if (
      !task.assignedCitizenIds.includes(citizen.id) &&
      task.assignedCitizenIds.length >= task.capacity
    ) {
      return false;
    }
    if (!task.assignedCitizenIds.includes(citizen.id)) {
      task.assignedCitizenIds.push(citizen.id);
      task.assignedCitizenIds.sort();
    }
    citizen.taskId = task.id;
    return true;
  }

  unassignCitizen(state: SimulationState, citizen: Citizen): void {
    if (citizen.taskId) {
      const task = state.tasks.find((candidate) => candidate.id === citizen.taskId);
      if (task) {
        task.assignedCitizenIds = task.assignedCitizenIds.filter(
          (id) => id !== citizen.id,
        );
      }
    }
    citizen.taskId = undefined;
  }

  private ensureConstructionSite(
    state: SimulationState,
    config: SimulationConfig,
    random: SeededRandom,
  ): void {
    const hasSite = state.buildings.some(
      (building) =>
        building.type === "house" && building.constructionProgress < 100,
    );
    if (hasSite || calculateBuildingDemand(state, config).houses <= 0) {
      return;
    }
    // 자재·공간이 확보될 때만 자동 부지 선정해 주택을 착공한다.
    requestBuilding(state, config, "house", random);
  }

  private removeInvalidAssignments(state: SimulationState): void {
    const taskIds = new Set(state.tasks.map((task) => task.id));
    for (const citizen of state.citizens) {
      if (citizen.taskId && !taskIds.has(citizen.taskId)) {
        citizen.taskId = undefined;
        if (
          citizen.actionState !== "completed" &&
          citizen.actionState !== "failed"
        ) {
          citizen.actionState = "failed";
        }
      }
    }
  }
}

function addWorkshopTasks(
  tasks: VillageTask[],
  state: SimulationState,
  buildingType: BuildingType,
  taskType: VillageTaskType,
  priority: number,
  previousAssignments: Map<string, string[]>,
): void {
  for (const building of state.buildings
    .filter(
      (b) => b.type === buildingType && b.constructionProgress >= 100,
    )
    .sort((left, right) => left.id.localeCompare(right.id))) {
    tasks.push(
      createTask(
        `${taskType}:${building.id}`,
        taskType,
        building.id,
        building.entrance,
        priority,
        building.capacity,
        previousAssignments,
      ),
    );
  }
}

function createTask(
  id: string,
  type: VillageTask["type"],
  targetId: string,
  targetPosition: VillageTask["targetPosition"],
  priority: number,
  capacity: number,
  previousAssignments: Map<string, string[]>,
): VillageTask {
  return {
    id,
    type,
    targetId,
    targetPosition: { ...targetPosition },
    priority,
    capacity,
    assignedCitizenIds: (previousAssignments.get(id) ?? []).slice(0, capacity),
  };
}

export function calculateFoodShortage(
  state: SimulationState,
  config: SimulationConfig,
): number {
  const totalFood =
    state.buildings.reduce(
      (sum, building) => sum + (building.inventory.food ?? 0),
      0,
    ) + state.citizens.reduce((sum, citizen) => sum + citizen.carriedFood, 0);
  const dailyDemand =
    state.citizens.length * Math.max(0.001, config.foodPerCitizenPerDay);
  return Math.max(0, Math.min(100, (1 - totalFood / dailyDemand) * 100));
}
