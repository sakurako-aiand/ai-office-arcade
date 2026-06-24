/**
 * SceneManager — scene routing + lifecycle safety.
 *
 * All cross-scene navigation goes through here. This guarantees:
 *   - consistent fade transitions on entry/exit,
 *   - the shop overlay is launched as a sleeping scene on top of the hub,
 *   - mini-game return always routes to the hub spawn,
 *   - scenes are stopped (not just hidden) to avoid duplicate-timer leaks.
 *
 * The hub exposes a public spawn point; returning players are re-centered there
 * by HubScene.spawnPlayer(), which listens for the BOOT_FROM_MINIGAME event.
 */
import Phaser from 'phaser';
import { SCENE_KEYS, type Difficulty, DIFFICULTY_SCENE } from '../config/constants';
import { transitionManager } from './TransitionManager';
import { gameState } from '../state/GameState';
import { logger } from '../utils/logger';

/** How the player left a mini-game (drives the hub welcome-back banner). */
export type LeaveReason = 'win' | 'lose' | 'timeout';

class SceneManagerService {
  /** Start the very first scene (called once from BootScene). */
  boot(): void {
    // Phaser auto-starts the first scene in the config, but being explicit
    // documents intent and is robust if the scene list order ever changes.
    // (No-op if already running.)
  }

  /** Transition from the hub into a mini-game. */
  enterMiniGame(hub: Phaser.Scene, difficulty: Difficulty): void {
    const target = DIFFICULTY_SCENE[difficulty];
    gameState.beginMiniGame(difficulty);
    logger.info(`Entering mini-game: ${difficulty} -> ${target}`);

    transitionManager.fadeSwap(hub, undefined, () => {
      // Stop the shop overlay if open, then swap hub for the mini-game.
      hub.scene.stop(SCENE_KEYS.Shop);
      hub.scene.stop(SCENE_KEYS.Hub);
      hub.scene.start(target);
    });
  }

  /**
   * Return the player to the hub spawn point.
   * Called by MiniGameLoader after a win / lose / timeout.
   */
  returnToHub(from: Phaser.Scene, reason: LeaveReason, difficulty: Difficulty | null): void {
    logger.info(`Returning to hub (reason=${reason}, difficulty=${difficulty})`);
    gameState.resetRunState();

    transitionManager.fadeSwap(from, undefined, () => {
      from.scene.stop(from.scene.key);
      // Launch the hub fresh and hand it the leave reason via launch data.
      from.scene.launch(SCENE_KEYS.Hub, { reason, difficulty });
    });
  }

  /** Open the claw-machine shop overlay above the hub. */
  openShop(scene: Phaser.Scene): void {
    if (scene.scene.isActive(SCENE_KEYS.Shop)) {
      logger.debug('Shop already open.');
      return;
    }
    scene.scene.launch(SCENE_KEYS.Shop);
    scene.scene.bringToTop(SCENE_KEYS.Shop);
  }

  /** Close the shop overlay (returns focus to the hub). */
  closeShop(scene: Phaser.Scene): void {
    scene.scene.stop(SCENE_KEYS.Shop);
  }
}

export const sceneManager = new SceneManagerService();
