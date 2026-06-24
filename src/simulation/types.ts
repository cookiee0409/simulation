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

/**
 * 향후 경제·건설 시스템이 다룰 자원 종류. 새로운 자원은 이 유니온에만 추가하면
 * ResourcePool/VillageResources/ResourceInventory가 함께 확장된다.
 */
export type ResourceType = "food" | "wood" | "stone" | "money";

/** 모든 자원 종류를 키로 갖는 완전한 자원 보유량 맵. */
export type ResourcePool = Record<ResourceType, number>;

/** 건물 등 일부만 보유할 수 있는 자원 인벤토리(부분 맵). */
export type ResourceInventory = Partial<ResourcePool>;

/** 비어 있는(0으로 채운) 자원 풀에 일부 값을 덮어써 완전한 풀을 만든다. */
export function createResourcePool(initial: Partial<ResourcePool> = {}): ResourcePool {
  return { food: 0, wood: 0, stone: 0, money: 0, ...initial };
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

export type VillageResources = ResourcePool;

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
  landFertility: number;
  latestStatistics: DailyStatistics;
  /** 전체 일일 통계(불변 참조 공유). 헤드리스 분석·내보내기용. */
  statistics: DailyStatistics[];
  /** UI 표시용 최근 구간 통계. 장기 실행 시 전체 배열 순회를 피하기 위함. */
  recentStatistics: DailyStatistics[];
}
