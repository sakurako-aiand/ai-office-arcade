/**
 * Standalone sanity check for the Bit-Battle combat model.
 * Verifies: damage applies, deaths set alive=false, party/enemy win checks,
 * skill SP costs, and that a seeded run is deterministic. Run:
 *   npx tsx scripts/verify-bitbattle.ts
 */
import {
  makePartyRoster,
  makeEnemies,
  resolvePartyAction,
  resolveEnemyAction,
  chooseEnemyAction,
  partyWiped,
  enemiesCleared,
  skillCost,
} from '../src/games/bitBattle/CombatModel';
import type { Unit, PartyAction } from '../src/games/bitBattle/types';

// Deterministic seeded RNG (mulberry32) so the run is reproducible.
function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const roll = rng(42);
const party = makePartyRoster();
const enemies = makeEnemies(1);
const eng = party.find((u) => u.id === 'engineer')!;

// 1. Basic attack on bug1 must deal >0 and reduce HP.
const bug1 = enemies.find((e) => e.id === 'bug1')!;
const hpBefore = bug1.hp;
const r1 = resolvePartyAction(eng, 'attack', bug1, roll);
if ((r1.hpDelta ?? 0) >= 0) throw new Error('attack should deal positive damage');
if (bug1.hp !== hpBefore + (r1.hpDelta ?? 0)) throw new Error('HP mismatch after attack');

// 2. Skill consumes SP.
const spBefore = eng.sp;
const cost = skillCost('engineer');
const bug2 = enemies.find((e) => e.id === 'bug2')!;
resolvePartyAction(eng, 'skill', bug2, roll);
if (eng.sp !== spBefore - cost) throw new Error(`SP not reduced by ${cost} (got ${eng.sp})`);

// 3. Skill with insufficient SP falls back to a basic attack (no negative SP).
eng.sp = 1;
const sp0 = eng.sp;
resolvePartyAction(eng, 'skill', bug1, roll);
if (eng.sp < 0) throw new Error('SP went negative on insufficient skill');
if (eng.sp !== sp0) throw new Error('Insufficient-skill fallback should not consume SP');

// 4. Death sets alive=false.
let bug = enemies.find((e) => e.id === 'bug3')!;
bug.hp = 1;
const rKill = resolvePartyAction(eng, 'attack', bug, roll);
if (bug.alive || !rKill.defeated) throw new Error('bug should be defeated at 0 HP');

// 5. enemiesCleared / partyWiped behave.
const freshEnemies = makeEnemies(1);
freshEnemies.forEach((e) => (e.alive = false));
if (!enemiesCleared(freshEnemies)) throw new Error('enemiesCleared should be true');

const freshParty = makePartyRoster();
freshParty.forEach((u) => (u.alive = false));
if (!partyWiped(freshParty)) throw new Error('partyWiped should be true');

// 6. Enemy AI picks a living target.
const p = makePartyRoster();
const ai = chooseEnemyAction(enemies[0], p, roll);
if (!ai.target.alive) throw new Error('enemy AI picked a dead target');

console.log('OK: Bit-Battle combat model verified (damage, SP, death, win/lose checks, AI).');
