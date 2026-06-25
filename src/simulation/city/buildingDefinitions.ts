import type { BuildingType, ProfessionType, ResourcePool } from "../types";

/** 부지 선택 기준 앵커(요청서 7.7). */
export type PlacementAnchor =
  | "houses" // 기존 주거지 근처
  | "center" // 마을 중심(이동량 많은 곳)
  | "resource_wood" // 숲/목재 구역
  | "resource_stone" // 돌/광물 구역
  | "production"; // 생산 작업장 군집

export interface BuildingDefinition {
  id: BuildingType;
  label: string;
  /** 건설 자재(없으면 착공 보류). */
  cost: Partial<ResourcePool>;
  workerCapacity: number;
  workerProfession?: ProfessionType;
  anchor: PlacementAnchor;
  /** 주거지와 유지할 최소 거리(그리드 칸). 소음/오염 시설용. */
  minDistanceFromHouses: number;
}

export const BUILDING_DEFINITIONS: Record<BuildingType, BuildingDefinition> = {
  house: {
    id: "house",
    label: "집",
    cost: { wood: 8, stone: 4 },
    workerCapacity: 0,
    anchor: "houses",
    minDistanceFromHouses: 0,
  },
  farm: {
    id: "farm",
    label: "농장",
    cost: { wood: 4 },
    workerCapacity: 6,
    workerProfession: "farmer",
    anchor: "center",
    minDistanceFromHouses: 1,
  },
  warehouse: {
    id: "warehouse",
    label: "창고",
    cost: { wood: 10, stone: 6 },
    workerCapacity: 0,
    anchor: "center",
    minDistanceFromHouses: 1,
  },
  lumberjack: {
    id: "lumberjack",
    label: "벌목장",
    cost: { wood: 4 },
    workerCapacity: 4,
    workerProfession: "lumberjack",
    anchor: "resource_wood",
    minDistanceFromHouses: 3,
  },
  quarry: {
    id: "quarry",
    label: "채석장",
    cost: { wood: 4 },
    workerCapacity: 4,
    workerProfession: "miner",
    anchor: "resource_stone",
    minDistanceFromHouses: 3,
  },
  carpentry: {
    id: "carpentry",
    label: "목공소",
    cost: { wood: 16, stone: 4 },
    workerCapacity: 3,
    workerProfession: "carpenter",
    anchor: "production",
    minDistanceFromHouses: 1,
  },
  blacksmith: {
    id: "blacksmith",
    label: "대장간",
    cost: { wood: 12, stone: 14 },
    workerCapacity: 2,
    workerProfession: "blacksmith",
    anchor: "production",
    minDistanceFromHouses: 3,
  },
  market: {
    id: "market",
    label: "시장",
    cost: { wood: 18, stone: 10 },
    workerCapacity: 3,
    workerProfession: "merchant",
    anchor: "center",
    minDistanceFromHouses: 0,
  },
};
