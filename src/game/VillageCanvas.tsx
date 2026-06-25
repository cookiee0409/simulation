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
  const selectionHandlerRef = useRef(onCitizenSelect);
  selectionHandlerRef.current = onCitizenSelect;
  const snapshotRef = useRef(snapshot);
  snapshotRef.current = snapshot;

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: containerRef.current,
      width: snapshot.mapWidth,
      height: snapshot.mapHeight,
      transparent: true,
      scene: [VillageScene],
      render: { antialias: true, pixelArt: false },
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    });
    gameRef.current = game;
    game.events.once(Phaser.Core.Events.READY, () => {
      const scene = game.scene.getScene(VillageScene.KEY) as VillageScene;
      scene.setCitizenSelectionHandler((citizenId) =>
        selectionHandlerRef.current(citizenId),
      );
      scene.setSnapshot(snapshot);
      scene.setSelectedCitizen(selectedCitizenId);
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

  useEffect(() => {
    const scene = gameRef.current?.scene.getScene(
      VillageScene.KEY,
    ) as VillageScene | undefined;
    scene?.setSelectedCitizen(selectedCitizenId);
  }, [selectedCitizenId]);

  return (
    <div
      ref={containerRef}
      className="village-canvas"
      aria-label="마을 시뮬레이션 화면"
      onPointerDown={(event) => {
        const bounds = event.currentTarget.getBoundingClientRect();
        const x =
          ((event.clientX - bounds.left) / bounds.width) *
          snapshotRef.current.mapWidth;
        const y =
          ((event.clientY - bounds.top) / bounds.height) *
          snapshotRef.current.mapHeight;
        const nearest = snapshotRef.current.citizens
          .map((citizen) => ({
            id: citizen.id,
            distance: Math.hypot(
              citizen.position.x - x,
              citizen.position.y - y,
            ),
          }))
          .sort(
            (left, right) =>
              left.distance - right.distance || left.id.localeCompare(right.id),
          )[0];
        if (nearest && nearest.distance <= 18) {
          selectionHandlerRef.current(nearest.id);
        }
      }}
    />
  );
}
