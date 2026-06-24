/**
 * PuzzleModel — pure, framework-agnostic sliding-puzzle logic.
 *
 * Owns the board grid and all movement rules. No Phaser dependency, so it can
 * be unit-tested in isolation and reused by any renderer.
 *
 * Movement rules (classic Rush Hour):
 *   - A piece slides ONLY along its own orientation (H: ±col, V: ±row).
 *   - A piece cannot rotate, jump, or leave the grid (except the exit piece
 *     leaving through its exit row).
 *   - A move is valid iff every cell the piece would sweep through (the cells
 *     ahead of it up to the new position) is empty or the piece itself.
 *
 * Because pieces are rigid and contiguous, checking each incremental step
 * sequentially (1 cell, then 2, then 3...) and stopping at the first blocked step
 * is both necessary and sufficient — there is no "jumping over" an obstacle.
 */
import type { LevelDef, PieceDef, AxisDir } from './puzzleTypes';

export class PuzzleModel {
  readonly cols: number;
  readonly rows: number;
  readonly exitRow: number;

  /** Live piece positions (mutated on every move). Cloned from the level. */
  pieces: PieceDef[];

  /** grid[col][row] -> piece id | null. Rebuilt is cheap (6x6). */
  private grid: (string | null)[][];

  /** True once the exit piece has been pushed out through the exit. */
  private won = false;

  constructor(level: LevelDef) {
    this.cols = level.cols;
    this.rows = level.rows;
    this.exitRow = level.exitRow;
    this.pieces = level.pieces.map((p) => ({ ...p }));
    this.grid = this.buildGrid(this.pieces);
  }

  /** The designated exit piece (the "employee"). */
  get exitPiece(): PieceDef | undefined {
    return this.pieces.find((p) => p.isExit);
  }

  /** Cells occupied by a piece, in order. */
  cellsOf(p: PieceDef): Array<[number, number]> {
    const out: Array<[number, number]> = [];
    for (let i = 0; i < p.length; i++) {
      out.push(p.orient === 'H' ? [p.col + i, p.row] : [p.col, p.row + i]);
    }
    return out;
  }

  /** Find a piece by id. */
  piece(id: string): PieceDef | undefined {
    return this.pieces.find((p) => p.id === id);
  }

  /** Has the exit piece already left the building? */
  isWon(): boolean {
    return this.won;
  }

  /**
   * Max number of whole cells the piece can shift in `dir` without leaving the
   * grid. Stops at the first blocked step (see class doc). 0 means immobile.
   */
  maxShift(id: string, dir: AxisDir): number {
    const p = this.piece(id);
    if (!p) return 0;
    let k = 0;
    while (this.canShiftTo(p, dir * (k + 1))) k++;
    return k;
  }

  /**
   * Can the exit piece leave through the exit right now?
   * Requires: horizontal, on the exit row, and flush against the right edge.
   */
  canExit(): boolean {
    const p = this.exitPiece;
    if (!p || p.orient !== 'H') return false;
    return p.row === this.exitRow && p.col + p.length - 1 === this.cols - 1;
  }

  /**
   * Apply a move of `delta` cells along the piece's axis (signed). Returns the
   * number of cells actually moved (0 if blocked / no-op / already won).
   * Multi-cell drags count as a single move: the piece slides as far as it can
   * up to `|delta|`, stopping at the first obstacle.
   */
  move(id: string, delta: number): number {
    if (this.won || delta === 0) return 0;
    const p = this.piece(id);
    if (!p) return 0;
    const dir = Math.sign(delta);
    if (dir === 0) return 0;
    const target = Math.abs(delta);

    let applied = 0;
    for (let k = 1; k <= target; k++) {
      if (this.canShiftTo(p, dir * k)) applied = dir * k;
      else break; // first obstacle stops the slide
    }
    if (applied !== 0) this.applyShift(p, applied);
    return applied;
  }

  /** Push the exit piece out through the exit. Returns false if not allowed. */
  exit(): boolean {
    if (this.won || !this.canExit()) return false;
    this.won = true;
    return true;
  }

  // ---- internals --------------------------------------------------------

  private buildGrid(pieces: PieceDef[]): (string | null)[][] {
    const g: (string | null)[][] = Array.from({ length: this.cols }, () =>
      Array<string | null>(this.rows).fill(null)
    );
    for (const p of pieces) {
      for (const [c, r] of this.cellsOf(p)) g[c][r] = p.id;
    }
    return g;
  }

  private inBounds(c: number, r: number): boolean {
    return c >= 0 && c < this.cols && r >= 0 && r < this.rows;
  }

  /**
   * True iff the piece can occupy its position shifted by `delta` along its
   * axis, assuming nothing else moves. Checks every destination cell: must be
   * in-bounds and either empty or the piece's own current cell.
   *
   * Used incrementally by maxShift()/move() so the sequential "stop at first
   * obstacle" guarantee holds (see class doc).
   */
  private canShiftTo(p: PieceDef, delta: number): boolean {
    for (let i = 0; i < p.length; i++) {
      // Horizontal pieces vary along cols (row fixed); vertical along rows (col fixed).
      const c = p.orient === 'H' ? p.col + delta + i : p.col;
      const r = p.orient === 'H' ? p.row : p.row + delta + i;
      if (!this.inBounds(c, r)) return false;
      const occ = this.grid[c][r];
      if (occ !== null && occ !== p.id) return false;
    }
    return true;
  }

  private applyShift(p: PieceDef, delta: number): void {
    // Vacate old cells, advance, occupy new cells.
    for (const [c, r] of this.cellsOf(p)) this.grid[c][r] = null;
    if (p.orient === 'H') p.col += delta;
    else p.row += delta;
    for (const [c, r] of this.cellsOf(p)) this.grid[c][r] = p.id;
  }
}
