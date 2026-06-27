import Phaser from "phaser";
import { RENDER_CONFIG } from "../rendering/RenderConfig";

export class SpeechBubble extends Phaser.GameObjects.Container {
  private readonly text: Phaser.GameObjects.Text;
  private hideAt = 0;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    const bg = scene.add.graphics();
    bg.fillStyle(0x142019, 0.88);
    bg.fillRoundedRect(-32, -24, 64, 24, 9);
    bg.fillTriangle(-6, 0, 6, 0, 0, 8);
    this.text = scene.add
      .text(0, -12, "", {
        fontFamily: RENDER_CONFIG.fontFamily,
        fontSize: "12px",
        fontStyle: "700",
        color: "#f8fff3",
        resolution: 2,
      })
      .setOrigin(0.5);
    this.add([bg, this.text]);
    this.setDepth(RENDER_CONFIG.depths.bubbles);
    this.setVisible(false);
    scene.add.existing(this);
  }

  show(x: number, y: number, message: string, durationMs: number): void {
    this.setPosition(x, y);
    this.text.setText(message);
    this.setVisible(true).setAlpha(1);
    this.hideAt = this.scene.time.now + durationMs;
  }

  update(): void {
    if (!this.visible || this.scene.time.now < this.hideAt) {
      return;
    }
    this.scene.tweens.add({
      targets: this,
      alpha: 0,
      duration: 220,
      onComplete: () => this.setVisible(false),
    });
    this.hideAt = Number.POSITIVE_INFINITY;
  }
}

