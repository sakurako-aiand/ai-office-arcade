/**
 * Office Rush Hour — level definitions.
 *
 * Each level is verified solvable by hand. Layouts use a 6x6 grid with the EXIT
 * on the right edge at `exitRow`. The "employee" piece (P) is always the exit
 * piece and slides horizontally to the right.
 *
 * Legend (col,row), origin top-left:
 *   P  = employee (exit piece, H)
 *   H* = horizontal furniture (desk/printer/plant)
 *   V* = vertical furniture (cabinet)
 *
 * ---- Level 1: "Monday Morning" ----
 *       c0 c1 c2 c3 c4 c5
 *   r0   .  .  .  .  .  .
 *   r1   Ha Ha Hc Hc .  .
 *   r2   P  P  Vb Vc .  Vd   <- exit row; Vb,Vc,Vd block the path
 *   r3   .  .  Vb Vc .  Vd
 *   r4   .  .  He He .  .   <- He blocks Vb/Vc from sliding down
 *   r5   Hb Hb .  .  .  .
 *
 * Verified solution (~5 moves):
 *   1. He right x2  -> frees (2,4) & (3,4)
 *   2. Vc down  x1 -> frees (3,2)
 *   3. Vb down  x1 -> frees (2,2)
 *   4. Vd up    x2 -> frees (5,2)
 *   5. P  right to exit
 * Dependencies: Vb & Vc can only clear downward (their upward path is blocked
 * by Hc at row 1), and downward motion is blocked by He until He moves right.
 */
import type { LevelDef } from './puzzleTypes';

export const LEVELS: LevelDef[] = [
  {
    name: 'Monday Morning',
    cols: 6,
    rows: 6,
    exitRow: 2,
    pieces: [
      { id: 'P', orient: 'H', length: 2, col: 0, row: 2, kind: 'employee', isExit: true },
      { id: 'Ha', orient: 'H', length: 2, col: 0, row: 1, kind: 'desk' },
      { id: 'Hc', orient: 'H', length: 2, col: 2, row: 1, kind: 'printer' },
      { id: 'Vb', orient: 'V', length: 2, col: 2, row: 2, kind: 'cabinet' },
      { id: 'Vc', orient: 'V', length: 2, col: 3, row: 2, kind: 'cabinet' },
      { id: 'Vd', orient: 'V', length: 2, col: 5, row: 2, kind: 'cabinet' },
      { id: 'He', orient: 'H', length: 2, col: 2, row: 4, kind: 'desk' },
      { id: 'Hb', orient: 'H', length: 2, col: 0, row: 5, kind: 'plant' },
    ],
  },
  // TODO(difficulty scaling): add harder layouts here. Keep layouts verified
  // solvable and aim for ~8-15 moves for "medium" style puzzles. Consider a
  // `minMoves` field + a move-par star rating in the future.
  // TODO(assets): when real sprites exist, add a `spriteKey` per PieceKind and
  // swap the colored rectangles in PieceView for image frames.
];
