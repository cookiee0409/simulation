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

  // 마을별 토지 비옥도. 시드에서 [min, max] 범위로 뽑아 농부 생산성에 곱한다.
  // 같은 base 설정이라도 시드마다 다른 사회 궤적이 나오도록 하는 핵심 분산 장치.
  landFertilityMin: number;
  landFertilityMax: number;
  // 적용된 비옥도(엔진이 시드로부터 계산해 덮어쓴다). 기본 설정값은 중립값 1.
  landFertility: number;
  // 매일 생산에 적용하는 ±비율의 확률 요동. 0이면 요동 없음.
  dailyProductionNoise: number;

  // --- 생산성/건강/행복 공식 상수 (데이터 기반 튜닝용) ---
  farmerHealthProductivityFloor: number; // 건강이 낮아도 보장되는 최소 생산성 비율
  hungerHealthThreshold: number; // 이 배고픔을 넘으면 건강이 깎인다
  healthLossPerHungerOverThreshold: number; // 임계 초과 배고픔 1당 건강 감소
  healthRecoveryPerDay: number; // 배부를 때 하루 건강 회복량
  canWorkHealthThreshold: number; // 이 건강 이하이면 노동 불가
  happinessBase: number; // 행복도 기본값
  happinessFoodWeight: number; // 식량 충족도 가중치
  happinessHealthWeight: number; // 건강 가중치
  happinessHungerPenaltyWeight: number; // 배고픔 가중 패널티
  happinessEmployedBonus: number; // 농부(고용) 보너스
  happinessUnemployedPenalty: number; // 무직 패널티
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
  ];

  for (const key of nonNegativeKeys) {
    if (typeof config[key] === "number" && config[key] < 0) {
      throw new RangeError(`${key} cannot be negative`);
    }
  }

  if (config.initialFarmers > config.initialPopulation) {
    throw new RangeError("initialFarmers cannot exceed initialPopulation");
  }

  return config;
}
