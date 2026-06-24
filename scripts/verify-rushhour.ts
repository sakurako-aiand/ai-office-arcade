/**
 * Standalone sanity check for the Office Rush Hour model + level 1.
 * Verifies the documented solution actually reaches the exit, and that an
 * invalid (blocked) move is rejected. Run: npx tsx scripts/verify-rushhour.ts
 */
import { PuzzleModel } from '../src/games/officeRushHour/PuzzleModel';
import { LEVELS } from '../src/games/officeRushHour/levels';

const model = new PuzzleModel(LEVELS[0]);
const exitId = model.exitPiece!.id;

function shift(id: string, dir: -1 | 1, expectCells: number) {
  const applied = model.move(id, dir * expectCells);
  if (applied !== dir * expectCells) {
    throw new Error(`Move ${id} by ${dir * expectCells} failed (applied ${applied})`);
  }
  return applied;
}

// 1. He right x2  -> frees (2,4) & (3,4)
shift('He', 1, 2);
if (model.canExit()) throw new Error('canExit should be false before path cleared');

// 2. Vc down x1 -> frees (3,2)
shift('Vc', 1, 1);
// 3. Vb down x1 -> frees (2,2)
shift('Vb', 1, 1);
// 4. Vd up x2 -> frees (5,2)
shift('Vd', -1, 2);

// Sanity: the exit row to the right of P must now be clear, so P can reach edge.
const fwd = model.maxShift(exitId, 1);
if (fwd < 3) throw new Error(`Exit piece should be able to slide to edge, maxShift=${fwd}`);

// 5. P right to the rightmost cell.
shift(exitId, 1, fwd);
if (!model.canExit()) throw new Error('canExit should be true at rightmost');

// Push out.
const exited = model.exit();
if (!exited) throw new Error('exit() returned false at the exit');
if (!model.isWon()) throw new Error('isWon() should be true');

// Negative test: a blocked move must apply 0.
const m2 = new PuzzleModel(LEVELS[0]);
const blocked = m2.move('Vb', 1, 1); // Vb wants down but He blocks (2,4)
if (blocked !== 0) throw new Error(`Vb should be blocked downward initially (got ${blocked})`);

console.log('OK: Office Rush Hour level 1 is solvable; win path verified; blocked moves rejected.');
