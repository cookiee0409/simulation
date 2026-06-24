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
import { createInitialBuildings } from "../city/BuildingFactory";
import { calculateBuildingDemand } from "../city/BuildingDemandSystem";
import { createCitizens } from "../population/PopulationFactory";
import { assignWorkersToFarms } from "../population/WorkforceSystem";
import {
  createDailyStatistics,
  createInitialStatistics,
} from "../statistics/StatisticsSystem";
import {
  createResourcePool,
  type DailyStatistics,
  type SimulationSnapshot,
  type SimulationState,
} from "../types";

/** UI 스냅샷에 포함할 최근 통계 일수. 장기 실행 시 전체 배열 복사를 피한다. */
const RECENT_STATISTICS_WINDOW = 60;

export class SimulationEngine {
  readonly config: Readonly<SimulationConfig>;
  private readonly random: SeededRandom;
  private readonly clock: SimulationClock;
  private readonly state: SimulationState;
  private readonly systems: SimulationSystem[];

  constructor(configOverrides: Partial<SimulationConfig> = {}) {
    const base = createSimulationConfig(configOverrides);

    // 마을별 토지 비옥도: 메인 난수열과 분리된 파생 시드에서 뽑아
    // farmer당 생산성에 곱한다. 같은 base 설정이라도 시드마다 다른 사회 궤적이 나온다.
    const landRandom = new SeededRandom(`${base.seed}:land`);
    const landFertility = landRandom.between(
      base.landFertilityMin,
      base.landFertilityMax,
    );
    this.config = Object.freeze({
      ...base,
      landFertility,
      foodPerFarmerPerDay: base.foodPerFarmerPerDay * landFertility,
    });

    this.random = new SeededRandom(this.config.seed);
    this.clock = new SimulationClock();
    this.systems = createDefaultSystems();

    const buildings = createInitialBuildings(this.config, this.random);
    const houses = buildings.filter((building) => building.type === "house");
    const citizens = createCitizens(this.config, this.random, houses);
    this.state = {
      citizens,
      buildings,
      resources: createResourcePool({ food: this.config.initialFood }),
      statistics: [],
    };
    assignWorkersToFarms(this.state);
  }

  stepDay(): DailyStatistics {
    const day = this.clock.advanceDay();

    const context = {
      day,
      state: this.state,
      config: this.config,
      random: this.random,
      foodResult: createEmptyFoodResult(),
    };
    for (const system of this.systems) {
      system.update(context);
    }

    const statistics = createDailyStatistics(
      day,
      this.state,
      this.config,
      context.foodResult,
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
      landFertility: this.config.landFertility,
      latestStatistics: this.getLatestStatistics(),
      // 일일 통계는 생성 시 동결되어 있으므로 깊은 복사 없이 참조만 공유한다.
      statistics: this.state.statistics.slice(),
      recentStatistics: this.state.statistics.slice(-RECENT_STATISTICS_WINDOW),
    };
  }
}
