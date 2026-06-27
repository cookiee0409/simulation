import Phaser from "phaser";
import { ASSET_MANIFEST, buildingAssetKey } from "../assets/AssetManifest";
import { RENDER_CONFIG } from "./RenderConfig";

export function preloadVisualAssets(scene: Phaser.Scene): void {
  for (const [type, path] of Object.entries(ASSET_MANIFEST.buildings)) {
    scene.load.svg(buildingAssetKey(type as keyof typeof ASSET_MANIFEST.buildings), path, {
      width: RENDER_CONFIG.building.sizes[type as keyof typeof ASSET_MANIFEST.buildings].width,
      height: RENDER_CONFIG.building.sizes[type as keyof typeof ASSET_MANIFEST.buildings].height,
    });
  }
}

