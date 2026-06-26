import type { SeededRandom } from "./SeededRandom";
import type { SimulationConfig } from "./SimulationConfig";
import {
  processFoodDay,
  type FoodDayResult,
} from "../economy/FoodSystem";
import {
  buildOneNeededFarm,
  buildNeededWarehouse,
} from "../city/BuildingDemandSystem";
import { applyMarketDailyEffects } from "../economy/IndustrySystem";
import { updatePopulationDynamics } from "../population/PopulationDynamicsSystem";
import { updateNeeds } from "../needs/NeedSystem";
import { updateProfessionEmergence } from "../professions/ProfessionEmergenceSystem";
import { computeSettlementStage } from "../settlement/SettlementStageSystem";
import type { SimulationState } from "../types";
import type { ScenarioDefinition } from "../scenarios/ScenarioDefinition";
import {
  finalizeScenarioDay,
  updateScenarioDay,
} from "../scenarios/ScenarioSystem";
import { updateHeating } from "../survival/HeatingSystem";
import { updateWinterHealth } from "../survival/IllnessSystem";
import { updateWinterNeeds } from "../survival/WinterNeedSystem";

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

/**
 * 하루 단위 성장 엔진 파이프라인. 순환의 중심:
 * 식량 정산 → 수요 계산 → 직업 창발 → 인구 동학 → 시설 건설 → 발전 단계 평가.
 * 직업은 더 이상 식량 방정식으로 자동 배치되지 않고 수요 기반으로 창발한다.
 */
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
      name: "needs",
      update(context) {
        updateNeeds(context.state, context.config);
      },
    },
    {
      name: "profession-emergence",
      update(context) {
        updateProfessionEmergence(
          context.state,
          context.config,
          context.random,
        );
      },
    },
    {
      name: "industry-effects",
      update(context) {
        applyMarketDailyEffects(context.state, context.config);
      },
    },
    {
      name: "population-dynamics",
      update(context) {
        updatePopulationDynamics(
          context.state,
          context.config,
          context.random,
        );
      },
    },
    {
      name: "infrastructure-construction",
      update(context) {
        buildOneNeededFarm(context.state, context.config, context.random);
        buildNeededWarehouse(context.state, context.config, context.random);
      },
    },
    {
      name: "settlement-stage",
      update(context) {
        context.state.stage = computeSettlementStage(context.state);
      },
    },
  ];
}

/** 성장·출산 대신 환경·난방·체온·종료를 정산하는 혹한 시나리오 파이프라인. */
export function createScenarioSystems(
  definition: ScenarioDefinition,
): SimulationSystem[] {
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
      name: "scenario-weather",
      update(context) {
        updateScenarioDay(
          context.state,
          context.config,
          definition,
          context.day,
          context.random,
        );
      },
    },
    {
      name: "winter-heating",
      update(context) {
        updateHeating(context.state);
      },
    },
    {
      name: "winter-health",
      update(context) {
        updateWinterHealth(context.state, context.day, context.random);
      },
    },
    {
      name: "winter-needs",
      update(context) {
        updateWinterNeeds(context.state, context.config);
      },
    },
    {
      name: "scenario-finalization",
      update(context) {
        finalizeScenarioDay(context.state, definition, context.day);
      },
    },
  ];
}
