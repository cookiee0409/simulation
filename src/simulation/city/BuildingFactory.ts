import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import type { Building, BuildingType, GridPosition } from "../types";

const BUILDING_POSITIONS: Partial<Record<BuildingType, GridPosition[]>> = {
  farm: [
    { x: 160, y: 120 },
    { x: 320, y: 120 },
    { x: 160, y: 210 },
    { x: 320, y: 210 },
  ],
  house: [
    { x: 140, y: 350 },
    { x: 220, y: 350 },
    { x: 380, y: 350 },
    { x: 460, y: 350 },
    { x: 140, y: 470 },
    { x: 220, y: 470 },
    { x: 380, y: 470 },
    { x: 460, y: 470 },
  ],
  warehouse: [
    { x: 820, y: 160 },
    { x: 820, y: 240 },
  ],
  lumberjack: [
    { x: 720, y: 380 },
    { x: 720, y: 480 },
    { x: 800, y: 380 },
  ],
  quarry: [
    { x: 860, y: 460 },
    { x: 880, y: 380 },
    { x: 780, y: 480 },
  ],
  carpentry: [
    { x: 700, y: 380 },
    { x: 700, y: 480 },
  ],
  blacksmith: [
    { x: 820, y: 380 },
    { x: 820, y: 480 },
  ],
  market: [
    { x: 760, y: 430 },
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
  explicitPosition?: GridPosition,
): Building {
  const gridSize = config?.gridSize ?? 20;
  const preset = explicitPosition ?? BUILDING_POSITIONS[type]?.[index];
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
    winter: {
      insulation:
        type === "house"
          ? random.between(28, 68)
          : type === "warehouse"
            ? random.between(35, 58)
            : 20,
      indoorTemperature: 10,
      heatingLevel: 0,
      firewoodStored: 0,
      maxOccupantsForHeating:
        type === "house"
          ? Math.max(2, capacity)
          : type === "warehouse"
            ? 16
            : capacity,
      structuralCondition: random.between(55, 92),
      coldProtection: 30,
      repairProgress: 0,
      isCommunalShelter: false,
    },
  };
}

export function getBuildingPosition(
  type: BuildingType,
  index: number,
): GridPosition | undefined {
  const position = BUILDING_POSITIONS[type]?.[index];
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
  if (type === "carpentry" || type === "blacksmith" || type === "market") {
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
