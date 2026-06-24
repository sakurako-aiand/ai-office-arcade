/**
 * GameState — the single source of truth for the player's persistent economy.
 *
 * It is a tiny reactive store built on Phaser's EventEmitter so any scene / UI
 * widget can subscribe to changes (`coins:changed`, `inventory:changed`) without
 * polling. All mutations are funneled here:
 *
 *   win  -> awardCoins(reward)
 *   lose -> (no coins; state reset handled by SceneManager)
 *   shop -> spendCoins(cost) then collectBall(id)
 *
 * Coin + inventory persistence is delegated to CoinManager / InventoryManager,
 * which persist via SaveManager (localStorage). Keeping GameState as the only
 * public surface means future devs touch one API, not three.
 */
import Phaser from 'phaser';
import { coinManager } from './CoinManager';
import { inventoryManager, type InventorySnapshot } from './InventoryManager';
import { logger } from '../utils/logger';
import type { Difficulty } from '../config/constants';
import { DIFFICULTY_REWARD } from '../config/constants';

/** Events emitted by the store. */
export const GameStateEvents = {
  CoinsChanged: 'coins:changed',
  InventoryChanged: 'inventory:changed',
} as const;

class GameState extends Phaser.Events.EventEmitter {
  /** The mini-game the player is currently inside (null while in the hub). */
  private activeDifficulty: Difficulty | null = null;

  /** True once a mini-game has resolved (win/lose/time-up) to prevent double pay. */
  private resolved = false;

  constructor() {
    super();
    logger.info('GameState ready.');
  }

  // ---- coins -------------------------------------------------------------
  getCoins(): number {
    return coinManager.get();
  }

  /** Award the fixed reward for a difficulty (called by MiniGameLoader on win). */
  awardCoinsForDifficulty(difficulty: Difficulty): number {
    const reward = DIFFICULTY_REWARD[difficulty];
    return this.awardCoins(reward);
  }

  awardCoins(amount: number): number {
    const next = coinManager.add(amount);
    this.emit(GameStateEvents.CoinsChanged, next);
    return next;
  }

  /** Attempt to spend coins. Emits only on success. */
  spendCoins(amount: number): boolean {
    const ok = coinManager.spend(amount);
    if (ok) this.emit(GameStateEvents.CoinsChanged, coinManager.get());
    return ok;
  }

  // ---- inventory ---------------------------------------------------------
  getInventory(): InventorySnapshot {
    return inventoryManager.getSnapshot();
  }

  collectBall(ballId: string): void {
    inventoryManager.collect(ballId);
    this.emit(GameStateEvents.InventoryChanged, this.getInventory());
  }

  // ---- mini-game lifecycle (resets between runs) ------------------------
  beginMiniGame(difficulty: Difficulty): void {
    this.activeDifficulty = difficulty;
    this.resolved = false;
    logger.info(`Mini-game started: ${difficulty}`);
  }

  getActiveDifficulty(): Difficulty | null {
    return this.activeDifficulty;
  }

  /** Mark the active run as resolved so rewards can't be paid twice. */
  markResolved(): boolean {
    if (this.resolved) return false;
    this.resolved = true;
    return true;
  }

  /** Reset transient run state (called when returning to the hub). */
  resetRunState(): void {
    this.activeDifficulty = null;
    this.resolved = false;
  }

  /** Wipe everything (future "reset progress" UI). */
  resetAll(): void {
    coinManager.reset();
    inventoryManager.reset();
    this.resetRunState();
    this.emit(GameStateEvents.CoinsChanged, this.getCoins());
    this.emit(GameStateEvents.InventoryChanged, this.getInventory());
  }
}

/** Global singleton — import this everywhere, never `new GameState()`. */
export const gameState = new GameState();
