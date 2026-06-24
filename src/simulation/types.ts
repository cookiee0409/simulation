export interface GridPosition {
  x: number;
  y: number;
}

export type CitizenJob = "farmer" | "unemployed";
export type CitizenAction = "working" | "eating" | "idle" | "leaving";

export interface CitizenTraits {
  cooperation: number;
  riskTolerance: number;
  savingPreference: number;
}

export interface Citizen {
  id: string;
  age: number;
  job: CitizenJob;
  position: GridPosition;
  homeId?: string;
  wealth: number;
  hunger: number;
  health: number;
  happiness: number;
  canWork: boolean;
  action: CitizenAction;
  groupId: string;
  traits: CitizenTraits;
}

export type BuildingType = "farm" | "house" | "warehouse";

export interface ResourceInventory {
  food: number;
}

export interface Building {
  id: string;
  type: BuildingType;
  position: GridPosition;
  level: number;
  capacity: number;
  workers: string[];
  inventory: ResourceInventory;
  condition: number;
  constructionProgress: number;
  ownerType: "private" | "public";
}

export interface VillageResources {
  food: number;
}

export interface DailyStatistics {
  day: number;
  population: number;
  foodStock: number;
  foodProduced: number;
  foodConsumed: number;
  unmetFoodDemand: number;
  averageHunger: number;
  averageHappiness: number;
  farmerCount: number;
  unemployedCount: number;
  farmCount: number;
  houseCount: number;
  warehouseCount: number;
  housingCapacity: number;
  housingDemand: number;
  populationLost: number;
}

export interface SimulationState {
  citizens: Citizen[];
  buildings: Building[];
  resources: VillageResources;
  statistics: DailyStatistics[];
}

export interface SimulationSnapshot {
  seed: string;
  day: number;
  paused: boolean;
  speed: number;
  citizens: Citizen[];
  buildings: Building[];
  resources: VillageResources;
  latestStatistics: DailyStatistics;
  statistics: DailyStatistics[];
}
