import Phaser from "phaser";
import type { SimulationSnapshot } from "../../simulation";
import { RENDER_CONFIG } from "./RenderConfig";

export class EffectsRenderer {
  private readonly seen = new Set<string>();

  constructor(private readonly scene: Phaser.Scene) {}

  play(events: SimulationSnapshot["visualEvents"]): void {
    for (const event of events) {
      if (this.seen.has(event.id)) continue;
      this.seen.add(event.id);
      this.spawnPopup(event);
    }
    while (this.seen.size > 180) {
      const oldest = this.seen.values().next().value as string | undefined;
      if (!oldest) break;
      this.seen.delete(oldest);
    }
  }

  private spawnPopup(event: SimulationSnapshot["visualEvents"][number]): void {
    const container = this.scene.add
      .container(event.position.x, event.position.y - 46)
      .setDepth(RENDER_CONFIG.depths.effects)
      .setAlpha(0)
      .setScale(0.86);
    const text = this.scene.add
      .text(0, 0, `${event.icon} ${event.label}`, {
        fontFamily: RENDER_CONFIG.fontFamily,
        fontSize: "16px",
        fontStyle: "700",
        color: "#f9fff3",
        backgroundColor: "rgba(18, 28, 21, 0.82)",
        padding: { x: 8, y: 4 },
        resolution: 2,
      })
      .setOrigin(0.5)
      .setShadow(0, 2, "#000000", 3, true, true);
    container.add(text);
    for (let index = 0; index < 4; index += 1) {
      const spark = this.scene.add.circle(
        Phaser.Math.Between(-20, 20),
        Phaser.Math.Between(-10, 10),
        2,
        event.resource === "food" ? 0xcfe879 : 0xffd37d,
        0.95,
      );
      container.add(spark);
      this.scene.tweens.add({
        targets: spark,
        x: spark.x + Phaser.Math.Between(-18, 18),
        y: spark.y - Phaser.Math.Between(14, 30),
        alpha: 0,
        duration: 600,
        ease: "Sine.easeOut",
      });
    }
    this.scene.tweens.add({
      targets: container,
      y: container.y - 42,
      alpha: { from: 0, to: 1 },
      scale: { from: 0.86, to: 1 },
      duration: 160,
      ease: "Back.easeOut",
      onComplete: () => {
        this.scene.tweens.add({
          targets: container,
          y: container.y - 20,
          alpha: 0,
          delay: 260,
          duration: 720,
          ease: "Sine.easeIn",
          onComplete: () => container.destroy(true),
        });
      },
    });
  }
}

