import { describe, expect, it } from "vitest";
import { createSimulationConfig } from "../core/SimulationConfig";
import { SeededRandom } from "../core/SeededRandom";
import { createBuilding } from "../city/BuildingFactory";
import { createResourcePool, type Citizen, type SimulationState, type VillageTask } from "../types";
import { AgentDecisionSystem, chooseGoal } from "./AgentDecisionSystem";
import { AgentPerceptionSystem } from "./AgentPerceptionSystem";
import { AgentExecutionSystem } from "./AgentExecutionSystem";
import { AgentMovementSystem } from "./AgentMovementSystem";
import { GridPathfinder } from "../pathfinding/GridPathfinder";
import { TaskBoardSystem } from "../tasks/TaskBoardSystem";

describe("자율 에이전트 시스템", () => {
  it("배고픔이 높은 NPC가 식사를 우선 선택한다", () => {
    const config = createSimulationConfig();
    const citizen = createCitizen({ hunger: 90 });
    const task = createTask("eat", "eat_food", "warehouse-01", { x: 100, y: 100 });
    const decision = chooseGoal(
      citizen,
      {
        citizen,
        nearbyBuildings: [],
        availableTasks: [task],
        foodShortage: 20,
        housingShortage: 0,
        day: 0,
        tickInDay: 40,
      },
      config,
      new SeededRandom("hungry"),
    );
    expect(decision.goal).toBe("eat");
    expect(decision.reasons.some((reason) => reason.factor === "배고픔")).toBe(true);
  });

  it("식량 부족 시 농부가 농사 작업을 선택한다", () => {
    const config = createSimulationConfig();
    const citizen = createCitizen({ job: "farmer", hunger: 5 });
    const farmTask = createTask(
      "farm",
      "farm_work",
      "farm-01",
      { x: 80, y: 80 },
      100,
    );
    const decision = chooseGoal(
      citizen,
      {
        citizen,
        nearbyBuildings: [],
        availableTasks: [farmTask],
        foodShortage: 100,
        housingShortage: 0,
        day: 0,
        tickInDay: 40,
      },
      config,
      new SeededRandom("farmer"),
    );
    expect(decision.goal).toBe("work_farm");
  });

  it("작업 정원이 찼으면 추가 NPC에게 노출하지 않는다", () => {
    const config = createSimulationConfig();
    const citizen = createCitizen({ id: "citizen-002" });
    const fullTask = createTask(
      "farm",
      "farm_work",
      "farm-01",
      { x: 80, y: 80 },
      80,
      1,
      ["citizen-001"],
    );
    const state = createState(citizen);
    state.tasks = [fullTask];
    const perception = new AgentPerceptionSystem().observe(
      citizen,
      state,
      config,
      0,
      0,
    );
    expect(perception.availableTasks).toHaveLength(0);
    expect(new TaskBoardSystem().assignCitizen(fullTask, citizen)).toBe(false);
  });

  it("목표 작업이 사라지면 재판단 대상으로 바뀐다", () => {
    const config = createSimulationConfig();
    const citizen = createCitizen({
      taskId: "missing-task",
      actionState: "moving",
    });
    const state = createState(citizen);
    const decision = new AgentDecisionSystem(new TaskBoardSystem());
    expect(decision.shouldReconsider(citizen, state, config)).toBe(true);
    expect(citizen.actionState).toBe("failed");
  });

  it("농장 인벤토리에 식량이 생기면 운반 작업을 생성한다", () => {
    const config = createSimulationConfig({
      initialPopulation: 1,
      initialFarmers: 1,
    });
    const random = new SeededRandom("carry-task");
    const farm = createBuilding("farm", 0, 12, random, config);
    const warehouse = createBuilding("warehouse", 0, 600, random, config);
    farm.inventory.food = 12;
    const citizen = createCitizen();
    const state = createState(citizen, [farm, warehouse]);
    new TaskBoardSystem().update(state, config, random);
    const task = state.tasks.find(
      (candidate) => candidate.type === "carry_food_to_warehouse",
    );
    expect(task).toBeDefined();
    expect(task!.capacity).toBeGreaterThan(0);
  });

  it("NPC가 경로의 다음 칸으로 이동하고 도착 후 performing이 된다", () => {
    const config = createSimulationConfig({ mapWidth: 200, mapHeight: 200 });
    const citizen = createCitizen({
      position: { x: 20, y: 20 },
      targetPosition: { x: 60, y: 20 },
      actionState: "waiting",
      goal: "wander",
    });
    const state = createState(citizen);
    const movement = new AgentMovementSystem(new GridPathfinder(config));
    movement.updateCitizen(citizen, state, config, new SeededRandom("move"));
    expect(citizen.position).toEqual({ x: 40, y: 20 });
    movement.updateCitizen(citizen, state, config, new SeededRandom("move"));
    expect(citizen.position).toEqual({ x: 60, y: 20 });
    expect(citizen.actionState).toBe("performing");
  });

  it("농사·운반·식사·건설이 실제 인벤토리와 상태를 변경한다", () => {
    const config = createSimulationConfig({
      farmActionTicks: 2,
      eatActionTicks: 2,
      carryPickupTicks: 1,
      carryDropoffTicks: 1,
      constructionProgressPerTick: 1,
    });
    const random = new SeededRandom("execution");
    const farm = createBuilding("farm", 0, 12, random, config);
    const warehouse = createBuilding("warehouse", 0, 600, random, config);
    warehouse.inventory.food = 5;
    const site = createBuilding("house", 9, 10, random, config, 99);
    const citizen = createCitizen({
      job: "farmer",
      goal: "work_farm",
      actionState: "performing",
      targetId: farm.id,
      actionProgress: 0.5,
    });
    const state = createState(citizen, [farm, warehouse, site]);
    const execution = new AgentExecutionSystem();

    execution.updateCitizen(citizen, state, config, 0);
    expect(farm.inventory.food).toBeGreaterThan(0);
    const farmFoodAfterWork = farm.inventory.food ?? 0;

    citizen.goal = "carry_food";
    citizen.carryStage = "to_farm";
    citizen.targetId = farm.id;
    citizen.actionState = "performing";
    citizen.actionProgress = 0;
    execution.updateCitizen(citizen, state, config, 0);
    expect(citizen.carriedFood).toBeGreaterThan(0);
    expect(farm.inventory.food).toBeLessThan(farmFoodAfterWork);

    citizen.actionState = "performing";
    citizen.actionProgress = 0;
    execution.updateCitizen(citizen, state, config, 0);
    expect(citizen.carriedFood).toBe(0);
    expect(warehouse.inventory.food).toBeGreaterThan(5);

    citizen.goal = "eat";
    citizen.targetId = warehouse.id;
    citizen.hunger = 80;
    citizen.actionState = "performing";
    citizen.actionProgress = 0.5;
    const foodBeforeEating = warehouse.inventory.food ?? 0;
    execution.updateCitizen(citizen, state, config, 0);
    expect(citizen.hunger).toBeLessThan(80);
    expect(warehouse.inventory.food).toBeLessThan(foodBeforeEating);

    citizen.goal = "build";
    citizen.targetId = site.id;
    citizen.actionState = "performing";
    execution.updateCitizen(citizen, state, config, 0);
    expect(site.constructionProgress).toBe(100);
  });

  it("중단된 농사 행동은 식량을 중복 생성하지 않는다", () => {
    const config = createSimulationConfig({ farmActionTicks: 10 });
    const farm = createBuilding(
      "farm",
      0,
      12,
      new SeededRandom("interrupt"),
      config,
    );
    const citizen = createCitizen({
      job: "farmer",
      goal: "work_farm",
      actionState: "performing",
      targetId: farm.id,
      actionProgress: 0.5,
    });
    const state = createState(citizen, [farm]);
    const execution = new AgentExecutionSystem();
    execution.updateCitizen(citizen, state, config, 0);
    const food = farm.inventory.food ?? 0;
    citizen.actionState = "failed";
    execution.updateCitizen(citizen, state, config, 0);
    expect(farm.inventory.food).toBe(food);
  });
});

