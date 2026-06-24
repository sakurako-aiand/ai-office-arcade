/**
 * SaveManager — thin, defensive localStorage wrapper.
 *
 * Handles the messy parts of persistence so the rest of the codebase never
 * touches storage directly:
 *   - JSON (de)serialization
 *   - quota / privacy-mode / disabled-storage errors (caught + logged)
 *   - safe defaults when reads fail or data is corrupt
 *   - a central registry so keys aren't scattered as magic strings
 *
 * If localStorage is entirely unavailable, the game keeps running with
 * in-memory state that simply won't survive a refresh.
 */
import { STORAGE_KEYS } from '../config/constants';
import { logger } from '../utils/logger';

type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

class SaveManager {
  private memoryFallback = new Map<string, string>();
  /** True when the browser storage is usable (writable + readable). */
  readonly available: boolean;

  constructor() {
    this.available = this.detectAvailability();
    if (!this.available) {
      logger.warn('localStorage unavailable — running in memory-only mode.');
    }
  }

  private detectAvailability(): boolean {
    try {
      const test = '__ai_arcade_storage_test__';
      window.localStorage.setItem(test, '1');
      window.localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  /** Read + JSON.parse with corruption tolerance. */
  read<T>(key: StorageKey, fallback: T): T {
    try {
      const raw = this.available
        ? window.localStorage.getItem(key)
        : this.memoryFallback.get(key) ?? null;
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch (err) {
      logger.error(`SaveManager.read failed for "${key}"`, err);
      return fallback;
    }
  }

  /** JSON.stringify + write with quota tolerance. */
  write<T>(key: StorageKey, value: T): boolean {
    try {
      const raw = JSON.stringify(value);
      if (this.available) {
        window.localStorage.setItem(key, raw);
      } else {
        this.memoryFallback.set(key, raw);
      }
      return true;
    } catch (err) {
      // QuotaExceededError, SecurityError, etc. — never crash the game.
      logger.error(`SaveManager.write failed for "${key}"`, err);
      return false;
    }
  }

  /** Remove a single key. */
  remove(key: StorageKey): void {
    try {
      if (this.available) window.localStorage.removeItem(key);
      else this.memoryFallback.delete(key);
    } catch (err) {
      logger.error(`SaveManager.remove failed for "${key}"`, err);
    }
  }

  /** Wipe all ai& Office Arcade data (used by a future "reset progress" UI). */
  clearAll(): void {
    (Object.values(STORAGE_KEYS) as StorageKey[]).forEach((k) => this.remove(k));
    logger.info('All ai& Office Arcade save data cleared.');
  }
}

export const saveManager = new SaveManager();
