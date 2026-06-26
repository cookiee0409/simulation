import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import {
  constructionSpeedMultiplier,
  toolProductivityMultiplier,
} from "../economy/IndustrySystem";
import type { Building, Citizen, SimulationState } from "../types";
import { convertWoodToFirewood } from "../survival/FirewoodSystem";
import {
  insulateBuilding,
  repairBuilding,
} from "../survival/BuildingInsulationSystem";
import { recordScenarioEvent } from "../scenarios/ScenarioSystem";
import { WINTER_BALANCE } from "../scenarios/mountainWinter/winterBalance";

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
      case "process_firewood":
        this.performFirewoodProcessing(citizen, state);
        break;
      case "heat_home":
        this.performHeating(citizen, state);
        break;
      case "repair_shelter":
        this.performShelterWork(citizen, state, day, "repair");
        break;
      case "insulate_shelter":
        this.performShelterWork(citizen, state, day, "insulate");
        break;
      case "care_sick":
        this.performCare(citizen, state);
        break;
      case "migrate":
        this.performMigration(citizen, state, day);
        break;
      case "forge_tools":
        this.performForge(citizen, state, config);
        break;
      case "trade_supplies":
        this.performTrade(citizen, state, config);
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
    const canFarm =
      citizen.job === "farmer" ||
      (state.scenario !== undefined &&
        citizen.temporaryRole === "food_gatherer" &&
        citizen.skills.farming >= 45);
    if (!farm || !canFarm || !citizen.canWork) {
      fail(citizen);
      return;
    }
    const workSpeed = skillMultiplier(citizen, "farming", 0.7);
    citizen.actionProgress += workSpeed / config.farmActionTicks;
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
      (state.scenario?.agricultureProductivity ?? 1) *
      skillMultiplier(citizen, "farming", 0.45) *
      Math.max(
        0,
        1 +
          (random?.between(
            -config.dailyProductionNoise,
            config.dailyProductionNoise,
          ) ?? 0),
      );
    const winterWarehouse = state.scenario
      ? findNearestWarehouse(citizen, state)
      : undefined;
    if (winterWarehouse) {
      winterWarehouse.inventory.food = Math.min(
        winterWarehouse.capacity,
        (winterWarehouse.inventory.food ?? 0) + amount,
      );
    } else {
      farm.inventory.food = (farm.inventory.food ?? 0) + amount;
    }
    state.dailyMetrics.foodProduced += amount;
    pushVisualEvent(state, {
      position: farm.position,
      icon: "🌾",
      label: `+${formatAmount(amount)}`,
      resource: "food",
    });
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
    citizen.actionProgress +=
      skillMultiplier(citizen, "hunting", 0.35) / config.forageActionTicks;
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
      pushVisualEvent(state, {
        position: warehouse.position,
        icon: "🧺",
        label: `+${formatAmount(amount)}`,
        resource: "food",
      });
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
    const canGather =
      citizen.job === requiredJob ||
      (resource === "wood" &&
        state.scenario !== undefined &&
        citizen.temporaryRole === "wood_gatherer");
    if (!site || !canGather || !citizen.canWork) {
      fail(citizen);
      return;
    }
    const skillName = resource === "wood" ? "logging" : "construction";
    citizen.actionProgress +=
      skillMultiplier(citizen, skillName, 0.55) / config.gatherActionTicks;
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
      (resource === "wood"
        ? 0.65 + citizen.skills.logging / 160
        : 0.75 + citizen.skills.construction / 240) *
      skillMultiplier(citizen, skillName, 0.25) *
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
    pushVisualEvent(state, {
      position: site.position,
      icon: resource === "wood" ? "🪵" : "🪨",
      label: `+${formatAmount(amount)}`,
      resource,
    });
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
    if (accepted > 0) {
      pushVisualEvent(state, {
        position: warehouse.position,
        icon: "📦",
        label: `+${formatAmount(accepted)}`,
        resource: "food",
      });
    }
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
      pushVisualEvent(state, {
        position: site.position,
        icon: "🏠",
        label: "완성",
        resource: "construction",
      });
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
    const workshop = findTargetBuilding(citizen, state, "blacksmith");
    if (!workshop) {
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
      const produced = config.toolsPerAction * noise;
      state.resources.tools = Math.min(
        config.toolsStockTarget,
        state.resources.tools + produced,
      );
      pushVisualEvent(state, {
        position: workshop.position,
        icon: "🛠️",
        label: `+${formatAmount(produced)}`,
        resource: "tools",
      });
    }
    complete(citizen);
  }

  private performMarket(
    citizen: Citizen,
    state: SimulationState,
    config: SimulationConfig,
  ): void {
    const market = findTargetBuilding(citizen, state, "market");
    if (!market) {
      fail(citizen);
      return;
    }
    citizen.actionProgress += 1 / config.marketActionTicks;
    if (citizen.actionProgress < 1) {
      return;
    }
    // 잉여 상품을 거래해 마을 수입(money)을 만든다.
    state.resources.money += config.marketIncomePerAction;
    pushVisualEvent(state, {
      position: market.position,
      icon: "🪙",
      label: `+${formatAmount(config.marketIncomePerAction)}`,
      resource: "money",
    });
    complete(citizen);
  }

  private performFirewoodProcessing(
    citizen: Citizen,
    state: SimulationState,
  ): void {
    citizen.actionProgress += skillMultiplier(citizen, "logging", 0.5) / 8;
    if (citizen.actionProgress < 1) {
      return;
    }
    const beforeFirewood = state.resources.firewood;
    // 도구가 비축돼 있으면 가공 효율이 오르고, 도구는 조금씩 마모된다.
    const toolFactor =
      1 + toolReadiness(state) * WINTER_BALANCE.toolFirewoodBonus;
    if (state.resources.tools > 0) {
      state.resources.tools = Math.max(
        0,
        state.resources.tools - WINTER_BALANCE.toolWearPerUse,
      );
    }
    convertWoodToFirewood(
      state,
      (1.2 + citizen.skills.logging / 100) *
        skillMultiplier(citizen, "logging", 0.25) *
        toolFactor,
    );
    const produced = state.resources.firewood - beforeFirewood;
    if (produced > 0) {
      const site = findTargetBuilding(citizen, state);
      pushVisualEvent(state, {
        position: site?.position ?? citizen.position,
        icon: "🔥",
        label: `+${formatAmount(produced)}`,
        resource: "firewood",
      });
    }
    complete(citizen);
  }

  private performForge(
    citizen: Citizen,
    state: SimulationState,
    _config: SimulationConfig,
  ): void {
    const forge = state.buildings.find(
      (building) =>
        building.id === citizen.targetId &&
        building.type === "blacksmith" &&
        building.constructionProgress >= 100,
    );
    if (
      !forge ||
      state.resources.stone <
        WINTER_BALANCE.forgeStoneCost + WINTER_BALANCE.stoneReserveForRepair
    ) {
      fail(citizen);
      return;
    }
    citizen.actionProgress += skillMultiplier(citizen, "construction", 0.5) / 9;
    if (citizen.actionProgress < 1) {
      return;
    }
    state.resources.stone -= WINTER_BALANCE.forgeStoneCost;
    const made =
      WINTER_BALANCE.forgeToolsPerAction *
      skillMultiplier(citizen, "construction", 0.3);
    state.resources.tools = Math.min(
      WINTER_BALANCE.toolsStockCap,
      state.resources.tools + made,
    );
    pushVisualEvent(state, {
      position: forge.position,
      icon: "🔨",
      label: `도구 +${formatAmount(made)}`,
      resource: "tools",
    });
    complete(citizen);
  }

  private performTrade(
    citizen: Citizen,
    state: SimulationState,
    _config: SimulationConfig,
  ): void {
    const market = state.buildings.find(
      (building) =>
        building.id === citizen.targetId &&
        building.type === "market" &&
        building.constructionProgress >= 100,
    );
    const canTrade =
      market &&
      state.resources.stone >=
        WINTER_BALANCE.tradeSurplusStoneFloor + WINTER_BALANCE.tradeStoneGiven;
    if (!canTrade) {
      fail(citizen);
      return;
    }
    citizen.actionProgress += skillMultiplier(citizen, "negotiation", 0.5) / 7;
    if (citizen.actionProgress < 1) {
      return;
    }
    // 외부 행상과 교환: 남는 돌을 내주고 식량·땔감·의약품을 받는다.
    state.resources.stone -= WINTER_BALANCE.tradeStoneGiven;
    const dealFactor = skillMultiplier(citizen, "negotiation", 0.35);
    state.resources.food += WINTER_BALANCE.tradeFoodGained * dealFactor;
    state.resources.firewood += WINTER_BALANCE.tradeFirewoodGained * dealFactor;
    state.resources.medicine += WINTER_BALANCE.tradeMedicineGained * dealFactor;
    pushVisualEvent(state, {
      position: market!.position,
      icon: "🛒",
      label: "교역",
      resource: "food",
    });
    complete(citizen);
  }

  private performHeating(
    citizen: Citizen,
    state: SimulationState,
  ): void {
    const building = state.buildings.find(
      (candidate) =>
        candidate.id === citizen.targetId &&
        candidate.type === "house",
    );
    if (!building || state.resources.firewood <= 0) {
      fail(citizen);
      return;
    }
    citizen.actionProgress += skillMultiplier(citizen, "cooking", 0.25) / 4;
    if (citizen.actionProgress < 1) {
      return;
    }
    const transferred = Math.min(3, state.resources.firewood);
    state.resources.firewood -= transferred;
    building.winter.firewoodStored += transferred;
    building.winter.heatingLevel = Math.max(
      building.winter.heatingLevel,
      0.75,
    );
    pushVisualEvent(state, {
      position: building.position,
      icon: "🔥",
      label: `+${formatAmount(transferred)}`,
      resource: "heat",
    });
    complete(citizen);
  }

  private performShelterWork(
    citizen: Citizen,
    state: SimulationState,
    day: number,
    type: "repair" | "insulate",
  ): void {
    const building = state.buildings.find(
      (candidate) =>
        candidate.id === citizen.targetId &&
        candidate.type === "house",
    );
    if (!building) {
      fail(citizen);
      return;
    }
    const speed =
      (14 - Math.min(6, citizen.skills.construction / 18)) /
      skillMultiplier(citizen, "construction", 0.35);
    citizen.actionProgress += 1 / speed;
    if (citizen.actionProgress < 1) {
      return;
    }
    const succeeded =
      type === "repair"
        ? repairBuilding(state, building, day)
        : insulateBuilding(state, building, day);
    if (succeeded) {
      pushVisualEvent(state, {
        position: building.position,
        icon: type === "repair" ? "🔨" : "🧣",
        label: type === "repair" ? "수리" : "단열",
        resource: "construction",
      });
    }
    succeeded ? complete(citizen) : fail(citizen);
  }

  private performCare(
    citizen: Citizen,
    state: SimulationState,
  ): void {
    const patient = state.citizens.find(
      (candidate) => candidate.id === citizen.targetId,
    );
    if (!patient || patient.id === citizen.id) {
      fail(citizen);
      return;
    }
    citizen.actionProgress += skillMultiplier(citizen, "medicine", 0.55) / 10;
    if (citizen.actionProgress < 1) {
      return;
    }
    const medicineBonus =
      state.resources.medicine > 0 ? 1 : 0.45;
    if (state.resources.medicine > 0) {
      state.resources.medicine = Math.max(
        0,
        state.resources.medicine - 0.25,
      );
    }
    const skill =
      (0.65 + citizen.skills.medicine / 130) *
      skillMultiplier(citizen, "medicine", 0.25);
    patient.winter.illness = Math.max(
      0,
      patient.winter.illness -
        WINTER_BALANCE.illnessRecoveryWithCare *
          medicineBonus *
          skill,
    );
    patient.winter.bodyTemperature = Math.min(
      36.8,
      patient.winter.bodyTemperature + 0.25 * skill,
    );
    patient.health = Math.min(100, patient.health + 1.5 * skill);
    state.dailyMetrics.careActions += 1;
    if (state.scenario) {
      state.scenario.careActions += 1;
    }
    pushVisualEvent(state, {
      position: patient.position,
      icon: "💊",
      label: "치료",
      resource: "care",
    });
    complete(citizen);
  }

  private performMigration(
    citizen: Citizen,
    state: SimulationState,
    day: number,
  ): void {
    citizen.actionProgress += 1 / 12;
    if (citizen.actionProgress < 1) {
      return;
    }
    citizen.action = "leaving";
    state.citizens = state.citizens.filter(
      (candidate) => candidate.id !== citizen.id,
    );
    state.dailyMetrics.migrations += 1;
    state.dailyMetrics.populationLost += 1;
    if (state.scenario) {
      state.scenario.migrated += 1;
    }
    recordScenarioEvent(state, {
      type: "migration",
      day,
      title: "주민 이주",
      description: `${citizen.id}이 생존을 위해 산길을 떠났습니다.`,
      severity: "warning",
      citizenId: citizen.id,
    });
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

function findTargetBuilding(
  citizen: Citizen,
  state: SimulationState,
  type?: Building["type"],
): Building | undefined {
  return state.buildings.find(
    (building) =>
      building.id === citizen.targetId &&
      building.constructionProgress >= 100 &&
      (type === undefined || building.type === type),
  );
}

function pushVisualEvent(
  state: SimulationState,
  event: Omit<SimulationState["visualEvents"][number], "id">,
): void {
  const id = `visual-${state.nextVisualEventSerial}`;
  state.nextVisualEventSerial += 1;
  state.visualEvents.push({
    id,
    position: { ...event.position },
    icon: event.icon,
    label: event.label,
    resource: event.resource,
  });
  if (state.visualEvents.length > 80) {
    state.visualEvents = state.visualEvents.slice(-80);
  }
}

function formatAmount(value: number): string {
  return value >= 10 ? Math.round(value).toString() : value.toFixed(1);
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

/** 도구 비축 준비도(0~1). 대장간 산출에 따라 1차 작업 효율이 오른다. */
function toolReadiness(state: SimulationState): number {
  return Math.min(1, state.resources.tools / WINTER_BALANCE.toolsStockCap);
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
    citizen.goal === "process_firewood" ||
    citizen.goal === "heat_home" ||
    citizen.goal === "repair_shelter" ||
    citizen.goal === "insulate_shelter" ||
    citizen.goal === "care_sick" ||
    citizen.goal === "forge_tools" ||
    citizen.goal === "trade_supplies" ||
    citizen.goal === "build" ||
    citizen.goal === "carry_food"
  ) {
    citizen.action = "working";
  } else {
    citizen.action = "idle";
  }
}

function skillMultiplier(
  citizen: Citizen,
  skill: keyof Citizen["skills"],
  weight: number,
): number {
  const base = 0.75 + (citizen.skills[skill] / 100) * weight;
  return citizen.specialty === skill ? base + 0.18 : base;
}
