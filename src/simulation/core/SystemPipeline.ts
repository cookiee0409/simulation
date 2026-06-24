import type { SeededRandom } from "./SeededRandom";
import type { SimulationConfig } from "./SimulationConfig";
import {
  processFoodDay,
  type FoodDayResult,
} from "../economy/FoodSystem";
import { buildOneNeededFarm } from "../city/BuildingDemandSystem";
import {
  adjustFarmWorkforce,
  assignWorkersToFarms,
} from "../population/WorkforceSystem";
import type { SimulationState } from "../types";

export interface SystemContext {
  day: number;
  state: SimulationState;
  config: SimulationConfig;
  random: SeededRandom;
  foodResult: FoodDayResult;
}

export interface SimulationSystem {
  readonly name: string;
  update(context: SystemContext): void;
}

export function createEmptyFoodResult(): FoodDayResult {
  return { produced: 0, consumed: 0, unmetDemand: 0, populationLost: 0 };
}

/** 하루가 끝날 때만 실행되는 기존 생산 수요·인력·통계 호환 파이프라인. */
export function createDefaultSystems(): SimulationSystem[] {
  return [
    {
      name: "daily-food-settlement",
      update(context) {
        context.foodResult = processFoodDay(
          context.state,
          context.config,
          context.random,
        );
      },
    },
    {
      name: "farm-construction",
      update(context) {
        buildOneNeededFarm(context.state, context.config, context.random);
      },
    },
    {
      name: "workforce",
      update(context) {
        adjustFarmWorkforce(context.state, context.config);
      },
    },
    {
      name: "worker-assignment",
      update(context) {
        assignWorkersToFarms(context.state);
      },
    },
  ];
}
