import { describe, expect, it } from "vitest";
import { createSimulationConfig } from "../core/SimulationConfig";
import { GridPathfinder } from "./GridPathfinder";
import { createBuilding } from "../city/BuildingFactory";
import { SeededRandom } from "../core/SeededRandom";
import { GridMap, cellKey } from "../map/GridMap";

describe("GridPathfinder", () => {
  it("건물 장애물을 통과하지 않고 동일한 최단 경로를 재현한다", () => {
    const config = createSimulationConfig({
      mapWidth: 240,
      mapHeight: 220,
    });
    const house = createBuilding(
      "house",
      0,
      10,
      new SeededRandom("path"),
      config,
    );
    house.position = { x: 120, y: 100 };
    house.entrance = { x: 120, y: 140 };
    const first = new GridPathfinder(config);
    const second = new GridPathfinder(config);
    const pathA = first.findPath(
      { x: 40, y: 100 },
      { x: 200, y: 100 },
      [house],
    );
    const pathB = second.findPath(
      { x: 40, y: 100 },
      { x: 200, y: 100 },
      [house],
    );
    expect(pathA).toEqual(pathB);
    expect(pathA).not.toBeNull();

    const grid = new GridMap(config);
    const blocked = grid.createBlockedSet([house]);
    for (const point of pathA!) {
      expect(blocked.has(cellKey(grid.toCell(point)))).toBe(false);
    }
  });

  it("도달 불가능한 목적지는 null을 반환한다", () => {
    const config = createSimulationConfig({
      mapWidth: 200,
      mapHeight: 200,
    });
    const wall = Array.from({ length: 9 }, (_, index) => ({
      x: 5,
      y: index + 1,
    }));
    const pathfinder = new GridPathfinder(config, wall);
    expect(
      pathfinder.findPath(
        { x: 40, y: 100 },
        { x: 160, y: 100 },
        [],
      ),
    ).toBeNull();
  });

  it("같은 목적지 경로 필드를 캐시한다", () => {
    const config = createSimulationConfig();
    const pathfinder = new GridPathfinder(config);
    pathfinder.findPath({ x: 40, y: 40 }, { x: 360, y: 260 }, []);
    pathfinder.findPath({ x: 60, y: 40 }, { x: 360, y: 260 }, []);
    expect(pathfinder.getStatistics()).toMatchObject({
      cacheHits: 1,
      cacheMisses: 1,
      cacheSize: 1,
    });
  });
});
