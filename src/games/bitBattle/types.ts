/**
 * Bit-Battle — type definitions.
 *
 * Framework-agnostic types for the combat model. Keeping them free of Phaser
 * lets the model be reasoned about (and later unit-tested) without a renderer,
 * mirroring the PuzzleModel approach in Office Rush Hour.
 */

export type Role = 'engineer' | 'designer' | 'manager';
export type Side = 'party' | 'enemy';

/** A playable or enemy unit. */
export interface Unit {
  id: string;
  name: string;
  side: Side;
  role: Role | 'bug' | 'firewall' | 'boss';
  maxHp: number;
  hp: number;
  maxSp: number;
  sp: number;
  atk: number;
  def: number;
  /** True while defending (halves incoming damage until the unit's next turn). */
  guarding: boolean;
  /** Temporary attack buff (expires after one attack). */
  buffAtk: number;
  alive: boolean;
}

/** Party member skill signature. */
export type PartyAction = 'attack' | 'defend' | 'skill';

/** Result of resolving a single action (drives the battle log + UI). */
export interface ActionResult {
  actorId: string;
  actorName: string;
  verb: string;
  targetId?: string;
  targetName?: string;
  hpDelta?: number;
  spDelta?: number;
  buff?: string;
  defeated?: boolean;
  miss?: boolean;
  crit?: boolean;
}

export type LevelId = 1 | 2 | 3;
