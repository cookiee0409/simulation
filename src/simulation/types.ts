export interface GridPosition {
  x: number;
  y: number;
}

export type CitizenJob =
  | "farmer"
  | "lumberjack"
  | "miner"
  | "unemployed";
export type CitizenAction = "working" | "eating" | "idle" | "leaving";

export type CitizenGoal =
  | "eat"
  | "work_farm"
  | "gather_wood"
  | "gather_stone"
  | "carry_food"
  | "rest"
  | "return_home"
  | "seek_work"
  | "build"
  | "wander";

export type CitizenActionState =
  | "deciding"
  | "moving"
  | "performing"
  | "waiting"
  | "completed"
  | "failed";

export interface CitizenDecisionReason {
  factor: string;
  score: number;
}

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
  fatigue: number;
  goal: CitizenGoal;
  actionState: CitizenActionState;
  taskId?: string;
  targetId?: string;
  targetPosition?: GridPosition;
  path: GridPosition[];
  pathIndex: number;
  actionProgress: number;
  decisionCooldown: number;
  decisionScore: number;
  decisionReasons: CitizenDecisionReason[];
  carriedFood: number;
  carryStage?: "to_farm" | "to_warehouse";
  lastMealDay: number;
}

export type BuildingType =
  | "farm"
  | "house"
  | "warehouse"
  | "lumberjack"
  | "quarry";
export type ResourceType = "food" | "wood" | "stone" | "money";
export type ResourcePool = Record<ResourceType, number>;
export type ResourceInventory = Partial<ResourcePool>;

export function createResourcePool(
  initial: Partial<ResourcePool> = {},
): ResourcePool {
  return { food: 0, wood: 0, stone: 0, money: 0, ...initial };
}

export interface Building {
  id: string;
  type: BuildingType;
  position: GridPosition;
  entrance: GridPosition;
  level: number;
  capacity: number;
  workers: string[];
  inventory: ResourceInventory;
  condition: number;
  constructionProgress: number;
  ownerType: "private" | "public";
}

export type VillageResources = ResourcePool;

export type VillageTaskType =
  | "farm_work"
  | "gather_wood"
  | "gather_stone"
  | "carry_food_to_warehouse"
  | "eat_food"
  | "rest_at_home"
  | "build_house";

export interface VillageTask {
  id: string;
  type: VillageTaskType;
  targetId: string;
  targetPosition: GridPosition;
  priority: number;
  capacity: number;
  assignedCitizenIds: string[];
}

export interface DailyActivityMetrics {
  foodProduced: number;
  foodConsumed: number;
  populationLost: number;
}

export interface DailyStatistics {
  day: number;
  population: number;
  foodStock: number;
  woodStock: number;
  stoneStock: number;
  foodProduced: number;
  foodConsumed: number;
  unmetFoodDemand: number;
  averageHunger: number;
  averageHappiness: number;
  farmerCount: number;
  lumberjackCount: number;
  minerCount: number;
  unemployedCount: number;
  farmCount: number;
  houseCount: number;
  warehouseCount: number;
  lumberjackBuildingCount: number;
  quarryCount: number;
  housingCapacity: number;
  housingDemand: number;
  populationLost: number;
}

export interface ActivitySummary {
  moving: number;
  farming: number;
  eating: number;
  carrying: number;
  building: number;
  resting: number;
  waiting: number;
}

export interface PathfindingStatistics {
  cacheHits: number;
  cacheMisses: number;
  cacheSize: number;
}

export interface SimulationState {
  citizens: Citizen[];
  buildings: Building[];
  resources: VillageResources;
  tasks: VillageTask[];
  statistics: DailyStatistics[];
  dailyMetrics: DailyActivityMetrics;
  mapRevision: number;
}

export interface SimulationSnapshot {
  seed: string;
  day: number;
  tick: number;
  tickInDay: number;
  minuteOfDay: number;
  paused: boolean;
  speed: number;
  citizens: Citizen[];
  buildings: Building[];
  resources: VillageResources;
  tasks: VillageTask[];
  activitySummary: ActivitySummary;
  pathfinding: PathfindingStatistics;
  landFertility: number;
  latestStatistics: DailyStatistics;
  statistics: DailyStatistics[];
  recentStatistics: DailyStatistics[];
}
