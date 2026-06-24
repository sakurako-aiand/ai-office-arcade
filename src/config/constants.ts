/**
 * Global tunables for ai& Office Arcade.
 *
 * Centralizing every gameplay number here keeps the rest of the codebase clean
 * and makes balancing a one-file job. All scenes/systems import from here.
 */

/** Logical game resolution (assets are authored against this; Phaser scales it). */
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

/** Brand palette — professional blues/grays + vibrant gameplay accents. */
export const COLORS = {
  // Brand / office
  navy: 0x0f1e2e,
  deepBlue: 0x16314a,
  blue: 0x1f6feb,
  blueSoft: 0x3b82f6,
  gray: 0xc7d2dc,
  grayDark: 0x6b7785,
  white: 0xffffff,

  // Platforms (difficulty)
  easy: 0x22c55e,
  medium: 0xf59e0b,
  hard: 0xef4444,

  // Economy
  coin: 0xfbbf24,
  coinEdge: 0xb45309,

  // Claw ball rarities
  common: 0x60a5fa,
  rare: 0xa855f7,
  legendary: 0xfacc15,

  // Feedback
  success: 0x22c55e,
  danger: 0xef4444,
} as const;

/** localStorage keys (namespaced to avoid collisions). */
export const STORAGE_KEYS = {
  coins: 'ai_office_arcade:coins',
  inventory: 'ai_office_arcade:inventory',
  settings: 'ai_office_arcade:settings',
} as const;

/** Mini-game timer (strict three minutes, in milliseconds). */
export const MINIGAME_TIME_MS = 3 * 60 * 1000;

/** Coin rewards awarded on a WIN (lose / time-up always award zero). */
export const REWARDS = {
  easy: 10,
  medium: 25,
  hard: 50,
} as const;

/** Cost to play the claw machine once. */
export const CLAW_COST = 5;

/**
 * Claw-machine drop table.
 * `weight` is relative; normalized at runtime. Rarity drives inventory tiering.
 */
export interface BallDrop {
  id: string;
  label: string;
  color: number;
  rarity: 'common' | 'rare' | 'legendary';
  weight: number;
}

export const BALL_DROP_TABLE: BallDrop[] = [
  { id: 'blue', label: 'Blue Ball', color: COLORS.common, rarity: 'common', weight: 50 },
  { id: 'green', label: 'Green Ball', color: 0x34d399, rarity: 'common', weight: 30 },
  { id: 'purple', label: 'Purple Ball', color: COLORS.rare, rarity: 'rare', weight: 15 },
  { id: 'pink', label: 'Pink Ball', color: 0xec4899, rarity: 'rare', weight: 4 },
  { id: 'gold', label: 'Gold Ball', color: COLORS.legendary, rarity: 'legendary', weight: 1 },
];

/** How many distinct ball slots the claw-machine inventory shows. */
export const CLAW_SLOTS = BALL_DROP_TABLE.length;

/** Transition timings (ms). */
export const TRANSITIONS = {
  fadeDuration: 450,
  scanDuration: 600,
} as const;

/** Difficulty identifiers (used as scene keys + platform labels). */
export type Difficulty = 'easy' | 'medium' | 'hard';

/** Scene keys — single source of truth for routing. */
export const SCENE_KEYS = {
  Boot: 'BootScene',
  Preload: 'PreloadScene',
  Hub: 'HubScene',
  Shop: 'ShopOverlay',
  EasyGame: 'EasyGameScene',
  MediumGame: 'MediumGameScene',
  HardGame: 'HardGameScene',
} as const;

/** Maps a difficulty to its mini-game scene key. */
export const DIFFICULTY_SCENE: Record<Difficulty, string> = {
  easy: SCENE_KEYS.EasyGame,
  medium: SCENE_KEYS.MediumGame,
  hard: SCENE_KEYS.HardGame,
};

/** Maps a difficulty to its coin reward. */
export const DIFFICULTY_REWARD: Record<Difficulty, number> = {
  easy: REWARDS.easy,
  medium: REWARDS.medium,
  hard: REWARDS.hard,
};

/** Asset texture keys generated procedurally at boot (no art files needed yet). */
export const TEXTURE_KEYS = {
  pixel: '__pixel',
  playerAvatar: '__player_avatar',
  platform: '__platform',
  coin: '__coin',
  ball: '__ball',
  claw: '__claw',
  logo: '__ai_logo',
} as const;
