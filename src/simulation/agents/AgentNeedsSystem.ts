import type { SimulationConfig } from "../core/SimulationConfig";
import type { Citizen, SimulationState } from "../types";

export class AgentNeedsSystem {
  updateCitizen(
    citizen: Citizen,
    config: SimulationConfig,
    state?: SimulationState,
  ): void {
    citizen.hunger = clamp(
      citizen.hunger + config.hungerGainPerTick,
      0,
      100,
    );
    // 비상시엔 개인 주머니의 식량을 꺼내 먹는다(창고까지 못 가도 버틴다).
    if (
      citizen.hunger >= config.emergencyHungerThreshold &&
      citizen.winter.personalFood > 0
    ) {
      const bite = Math.min(
        citizen.winter.personalFood,
        config.foodPerMeal * 0.25,
      );
      citizen.winter.personalFood -= bite;
      citizen.hunger = clamp(
        citizen.hunger -
          (bite / Math.max(0.001, config.foodPerMeal)) *
            config.mealHungerRecovery,
        0,
        100,
      );
      if (state) {
        state.dailyMetrics.foodConsumed += bite;
      }
    }
    if (citizen.goal === "rest" && citizen.actionState === "performing") {
      citizen.fatigue = clamp(
        citizen.fatigue - config.fatigueRecoveryPerRestTick,
        0,
        100,
      );
    } else if (
      citizen.actionState === "moving" ||
      citizen.actionState === "performing"
    ) {
      citizen.fatigue = clamp(
        citizen.fatigue + config.fatigueGainPerTick,
        0,
        100,
      );
    }
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
