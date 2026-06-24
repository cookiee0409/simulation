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
    this.terrain.clear();
    this.terrain.fillStyle(COLORS.ground, 1);
    this.terrain.fillRect(0, 0, 760, 520);
    this.terrain.fillStyle(0x7aae6c, 0.7);
    for (let index = 0; index < 28; index += 1) {
      const x = 18 + ((index * 83) % 720);
      const y = 35 + ((index * 47) % 450);
      this.terrain.fillCircle(x, y, 4 + (index % 3));
    }
    this.terrain.fillStyle(COLORS.road, 0.9);
    this.terrain.fillRoundedRect(45, 235, 670, 30, 9);
    this.terrain.fillRoundedRect(345, 50, 30, 420, 8);
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
