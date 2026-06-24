/**
 * CombatModel — pure, deterministic turn-based combat logic.
 *
 * No Phaser dependency. The controller drives a round-robin turn order; on each
 * party member's turn the controller passes a chosen action (and optional target)
 * and `resolvePartyAction` returns a result + applies HP/SP changes. Enemy turns
 * are decided by `chooseEnemyAction` (simple weighted AI) and resolved the same
 * way. All randomness goes through the injected `roll` function so a seeded RNG
 * can make a run fully reproducible (deterministic resolution requirement).
 *
 * Design notes:
 *   - Defending halves incoming damage until the unit's NEXT turn (not the round).
 *   - Buffs (e.g. Code Slash buff) expire after the next attack.
 *   - SP is the resource for skills; basic attack is free.
 *   - Overheal is clamped; SP never goes negative.
 */
import type { Unit, PartyAction, ActionResult, Role, LevelId } from './types';

export type Roll = () => number; // 0..1

/** Build the three selectable party members with tuned stats. */
export function makePartyRoster(): Unit[] {
  return [
    {
      id: 'engineer',
      name: 'ENGINEER',
      side: 'party',
      role: 'engineer',
      maxHp: 90,
      hp: 90,
      maxSp: 60,
      sp: 60,
      atk: 26,
      def: 8,
      guarding: false,
      buffAtk: 0,
      alive: true,
    },
    {
      id: 'designer',
      name: 'DESIGNER',
      side: 'party',
      role: 'designer',
      maxHp: 120,
      hp: 120,
      maxSp: 50,
      sp: 50,
      atk: 16,
      def: 20,
      guarding: false,
      buffAtk: 0,
      alive: true,
    },
    {
      id: 'manager',
      name: 'MANAGER',
      side: 'party',
      role: 'manager',
      maxHp: 100,
      hp: 100,
      maxSp: 80,
      sp: 80,
      atk: 12,
      def: 12,
      guarding: false,
      buffAtk: 0,
      alive: true,
    },
  ];
}

/** Enemy rosters for the three levels (Bug Swarm / Server Firewall / Boss). */
export function makeEnemies(level: LevelId): Unit[] {
  if (level === 1) {
    // Bug Swarm — many weak, low HP. Teach the player Attack is efficient here.
    return [
      mkEnemy('bug1', 'BUG-A', 'bug', 28, 8, 4),
      mkEnemy('bug2', 'BUG-B', 'bug', 28, 8, 4),
      mkEnemy('bug3', 'BUG-C', 'bug', 28, 8, 4),
    ];
  }
  if (level === 2) {
    // Server Firewall — tanky, high def. Skills/buffs matter here.
    return [
      mkEnemy('fw1', 'FIREWALL', 'firewall', 70, 18, 16),
      mkEnemy('fw2', 'PORT-443', 'firewall', 60, 14, 12),
    ];
  }
  // Level 3 — Boss Meeting. One big target + a minion.
  return [
    mkEnemy('boss', 'CEO-9000', 'boss', 220, 26, 14),
    mkEnemy('minion', 'SR-DEV', 'bug', 50, 14, 8),
  ];
}

function mkEnemy(
  id: string,
  name: string,
  role: Unit['role'],
  hp: number,
  atk: number,
  def: number
): Unit {
  return {
    id,
    name,
    side: 'enemy',
    role,
    maxHp: hp,
    hp,
    maxSp: 0,
    sp: 0,
    atk,
    def,
    guarding: false,
    buffAtk: 0,
    alive: true,
  };
}

/** Human-readable skill name per party role. */
export function skillName(role: Role): string {
  if (role === 'engineer') return 'CODE SLASH';
  if (role === 'designer') return 'AEGIS UI';
  return 'SPRINT MEETING';
}

/** SP cost per party role's skill. */
export function skillCost(role: Role): number {
  if (role === 'engineer') return 20;
  if (role === 'designer') return 15;
  return 25;
}

/** Resolve a party member's chosen action against a target. Returns a result. */
export function resolvePartyAction(
  actor: Unit,
  action: PartyAction,
  target: Unit | undefined,
  roll: Roll
): ActionResult {
  // Defending always works and is instant.
  if (action === 'defend') {
    actor.guarding = true;
    return { actorId: actor.id, actorName: actor.name, verb: 'guards', buff: 'DEF UP' };
  }

  // Skills consume SP (refund if somehow insufficient -> treat as basic attack).
  if (action === 'skill') {
    const cost = skillCost(actor.role as Role);
    if (actor.sp < cost) {
      return resolvePartyAction(actor, 'attack', target, roll);
    }
    actor.sp -= cost;
    return resolveSkill(actor, target, roll);
  }

  // Basic attack.
  return resolveAttack(actor, target, roll);
}

function resolveAttack(actor: Unit, target: Unit | undefined, roll: Roll): ActionResult {
  if (!target || !target.alive) {
    return { actorId: actor.id, actorName: actor.name, verb: 'attacks', miss: true };
  }
  const { dmg, crit } = computeDamage(actor, target, roll, 1.0);
  applyDamage(target, dmg);
  const result: ActionResult = {
    actorId: actor.id,
    actorName: actor.name,
    verb: crit ? 'CRITS' : 'attacks',
    targetId: target.id,
    targetName: target.name,
    hpDelta: -dmg,
    crit,
  };
  if (!target.alive) result.defeated = true;
  return result;
}

