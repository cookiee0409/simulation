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
  type SimulationSystem,
} from "./SystemPipeline";
import { TickPipeline } from "./TickPipeline";
import { createInitialBuildings } from "../city/BuildingFactory";
import { calculateBuildingDemand } from "../city/BuildingDemandSystem";
import { synchronizeVillageFood } from "../economy/FoodSystem";
import { GridPathfinder } from "../pathfinding/GridPathfinder";
import { createCitizens } from "../population/PopulationFactory";
import { assignWorkersToFarms } from "../population/WorkforceSystem";
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

  constructor(configOverrides: Partial<SimulationConfig> = {}) {
    const base = createSimulationConfig(configOverrides);
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
    this.dailySystems = createDefaultSystems();
    this.pathfinder = new GridPathfinder(this.config);
    this.tickPipeline = new TickPipeline(this.pathfinder);

    const buildings = createInitialBuildings(this.config, this.random);
    const houses = buildings.filter((building) => building.type === "house");
    const citizens = createCitizens(this.config, this.random, houses);
    this.state = {
      citizens,
      buildings,
      resources: createResourcePool(),
      tasks: [],
      statistics: [],
      dailyMetrics: {
        foodProduced: 0,
        foodConsumed: 0,
        populationLost: 0,
      },
      mapRevision: 0,
    };
    synchronizeVillageFood(this.state);
    assignWorkersToFarms(this.state);
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
        traits: { ...citizen.traits },
      })),
      buildings: this.state.buildings.map((building) => ({
        ...building,
        position: { ...building.position },
        entrance: { ...building.entrance },
        workers: [...building.workers],
        inventory: { ...building.inventory },
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
    } else if (citizen.goal === "work_farm") {
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
