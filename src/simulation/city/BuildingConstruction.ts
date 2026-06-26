import {
  createBuilding,
  getBuildingHalfSize,
  getBuildingPosition,
} from "./BuildingFactory";
import { findBuildingPlacement } from "./BuildingPlacementSystem";
import { BUILDING_DEFINITIONS } from "./buildingDefinitions";
import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import type {
  Building,
  BuildingType,
  ResourceType,
  SimulationState,
} from "../types";

/**
 * 새 건물 착공을 요청한다. 자재(비축 자원)와 배치 가능 위치가 모두 확보될 때만
 * 예정지를 생성한다(자재·공간이 마을 확장을 제약). 성공 시 true.
 */
export function requestBuilding(
  state: SimulationState,
  config: SimulationConfig,
  type: BuildingType,
  random: SeededRandom,
): boolean {
  const def = BUILDING_DEFINITIONS[type];

  // 자재 확인.
  for (const [resource, amount] of Object.entries(def.cost)) {
    if (state.resources[resource as ResourceType] < (amount ?? 0)) {
      return false;
    }
  }

  const index = state.buildings.filter((b) => b.type === type).length;
  const position =
    findBuildingPlacement(state, config, type) ??
    getBuildingPosition(type, index);
  if (!position) {
    return false;
  }

  for (const [resource, amount] of Object.entries(def.cost)) {
    state.resources[resource as ResourceType] -= amount ?? 0;
  }

  const building = createBuilding(
    type,
    index,
    capacityFor(type, config),
    random,
    config,
    0,
    position,
  );
  state.buildings.push(building);
  evictTrappedCitizens(state, config, building);
  state.mapRevision += 1;
  return true;
}

/**
 * 새 건물 부지가 서 있던 주민 위로 놓이면 주민이 발이 묶여 식량·집에 못 간다.
 * 건물 면적 안에 갇힌 주민을 입구로 내보내 이동을 복구한다.
 */
function evictTrappedCitizens(
  state: SimulationState,
  config: SimulationConfig,
  building: Building,
): void {
  const half = getBuildingHalfSize(building.type, config.gridSize);
  for (const citizen of state.citizens) {
    const inside =
      Math.abs(citizen.position.x - building.position.x) <= half.x &&
      Math.abs(citizen.position.y - building.position.y) <= half.y;
    if (!inside) continue;
    citizen.position = { ...building.entrance };
    citizen.path = [];
    citizen.pathIndex = 0;
    if (
      citizen.actionState !== "completed" &&
      citizen.actionState !== "failed"
    ) {
      citizen.actionState = "failed";
    }
  }
}

/** 해당 종류의 건물이 이미 있거나 짓는 중인지. */
export function hasBuildingOrSite(
  state: SimulationState,
  type: BuildingType,
): boolean {
  return state.buildings.some((b) => b.type === type);
}

function capacityFor(type: BuildingType, config: SimulationConfig): number {
  if (type === "house") return config.houseCapacity;
  if (type === "warehouse") return config.warehouseCapacity;
  return BUILDING_DEFINITIONS[type].workerCapacity;
}
