/**
 * HardGameScene — HARD difficulty placeholder.
 *
 * TODO(gameplay): implement a demanding mini-game (e.g. pattern memory under a
 * shrinking time budget, or a fast precision aim challenge).
 */
import { SCENE_KEYS, COLORS } from '../config/constants';
import { MiniGameLoader } from './MiniGameLoader';

export class HardGameScene extends MiniGameLoader {
  constructor() {
    super(SCENE_KEYS.HardGame);
  }

  protected buildGame(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 70, 'HARD • Memory Sprint', {
        fontFamily: 'Press Start 2P, monospace',
        fontSize: '16px',
        color: '#ef4444',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 30, 'TODO: show a pattern, then verify the player repeats it.', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: '#7b8794',
      })
      .setOrigin(0.5);

    this.addDevControls(width / 2, height / 2 + 40);
  }

  private addDevControls(x: number, y: number): void {
    const make = (label: string, dx: number, tint: number, onClick: () => void) => {
      const b = this.add.rectangle(x + dx, y, 150, 46, tint).setStrokeStyle(2, 0xffffff, 0.5);
      b.setInteractive({ useHandCursor: true });
      this.add
        .text(x + dx, y, label, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '16px',
          color: '#ffffff',
          fontStyle: '800',
        })
        .setOrigin(0.5);
      b.on('pointerup', onClick);
    };
    make('WIN (test)', -90, COLORS.easy, () => this.win());
    make('LOSE (test)', 90, COLORS.hard, () => this.lose());
  }
}
