/**
 * PreloadScene — asset loading hook.
 *
 * Phase 1 has no binary assets (everything is generated procedurally in
 * BootScene), so this scene renders a branded loading bar and proceeds.
 *
 * TODO (asset integration):
 *   this.load.image('hub_bg', 'assets/hub/office.png');
 *   this.load.atlas('claw', 'assets/claw/claw.png', 'assets/claw/claw.json');
 *   this.load.audio('sfx_coin', 'audio/coin.mp3');
 *   this.load.audio('sfx_ambient_office', 'audio/office_ambient.mp3');
 *
 * Once assets are registered here, AudioManager / scenes key off the same ids
 * declared in AudioManager.SfxKeys and constants.TEXTURE_KEYS.
 */
import Phaser from 'phaser';
import { SCENE_KEYS, COLORS } from '../config/constants';
import { logger } from '../utils/logger';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super(SCENE_KEYS.Preload);
  }

  preload(): void {
    const { width, height } = this.scale;

    // Branded ai& loading text.
    this.add
      .text(width / 2, height / 2 - 40, 'ai&', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '64px',
        color: '#ffffff',
        fontStyle: '800',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 + 8, 'Office Arcade', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        color: '#9aa7b4',
      })
      .setOrigin(0.5);

    // Loading bar.
    const barW = 320;
    const barH = 10;
    const barX = width / 2 - barW / 2;
    const barY = height / 2 + 48;
    this.add.rectangle(width / 2, barY, barW + 6, barH + 6, 0x0a1a2a).setStrokeStyle(1, COLORS.grayDark);
    const bar = this.add.rectangle(barX, barY, 0, barH, COLORS.blue).setOrigin(0, 0.5);

    // Simulate load progress (no real assets yet). Replace with this.load events
    // (LOAD_PROGRESS) once binary assets are added.
    this.load.on(Phaser.Loader.Events.PROGRESS, (p: number) => {
      bar.width = barW * p;
    });
  }

  create(): void {
    logger.info('PreloadScene complete — entering hub.');
    this.scene.start(SCENE_KEYS.Hub);
  }
}
