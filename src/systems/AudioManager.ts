/**
 * AudioManager — ambient + SFX placeholders.
 *
 * No audio files exist yet (Phase 1). Every play call is wrapped so a missing
 * asset logs a debug line instead of throwing. When real audio is added, drop
 * the files in /public/audio and load them in PreloadScene; this class already
 * keys off the same string ids.
 *
 * Sounds are intentionally created lazily and cached; reuse avoids leaking
 * WebAudio nodes.
 */
import Phaser from 'phaser';
import { logger } from '../utils/logger';

/** Central registry of sound keys (load these in PreloadScene later). */
export const SfxKeys = {
  ambientOffice: 'sfx_ambient_office',
  click: 'sfx_click',
  coin: 'sfx_coin',
  win: 'sfx_win',
  lose: 'sfx_lose',
  timeout: 'sfx_timeout',
  claw: 'sfx_claw',
  drop: 'sfx_drop',
} as const;

class AudioManager {
  private scene: Phaser.Scene | null = null;
  private ambient: Phaser.Sound.BaseSound | null = null;
  private muted = false;

  /** Bind to a scene (call from PreloadScene once audio is registered). */
  attach(scene: Phaser.Scene): void {
    this.scene = scene;
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.scene?.sound) this.scene.sound.mute = muted;
  }

  isMuted(): boolean {
    return this.muted;
  }

  /** Play a looping ambient bed (office hum). Missing asset = no-op. */
  playAmbient(key: string = SfxKeys.ambientOffice, volume = 0.25): void {
    if (!this.scene?.sound) return;
    if (this.ambient) {
      this.ambient.stop();
      this.ambient.destroy();
    }
    if (!this.scene.cache.audio.exists(key)) {
      logger.debug(`Ambient "${key}" missing — skipping (placeholder).`);
      return;
    }
    this.ambient = this.scene.sound.add(key, { loop: true, volume });
    this.ambient.play();
  }

  /** Play a one-shot SFX. Missing asset = silent no-op. */
  play(key: string, volume = 0.6): void {
    if (!this.scene?.sound || this.muted) return;
    if (!this.scene.cache.audio.exists(key)) {
      logger.debug(`SFX "${key}" missing — skipping (placeholder).`);
      return;
    }
    try {
      this.scene.sound.play(key, { volume });
    } catch (err) {
      logger.error(`Failed to play "${key}"`, err);
    }
  }

  stopAmbient(): void {
    if (this.ambient) {
      this.ambient.stop();
      this.ambient.destroy();
      this.ambient = null;
    }
  }
}

export const audioManager = new AudioManager();
