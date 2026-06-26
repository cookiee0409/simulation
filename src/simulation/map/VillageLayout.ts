import type { SimulationConfig } from "../core/SimulationConfig";
import type {
  GridPosition,
  VillageLayout,
  VillageZone,
  VillageZoneType,
} from "../types";

export function createVillageLayout(config: SimulationConfig): VillageLayout {
  const grid = config.gridSize;
  const snap = (value: number) => Math.round(value / grid) * grid;
  const width = config.mapWidth;
  const height = config.mapHeight;

  const zones: VillageZone[] = [
    createZone("farm-zone", "farm", "농장 영역", {
      x: snap(width * 0.05),
      y: snap(height * 0.07),
      width: snap(width * 0.43),
      height: snap(height * 0.34),
      gate: { x: snap(width * 0.265), y: snap(height * 0.41) },
    }),
    createZone("residential-zone", "residential", "주거 영역", {
      x: snap(width * 0.08),
      y: snap(height * 0.5),
      width: snap(width * 0.45),
      height: snap(height * 0.42),
      gate: { x: snap(width * 0.31), y: snap(height * 0.5) },
    }),
    createZone("storage-zone", "storage", "저장 영역", {
      x: snap(width * 0.64),
      y: snap(height * 0.08),
      width: snap(width * 0.3),
      height: snap(height * 0.36),
      gate: { x: snap(width * 0.64), y: snap(height * 0.26) },
    }),
    createZone("work-zone", "work", "작업 영역", {
      x: snap(width * 0.58),
      y: snap(height * 0.52),
      width: snap(width * 0.36),
      height: snap(height * 0.4),
      gate: { x: snap(width * 0.58), y: snap(height * 0.7) },
    }),
  ];

  return { zones };
}

export function createFenceBlockedCells(
  layout: VillageLayout,
  config: SimulationConfig,
): GridPosition[] {
  const blocked: GridPosition[] = [];
  const gateRadius = Math.max(1, Math.round(30 / config.gridSize));

  for (const zone of layout.zones) {
    const minX = Math.round(zone.rect.x / config.gridSize);
    const minY = Math.round(zone.rect.y / config.gridSize);
    const maxX = Math.round((zone.rect.x + zone.rect.width) / config.gridSize);
    const maxY = Math.round((zone.rect.y + zone.rect.height) / config.gridSize);
    const gate = {
      x: Math.round(zone.gate.x / config.gridSize),
      y: Math.round(zone.gate.y / config.gridSize),
    };

    for (let x = minX; x <= maxX; x += 1) {
      maybePushFenceCell(blocked, { x, y: minY }, gate, gateRadius);
      maybePushFenceCell(blocked, { x, y: maxY }, gate, gateRadius);
    }
    for (let y = minY; y <= maxY; y += 1) {
      maybePushFenceCell(blocked, { x: minX, y }, gate, gateRadius);
      maybePushFenceCell(blocked, { x: maxX, y }, gate, gateRadius);
    }
  }

  return blocked;
}

export function cloneVillageLayout(layout: VillageLayout): VillageLayout {
  return {
    zones: layout.zones.map((zone) => ({
      ...zone,
      rect: { ...zone.rect },
      gate: { ...zone.gate },
    })),
  };
}

export function zoneTypeForBuilding(type: string): VillageZoneType {
  if (type === "farm") {
    return "farm";
  }
  if (type === "house") {
    return "residential";
  }
  if (type === "warehouse") {
    return "storage";
  }
  return "work";
}

function createZone(
  id: string,
  type: VillageZoneType,
  label: string,
  options: {
    x: number;
    y: number;
    width: number;
    height: number;
    gate: GridPosition;
  },
): VillageZone {
  return {
    id,
    type,
    label,
    rect: {
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
    },
    gate: { ...options.gate },
  };
}

function maybePushFenceCell(
  blocked: GridPosition[],
  cell: GridPosition,
  gate: GridPosition,
  gateRadius: number,
): void {
  const isGate =
    Math.abs(cell.x - gate.x) <= gateRadius &&
    Math.abs(cell.y - gate.y) <= gateRadius;
  if (!isGate) {
    blocked.push(cell);
  }
}
