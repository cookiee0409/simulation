import Phaser from "phaser";
import type { Building } from "../../simulation";
import { buildingAssetKey } from "../assets/AssetManifest";
import { RENDER_CONFIG, variant, zoomLevel, type ZoomLevel } from "../rendering/RenderConfig";

type BuildingKind = Building["type"];

const BUILDING_LABELS: Record<BuildingKind, string> = {
  farm: "농장",
  house: "주택",
  warehouse: "창고",
  lumberjack: "벌목장",
  quarry: "채석장",
  carpentry: "목공소",
  blacksmith: "대장간",
  market: "시장",
};

export class BuildingSprite extends Phaser.GameObjects.Container {
  readonly buildingId: string;
  private readonly base: Phaser.GameObjects.Image;
  private readonly detail: Phaser.GameObjects.Graphics;
  private readonly hoverShape: Phaser.GameObjects.Rectangle;
  private readonly label: Phaser.GameObjects.Text;
  private readonly statusIcon: Phaser.GameObjects.Text;
  private readonly variantIndex: number;
  private hovered = false;
  private selected = false;
  private latest?: Building;

  constructor(
    scene: Phaser.Scene,
    building: Building,
    seed: string,
    onSelect: (id: string) => void,
  ) {
    const size = RENDER_CONFIG.building.sizes[building.type];
    super(scene, building.position.x, building.position.y);
    this.buildingId = building.id;
    this.variantIndex = variant(`${seed}:${building.id}:building`, 4);
    this.base = scene.add
      .image(0, 0, buildingAssetKey(building.type))
      .setDisplaySize(size.width, size.height)
      .setOrigin(0.5, 0.5);
    this.detail = scene.add.graphics();
    this.hoverShape = scene.add
      .rectangle(0, 4, size.width + 14, size.height + 12, 0xffffff, 0)
      .setStrokeStyle(3, RENDER_CONFIG.palette.selection, 0)
      .setOrigin(0.5);
    this.label = scene.add
      .text(0, size.height / 2 + 4, BUILDING_LABELS[building.type] ?? building.type, {
        fontFamily: RENDER_CONFIG.fontFamily,
        fontSize: "14px",
        fontStyle: "700",
        color: RENDER_CONFIG.palette.labelText,
        backgroundColor: "rgba(21, 32, 24, 0.72)",
        padding: { x: 7, y: 3 },
        resolution: 2,
      })
      .setOrigin(0.5, 0);
    this.statusIcon = scene.add
      .text(size.width / 2 - 18, -size.height / 2 + 8, "", {
        fontFamily: "Segoe UI Emoji, system-ui, sans-serif",
        fontSize: "18px",
        backgroundColor: "rgba(21, 32, 24, 0.55)",
        padding: { x: 4, y: 2 },
        resolution: 2,
      })
      .setOrigin(0.5);

    this.add([this.detail, this.base, this.hoverShape, this.label, this.statusIcon]);
    this.setSize(size.width, size.height);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-size.width / 2, -size.height / 2, size.width, size.height),
      Phaser.Geom.Rectangle.Contains,
    );
    this.on("pointerover", () => {
      this.hovered = true;
      this.updatePresentation();
    });
    this.on("pointerout", () => {
      this.hovered = false;
      this.updatePresentation();
    });
    this.on("pointerdown", () => onSelect(this.buildingId));
    scene.add.existing(this);
    this.update(building, "default");
  }

  update(building: Building, level: ZoomLevel, selected = this.selected): void {
    this.latest = building;
    this.selected = selected;
    this.setPosition(building.position.x, building.position.y);
    this.setDepth(RENDER_CONFIG.depths.building + building.position.y);
    this.drawDetails(building);
    this.updateStatus(building);
    this.updateLod(level);
    this.updatePresentation();
  }

  updateLod(level: ZoomLevel): void {
    const detailVisible = level !== "far";
    this.label.setVisible(level !== "far" || this.hovered || this.selected);
    this.detail.setVisible(detailVisible);
    if (this.latest) {
      this.label.setText(labelFor(this.latest, level, this.hovered || this.selected));
    }
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.updatePresentation();
  }

  private updatePresentation(): void {
    const active = this.hovered || this.selected;
    this.hoverShape
      .setFillStyle(0xffffff, active ? RENDER_CONFIG.building.hoverAlpha : 0)
      .setStrokeStyle(
        this.selected ? 4 : 3,
        this.selected ? RENDER_CONFIG.palette.selection : RENDER_CONFIG.palette.hover,
        active ? 0.82 : 0,
      );
    this.label.setAlpha(active ? 1 : 0.86);
  }

  private drawDetails(building: Building): void {
    const size = RENDER_CONFIG.building.sizes[building.type];
    this.detail.clear();
    this.detail.fillStyle(0x111510, RENDER_CONFIG.building.shadowAlpha);
    this.detail.fillEllipse(0, size.height / 2 - 8, size.width * 0.82, 22);
    this.detail.lineStyle(RENDER_CONFIG.building.outline, RENDER_CONFIG.palette.outline, 0.7);

    if (building.constructionProgress < 100) {
      this.drawConstruction(building, size);
      return;
    }

    switch (building.type) {
      case "farm":
        this.drawFarm(building, size);
        break;
      case "warehouse":
        this.drawWarehouseStacks(building);
        break;
      case "lumberjack":
        this.drawLogStacks();
        break;
      case "quarry":
        this.drawQuarryRocks();
        break;
      case "carpentry":
        this.drawCarpentryTools();
        break;
      case "blacksmith":
        this.drawForgeGlow(building);
        break;
      case "market":
        this.drawMarketGoods();
        break;
      case "house":
        this.drawHouseDetails(building);
        break;
    }
  }

  private drawConstruction(
    building: Building,
    size: { width: number; height: number },
  ): void {
    const progress = building.constructionProgress;
    this.base.setAlpha(0.18 + progress / 160);
    this.detail.fillStyle(0x8b6a42, 0.88);
    this.detail.fillRoundedRect(-size.width / 2 + 12, size.height / 2 - 34, size.width - 24, 18, 4);
    this.detail.lineStyle(4, 0x5d4428, 0.9);
    if (progress >= 25) {
      for (let x = -size.width / 2 + 24; x <= size.width / 2 - 24; x += 22) {
        this.detail.lineBetween(x, size.height / 2 - 34, x, -size.height / 2 + 24);
      }
    }
    if (progress >= 55) {
      this.detail.lineBetween(-size.width / 2 + 18, -10, 0, -size.height / 2 + 12);
      this.detail.lineBetween(size.width / 2 - 18, -10, 0, -size.height / 2 + 12);
    }
    if (progress >= 80) {
      this.detail.fillStyle(0xb9634f, 0.74);
      this.detail.fillTriangle(-size.width / 2 + 18, -10, size.width / 2 - 18, -10, 0, -size.height / 2 + 8);
    }
  }

  private drawFarm(building: Building, size: { width: number; height: number }): void {
    this.base.setAlpha(0.94);
    const phase = (variant(`${building.id}:crop:${this.variantIndex}`, 4) + Math.floor((building.inventory.food ?? 0) / 12)) % 4;
    const cropColor = [0x8b7d44, 0x77a257, 0x5e953d, 0xd2b950][phase]!;
    this.detail.lineStyle(2, 0x4f3a24, 0.28);
    for (let y = -size.height / 2 + 28; y < size.height / 2 - 12; y += 13) {
      this.detail.lineBetween(-size.width / 2 + 22, y, size.width / 2 - 22, y + (this.variantIndex % 2));
      this.detail.fillStyle(cropColor, 0.86);
      for (let x = -size.width / 2 + 30; x < size.width / 2 - 25; x += 18) {
        this.detail.fillEllipse(x, y - 3, 5, 11);
      }
    }
    this.detail.fillStyle(0x6f5030, 0.9);
    this.detail.fillRoundedRect(size.width / 2 - 34, -size.height / 2 + 12, 20, 16, 3);
    this.detail.fillStyle(0x8fb9ca, 0.92);
    this.detail.fillCircle(-size.width / 2 + 22, size.height / 2 - 22, 6);
  }

  private drawHouseDetails(building: Building): void {
    this.base.setTint([0xffffff, 0xfff1df, 0xf3f6ff, 0xffeadf][this.variantIndex]!);
    if (building.winter.firewoodStored > 0 || building.winter.indoorTemperature >= 8) {
      this.detail.fillStyle(0xffd05b, 0.34);
      this.detail.fillCircle(21, -10, 20);
      this.detail.fillStyle(0xdde2e6, 0.42);
      this.detail.fillCircle(27, -48, 5);
      this.detail.fillCircle(33, -58, 7);
    }
  }

  private drawWarehouseStacks(building: Building): void {
    const amount = Math.min(5, Math.floor((building.inventory.food ?? 0) / 80));
    for (let index = 0; index < amount; index += 1) {
      this.detail.fillStyle(index % 2 ? 0xb68645 : 0xd1ba78, 0.95);
      this.detail.fillRoundedRect(-56 + index * 18, 27 - (index % 2) * 6, 18, 13, 3);
    }
  }

  private drawLogStacks(): void {
    for (let index = 0; index < 4; index += 1) {
      this.detail.fillStyle(0x9b7041, 0.95);
      this.detail.fillRoundedRect(-58 + index * 15, 28, 32, 7, 4);
      this.detail.fillStyle(0xd0ad75, 0.95);
      this.detail.fillCircle(-58 + index * 15, 31, 4);
    }
  }

  private drawQuarryRocks(): void {
    for (let index = 0; index < 5; index += 1) {
      this.detail.fillStyle([0x6e747a, 0x8a9097, 0x585f66][index % 3]!, 0.95);
      this.detail.fillCircle(-42 + index * 21, 28 + (index % 2) * 8, 8 + (index % 3));
    }
  }

  private drawCarpentryTools(): void {
    this.detail.fillStyle(0xe2c48b, 0.94);
    this.detail.fillRoundedRect(18, 24, 42, 8, 3);
    this.detail.fillRoundedRect(20, 37, 38, 7, 3);
    this.detail.lineStyle(3, 0x43484d, 0.95);
    this.detail.lineBetween(-44, 33, -22, 20);
    this.detail.lineBetween(-22, 20, -10, 28);
  }

  private drawForgeGlow(building: Building): void {
    this.detail.fillStyle(0xff7d2a, 0.32 + Math.min(0.18, building.workers.length * 0.06));
    this.detail.fillCircle(-20, 16, 24);
    this.detail.fillStyle(0xfcb454, 0.9);
    this.detail.fillCircle(-20, 16, 8);
    this.detail.fillStyle(0x25282d, 0.95);
    this.detail.fillRoundedRect(22, 24, 32, 12, 6);
  }

  private drawMarketGoods(): void {
    const colors = [0x7aac66, 0xc97954, 0x8b74b4, 0xd6ba5c];
    for (let index = 0; index < 4; index += 1) {
      this.detail.fillStyle(colors[index]!, 0.92);
      this.detail.fillCircle(-42 + index * 26, 28, 7);
    }
  }

  private updateStatus(building: Building): void {
    if (building.constructionProgress < 100) {
      this.statusIcon.setText("🔨");
    } else if (building.type === "house" && building.winter.firewoodStored > 0) {
      this.statusIcon.setText("🔥");
    } else if (building.workers.length > 0) {
      this.statusIcon.setText("●");
    } else {
      this.statusIcon.setText("");
    }
  }
}

export function labelFor(
  building: Building,
  level: ZoomLevel,
  detailed: boolean,
): string {
  const name = BUILDING_LABELS[building.type] ?? building.type;
  if (level === "far") return iconFor(building.type);
  if (!detailed && level === "default") return name;
  if (building.type === "farm") return `${name} · 식량 ${format(building.inventory.food ?? 0)}`;
  if (building.type === "warehouse") return `${name} · 저장 ${format(building.inventory.food ?? 0)}`;
  if (building.type === "house") {
    return `${name} · ${Math.round(building.winter.indoorTemperature)}℃`;
  }
  return name;
}

function iconFor(type: BuildingKind): string {
  const icons: Record<BuildingKind, string> = {
    farm: "🌾",
    house: "⌂",
    warehouse: "▣",
    lumberjack: "🪵",
    quarry: "◆",
    carpentry: "▤",
    blacksmith: "⚒",
    market: "▥",
  };
  return icons[type];
}

function format(value: number): string {
  return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 }).format(value);
}
