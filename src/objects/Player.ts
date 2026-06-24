/**
 * Player — avatar placeholder.
 *
 * A rounded chip that snaps to the hub spawn point. It has a gentle idle bob so
 * the hub feels alive. When the player returns from a mini-game, the hub calls
 * `respawn()` to re-center the avatar and play a short land animation.
 *
 * Replace the texture with a real sprite sheet in PreloadScene later; this class
 * already keys off TEXTURE_KEYS.playerAvatar.
 */
import Phaser from 'phaser';
import { TEXTURE_KEYS } from '../config/constants';

export class Player extends Phaser.GameObjects.Container {
  private sprite: Phaser.GameObjects.Image;
  private bobTween: Phaser.Tweens.Tween | null = null;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.sprite = scene.add.image(0, 0, TEXTURE_KEYS.playerAvatar);
    this.add(this.sprite);
    scene.add.existing(this);
    this.startIdle();
  }

  private startIdle(): void {
    this.bobTween = this.scene.tweens.add({
      targets: this.sprite,
      y: -6,
      duration: 1100,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Re-center the avatar on the hub spawn and play a land pop. */
  respawn(x: number, y: number): void {
    this.setPosition(x, y);
    this.scene.tweens.add({
      targets: this.sprite,
      scale: { from: 0.6, to: 1 },
      duration: 300,
      ease: 'Back.easeOut',
    });
  }

  destroy(fromScene?: boolean): void {
    this.bobTween?.stop();
    super.destroy(fromScene);
  }
}
