/**
 * Office Rush Hour — type definitions.
 *
 * A Rush-Hour-style sliding puzzle reskinned with office furniture: each piece
 * (desk / cabinet / printer / employee) slides only along its own orientation
 * (horizontal pieces move left-right, vertical pieces move up-down). The
 * "employee" exit piece must reach the marked EXIT on the right edge.
 *
 * These types are framework-agnostic so the model stays unit-testable without
 * Phaser.
 */

/** Piece orientation: H slides along columns, V slides along rows. */
export type Orientation = 'H' | 'V';

/**
 * Visual kind of a piece. Purely cosmetic (drives color/label); the puzzle
 * logic only cares about orientation, length, and position.
 */
export type PieceKind = 'employee' | 'desk' | 'cabinet' | 'printer' | 'plant';

/** A single obstacle / exit piece on the board. (col,row) is its top-left cell. */
export interface PieceDef {
  id: string;
  orient: Orientation;
  length: number;
  col: number;
  row: number;
  kind: PieceKind;
  /** The designated piece that must reach the exit. */
  isExit?: boolean;
}

/** A complete puzzle layout. */
export interface LevelDef {
  name: string;
  cols: number;
  rows: number;
  /** Row index (0-based from top) where the EXIT sits on the right edge. */
  exitRow: number;
  pieces: PieceDef[];
}

/** Direction along a piece's axis: -1 = backward, +1 = forward. */
export type AxisDir = -1 | 1;
