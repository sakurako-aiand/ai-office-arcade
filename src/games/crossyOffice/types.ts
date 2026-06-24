/**
 * Crossy Office — type definitions.
 *
 * Framework-agnostic types shared by the board, projector, and views. Keeping
 * them out of Phaser lets the track model be reasoned about (and later tested)
 * without a renderer.
 */

/** What a given row of the track contains. */
export type RowType = 'start' | 'floor' | 'road' | 'goal';

/** A single track row's definition. Road rows carry spawn parameters. */
export interface RowDef {
  index: number;
  type: RowType;
  /** Horizontal travel direction of obstacles on this road row (+1 right, -1 left). */
  dir: 1 | -1;
  /** Obstacle speed in cells/second (0 for non-road rows). */
  speed: number;
  /** Time between spawns (ms). */
  spawnEvery: number;
  /** Timestamp (ms) of the next scheduled spawn. */
  nextSpawnAt: number;
}

/** Obstacle cosmetics + dimensions. */
export type ObstacleType = 'car' | 'cart' | 'roomba';

/** Movement direction intent from input. */
export type MoveDir = 'up' | 'down' | 'left' | 'right';
