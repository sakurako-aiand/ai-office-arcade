/**
 * MediumGameScene — MEDIUM difficulty mini-game: "Crossy Office".
 *
 * A pseudo-3D Crossy-Road-style runner. Hop the office worker from the Parking
 * Lot to the Server Room while dodging cars, delivery carts, and roombas on
 * horizontal lanes. The strict three-minute timer, coin reward, and auto-kick
 * back to the hub are all owned by MiniGameLoader — this scene just builds the
 * board and forwards its `'win'` / `'lose'` events into the loader pipeline
 * (medium = +30 coins on win; 0 on lose/timeout).
 *
 * Win:  reach Server Room -> board emits 'win' -> this.win()  -> +30 coins + auto-kick.
 * Lose: hit an obstacle     -> board emits 'lose' -> this.lose() -> 0 coins + auto-kick.
 * Timeout: 3-min loader timer expires -> 0 coins + auto-kick (handled by loader).
 *
 * The board is fully self-contained (perspective, pooling, input, cleanup); see
 * src/games/crossyOffice/CrossyOfficeBoard.ts.
 */
import { SCENE_KEYS } from '../config/constants';
import { MiniGameLoader } from './MiniGameLoader';
import { CrossyOfficeBoard } from '../games/crossyOffice/CrossyOfficeBoard';
import { logger } from '../utils/logger';

export class MediumGameScene extends MiniGameLoader {
  private board: CrossyOfficeBoard | null = null;

  constructor() {
    super(SCENE_KEYS.MediumGame);
  }

  protected buildGame(): void {
    // Subtitle under the shared "MEDIUM MINI-GAME" header.
    this.add
      .text(this.scale.width / 2, 134, 'CROSSY OFFICE', {
        fontFamily: 'Press Start 2P, monospace',
        fontSize: '12px',
        color: '#f59e0b',
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Mount the runner board and wire its win/lose events into the loader.
    this.board = new CrossyOfficeBoard(this);
    this.board.on('win', () => this.win());
    this.board.on('lose', () => this.lose());
  }

  /** The board draws its own field, so skip the generic placeholder. */
  protected drawPlaceholderField(): void {
    // no-op
  }

  shutdown(): void {
    // Tear down the board explicitly (unsubscribes scene update + input,
    // releases the obstacle pool, destroys all views) for leak-free swaps.
    this.board?.destroy();
    this.board = null;
    super.shutdown();
    logger.debug('MediumGameScene shutdown.');
  }
}
