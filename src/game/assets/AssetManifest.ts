import type { Building } from "../../simulation";

type BuildingKind = Building["type"];

export const ASSET_MANIFEST = {
  buildings: {
    farm: "/assets/visual/farm.svg",
    house: "/assets/visual/house.svg",
    warehouse: "/assets/visual/warehouse.svg",
    lumberjack: "/assets/visual/lumberjack.svg",
    quarry: "/assets/visual/quarry.svg",
    carpentry: "/assets/visual/carpentry.svg",
    blacksmith: "/assets/visual/blacksmith.svg",
    market: "/assets/visual/market.svg",
  } satisfies Record<BuildingKind, string>,
  generated: {
    terrainTilePrefix: "terrain-tile",
    citizenTexturePrefix: "citizen-frame",
  },
} as const;

export type BuildingAssetKey = `building-${BuildingKind}`;

export function buildingAssetKey(type: BuildingKind): BuildingAssetKey {
  return `building-${type}`;
}
