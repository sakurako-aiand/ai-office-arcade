/**
 * BootScene — first scene to run.
 *
 * Responsibilities:
 *   - generate every placeholder texture (so no scene waits on art),
 *   - attach the AudioManager to a scene,
 *   - hand off to PreloadScene.
 *
 * Keep this scene tiny and synchronous; it should never block on network.
 */
import Phaser from 'phaser';
import { SCENE_KEYS } from '../config/constants';
import { makeAllPlaceholderTextures } from '../utils/shapes';
import { audioManager } from '../systems/AudioManager';
import { logger } from '../utils/logger';

export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Boot);
  }

  create(): void {
    logger.info('BootScene: generating placeholder textures.');
    makeAllPlaceholderTextures(this);
    audioManager.attach(this);

    this.scene.start(SCENE_KEYS.Preload);
  }
}
