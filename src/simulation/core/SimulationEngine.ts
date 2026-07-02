import {
  createSimulationConfig,
  type SimulationConfig,
} from "./SimulationConfig";
import {
  SimulationClock,
  type SimulationSpeed,
} from "./SimulationClock";
import { SeededRandom } from "./SeededRandom";
import {
  createDefaultSystems,
  createEmptyFoodResult,
  createScenarioSystems,
  type SimulationSystem,
} from "./SystemPipeline";
import { TickPipeline } from "./TickPipeline";
import { createInitialBuildings } from "../city/BuildingFactory";
import { calculateBuildingDemand } from "../city/BuildingDemandSystem";
import { synchronizeVillageFood } from "../economy/FoodSystem";
import { GridPathfinder } from "../pathfinding/GridPathfinder";
import { createCitizens } from "../population/PopulationFactory";
import {
  cloneVillageLayout,
  createFenceBlockedCells,
  createVillageLayout,
} from "../map/VillageLayout";
import { updateNeeds } from "../needs/NeedSystem";
import type { ScenarioDefinition } from "../scenarios/ScenarioDefinition";
import { createScenarioRuntime } from "../scenarios/ScenarioSystem";
import {
  initializeMountainWinterState,
  scenarioConfigOverrides,
} from "../scenarios/mountainWinter/MountainWinterSetup";
import { updateWinterNeeds } from "../survival/WinterNeedSystem";
import { computeSettlementStage } from "../settlement/SettlementStageSystem";
import {
  createDailyStatistics,
  createInitialStatistics,
} from "../statistics/StatisticsSystem";
import {
  createResourcePool,
  type ActivitySummary,
  type DailyStatistics,
  type SimulationSnapshot,
  type SimulationState,
} from "../types";

const RECENT_STATISTICS_WINDOW = 60;

export class SimulationEngine {
  readonly config: Readonly<SimulationConfig>;
  private readonly random: SeededRandom;
  private readonly clock: SimulationClock;
  private readonly state: SimulationState;
  private readonly dailySystems: SimulationSystem[];
  private readonly pathfinder: GridPathfinder;
  private readonly tickPipeline: TickPipeline;
  private readonly scenarioDefinition?: ScenarioDefinition;

  constructor(
    configOverrides: Partial<SimulationConfig> = {},
    scenarioDefinition?: ScenarioDefinition,
  ) {
    this.scenarioDefinition = scenarioDefinition;
    const base = createSimulationConfig({
      ...(scenarioDefinition
        ? scenarioConfigOverrides(scenarioDefinition)
        : {}),
      ...configOverrides,
    });
    const landRandom = new SeededRandom(`${base.seed}:land`);
    const landFertility = landRandom.between(
      base.landFertilityMin,
      base.landFertilityMax,
    );
    this.config = Object.freeze({
      ...base,
      landFertility,
    });

    this.random = new SeededRandom(this.config.seed);
    this.clock = new SimulationClock(
      this.config.millisecondsPerTick,
      this.config.ticksPerDay,
      this.config.minutesPerTick,
    );
    this.dailySystems = scenarioDefinition
      ? createScenarioSystems(scenarioDefinition)
      : createDefaultSystems();
    const layout = createVillageLayout(this.config);
    this.pathfinder = new GridPathfinder(
      this.config,
      scenarioDefinition ? createFenceBlockedCells(layout, this.config) : [],
    );
    this.tickPipeline = new TickPipeline(this.pathfinder);

    const buildings = createInitialBuildings(this.config, this.random);
    const houses = buildings.filter((building) => building.type === "house");
    const citizens = createCitizens(this.config, this.random, houses);
    this.state = {
      citizens,
      buildings,
      resources: createResourcePool({
        wood: this.config.initialWood,
        stone: this.config.initialStone,
      }),
      tasks: [],
      statistics: [],
      dailyMetrics: {
        foodProduced: 0,
        foodConsumed: 0,
        populationLost: 0,
        births: 0,
        deaths: 0,
        foragedToday: 0,
        winterDeaths: 0,
        migrations: 0,
        careActions: 0,
        repairsCompleted: 0,
        insulationUpgrades: 0,
      },
      mapRevision: 0,
      nextCitizenSerial: citizens.length + 1,
      needs: [],
      winterNeeds: [],
      opportunities: [],
      stage: "camp",
      scenario: scenarioDefinition
        ? createScenarioRuntime(scenarioDefinition)
        : undefined,
      layout,
      visualEvents: [],
      nextVisualEventSerial: 1,
    };
    if (this.state.scenario) {
      this.state.scenario.initialPopulation = citizens.length;
    }
    if (scenarioDefinition) {
      initializeMountainWinterState(
        this.state,
        scenarioDefinition,
        this.random,
      );
      updateWinterNeeds(this.state, this.config);
    }
    synchronizeVillageFood(this.state);
    updateNeeds(this.state, this.config);
    this.state.stage = computeSettlementStage(this.state);
    this.tickPipeline.taskBoard.update(
      this.state,
      this.config,
      this.random,
    );
  }

