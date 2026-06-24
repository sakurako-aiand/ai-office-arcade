/**
 * Crossy Office — tunable constants.
 *
 * All gameplay numbers live here so balancing is a one-file job. The game is a
 * pseudo-3D ("2.5D") runner: the world is a grid of rows (forward distance)
 * and columns (lanes). A single projector (see projector.ts) maps (col,row) to
 * screen space with perspective foreshortening, so far rows look smaller and
 * higher — that IS the "camera", no Phaser camera scroll needed.
 */
import { GAME_WIDTH } from '../../config/constants';

/** Lane grid (columns). Odd so there's a center column. */
export const COLS = 9;
export const CENTER_COL = (COLS - 1) / 2;

/** Total rows from Parking Lot (0) to Server Room (goal). */
export const TRACK_ROWS = 30;
export const GOAL_ROW = TRACK_ROWS - 1;

/** How many rows are rendered ahead of the virtual camera. */
export const VISIBLE_ROWS = 9;
/** Player is kept this many rows above the near edge (lower third of screen). */
export const CAMERA_LEAD = 2;

// ---- perspective projection (screen space) -----------------------------
export const NEAR_Y = 640; // bottom of playfield (near camera)
export const FAR_Y = 150; // top of playfield (far)
export const NEAR_WIDTH = 820; // track width at the near row
export const FAR_WIDTH = 360; // track width at the far row
export const FAR_SCALE = 0.5; // objects at the far row scale to 50%
export const NEAR_CELL = NEAR_WIDTH / COLS; // ~91px per lane at the near row

// ---- movement ----------------------------------------------------------
export const HOP_MS = 150; // duration of one grid hop
export const HOP_LIFT_PX = 26; // arc height of a hop (visual only)
export const INPUT_BUFFER_MS = 130; // late input still registers on landing

// ---- obstacles ---------------------------------------------------------
export const MIN_SPEED = 2.0; // cells / second
export const MAX_SPEED = 4.2;
export const SPAWN_MIN_MS = 850;
export const SPAWN_MAX_MS = 2000;
export const MAX_OBSTACLES = 48;

// ---- collision tolerances (cell units) ---------------------------------
export const PLAYER_HALF = 0.36; // player half-width in lane units
export const ROW_TOL = 0.5; // rows overlap tolerance (hop fairness)

// ---- collectibles ------------------------------------------------------
export const COFFEE_SPAWN_MS = 4500;
export const MAX_COFFEES = 6;

/** Office-themed palette for placeholder shapes. */
export const CROSSY_COLORS = {
  floor: 0x16263a,
  floorAlt: 0x18304b,
  road: 0x0c1422,
  roadEdge: 0x1b2a3d,
  laneLine: 0xf2c14e,
  start: 0x1f6feb, // Parking Lot
  goal: 0x22c55e, // Server Room
  player: 0x1f6feb,
  playerEdge: 0xbfe3ff,
  car: 0xef4444,
  cart: 0xf59e0b,
  roomba: 0xa855f7,
  coffee: 0x92400e,
  coffeeTop: 0xd4a373,
  grid: 0x1f3a55,
  invalid: 0xef4444,
} as const;

export const SCREEN_CENTER_X = GAME_WIDTH / 2;
