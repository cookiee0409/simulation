import Phaser from "phaser";
import type { Building, SimulationSnapshot } from "../../simulation";
import { BuildingSprite } from "../entities/BuildingSprite";
import { zoomLevel } from "./RenderConfig";

export class BuildingRenderer {
  private readonly sprites = new Map<string, BuildingSprite>();
  private selectedBuildingId?: string;
  private zoom = 1;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly onSelect: (buildingId: string) => void,
  ) {}

  render(snapshot: SimulationSnapshot): void {
    const active = new Set(snapshot.buildings.map((building) => building.id));
    const level = zoomLevel(this.zoom);
    for (const building of snapshot.buildings) {
      let sprite = this.sprites.get(building.id);
      if (!sprite) {
        sprite = new BuildingSprite(this.scene, building, snapshot.seed, this.onSelect);
        this.sprites.set(building.id, sprite);
      }
      sprite.update(building, level, building.id === this.selectedBuildingId);
    }
    for (const [id, sprite] of this.sprites) {
      if (!active.has(id)) {
        sprite.destroy(true);
        this.sprites.delete(id);
      }
    }
  }

  setZoom(zoom: number): void {
    this.zoom = zoom;
    const level = zoomLevel(zoom);
    for (const sprite of this.sprites.values()) {
      sprite.updateLod(level);
    }
  }

  setSelectedBuilding(id?: string): void {
    this.selectedBuildingId = id;
    for (const [buildingId, sprite] of this.sprites) {
      sprite.setSelected(buildingId === id);
    }
  }

  getSprite(id: string): BuildingSprite | undefined {
    return this.sprites.get(id);
  }

  destroy(): void {
    for (const sprite of this.sprites.values()) {
      sprite.destroy(true);
    }
    this.sprites.clear();
  }
}

