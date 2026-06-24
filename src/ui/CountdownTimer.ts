/**
 * CountdownTimer — the strict three-minute timer + progress bar.
 *
 * Used by MiniGameLoader. Drives a Phaser timer that ticks every 250ms, renders
 * a remaining-time label (M:SS) and a shrinking progress bar. When time hits
 * zero it fires `onTimeout` exactly once and disables itself.
 *
 * The bar is split into green/amber/red segments by remaining fraction so the
 * player feels urgency as the clock drains.
 */
import Phaser from 'phaser';
import { COLORS, MINIGAME_TIME_MS } from '../config/constants';

export class CountdownTimer extends Phaser.GameObjects.Container {
  private remainingMs: number;
  private barBg: Phaser.GameObjects.Rectangle;
  private barFill: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;
  private timerEvent: Phaser.Time.TimerEvent | null = null;
  private done = false;

  /** Fired once when the timer reaches zero. */
  onTimeout?: () => void;

  constructor(scene: Phaser.Scene, x: number, y: number, width = 360) {
    super(scene, x, y);
    this.setScrollFactor(0).setDepth(60);
    this.remainingMs = MINIGAME_TIME_MS;

    // Label
    this.label = scene.add
      .text(0, -22, this.format(MINIGAME_TIME_MS), {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: '800',
      })
      .setOrigin(0.5);
    this.add(this.label);

    // Bar
    const h = 16;
    this.barBg = scene.add
      .rectangle(0, 0, width, h, 0x0a1a2a, 0.9)
      .setStrokeStyle(2, COLORS.grayDark, 0.6)
      .setOrigin(0.5);
    this.add(this.barBg);

    this.barFill = scene.add
      .rectangle(-width / 2, 0, width, h - 4, COLORS.success)
      .setOrigin(0, 0.5);
    this.add(this.barFill);

    scene.add.existing(this);
  }

  /** Begin ticking. Idempotent. */
  start(): void {
    if (this.timerEvent) return;
    this.timerEvent = this.scene.time.addEvent({
      delay: 250,
      loop: true,
      callback: this.tick,
      callbackScope: this,
    });
  }

  private tick(): void {
    if (this.done) return;
    this.remainingMs -= 250;
    if (this.remainingMs <= 0) {
      this.remainingMs = 0;
      this.render();
      this.finish();
      return;
    }
    this.render();
  }

  private render(): void {
    this.label.setText(this.format(this.remainingMs));
    const frac = Math.max(0, this.remainingMs / MINIGAME_TIME_MS);
    this.barFill.scaleX = frac;
    // Color shifts to amber under 40%, red under 20%.
    const color =
      frac > 0.4 ? COLORS.success : frac > 0.2 ? COLORS.medium : COLORS.danger;
    this.barFill.setFillStyle(color);
  }

  private finish(): void {
    if (this.done) return;
    this.done = true;
    this.stop();
    this.onTimeout?.();
  }

  /** Stop ticking without firing timeout (used on early win/lose). */
  stop(): void {
    if (this.timerEvent) {
      this.timerEvent.remove();
      this.timerEvent = null;
    }
  }

  /** Remaining whole seconds (for HUD/debug). */
  get remainingSeconds(): number {
    return Math.ceil(this.remainingMs / 1000);
  }

  private format(ms: number): string {
    const total = Math.max(0, Math.ceil(ms / 1000));
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  destroy(fromScene?: boolean): void {
    this.stop();
    super.destroy(fromScene);
  }
}
