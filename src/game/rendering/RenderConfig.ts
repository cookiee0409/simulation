import type { Building } from "../../simulation";

type BuildingKind = Building["type"];

export const RENDER_CONFIG = {
  resolutionMax: 2,
  fontFamily: 'Pretendard, "Noto Sans KR", Inter, "Malgun Gothic", system-ui, sans-serif',
  tileSize: 64,
  npc: {
    width: 26,
    height: 36,
    shadowAlpha: 0.26,
    outline: 1.5,
  },
  building: {
    outline: 2,
    shadowAlpha: 0.24,
    hoverAlpha: 0.22,
    sizes: {
      farm: { width: 128, height: 86 },
      house: { width: 96, height: 92 },
      warehouse: { width: 126, height: 106 },
      lumberjack: { width: 118, height: 92 },
      quarry: { width: 124, height: 92 },
      carpentry: { width: 122, height: 94 },
      blacksmith: { width: 116, height: 100 },
      market: { width: 132, height: 94 },
    } satisfies Record<BuildingKind, { width: number; height: number }>,
  },
  depths: {
    ground: -40,
    roads: -35,
    decorations: -30,
    buildingShadow: 0,
    building: 100,
    npcShadow: 500,
    npc: 600,
    effects: 5000,
    status: 6000,
    bubbles: 7000,
  },
  zoom: {
    min: 0.7,
    max: 2.5,
    far: 0.88,
    near: 1.35,
  },
  palette: {
    groundA: 0x9fbf84,
    groundB: 0x8eb073,
    groundC: 0xb2c893,
    groundD: 0x7fa267,
    soil: 0x8b6743,
    road: 0xc7b184,
    roadEdge: 0x9d865e,
    outline: 0x27331f,
    labelBg: 0x152018,
    labelText: "#f8fff3",
    selection: 0xf9f5c7,
    hover: 0xffffff,
  },
} as const;

export type ZoomLevel = "far" | "default" | "near";

export function zoomLevel(zoom: number): ZoomLevel {
  if (zoom <= RENDER_CONFIG.zoom.far) return "far";
  if (zoom >= RENDER_CONFIG.zoom.near) return "near";
  return "default";
}

export function stableHash(input: string): number {
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function variant(input: string, count: number): number {
  return stableHash(input) % count;
}
