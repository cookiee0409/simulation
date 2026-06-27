import Phaser from "phaser";
import type { Citizen, SimulationSnapshot } from "../../simulation";
import { CameraController } from "../camera/CameraController";
import { CitizenSprite } from "../entities/CitizenSprite";
import { SpeechBubble } from "../entities/SpeechBubble";
import { BuildingRenderer } from "../rendering/BuildingRenderer";
import { EffectsRenderer } from "../rendering/EffectsRenderer";
import { RENDER_CONFIG } from "../rendering/RenderConfig";
import { TerrainRenderer } from "../rendering/TerrainRenderer";
import { preloadVisualAssets } from "../rendering/TextureFactory";

export class VillageScene extends Phaser.Scene {
  static readonly KEY = "village";

  private terrain?: TerrainRenderer;
  private buildings?: BuildingRenderer;
  private effects?: EffectsRenderer;
  private cameraController?: CameraController;
  private pathGraphics?: Phaser.GameObjects.Graphics;
  private snapshot?: SimulationSnapshot;
  private selectedCitizenId?: string;
  private selectedBuildingId?: string;
  private onCitizenSelect?: (citizenId: string) => void;
  private readonly citizenSprites = new Map<string, CitizenSprite>();
  private readonly speechBubbles = new Map<string, SpeechBubble>();
  private cameraReady = false;

  constructor() {
    super(VillageScene.KEY);
  }

  preload(): void {
    preloadVisualAssets(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x87a874);
    this.cameras.main.roundPixels = true;
    this.terrain = new TerrainRenderer(this);
    this.effects = new EffectsRenderer(this);
    this.buildings = new BuildingRenderer(this, (buildingId) => {
      this.selectedBuildingId = buildingId;
      this.buildings?.setSelectedBuilding(buildingId);
      const sprite = this.buildings?.getSprite(buildingId);
      if (sprite) {
        this.cameraController?.focusPoint(sprite.x, sprite.y);
      }
    });
    this.pathGraphics = this.add.graphics().setDepth(RENDER_CONFIG.depths.status - 1);
    this.cameraController = new CameraController(this);
    if (this.snapshot) {
      this.syncSnapshot();
    }
  }

  update(_time: number, delta: number): void {
    const zoom = this.cameras.main.zoom;
    this.terrain?.updateZoom(zoom);
    this.buildings?.setZoom(zoom);
    for (const sprite of this.citizenSprites.values()) {
      sprite.setZoom(zoom);
      sprite.updateInterpolation(delta);
    }
    for (const bubble of this.speechBubbles.values()) {
      bubble.update();
    }
  }

  setCitizenSelectionHandler(handler: (citizenId: string) => void): void {
    this.onCitizenSelect = handler;
  }

  setSelectedCitizen(citizenId?: string, focus = true): void {
    const changed = this.selectedCitizenId !== citizenId;
    this.selectedCitizenId = citizenId;
    this.selectedBuildingId = undefined;
    this.buildings?.setSelectedBuilding(undefined);
    this.updateSelection();
    if (focus && changed && citizenId) {
      const citizen = this.snapshot?.citizens.find((item) => item.id === citizenId);
      if (citizen) {
        this.cameraController?.focusPoint(citizen.position.x, citizen.position.y);
      }
    }
  }

  setSnapshot(snapshot: SimulationSnapshot): void {
    this.snapshot = snapshot;
    if (this.scene.isActive()) {
      this.syncSnapshot();
    }
  }

  focusVillage(): void {
    if (this.snapshot) {
      this.cameraController?.focusAll(this.snapshot);
    }
  }

  resize(width: number, height: number): void {
    this.scale.resize(width, height);
    if (this.snapshot) {
      this.cameraController?.resize(this.snapshot);
    }
  }

