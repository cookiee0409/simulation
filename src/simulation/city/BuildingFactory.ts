import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import type { Building, BuildingType, GridPosition } from "../types";

const BUILDING_POSITIONS: Record<BuildingType, GridPosition[]> = {
  farm: [
    { x: 120, y: 100 },
    { x: 280, y: 100 },
    { x: 440, y: 100 },
    { x: 600, y: 100 },
  ],
  house: [
    { x: 100, y: 300 },
    { x: 180, y: 300 },
    { x: 260, y: 300 },
    { x: 420, y: 300 },
    { x: 500, y: 300 },
    { x: 580, y: 300 },
    { x: 140, y: 400 },
    { x: 220, y: 400 },
    { x: 300, y: 400 },
    { x: 460, y: 400 },
    { x: 540, y: 400 },
    { x: 620, y: 400 },
  ],
  warehouse: [
    { x: 660, y: 180 },
    { x: 660, y: 260 },
  ],
  lumberjack: [
    { x: 60, y: 450 },
    { x: 60, y: 350 },
    { x: 60, y: 250 },
  ],
  quarry: [
    { x: 700, y: 450 },
    { x: 700, y: 350 },
    { x: 700, y: 250 },
  ],
};

export function createInitialBuildings(
  config: SimulationConfig,
  random: SeededRandom,
): Building[] {
  const buildings: Building[] = [];
  for (let index = 0; index < config.initialFarms; index += 1) {
    buildings.push(
      createBuilding("farm", index, config.farmWorkerCapacity, random, config),
    );
  }
  for (let index = 0; index < config.initialHouses; index += 1) {
    buildings.push(
      createBuilding("house", index, config.houseCapacity, random, config),
    );
  }
  for (let index = 0; index < config.initialWarehouses; index += 1) {
    buildings.push(
      createBuilding(
        "warehouse",
        index,
        config.warehouseCapacity,
        random,
        config,
      ),
    );
  }

  for (let index = 0; index < config.initialLumberyards; index += 1) {
    buildings.push(
      createBuilding(
        "lumberjack",
        index,
        config.lumberjackWorkerCapacity,
        random,
        config,
      ),
    );
  }
  for (let index = 0; index < config.initialQuarries; index += 1) {
    buildings.push(
      createBuilding(
        "quarry",
        index,
        config.quarryWorkerCapacity,
        random,
        config,
      ),
    );
  }

  const warehouse = buildings.find((building) => building.type === "warehouse");
  if (warehouse) {
    warehouse.inventory.food = config.initialFood;
  }
  return buildings;
}

export function createBuilding(
  type: BuildingType,
  index: number,
  capacity: number,
  random: SeededRandom,
  config?: SimulationConfig,
  constructionProgress = 100,
): Building {
  const gridSize = config?.gridSize ?? 20;
  const preset = BUILDING_POSITIONS[type][index];
  const position = preset ?? {
    x: snap(random.between(80, 680), gridSize),
    y: snap(random.between(80, 440), gridSize),
  };
  const entrance = getEntrance(type, position, gridSize);

  return {
    id: `${type}-${String(index + 1).padStart(2, "0")}`,
    type,
    position: { ...position },
    entrance,
    level: 1,
    capacity,
    workers: [],
    inventory: { food: 0 },
    condition: 100,
    constructionProgress,
    ownerType: type === "warehouse" ? "public" : "private",
  };
}

export function getBuildingPosition(
  type: BuildingType,
  index: number,
): GridPosition | undefined {
  const position = BUILDING_POSITIONS[type][index];
  return position ? { ...position } : undefined;
}

export function getBuildingHalfSize(
  type: BuildingType,
  gridSize: number,
): GridPosition {
  if (type === "farm") {
    return { x: gridSize * 2.5, y: gridSize * 1.5 };
  }
  if (type === "warehouse") {
    return { x: gridSize * 2, y: gridSize * 1.5 };
  }
  if (type === "lumberjack" || type === "quarry") {
    return { x: gridSize * 2, y: gridSize * 1.5 };
  }
  return { x: gridSize * 1.5, y: gridSize };
}

function getEntrance(
  type: BuildingType,
  position: GridPosition,
  gridSize: number,
): GridPosition {
  if (type === "warehouse") {
    return { x: position.x - gridSize * 3, y: position.y };
  }
  return {
    x: position.x,
    y: position.y + (type === "farm" ? gridSize * 2 : gridSize * 2),
  };
}

function snap(value: number, gridSize: number): number {
  return Math.round(value / gridSize) * gridSize;
}
