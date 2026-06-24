/**
 * project — the pseudo-3D (2.5D) world->screen projector.
 *
 * The whole game is a flat grid in world space (col, row). This function maps a
 * world cell to screen space with perspective foreshortening:
 *   - rows farther from the camera (larger `row - cameraRow`) are drawn higher
 *     on screen and smaller,
 *   - the track narrows toward a vanishing point,
 *   - objects scale down with distance.
 *
 * This projector IS the camera: "camera follow" = smoothly increasing
 * `cameraRow` toward the player's row, which scrolls the whole world. No Phaser
 * camera scroll is used, so the HUD (timer / coin counter) stays fixed.
 *
 * Works with fractional col/row so obstacles can move smoothly and lane strips
 * can be drawn between half-rows.
 */
import {
  COLS,
  VISIBLE_ROWS,
  NEAR_Y,
  FAR_Y,
  NEAR_WIDTH,
  FAR_WIDTH,
  FAR_SCALE,
  SCREEN_CENTER_X,
} from './config';

export interface Projected {
  x: number;
  y: number;
  scale: number;
}

/** Clamp helper local to projection (rows far behind/ahead collapse to edges). */
function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/**
 * @param col       world column (may be fractional; -0.5 = left edge of lane 0)
 * @param row       world row (may be fractional; used for lane strips + hops)
 * @param cameraRow the virtual camera's near-edge row
 */
export function project(col: number, row: number, cameraRow: number): Projected {
  const rel = row - cameraRow;
  // Normalized depth: 0 at the near edge, 1 at the far edge of the view.
  const t = clamp01(rel / VISIBLE_ROWS);
  const y = NEAR_Y - (NEAR_Y - FAR_Y) * t;
  const width = NEAR_WIDTH - (NEAR_WIDTH - FAR_WIDTH) * t;
  const scale = 1 - (1 - FAR_SCALE) * t;
  const cellW = width / COLS;
  // Center the track, then offset by the column.
  const x = SCREEN_CENTER_X - width / 2 + (col + 0.5) * cellW;
  return { x, y, scale };
}
