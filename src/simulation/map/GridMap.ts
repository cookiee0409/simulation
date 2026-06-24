import { getBuildingHalfSize } from "../city/BuildingFactory";
import type { SimulationConfig } from "../core/SimulationConfig";
import type { Building, GridPosition } from "../types";

export interface GridCell {
  x: number;
  y: number;
}

export class GridMap {
  readonly columns: number;
  readonly rows: number;

  constructor(readonly config: SimulationConfig) {
    this.columns = Math.floor(config.mapWidth / config.gridSize);
    this.rows = Math.floor(config.mapHeight / config.gridSize);
  }

  toCell(position: GridPosition): GridCell {
    return {
      x: Math.round(position.x / this.config.gridSize),
      y: Math.round(position.y / this.config.gridSize),
    };
  }

  toWorld(cell: GridCell): GridPosition {
    return {
      x: cell.x * this.config.gridSize,
      y: cell.y * this.config.gridSize,
    };
  }

  isInside(cell: GridCell): boolean {
    return (
      cell.x >= 1 &&
      cell.y >= 1 &&
      cell.x < this.columns &&
      cell.y < this.rows
    );
  }

  createBlockedSet(
    buildings: readonly Building[],
    extraBlocked: readonly GridCell[] = [],
  ): Set<string> {
    const blocked = new Set(extraBlocked.map(cellKey));
    for (const building of buildings) {
      const half = getBuildingHalfSize(building.type, this.config.gridSize);
      const min = this.toCell({
        x: building.position.x - half.x,
        y: building.position.y - half.y,
      });
      const max = this.toCell({
        x: building.position.x + half.x,
        y: building.position.y + half.y,
      });
      for (let y = min.y; y <= max.y; y += 1) {
        for (let x = min.x; x <= max.x; x += 1) {
          blocked.add(cellKey({ x, y }));
        }
      }
      blocked.delete(cellKey(this.toCell(building.entrance)));
    }
    return blocked;
  }
}

export function cellKey(cell: GridCell): string {
  return `${cell.x},${cell.y}`;
}
