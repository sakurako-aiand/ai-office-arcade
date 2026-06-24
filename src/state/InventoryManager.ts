/**
 * InventoryManager — tracks collected claw-machine balls by rarity tier.
 *
 * Inventory shape:
 *   { common: { [ballId]: count }, rare: {...}, legendary: {...} }
 *
 * Counts are unbounded; tiers drive future collection screens / achievements.
 */
import { STORAGE_KEYS, BALL_DROP_TABLE, type BallDrop } from '../config/constants';
import { saveManager } from './SaveManager';
import { logger } from '../utils/logger';

export type Rarity = BallDrop['rarity'];

export interface InventorySnapshot {
  common: Record<string, number>;
  rare: Record<string, number>;
  legendary: Record<string, number>;
}

function emptyInventory(): InventorySnapshot {
  return { common: {}, rare: {}, legendary: {} };
}

class InventoryManager {
  private inventory: InventorySnapshot;

  constructor() {
    this.inventory = this.load();
    logger.info('InventoryManager ready.', this.inventory);
  }

  private load(): InventorySnapshot {
    const data = saveManager.read<InventorySnapshot>(STORAGE_KEYS.inventory, emptyInventory());
    // Defensive normalization in case of hand-edited / corrupt saves.
    const inv = emptyInventory();
    (['common', 'rare', 'legendary'] as Rarity[]).forEach((tier) => {
      const bucket = data?.[tier];
      if (bucket && typeof bucket === 'object') {
        for (const [id, count] of Object.entries(bucket)) {
          const n = Number(count);
          if (Number.isFinite(n) && n > 0) inv[tier][id] = Math.floor(n);
        }
      }
    });
    return inv;
  }

  private persist(): void {
    saveManager.write(STORAGE_KEYS.inventory, this.inventory);
  }

  getSnapshot(): InventorySnapshot {
    // Return a shallow clone so callers can't mutate internal state.
    return {
      common: { ...this.inventory.common },
      rare: { ...this.inventory.rare },
      legendary: { ...this.inventory.legendary },
    };
  }

  /** Resolve the rarity of a ball id (from the drop table). */
  private rarityOf(ballId: string): Rarity | null {
    const def = BALL_DROP_TABLE.find((b) => b.id === ballId);
    return def ? def.rarity : null;
  }

  /** Add one of a ball to the inventory. Returns the new count for that ball. */
  collect(ballId: string): number {
    const rarity = this.rarityOf(ballId);
    if (!rarity) {
      logger.warn(`collect() unknown ball id "${ballId}"`);
      return 0;
    }
    const bucket = this.inventory[rarity];
    bucket[ballId] = (bucket[ballId] ?? 0) + 1;
    this.persist();
    logger.debug(`Collected ${ballId} (${rarity}) -> ${bucket[ballId]}`);
    return bucket[ballId];
  }

  /** Total number of balls owned across all tiers. */
  totalCollected(): number {
    return (
      this.sumTier('common') + this.sumTier('rare') + this.sumTier('legendary')
    );
  }

  /** Count of a single ball id (0 if none). */
  count(ballId: string): number {
    const rarity = this.rarityOf(ballId);
    if (!rarity) return 0;
    return this.inventory[rarity][ballId] ?? 0;
  }

  private sumTier(tier: Rarity): number {
    return Object.values(this.inventory[tier]).reduce((a, b) => a + b, 0);
  }

  reset(): void {
    this.inventory = emptyInventory();
    this.persist();
  }
}

export const inventoryManager = new InventoryManager();
