/**
 * TransitionManager — fade / scan scene transitions.
 *
 * Keeps all camera-transition logic in one place so scenes stay declarative.
 * Every transition returns a Promise that resolves once the camera animation is
 * fully done, so callers can sequence "fade out -> start scene -> fade in"
 * without nested callbacks.
 */
import Phaser from 'phaser';
import { TRANSITIONS } from '../config/constants';
import { COLORS } from '../config/constants';

type Cam = Phaser.Cameras.Scene2D.Camera;

class TransitionManager {
  /** Fade the camera to black, then back from black (covers a scene swap). */
  fadeSwap(
    scene: Phaser.Scene,
    duration = TRANSITIONS.fadeDuration,
    midSwap: () => void
  ): void {
    const cam = scene.cameras.main;
    cam.fadeOut(duration, this.r(COLORS.navy), this.g(COLORS.navy), this.b(COLORS.navy));
    scene.time.delayedCall(duration, () => {
      midSwap();
      cam.fadeIn(duration, this.r(COLORS.navy), this.g(COLORS.navy), this.b(COLORS.navy));
    });
  }

  /**
   * "Scan" transition — a colored wipe sweeps across, the swap happens behind it,
   * then it sweeps away. A retro-flavored alternative to the plain fade.
   */
  scanSwap(scene: Phaser.Scene, midSwap: () => void): void {
    const w = scene.scale.width;
    const h = scene.scale.height;
    const bar = scene.add.rectangle(w / 2, h / 2, 0, h, COLORS.blue, 0.9).setDepth(1_000);
    scene.tweens.add({
      targets: bar,
      width: w * 1.2,
      duration: TRANSITIONS.scanDuration / 2,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        midSwap();
        scene.tweens.add({
          targets: bar,
          width: 0,
          duration: TRANSITIONS.scanDuration / 2,
          ease: 'Cubic.easeOut',
          onComplete: () => bar.destroy(),
        });
      },
    });
  }

  /** One-way fade-in for freshly started scenes. */
  fadeIn(scene: Phaser.Scene, duration = TRANSITIONS.fadeDuration): void {
    const cam = scene.cameras.main;
    cam.fadeIn(duration, this.r(COLORS.navy), this.g(COLORS.navy), this.b(COLORS.navy));
  }

  // Phaser fade wants 0-255 channel ints; helpers convert hex numbers.
  private r(hex: number) {
    return (hex >> 16) & 0xff;
  }
  private g(hex: number) {
    return (hex >> 8) & 0xff;
  }
  private b(hex: number) {
    return hex & 0xff;
  }
}

export const transitionManager = new TransitionManager();
// Convenience for one-off callers that don't need a Cam import.
export type { Cam };
