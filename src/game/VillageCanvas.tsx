import { useEffect, useRef } from "react";
import Phaser from "phaser";
import type { SimulationSnapshot } from "../simulation";
import { VillageScene } from "./scenes/VillageScene";

interface VillageCanvasProps {
  snapshot: SimulationSnapshot;
}

export function VillageCanvas({ snapshot }: VillageCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: 760,
      height: 520,
      transparent: true,
      scene: [VillageScene],
      render: {
        antialias: true,
        pixelArt: false,
      },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });
    gameRef.current = game;

    game.events.once(Phaser.Core.Events.READY, () => {
      const scene = game.scene.getScene(VillageScene.KEY) as VillageScene;
      scene.setSnapshot(snapshot);
    });

    return () => {
      game.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = gameRef.current?.scene.getScene(
      VillageScene.KEY,
    ) as VillageScene | undefined;
    scene?.setSnapshot(snapshot);
  }, [snapshot]);

  return (
    <div
      ref={containerRef}
      className="village-canvas"
      aria-label="마을 시뮬레이션 화면"
    />
  );
}
