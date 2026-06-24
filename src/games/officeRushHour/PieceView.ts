/**
 * PieceView — Phaser representation of a single puzzle piece.
 *
 * A Container holding a tinted body rectangle + a kind label. The body is the
 * interactive hit target; the board owns the actual drag logic (pointer move/up
 * are scene-level so the pointer can leave the body mid-drag).
 *
 * Placeholder visuals: colored rectangles per office "kind". When real sprites
 * are added (see levels.ts TODO), swap the Rectangle for an Image here — the
 * board only depends on `setCellPosition` / `setSelected` / `flashInvalid`.
 *
 * NOTE: the field is named `bodyRect` (not `body`) because `body` collides
 * with Phaser's physics-body property on GameObject and breaks assignability.
 */
import Phaser from 'phaser';
import type { Orientation, PieceKind } from './puzzleTypes';

/** Office palette for placeholder pieces. */
const KIND_COLORS: Record<PieceKind, number> = {
  employee: 0x22c55e, // bright green — the exit piece pops
  desk: 0x92744a, // wood brown
  cabinet: 0x6b7785, // steel gray
  printer: 0x6366f1, // indigo
  plant: 0x16a34a, // leafy green
};

const KIND_LABELS: Record<PieceKind, string> = {
  employee: 'EMPLOYEE',
  desk: 'DESK',
  cabinet: 'CABINET',
  printer: 'PRINTER',
  plant: 'PLANT',
};

export interface PieceViewOptions {
  pieceId: string;
  orient: Orientation;
  kind: PieceKind;
  length: number;
  isExit: boolean;
  cellSize: number;
}

export class PieceView extends Phaser.GameObjects.Container {
  readonly pieceId: string;
  readonly orient: Orientation;
  readonly isExit: boolean;
  readonly bodyWidth: number;
  readonly bodyHeight: number;

  private bodyRect: Phaser.GameObjects.Rectangle;
  private selected = false;

  constructor(scene: Phaser.Scene, opts: PieceViewOptions) {
    super(scene, 0, 0);
    this.pieceId = opts.pieceId;
    this.orient = opts.orient;
    this.isExit = opts.isExit;

    // 8px gutter so adjacent pieces read as separate objects.
    this.bodyWidth = (opts.orient === 'H' ? opts.length : 1) * opts.cellSize - 8;
    this.bodyHeight = (opts.orient === 'H' ? 1 : opts.length) * opts.cellSize - 8;

    const color = KIND_COLORS[opts.kind];
    this.bodyRect = scene.add
      .rectangle(0, 0, this.bodyWidth, this.bodyHeight, color, 0.95)
      .setStrokeStyle(3, 0xffffff, 0.25);
    this.add(this.bodyRect);

    // Subtle top sheen for a "furniture" feel (placeholder).
    const sheen = scene.add
      .rectangle(0, -this.bodyHeight / 2 + 6, this.bodyWidth - 10, 4, 0xffffff, 0.35)
      .setVisible(opts.orient === 'V');
    this.add(sheen);

    const label = scene.add
      .text(0, 0, KIND_LABELS[opts.kind], {
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: '800',
      })
      .setOrigin(0.5);
    this.add(label);

    // The exit piece gets a small head marker so it reads as the "person".
    if (opts.isExit) {
      const head = scene.add.circle(0, -this.bodyHeight / 2 + 12, 5, 0xffffff);
      this.add(head);
    }

    scene.add.existing(this);

    // The body is the hit-test target for selection/drag. The board owns all
    // pointer logic at scene scope (so the pointer can leave the body mid-drag
    // without losing the gesture). Hand cursor gives a clear affordance.
    this.bodyRect.setInteractive({ useHandCursor: true });
  }

  /** Snap the view to a grid cell (top-left). */
  setCellPosition(col: number, row: number, gridLeft: number, gridTop: number, cellSize: number): void {
    const x = gridLeft + col * cellSize + cellSize / 2;
    const y = gridTop + row * cellSize + cellSize / 2;
    this.setPosition(x, y);
  }

  setSelected(selected: boolean): void {
    this.selected = selected;
    this.bodyRect.setStrokeStyle(selected ? 4 : 3, 0xffffff, selected ? 1 : 0.25);
    this.setScale(selected ? 1.04 : 1);
  }

  isSelected(): boolean {
    return this.selected;
  }

  /** Red flash for an invalid/blocked move attempt. */
  flashInvalid(): void {
    const original = this.bodyRect.fillColor;
    const proxy = { v: 0 };
    this.scene.tweens.add({
      targets: proxy,
      v: 1,
      duration: 220,
      yoyo: true,
      onUpdate: () => {
        const t = Math.sin(proxy.v * Math.PI);
        this.bodyRect.setFillStyle(this.mixColor(original, 0xef4444, t));
      },
      onComplete: () => this.bodyRect.setFillStyle(original),
    });
  }

  /** Disable input (called after the puzzle is resolved). */
  disableInput(): void {
    this.bodyRect.disableInteractive();
  }

  /** Re-enable input (used by RESET to make pieces draggable again). */
  enableInput(): void {
    this.bodyRect.setInteractive({ useHandCursor: true });
  }

  destroy(fromScene?: boolean): void {
    this.bodyRect.removeAllListeners();
    super.destroy(fromScene);
  }

  /** Linear RGB interpolation between two hex colors (0xRRGGBB). */
  private mixColor(a: number, b: number, t: number): number {
    const ar = (a >> 16) & 0xff;
    const ag = (a >> 8) & 0xff;
    const ab = a & 0xff;
    const br = (b >> 16) & 0xff;
    const bg = (b >> 8) & 0xff;
    const bb = b & 0xff;
    const r = Math.round(ar + (br - ar) * t);
    const g = Math.round(ag + (bg - ag) * t);
    const bl = Math.round(ab + (bb - ab) * t);
    return (r << 16) | (g << 8) | bl;
  }
}
