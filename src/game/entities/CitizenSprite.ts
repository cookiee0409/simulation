import Phaser from "phaser";
import type { Citizen } from "../../simulation";
import { RENDER_CONFIG, stableHash, zoomLevel, type ZoomLevel } from "../rendering/RenderConfig";

const GOAL_LABELS: Record<Citizen["goal"], string> = {
  eat: "식사",
  forage: "채집",
  work_farm: "농사",
  gather_wood: "벌목",
  gather_stone: "채석",
  work_carpentry: "목공",
  work_blacksmith: "대장일",
  work_market: "거래",
  process_firewood: "장작",
  heat_home: "난방",
  repair_shelter: "수리",
  insulate_shelter: "단열",
  care_sick: "치료",
  migrate: "이주",
  forge_tools: "제련",
  trade_supplies: "교역",
  carry_food: "운반",
  rest: "휴식",
  return_home: "귀가",
  seek_work: "탐색",
  build: "건설",
  wander: "대기",
};

const JOB_LABELS: Record<Citizen["job"], string> = {
  settler: "정착민",
  farmer: "농부",
  lumberjack: "벌목공",
  miner: "채석공",
  carpenter: "목수",
  blacksmith: "대장장이",
  merchant: "상인",
  unemployed: "무직",
};

type Direction = "north" | "south" | "east" | "west";

export class CitizenSprite extends Phaser.GameObjects.Container {
  readonly citizenId: string;
  private readonly shadow: Phaser.GameObjects.Ellipse;
  private readonly selectionRing: Phaser.GameObjects.Ellipse;
  private readonly selectionBeam: Phaser.GameObjects.Rectangle;
  private readonly leftLeg: Phaser.GameObjects.Rectangle;
  private readonly rightLeg: Phaser.GameObjects.Rectangle;
  private readonly torso: Phaser.GameObjects.Ellipse;
  private readonly coatPanel: Phaser.GameObjects.Rectangle;
  private readonly head: Phaser.GameObjects.Arc;
  private readonly hair: Phaser.GameObjects.Ellipse;
  private readonly tool: Phaser.GameObjects.Graphics;
  private readonly statusIcon: Phaser.GameObjects.Text;
  private readonly tooltip: Phaser.GameObjects.Text;
  private readonly progress: Phaser.GameObjects.Graphics;
  private readonly style: CitizenVisualStyle;
  private selected = false;
  private hovered = false;
  private zoomLevel: ZoomLevel = "default";
  private direction: Direction = "south";
  private startX: number;
  private startY: number;
  private targetX: number;
  private targetY: number;
  private interpolationElapsed = 0;
  private interpolationDuration = 100;
  private latest?: Citizen;

  constructor(
    scene: Phaser.Scene,
    citizen: Citizen,
    onSelect: (citizenId: string) => void,
  ) {
    const offset = visualOffset(citizen.id);
    super(scene, citizen.position.x + offset.x, citizen.position.y + offset.y);
    this.citizenId = citizen.id;
    this.style = styleFor(citizen);
    this.startX = this.x;
    this.startY = this.y;
    this.targetX = this.x;
    this.targetY = this.y;

    this.selectionBeam = scene.add
      .rectangle(0, -20, 5, 42, RENDER_CONFIG.palette.selection, 0)
      .setOrigin(0.5, 1);
    this.selectionRing = scene.add
      .ellipse(0, 10, 30, 15, RENDER_CONFIG.palette.selection, 0)
      .setStrokeStyle(3, RENDER_CONFIG.palette.selection, 0)
      .setVisible(false);
    this.shadow = scene.add.ellipse(0, 13, 25, 10, 0x0d120c, RENDER_CONFIG.npc.shadowAlpha);
    this.leftLeg = scene.add.rectangle(-4, 9, 5, 12, this.style.pants, 1).setStrokeStyle(1, 0x1a160f, 0.8);
    this.rightLeg = scene.add.rectangle(4, 9, 5, 12, this.style.pants, 1).setStrokeStyle(1, 0x1a160f, 0.8);
    this.torso = scene.add.ellipse(0, -1, 20, 25, this.style.clothes, 1).setStrokeStyle(RENDER_CONFIG.npc.outline, 0x1f2118, 0.9);
    this.coatPanel = scene.add.rectangle(0, 0, 7, 22, this.style.accent, 0.75).setStrokeStyle(1, 0x1c1d16, 0.55);
    this.head = scene.add.circle(0, -18, 7, this.style.skin, 1).setStrokeStyle(RENDER_CONFIG.npc.outline, 0x5d3b29, 0.9);
    this.hair = scene.add.ellipse(0, -23, 15, 8, this.style.hair, 1).setStrokeStyle(1, 0x2c2019, 0.8);
    this.tool = scene.add.graphics();
    this.statusIcon = scene.add
      .text(11, -31, "", {
        fontFamily: "Segoe UI Emoji, system-ui, sans-serif",
        fontSize: "13px",
        backgroundColor: "rgba(18, 28, 21, 0.66)",
        padding: { x: 3, y: 1 },
        resolution: 2,
      })
      .setOrigin(0.5)
      .setVisible(false);
    this.tooltip = scene.add
      .text(0, -36, "", {
        fontFamily: RENDER_CONFIG.fontFamily,
        fontSize: "12px",
        fontStyle: "700",
        color: "#f8fff3",
        backgroundColor: "rgba(18, 28, 21, 0.78)",
        padding: { x: 7, y: 3 },
        resolution: 2,
      })
      .setOrigin(0.5, 1)
      .setShadow(0, 2, "#000000", 2, true, true)
      .setVisible(false);
    this.progress = scene.add.graphics();

    this.add([
      this.selectionBeam,
      this.selectionRing,
      this.shadow,
      this.leftLeg,
      this.rightLeg,
      this.torso,
      this.coatPanel,
      this.head,
      this.hair,
      this.tool,
      this.statusIcon,
      this.tooltip,
      this.progress,
    ]);
    this.setSize(RENDER_CONFIG.npc.width, RENDER_CONFIG.npc.height);
    this.setInteractive(
      new Phaser.Geom.Rectangle(-14, -32, 28, 48),
      Phaser.Geom.Rectangle.Contains,
    );
    this.input!.cursor = "pointer";
    this.on("pointerover", () => {
      this.hovered = true;
      this.updatePresentation();
    });
    this.on("pointerout", () => {
      this.hovered = false;
      this.updatePresentation();
    });
    this.on("pointerdown", () => onSelect(this.citizenId));
    scene.add.existing(this);
    this.applyCitizen(citizen, 0);
  }

