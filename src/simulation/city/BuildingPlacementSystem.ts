import { getBuildingHalfSize } from "./BuildingFactory";
import { BUILDING_DEFINITIONS } from "./buildingDefinitions";
import type { SimulationConfig } from "../core/SimulationConfig";
import type { Building, BuildingType, GridPosition, SimulationState } from "../types";

/**
 * 새 건물의 위치를 지도와 마을 상태를 보고 자동으로 고른다(고정 좌표 배열 대체).
 * 건물 종류별 앵커(주거지/중심/자원 구역)에 가까우면서 기존 건물과 겹치지 않고
 * 지도 안에 들어오는 격자 위치 중 가장 적합한 곳을 선택한다.
 */
export function findBuildingPlacement(
  state: SimulationState,
  config: SimulationConfig,
  type: BuildingType,
): GridPosition | undefined {
  const grid = config.gridSize;
  const def = BUILDING_DEFINITIONS[type];
  const half = getBuildingHalfSize(type, grid);
  const occupied = occupiedCells(state, config);
  // 주민이 서 있는 칸·기존 건물 입구 위에는 짓지 않는다(발 묶임/입구 차단 방지).
  const occupiedForFit = new Set(occupied);
  for (const citizen of state.citizens) {
    occupiedForFit.add(cellKey(citizen.position.x, citizen.position.y, grid));
  }
  for (const building of state.buildings) {
    occupiedForFit.add(
      cellKey(building.entrance.x, building.entrance.y, grid),
    );
  }
  const houseCells = buildingCells(
    state.buildings.filter((b) => b.type === "house"),
    config,
  );
  const anchor = anchorPoint(state, config, type);

  // 적합한 후보를 모아 앵커 거리순으로 정렬한 뒤, 연결성을 깨지 않는 첫 후보를 고른다.
  const candidates: Array<{ position: GridPosition; score: number }> = [];
  const margin = grid * 2;
  for (let y = margin; y <= config.mapHeight - margin; y += grid) {
    for (let x = margin; x <= config.mapWidth - margin; x += grid) {
      const position = { x, y };
      if (!fits(position, half, grid, config, occupiedForFit)) continue;
      if (
        def.minDistanceFromHouses > 0 &&
        tooCloseToHouses(position, half, grid, houseCells, def.minDistanceFromHouses)
      ) {
        continue;
      }
      candidates.push({
        position,
        score: Math.abs(x - anchor.x) + Math.abs(y - anchor.y),
      });
    }
  }
  candidates.sort((a, b) => a.score - b.score);

  for (const candidate of candidates) {
    if (keepsConnectivity(candidate.position, half, grid, config, state)) {
      return candidate.position;
    }
  }
  return undefined;
}

/**
 * 후보 위치에 건물을 놓아도 모든 건물 입구가 서로 도달 가능한지 BFS로 확인한다.
 * 마을 한가운데를 막아 주민이 식량·집에 못 가는 배치를 거른다.
 */
function keepsConnectivity(
  position: GridPosition,
  half: GridPosition,
  grid: number,
  config: SimulationConfig,
  state: SimulationState,
): boolean {
  const blocked = blockedWithCandidate(position, half, grid, state, config);
  const entrances = state.buildings.map((b) => cell(b.entrance, grid));
  entrances.push(cell({ x: position.x, y: position.y + half.y + grid }, grid));
  const reachable = entrances.filter((e) => !blocked.has(keyOf(e)));
  if (reachable.length === 0) return true;

  const columns = Math.floor(config.mapWidth / grid);
  const rows = Math.floor(config.mapHeight / grid);
  const start = reachable[0]!;
  const seen = new Set<string>([keyOf(start)]);
  const queue = [start];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const deltas: ReadonlyArray<readonly [number, number]> = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ];
    for (const [dx, dy] of deltas) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      if (nx < 1 || ny < 1 || nx >= columns || ny >= rows) continue;
      const key = `${nx},${ny}`;
      if (seen.has(key) || blocked.has(key)) continue;
      seen.add(key);
      queue.push({ x: nx, y: ny });
    }
  }
  return reachable.every((e) => seen.has(keyOf(e)));
}

