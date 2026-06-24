import Phaser from "phaser";
import type { Citizen } from "../../simulation";

const GOAL_ICONS: Record<Citizen["goal"], string> = {
  eat: "🍞",
  work_farm: "🌾",
  gather_wood: "🪓",
  gather_stone: "⛏️",
  carry_food: "📦",
  rest: "💤",
  return_home: "🏠",
  seek_work: "?",
  build: "🔨",
  wander: "…",
};

export class CitizenSprite extends Phaser.GameObjects.Container {
  readonly citizenId: string;
  private readonly bodyShape: Phaser.GameObjects.Arc;
  private readonly icon: Phaser.GameObjects.Text;
  private readonly selectionRing: Phaser.GameObjects.Arc;
  private readonly progress: Phaser.GameObjects.Graphics;
  private startX: number;
  private startY: number;
  private targetX: number;
  private targetY: number;
  private interpolationElapsed = 0;
  private interpolationDuration = 100;

  constructor(
    scene: Phaser.Scene,
    citizen: Citizen,
    onSelect: (citizenId: string) => void,
  ) {
    const offset = visualOffset(citizen.id);
    super(
      scene,
      citizen.position.x + offset.x,
      citizen.position.y + offset.y,
    );
    this.citizenId = citizen.id;
    this.startX = this.x;
    this.startY = this.y;
    this.targetX = this.x;
    this.targetY = this.y;

    this.selectionRing = scene.add
      .circle(0, 0, 8, 0xffffff, 0)
      .setStrokeStyle(2, 0xffffff, 0)
      .setVisible(false);
    this.bodyShape = scene.add.circle(
      0,
      0,
      5,
      citizen.job === "farmer" ? 0xf3c969 : 0x263642,
      1,
    );
    this.icon = scene.add
      .text(0, -17, GOAL_ICONS[citizen.goal], {
        fontFamily: "Segoe UI Emoji, sans-serif",
        fontSize: "11px",
        color: "#173124",
        backgroundColor: "rgba(255,255,255,0.72)",
        padding: { x: 2, y: 1 },
      })
      .setOrigin(0.5);
    this.progress = scene.add.graphics();
    this.add([this.selectionRing, this.bodyShape, this.icon, this.progress]);
    this.setSize(18, 18);
    this.setInteractive({ useHandCursor: true });
    this.on("pointerdown", () => onSelect(this.citizenId));
    scene.add.existing(this);
    this.applyCitizen(citizen, 0);
  }

  applyCitizen(citizen: Citizen, interpolationDuration: number): void {
    const offset = visualOffset(citizen.id);
    this.startX = this.x;
    this.startY = this.y;
    this.targetX = citizen.position.x + offset.x;
    this.targetY = citizen.position.y + offset.y;
    this.interpolationElapsed = 0;
    this.interpolationDuration = Math.max(1, interpolationDuration);
    this.bodyShape.setFillStyle(
      citizen.job === "farmer" ? 0xf3c969 : 0x263642,
      citizen.actionState === "failed" ? 0.5 : 1,
    );
    this.icon.setText(
      citizen.actionState === "deciding"
        ? "…"
        : GOAL_ICONS[citizen.goal],
    );
    this.progress.clear();
    if (citizen.actionState === "performing") {
      this.progress.fillStyle(0x173124, 0.25);
      this.progress.fillRoundedRect(-7, 8, 14, 2, 1);
      this.progress.fillStyle(0xffffff, 0.95);
      this.progress.fillRoundedRect(
        -7,
        8,
        14 * Math.min(1, citizen.actionProgress),
        2,
        1,
      );
    }
  }

  updateInterpolation(delta: number): void {
    this.interpolationElapsed = Math.min(
      this.interpolationDuration,
      this.interpolationElapsed + delta,
    );
    const ratio = Phaser.Math.Easing.Sine.Out(
      this.interpolationElapsed / this.interpolationDuration,
    );
    this.x = Phaser.Math.Linear(this.startX, this.targetX, ratio);
    this.y = Phaser.Math.Linear(this.startY, this.targetY, ratio);
  }

  setSelected(selected: boolean): void {
    this.selectionRing
      .setVisible(selected)
      .setStrokeStyle(2, 0xffffff, selected ? 1 : 0);
    this.setDepth(selected ? 20 : 10);
  }
}

function visualOffset(id: string): { x: number; y: number } {
  const numeric = Number(id.split("-").at(-1)) || 0;
  const angle = ((numeric % 8) / 8) * Math.PI * 2;
  const radius = (numeric % 3) * 1.8;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}
