/**
 * MiniGameLoader — base class for every mini-game scene.
 *
 * Owns the shared "run shell":
 *   - the strict 3-minute CountdownTimer + progress bar (top center),
 *   - a placeholder playfield + per-game instructions,
 *   - the win / lose / time-up pipeline that awards coins and auto-kicks the
 *     player back to the hub spawn,
 *   - graceful "already resolved" guards so a late timer can't double-pay.
 *
 * Subclasses (Easy/Medium/Hard) extend this and implement `buildGame()`, then
 * call `this.win()` or `this.lose()` from their own game logic. They never touch
 * the timer, transitions, or coin award directly.
 *
 *   TODO(per-game): implement actual gameplay in buildGame().
 */
import Phaser from 'phaser';
import {
  COLORS,
  SCENE_KEYS,
  DIFFICULTY_REWARD,
  type Difficulty,
} from '../config/constants';
import { transitionManager } from '../systems/TransitionManager';
import { sceneManager, type LeaveReason } from '../systems/SceneManager';
import { audioManager, SfxKeys } from '../systems/AudioManager';
import { gameState } from '../state/GameState';
import { CountdownTimer } from '../ui/CountdownTimer';
import { CoinCounter } from '../ui/CoinCounter';
import { logger } from '../utils/logger';

export abstract class MiniGameLoader extends Phaser.Scene {
  protected difficulty!: Difficulty;
  protected timer!: CountdownTimer;
  private banner: Phaser.GameObjects.Container | null = null;
  private returning = false;

  constructor(sceneKey: string) {
    super(sceneKey);
  }

  create(): void {
    // Difficulty was stashed on GameState by SceneManager just before launch.
    this.difficulty = gameState.getActiveDifficulty() ?? 'easy';

    const { width, height } = this.scale;
    this.cameras.main.setBackgroundColor(COLORS.deepBlue);

    // Shared HUD: timer (top center) + coin counter (top right).
    this.timer = new CountdownTimer(this, width / 2, 56);
    this.timer.onTimeout = () => this.resolve('timeout');
    this.timer.start();
    new CoinCounter(this, width - 96, 56);

    // Branded header.
    this.add
      .text(width / 2, 110, `${this.difficulty.toUpperCase()} MINI-GAME`, {
        fontFamily: 'Press Start 2P, monospace',
        fontSize: '14px',
        color: '#9aa7b4',
      })
      .setOrigin(0.5);

    // Placeholder playfield border (replace with real game art).
    this.drawPlaceholderField(width, height);

    // Hand off to the concrete game.
    this.buildGame();

    transitionManager.fadeIn(this);
    logger.info(`MiniGameLoader ready: ${this.difficulty}`);
  }

  /** Subclasses implement the actual gameplay here. */
  protected abstract buildGame(): void;

  /** Draw a bordered playfield so placeholders look intentional. */
  private drawPlaceholderField(w: number, h: number): void {
    const pad = 40;
    const top = 150;
    const field = this.add
      .rectangle(w / 2, (h + top) / 2, w - pad * 2, h - top - pad, 0x0a1622, 0.6)
      .setStrokeStyle(2, COLORS.grayDark, 0.5);
    void field;
    this.add
      .text(w / 2, (h + top) / 2, 'TODO: implement this mini-game', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: '#5b6675',
      })
      .setOrigin(0.5);
    this.add
      .text(w / 2, (h + top) / 2 + 28, `Win = +${this.rewardFor(this.difficulty)} coins`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        color: '#7b8794',
      })
      .setOrigin(0.5);
  }

  /** Resolve the run exactly once, award coins on a win, then auto-kick. */
  protected resolve(reason: LeaveReason): void {
    if (this.returning) return; // guard against double resolution
    if (!gameState.markResolved()) return; // already paid out
    this.returning = true;

    // Stop the clock immediately so a late tick can't re-enter here.
    this.timer.stop();

    if (reason === 'win') {
      gameState.awardCoinsForDifficulty(this.difficulty);
      audioManager.play(SfxKeys.win);
    } else if (reason === 'timeout') {
      audioManager.play(SfxKeys.timeout);
    } else {
      audioManager.play(SfxKeys.lose);
    }

    this.showResultBanner(reason);
    // Give the player a moment to read the result, then fade back to the hub.
    this.time.delayedCall(1800, () => this.kickToHub(reason));
  }

  /** Convenience for subclasses: report a victory. */
  protected win(): void {
    this.resolve('win');
  }

  /** Convenience for subclasses: report a defeat (0 coins). */
  protected lose(): void {
    this.resolve('lose');
  }

  private kickToHub(reason: LeaveReason): void {
    sceneManager.returnToHub(this, reason, this.difficulty);
  }

  /** Big centered result banner. */
  private showResultBanner(reason: LeaveReason): void {
    const { width, height } = this.scale;
    const msg =
      reason === 'win' ? 'YOU WIN!' : reason === 'timeout' ? "TIME'S UP!" : 'YOU LOSE';
    const color =
      reason === 'win' ? '#22c55e' : reason === 'timeout' ? '#f59e0b' : '#ef4444';
    const sub =
      reason === 'win'
        ? `+${this.rewardFor(this.difficulty)} coins`
        : reason === 'timeout'
        ? 'No coins awarded'
        : 'No coins awarded';

    this.banner = this.add.container(width / 2, height / 2).setDepth(200);
    const bg = this.add
      .rectangle(0, 0, 480, 160, 0x0a1a2a, 0.95)
      .setStrokeStyle(3, reason === 'win' ? COLORS.success : COLORS.danger);
    const title = this.add
      .text(0, -22, msg, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '44px',
        color,
        fontStyle: '800',
      })
      .setOrigin(0.5);
    const subtitle = this.add
      .text(0, 26, sub, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: '#c7d2dc',
      })
      .setOrigin(0.5);
    this.banner.add([bg, title, subtitle]);
    this.banner.setScale(0.7).setAlpha(0);
    this.tweens.add({
      targets: this.banner,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  private rewardFor(d: Difficulty): number {
    return DIFFICULTY_REWARD[d];
  }

  /** Clean teardown: drop the timer + banner. Phaser clears the rest. */
  shutdown(): void {
    this.timer?.destroy();
    this.banner?.destroy();
    this.banner = null;
    logger.debug(`${this.scene.key} shutdown.`);
  }
}
