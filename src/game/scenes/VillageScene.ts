import Phaser from "phaser";
import type {
  Building,
  Citizen,
  SimulationSnapshot,
} from "../../simulation";
import { CitizenSprite } from "../entities/CitizenSprite";

const COLORS = {
  ground: 0x9ecb86,
  road: 0xd8c59f,
  farm: 0x71964b,
  farmRows: 0xc5da78,
  house: 0xf4ddaa,
  roof: 0xc8664b,
  warehouse: 0x8193a6,
  lumberjack: 0x6b4b2f,
  lumberjackRoof: 0x3f7d4a,
  quarry: 0x8a8f99,
  quarryRock: 0x5d626b,
  carpentry: 0xb98a4e,
  carpentryRoof: 0x7c5a2e,
  blacksmith: 0x6a6f78,
  blacksmithRoof: 0x3e424a,
  market: 0xe4c06a,
  marketStripe: 0xcf5b4b,
  fence: 0x6b5638,
  gate: 0xf4e1aa,
};

const WINTER_BACKGROUND_KEY = "winter-village-background";
const WINTER_BACKGROUND_URL = "/assets/winter-village-background.png";

export class VillageScene extends Phaser.Scene {
  static readonly KEY = "village";

  private background?: Phaser.GameObjects.Image;
  private terrain?: Phaser.GameObjects.Graphics;
  private buildings?: Phaser.GameObjects.Graphics;
  private pathGraphics?: Phaser.GameObjects.Graphics;
  private labels?: Phaser.GameObjects.Container;
  private snapshot?: SimulationSnapshot;
  private selectedCitizenId?: string;
  private onCitizenSelect?: (citizenId: string) => void;
  private readonly citizenSprites = new Map<string, CitizenSprite>();
  private readonly seenVisualEvents = new Set<string>();

  constructor() {
    super(VillageScene.KEY);
  }

