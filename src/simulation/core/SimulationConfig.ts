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