  private syncSnapshot(): void {
    const snapshot = this.snapshot;
    if (!snapshot || !this.terrain || !this.buildings || !this.effects || !this.cameraController) {
      return;
    }
    if (!this.cameraReady) {
      this.cameraController.initialize(snapshot, (zoom) => {
        this.terrain?.updateZoom(zoom);
        this.buildings?.setZoom(zoom);
        for (const sprite of this.citizenSprites.values()) {
          sprite.setZoom(zoom);
        }
      });
      this.cameraReady = true;
    }
    this.terrain.render(snapshot);
    this.buildings.render(snapshot);
    this.syncCitizens(snapshot);
    this.syncSpeechBubbles(snapshot);
    this.effects.play(snapshot.visualEvents);
    this.updateSelection();
  }

  private syncCitizens(snapshot: SimulationSnapshot): void {
    const activeIds = new Set(snapshot.citizens.map((citizen) => citizen.id));
    const interpolationDuration =
      snapshot.speed >= 20 ? 35 : Math.max(70, 125 / snapshot.speed);
    for (const citizen of snapshot.citizens) {
      let sprite = this.citizenSprites.get(citizen.id);
      if (!sprite) {
        sprite = new CitizenSprite(this, citizen, (citizenId) => {
          if (!this.cameraController?.wasDragging()) {
            this.onCitizenSelect?.(citizenId);
          }
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
  }

  private updateSelection(): void {
    for (const [id, sprite] of this.citizenSprites) {
      sprite.setSelected(id === this.selectedCitizenId);
    }
    this.drawSelectedPath();
  }

  private syncSpeechBubbles(snapshot: SimulationSnapshot): void {
    const urgent = snapshot.citizens
      .filter((citizen) => citizen.thought && citizen.thought.urgency >= 55)
      .sort((left, right) => (right.thought?.urgency ?? 0) - (left.thought?.urgency ?? 0))
      .slice(0, 5);
    const active = new Set(urgent.map((citizen) => citizen.id));
    urgent.forEach((citizen, index) => {
      let bubble = this.speechBubbles.get(citizen.id);
      if (!bubble) {
        bubble = new SpeechBubble(this);
        this.speechBubbles.set(citizen.id, bubble);
      }
      bubble.show(
        citizen.position.x + (index % 2 === 0 ? -10 : 10),
        citizen.position.y - 38 - index * 6,
        compactThought(citizen),
        1700 + index * 220,
      );
    });
    for (const [id, bubble] of this.speechBubbles) {
      if (!active.has(id)) {
        bubble.update();
      }
    }
  }

  private drawSelectedPath(): void {
    const graphics = this.pathGraphics;
    if (!graphics) return;
    graphics.clear();
    const citizen = this.snapshot?.citizens.find((item) => item.id === this.selectedCitizenId);
    if (!citizen) return;
    const points = [citizen.position, ...citizen.path.slice(citizen.pathIndex)];
    if (points.length > 1) {
      graphics.lineStyle(4, 0x111911, 0.36);
      drawPath(graphics, points);
      graphics.lineStyle(2, 0xf7e36d, 0.92);
      drawPath(graphics, points);
    }
    if (citizen.targetPosition) {
      graphics.lineStyle(3, 0xf7e36d, 1);
      graphics.strokeCircle(citizen.targetPosition.x, citizen.targetPosition.y, 10);
    }
  }
}

function compactThought(citizen: Citizen): string {
  const thought = citizen.thought;
  if (!thought) return "";
  const icon = {
    hunger: "🍞",
    cold: "❄",
    fatigue: "…",
    illness: "✚",
    low_health: "!",
    migration: "↗",
  }[thought.reason];
  return `${icon} ${thought.label.slice(0, 8)}`;
}

function drawPath(
  graphics: Phaser.GameObjects.Graphics,
  points: Array<Citizen["position"]>,
): void {
  graphics.beginPath();
  graphics.moveTo(points[0]!.x, points[0]!.y);
  for (const point of points.slice(1)) {
    graphics.lineTo(point.x, point.y);
  }
  graphics.strokePath();
}