  preload(): void {
    this.load.image(WINTER_BACKGROUND_KEY, WINTER_BACKGROUND_URL);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0xdfeaf2);
    this.cameras.main.roundPixels = true;
    this.background = this.add
      .image(0, 0, WINTER_BACKGROUND_KEY)
      .setOrigin(0, 0)
      .setDepth(-20);
    this.resizeBackground();
    this.terrain = this.add.graphics().setDepth(-10);
    this.buildings = this.add.graphics().setDepth(2);
    this.pathGraphics = this.add.graphics().setDepth(8);
    this.labels = this.add.container().setDepth(5);
    this.drawTerrain();
    if (this.snapshot) {
      this.syncSnapshot();
    }
  }

  update(_time: number, delta: number): void {
    for (const sprite of this.citizenSprites.values()) {
      sprite.updateInterpolation(delta);
    }
  }

  setCitizenSelectionHandler(
    handler: (citizenId: string) => void,
  ): void {
    this.onCitizenSelect = handler;
  }

  setSelectedCitizen(citizenId?: string): void {
    this.selectedCitizenId = citizenId;
    this.updateSelection();
  }

  setSnapshot(snapshot: SimulationSnapshot): void {
    this.snapshot = snapshot;
    this.resizeBackground();
    if (this.buildings) {
      this.syncSnapshot();
    }
  }

  private syncSnapshot(): void {
    if (!this.snapshot) {
      return;
    }
    this.drawTerrain();
    this.drawBuildings(this.snapshot.buildings);
    const activeIds = new Set(this.snapshot.citizens.map((citizen) => citizen.id));
    const interpolationDuration =
      this.snapshot.speed >= 20 ? 35 : Math.max(70, 125 / this.snapshot.speed);

    for (const citizen of this.snapshot.citizens) {
      let sprite = this.citizenSprites.get(citizen.id);
      if (!sprite) {
        sprite = new CitizenSprite(this, citizen, (citizenId) => {
          this.onCitizenSelect?.(citizenId);
        });
        this.citizenSprites.set(citizen.id, sprite);
      }
      sprite.applyCitizen(citizen, interpolationDuration);
    }
    for (const [id, sprite] of this.citizenSprites) {
      if (!activeIds.has(id)) {
        sprite.destroy(true);
        this.citizenSprites.delete(id);
      }
    }
    this.playVisualEvents(this.snapshot.visualEvents);
    this.updateSelection();
  }

  private resizeBackground(): void {
    if (!this.background) {
      return;
    }
    this.background.setDisplaySize(
      this.snapshot?.mapWidth ?? 1024,
      this.snapshot?.mapHeight ?? 680,
    );
  }

  private updateSelection(): void {
    for (const [id, sprite] of this.citizenSprites) {
      sprite.setSelected(id === this.selectedCitizenId);
    }
    this.drawSelectedPath();
  }

  private drawTerrain(): void {
    if (!this.terrain) {
      return;
    }
    const width = this.snapshot?.mapWidth ?? 760;
    const height = this.snapshot?.mapHeight ?? 520;
    this.terrain.clear();
    const winter = this.snapshot?.scenario;
    const coldRatio = winter
      ? Phaser.Math.Clamp((5 - winter.currentTemperature) / 30, 0, 1)
      : 0;
    if (this.background && this.textures.exists(WINTER_BACKGROUND_KEY)) {
      this.terrain.fillStyle(0xeaf6ff, 0.08 + coldRatio * 0.16);
      this.terrain.fillRect(0, 0, width, height);
      if (winter && winter.snowDepth > 0.5) {
        this.terrain.fillStyle(0xffffff, 0.72);
        const snowflakes = Math.min(90, Math.round(winter.snowDepth * 5));
        for (let index = 0; index < snowflakes; index += 1) {
          const x = (index * 97 + snapshotHash(this.snapshot!.seed)) % width;
          const y = (index * 53 + snapshotHash(this.snapshot!.seed) * 3) % height;
          this.terrain.fillCircle(x, y, 1 + (index % 2));
        }
      }
      return;
    }
    const groundColor = Phaser.Display.Color.Interpolate.ColorWithColor(
      Phaser.Display.Color.ValueToColor(COLORS.ground),
      Phaser.Display.Color.ValueToColor(0xdce8ed),
      100,
      Math.round(coldRatio * 100),
    ).color;
    this.terrain.fillStyle(groundColor, 1);
    this.terrain.fillRect(0, 0, width, height);
    this.drawLayoutGround();
    this.terrain.fillStyle(0x7aae6c, 0.7);
    const count = Math.floor((width * height) / 14000);
    for (let index = 0; index < count; index += 1) {
      const x = 18 + ((index * 83) % (width - 36));
      const y = 35 + ((index * 47) % (height - 70));
      this.terrain.fillCircle(x, y, 4 + (index % 3));
    }
    if (winter && winter.snowDepth > 0.5) {
      this.terrain.fillStyle(0xffffff, 0.72);
      const snowflakes = Math.min(90, Math.round(winter.snowDepth * 5));
      for (let index = 0; index < snowflakes; index += 1) {
        const x = (index * 97 + snapshotHash(this.snapshot!.seed)) % width;
        const y = (index * 53 + snapshotHash(this.snapshot!.seed) * 3) % height;
        this.terrain.fillCircle(x, y, 1 + (index % 2));
      }
    }
  }

  private drawBuildings(items: Building[]): void {
    if (!this.buildings || !this.labels) {
      return;
    }
    this.buildings.clear();
    this.labels.removeAll(true);
    this.drawLayoutLabels();
    for (const building of items) {
      this.drawBuilding(building);
    }
  }

  private drawLayoutGround(): void {
    if (!this.terrain || !this.snapshot?.layout) {
      return;
    }
    const center = { x: this.snapshot.mapWidth / 2, y: this.snapshot.mapHeight / 2 };
    for (const zone of this.snapshot.layout.zones) {
      const color = zoneColor(zone.type);
      this.terrain.fillStyle(color, 0.12);
      this.terrain.fillRoundedRect(
        zone.rect.x,
        zone.rect.y,
        zone.rect.width,
        zone.rect.height,
        12,
      );
      this.drawRoad(zone.gate, center, 0.32);
      this.drawFence(zone);
      this.terrain.fillStyle(COLORS.gate, 0.95);
      this.terrain.fillRoundedRect(zone.gate.x - 14, zone.gate.y - 8, 28, 16, 5);
      this.terrain.lineStyle(1, COLORS.fence, 0.55);
      this.terrain.strokeRoundedRect(zone.gate.x - 14, zone.gate.y - 8, 28, 16, 5);
    }
  }

  private drawRoad(
    from: { x: number; y: number },
    to: { x: number; y: number },
    alpha: number,
  ): void {
    if (!this.terrain) {
      return;
    }
    this.terrain.lineStyle(10, COLORS.road, alpha);
    this.terrain.beginPath();
    this.terrain.moveTo(from.x, from.y);
    this.terrain.lineTo(to.x, from.y);
    this.terrain.lineTo(to.x, to.y);
    this.terrain.strokePath();
  }

  private drawFence(zone: SimulationSnapshot["layout"]["zones"][number]): void {
    if (!this.terrain) {
      return;
    }
    const step = 10;
    const left = zone.rect.x;
    const right = zone.rect.x + zone.rect.width;
    const top = zone.rect.y;
    const bottom = zone.rect.y + zone.rect.height;
    this.terrain.fillStyle(COLORS.fence, 0.88);

    for (let x = left; x <= right; x += step) {
      if (!nearGate({ x, y: top }, zone.gate) && !nearGate({ x, y: bottom }, zone.gate)) {
        this.terrain.fillRect(x - 1, top - 4, 2, 8);
        this.terrain.fillRect(x - 1, bottom - 4, 2, 8);
      }
    }
    for (let y = top; y <= bottom; y += step) {
      if (!nearGate({ x: left, y }, zone.gate) && !nearGate({ x: right, y }, zone.gate)) {
        this.terrain.fillRect(left - 4, y - 1, 8, 2);
        this.terrain.fillRect(right - 4, y - 1, 8, 2);
      }
    }
  }

  private drawLayoutLabels(): void {
    if (!this.labels || !this.snapshot?.layout) {
      return;
    }
    for (const zone of this.snapshot.layout.zones) {
      this.labels.add(
        this.add
          .text(zone.rect.x + 12, zone.rect.y + 10, zone.label, {
            fontFamily: "Malgun Gothic, system-ui, sans-serif",
            fontSize: "14px",
            color: "#143122",
            backgroundColor: "rgba(255,255,255,0.86)",
            padding: { x: 7, y: 3 },
            resolution: 2,
          })
          .setOrigin(0, 0)
          .setShadow(0, 1, "#ffffff", 2, true, true),
      );
      this.labels.add(
        this.add
          .text(zone.gate.x, zone.gate.y + 10, "출입구", {
            fontFamily: "Malgun Gothic, system-ui, sans-serif",
            fontSize: "12px",
            color: "#3b3425",
            backgroundColor: "rgba(255,255,255,0.76)",
            padding: { x: 5, y: 2 },
            resolution: 2,
          })
          .setOrigin(0.5, 0)
          .setShadow(0, 1, "#ffffff", 2, true, true),
      );
    }
  }

  private drawBuilding(building: Building): void {
    if (!this.buildings || !this.labels) {
      return;
    }
    const underConstruction = building.constructionProgress < 100;
    const alpha = underConstruction ? 0.48 : 1;

    if (building.type === "farm") {
      this.buildings.fillStyle(COLORS.farm, alpha);
      this.buildings.fillRoundedRect(
        building.position.x - 50,
        building.position.y - 30,
        100,
        60,
        6,
      );
      this.buildings.lineStyle(2, COLORS.farmRows, 0.9);
      for (let row = -18; row <= 18; row += 12) {
        this.buildings.lineBetween(
          building.position.x - 40,
          building.position.y + row,
          building.position.x + 40,
          building.position.y + row,
        );
      }
      this.addBuildingLabel(
        building,
        `농장 ${formatFood(building.inventory.food ?? 0)}`,
      );
    } else if (building.type === "house") {
      this.buildings.fillStyle(COLORS.house, alpha);
      this.buildings.fillRoundedRect(
        building.position.x - 28,
        building.position.y - 18,
        56,
        38,
        4,
      );
      this.buildings.fillStyle(COLORS.roof, alpha);
      this.buildings.fillTriangle(
        building.position.x - 34,
        building.position.y - 15,
        building.position.x + 34,
        building.position.y - 15,
        building.position.x,
        building.position.y - 42,
      );
      if (underConstruction) {
        this.addBuildingLabel(
          building,
          `건설 ${Math.round(building.constructionProgress)}%`,
        );
      } else if (this.snapshot?.scenario) {
        this.addBuildingLabel(
          building,
          `${building.winter.indoorTemperature.toFixed(0)}° · 단열 ${Math.round(building.winter.insulation)} · 🔥${building.winter.firewoodStored.toFixed(1)}`,
        );
      }
    } else if (building.type === "lumberjack") {
      this.buildings.fillStyle(COLORS.lumberjack, alpha);
      this.buildings.fillRoundedRect(
        building.position.x - 36,
        building.position.y - 22,
        72,
        44,
        5,
      );
      this.buildings.fillStyle(COLORS.lumberjackRoof, alpha);
      this.buildings.fillTriangle(
        building.position.x - 40,
        building.position.y - 18,
        building.position.x + 40,
        building.position.y - 18,
        building.position.x,
        building.position.y - 44,
      );
      this.addBuildingLabel(building, "벌목장");
    } else if (building.type === "quarry") {
      this.buildings.fillStyle(COLORS.quarry, alpha);
      this.buildings.fillRoundedRect(
        building.position.x - 36,
        building.position.y - 22,
        72,
        44,
        5,
      );
      this.buildings.fillStyle(COLORS.quarryRock, alpha);
      this.buildings.fillCircle(building.position.x - 14, building.position.y + 4, 9);
      this.buildings.fillCircle(building.position.x + 10, building.position.y - 2, 11);
      this.addBuildingLabel(building, "채석장");
    } else if (building.type === "carpentry") {
      this.buildings.fillStyle(COLORS.carpentry, alpha);
      this.buildings.fillRoundedRect(
        building.position.x - 38,
        building.position.y - 22,
        76,
        44,
        5,
      );
      this.buildings.fillStyle(COLORS.carpentryRoof, alpha);
      this.buildings.fillRect(
        building.position.x - 42,
        building.position.y - 28,
        84,
        10,
      );
      // 켜놓은 판자
      this.buildings.fillStyle(0xe7cf9c, alpha);
      this.buildings.fillRect(building.position.x + 16, building.position.y + 10, 26, 5);
      this.buildings.fillRect(building.position.x + 16, building.position.y + 17, 26, 5);
      this.addBuildingLabel(building, "목공소");
    } else if (building.type === "blacksmith") {
      this.buildings.fillStyle(COLORS.blacksmith, alpha);
      this.buildings.fillRoundedRect(
        building.position.x - 34,
        building.position.y - 20,
        68,
        40,
        5,
      );
      this.buildings.fillStyle(COLORS.blacksmithRoof, alpha);
      this.buildings.fillTriangle(
        building.position.x - 38,
        building.position.y - 16,
        building.position.x + 38,
        building.position.y - 16,
        building.position.x,
        building.position.y - 40,
      );
      // 굴뚝 + 불씨
      this.buildings.fillStyle(0x4a4e55, alpha);
      this.buildings.fillRect(building.position.x + 18, building.position.y - 44, 10, 22);
      this.buildings.fillStyle(0xe8762d, alpha);
      this.buildings.fillCircle(building.position.x + 23, building.position.y - 46, 4);
      this.addBuildingLabel(building, "대장간");
    } else if (building.type === "market") {
      this.buildings.fillStyle(COLORS.market, alpha);
      this.buildings.fillRoundedRect(
        building.position.x - 40,
        building.position.y - 14,
        80,
        34,
        4,
      );
      // 줄무늬 차양
      for (let i = 0; i < 5; i += 1) {
        this.buildings.fillStyle(
          i % 2 === 0 ? COLORS.marketStripe : 0xf3f0e6,
          alpha,
        );
        this.buildings.fillRect(
          building.position.x - 40 + i * 16,
          building.position.y - 26,
          16,
          12,
        );
      }
      this.addBuildingLabel(building, "시장");
    } else {
      this.buildings.fillStyle(COLORS.warehouse, alpha);
      this.buildings.fillRoundedRect(
        building.position.x - 40,
        building.position.y - 30,
        80,
        60,
        5,
      );
      this.buildings.fillStyle(0x536474, alpha);
      this.buildings.fillRect(
        building.position.x - 13,
        building.position.y,
        26,
        30,
      );
      this.addBuildingLabel(
        building,
        `창고 ${formatFood(building.inventory.food ?? 0)}`,
      );
    }

    this.buildings.fillStyle(0xffffff, 0.8);
    this.buildings.fillCircle(building.entrance.x, building.entrance.y, 3);
  }

  private addBuildingLabel(building: Building, label: string): void {
    if (!this.labels) {
      return;
    }
    this.labels.add(
      this.add
        .text(building.position.x, building.position.y + 38, label, {
          fontFamily: "Malgun Gothic, system-ui, sans-serif",
          fontSize: "13px",
          fontStyle: "bold",
          color: "#10281d",
          backgroundColor: "rgba(255,255,255,0.9)",
          padding: { x: 6, y: 3 },
          resolution: 2,
        })
        .setOrigin(0.5, 0)
        .setShadow(0, 1, "#ffffff", 2, true, true),
    );
  }

  private playVisualEvents(
    events: SimulationSnapshot["visualEvents"],
  ): void {
    for (const event of events) {
      if (this.seenVisualEvents.has(event.id)) {
        continue;
      }
      this.seenVisualEvents.add(event.id);
      this.spawnResourcePopup(event);
    }
    while (this.seenVisualEvents.size > 160) {
      const oldest = this.seenVisualEvents.values().next().value as
        | string
        | undefined;
      if (!oldest) {
        break;
      }
      this.seenVisualEvents.delete(oldest);
    }
  }

  private spawnResourcePopup(
    event: SimulationSnapshot["visualEvents"][number],
  ): void {
    const container = this.add
      .container(event.position.x, event.position.y - 38)
      .setDepth(35)
      .setAlpha(0)
      .setScale(0.86);
    const text = this.add
      .text(0, 0, `${event.icon} ${event.label}`, {
        fontFamily: "Segoe UI Emoji, Malgun Gothic, system-ui, sans-serif",
        fontSize: "16px",
        fontStyle: "bold",
        color: "#10281d",
        resolution: 2,
      })
      .setOrigin(0.5);
    text.setShadow(0, 1, "#ffffff", 3, true, true);
    const width = Math.max(42, text.width + 18);
    const bubble = this.add.graphics();
    bubble.fillStyle(0xffffff, 0.94);
    bubble.fillRoundedRect(-width / 2, -14, width, 28, 12);
    bubble.lineStyle(2, 0xbdd2e8, 0.95);
    bubble.strokeRoundedRect(-width / 2, -14, width, 28, 12);
    container.add([bubble, text]);

    for (let index = 0; index < 3; index += 1) {
      const spark = this.add.circle(
        Phaser.Math.Between(-18, 18),
        Phaser.Math.Between(-10, 10),
        2,
        0xfff1a8,
        0.95,
      );
      container.add(spark);
      this.tweens.add({
        targets: spark,
        x: spark.x + Phaser.Math.Between(-12, 12),
        y: spark.y - Phaser.Math.Between(12, 24),
        alpha: 0,
        scale: 0.35,
        duration: 620,
        ease: "Sine.easeOut",
      });
    }

    this.tweens.add({
      targets: container,
      y: container.y - 42,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.86, to: 1 },
      duration: 180,
      ease: "Back.easeOut",
      onComplete: () => {
        this.tweens.add({
          targets: container,
          y: container.y - 16,
          alpha: 0,
          duration: 760,
          delay: 220,
          ease: "Sine.easeIn",
          onComplete: () => container.destroy(true),
        });
      },
    });
  }

  private drawSelectedPath(): void {
    if (!this.pathGraphics) {
      return;
    }
    this.pathGraphics.clear();
    const citizen = this.snapshot?.citizens.find(
      (item) => item.id === this.selectedCitizenId,
    );
    if (!citizen) {
      return;
    }
    const points = [
      citizen.position,
      ...citizen.path.slice(citizen.pathIndex),
    ];
    if (points.length > 1) {
      this.pathGraphics.lineStyle(2, 0xffffff, 0.8);
      this.pathGraphics.beginPath();
      this.pathGraphics.moveTo(points[0]!.x, points[0]!.y);
      for (const point of points.slice(1)) {
        this.pathGraphics.lineTo(point.x, point.y);
      }
      this.pathGraphics.strokePath();
    }
    if (citizen.targetPosition) {
      this.pathGraphics.lineStyle(2, 0xf7e36d, 1);
      this.pathGraphics.strokeCircle(
        citizen.targetPosition.x,
        citizen.targetPosition.y,
        8,
      );
    }
  }
}

function formatFood(value: number): string {
  return Math.round(value * 10) / 10 + "";
}

function snapshotHash(seed: string): number {
  let hash = 0;
  for (const character of seed) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash;
}

function zoneColor(type: SimulationSnapshot["layout"]["zones"][number]["type"]): number {
  return {
    farm: 0x7fb45d,
    residential: 0xe4b36a,
    work: 0x9a7a5a,
    storage: 0x7f9fb7,
  }[type];
}

function nearGate(
  point: { x: number; y: number },
  gate: { x: number; y: number },
): boolean {
  return Math.abs(point.x - gate.x) <= 18 && Math.abs(point.y - gate.y) <= 18;
}
