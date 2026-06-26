import Phaser from "phaser";
import type { Citizen } from "../../simulation";

const GOAL_ICONS: Record<Citizen["goal"], string> = {
  eat: "🍞",
  forage: "🧺",
  work_farm: "🌾",
  gather_wood: "🪓",
  gather_stone: "⛏️",
  work_carpentry: "🪚",
  work_blacksmith: "🔨",
  work_market: "🪙",
  process_firewood: "🪵",
  heat_home: "🔥",
  repair_shelter: "🔨",
  insulate_shelter: "🧱",
  care_sick: "🩺",
  migrate: "🚶",
  carry_food: "📦",
  rest: "💤",
  return_home: "🏠",
  seek_work: "?",
  build: "🔨",
  wander: "…",
};

export class CitizenSprite extends Phaser.GameObjects.Container {
  readonly citizenId: string;
  private readonly shadow: Phaser.GameObjects.Arc;
  private readonly bodyShape: Phaser.GameObjects.Arc;
  private readonly coatShape: Phaser.GameObjects.Arc;
  private readonly icon: Phaser.GameObjects.Text;
  private readonly specialtyBadge: Phaser.GameObjects.Text;
  private readonly thoughtBubble: Phaser.GameObjects.Text;
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
      .circle(0, 0, 9, 0xffffff, 0)
      .setStrokeStyle(2, 0xffffff, 0)
      .setVisible(false);
    this.shadow = scene.add.circle(1, 3, 6, 0x102017, 0.18);
    this.bodyShape = scene.add.circle(
      0,
      0,
      citizen.age < 15 ? 4 : 5,
      jobColor(citizen),
      1,
    );
    this.coatShape = scene.add
      .circle(0, 2, citizen.age < 15 ? 3 : 4, coatColor(citizen), 0.95)
      .setScale(1.15, 0.8);
    this.specialtyBadge = scene.add
      .text(6, 4, specialtyIcon(citizen.specialty), {
        fontFamily: "Segoe UI Emoji, sans-serif",
        fontSize: "10px",
        color: "#173124",
        backgroundColor: "rgba(255,255,255,0.9)",
        padding: { x: 2, y: 1 },
        resolution: 2,
      })
      .setOrigin(0.5)
      .setShadow(0, 1, "#ffffff", 2, true, true);
    this.icon = scene.add
      .text(0, -17, GOAL_ICONS[citizen.goal], {
        fontFamily: "Segoe UI Emoji, sans-serif",
        fontSize: "14px",
        color: "#173124",
        backgroundColor: "rgba(255,255,255,0.9)",
        padding: { x: 3, y: 2 },
        resolution: 2,
      })
      .setOrigin(0.5)
      .setShadow(0, 1, "#ffffff", 2, true, true);
    this.thoughtBubble = scene.add
      .text(0, -32, "", {
        fontFamily: "Malgun Gothic, system-ui, sans-serif",
        fontSize: "12px",
        fontStyle: "bold",
        color: "#213329",
        backgroundColor: "rgba(255,255,255,0.96)",
        padding: { x: 7, y: 3 },
        resolution: 2,
      })
      .setOrigin(0.5, 1)
      .setShadow(0, 1, "#ffffff", 2, true, true)
      .setVisible(false);
    this.progress = scene.add.graphics();
    this.add([
      this.selectionRing,
      this.shadow,
      this.bodyShape,
      this.coatShape,
      this.specialtyBadge,
      this.icon,
      this.thoughtBubble,
      this.progress,
    ]);
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
      jobColor(citizen),
      citizen.actionState === "failed" ? 0.5 : 1,
    );
    this.bodyShape.setRadius(citizen.age < 15 ? 4 : 5);
    this.coatShape
      .setFillStyle(coatColor(citizen), citizen.actionState === "failed" ? 0.5 : 0.95)
      .setRadius(citizen.age < 15 ? 3 : 4);
    this.specialtyBadge.setText(specialtyIcon(citizen.specialty));
    this.icon.setText(
      citizen.actionState === "deciding"
        ? "…"
        : GOAL_ICONS[citizen.goal],
    );
    if (citizen.thought) {
      this.thoughtBubble
        .setText(citizen.thought.label)
        .setVisible(true)
        .setAlpha(Phaser.Math.Clamp(citizen.thought.urgency / 100, 0.72, 1));
    } else {
      this.thoughtBubble.setVisible(false);
    }
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

function jobColor(citizen: Citizen): number {
  if (citizen.age < 15) return 0x7aa4d6;
  switch (citizen.job) {
    case "farmer":
      return 0xf3c969;
    case "lumberjack":
      return 0x8b5e34;
    case "miner":
      return 0x727983;
    case "carpenter":
      return 0xc98942;
    case "blacksmith":
      return 0x3e4652;
    case "merchant":
      return 0xd9a441;
    case "unemployed":
      return 0x6f7780;
    default:
      return 0x263642;
  }
}

function coatColor(citizen: Citizen): number {
  if (citizen.winter.bodyTemperature < 35.5) return 0x7fa9c8;
  if (citizen.winter.illness >= 35) return 0xa76b7a;
  return 0xefe6cf;
}

function specialtyIcon(specialty: Citizen["specialty"]): string {
  return (
    {
      farming: "🌱",
      logging: "🪓",
      construction: "🧱",
      hunting: "🏹",
      medicine: "✚",
      cooking: "🍲",
      scouting: "👁",
      negotiation: "💬",
      leadership: "★",
    } satisfies Record<Citizen["specialty"], string>
  )[specialty];
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
