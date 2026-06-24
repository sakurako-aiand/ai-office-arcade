/**
 * Platform — an interactive difficulty pad in the hub.
 *
 * A tinted pad with the difficulty label, an instruction hint, and hover/press
 * feedback. On a confirmed tap it invokes `onSelect`, which the hub wires to
 * `sceneManager.enterMiniGame`.
 *
 * Built as a container so all parts (pad, label, glow) move together and can be
 * disabled as a group when the shop is open.
 */
import Phaser from 'phaser';
import { COLORS, TEXTURE_KEYS, type Difficulty } from '../config/constants';

export class Platform extends Phaser.GameObjects.Container {
  readonly difficulty: Difficulty;
  private pad: Phaser.GameObjects.Image;
  private glow: Phaser.GameObjects.Image;
  private label: Phaser.GameObjects.Text;
  private reward: number;
  private enabled = true;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    difficulty: Difficulty,
    reward: number,
    onSelect: (d: Difficulty) => void
  ) {
    super(scene, x, y);
    this.difficulty = difficulty;
    this.reward = reward;

    const color = COLORS[difficulty];

    // Soft glow behind the pad (pulses when hovered).
    this.glow = scene.add
      .image(0, 0, TEXTURE_KEYS.pixel)
      .setDisplaySize(260, 96)
      .setTint(color)
      .setAlpha(0.18)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.add(this.glow);

    this.pad = scene.add
      .image(0, 0, TEXTURE_KEYS.platform)
      .setTint(color)
      .setInteractive({ useHandCursor: true });
    this.add(this.pad);

    this.label = scene.add
      .text(0, -4, `${difficulty.toUpperCase()}`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '26px',
        color: '#ffffff',
        fontStyle: '800',
      })
      .setOrigin(0.5);
    this.add(this.label);

    const sub = scene.add
      .text(0, 18, `+${reward} coins`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: '#e5e7eb',
      })
      .setOrigin(0.5);
    this.add(sub);

    scene.add.existing(this);

    // Input feedback.
    this.pad.on(Phaser.Input.Events.POINTER_OVER, () => {
      if (!this.enabled) return;
      scene.tweens.add({ targets: this, scale: 1.06, duration: 120, ease: 'Quad.easeOut' });
      scene.tweens.add({ targets: this.glow, alpha: 0.45, duration: 120 });
    });
    this.pad.on(Phaser.Input.Events.POINTER_OUT, () => {
      scene.tweens.add({ targets: this, scale: 1, duration: 120, ease: 'Quad.easeOut' });
      scene.tweens.add({ targets: this.glow, alpha: 0.18, duration: 120 });
    });
    this.pad.on(Phaser.Input.Events.POINTER_UP, () => {
      if (!this.enabled) return;
      onSelect(this.difficulty);
    });
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.pad.input!.enabled = enabled;
    this.setAlpha(enabled ? 1 : 0.5);
  }
}
