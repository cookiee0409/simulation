import type { SimulationConfig } from "../core/SimulationConfig";
import { GridMap, cellKey, type GridCell } from "../map/GridMap";
import type {
  Building,
  GridPosition,
  PathfindingStatistics,
} from "../types";

interface RouteField {
  nextTowardGoal: Map<string, GridCell>;
  goal: GridCell;
}

/**
 * 목표 지점에서 역방향 BFS 필드를 한 번 만든 뒤 모든 출발지가 공유한다.
 * 균일 비용 그리드에서는 A*와 동일한 최단 경로를 만들며, 100명이 같은 건물을
 * 오갈 때 출발지마다 탐색을 반복하지 않는다.
 */
export class GridPathfinder {
  private readonly map: GridMap;
  private readonly fields = new Map<string, RouteField>();
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(
    config: SimulationConfig,
    private readonly extraBlocked: readonly GridCell[] = [],
  ) {
    this.map = new GridMap(config);
  }

  findPath(
    startPosition: GridPosition,
    goalPosition: GridPosition,
    buildings: readonly Building[],
    mapRevision = 0,
  ): GridPosition[] | null {
    const start = this.map.toCell(startPosition);
    const goal = this.map.toCell(goalPosition);
    if (!this.map.isInside(start) || !this.map.isInside(goal)) {
      return null;
    }
    if (start.x === goal.x && start.y === goal.y) {
      return [];
    }

    const fieldKey = `${mapRevision}:${cellKey(goal)}`;
    let field = this.fields.get(fieldKey);
    if (field) {
      this.cacheHits += 1;
    } else {
      this.cacheMisses += 1;
      field = this.buildField(goal, buildings);
      this.fields.set(fieldKey, field);
    }

    const path: GridPosition[] = [];
    let current = start;
    const guardLimit = this.map.columns * this.map.rows;
    for (let guard = 0; guard < guardLimit; guard += 1) {
      const next = field.nextTowardGoal.get(cellKey(current));
      if (!next) {
        return null;
      }
      path.push(this.map.toWorld(next));
      if (next.x === goal.x && next.y === goal.y) {
        return path;
      }
      current = next;
    }
    return null;
  }

  getStatistics(): PathfindingStatistics {
    return {
      cacheHits: this.cacheHits,
      cacheMisses: this.cacheMisses,
      cacheSize: this.fields.size,
    };
  }

  clear(): void {
    this.fields.clear();
  }

  private buildField(
    goal: GridCell,
    buildings: readonly Building[],
  ): RouteField {
    const blocked = this.map.createBlockedSet(buildings, this.extraBlocked);
    blocked.delete(cellKey(goal));
    const queue: GridCell[] = [goal];
    const visited = new Set<string>([cellKey(goal)]);
    const nextTowardGoal = new Map<string, GridCell>();
    let cursor = 0;

    while (cursor < queue.length) {
      const current = queue[cursor++]!;
      for (const neighbor of neighbors(current)) {
        const key = cellKey(neighbor);
        if (
          !this.map.isInside(neighbor) ||
          blocked.has(key) ||
          visited.has(key)
        ) {
          continue;
        }
        visited.add(key);
        nextTowardGoal.set(key, current);
        queue.push(neighbor);
      }
    }
    return { goal, nextTowardGoal };
  }
}

function neighbors(cell: GridCell): GridCell[] {
  return [
    { x: cell.x, y: cell.y - 1 },
    { x: cell.x + 1, y: cell.y },
    { x: cell.x, y: cell.y + 1 },
    { x: cell.x - 1, y: cell.y },
  ];
}
