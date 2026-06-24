/**
 * CoinManager — owns the coin balance.
 *
 * All mutations go through here so persistence + event emission stay centralized.
 * GameState delegates coin operations to this class.
 */
import { STORAGE_KEYS } from '../config/constants';
import { saveManager } from './SaveManager';
import { logger } from '../utils/logger';

const MIN_COINS = 0;

class CoinManager {
  private balance: number;

  constructor() {
    this.balance = this.load();
    logger.info(`CoinManager ready. Balance = ${this.balance}`);
  }

  private load(): number {
    const v = saveManager.read<number>(STORAGE_KEYS.coins, 0);
    // Defend against corrupt/non-numeric saves.
    return Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
  }

  private persist(): void {
    saveManager.write(STORAGE_KEYS.coins, this.balance);
  }

  get(): number {
    return this.balance;
  }

  /** Add coins (win reward). Negative amounts are ignored. */
  add(amount: number): number {
    if (!Number.isFinite(amount) || amount <= 0) return this.balance;
    this.balance += Math.floor(amount);
    this.persist();
    logger.debug(`+${Math.floor(amount)} coins -> ${this.balance}`);
    return this.balance;
  }

  /**
   * Spend coins. Returns true on success, false if insufficient funds.
   * Only debits when the transaction can complete (atomic).
   */
  spend(amount: number): boolean {
    if (!Number.isFinite(amount) || amount <= 0) return false;
    const cost = Math.floor(amount);
    if (this.balance < cost) {
      logger.debug(`Spend rejected: need ${cost}, have ${this.balance}`);
      return false;
    }
    this.balance -= cost;
    this.persist();
    logger.debug(`-${cost} coins -> ${this.balance}`);
    return true;
  }

  /** Reset to zero (debug / future reset UI). */
  reset(): void {
    this.balance = MIN_COINS;
    this.persist();
  }
}

export const coinManager = new CoinManager();