function resolveSkill(actor: Unit, target: Unit | undefined, roll: Roll): ActionResult {
  const role = actor.role as Role;
  const name = skillName(role);

  // Engineer — CODE SLASH: big single-target hit + self attack buff.
  if (role === 'engineer') {
    if (!target || !target.alive) {
      return { actorId: actor.id, actorName: actor.name, verb: name, miss: true };
    }
    const { dmg, crit } = computeDamage(actor, target, roll, 1.9);
    applyDamage(target, dmg);
    actor.buffAtk = Math.round(actor.atk * 0.4); // next attack +40%
    const result: ActionResult = {
      actorId: actor.id,
      actorName: actor.name,
      verb: crit ? name + '!!' : name,
      targetId: target.id,
      targetName: target.name,
      hpDelta: -dmg,
      buff: 'ATK UP',
      crit,
    };
    if (!target.alive) result.defeated = true;
    return result;
  }

  // Designer — AEGIS UI: party-wide guard (we model by guarding the actor + the
  // lowest-HP living ally). Returned for the log; the controller applies buffs.
  if (role === 'designer') {
    actor.guarding = true;
    actor.buffAtk = 0;
    return { actorId: actor.id, actorName: actor.name, verb: name, buff: 'PARTY GUARD' };
  }

  // Manager — SPRINT MEETING: heal lowest-HP ally + small SP regen to self.
  // The controller picks the heal target before calling; if none passed, heal self.
  const healTarget = target && target.alive ? target : actor;
  const heal = Math.round(healTarget.maxHp * 0.4);
  healTarget.hp = Math.min(healTarget.maxHp, healTarget.hp + heal);
  const spRegen = 8;
  actor.sp = Math.min(actor.maxSp, actor.sp + spRegen);
  return {
    actorId: actor.id,
    actorName: actor.name,
    verb: name,
    targetId: healTarget.id,
    targetName: healTarget.name,
    hpDelta: heal,
    spDelta: spRegen,
    buff: 'HEAL',
  };
}

/** Enemy AI: weighted choice of target + action. Deterministic given `roll`. */
export function chooseEnemyAction(
  actor: Unit,
  party: Unit[],
  roll: Roll
): { target: Unit; action: 'attack' | 'guard' } {
  const living = party.filter((u) => u.alive);
  // Prefer the lowest-HP target (focus fire) 60%, otherwise random.
  let target: Unit;
  if (roll() < 0.6) {
    target = [...living].sort((a, b) => a.hp - b.hp)[0];
  } else {
    target = living[Math.floor(roll() * living.length)];
  }
  // Bosses occasionally guard (25%); others always attack.
  const action: 'attack' | 'guard' = actor.role === 'boss' && roll() < 0.25 ? 'guard' : 'attack';
  return { target, action };
}

/** Resolve an enemy's turn against the chosen party target. */
export function resolveEnemyAction(
  actor: Unit,
  action: 'attack' | 'guard',
  target: Unit,
  roll: Roll
): ActionResult {
  if (action === 'guard') {
    actor.guarding = true;
    return { actorId: actor.id, actorName: actor.name, verb: 'hardens', buff: 'DEF UP' };
  }
  const { dmg, crit } = computeDamage(actor, target, roll, 1.0);
  applyDamage(target, dmg);
  const result: ActionResult = {
    actorId: actor.id,
    actorName: actor.name,
    verb: crit ? 'CRITS' : 'attacks',
    targetId: target.id,
    targetName: target.name,
    hpDelta: -dmg,
    crit,
  };
  if (!target.alive) result.defeated = true;
  return result;
}

/** Damage formula: atk*(1+buff) - def/2, with ±15% variance + 15% crit x1.6. */
function computeDamage(
  actor: Unit,
  target: Unit,
  roll: Roll,
  multiplier: number
): { dmg: number; crit: boolean } {
  const base = (actor.atk + actor.buffAtk) * multiplier - target.def / 2;
  const variance = 0.85 + roll() * 0.3; // 0.85..1.15
  const crit = roll() < 0.15;
  let dmg = Math.max(1, Math.round(base * variance));
  if (crit) dmg = Math.round(dmg * 1.6);
  // Guarding halves damage (applied last so it always helps).
  if (target.guarding) dmg = Math.max(1, Math.round(dmg / 2));
  return { dmg, crit };
}

function applyDamage(target: Unit, dmg: number): void {
  target.hp = Math.max(0, target.hp - dmg);
  if (target.hp <= 0) {
    target.alive = false;
    target.guarding = false;
  }
}

/**
 * Build the round-robin turn order: living party members first (in selection
 * order), then living enemies. Called fresh each round.
 */
export function buildTurnOrder(party: Unit[], enemies: Unit[]): Unit[] {
  return [...party.filter((u) => u.alive), ...enemies.filter((u) => u.alive)];
}

/** Clear one-time-per-turn flags (guarding, buffAtk) for a unit after it acts. */
export function endTurn(actor: Unit): void {
  // Guarding persists until the unit's NEXT turn; buff expires after an attack,
  // which already consumed it in resolveAttack/resolveSkill. Clear nothing here
  // beyond marking intent — the controller clears guarding when the unit's next
  // turn begins (see clearTurnFlags).
}

/** Clear guard/buff at the start of a unit's turn (called by the controller). */
export function clearTurnFlags(actor: Unit): void {
  actor.guarding = false;
  actor.buffAtk = 0;
}

/** Is the party wiped? */
export function partyWiped(party: Unit[]): boolean {
  return party.every((u) => !u.alive);
}

/** Are all enemies dead (level cleared)? */
export function enemiesCleared(enemies: Unit[]): boolean {
  return enemies.every((u) => !u.alive);
}
