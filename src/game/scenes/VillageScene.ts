import Phaser from "phaser";
import type { Building, SimulationSnapshot } from "../../simulation";

const COLORS = {
  ground: 0x9ecb86,
  road: 0xd8c59f,
  farm: 0x71964b,
  farmRows: 0xc5da78,
  house: 0xf4ddaa,
  roof: 0xc8664b,
  warehouse: 0x8193a6,
  citizen: 0x263642,
  farmer: 0xf3c969,
};

export class VillageScene extends Phaser.Scene {
  static readonly KEY = "village";

  private graphics?: Phaser.GameObjects.Graphics;
  private labels?: Phaser.GameObjects.Container;
  private snapshot?: SimulationSnapshot;

  constructor() {
    super(VillageScene.KEY);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(COLORS.ground);
    this.graphics = this.add.graphics();
    this.labels = this.add.container();
    if (this.snapshot) {
      this.drawVillage();
    }
  }

  setSnapshot(snapshot: SimulationSnapshot): void {
    this.snapshot = snapshot;
    if (this.graphics) {
      this.drawVillage();
    }
  }

  private drawVillage(): void {
    if (!this.graphics || !this.labels || !this.snapshot) {
      return;
    }

    this.graphics.clear();
    this.labels.removeAll(true);
    this.drawTerrain();

    for (const building of this.snapshot.buildings) {
      this.drawBuilding(building);
    }

    for (const citizen of this.snapshot.citizens) {
      const color =
        citizen.job === "farmer" ? COLORS.farmer : COLORS.citizen;
      this.graphics.fillStyle(color, 0.92);
      this.graphics.fillCircle(citizen.position.x, citizen.position.y, 3.4);
    }

    const dayLabel = this.add
      .text(24, 20, `DAY ${this.snapshot.day}`, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "18px",
        color: "#173124",
        backgroundColor: "rgba(255,255,255,0.72)",
        padding: { x: 10, y: 6 },
      })
      .setDepth(2);
    this.labels.add(dayLabel);
  }

  private drawTerrain(): void {
    if (!this.graphics) {
      return;
    }

    this.graphics.fillStyle(COLORS.ground, 1);
    this.graphics.fillRect(0, 0, 760, 520);

    this.graphics.fillStyle(0x7aae6c, 0.7);
    for (let index = 0; index < 36; index += 1) {
      const x = 18 + ((index * 83) % 720);
      const y = 35 + ((index * 47) % 450);
      this.graphics.fillCircle(x, y, 5 + (index % 4));
    }

    this.graphics.fillStyle(COLORS.road, 0.9);
    this.graphics.fillRoundedRect(55, 235, 650, 26, 9);
    this.graphics.fillRoundedRect(340, 80, 24, 360, 8);
  }

  private drawBuilding(building: Building): void {
    if (!this.graphics || !this.labels) {
      return;
    }

    if (building.type === "farm") {
      this.graphics.fillStyle(COLORS.farm, 1);
      this.graphics.fillRoundedRect(
        building.position.x - 43,
        building.position.y - 27,
        86,
        54,
        6,
      );
      this.graphics.lineStyle(2, COLORS.farmRows, 0.9);
      for (let row = -16; row <= 16; row += 11) {
        this.graphics.lineBetween(
          building.position.x - 35,
          building.position.y + row,
          building.position.x + 35,
          building.position.y + row,
        );
      }
      this.addBuildingLabel(building, "농장");
      return;
    }

    if (building.type === "house") {
      this.graphics.fillStyle(COLORS.house, 1);
      this.graphics.fillRoundedRect(
        building.position.x - 22,
        building.position.y - 16,
        44,
        34,
        4,
      );
      this.graphics.fillStyle(COLORS.roof, 1);
      this.graphics.fillTriangle(
        building.position.x - 27,
        building.position.y - 13,
        building.position.x + 27,
        building.position.y - 13,
        building.position.x,
        building.position.y - 36,
      );
      this.graphics.fillStyle(0x684a3b, 1);
      this.graphics.fillRect(
        building.position.x - 5,
        building.position.y + 2,
        10,
        16,
      );
      return;
    }

    this.graphics.fillStyle(COLORS.warehouse, 1);
    this.graphics.fillRoundedRect(
      building.position.x - 35,
      building.position.y - 30,
      70,
      60,
      5,
    );
    this.graphics.fillStyle(0x536474, 1);
    this.graphics.fillRect(
      building.position.x - 13,
      building.position.y,
      26,
      30,
    );
    this.addBuildingLabel(building, "창고");
  }

  private addBuildingLabel(building: Building, label: string): void {
    if (!this.labels) {
      return;
    }
    const text = this.add
      .text(building.position.x, building.position.y + 34, label, {
        fontFamily: "system-ui, sans-serif",
        fontSize: "11px",
        color: "#173124",
        backgroundColor: "rgba(255,255,255,0.65)",
        padding: { x: 4, y: 2 },
      })
      .setOrigin(0.5, 0);
    this.labels.add(text);
  }
}
