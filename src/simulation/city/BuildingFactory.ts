import type { SimulationConfig } from "../core/SimulationConfig";
import type { SeededRandom } from "../core/SeededRandom";
import type { Building, BuildingType, GridPosition } from "../types";

const BUILDING_POSITIONS: Record<BuildingType, GridPosition[]> = {
  farm: [
    { x: 90, y: 80 },
    { x: 210, y: 80 },
    { x: 330, y: 80 },
    { x: 450, y: 80 },
  ],
  house: [
    { x: 110, y: 280 },
    { x: 190, y: 280 },
    { x: 270, y: 280 },
    { x: 350, y: 280 },
    { x: 430, y: 280 },
    { x: 510, y: 280 },
    { x: 150, y: 370 },
    { x: 230, y: 370 },
    { x: 310, y: 370 },
    { x: 390, y: 370 },
    { x: 470, y: 370 },
  ],
  warehouse: [
    { x: 620, y: 130 },
    { x: 620, y: 240 },
  ],
};

export function createInitialBuildings(
  config: SimulationConfig,
  random: SeededRandom,
): Building[] {
  const buildings: Building[] = [];

  for (let index = 0; index < config.initialFarms; index += 1) {
    buildings.push(
      createBuilding(
        "farm",
        index,
        config.farmWorkerCapacity,
        random,
      ),
    );
  }
  for (let index = 0; index < config.initialHouses; index += 1) {
    buildings.push(
      createBuilding("house", index, config.houseCapacity, random),
    );
  }
  for (let index = 0; index < config.initialWarehouses; index += 1) {
    buildings.push(
      createBuilding("warehouse", index, config.warehouseCapacity, random),
    );
  }

  return buildings;
}

export function createBuilding(
  type: BuildingType,
  index: number,
  capacity: number,
  random: SeededRandom,
): Building {
  const preset = BUILDING_POSITIONS[type][index];
  const position = preset ?? {
    x: random.between(80, 680),
    y: random.between(70, 430),
  };

  return {
    id: `${type}-${String(index + 1).padStart(2, "0")}`,
    type,
    position: { ...position },
    level: 1,
    capacity,
    workers: [],
    inventory: { food: 0 },
    condition: 100,
    constructionProgress: 100,
    ownerType: type === "warehouse" ? "public" : "private",
  };
}
