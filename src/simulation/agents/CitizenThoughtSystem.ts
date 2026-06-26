import type { Citizen, CitizenThought, SimulationState } from "../types";

export function updateCitizenThoughts(state: SimulationState): void {
  for (const citizen of state.citizens) {
    citizen.thought = chooseThought(citizen);
  }
}

function chooseThought(citizen: Citizen): CitizenThought | undefined {
  const candidates: CitizenThought[] = [];

  if (citizen.hunger >= 72) {
    candidates.push({
      label: "배고파",
      urgency: citizen.hunger,
      reason: "hunger",
    });
  }
  if (citizen.fatigue >= 78) {
    candidates.push({
      label: "피곤해",
      urgency: citizen.fatigue,
      reason: "fatigue",
    });
  }
  if (citizen.winter.bodyTemperature <= 35.4 || citizen.winter.coldExposure >= 55) {
    candidates.push({
      label: "추워",
      urgency: Math.max(
        citizen.winter.coldExposure,
        (36.4 - citizen.winter.bodyTemperature) * 45,
      ),
      reason: "cold",
    });
  }
  if (citizen.winter.illness >= 45) {
    candidates.push({
      label: "아파",
      urgency: citizen.winter.illness,
      reason: "illness",
    });
  }
  if (citizen.health <= 38) {
    candidates.push({
      label: "위험해",
      urgency: 100 - citizen.health,
      reason: "low_health",
    });
  }
  if (citizen.winter.migrationIntent >= 72) {
    candidates.push({
      label: "떠날까?",
      urgency: citizen.winter.migrationIntent,
      reason: "migration",
    });
  }

  return candidates.sort(
    (left, right) => right.urgency - left.urgency || left.label.localeCompare(right.label),
  )[0];
}
