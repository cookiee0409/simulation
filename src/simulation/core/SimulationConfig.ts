export const TICKS_PER_DAY = 144;
export const MINUTES_PER_TICK = 10;

export interface SimulationConfig {
  seed: string;
  initialPopulation: number;
  initialFood: number;
  initialFarmers: number;
  initialFarms: number;
  initialHouses: number;
  initialWarehouses: number;
  foodPerCitizenPerDay: number;
  foodPerFarmerPerDay: number;
  farmWorkerCapacity: number;
  houseCapacity: number;
  warehouseCapacity: number;
  maxFarmerTransfersPerDay: number;
  hungerRecoveryPerDay: number;
  hungerGainAtZeroFood: number;
  severeHungerThreshold: number;
  baseSevereHungerExitChance: number;
  landFertilityMin: number;
  landFertilityMax: number;
  landFertility: number;
  dailyProductionNoise: number;
  farmerHealthProductivityFloor: number;
  hungerHealthThreshold: number;
  healthLossPerHungerOverThreshold: number;
  healthRecoveryPerDay: number;
  canWorkHealthThreshold: number;
  happinessBase: number;
  happinessFoodWeight: number;
  happinessHealthWeight: number;
  happinessHungerPenaltyWeight: number;
  happinessEmployedBonus: number;
  happinessUnemployedPenalty: number;

  ticksPerDay: number;
  minutesPerTick: number;
  millisecondsPerTick: number;
  gridSize: number;
  mapWidth: number;
  mapHeight: number;
  perceptionRadius: number;
  decisionCooldownTicks: number;
  movementCellsPerTick: number;
  hungerGainPerTick: number;
  fatigueGainPerTick: number;
  fatigueRecoveryPerRestTick: number;
  emergencyHungerThreshold: number;
  eatHungerThreshold: number;
  foodPerMeal: number;
  mealHungerRecovery: number;
  eatActionTicks: number;
  farmActionTicks: number;
  farmFoodPerAction: number;
  carryPickupTicks: number;
  carryDropoffTicks: number;
  carryCapacity: number;
  restActionTicks: number;
  constructionProgressPerTick: number;
  buildTaskCapacity: number;

  // --- 자원·생산 체인 (나무/돌) ---
  initialWood: number;
  initialStone: number;
  initialLumberyards: number;
  initialQuarries: number;
  initialLumberjacks: number;
  initialMiners: number;
  lumberjackWorkerCapacity: number;
  quarryWorkerCapacity: number;
  woodPerAction: number;
  stonePerAction: number;
  gatherActionTicks: number;
  woodStockTarget: number;
  stoneStockTarget: number;
  houseWoodCost: number;
  houseStoneCost: number;
  maxResourceWorkerTransfersPerDay: number;
}

export const DEFAULT_SIMULATION_CONFIG: Readonly<SimulationConfig> = {
  seed: "village-001",
  initialPopulation: 100,
  initialFood: 250,
  initialFarmers: 12,
  initialFarms: 1,
  initialHouses: 9,
  initialWarehouses: 1,
  foodPerCitizenPerDay: 1,
  foodPerFarmerPerDay: 5.3,
  farmWorkerCapacity: 12,
  houseCapacity: 10,
  warehouseCapacity: 600,
  maxFarmerTransfersPerDay: 5,
  hungerRecoveryPerDay: 12,
  hungerGainAtZeroFood: 34,
  severeHungerThreshold: 78,
  baseSevereHungerExitChance: 0.055,
  landFertilityMin: 0.55,
  landFertilityMax: 1.35,
  landFertility: 1,
  dailyProductionNoise: 0.1,
  farmerHealthProductivityFloor: 0.35,
  hungerHealthThreshold: 55,
  healthLossPerHungerOverThreshold: 0.08,
  healthRecoveryPerDay: 0.25,
  canWorkHealthThreshold: 25,
  happinessBase: 28,
  happinessFoodWeight: 34,
  happinessHealthWeight: 0.2,
  happinessHungerPenaltyWeight: 0.48,
  happinessEmployedBonus: 7,
  happinessUnemployedPenalty: -4,

  ticksPerDay: TICKS_PER_DAY,
  minutesPerTick: MINUTES_PER_TICK,
  millisecondsPerTick: 120,
  gridSize: 20,
  mapWidth: 760,
  mapHeight: 520,
  perceptionRadius: 220,
  decisionCooldownTicks: 8,
  movementCellsPerTick: 1,
  hungerGainPerTick: 0.34,
  fatigueGainPerTick: 0.18,
  fatigueRecoveryPerRestTick: 2.4,
  emergencyHungerThreshold: 72,
  eatHungerThreshold: 32,
  foodPerMeal: 1,
  mealHungerRecovery: 70,
  eatActionTicks: 4,
  farmActionTicks: 20,
  farmFoodPerAction: 1.5,
  carryPickupTicks: 2,
  carryDropoffTicks: 2,
  carryCapacity: 4,
  restActionTicks: 18,
  constructionProgressPerTick: 0.65,
  buildTaskCapacity: 4,

  initialWood: 120,
  initialStone: 80,
  initialLumberyards: 1,
  initialQuarries: 1,
  initialLumberjacks: 4,
  initialMiners: 4,
  lumberjackWorkerCapacity: 6,
  quarryWorkerCapacity: 6,
  woodPerAction: 1.2,
  stonePerAction: 0.9,
  gatherActionTicks: 22,
  woodStockTarget: 200,
  stoneStockTarget: 150,
  houseWoodCost: 10,
  houseStoneCost: 5,
  maxResourceWorkerTransfersPerDay: 4,
};

export function createSimulationConfig(
  overrides: Partial<SimulationConfig> = {},
): SimulationConfig {
  const config = { ...DEFAULT_SIMULATION_CONFIG, ...overrides };
  const nonNegativeKeys: Array<keyof SimulationConfig> = [
    "initialPopulation",
    "initialFood",
    "initialFarmers",
    "initialFarms",
    "initialHouses",
    "initialWarehouses",
    "foodPerCitizenPerDay",
    "foodPerFarmerPerDay",
    "millisecondsPerTick",
    "gridSize",
    "mapWidth",
    "mapHeight",
  ];

  for (const key of nonNegativeKeys) {
    if (typeof config[key] === "number" && config[key] < 0) {
      throw new RangeError(`${key} cannot be negative`);
    }
  }
  if (config.initialFarmers > config.initialPopulation) {
    throw new RangeError("initialFarmers cannot exceed initialPopulation");
  }
  // 벌목공·채석공은 인구를 초과해도 인구공장이 인덱스 순서로 자연스럽게 상한 처리하므로
  // 별도 예외는 두지 않는다(작은 인구 실험 설정 호환).
  if (config.ticksPerDay <= 0 || !Number.isInteger(config.ticksPerDay)) {
    throw new RangeError("ticksPerDay must be a positive integer");
  }
  return config;
}
