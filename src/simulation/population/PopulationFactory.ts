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
    const skills = createSkills(random);
    citizens.push({
      id: `citizen-${String(index + 1).padStart(3, "0")}`,
      age: random.integer(config.founderAgeMin, config.founderAgeMax),
      job: "settler",
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
        empathy: random.integer(0, 100),
        selfishness: random.integer(0, 100),
        leadership: random.integer(0, 100),
        patience: random.integer(0, 100),
        attachmentToVillage: random.integer(0, 100),
        ruleFollowing: random.integer(0, 100),
      },
      skills,
      specialty: dominantSkill(skills),
      winter: createWinterState(random),
      fatigue: random.between(0, 12),
      goal: "wander",
      actionState: "deciding",
      path: [],
      pathIndex: 0,
      movementBudget: 0,
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

/**
 * 마을에서 태어난 아이를 생성한다. 부모의 집을 배정받고, 성년이 될 때까지
 * 노동할 수 없는(canWork=false) 무직 아동으로 시작한다.
 */
export function createChild(
  serial: number,
  config: SimulationConfig,
  random: SeededRandom,
  home: Building | undefined,
): Citizen {
  const base = home?.entrance ?? { x: config.mapWidth / 2, y: config.mapHeight / 2 };
  const skills = createSkills(random);
  return {
    id: `citizen-${String(serial).padStart(3, "0")}`,
    age: 0,
    job: "settler",
    position: {
      x: clamp(base.x, config.gridSize, config.mapWidth - config.gridSize),
      y: clamp(base.y, config.gridSize, config.mapHeight - config.gridSize),
    },
    homeId: home?.id,
    wealth: random.between(0, 10),
    hunger: random.between(0, 6),
    health: random.between(88, 100),
    happiness: random.between(60, 80),
    canWork: false,
    action: "idle",
    groupId: home ? `home-${home.id}` : `group-${random.integer(1, 4)}`,
    traits: {
      cooperation: random.integer(0, 100),
      riskTolerance: random.integer(0, 100),
      savingPreference: random.integer(0, 100),
      empathy: random.integer(0, 100),
      selfishness: random.integer(0, 100),
      leadership: random.integer(0, 100),
      patience: random.integer(0, 100),
      attachmentToVillage: random.integer(0, 100),
      ruleFollowing: random.integer(0, 100),
    },
    skills,
    specialty: dominantSkill(skills),
    winter: createWinterState(random),
    fatigue: 0,
    goal: "wander",
    actionState: "deciding",
    path: [],
    pathIndex: 0,
    movementBudget: 0,
    actionProgress: 0,
    decisionCooldown: 0,
    decisionScore: 0,
    decisionReasons: [],
    carriedFood: 0,
    lastMealDay: -1,
  };
}

function createSkills(random: SeededRandom): Citizen["skills"] {
  const specialties: Array<keyof Citizen["skills"]> = [
    "farming",
    "logging",
    "construction",
    "hunting",
    "medicine",
    "cooking",
    "scouting",
    "negotiation",
    "leadership",
  ];
  const specialty = random.pick(specialties);
  const skills = {
    farming: random.integer(10, 65),
    logging: random.integer(10, 65),
    construction: random.integer(10, 65),
    hunting: random.integer(5, 60),
    medicine: random.integer(0, 50),
    cooking: random.integer(10, 60),
    scouting: random.integer(5, 65),
    negotiation: random.integer(5, 65),
    leadership: random.integer(5, 65),
  };
  skills[specialty] = random.integer(72, 95);
  return skills;
}

function dominantSkill(skills: Citizen["skills"]): Citizen["specialty"] {
  return (Object.keys(skills) as Array<keyof Citizen["skills"]>).sort(
    (left, right) => skills[right] - skills[left] || left.localeCompare(right),
  )[0]!;
}

function createWinterState(random: SeededRandom): Citizen["winter"] {
  return {
    bodyTemperature: random.between(36.4, 36.9),
    coldExposure: 0,
    warmth: 80,
    clothingWarmth: random.integer(20, 70),
    illness: random.between(0, 8),
    frostbiteRisk: 0,
    personalFood: 0,
    personalFirewood: 0,
    wetness: 0,
    migrationIntent: 0,
  };
}

function createStartingPosition(
  index: number,
  home: Building | undefined,
  config: SimulationConfig,
): GridPosition {
  const grid = config.gridSize;
  const base = home?.entrance ?? {
    x: config.mapWidth / 2,
    y: config.mapHeight / 2,
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
