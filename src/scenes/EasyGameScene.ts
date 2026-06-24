/**
 * EasyGameScene — EASY difficulty placeholder.
 *
 * TODO(gameplay): implement a relaxed mini-game (e.g. catch falling coins).
 * For now it renders a labeled placeholder with dev controls that exercise the
 * win/lose pipeline so the framework is demonstrable end-to-end.
 */
import { SCENE_KEYS, COLORS } from '../config/constants';
import { MiniGameLoader } from './MiniGameLoader';

export class EasyGameScene extends MiniGameLoader {
  constructor() {
    super(SCENE_KEYS.EasyGame);
  }

  protected buildGame(): void {
    const { width, height } = this.scale;

    this.add
      .text(width / 2, height / 2 - 70, 'EASY • Catch the Coins', {
        fontFamily: 'Press Start 2P, monospace',
        fontSize: '16px',
        color: '#22c55e',
      })
      .setOrigin(0.5);

    this.add
      .text(width / 2, height / 2 - 30, 'TODO: spawn falling coins + a basket the player moves.', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: '#7b8794',
      })
      .setOrigin(0.5);

    this.addDevControls(width / 2, height / 2 + 40);
  }

  /** Temporary WIN/LOSE buttons so the auto-kick + reward pipeline is testable. */
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
