import type { SimulationConfig } from "../core/SimulationConfig";
import type { Citizen } from "../types";

export class AgentNeedsSystem {
  updateCitizen(citizen: Citizen, config: SimulationConfig): void {
    citizen.hunger = clamp(
      citizen.hunger + config.hungerGainPerTick,
      0,
      100,
    );
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
