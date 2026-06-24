/**
 * Bit-Battle: Project Launch — tunable constants.
 *
 * All combat numbers live here so balancing is a one-file job. Designed so each
 * of the 3 levels resolves in well under 60s of wall-clock time, leaving headroom
 * under the loader's strict 3-minute timer.
 */
import { GAME_WIDTH, GAME_HEIGHT } from '../../config/constants';

export const BB_WIDTH = GAME_WIDTH;
export const BB_HEIGHT = GAME_HEIGHT;

/** Retro pixel grid the panels snap to (visual only; layout is grid-based). */
export const PIXEL = 4;

/** Party size + reserve pool shown on the class-select screen. */
export const MAX_PARTY = 3;
export const ROSTER_SIZE = 3;

/** Staggered action resolution delay (ms) so the log reads, but never locks long. */
export const STEP_MS = 420;
/** Fast-forward multiplier when the player holds the ACCELERATE button. */
export const FAST_STEP_MS = 140;

/** Retro palette — bold, limited, 8-bit feel over the office base. */
export const BB_COLORS = {
  bg: 0x0b1020,
  panel: 0x11193a,
  panelEdge: 0x3b4cca,
  panelEdgeDim: 0x1f2a5a,
  ink: 0xe8ecff,
  inkDim: 0x8a93c8,
  hpBack: 0x241a2e,
  hp: 0x35d07a,
  hpMid: 0xe2b53a,
  hpLow: 0xe23a3a,
  spBack: 0x14203a,
  sp: 0x3aa0e2,
  select: 0xffd23a,
  enemy: 0xe23a3a,
  boss: 0xb23ae2,
  btn: 0x1f2a5a,
  btnEdge: 0x3b4cca,
  btnHover: 0x2b3a8a,
  logBg: 0x0a0f24,
  accent: 0x3b4cca,
  good: 0x35d07a,
  bad: 0xe23a3a,
  warn: 0xe2b53a,
} as const;

/** Layout anchors (computed from the 1280x720 logical canvas). */
export const LAYOUT = {
  enemyPanelY: 96,
  enemyPanelH: 150,
  partyPanelY: BB_HEIGHT - 230,
  partyPanelH: 150,
  logY: BB_HEIGHT - 76,
  logH: 64,
  menuX: BB_WIDTH - 320,
  menuY: BB_HEIGHT - 230,
  menuW: 300,
  menuH: 150,
  progressX: 16,
  progressY: 70,
  progressW: 240,
} as const;

export const FONT_RPG = '"Press Start 2P", monospace';
export const FONT_UI = 'Inter, sans-serif';
