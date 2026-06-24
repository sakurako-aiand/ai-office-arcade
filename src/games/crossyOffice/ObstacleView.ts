/**
 * ObstacleView — pooled, configurable obstacle sprite.
 *
 * One class represents cars, delivery carts, and roombas; `configure()` swaps
 * the tint + width so a single pool serves all obstacle types (no per-type
 * allocation churn). The board moves it by updating its logical (col,row) state
 * and re-projecting each frame.
 *
 * NOTE: the field is `bodyRect` (not `body`) to avoid clashing with Phaser's
 * physics-body property on GameObject (same fix as PieceView in Rush Hour).
 *
 * Carries its own motion state so the pool can hand out a view and the board
 * can read/write its row/col/dir/speed directly.
 */
import Phaser from 'phaser';
import type { ObstacleType } from './types';
import { NEAR_CELL, CROSSY_COLORS } from './config';

interface ObstacleMeta {
  length: number;
  color: number;
  label: string;
}

const OBSTACLE_META: Record<ObstacleType, ObstacleMeta> = {
  car: { length: 2, color: CROSSY_COLORS.car, label: 'CAR' },
  cart: { length: 2, color: CROSSY_COLORS.cart, label: 'CART' },
  roomba: { length: 1, color: CROSSY_COLORS.roomba, label: 'ROOMBA' },
};

export class ObstacleView extends Phaser.GameObjects.Container {
  private bodyRect: Phaser.GameObjects.Rectangle;
  private label: Phaser.GameObjects.Text;

  // Live motion state (mutated by the board each frame).
  row = 0;
  col = 0;
  dir: 1 | -1 = 1;
  speed = 0;
  length = 1;
  type: ObstacleType = 'car';

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    // Authored at near-scale; the board applies perspective scale each frame.
    this.bodyRect = scene.add
      .rectangle(0, 0, NEAR_CELL * 2 * 0.92, NEAR_CELL * 0.6, 0xffffff, 1)
      .setStrokeStyle(2, 0x000000, 0.3);
    this.add(this.bodyRect);
    this.label = scene.add
      .text(0, 0, '', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: '800',
      })
      .setOrigin(0.5);
    this.add(this.label);
    // Start hidden; the pool reveals on obtain.
    this.setVisible(false).setActive(false);
  }

  /** Re-skin + resize for a new obstacle type (called on spawn from the pool). */
  configure(type: ObstacleType, row: number, col: number, dir: 1 | -1, speed: number): void {
    const meta = OBSTACLE_META[type];
    this.type = type;
    this.length = meta.length;
    this.row = row;
    this.col = col;
    this.dir = dir;
    this.speed = speed;
    this.bodyRect.setFillStyle(meta.color, 1);
    this.bodyRect.width = NEAR_CELL * meta.length * 0.92;
    this.label.setText(meta.label);
  }
}
