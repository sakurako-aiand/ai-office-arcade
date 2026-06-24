/**
 * ObjectPool — generic, leak-safe object pooling.
 *
 * Arcade games create/destroy many short-lived objects (projectiles, particles,
 * floating text). Doing that with `add()`/`destroy()` thrashes the GC and can
 * stall a 60 FPS budget. This pool reuses instances instead.
 *
 * It is framework-agnostic: pass any factory that returns an object with a
 * custom `reset()` and (optional) `release()`/`destroy()` method.
 *
 * Usage:
 *   const pool = new ObjectPool(() => scene.add.rectangle(0,0,8,8,0xff0000));
 *   const b = pool.obtain(); b.setPosition(x,y); b.setActive(true).setVisible(true);
 *   pool.release(b); // returned for reuse, hidden + deactivated
 */
import { logger } from '../utils/logger';

export interface Poolable {
  setActive(active: boolean): this;
  setVisible(visible: boolean): this;
  /** Optional cleanup hook called when the pool is destroyed. */
  destroy?: () => void;
}

export class ObjectPool<T extends Poolable> {
  private free: T[] = [];
  private inUse = new Set<T>();
  private factory: () => T;

  /** @param factory creates a fresh, hidden, inactive object. */
  constructor(factory: () => T, prewarm = 0) {
    this.factory = factory;
    for (let i = 0; i < prewarm; i++) {
      const obj = factory();
      obj.setActive(false).setVisible(false);
      this.free.push(obj);
    }
  }

  /** Get an object from the pool (creates one if the pool is empty). */
  obtain(): T {
    let obj = this.free.pop();
    if (!obj) obj = this.factory();
    obj.setActive(true).setVisible(true);
    this.inUse.add(obj);
    return obj;
  }

  /** Return an object to the pool for later reuse. */
  release(obj: T): void {
    if (!this.inUse.has(obj)) return; // already released
    this.inUse.delete(obj);
    obj.setActive(false).setVisible(false);
    this.free.push(obj);
  }

  /** Release every currently-active object (e.g. on scene shutdown). */
  releaseAll(): void {
    for (const obj of Array.from(this.inUse)) this.release(obj);
  }

  /** Destroy the pool and every object it ever created (scene teardown). */
  destroy(): void {
    this.releaseAll();
    for (const obj of this.free) obj.destroy?.();
    this.free = [];
    logger.debug('ObjectPool destroyed.');
  }

  get activeCount(): number {
    return this.inUse.size;
  }
}
