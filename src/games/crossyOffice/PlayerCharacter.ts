/**
 * PlayerCharacter — the office worker avatar placeholder.
 *
 * A container drawn at near-scale; the board re-projects it each frame from the
 * player's continuous (col,row) and applies a hop "lift" so hops arc visually.
 * Replace the primitives with a sprite sheet in PreloadScene later (TODO).
 */
import Phaser from 'phaser';
import { NEAR_CELL, CROSSY_COLORS } from './config';

export class PlayerCharacter extends Phaser.GameObjects.Container {
  private bodyRect: Phaser.GameObjects.Rectangle;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    this.bodyRect = scene.add
      .rectangle(0, 0, NEAR_CELL * 0.66, NEAR_CELL * 0.66, CROSSY_COLORS.player, 1)
      .setStrokeStyle(3, CROSSY_COLORS.playerEdge, 1);
    this.add(this.bodyRect);

    // Simple "head" so it reads as a person rather than a plain box.
    const head = scene.add.rectangle(
      0,
      -NEAR_CELL * 0.1,
      NEAR_CELL * 0.32,
      NEAR_CELL * 0.32,
      0xffffff,
      0.95
    );
    this.add(head);
    const eye = scene.add.rectangle(
      0,
      -NEAR_CELL * 0.1,
      NEAR_CELL * 0.08,
      NEAR_CELL * 0.1,
      0x0f1e2e
    );
    this.add(eye);
  }

  /** Flash red on collision (brief) before the loader takes over. */
  flashCollision(): void {
    const original = this.bodyRect.fillColor;
    this.scene.tweens.add({
      targets: this.bodyRect,
      fillColor: CROSSY_COLORS.invalid,
      duration: 90,
      yoyo: true,
      repeat: 1,
      onComplete: () => this.bodyRect.setFillStyle(original),
    });
  }
}
