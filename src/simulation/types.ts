export interface GridPosition {
  x: number;
  y: number;
}

/** 정착민에서 출발해 수요에 따라 창발하는 직업. */
export type ProfessionType = "farmer" | "lumberjack" | "miner";
export type CitizenJob = "settler" | ProfessionType | "unemployed";
export type CitizenAction = "working" | "eating" | "idle" | "leaving";

export type CitizenGoal =
  | "eat"
  | "forage"
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
  births: number;
  deaths: number;
  /** 당일 채집으로 모은 식량(야생 식량 한계 적용용, 매일 리셋). */
  foragedToday: number;
}

// --- 성장형 정착지: 수요·직업 창발·발전 단계 ---

export type VillageNeed =
  | "food"
  | "shelter"
  | "wood"
  | "stone"
  | "tools"
  | "storage"
  | "trade"
  | "healthcare"
  | "security"
  | "education"
  | "transport";

export interface NeedCause {
  factor: string;
  weight: number;
}

export interface NeedState {
  type: VillageNeed;
  currentDemand: number;
  currentSupply: number;
  unmetDemand: number;
  urgency: number; // 0-100
  trend: "rising" | "stable" | "falling";
  sustainedDays: number;
  causes: NeedCause[];
}

export interface ProfessionOpportunityReason {
  factor: string;
  score: number;
}

export interface ProfessionOpportunity {
  profession: ProfessionType;
  score: number;
  /** 패널 표시용 0~1 정규화 점수(실제 기회 점수 기반). */
  normalizedScore: number;
  relatedNeeds: VillageNeed[];
  reasons: ProfessionOpportunityReason[];
  sustainedDays: number;
  eligibleCitizenIds: string[];
}

export type SettlementStage =
  | "camp"
  | "hamlet"
  | "village"
  | "growing_village"
  | "town";

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
  averageAge: number;
  births: number;
  deaths: number;
  childrenCount: number;
  settlerCount: number;
  professionCount: number;
  buildingTypeCount: number;
  topNeedUrgency: number;
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
  /** 출생 시민에게 부여할 다음 일련번호(결정적 id 생성용). */
  nextCitizenSerial: number;
  /** 매일 갱신되는 마을 수요 상태(추세·지속일 누적). */
  needs: NeedState[];
  /** 직업 창발 기회 점수(지속일 누적). */
  opportunities: ProfessionOpportunity[];
  /** 현재 발전 단계(상태 요약 결과값). */
  stage: SettlementStage;
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
  stage: SettlementStage;
  needs: NeedState[];
  opportunities: ProfessionOpportunity[];
  latestStatistics: DailyStatistics;
  statistics: DailyStatistics[];
  recentStatistics: DailyStatistics[];
}
