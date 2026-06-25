import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import {
  constructionSpeedMultiplier,
  toolProductivityMultiplier,
} from "../economy/IndustrySystem";
import type { Building, Citizen, SimulationState } from "../types";

export class AgentExecutionSystem {
  updateCitizen(
    citizen: Citizen,
    state: SimulationState,
    config: SimulationConfig,
    day: number,
    random?: SeededRandom,
  ): void {
    if (citizen.actionState !== "performing") {
      updateLegacyAction(citizen);
      return;
    }

    switch (citizen.goal) {
      case "forage":
        this.performForage(citizen, state, config, random);
        break;
      case "work_farm":
        this.performFarmWork(citizen, state, config, random);
        break;
      case "gather_wood":
        this.performGather(citizen, state, config, "wood", random);
        break;
      case "gather_stone":
        this.performGather(citizen, state, config, "stone", random);
        break;
      case "work_carpentry":
        this.performCarpentry(citizen, state, config);
        break;
      case "work_blacksmith":
        this.performBlacksmith(citizen, state, config, random);
        break;
      case "work_market":
        this.performMarket(citizen, state, config);
        break;
      case "carry_food":
        this.performCarry(citizen, state, config);
        break;
      case "eat":
        this.performEating(citizen, state, config, day);
        break;
      case "rest":
      case "return_home":
        this.performRest(citizen, config);
        break;
      case "build":
        this.performConstruction(citizen, state, config);
        break;
      case "seek_work":
        complete(citizen);
        break;
      case "wander":
        citizen.actionProgress = Math.min(1, citizen.actionProgress + 0.5);
        if (citizen.actionProgress >= 1) {
          complete(citizen);
        }
        break;
    }
    updateLegacyAction(citizen);
  }

  private performFarmWork(
    citizen: Citizen,
    state: SimulationState,
    config: SimulationConfig,
    random?: SeededRandom,
  ): void {
    const farm = state.buildings.find(
      (building) =>
        building.id === citizen.targetId &&
        building.type === "farm" &&
        building.constructionProgress >= 100,
    );
    if (!farm || citizen.job !== "farmer" || !citizen.canWork) {
      fail(citizen);
      return;
    }
    citizen.actionProgress += 1 / config.farmActionTicks;
    if (citizen.actionProgress < 1) {
      return;
    }
    const productivity = Math.max(
      config.farmerHealthProductivityFloor,
      citizen.health / 100,
    );
    const amount =
      config.farmFoodPerAction *
      config.landFertility *
      productivity *
      toolProductivityMultiplier(state, config) *
      Math.max(
        0,
        1 +
          (random?.between(
            -config.dailyProductionNoise,
            config.dailyProductionNoise,
          ) ?? 0),
      );
    farm.inventory.food = (farm.inventory.food ?? 0) + amount;
    state.dailyMetrics.foodProduced += amount;
    complete(citizen);
  }

  private performForage(
    citizen: Citizen,
    state: SimulationState,
    config: SimulationConfig,
    random?: SeededRandom,
  ): void {
    if (citizen.job !== "settler" || !citizen.canWork) {
      fail(citizen);
      return;
    }
    citizen.actionProgress += 1 / config.forageActionTicks;
    if (citizen.actionProgress < 1) {
      return;
    }
    // 야생 식량은 하루 한계가 있다(인구가 늘면 채집만으로 부족해져 농업이 필요해진다).
    const remaining = config.wildFoodPerDay - state.dailyMetrics.foragedToday;
    if (remaining <= 0) {
      complete(citizen);
      return;
    }
    const productivity = Math.max(
      config.farmerHealthProductivityFloor,
      citizen.health / 100,
    );
    const amount = Math.min(
      remaining,
      config.forageFoodPerAction *
        productivity *
        Math.max(
          0,
          1 +
            (random?.between(
              -config.dailyProductionNoise,
              config.dailyProductionNoise,
            ) ?? 0),
        ),
    );
    const warehouse = findNearestWarehouse(citizen, state);
    if (warehouse) {
      const stored = warehouse.inventory.food ?? 0;
      warehouse.inventory.food = Math.min(
        warehouse.capacity,
        stored + amount,
      );
      state.dailyMetrics.foodProduced += amount;
      state.dailyMetrics.foragedToday += amount;
    }
    complete(citizen);
  }

