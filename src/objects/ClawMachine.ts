/**
 * ClawMachine — the claw animation controller for the shop.
 *
 * Encapsulates the grabber sprite and the weighted random drop. `play()` runs
 * the descent/grab/rise sequence and resolves with the awarded BallDrop, so
 * the overlay only has to wire "insert coin -> play -> collect".
 *
 * Drop weighting is normalized from BALL_DROP_TABLE at runtime.
 */
import Phaser from 'phaser';
import {
  BALL_DROP_TABLE,
  COLORS,
  TEXTURE_KEYS,
  CLAW_COST,
  type BallDrop,
} from '../config/constants';
import { logger } from '../utils/logger';

export class ClawMachine extends Phaser.GameObjects.Container {
  private claw: Phaser.GameObjects.Image;
  private rail: Phaser.GameObjects.Rectangle;
  private prongs: Phaser.GameObjects.Image;
  private busy = false;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.setSize(280, 260);

    // Cabinet frame.
    const frame = scene.add
      .rectangle(0, 0, 300, 280, 0x0a1a2a, 0.6)
      .setStrokeStyle(3, COLORS.blue, 0.7);
    this.add(frame);

    // Prize chute backdrop.
    const chute = scene.add
      .rectangle(0, 90, 280, 80, 0x06121e, 1)
      .setStrokeStyle(2, COLORS.grayDark, 0.5);
    this.add(chute);

    // Rail the claw travels along.
    this.rail = scene.add.rectangle(0, -90, 260, 6, COLORS.grayDark, 0.8);
    this.add(this.rail);

    // Claw (rod + prongs as one texture).
    this.claw = scene.add.image(0, -80, TEXTURE_KEYS.claw).setOrigin(0.5, 0);
    this.add(this.claw);
    this.prongs = this.claw; // alias for readability

    scene.add.existing(this);
  }

  isBusy(): boolean {
    return this.busy;
  }

  /** Roll the weighted drop table. */
  private roll(): BallDrop {
    const total = BALL_DROP_TABLE.reduce((s, b) => s + b.weight, 0);
    let r = Math.random() * total;
    for (const ball of BALL_DROP_TABLE) {
      r -= ball.weight;
      if (r <= 0) return ball;
    }
    return BALL_DROP_TABLE[0];
  }

  /**
   * Run the claw sequence and resolve with the awarded ball.
   * Resolves null if called while already busy (defensive).
   */
  play(): Promise<BallDrop | null> {
    if (this.busy) return Promise.resolve(null);
    this.busy = true;

    return new Promise<BallDrop>((resolve) => {
      const drop = this.roll();
      const timeline = this.scene.tweens.chain({
        targets: this.claw,
        tweens: [
          // 1. descend
          { y: 40, duration: 700, ease: 'Sine.easeIn' },
          // 2. grab (close prongs visually via scale)
          { scaleX: 0.8, duration: 220, yoyo: true },
          // 3. rise holding the ball
          { y: -80, duration: 700, ease: 'Sine.easeOut' },
          // 4. slide to chute
          { x: 90, duration: 400, ease: 'Sine.easeInOut' },
          // 5. release
          { x: 90, duration: 100 },
        ],
        onComplete: () => {
          // Spawn the dropped ball falling into the chute.
          const ball = this.scene.add
            .image(90, -40, TEXTURE_KEYS.ball)
            .setTint(drop.color)
            .setScale(0.9);
          this.add(ball);
          this.scene.tweens.add({
            targets: ball,
            y: 80,
            duration: 500,
            ease: 'Bounce.easeOut',
            onComplete: () => {
              this.scene.tweens.add({
                targets: ball,
                alpha: 0,
                scale: 0.4,
                duration: 400,
                delay: 250,
                onComplete: () => {
                  ball.destroy();
                  // return claw to center
                  this.scene.tweens.add({
                    targets: this.claw,
                    x: 0,
                    duration: 300,
                    onComplete: () => {
                      this.busy = false;
                      resolve(drop);
                    },
                  });
                },
              });
            },
          });
        },
      });
      void timeline;
    });
  }

  /** Cost label helper (kept here so the cabinet is self-describing). */
  static get cost(): number {
    return CLAW_COST;
  }

  /** Expose the full table so the overlay can build the slot legend. */
  static get table(): readonly BallDrop[] {
    return BALL_DROP_TABLE;
  }
}