  stepTick(): DailyStatistics | undefined {
    this.tickPipeline.update(
      this.state,
      this.config,
      this.random,
      this.clock.getDay(),
      this.clock.getTickInDay(),
    );
    const advance = this.clock.advanceTick();
    if (!advance.completedDay) {
      return undefined;
    }
    return this.finishDay(advance.day);
  }

  stepDay(): DailyStatistics {
    const currentDay = this.clock.getDay();
    let completed: DailyStatistics | undefined;
    while (this.clock.getDay() === currentDay) {
      completed = this.stepTick() ?? completed;
    }
    return completed!;
  }

  runTicks(count: number): DailyStatistics[] {
    assertNonNegativeInteger(count, "count");
    const completedDays: DailyStatistics[] = [];
    for (let index = 0; index < count; index += 1) {
      const statistics = this.stepTick();
      if (statistics) {
        completedDays.push(statistics);
      }
    }
    return completedDays;
  }

  runDays(days: number): DailyStatistics[] {
    assertNonNegativeInteger(days, "days");
    const results: DailyStatistics[] = [];
    for (let index = 0; index < days; index += 1) {
      results.push(this.stepDay());
    }
    return results;
  }

  advanceRealTime(realDeltaMilliseconds: number): number {
    const ticksToRun = this.clock.consumeElapsed(realDeltaMilliseconds);
    this.runTicks(ticksToRun);
    return ticksToRun;
  }

  setPaused(paused: boolean): void {
    this.clock.setPaused(paused);
  }

  setSpeed(speed: SimulationSpeed): void {
    this.clock.setSpeed(speed);
  }

  getLatestStatistics(): DailyStatistics {
    const latest = this.state.statistics.at(-1);
    return latest
      ? { ...latest }
      : createInitialStatistics(this.state, this.config);
  }

  getBuildingDemand(): { farms: number; houses: number } {
    return calculateBuildingDemand(this.state, this.config);
  }