function createCitizen(overrides: Partial<Citizen> = {}): Citizen {
  return {
    id: "citizen-001",
    age: 30,
    job: "unemployed",
    position: { x: 40, y: 40 },
    wealth: 100,
    hunger: 10,
    health: 100,
    happiness: 70,
    canWork: true,
    action: "idle",
    groupId: "group-1",
    traits: { cooperation: 50, riskTolerance: 50, savingPreference: 50 },
    fatigue: 10,
    goal: "wander",
    actionState: "deciding",
    path: [],
    pathIndex: 0,
    actionProgress: 0,
    decisionCooldown: 0,
    decisionScore: 0,
    decisionReasons: [],
    carriedFood: 0,
    lastMealDay: -1,
    ...overrides,
  };
}

function createTask(
  id: string,
  type: VillageTask["type"],
  targetId: string,
  targetPosition: VillageTask["targetPosition"],
  priority = 80,
  capacity = 10,
  assignedCitizenIds: string[] = [],
): VillageTask {
  return {
    id,
    type,
    targetId,
    targetPosition,
    priority,
    capacity,
    assignedCitizenIds,
  };
}

function createState(
  citizen: Citizen,
  buildings: SimulationState["buildings"] = [],
): SimulationState {
  return {
    citizens: [citizen],
    buildings,
    resources: createResourcePool(),
    tasks: [],
    statistics: [],
    dailyMetrics: {
      foodProduced: 0,
      foodConsumed: 0,
      populationLost: 0,
      births: 0,
      deaths: 0,
    },
    mapRevision: 0,
    nextCitizenSerial: 2,
  };
}
