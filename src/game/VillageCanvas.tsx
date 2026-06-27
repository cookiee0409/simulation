import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { SimulationSnapshot } from "../simulation";
import { VillageScene } from "./scenes/VillageScene";

interface VillageCanvasProps {
  snapshot: SimulationSnapshot;
  selectedCitizenId?: string;
  onCitizenSelect: (citizenId: string) => void;
}

export function VillageCanvas({
  snapshot,
  selectedCitizenId,
  onCitizenSelect,
}: VillageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<VillageScene | null>(null);
  const selectionHandlerRef = useRef(onCitizenSelect);
  selectionHandlerRef.current = onCitizenSelect;

  useEffect(() => {
    if (!containerRef.current) return;
    const bounds = containerRef.current.getBoundingClientRect();
    const resolution = Math.min(window.devicePixelRatio || 1, 2);
    const config: Phaser.Types.Core.GameConfig & { resolution: number } = {
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: Math.max(640, Math.floor(bounds.width || snapshot.mapWidth)),
      height: Math.max(420, Math.floor(bounds.height || snapshot.mapHeight)),
      resolution,
      transparent: true,
      scene: [VillageScene],
      render: {
        antialias: true,
        pixelArt: false,
        roundPixels: true,
        powerPreference: "high-performance",
      },
      scale: {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };
    const game = new Phaser.Game(config);
    gameRef.current = game;
    game.events.once(Phaser.Core.Events.READY, () => {
      const scene = game.scene.getScene(VillageScene.KEY) as VillageScene;
      sceneRef.current = scene;
      scene.setCitizenSelectionHandler((citizenId) =>
        selectionHandlerRef.current(citizenId),
      );
      scene.setSnapshot(snapshot);
      scene.setSelectedCitizen(selectedCitizenId, false);
    });

    const resizeObserver = new ResizeObserver(([entry]) => {
      const scene = sceneRef.current;
      if (!entry || !scene) return;
      scene.resize(
        Math.max(640, Math.floor(entry.contentRect.width)),
        Math.max(420, Math.floor(entry.contentRect.height)),
      );
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      game.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = gameRef.current?.scene.getScene(
      VillageScene.KEY,
    ) as VillageScene | undefined;
    scene?.setSnapshot(snapshot);
  }, [snapshot]);

  useEffect(() => {
    const scene = gameRef.current?.scene.getScene(
      VillageScene.KEY,
    ) as VillageScene | undefined;
    scene?.setSelectedCitizen(selectedCitizenId);
  }, [selectedCitizenId]);

  return (
    <div className="village-canvas-shell">
      <div
        ref={containerRef}
        className="village-canvas"
        aria-label="마을 시뮬레이션 화면"
      />
      <div className="camera-toolbar">
        <button type="button" onClick={() => sceneRef.current?.focusVillage()}>
          마을 전체 보기
        </button>
        <span>휠 확대 · 드래그 이동 · NPC 클릭 선택</span>
      </div>
    </div>
  );
}