  private performGather(
    citizen: Citizen,
    state: SimulationState,
    config: SimulationConfig,
    resource: "wood" | "stone",
    random?: SeededRandom,
  ): void {
    const buildingType = resource === "wood" ? "lumberjack" : "quarry";
    const requiredJob = resource === "wood" ? "lumberjack" : "miner";
    const site = state.buildings.find(
      (building) =>
        building.id === citizen.targetId &&
        building.type === buildingType &&
        building.constructionProgress >= 100,
    );
    if (!site || citizen.job !== requiredJob || !citizen.canWork) {
      fail(citizen);
      return;
    }
    citizen.actionProgress += 1 / config.gatherActionTicks;
    if (citizen.actionProgress < 1) {
      return;
    }
    const yieldPerAction =
      resource === "wood" ? config.woodPerAction : config.stonePerAction;
    const productivity = Math.max(
      config.farmerHealthProductivityFloor,
      citizen.health / 100,
    );
    const amount =
      yieldPerAction *
      productivity *
      toolProductivityMultiplier(state, config) *
      Math.max(
        0,
        1 +
          (random?.between(
            -config.dailyProductionNoise,
            config.dailyProductionNoise,
          ) ?? 0),
      );
    const target =
      resource === "wood" ? config.woodStockTarget : config.stoneStockTarget;
    state.resources[resource] = Math.min(
      target,
      state.resources[resource] + amount,
    );
    complete(citizen);
  }

  private performCarry(
    citizen: Citizen,
    state: SimulationState,
    config: SimulationConfig,
  ): void {
    if (citizen.carryStage === "to_farm") {
      citizen.actionProgress += 1 / config.carryPickupTicks;
      if (citizen.actionProgress < 1) {
        return;
      }
      const farm = state.buildings.find(
        (building) =>
          building.id === citizen.targetId && building.type === "farm",
      );
      const available = farm?.inventory.food ?? 0;
      if (!farm || available <= 0) {
        fail(citizen);
        return;
      }
      const amount = Math.min(config.carryCapacity, available);
      farm.inventory.food = available - amount;
      citizen.carriedFood = amount;
      const warehouse = findNearestWarehouse(citizen, state);
      if (!warehouse) {
        farm.inventory.food += amount;
        citizen.carriedFood = 0;
        fail(citizen);
        return;
      }
      citizen.carryStage = "to_warehouse";
      citizen.targetId = warehouse.id;
      citizen.targetPosition = { ...warehouse.entrance };
      citizen.path = [];
      citizen.pathIndex = 0;
      citizen.actionProgress = 0;
      citizen.actionState = "waiting";
      return;
    }

    citizen.actionProgress += 1 / config.carryDropoffTicks;
    if (citizen.actionProgress < 1) {
      return;
    }
    const warehouse = state.buildings.find(
      (building) =>
        building.id === citizen.targetId && building.type === "warehouse",
    );
    if (!warehouse) {
      fail(citizen);
      return;
    }
    const stored = warehouse.inventory.food ?? 0;
    const accepted = Math.min(
      citizen.carriedFood,
      Math.max(0, warehouse.capacity - stored),
    );
    warehouse.inventory.food = stored + accepted;
    citizen.carriedFood -= accepted;
    if (citizen.carriedFood > 0) {
      const fallbackFarm = state.buildings.find(
        (building) => building.type === "farm",
      );
      if (fallbackFarm) {
        fallbackFarm.inventory.food =
          (fallbackFarm.inventory.food ?? 0) + citizen.carriedFood;
      }
    }
    citizen.carriedFood = 0;
    complete(citizen);
  }

  private performEating(
    citizen: Citizen,
    state: SimulationState,
    config: SimulationConfig,
    day: number,
  ): void {
    citizen.actionProgress += 1 / config.eatActionTicks;
    if (citizen.actionProgress < 1) {
      return;
    }
    const warehouse = state.buildings.find(
      (building) =>
        building.id === citizen.targetId && building.type === "warehouse",
    );
    const available = warehouse?.inventory.food ?? 0;
    if (!warehouse || available < config.foodPerMeal) {
      fail(citizen);
      return;
    }
    warehouse.inventory.food = available - config.foodPerMeal;
    state.dailyMetrics.foodConsumed += config.foodPerMeal;
    citizen.hunger = Math.max(0, citizen.hunger - config.mealHungerRecovery);
    citizen.lastMealDay = day;
    complete(citizen);
  }

  private performRest(
    citizen: Citizen,
    config: SimulationConfig,
  ): void {
    citizen.actionProgress += 1 / config.restActionTicks;
    if (citizen.actionProgress < 1) {
      return;
    }
    citizen.health = Math.min(100, citizen.health + 2);
    citizen.happiness = Math.min(100, citizen.happiness + 1);
    complete(citizen);
  }

