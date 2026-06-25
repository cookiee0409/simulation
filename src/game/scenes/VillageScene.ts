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
};

export class VillageScene extends Phaser.Scene {
  static readonly KEY = "village";

  private terrain?: Phaser.GameObjects.Graphics;
  private buildings?: Phaser.GameObjects.Graphics;
  private pathGraphics?: Phaser.GameObjects.Graphics;
  private labels?: Phaser.GameObjects.Container;
  private snapshot?: SimulationSnapshot;
  private selectedCitizenId?: string;
  private onCitizenSelect?: (citizenId: string) => void;
  private readonly citizenSprites = new Map<string, CitizenSprite>();

  constructor() {
    super(VillageScene.KEY);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.ground);
    this.terrain = this.add.graphics();
    this.buildings = this.add.graphics();
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
    this.updateSelection();
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
    this.terrain.fillStyle(COLORS.ground, 1);
    this.terrain.fillRect(0, 0, width, height);
    this.terrain.fillStyle(0x7aae6c, 0.7);
    const count = Math.floor((width * height) / 14000);
    for (let index = 0; index < count; index += 1) {
      const x = 18 + ((index * 83) % (width - 36));
      const y = 35 + ((index * 47) % (height - 70));
      this.terrain.fillCircle(x, y, 4 + (index % 3));
    }
  }

  private drawBuildings(items: Building[]): void {
    if (!this.buildings || !this.labels) {
      return;
    }
    this.buildings.clear();
    this.labels.removeAll(true);
    for (const building of items) {
      this.drawBuilding(building);
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
          fontFamily: "system-ui, sans-serif",
          fontSize: "10px",
          color: "#173124",
          backgroundColor: "rgba(255,255,255,0.72)",
          padding: { x: 4, y: 2 },
        })
        .setOrigin(0.5, 0),
    );
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
