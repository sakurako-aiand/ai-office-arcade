import Phaser from 'phaser';
import { GAME_WIDTH, GAME_HEIGHT, COLORS } from './constants';
import { BootScene } from '../scenes/BootScene';
import { PreloadScene } from '../scenes/PreloadScene';
import { HubScene } from '../scenes/HubScene';
import { ShopOverlay } from '../scenes/ShopOverlay';
import { EasyGameScene } from '../scenes/EasyGameScene';
import { MediumGameScene } from '../scenes/MediumGameScene';
import { HardGameScene } from '../scenes/HardGameScene';

/**
 * Phaser game configuration.
 *
 * - Auto renderer (WebGL w/ Canvas fallback) for broad compatibility.
 * - FIT scaling keeps the 1280x720 logical resolution letterboxed on any screen.
 * - Scenes are registered in boot order; routing is handled by SceneManager.
 */
export const gameConfig: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game',
  backgroundColor: COLORS.navy.toString(),
  width: GAME_WIDTH,
  height: GAME_HEIGHT,
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: GAME_WIDTH,
    height: GAME_HEIGHT,
  },
  render: {
    antialias: true,
    roundPixels: false,
    powerPreference: 'high-performance',
  },
  // Target 60 FPS; Phaser timestep smoothing keeps motion stable.
  fps: {
    target: 60,
    forceSetTimeOut: false,
  },
  // DOM UI is intentionally avoided (everything is canvas-native), but kept on
  // so future overlays can opt in.
  dom: {
    createContainer: false,
  },
  input: {
    activePointers: 3, // mouse + touch + a spare
  },
  scene: [
    BootScene,
    PreloadScene,
    HubScene,
    ShopOverlay,
    EasyGameScene,
    MediumGameScene,
    HardGameScene,
  ],
};