  private performConstruction(
    citizen: Citizen,
    state: SimulationState,
    config: SimulationConfig,
  ): void {
    // 종류와 무관하게 짓는 중인 목표 건물을 건설한다(목수가 있으면 더 빠름).
    const site = state.buildings.find(
      (building) =>
        building.id === citizen.targetId &&
        building.constructionProgress < 100,
    );
    if (!site) {
      complete(citizen);
      return;
    }
    site.constructionProgress = Math.min(
      100,
      site.constructionProgress +
        config.constructionProgressPerTick *
          constructionSpeedMultiplier(state, config),
    );
    citizen.actionProgress = site.constructionProgress / 100;
    if (site.constructionProgress >= 100) {
      state.mapRevision += 1;
      complete(citizen);
    }
  }

  private performCarpentry(
    citizen: Citizen,
    state: SimulationState,
    config: SimulationConfig,
  ): void {
    // 목공소에서 목재를 가공한다(소량 소비). 효과는 건설 속도 가산으로 나타난다.
    if (!this.atWorkshop(citizen, state, "carpentry")) {
      fail(citizen);
      return;
    }
    citizen.actionProgress += 1 / config.carpentryActionTicks;
    if (citizen.actionProgress < 1) {
      return;
    }
    if (state.resources.wood >= 1) {
      state.resources.wood -= 1;
    }
    complete(citizen);
  }

  private performBlacksmith(
    citizen: Citizen,
    state: SimulationState,
    config: SimulationConfig,
    random?: SeededRandom,
  ): void {
    if (!this.atWorkshop(citizen, state, "blacksmith")) {
      fail(citizen);
      return;
    }
    citizen.actionProgress += 1 / config.blacksmithActionTicks;
    if (citizen.actionProgress < 1) {
      return;
    }
    // 광석·연료(돌·나무)를 소비해 도구를 만든다.
    if (state.resources.stone >= 1 && state.resources.wood >= 0.5) {
      state.resources.stone -= 1;
      state.resources.wood = Math.max(0, state.resources.wood - 0.5);
      const noise = Math.max(
        0,
        1 +
          (random?.between(
            -config.dailyProductionNoise,
            config.dailyProductionNoise,
          ) ?? 0),
      );
      state.resources.tools = Math.min(
        config.toolsStockTarget,
        state.resources.tools + config.toolsPerAction * noise,
      );
    }
    complete(citizen);
  }

  private performMarket(
    citizen: Citizen,
    state: SimulationState,
    config: SimulationConfig,
  ): void {
    if (!this.atWorkshop(citizen, state, "market")) {
      fail(citizen);
      return;
    }
    citizen.actionProgress += 1 / config.marketActionTicks;
    if (citizen.actionProgress < 1) {
      return;
    }
    // 잉여 상품을 거래해 마을 수입(money)을 만든다.
    state.resources.money += config.marketIncomePerAction;
    complete(citizen);
  }

  private atWorkshop(
    citizen: Citizen,
    state: SimulationState,
    type: Building["type"],
  ): boolean {
    return state.buildings.some(
      (building) =>
        building.id === citizen.targetId &&
        building.type === type &&
        building.constructionProgress >= 100,
    );
  }
}

function findNearestWarehouse(
  citizen: Citizen,
  state: SimulationState,
) {
  return state.buildings
    .filter(
      (building) =>
        building.type === "warehouse" &&
        building.constructionProgress >= 100,
    )
    .sort((left, right) => {
      const leftDistance =
        Math.abs(citizen.position.x - left.entrance.x) +
        Math.abs(citizen.position.y - left.entrance.y);
      const rightDistance =
        Math.abs(citizen.position.x - right.entrance.x) +
        Math.abs(citizen.position.y - right.entrance.y);
      return leftDistance - rightDistance || left.id.localeCompare(right.id);
    })[0];
}

function complete(citizen: Citizen): void {
  citizen.actionState = "completed";
  citizen.actionProgress = 1;
  citizen.path = [];
  citizen.pathIndex = 0;
}

function fail(citizen: Citizen): void {
  citizen.actionState = "failed";
  citizen.actionProgress = 0;
  citizen.path = [];
  citizen.pathIndex = 0;
}

function updateLegacyAction(citizen: Citizen): void {
  if (citizen.actionState === "moving") {
    citizen.action = "working";
  } else if (citizen.goal === "eat") {
    citizen.action = "eating";
  } else if (
    citizen.goal === "work_farm" ||
    citizen.goal === "forage" ||
    citizen.goal === "gather_wood" ||
    citizen.goal === "gather_stone" ||
    citizen.goal === "work_carpentry" ||
    citizen.goal === "work_blacksmith" ||
    citizen.goal === "work_market" ||
    citizen.goal === "build" ||
    citizen.goal === "carry_food"
  ) {
    citizen.action = "working";
  } else {
    citizen.action = "idle";
  }
}
