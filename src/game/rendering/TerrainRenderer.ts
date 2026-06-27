import Phaser from "phaser";
import type { SimulationSnapshot } from "../../simulation";
import { RENDER_CONFIG, stableHash, zoomLevel } from "./RenderConfig";

interface TerrainCacheKey {
  seed: string;
  width: number;
  height: number;
  snow: number;
}

export class TerrainRenderer {
  private readonly ground: Phaser.GameObjects.Graphics;
  private readonly labels: Phaser.GameObjects.Container;
  private cacheKey?: string;

  constructor(private readonly scene: Phaser.Scene) {
    this.ground = scene.add.graphics().setDepth(RENDER_CONFIG.depths.ground);
    this.labels = scene.add.container().setDepth(RENDER_CONFIG.depths.status);
  }

  render(snapshot: SimulationSnapshot): void {
    const snow = snapshot.scenario ? Math.round(snapshot.scenario.snowDepth) : 0;
    const key = cacheKey({
      seed: snapshot.seed,
      width: snapshot.mapWidth,
      height: snapshot.mapHeight,
      snow,
    });
    if (key === this.cacheKey) {
      return;
    }
    this.cacheKey = key;
    this.ground.clear();
    this.labels.removeAll(true);
    this.drawBase(snapshot);
    this.drawRoads(snapshot);
    this.drawZones(snapshot);
    this.drawDecorations(snapshot);
    this.drawSnow(snapshot);
  }

  updateZoom(zoom: number): void {
    const level = zoomLevel(zoom);
    this.labels.setVisible(level !== "far");
  }

  destroy(): void {
    this.ground.destroy();
    this.labels.destroy(true);
  }

  private drawBase(snapshot: SimulationSnapshot): void {
    const tile = RENDER_CONFIG.tileSize;
    const colors = [
      RENDER_CONFIG.palette.groundA,
      RENDER_CONFIG.palette.groundB,
      RENDER_CONFIG.palette.groundC,
      RENDER_CONFIG.palette.groundD,
    ];
    for (let y = 0; y < snapshot.mapHeight + tile; y += tile) {
      for (let x = 0; x < snapshot.mapWidth + tile; x += tile) {
        const pick = stableHash(`${snapshot.seed}:tile:${x}:${y}`) % colors.length;
        const alpha = 0.94 + ((stableHash(`${snapshot.seed}:alpha:${x}:${y}`) % 7) / 100);
        this.ground.fillStyle(colors[pick]!, alpha);
        this.ground.fillRect(x, y, tile, tile);
      }
    }
  }

  private drawRoads(snapshot: SimulationSnapshot): void {
    const center = { x: snapshot.mapWidth / 2, y: snapshot.mapHeight / 2 };
    for (const zone of snapshot.layout.zones) {
      this.drawOrganicRoad(zone.gate, center);
    }
  }

  private drawOrganicRoad(
    from: { x: number; y: number },
    to: { x: number; y: number },
  ): void {
    this.ground.lineStyle(18, RENDER_CONFIG.palette.roadEdge, 0.22);
    this.ground.beginPath();
    this.ground.moveTo(from.x, from.y);
    this.ground.lineTo(to.x, from.y);
    this.ground.lineTo(to.x, to.y);
    this.ground.strokePath();
    this.ground.lineStyle(12, RENDER_CONFIG.palette.road, 0.46);
    this.ground.beginPath();
    this.ground.moveTo(from.x, from.y);
    this.ground.lineTo(to.x, from.y);
    this.ground.lineTo(to.x, to.y);
    this.ground.strokePath();
  }

  private drawZones(snapshot: SimulationSnapshot): void {
    for (const zone of snapshot.layout.zones) {
      const color = {
        farm: 0x739b58,
        residential: 0xb9925d,
        work: 0x8b7156,
        storage: 0x6f8fa8,
      }[zone.type];
      this.ground.fillStyle(color, 0.085);
      this.ground.fillRoundedRect(
        zone.rect.x,
        zone.rect.y,
        zone.rect.width,
        zone.rect.height,
        18,
      );
      this.ground.lineStyle(2, color, 0.13);
      this.ground.strokeRoundedRect(
        zone.rect.x + 2,
        zone.rect.y + 2,
        zone.rect.width - 4,
        zone.rect.height - 4,
        18,
      );
      const tag = this.scene.add
        .text(zone.rect.x + 12, zone.rect.y + 10, zone.label, {
          fontFamily: RENDER_CONFIG.fontFamily,
          fontSize: "14px",
          color: RENDER_CONFIG.palette.labelText,
          backgroundColor: "rgba(21, 32, 24, 0.68)",
          padding: { x: 8, y: 4 },
          resolution: 2,
        })
        .setOrigin(0, 0)
        .setShadow(0, 1, "#000000", 2, true, true);
      this.labels.add(tag);
    }
  }

  private drawDecorations(snapshot: SimulationSnapshot): void {
    const count = Math.floor((snapshot.mapWidth * snapshot.mapHeight) / 2300);
    for (let index = 0; index < count; index += 1) {
      const hash = stableHash(`${snapshot.seed}:deco:${index}`);
      const x = 10 + (hash % Math.max(1, snapshot.mapWidth - 20));
      const y = 10 + ((hash >>> 9) % Math.max(1, snapshot.mapHeight - 20));
      const kind = hash % 10;
      if (kind <= 4) {
        this.ground.lineStyle(1.5, 0x577c43, 0.4);
        this.ground.lineBetween(x, y + 3, x + 2, y - 4);
        this.ground.lineBetween(x + 2, y + 3, x + 5, y - 2);
      } else if (kind <= 6) {
        this.ground.fillStyle(0xd8d27d, 0.72);
        this.ground.fillCircle(x, y, 1.7);
      } else if (kind <= 8) {
        this.ground.fillStyle(0x7d8587, 0.45);
        this.ground.fillCircle(x, y, 2 + (hash % 3));
      } else {
        this.ground.fillStyle(RENDER_CONFIG.palette.soil, 0.12);
        this.ground.fillEllipse(x, y, 16 + (hash % 12), 5 + (hash % 5));
      }
    }
  }

  private drawSnow(snapshot: SimulationSnapshot): void {
    const scenario = snapshot.scenario;
    if (!scenario || scenario.snowDepth <= 0.5) {
      return;
    }
    const alpha = Phaser.Math.Clamp(scenario.snowDepth / 45, 0.1, 0.42);
    this.ground.fillStyle(0xf3f8ff, alpha);
    this.ground.fillRect(0, 0, snapshot.mapWidth, snapshot.mapHeight);
    const count = Math.min(120, Math.round(scenario.snowDepth * 4));
    this.ground.fillStyle(0xffffff, 0.72);
    for (let index = 0; index < count; index += 1) {
      const hash = stableHash(`${snapshot.seed}:snow:${index}`);
      this.ground.fillCircle(hash % snapshot.mapWidth, (hash >>> 8) % snapshot.mapHeight, 1 + (hash % 2));
    }
  }
}

function cacheKey(key: TerrainCacheKey): string {
  return `${key.seed}:${key.width}:${key.height}:${key.snow}`;
}