function blockedWithCandidate(
  position: GridPosition,
  half: GridPosition,
  grid: number,
  state: SimulationState,
  config: SimulationConfig,
): Set<string> {
  const blocked = occupiedCells(state, config);
  for (let y = position.y - half.y; y <= position.y + half.y; y += grid) {
    for (let x = position.x - half.x; x <= position.x + half.x; x += grid) {
      blocked.add(cellKey(x, y, grid));
    }
  }
  // 입구 칸은 통행 가능하게 비운다.
  blocked.delete(keyOf(cell({ x: position.x, y: position.y + half.y + grid }, grid)));
  for (const building of state.buildings) {
    blocked.delete(keyOf(cell(building.entrance, grid)));
  }
  return blocked;
}

function cell(p: GridPosition, grid: number): { x: number; y: number } {
  return { x: Math.round(p.x / grid), y: Math.round(p.y / grid) };
}

function keyOf(c: { x: number; y: number }): string {
  return `${c.x},${c.y}`;
}

function anchorPoint(
  state: SimulationState,
  config: SimulationConfig,
  type: BuildingType,
): GridPosition {
  const center = {
    x: config.mapWidth / 2,
    y: config.mapHeight / 2,
  };
  const anchor = BUILDING_DEFINITIONS[type].anchor;
  if (anchor === "houses") {
    return averagePosition(
      state.buildings.filter((b) => b.type === "house"),
      center,
    );
  }
  if (anchor === "resource_wood") {
    return { x: config.mapWidth * 0.12, y: config.mapHeight * 0.82 };
  }
  if (anchor === "resource_stone") {
    return { x: config.mapWidth * 0.88, y: config.mapHeight * 0.82 };
  }
  if (anchor === "production") {
    const workshops = state.buildings.filter(
      (b) => b.type === "carpentry" || b.type === "blacksmith",
    );
    return averagePosition(workshops, center);
  }
  return center;
}

function averagePosition(
  buildings: Building[],
  fallback: GridPosition,
): GridPosition {
  if (buildings.length === 0) return fallback;
  const sum = buildings.reduce(
    (acc, b) => ({ x: acc.x + b.position.x, y: acc.y + b.position.y }),
    { x: 0, y: 0 },
  );
  return { x: sum.x / buildings.length, y: sum.y / buildings.length };
}

function fits(
  position: GridPosition,
  half: GridPosition,
  grid: number,
  config: SimulationConfig,
  occupied: Set<string>,
): boolean {
  const minX = position.x - half.x - grid;
  const maxX = position.x + half.x + grid;
  const minY = position.y - half.y - grid;
  const maxY = position.y + half.y + grid;
  // 입구(아래) 공간까지 지도 안에 있어야 한다.
  if (
    minX < grid ||
    maxX > config.mapWidth - grid ||
    minY < grid ||
    maxY + grid > config.mapHeight - grid
  ) {
    return false;
  }
  for (let y = minY; y <= maxY + grid; y += grid) {
    for (let x = minX; x <= maxX; x += grid) {
      if (occupied.has(cellKey(x, y, grid))) {
        return false;
      }
    }
  }
  return true;
}

function tooCloseToHouses(
  position: GridPosition,
  half: GridPosition,
  grid: number,
  houseCells: Set<string>,
  minDistance: number,
): boolean {
  const reach = minDistance * grid;
  for (let y = position.y - half.y - reach; y <= position.y + half.y + reach; y += grid) {
    for (let x = position.x - half.x - reach; x <= position.x + half.x + reach; x += grid) {
      if (houseCells.has(cellKey(x, y, grid))) {
        return true;
      }
    }
  }
  return false;
}

function occupiedCells(
  state: SimulationState,
  config: SimulationConfig,
): Set<string> {
  return buildingCells(state.buildings, config);
}

function buildingCells(
  buildings: Building[],
  config: SimulationConfig,
): Set<string> {
  const grid = config.gridSize;
  const cells = new Set<string>();
  for (const building of buildings) {
    const half = getBuildingHalfSize(building.type, grid);
    for (let y = building.position.y - half.y; y <= building.position.y + half.y; y += grid) {
      for (let x = building.position.x - half.x; x <= building.position.x + half.x; x += grid) {
        cells.add(cellKey(x, y, grid));
      }
    }
  }
  return cells;
}

function cellKey(x: number, y: number, grid: number): string {
  return `${Math.round(x / grid)},${Math.round(y / grid)}`;
}
