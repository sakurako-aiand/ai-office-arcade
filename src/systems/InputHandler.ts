/**
 * InputHandler — unified pointer / keyboard / touch input.
 *
 * Phaser already normalizes mouse and touch into "pointer" events, but this
 * wrapper gives the rest of the codebase a single, documented input surface:
 *   - high-level intents (tap, confirm, cancel, pause)
 *   - safe once-only event binding per scene
 *   - keyboard fallbacks (Enter/Space confirm, Esc back, P pause)
 *
 * Each scene creates its own InputHandler bound to its own `this.input`; on
 * shutdown the scene's input system is torn down automatically by Phaser, so
 * listeners don't leak.
 */
import Phaser from 'phaser';
import { logger } from '../utils/logger';

export interface InputCallbacks {
  onTap?: (pointer: Phaser.Input.Pointer) => void;
  onConfirm?: () => void;
  onCancel?: () => void;
  onPause?: () => void;
}

export class InputHandler {
  private scene: Phaser.Scene;
  private cbs: InputCallbacks;
  private bound = false;

  constructor(scene: Phaser.Scene, cbs: InputCallbacks = {}) {
    this.scene = scene;
    this.cbs = cbs;
  }

  /** Attach listeners. Idempotent — safe to call once. */
  bind(): void {
    if (this.bound) return;
    this.bound = true;

    // Pointer covers mouse + touch (Phaser merges them into pointers).
    this.scene.input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);

    // Keyboard intents.
    const kb = this.scene.input.keyboard;
    if (kb) {
      kb.on('keydown-ENTER', () => this.cbs.onConfirm?.());
      kb.on('keydown-SPACE', () => this.cbs.onConfirm?.());
      kb.on('keydown-ESC', () => this.cbs.onCancel?.());
      kb.on('keydown-P', () => this.cbs.onPause?.());
    } else {
      logger.debug('Keyboard unavailable on this scene (touch-only?).');
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    // A "tap" intent = pointer up (covers click + touch release).
    this.cbs.onTap?.(pointer);
    this.cbs.onConfirm?.();
  }

  /** Enable a key by name (extra, scene-specific controls). */
  addKey(key: string): Phaser.Input.Keyboard.Key | undefined {
    const kb = this.scene.input.keyboard;
    return kb?.addKey(key);
  }

  /** Detach listeners manually (rarely needed; Phaser clears on shutdown). */
  unbind(): void {
    if (!this.bound) return;
    this.bound = false;
    this.scene.input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp, this);
  }
}