  getSnapshot(): SimulationSnapshot {
    return {
      seed: this.config.seed,
      day: this.clock.getDay(),
      tick: this.clock.getTick(),
      tickInDay: this.clock.getTickInDay(),
      minuteOfDay: this.clock.getMinuteOfDay(),
      paused: this.clock.isPaused(),
      speed: this.clock.getSpeed(),
      citizens: this.state.citizens.map((citizen) => ({
        ...citizen,
        position: { ...citizen.position },
        targetPosition: citizen.targetPosition
          ? { ...citizen.targetPosition }
          : undefined,
        path: citizen.path.map((point) => ({ ...point })),
        decisionReasons: citizen.decisionReasons.map((reason) => ({
          ...reason,
        })),
        aspiration: { ...citizen.aspiration },
        memories: citizen.memories.map((memory) => ({ ...memory })),
        traits: { ...citizen.traits },
        skills: { ...citizen.skills },
        thought: citizen.thought ? { ...citizen.thought } : undefined,
        winter: { ...citizen.winter },
      })),
      buildings: this.state.buildings.map((building) => ({
        ...building,
        position: { ...building.position },
        entrance: { ...building.entrance },
        workers: [...building.workers],
        inventory: { ...building.inventory },
        winter: { ...building.winter },
      })),
      resources: { ...this.state.resources },
      tasks: this.state.tasks.map((task) => ({
        ...task,
        targetPosition: { ...task.targetPosition },
        assignedCitizenIds: [...task.assignedCitizenIds],
      })),
      activitySummary: createActivitySummary(this.state),
      pathfinding: this.pathfinder.getStatistics(),
      landFertility: this.config.landFertility,
      mapWidth: this.config.mapWidth,
      mapHeight: this.config.mapHeight,
      stage: this.state.stage,
      needs: this.state.needs.map((need) => ({
        ...need,
        causes: need.causes.map((cause) => ({ ...cause })),
      })),
      winterNeeds: this.state.winterNeeds.map((need) => ({
        ...need,
        reasons: need.reasons.map((reason) => ({ ...reason })),
      })),
      layout: cloneVillageLayout(this.state.layout),
      visualEvents: this.state.visualEvents.map((event) => ({
        ...event,
        position: { ...event.position },
      })),
      scenario: this.state.scenario
        ? {
            ...this.state.scenario,
            events: this.state.scenario.events.map((event) => ({
              ...event,
            })),
            outcome: this.state.scenario.outcome
              ? { ...this.state.scenario.outcome }
              : undefined,
          }
        : undefined,
      opportunities: this.state.opportunities.map((opportunity) => ({
        ...opportunity,
        relatedNeeds: [...opportunity.relatedNeeds],
        reasons: opportunity.reasons.map((reason) => ({ ...reason })),
        eligibleCitizenIds: [...opportunity.eligibleCitizenIds],
      })),
      latestStatistics: this.getLatestStatistics(),
      statistics: this.state.statistics.slice(),
      recentStatistics: this.state.statistics.slice(-RECENT_STATISTICS_WINDOW),
    };
  }

  private finishDay(day: number): DailyStatistics {
    const context = {
      day,
      state: this.state,
      config: this.config,
      random: this.random,
      foodResult: createEmptyFoodResult(),
    };
    for (const system of this.dailySystems) {
      system.update(context);
    }
    synchronizeVillageFood(this.state);
    const statistics = createDailyStatistics(
      day,
      this.state,
      this.config,
      context.foodResult,
    );
    this.state.statistics.push(statistics);
    this.state.dailyMetrics = {
      foodProduced: 0,
      foodConsumed: 0,
      populationLost: 0,
      births: 0,
      deaths: 0,
      foragedToday: 0,
      winterDeaths: 0,
      migrations: 0,
      careActions: 0,
      repairsCompleted: 0,
      insulationUpgrades: 0,
    };
    return { ...statistics };
  }
}

function createActivitySummary(state: SimulationState): ActivitySummary {
  const summary: ActivitySummary = {
    moving: 0,
    farming: 0,
    eating: 0,
    carrying: 0,
    building: 0,
    resting: 0,
    waiting: 0,
  };
  for (const citizen of state.citizens) {
    if (citizen.actionState === "moving") {
      summary.moving += 1;
    } else if (
      citizen.goal === "work_farm" ||
      citizen.goal === "forage" ||
      citizen.goal === "gather_wood" ||
      citizen.goal === "gather_stone"
    ) {
      summary.farming += 1;
    } else if (citizen.goal === "eat") {
      summary.eating += 1;
    } else if (citizen.goal === "carry_food") {
      summary.carrying += 1;
    } else if (citizen.goal === "build") {
      summary.building += 1;
    } else if (citizen.goal === "rest") {
      summary.resting += 1;
    } else {
      summary.waiting += 1;
    }
  }
  return summary;
}

function assertNonNegativeInteger(value: number, name: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative integer`);
  }
}