  applyCitizen(citizen: Citizen, interpolationDuration: number): void {
    this.latest = citizen;
    const offset = visualOffset(citizen.id);
    this.startX = this.x;
    this.startY = this.y;
    this.targetX = citizen.position.x + offset.x;
    this.targetY = citizen.position.y + offset.y;
    const dx = this.targetX - this.startX;
    const dy = this.targetY - this.startY;
    if (Math.abs(dx) + Math.abs(dy) > 0.2) {
      this.direction = Math.abs(dx) > Math.abs(dy)
        ? dx >= 0 ? "east" : "west"
        : dy >= 0 ? "south" : "north";
    }
    this.interpolationElapsed = 0;
    this.interpolationDuration = Math.max(1, interpolationDuration);
    const alpha = citizen.actionState === "failed" ? 0.55 : 1;
    this.torso.setFillStyle(jobColor(citizen, this.style), alpha);
    this.coatPanel.setFillStyle(this.style.accent, alpha * 0.78);
    this.head.setFillStyle(this.style.skin, alpha);
    this.hair.setFillStyle(hairOrHatColor(citizen, this.style), alpha);
    this.statusIcon.setText(statusIcon(citizen));
    this.drawTool(citizen);
    this.updatePresentation();
  }

  updateInterpolation(delta: number): void {
    this.interpolationElapsed = Math.min(
      this.interpolationDuration,
      this.interpolationElapsed + delta,
    );
    const ratio = Phaser.Math.Easing.Sine.Out(this.interpolationElapsed / this.interpolationDuration);
    this.x = Phaser.Math.Linear(this.startX, this.targetX, ratio);
    this.y = Phaser.Math.Linear(this.startY, this.targetY, ratio);
    this.setDepth(RENDER_CONFIG.depths.npc + this.y);

    const moving = Math.hypot(this.targetX - this.startX, this.targetY - this.startY) > 0.3;
    const wave = Math.sin(this.scene.time.now / 95 + stableHash(this.citizenId) * 0.01);
    const step = moving ? wave * 2.2 : 0;
    this.leftLeg.y = 9 + step;
    this.rightLeg.y = 9 - step;
    this.torso.y = moving ? -1 + Math.abs(wave) * 0.8 : -1;
    this.head.y = moving ? -18 + Math.abs(wave) * 0.5 : -18;
    this.hair.y = this.head.y - 5;
    this.flipByDirection();
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.updatePresentation();
  }

  setZoom(zoom: number): void {
    this.zoomLevel = zoomLevel(zoom);
    this.updatePresentation();
  }

  private updatePresentation(): void {
    const citizen = this.latest;
    if (!citizen) return;
    const active = this.selected || this.hovered;
    const showStatus = active || (citizen.actionState === "performing" && this.zoomLevel !== "far");
    this.selectionRing
      .setVisible(this.selected)
      .setFillStyle(RENDER_CONFIG.palette.selection, this.selected ? 0.14 : 0)
      .setStrokeStyle(3, RENDER_CONFIG.palette.selection, this.selected ? 0.92 : 0);
    this.selectionBeam.setFillStyle(RENDER_CONFIG.palette.selection, this.selected ? 0.16 : 0);
    this.tooltip
      .setText(`${citizen.id} · ${JOB_LABELS[citizen.job]}\n${GOAL_LABELS[citizen.goal]}`)
      .setVisible(active && this.zoomLevel !== "far");
    this.statusIcon.setVisible(showStatus && !this.selected);
    this.drawProgress(citizen, active);
  }

