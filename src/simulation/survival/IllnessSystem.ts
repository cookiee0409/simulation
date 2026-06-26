import type { SeededRandom } from "../core/SeededRandom";
import { recordScenarioEvent } from "../scenarios/ScenarioSystem";
import { WINTER_BALANCE } from "../scenarios/mountainWinter/winterBalance";
import type { SimulationState } from "../types";

export function updateWinterHealth(
  state: SimulationState,
  day: number,
  random: SeededRandom,
): void {
  if (!state.scenario) {
    return;
  }
  const survivors = [];
  for (const citizen of state.citizens) {
    const temperature = citizen.winter.bodyTemperature;
    if (temperature < 35.5) {
      citizen.winter.illness = clamp(
        citizen.winter.illness +
          (35.5 - temperature) * 4 +
          citizen.winter.coldExposure * 0.025,
        0,
        100,
      );
    } else {
      citizen.winter.illness = Math.max(0, citizen.winter.illness - 1);
    }
    const illnessChance =
      citizen.winter.frostbiteRisk / 1600 +
      (temperature < 35 ? 0.04 : 0);
    if (random.chance(illnessChance)) {
      citizen.winter.illness = clamp(citizen.winter.illness + 6, 0, 100);
    }
    if (temperature < 35) {
      recordScenarioEvent(state, {
        type: "hypothermia",
        day,
        title: "저체온 위험 주민 발생",
        description: `${citizen.id}의 체온이 ${temperature.toFixed(1)}°C까지 내려갔습니다.`,
        severity: "warning",
        citizenId: citizen.id,
      });
    }
    if (temperature < 34.5) {
      citizen.health -= WINTER_BALANCE.hypothermiaHealthLossPerDay;
    }
    if (temperature < 33.2) {
      citizen.health -= WINTER_BALANCE.severeHypothermiaHealthLossPerDay;
    }
    citizen.health -= citizen.winter.illness * 0.025;
    if (citizen.health <= 0) {
      state.scenario.deaths += 1;
      state.dailyMetrics.deaths += 1;
      state.dailyMetrics.winterDeaths += 1;
      recordScenarioEvent(state, {
        type: "death",
        day,
        title: "주민 사망",
        description: `${citizen.id}가 혹한과 질병을 견디지 못했습니다.`,
        severity: "critical",
        citizenId: citizen.id,
      });
      continue;
    }
    survivors.push(citizen);
  }
  state.citizens = survivors;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
