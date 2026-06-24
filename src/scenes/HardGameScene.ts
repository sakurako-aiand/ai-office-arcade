/**
 * HardGameScene — HARD difficulty mini-game: "Bit-Battle: Project Launch".
 *
 * A fast-paced, retro 8-bit turn-based battle. Pick 3 heroes (Engineer /
 * Designer / Manager), then clear 3 sequential levels (Bug Swarm -> Server
 * Firewall -> Boss Meeting). Combat uses a streamlined Attack/Defend/Skill
 * menu with instant resolution and a SPACE-held ACCELERATE to fast-forward.
 *
 * The strict three-minute timer, coin reward, and auto-kick back to the hub
 * are all owned by MiniGameLoader — this scene just builds the controller and
 * forwards its 'win' / 'lose' events into the loader pipeline (hard = +50
 * coins on win; 0 on lose/timeout).
 *
 * Win:  clear Level 3 (boss) -> controller emits 'win' -> this.win()  -> +50 coins + auto-kick.
 * Lose: party wiped          -> controller emits 'lose' -> this.lose() -> 0 coins + auto-kick.
 * Timeout: 3-min loader timer expires -> 0 coins + auto-kick (handled by loader).
 *
 * The controller + view are fully self-contained (party select, combat loop,
 * enemy AI, retro UI, cleanup); see src/games/bitBattle/.
 */
import { SCENE_KEYS } from '../config/constants';
import { MiniGameLoader } from './MiniGameLoader';
import { BitBattleController } from '../games/bitBattle/BitBattleController';
import { logger } from '../utils/logger';

export class HardGameScene extends MiniGameLoader {
  private controller: BitBattleController | null = null;

  constructor() {
    super(SCENE_KEYS.HardGame);
  }

  protected buildGame(): void {
    // Subtitle under the shared "HARD MINI-GAME" header.
    this.add
      .text(this.scale.width / 2, 134, 'BIT-BATTLE: PROJECT LAUNCH', {
        fontFamily: 'Press Start 2P, monospace',
        fontSize: '12px',
        color: '#ef4444',
      })
      .setOrigin(0.5)
      .setDepth(5);

    // Mount the battle controller and wire its win/lose events into the loader.
    this.controller = new BitBattleController(this);
    this.controller.on('win', () => this.win());
    this.controller.on('lose', () => this.lose());
  }

  /** The controller draws its own field, so skip the generic placeholder. */
  protected drawPlaceholderField(): void {
    // no-op
  }

  shutdown(): void {
    // Tear down the controller explicitly (unsubscribes keyboard + input,
    // destroys the view + all GameObjects) for leak-free scene swaps.
    this.controller?.destroy();
    this.controller = null;
    super.shutdown();
    logger.debug('HardGameScene shutdown.');
  }
}
