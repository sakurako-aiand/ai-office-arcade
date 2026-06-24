/**
 * ShopOverlay — claw-machine shop scene.
 *
 * Launched on top of the hub (see SceneManager.openShop). Renders:
 *   - a dim full-screen backdrop,
 *   - the ai& brand + title,
 *   - the ClawMachine cabinet,
 *   - five colored ball slots with live collected counts,
 *   - an INSERT COIN button that consumes CLAW_COST coins, runs the claw
 *     animation, rolls the drop table, awards the ball to the inventory, and
 *     refreshes the slots (all persisted via GameState -> SaveManager),
 *   - a CLOSE button (and Esc) returning to the hub.
 *
 * The overlay is its own scene so it can be stopped cleanly (no leaks) and so
 * the hub's input is naturally blocked while it's active.
 */
import Phaser from 'phaser';
import {
  SCENE_KEYS,
  COLORS,
  CLAW_COST,
  BALL_DROP_TABLE,
  TEXTURE_KEYS,
} from '../config/constants';
import { sceneManager } from '../systems/SceneManager';
import { audioManager, SfxKeys } from '../systems/AudioManager';
import { gameState, GameStateEvents } from '../state/GameState';
import { ClawMachine } from '../objects/ClawMachine';
import { CoinCounter } from '../ui/CoinCounter';
import { logger } from '../utils/logger';

export class ShopOverlay extends Phaser.Scene {
  private cabinet!: ClawMachine;
  private insertBtn!: Phaser.GameObjects.Container;
  private insertLabel!: Phaser.GameObjects.Text;
  private statusText!: Phaser.GameObjects.Text;
  private slotLabels: Phaser.GameObjects.Text[] = [];
  private onInventoryChanged!: (inv: ReturnType<typeof gameState.getInventory>) => void;

  constructor() {
    super(SCENE_KEYS.Shop);
  }

  create(): void {
    const { width, height } = this.scale;

    // Dim backdrop (clicking it closes the shop).
    const backdrop = this.add
      .rectangle(0, 0, width, height, 0x061018, 0.82)
      .setOrigin(0, 0)
      .setInteractive();
    backdrop.on('pointerup', () => this.close());

    // Brand + title.
    this.add
      .text(width / 2, 56, 'ai&', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '34px',
        color: '#ffffff',
        fontStyle: '800',
      })
      .setOrigin(0.5);
    this.add
      .text(width / 2, 90, 'CLAW MACHINE SHOP', {
        fontFamily: 'Press Start 2P, monospace',
        fontSize: '14px',
        color: '#c7d2dc',
      })
      .setOrigin(0.5);

    // Claw cabinet (center-left).
    this.cabinet = new ClawMachine(this, width / 2 - 130, height / 2 - 10);

    // Ball slots (right side).
    this.buildSlots(width / 2 + 160, height / 2 - 120);

    // INSERT COIN button.
    this.buildInsertButton(width / 2 - 130, height / 2 + 150);

