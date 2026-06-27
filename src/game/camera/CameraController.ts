import Phaser from "phaser";
import type { SimulationSnapshot } from "../../simulation";
import { RENDER_CONFIG } from "../rendering/RenderConfig";

export class CameraController {
  private dragging = false;
  private moved = false;
  private onZoomChanged?: (zoom: number) => void;

  constructor(private readonly scene: Phaser.Scene) {}

  initialize(snapshot: SimulationSnapshot, onZoomChanged: (zoom: number) => void): void {
    this.onZoomChanged = onZoomChanged;
    const camera = this.scene.cameras.main;
    camera.setBounds(0, 0, snapshot.mapWidth, snapshot.mapHeight);
    camera.roundPixels = true;
    this.focusAll(snapshot, false);

    this.scene.input.on("wheel", (_pointer: Phaser.Input.Pointer, _objects: unknown[], _dx: number, dy: number) => {
      const worldPoint = camera.getWorldPoint(this.scene.input.activePointer.x, this.scene.input.activePointer.y);
      const next = Phaser.Math.Clamp(
        camera.zoom * (dy > 0 ? 0.9 : 1.1),
        RENDER_CONFIG.zoom.min,
        RENDER_CONFIG.zoom.max,
      );
      camera.setZoom(next);
      camera.centerOn(worldPoint.x, worldPoint.y);
      this.constrain(snapshot);
      this.onZoomChanged?.(next);
    });

    this.scene.input.on("pointerdown", () => {
      this.dragging = true;
      this.moved = false;
    });
    this.scene.input.on("pointerup", () => {
      this.dragging = false;
    });
    this.scene.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      if (!this.dragging || !pointer.isDown) {
        return;
      }
      const dx = pointer.x - pointer.prevPosition.x;
      const dy = pointer.y - pointer.prevPosition.y;
      if (Math.abs(dx) + Math.abs(dy) < 1) {
        return;
      }
      this.moved = true;
      camera.scrollX -= dx / camera.zoom;
      camera.scrollY -= dy / camera.zoom;
      this.constrain(snapshot);
    });
  }

  focusPoint(x: number, y: number, animated = true): void {
    const camera = this.scene.cameras.main;
    if (animated) {
      camera.pan(x, y, 420, "Sine.easeInOut");
    } else {
      camera.centerOn(x, y);
    }
  }

  focusAll(snapshot: SimulationSnapshot, animated = true): void {
    const camera = this.scene.cameras.main;
    const viewportWidth = camera.width;
    const viewportHeight = camera.height;
    const zoom = Phaser.Math.Clamp(
      Math.min(viewportWidth / snapshot.mapWidth, viewportHeight / snapshot.mapHeight),
      RENDER_CONFIG.zoom.min,
      1.2,
    );
    camera.setZoom(zoom);
    this.onZoomChanged?.(zoom);
    this.focusPoint(snapshot.mapWidth / 2, snapshot.mapHeight / 2, animated);
  }

  resize(snapshot: SimulationSnapshot): void {
    this.scene.cameras.main.setBounds(0, 0, snapshot.mapWidth, snapshot.mapHeight);
    this.constrain(snapshot);
  }

  wasDragging(): boolean {
    return this.moved;
  }

  private constrain(snapshot: SimulationSnapshot): void {
    const camera = this.scene.cameras.main;
    const viewWidth = camera.width / camera.zoom;
    const viewHeight = camera.height / camera.zoom;
    camera.scrollX = Phaser.Math.Clamp(
      camera.scrollX,
      -Math.max(0, viewWidth - snapshot.mapWidth) / 2,
      Math.max(0, snapshot.mapWidth - viewWidth / 2),
    );
    camera.scrollY = Phaser.Math.Clamp(
      camera.scrollY,
      -Math.max(0, viewHeight - snapshot.mapHeight) / 2,
      Math.max(0, snapshot.mapHeight - viewHeight / 2),
    );
  }
}

