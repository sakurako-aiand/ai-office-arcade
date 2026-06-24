/**
 * EasyGameScene — EASY difficulty mini-game: "Office Rush Hour".
 *
 * A Rush-Hour-style sliding puzzle reskinned with office furniture. The player
 * clears a path so the EMPLOYEE piece can slide out through the EXIT on the
 * right edge. Each piece moves only along its own orientation. The strict
 * three-minute timer, coin reward, and auto-kick back to the hub are all owned
 * by MiniGameLoader — this scene just builds the board and forwards its
 * `'win'` event to `this.win()` (which awards exactly 10 coins for easy).
 *
 * Win:  employee reaches the EXIT -> board emits 'win' -> this.win() -> +10 coins + auto-kick.
 * Lose/timeout: 3-min loader timer expires -> 0 coins + auto-kick.
 *
 * The board itself is fully self-contained (grid logic, input, cleanup); see
 * src/games/officeRushHour/OfficeRushHourBoard.ts.
 */
import { SCENE_KEYS } from '../config/constants';
import { MiniGameLoader } from './MiniGameLoader';
import { OfficeRushHourBoard } from '../games/officeRushHour/OfficeRushHourBoard';
import { logger } from '../utils/logger';

export class EasyGameScene extends MiniGameLoader {
  private board: OfficeRushHourBoard | null = null;

  constructor() {
    super(SCENE_KEYS.EasyGame);
  }

  protected buildGame(): void {
    // Subtitle under the shared "EASY MINI-GAME" header.
    this.add
      .text(this.scale.width / 2, 134, 'OFFICE RUSH HOUR', {
        fontFamily: 'Press Start 2P, monospace',
        fontSize: '12px',
        color: '#22c55e',
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Mount the puzzle board and wire its win event into the loader pipeline.
    this.board = new OfficeRushHourBoard(this);
    this.board.on('win', () => this.win());
  }

  /** The board draws its own field, so skip the generic placeholder. */
  protected drawPlaceholderField(): void {
    // no-op
  }

  shutdown(): void {
    // Tear down the board explicitly (removes scene-level input listeners +
    // PieceViews) so the scene swaps out cleanly with no memory leaks.
    this.board?.destroy();
    this.board = null;
    super.shutdown();
    logger.debug('EasyGameScene shutdown.');
  }
}
