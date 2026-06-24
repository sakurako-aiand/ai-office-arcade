/**
 * HubScene — the ai& office hub.
 *
 * Layout:
 *   - office background (floor, back wall, windows, desks) drawn from shapes,
 *   - the ai& logo prominently mounted on the back wall,
 *   - a central spawn point + player avatar,
 *   - three difficulty platforms (Easy / Medium / Hard),
 *   - a SHOP button opening the claw-machine overlay,
 *   - a persistent coin counter (top-right),
 *   - a welcome-back banner when returning from a mini-game.
 *
 * Input: pointer (mouse + touch) selects platforms / buttons; Esc opens shop.
 * Navigation is delegated to SceneManager so transitions stay consistent.
 */
import Phaser from 'phaser';
import { SCENE_KEYS, COLORS, REWARDS, TEXTURE_KEYS } from '../config/constants';
import { sceneManager, type LeaveReason } from '../systems/SceneManager';
import { transitionManager } from '../systems/TransitionManager';
import { InputHandler } from '../systems/InputHandler';
import { audioManager, SfxKeys } from '../systems/AudioManager';
import { Platform } from '../objects/Platform';
import { Player } from '../objects/Player';
import { CoinCounter } from '../ui/CoinCounter';
import { logger } from '../utils/logger';

interface HubLaunchData {
  reason?: LeaveReason;
  difficulty?: string | null;
}

export class HubScene extends Phaser.Scene {
  private player!: Player;
  private platforms: Platform[] = [];
  private spawn = { x: 0, y: 0 };

  constructor() {
    super(SCENE_KEYS.Hub);
  }

  create(data: HubLaunchData = {}): void {
    const { width, height } = this.scale;
    this.spawn = { x: width / 2, y: height / 2 + 120 };

    this.drawOffice(width, height);
    this.drawLogo(width, height);
    this.buildPlatforms(width, height);
    this.buildShopButton();
    this.buildHud(width, height);

    // Spawn the avatar on the central spawn point.
    this.player = new Player(this, this.spawn.x, this.spawn.y);
    if (data.reason) this.showWelcomeBack(data.reason, data.difficulty ?? null);

    // Ambient + interaction SFX (placeholders, missing-safe).
    audioManager.playAmbient();

    // Unified input: Esc opens the shop as a "back/cancel" intent here.
    new InputHandler(this, {
      onCancel: () => sceneManager.openShop(this),
    }).bind();

    transitionManager.fadeIn(this);
    logger.info('HubScene ready.');
  }

  /** Office-themed background built entirely from primitives. */
  private drawOffice(w: number, h: number): void {
    // Back wall + floor.
    this.add.rectangle(0, 0, w, h, COLORS.deepBlue).setOrigin(0, 0);
    const floorTop = h * 0.62;
    this.add.rectangle(0, floorTop, w, h - floorTop, 0x0a1622).setOrigin(0, 0);

    // Floor grid (retro accent).
    const grid = this.add.graphics();
    grid.lineStyle(1, 0x1b3a55, 0.5);
    for (let x = 0; x <= w; x += 64) grid.lineBetween(x, floorTop, x, h);
    for (let y = floorTop; y <= h; y += 32) grid.lineBetween(0, y, w, y);

    // Windows on the back wall.
    const winY = h * 0.12;
    [w * 0.12, w * 0.5, w * 0.88].forEach((cx) => {
      const win = this.add.rectangle(cx, winY + 50, 150, 110, 0x2a4a66, 0.8).setStrokeStyle(4, 0x0a1a2a);
      // sky glow
      this.add.rectangle(cx, winY + 30, 130, 60, 0x3b82f6, 0.25);
      // mullions
      this.add.rectangle(cx, winY + 50, 2, 110, 0x0a1a2a);
      this.add.rectangle(cx, winY + 50, 150, 2, 0x0a1a2a);
    });

    // Desks along the back (atmosphere).
    this.add.rectangle(w * 0.2, floorTop - 24, 180, 26, 0x22384a).setStrokeStyle(2, 0x314b63);
    this.add.rectangle(w * 0.8, floorTop - 24, 180, 26, 0x22384a).setStrokeStyle(2, 0x314b63);

    // Spawn marker (glowing ring on the floor).
    const ring = this.add.image(this.spawn.x, this.spawn.y + 24, TEXTURE_KEYS.pixel)
      .setDisplaySize(120, 30).setTint(COLORS.blue).setAlpha(0.25).setBlendMode(Phaser.BlendModes.ADD);
    this.tweens.add({ targets: ring, alpha: 0.5, duration: 900, yoyo: true, repeat: -1 });
  }

