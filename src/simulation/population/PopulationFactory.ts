import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import type { Building, Citizen } from "../types";

export function createCitizens(
  config: SimulationConfig,
  random: SeededRandom,
  houses: Building[],
): Citizen[] {
  const citizens: Citizen[] = [];

  for (let index = 0; index < config.initialPopulation; index += 1) {
    const home = houses[Math.floor(index / config.houseCapacity)];
    citizens.push({
      id: `citizen-${String(index + 1).padStart(3, "0")}`,
      age: random.integer(18, 68),
      job: index < config.initialFarmers ? "farmer" : "unemployed",
      position: {
        x: random.between(90, 690),
        y: random.between(100, 450),
      },
      homeId: home?.id,
      wealth: random.between(80, 120),
      hunger: random.between(0, 8),
      health: random.between(86, 100),
      happiness: random.between(62, 78),
      canWork: true,
      action: "idle",
      groupId: `group-${random.integer(1, 4)}`,
      traits: {
        cooperation: random.integer(0, 100),
        riskTolerance: random.integer(0, 100),
        savingPreference: random.integer(0, 100),
      },
    });
  }

  return citizens;
}