    // Status line (e.g. "Not enough coins").
    this.statusText = this.add
      .text(width / 2, height / 2 + 210, '', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '15px',
        color: '#fca5a5',
      })
      .setOrigin(0.5);

    // Close button (top-right, below the coin counter).
    this.buildCloseButton(width - 60, 56);

    // Live coin counter (top-right).
    new CoinCounter(this, width - 180, 56);

    // Keep slots in sync with inventory mutations.
    this.onInventoryChanged = () => this.refreshSlots();
    gameState.on(GameStateEvents.InventoryChanged, this.onInventoryChanged);
    this.refreshSlots();

    // Esc closes (handled here directly since this scene owns its input).
    this.input.keyboard?.on('keydown-ESC', () => this.close());

    audioManager.play(SfxKeys.click, 0.4);
    logger.info('ShopOverlay opened.');
  }

  /** Five colored slots showing rarity + collected count. */
  private buildSlots(x: number, y: number): void {
    this.add
      .text(x + 90, y - 30, 'COLLECTION', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        color: '#9aa7b4',
        fontStyle: '800',
      })
      .setOrigin(0.5);

    BALL_DROP_TABLE.forEach((ball, i) => {
      const row = Math.floor(i / 2);
      const col = i % 2;
      const cx = x + col * 110;
      const cy = y + row * 80;

      const slot = this.add.rectangle(cx, cy, 92, 64, 0x0a1a2a, 0.8).setStrokeStyle(2, ball.color, 0.6);
      void slot;
      this.add.image(cx - 24, cy, TEXTURE_KEYS.ball).setTint(ball.color).setScale(0.7);

      this.add
        .text(cx + 8, cy - 8, ball.label, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '10px',
          color: '#c7d2dc',
        })
        .setOrigin(0, 0.5);

      const count = this.add
        .text(cx + 8, cy + 12, 'x0', {
          fontFamily: 'Inter, sans-serif',
          fontSize: '15px',
          color: '#ffffff',
          fontStyle: '800',
        })
        .setOrigin(0, 0.5);
      this.slotLabels[i] = count;
    });
  }

  private buildInsertButton(x: number, y: number): void {
    this.insertBtn = this.add.container(x, y).setDepth(10);
    const bg = this.add
      .rectangle(0, 0, 230, 56, COLORS.coin, 1)
      .setStrokeStyle(2, 0xffffff, 0.6);
    bg.setInteractive({ useHandCursor: true });
    this.insertLabel = this.add
      .text(0, 0, `INSERT COIN  (${CLAW_COST})`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '17px',
        color: '#3b2606',
        fontStyle: '800',
      })
      .setOrigin(0.5);
    this.insertBtn.add([bg, this.insertLabel]);

    bg.on('pointerup', () => this.insertCoin());
    bg.on('pointerover', () =>
      this.tweens.add({ targets: this.insertBtn, scale: 1.05, duration: 100 })
    );
    bg.on('pointerout', () =>
      this.tweens.add({ targets: this.insertBtn, scale: 1, duration: 100 })
    );
  }

  private buildCloseButton(x: number, y: number): void {
    const btn = this.add.container(x, y);
    const bg = this.add.rectangle(0, 0, 80, 40, COLORS.danger, 0.9).setStrokeStyle(2, 0xffffff, 0.5);
    bg.setInteractive({ useHandCursor: true });
    const label = this.add
      .text(0, 0, 'CLOSE', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        fontStyle: '800',
      })
      .setOrigin(0.5);
    btn.add([bg, label]);
    bg.on('pointerup', () => this.close());
  }

  /** Spend a coin, run the claw, award the resulting ball. */
  private async insertCoin(): Promise<void> {
    if (this.cabinet.isBusy()) return;
    if (!gameState.spendCoins(CLAW_COST)) {
      this.flashStatus('Not enough coins!');
      audioManager.play(SfxKeys.lose, 0.4);
      return;
    }
    audioManager.play(SfxKeys.claw, 0.6);
    this.setInsertEnabled(false);
    this.flashStatus('');

    const drop = await this.cabinet.play();
    if (drop) {
      gameState.collectBall(drop.id);
      this.flashStatus(`Got: ${drop.label}!`, drop.rarity === 'legendary' ? '#facc15' : '#22c55e');
      audioManager.play(SfxKeys.drop, 0.6);
    }
    this.setInsertEnabled(true);
  }

  private setInsertEnabled(enabled: boolean): void {
    this.insertBtn.setAlpha(enabled ? 1 : 0.6);
    const bg = this.insertBtn.getAt(0) as Phaser.GameObjects.Rectangle;
    bg.input!.enabled = enabled;
  }

  private flashStatus(msg: string, color = '#fca5a5'): void {
    this.statusText.setText(msg);
    this.statusText.setColor(color);
    if (msg) {
      this.statusText.setAlpha(0);
      this.tweens.add({ targets: this.statusText, alpha: 1, duration: 150 });
    }
  }

  private refreshSlots(): void {
    const inv = gameState.getInventory();
    BALL_DROP_TABLE.forEach((ball, i) => {
      const count =
        (inv.common[ball.id] ?? 0) +
        (inv.rare[ball.id] ?? 0) +
        (inv.legendary[ball.id] ?? 0);
      this.slotLabels[i]?.setText(`x${count}`);
    });
  }

  private close(): void {
    if (this.cabinet?.isBusy()) return;
    audioManager.play(SfxKeys.click, 0.4);
    sceneManager.closeShop(this);
  }

  shutdown(): void {
    gameState.off(GameStateEvents.InventoryChanged, this.onInventoryChanged);
    this.slotLabels = [];
    logger.debug('ShopOverlay shutdown.');
  }
}