  private drawProgress(citizen: Citizen, active: boolean): void {
    this.progress.clear();
    if (!active && citizen.actionState !== "performing") return;
    if (citizen.actionState !== "performing" || citizen.actionProgress <= 0.05) return;
    this.progress.fillStyle(0x101810, 0.72);
    this.progress.fillRoundedRect(-16, 16, 32, 6, 3);
    this.progress.fillStyle(0xdde977, 0.98);
    this.progress.fillRoundedRect(-15, 17, 30 * Math.min(1, citizen.actionProgress), 4, 2);
  }

  private drawTool(citizen: Citizen): void {
    this.tool.clear();
    this.tool.lineStyle(2, 0x2b2319, 0.95);
    this.tool.fillStyle(0xc2b18a, 0.95);
    if (citizen.job === "farmer" || citizen.goal === "work_farm") {
      this.tool.lineBetween(10, -6, 17, 9);
      this.tool.lineStyle(2, 0xd6c36f, 0.95);
      this.tool.lineBetween(8, -8, 14, -5);
    } else if (citizen.job === "lumberjack" || citizen.goal === "gather_wood") {
      this.tool.lineBetween(10, -8, 17, 8);
      this.tool.fillStyle(0xaeb7bc, 0.95);
      this.tool.fillTriangle(8, -10, 16, -8, 11, -3);
    } else if (citizen.job === "miner" || citizen.goal === "gather_stone") {
      this.tool.lineBetween(8, -6, 18, 6);
      this.tool.lineStyle(2, 0xb9c1c5, 0.95);
      this.tool.lineBetween(8, -8, 19, -2);
    } else if (citizen.job === "blacksmith" || citizen.goal === "forge_tools") {
      this.tool.lineBetween(10, -8, 16, 7);
      this.tool.fillStyle(0x4a4d52, 0.95);
      this.tool.fillRoundedRect(7, -11, 8, 5, 2);
    } else if (citizen.job === "merchant") {
      this.tool.fillStyle(0x9c6d3a, 0.95);
      this.tool.fillRoundedRect(9, -1, 8, 10, 2);
    }
  }

  private flipByDirection(): void {
    const side = this.direction === "west" ? -1 : 1;
    this.tool.setScale(side, 1);
    this.tool.x = this.direction === "west" ? -3 : 0;
    this.coatPanel.x = this.direction === "north" ? 0 : side * 2;
    this.hair.setScale(this.direction === "north" ? 1.05 : 1, 0.75);
  }
}

interface CitizenVisualStyle {
  skin: number;
  hair: number;
  clothes: number;
  accent: number;
  pants: number;
}

function styleFor(citizen: Citizen): CitizenVisualStyle {
  const hash = stableHash(citizen.id);
  const skins = [0xf1c29a, 0xd89f73, 0xb97955, 0xf3d2ae];
  const hairs = [0x2e2018, 0x6b4428, 0xd1a35d, 0x3b3630, 0x7c2f26];
  const clothes = [0x496b83, 0x755a40, 0x6f7f55, 0x7a5267, 0x405f52];
  const accents = [0xd9c077, 0xb85c4c, 0x8bb0c9, 0xa7bd73, 0xd39b54];
  return {
    skin: skins[hash % skins.length]!,
    hair: hairs[(hash >>> 3) % hairs.length]!,
    clothes: clothes[(hash >>> 6) % clothes.length]!,
    accent: accents[(hash >>> 9) % accents.length]!,
    pants: [0x2f3941, 0x42372c, 0x263a33][(hash >>> 12) % 3]!,
  };
}

function jobColor(citizen: Citizen, style: CitizenVisualStyle): number {
  if (citizen.age < 15) return 0x6e98ca;
  return {
    farmer: 0xd0b35b,
    lumberjack: 0x805632,
    miner: 0x6e747d,
    carpenter: 0xb1743f,
    blacksmith: 0x3f4650,
    merchant: 0xb78537,
    unemployed: 0x667078,
    settler: style.clothes,
  }[citizen.job];
}

function hairOrHatColor(citizen: Citizen, style: CitizenVisualStyle): number {
  if (citizen.job === "farmer") return 0xd9c47a;
  if (citizen.job === "miner") return 0xd4c553;
  if (citizen.winter.bodyTemperature < 35.6) return 0x5d83a5;
  return style.hair;
}

function statusIcon(citizen: Citizen): string {
  if (citizen.winter.bodyTemperature < 35.4) return "❄";
  if (citizen.hunger > 80) return "!";
  if (citizen.goal === "carry_food") return "📦";
  if (citizen.actionState === "performing") return "•";
  return "";
}

function visualOffset(id: string): { x: number; y: number } {
  const numeric = Number(id.split("-").at(-1)) || stableHash(id);
  const angle = ((numeric % 8) / 8) * Math.PI * 2;
  const radius = (numeric % 3) * 2.2;
  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
  };
}
