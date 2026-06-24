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

/**
 * 한 시뮬레이션 일(day) 동안 모든 시스템이 공유하는 컨텍스트.
 * 시스템 간 결과 전달은 이 객체의 스크래치 필드(예: foodResult)로 한다.
 */
export interface SystemContext {
  day: number;
  state: SimulationState;
  config: SimulationConfig;
  random: SeededRandom;
  foodResult: FoodDayResult;
}

/**
 * 하루 처리에 참여하는 단위 시스템. 경제·건설·이민·범죄 등을 추가할 때
 * 이 인터페이스를 구현해 파이프라인 배열에 끼워 넣기만 하면 된다.
 */
export interface SimulationSystem {
  readonly name: string;
  update(context: SystemContext): void;
}

export function createEmptyFoodResult(): FoodDayResult {
  return { produced: 0, consumed: 0, unmetDemand: 0, populationLost: 0 };
}

/**
 * 1차 구현의 기본 파이프라인. 실행 순서가 곧 하루의 처리 순서다.
 * 향후 시스템은 적절한 위치에 push 하면 된다(예: 식량 뒤에 시장, 통계 앞에 이민).
 */
export function createDefaultSystems(): SimulationSystem[] {
  return [
    {
      name: "food",
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
