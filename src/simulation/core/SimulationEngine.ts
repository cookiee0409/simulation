import {
  createSimulationConfig,
  type SimulationConfig,
} from "./SimulationConfig";
import {
  SimulationClock,
  type SimulationSpeed,
} from "./SimulationClock";
import { SeededRandom } from "./SeededRandom";
import { createInitialBuildings } from "../city/BuildingFactory";
import {
  buildOneNeededFarm,
  calculateBuildingDemand,
} from "../city/BuildingDemandSystem";
import { processFoodDay } from "../economy/FoodSystem";
import { createCitizens } from "../population/PopulationFactory";
import { adjustFarmWorkforce } from "../population/WorkforceSystem";
import {
  createDailyStatistics,
  createInitialStatistics,
} from "../statistics/StatisticsSystem";
import type {
  DailyStatistics,
  SimulationSnapshot,
  SimulationState,
} from "../types";

export class SimulationEngine {
  readonly config: Readonly<SimulationConfig>;
  private readonly random: SeededRandom;
  private readonly clock: SimulationClock;
  private readonly state: SimulationState;

  constructor(configOverrides: Partial<SimulationConfig> = {}) {
    this.config = Object.freeze(createSimulationConfig(configOverrides));
    this.random = new SeededRandom(this.config.seed);
    this.clock = new SimulationClock();

    const buildings = createInitialBuildings(this.config, this.random);
    const houses = buildings.filter((building) => building.type === "house");
    const citizens = createCitizens(this.config, this.random, houses);
    this.state = {
      citizens,
      buildings,
      resources: { food: this.config.initialFood },
      statistics: [],
    };
    this.assignWorkersToFarms();
  }

  stepDay(): DailyStatistics {
    const day = this.clock.advanceDay();
    const foodResult = processFoodDay(this.state, this.config, this.random);

    buildOneNeededFarm(this.state, this.config, this.random);
    adjustFarmWorkforce(this.state, this.config);
    this.assignWorkersToFarms();

    const statistics = createDailyStatistics(
      day,
      this.state,
      this.config,
      foodResult,
    );
    this.state.statistics.push(statistics);
    return { ...statistics };
  }

  runDays(days: number): DailyStatistics[] {
    if (!Number.isInteger(days) || days < 0) {
      throw new RangeError("days must be a non-negative integer");
    }

    const results: DailyStatistics[] = [];
    for (let index = 0; index < days; index += 1) {
      results.push(this.stepDay());
    }
    return results;
  }

  advanceRealTime(realDeltaMilliseconds: number): number {
    const daysToRun = this.clock.consumeElapsed(realDeltaMilliseconds);
    this.runDays(daysToRun);
    return daysToRun;
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
      paused: this.clock.isPaused(),
      speed: this.clock.getSpeed(),
      citizens: this.state.citizens.map((citizen) => ({
        ...citizen,
        position: { ...citizen.position },
        traits: { ...citizen.traits },
      })),
      buildings: this.state.buildings.map((building) => ({
        ...building,
        position: { ...building.position },
        workers: [...building.workers],
        inventory: { ...building.inventory },
      })),
      resources: { ...this.state.resources },
      latestStatistics: this.getLatestStatistics(),
      statistics: this.state.statistics.map((statistics) => ({
        ...statistics,
      })),
    };
  }

  private assignWorkersToFarms(): void {
    const farms = this.state.buildings.filter(
      (building) => building.type === "farm",
    );
    for (const farm of farms) {
      farm.workers = [];
    }

    const farmers = this.state.citizens.filter(
      (citizen) => citizen.job === "farmer",
    );
    let farmIndex = 0;
    for (const farmer of farmers) {
      while (
        farmIndex < farms.length &&
        farms[farmIndex]!.workers.length >= farms[farmIndex]!.capacity
      ) {
        farmIndex += 1;
      }
      const farm = farms[farmIndex];
      farm?.workers.push(farmer.id);
    }
  }
}
