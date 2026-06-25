export const TICKS_PER_DAY = 144;
export const MINUTES_PER_TICK = 10;

export interface SimulationConfig {
  seed: string;
  initialPopulation: number;
  initialFood: number;
  initialFarms: number;
  initialHouses: number;
  initialWarehouses: number;
  foodPerCitizenPerDay: number;
  foodPerFarmerPerDay: number;
  farmWorkerCapacity: number;
  houseCapacity: number;
  warehouseCapacity: number;
  maxFarmerTransfersPerDay: number;
  farmerSurplusRatio: number; // 인구 식량 수요 대비 농부 목표 배수(>1이면 잉여 생산)
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
  lumberjackWorkerCapacity: number;
  quarryWorkerCapacity: number;
  woodPerAction: number;
  stonePerAction: number;
  gatherActionTicks: number;
  woodStockTarget: number;
  stoneStockTarget: number;
  houseWoodCost: number;
  houseStoneCost: number;

  // --- 정착민 생존 채집 ---
  forageActionTicks: number; // 채집 1회 소요 틱
  forageFoodPerAction: number; // 채집 1회 식량
  wildFoodPerDay: number; // 하루 야생 식량 한계(인구가 이를 넘으면 농업 필요)

  // --- 직업 창발(ProfessionEmergence) ---
  opportunityThreshold: number; // 기회 점수가 이 값을 넘어야 후보
  emergenceSustainedDays: number; // 임계 초과가 이 일수 지속되면 1명 전직
  maxEmergencePerDay: number; // 하루 최대 전문 직업 전직 수
  maxFoodEmergencePerDay: number; // 하루 최대 농부 창발 수(식량 직업은 더 빠르게)
  minForagersReserve: number; // 전문 직업 분화 후에도 남겨둘 최소 채집 정착민

  // --- 2차 산업(목공소·대장간·시장) ---
  carpentryActionTicks: number;
  carpenterConstructionBonus: number; // 목수 1명당 건설 속도 가산
  blacksmithActionTicks: number;
  toolsPerAction: number; // 대장간 1회 도구 생산
  toolsStockTarget: number; // 도구 비축 목표(상한)
  maxToolsProductivityBonus: number; // 도구가 주는 최대 생산성 가산
  marketActionTicks: number;
  marketIncomePerAction: number; // 시장 1회 수입(money)
  marketHappinessBonus: number; // 시장 가동 시 일일 행복 가산

  // --- 인구 성장 동학 (출산·노화·사망) ---
  agingYearsPerDay: number; // 하루에 늘어나는 나이(년)
  childMaturityYears: number; // 이 나이 이상이어야 노동 가능
  fertilityMinAge: number; // 출산 가능 최소 나이
  fertilityMaxAge: number; // 출산 가능 최대 나이
  maxAgeYears: number; // 이 나이를 넘으면 노령 사망 확률 적용
  oldAgeDeathChancePerDay: number; // 노령 사망 일일 확률
  birthFoodPerCapita: number; // 출산에 필요한 1인당 식량 비축
  birthChancePerDay: number; // 출산 가능 조합당 일일 확률
  maxBirthsPerDay: number; // 하루 최대 출생 수(점진적 성장)
  housingGrowthBuffer: number; // 인구보다 미리 확보할 주택 여유 인원
  founderAgeMin: number; // 시작 주민 최소 나이
  founderAgeMax: number; // 시작 주민 최대 나이
}

export const DEFAULT_SIMULATION_CONFIG: Readonly<SimulationConfig> = {
  seed: "village-001",
  initialPopulation: 10,
  initialFood: 100,
  initialFarms: 1,
  initialHouses: 3,
  initialWarehouses: 1,
  foodPerCitizenPerDay: 1,
  foodPerFarmerPerDay: 5.3,
  farmWorkerCapacity: 6,
  houseCapacity: 4,
  warehouseCapacity: 600,
  maxFarmerTransfersPerDay: 5,
  farmerSurplusRatio: 1.3,
  hungerRecoveryPerDay: 12,
  hungerGainAtZeroFood: 34,
  severeHungerThreshold: 97,
  baseSevereHungerExitChance: 0.008,
  landFertilityMin: 0.55,
  landFertilityMax: 1.35,
  landFertility: 1,
  dailyProductionNoise: 0.1,
  farmerHealthProductivityFloor: 0.35,
  hungerHealthThreshold: 75,
  healthLossPerHungerOverThreshold: 0.05,
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
  hungerGainPerTick: 0.26,
  fatigueGainPerTick: 0.18,
  fatigueRecoveryPerRestTick: 2.4,
  emergencyHungerThreshold: 50,
  eatHungerThreshold: 30,
  foodPerMeal: 1,
  mealHungerRecovery: 70,
  eatActionTicks: 4,
  farmActionTicks: 16,
  farmFoodPerAction: 3,
  carryPickupTicks: 2,
  carryDropoffTicks: 2,
  carryCapacity: 10,
  restActionTicks: 18,
  constructionProgressPerTick: 0.65,
  buildTaskCapacity: 4,

  initialWood: 40,
  initialStone: 24,
  initialLumberyards: 1,
  initialQuarries: 1,
  lumberjackWorkerCapacity: 4,
  quarryWorkerCapacity: 4,
  woodPerAction: 1.2,
  stonePerAction: 0.9,
  gatherActionTicks: 22,
  woodStockTarget: 120,
  stoneStockTarget: 90,
  houseWoodCost: 8,
  houseStoneCost: 4,

  forageActionTicks: 16,
  forageFoodPerAction: 1.1,
  wildFoodPerDay: 8,
  opportunityThreshold: 45,
  emergenceSustainedDays: 3,
  maxEmergencePerDay: 2,
  maxFoodEmergencePerDay: 2,
  minForagersReserve: 3,

  carpentryActionTicks: 18,
  carpenterConstructionBonus: 0.6,
  blacksmithActionTicks: 22,
  toolsPerAction: 1,
  toolsStockTarget: 30,
  maxToolsProductivityBonus: 0.35,
  marketActionTicks: 16,
  marketIncomePerAction: 2,
  marketHappinessBonus: 4,

  agingYearsPerDay: 0.12,
  childMaturityYears: 15,
  fertilityMinAge: 18,
  fertilityMaxAge: 45,
  maxAgeYears: 70,
  oldAgeDeathChancePerDay: 0.04,
  birthFoodPerCapita: 1.5,
  birthChancePerDay: 0.45,
  maxBirthsPerDay: 1,
  housingGrowthBuffer: 3,
  founderAgeMin: 18,
  founderAgeMax: 30,
};

export function createSimulationConfig(
  overrides: Partial<SimulationConfig> = {},
): SimulationConfig {
  const config = { ...DEFAULT_SIMULATION_CONFIG, ...overrides };
  const nonNegativeKeys: Array<keyof SimulationConfig> = [
    "initialPopulation",
    "initialFood",
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
  // 초기 주민은 모두 정착민이며, 직업은 수요 기반으로 창발한다(시작 직업 인원 설정 없음).
  if (config.ticksPerDay <= 0 || !Number.isInteger(config.ticksPerDay)) {
    throw new RangeError("ticksPerDay must be a positive integer");
  }
  return config;
}
