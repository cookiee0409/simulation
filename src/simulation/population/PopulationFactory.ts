import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import type { Building, Citizen, GridPosition } from "../types";

export function createCitizens(
  config: SimulationConfig,
  random: SeededRandom,
  houses: Building[],
): Citizen[] {
  const citizens: Citizen[] = [];
  const completedHouses = houses.filter(
    (house) => house.constructionProgress >= 100,
  );

  for (let index = 0; index < config.initialPopulation; index += 1) {
    const home = completedHouses[Math.floor(index / config.houseCapacity)];
    const position = createStartingPosition(index, home, config);
    citizens.push({
      id: `citizen-${String(index + 1).padStart(3, "0")}`,
      age: random.integer(18, 68),
      job: index < config.initialFarmers ? "farmer" : "unemployed",
      position,
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
      fatigue: random.between(0, 12),
      goal: "wander",
      actionState: "deciding",
      path: [],
      pathIndex: 0,
      actionProgress: 0,
      decisionCooldown: 0,
      decisionScore: 0,
      decisionReasons: [],
      carriedFood: 0,
      lastMealDay: -1,
    });
  }
  return citizens;
}

function createStartingPosition(
  index: number,
  home: Building | undefined,
  config: SimulationConfig,
): GridPosition {
  const grid = config.gridSize;
  const base = home?.entrance ?? {
    x: 360,
    y: 260,
  };
  const offsets = [
    { x: 0, y: 0 },
    { x: -grid, y: 0 },
    { x: grid, y: 0 },
    { x: 0, y: grid },
    { x: -grid, y: grid },
    { x: grid, y: grid },
  ];
  const offset = offsets[index % offsets.length]!;
  return {
    x: clamp(base.x + offset.x, grid, config.mapWidth - grid),
    y: clamp(base.y + offset.y, grid, config.mapHeight - grid),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