  /** The ai& wordmark, mounted on the back wall and softly glowing. */
  private drawLogo(w: number, h: number): void {
    const logo = this.add.image(w / 2, h * 0.18, TEXTURE_KEYS.logo);
    this.add
      .text(w / 2, h * 0.18 - 4, 'ai&', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '52px',
        color: '#ffffff',
        fontStyle: '800',
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, h * 0.18 + 30, 'OFFICE ARCADE', {
        fontFamily: 'Press Start 2P, monospace',
        fontSize: '11px',
        color: '#9aa7b4',
      })
      .setOrigin(0.5);
    this.tweens.add({ targets: logo, alpha: { from: 0.6, to: 1 }, duration: 1400, yoyo: true, repeat: -1 });
  }

  /** Three difficulty platforms in an arc below the spawn. */
  private buildPlatforms(w: number, h: number): void {
    const y = h - 150;
    const layout: Array<{ d: 'easy' | 'medium' | 'hard'; x: number }> = [
      { d: 'easy', x: w * 0.22 },
      { d: 'medium', x: w * 0.5 },
      { d: 'hard', x: w * 0.78 },
    ];

    layout.forEach(({ d, x }) => {
      const platform = new Platform(this, x, y, d, REWARDS[d], (difficulty) =>
        this.selectPlatform(difficulty)
      );
      this.platforms.push(platform);
    });
  }

  /** A platform was chosen — disable inputs and enter the matching mini-game. */
  private selectPlatform(difficulty: 'easy' | 'medium' | 'hard'): void {
    audioManager.play(SfxKeys.click);
    this.platforms.forEach((p) => p.setEnabled(false));
    sceneManager.enterMiniGame(this, difficulty);
  }

  /** SHOP button (top-left). */
  private buildShopButton(): void {
    const btn = this.add.container(96, 56).setDepth(50);
    const bg = this.add.rectangle(0, 0, 150, 48, COLORS.blue, 1).setStrokeStyle(2, 0xffffff, 0.6);
    bg.setInteractive({ useHandCursor: true });
    const label = this.add
      .text(0, 0, '🛒  SHOP', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: '#ffffff',
        fontStyle: '800',
      })
      .setOrigin(0.5);
    btn.add([bg, label]);

    bg.on(Phaser.Input.Events.POINTER_UP, () => {
      audioManager.play(SfxKeys.click);
      sceneManager.openShop(this);
    });
    bg.on(Phaser.Input.Events.POINTER_OVER, () =>
      this.tweens.add({ targets: btn, scale: 1.05, duration: 100 })
    );
    bg.on(Phaser.Input.Events.POINTER_OUT, () =>
      this.tweens.add({ targets: btn, scale: 1, duration: 100 })
    );
  }

  /** Coin counter (top-right) + a small settings hint. */
  private buildHud(w: number, _h: number): void {
    new CoinCounter(this, w - 96, 56);
    this.add
      .text(w / 2, this.scale.height - 28, 'Step on a platform to play • Esc opens shop', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: '#7b8794',
      })
      .setOrigin(0.5);
  }

  /** Welcome-back banner when launched from a mini-game exit. */
  private showWelcomeBack(reason: LeaveReason, difficulty: string | null): void {
    const reward =
      reason === 'win' && difficulty ? REWARDS[difficulty as 'easy' | 'medium' | 'hard'] : 0;
    const msg =
      reason === 'win'
        ? `YOU WIN!  +${reward} coins`
        : reason === 'timeout'
        ? "TIME'S UP!"
        : 'YOU LOSE';
    const color =
      reason === 'win' ? '#22c55e' : reason === 'timeout' ? '#f59e0b' : '#ef4444';

    if (reason === 'win') audioManager.play(SfxKeys.win);
    else if (reason === 'timeout') audioManager.play(SfxKeys.timeout);
    else audioManager.play(SfxKeys.lose);

    const banner = this.add.container(this.scale.width / 2, 120).setDepth(80);
    const bg = this.add.rectangle(0, 0, 420, 70, 0x0a1a2a, 0.92).setStrokeStyle(2, COLORS.blue);
    const text = this.add
      .text(0, 0, msg, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '26px',
        color,
        fontStyle: '800',
      })
      .setOrigin(0.5);
    banner.add([bg, text]);
    banner.setScale(0.6).setAlpha(0);
    this.tweens.add({
      targets: banner,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: banner,
          alpha: 0,
          delay: 1600,
          duration: 500,
          onComplete: () => banner.destroy(),
        });
      },
    });

    // Re-center the avatar on spawn.
    this.player.respawn(this.spawn.x, this.spawn.y);
  }

  shutdown(): void {
    // Phaser tears down display lists + input automatically; this hook documents
    // that the hub is intentionally stateless between launches (no timers here).
    this.platforms = [];
    logger.debug('HubScene shutdown.');
  }
}
