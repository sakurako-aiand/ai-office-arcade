/**
 * BitBattleController — orchestrates the full Bit-Battle run.
 *
 * Flow:
 *   1. Class-select screen (auto-fades into combat): pick up to 3 of 3 heroes.
 *   2. Level 1 (Bug Swarm) -> Level 2 (Server Firewall) -> Level 3 (Boss).
 *   3. Each level: round-robin turn order; party members act via the action
 *      menu, enemies via weighted AI. Resolution is instant (STEP_MS pacing
 *      only for log readability; ACCELERATE / SKIP cut it to FAST_STEP_MS / 0).
 *   4. Win = clear Level 3 -> emit 'win' (loader awards 50 coins + auto-kick).
 *      Lose = party wiped -> emit 'lose' (0 coins). Timeout handled by loader.
 *
 * Determinism: all randomness flows through a single `roll()` (Math.random by
 * default; a seeded RNG could be injected for reproducible runs).
 *
 * No input locking: the menu stays interactive during enemy turns; the player
 * can pre-buffer a choice for the next living party member. ACCELERATE/SKIP are
 * always available.
 *
 * Cleanup: destroy() unbinds every input listener + the view + interim tweens.
 */
import Phaser from 'phaser';
import {
  BB_WIDTH,
  BB_HEIGHT,
  BB_COLORS,
  FONT_RPG,
  FONT_UI,
  STEP_MS,
  FAST_STEP_MS,
  MAX_PARTY,
} from './config';
import {
  makePartyRoster,
  makeEnemies,
  resolvePartyAction,
  resolveEnemyAction,
  chooseEnemyAction,
  buildTurnOrder,
  clearTurnFlags,
  partyWiped,
  enemiesCleared,
  skillName,
  skillCost,
} from './CombatModel';
import type { Unit, PartyAction, ActionResult, LevelId } from './types';
import { BattleView, type BattleViewState } from './BattleView';
import { audioManager, SfxKeys } from '../../systems/AudioManager';
import { logger } from '../../utils/logger';

type Phase = 'select' | 'intro' | 'combat' | 'between' | 'resolved';

interface PendingChoice {
  action: PartyAction;
  /** Set when the action needs a target (attack / engineer skill). */
  needsTarget: boolean;
}

export class BitBattleController {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private view: BattleView;

  private phase: Phase = 'select';
  private level: LevelId = 1;
  private turn = 1;
  private party: Unit[] = [];
  private enemies: Unit[] = [];
  private turnOrder: Unit[] = [];
  private turnIndex = 0;
  private log: string[] = [];
  private resolved = false;

  private stepMs = STEP_MS;
  private pending: PendingChoice | null = null;
  private targeting = false;

  // Select-screen objects (kept so they can be torn down).
  private selectGroup: Phaser.GameObjects.Container;
  private betweenGroup: Phaser.GameObjects.Container | null = null;

  // Bound handlers.
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundAccelerateDown: () => void;
  private boundAccelerateUp: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(5);

    this.view = new BattleView(scene);
    this.selectGroup = scene.add.container(0, 0).setDepth(20);

    this.boundKeyDown = (e) => this.onKeyDown(e);
    this.boundAccelerateDown = () => (this.stepMs = FAST_STEP_MS);
    this.boundAccelerateUp = () => (this.stepMs = STEP_MS);
    scene.input.keyboard?.on('keydown', this.boundKeyDown);
    // Hold SPACE (or the ACCELERATE button) to fast-forward action pacing.
    scene.input.keyboard?.on('keydown-SPACE', this.boundAccelerateDown);
    scene.input.keyboard?.on('keyup-SPACE', this.boundAccelerateUp);

    this.buildSelectScreen();
    this.renderCombatHud(); // hidden until combat starts
    logger.info('BitBattleController ready (class-select).');
  }

  /** Register a callback for the controller's 'win'/'lose' resolution events. */
  on(event: 'win' | 'lose', fn: () => void): this {
    this.container.on(event, fn);
    return this;
  }

  // ---- phase 1: class select -------------------------------------------

  private buildSelectScreen(): void {
    const g = this.scene.add.graphics();
    g.fillStyle(BB_COLORS.bg, 1);
    g.fillRect(0, 0, BB_WIDTH, BB_HEIGHT);

    const title = this.scene.add.text(BB_WIDTH / 2, 70, 'BIT-BATTLE', {
      fontFamily: FONT_RPG,
      fontSize: '28px',
      color: '#ffd23a',
    }).setOrigin(0.5);
    const sub = this.scene.add.text(BB_WIDTH / 2, 110, 'PROJECT LAUNCH \u2014 SELECT YOUR PARTY', {
      fontFamily: FONT_RPG,
      fontSize: '11px',
      color: '#8a93c8',
    }).setOrigin(0.5);

    const roster = makePartyRoster();
    const chosen = new Set<string>();
    const slotW = 280;
    const startX = BB_WIDTH / 2 - slotW * (roster.length / 2);

    roster.forEach((unit, i) => {
      const x = startX + i * slotW + slotW / 2;
      const card = this.scene.add.container(x, BB_HEIGHT / 2);
      const body = this.scene.add.rectangle(0, 0, 240, 220, BB_COLORS.panel, 0.95)
        .setStrokeStyle(3, BB_COLORS.panelEdge);
      body.setInteractive({ useHandCursor: true });
      const name = this.scene.add.text(0, -76, unit.name, {
        fontFamily: FONT_RPG,
        fontSize: '14px',
        color: '#e8ecff',
      }).setOrigin(0.5);
      const stats = this.scene.add.text(0, -30, this.unitStatsText(unit), {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: '#c8ccff',
        align: 'center',
      }).setOrigin(0.5);
      const skill = this.scene.add.text(0, 40, `SKILL\n${skillName(unit.role as never)}`, {
        fontFamily: FONT_UI,
        fontSize: '12px',
        color: '#ffd23a',
        align: 'center',
      }).setOrigin(0.5);
      const status = this.scene.add.text(0, 88, 'CLICK TO ADD', {
        fontFamily: FONT_RPG,
        fontSize: '9px',
        color: '#8a93c8',
      }).setOrigin(0.5);
      card.add([body, name, stats, skill, status]);
      this.selectGroup.add(card);

      body.on('pointerup', () => {
        if (chosen.has(unit.id)) {
          chosen.delete(unit.id);
          body.setStrokeStyle(3, BB_COLORS.panelEdge);
          status.setText('CLICK TO ADD');
        } else if (chosen.size < MAX_PARTY) {
          chosen.add(unit.id);
          body.setStrokeStyle(3, BB_COLORS.select);
          status.setText('SELECTED');
        }
        audioManager.play(SfxKeys.click, 0.3);
        if (chosen.size === MAX_PARTY) this.beginRun([...chosen]);
      });
      body.on('pointerover', () => this.scene.tweens.add({ targets: card, scale: 1.04, duration: 100 }));
      body.on('pointerout', () => this.scene.tweens.add({ targets: card, scale: 1, duration: 100 }));
    });

    const hint = this.scene.add.text(BB_WIDTH / 2, BB_HEIGHT - 60, 'Select all 3 heroes to deploy \u2014 [ENTER] to start', {
      fontFamily: FONT_UI,
      fontSize: '13px',
      color: '#8a93c8',
    }).setOrigin(0.5);
    this.selectGroup.add([title, sub, hint]);
  }

  private unitStatsText(u: Unit): string {
    return `HP ${u.maxHp}\nATK ${u.atk}\nDEF ${u.def}\nSP ${u.maxSp}`;
  }

  private beginRun(chosenIds: string[]): void {
    const roster = makePartyRoster();
    this.party = chosenIds.map((id) => roster.find((u) => u.id === id)!).filter(Boolean);
    this.level = 1;
    this.turn = 1;
    this.log = [];
    this.pushLog('PARTY DEPLOYED. The launch begins...');

    // Auto-fade the select screen into combat.
    this.scene.tweens.add({
      targets: this.selectGroup,
      alpha: 0,
      duration: 500,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.selectGroup.destroy();
        this.startLevel(1);
      },
    });
  }

  // ---- phase 2: levels -------------------------------------------------

  private startLevel(level: LevelId): void {
    this.level = level;
    this.enemies = makeEnemies(level);
    // Heal party 25% between levels so a 3-level run is feasible.
    if (level > 1) {
      this.party.forEach((u) => {
        if (u.alive) u.hp = Math.min(u.maxHp, u.hp + Math.round(u.maxHp * 0.25));
        u.sp = Math.min(u.maxSp, u.sp + 15);
      });
    }
    const name = level === 1 ? 'BUG SWARM' : level === 2 ? 'SERVER FIREWALL' : 'BOSS MEETING';
    this.pushLog(`\u25AC LEVEL ${level}: ${name} \u25AC`);
    this.showBetweenBanner(name, () => {
      this.phase = 'combat';
      this.turn = 1;
      this.turnOrder = buildTurnOrder(this.party, this.enemies);
      this.turnIndex = 0;
      this.bindMenu();
      this.advanceTurn();
    });
  }

  private showBetweenBanner(label: string, onDone: () => void): void {
    this.phase = 'between';
    this.betweenGroup = this.scene.add.container(BB_WIDTH / 2, BB_HEIGHT / 2).setDepth(40);
    const bg = this.scene.add.rectangle(0, 0, 560, 120, BB_COLORS.bg, 0.92)
      .setStrokeStyle(3, BB_COLORS.select);
    const text = this.scene.add.text(0, 0, label, {
      fontFamily: FONT_RPG,
      fontSize: '22px',
      color: '#ffd23a',
    }).setOrigin(0.5);
    this.betweenGroup.add([bg, text]);
    this.betweenGroup.setAlpha(0);
    this.scene.tweens.add({
      targets: this.betweenGroup,
      alpha: 1,
      duration: 200,
      yoyo: true,
      hold: 700,
      onComplete: () => {
        this.betweenGroup?.destroy();
        this.betweenGroup = null;
        onDone();
      },
    });
  }

  // ---- phase 3: combat loop --------------------------------------------

  private advanceTurn(): void {
    if (this.resolved) return;

    // Win/lose checks after every action.
    if (partyWiped(this.party)) return this.triggerLose('Party wiped out.');
    if (enemiesCleared(this.enemies)) {
      if (this.level >= 3) return this.triggerWin();
      this.pushLog(`LEVEL ${this.level} CLEARED!`);
      return this.startLevel((this.level + 1) as LevelId);
    }

    // Find the next living unit in order.
    let attempts = 0;
    while (attempts < this.turnOrder.length) {
      const u = this.turnOrder[this.turnIndex % this.turnOrder.length];
      this.turnIndex = (this.turnIndex + 1) % this.turnOrder.length;
      attempts++;
      if (!u || !u.alive) continue;

      if (this.turnIndex === 0) this.turn++;
      clearTurnFlags(u);
      this.renderCombatHud(u.id);

      if (u.side === 'party') {
        // Wait for player input (menu already bound). Show active marker.
        this.view.showActiveMarker(u.id);
        return;
      }
      // Enemy turn — resolve after the step delay (skippable).
      this.view.showActiveMarker(u.id);
      this.scene.time.delayedCall(this.stepMs, () => this.doEnemyTurn(u));
      return;
    }
    // All units dead -> shouldn't happen, but restart the round defensively.
    this.turnOrder = buildTurnOrder(this.party, this.enemies);
    this.turnIndex = 0;
    this.advanceTurn();
  }

  private doEnemyTurn(actor: Unit): void {
    if (this.resolved || !actor.alive) return this.advanceTurn();
    const { target, action } = chooseEnemyAction(actor, this.party, Math.random);
    const result = resolveEnemyAction(actor, action, target, Math.random);
    this.applyResult(result);
    this.renderCombatHud(actor.id);
    this.scene.time.delayedCall(this.stepMs, () => this.advanceTurn());
  }

  /** Apply a result to state + log + visual flashes. */
  private applyResult(r: ActionResult): void {
    if (r.targetId && r.hpDelta !== undefined) {
      this.view.flashUnit(r.targetId, (r.hpDelta ?? 0) > 0);
    }
    this.pushLog(this.formatResult(r));
  }

  private formatResult(r: ActionResult): string {
    if (r.miss) return `${r.actorName} ${r.verb}... MISS`;
    if (r.hpDelta !== undefined) {
      const sign = r.hpDelta > 0 ? '+' : '';
      const tgt = r.targetName ? ` -> ${r.targetName}` : '';
      const tag = r.crit ? ' CRIT!' : '';
      return `${r.actorName} ${r.verb}${tgt} ${sign}${r.hpDelta} HP${tag}`;
    }
    if (r.buff) return `${r.actorName} ${r.verb} (${r.buff})`;
    return `${r.actorName} ${r.verb}`;
  }

  // ---- player input ----------------------------------------------------

  private bindMenu(): void {
    (['attack', 'defend', 'skill'] as PartyAction[]).forEach((action) => {
      const btn = this.view.getMenuButton(action);
      btn.bg.off('pointerup');
      btn.bg.off('pointerover');
      btn.bg.off('pointerout');
      btn.bg.on('pointerup', () => this.onMenuButton(action));
      btn.bg.on('pointerover', () => this.view.setButtonHover(action, true));
      btn.bg.on('pointerout', () => this.view.setButtonHover(action, false));
    });
  }

  private onMenuButton(action: PartyAction): void {
    if (this.phase !== 'combat' || this.resolved) return;
    const actor = this.activePartyUnit();
    if (!actor) return;
    audioManager.play(SfxKeys.click, 0.3);

    if (action === 'skill') {
      const cost = skillCost(actor.role as never);
      if (actor.sp < cost) return; // disabled in UI, guard anyway
    }

    const needsTarget = action === 'attack' || (action === 'skill' && actor.role === 'engineer');
    if (needsTarget) {
      this.pending = { action, needsTarget: true };
      this.targeting = true;
      this.renderCombatHud(actor.id);
      // Wire enemy cards as targets.
      this.bindTargetSelection(actor);
    } else {
      this.pending = null;
      this.resolvePartyTurn(actor, action, undefined);
    }
  }

  private targetZones: Phaser.GameObjects.Rectangle[] = [];

  private bindTargetSelection(actor: Unit): void {
    // Overlay an invisible hit zone on each living enemy so the player can
    // tap a target. Zones are tracked and torn down on selection.
    this.clearTargetZones();
    this.enemies.forEach((e) => {
      if (!e.alive) return;
      const zone = this.scene.add
        .rectangle(this.enemyX(e.id), this.enemyY(), 220, 130, 0xffffff, 0.001)
        .setInteractive({ useHandCursor: true })
        .setDepth(30);
      zone.setStrokeStyle(3, BB_COLORS.bad, 0.8);
      zone.on('pointerup', () => {
        this.clearTargetZones();
        this.targeting = false;
        this.resolvePartyTurn(actor, this.pending!.action, e);
      });
      this.targetZones.push(zone);
    });
  }

  private clearTargetZones(): void {
    this.targetZones.forEach((z) => z.destroy());
    this.targetZones = [];
  }

  private enemyX(id: string): number {
    const i = this.enemies.findIndex((e) => e.id === id);
    const slotW = (BB_WIDTH - 48) / Math.max(this.enemies.length, 1);
    return 24 + i * slotW + slotW / 2;
  }
  private enemyY(): number {
    return 96 + 150 / 2;
  }

  private resolvePartyTurn(actor: Unit, action: PartyAction, target: Unit | undefined): void {
    if (this.resolved || !actor.alive) return;
    const result = resolvePartyAction(actor, action, target, Math.random);
    // Designer AEGIS UI guards the whole party.
    if (actor.role === 'designer' && action === 'skill') {
      this.party.forEach((p) => p.alive && (p.guarding = true));
    }
    this.applyResult(result);
    this.view.showActiveMarker(null);
    this.renderCombatHud(null);
    this.scene.time.delayedCall(this.stepMs, () => this.advanceTurn());
  }

  private activePartyUnit(): Unit | undefined {
    if (this.turnIndex === 0) return undefined;
    const u = this.turnOrder[(this.turnIndex - 1 + this.turnOrder.length) % this.turnOrder.length];
    return u && u.side === 'party' && u.alive ? u : undefined;
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (this.phase === 'select') {
      if (e.key === 'Enter') {
        // Default: start with all 3 (convenience).
        this.beginRun(['engineer', 'designer', 'manager']);
      }
      return;
    }
    if (this.phase !== 'combat' || this.resolved) return;
    switch (e.key) {
      case 'a':
      case 'A':
        this.onMenuButton('attack');
        break;
      case 'd':
      case 'D':
        this.onMenuButton('defend');
        break;
      case 's':
      case 'S':
        this.onMenuButton('skill');
        break;
      case ' ':
        // ACCELERATE while held.
        this.stepMs = FAST_STEP_MS;
        break;
    }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // reserved for future target cycling
    }
  }

  // ---- rendering -------------------------------------------------------

  private renderCombatHud(activeUnitId: string | null = null): void {
    const state: BattleViewState = {
      party: this.party,
      enemies: this.enemies,
      level: this.level,
      turn: this.turn,
      activeUnitId,
      targeting: this.targeting,
      log: [...this.log],
    };
    this.view.render(state);
    this.view.showActiveMarker(activeUnitId);
  }

  private pushLog(line: string): void {
    this.log.push(line);
    if (this.log.length > 30) this.log.shift();
  }

  // ---- win / lose ------------------------------------------------------

  private triggerWin(): void {
    if (this.resolved) return;
    this.resolved = true;
    this.phase = 'resolved';
    audioManager.play(SfxKeys.win, 0.6);
    this.pushLog('CEO-9000 is defeated! PROJECT LAUNCHED!');
    this.renderCombatHud(null);
    this.showResultBanner('VICTORY!', '#35d07a', () => this.container.emit('win'));
  }

  private triggerLose(reason: string): void {
    if (this.resolved) return;
    this.resolved = true;
    this.phase = 'resolved';
    audioManager.play(SfxKeys.lose, 0.6);
    this.pushLog(reason);
    this.renderCombatHud(null);
    this.showResultBanner('DEFEAT...', '#e23a3a', () => this.container.emit('lose'));
  }

  private showResultBanner(text: string, color: string, onDone: () => void): void {
    const banner = this.scene.add.container(BB_WIDTH / 2, BB_HEIGHT / 2).setDepth(60);
    const bg = this.scene.add.rectangle(0, 0, 480, 140, BB_COLORS.bg, 0.95)
      .setStrokeStyle(4, color === '#35d07a' ? BB_COLORS.good : BB_COLORS.bad);
    const title = this.scene.add.text(0, -16, text, {
      fontFamily: FONT_RPG,
      fontSize: '28px',
      color,
    }).setOrigin(0.5);
    const sub = this.scene.add.text(0, 26, 'Returning to the hub...', {
      fontFamily: FONT_UI,
      fontSize: '13px',
      color: '#8a93c8',
    }).setOrigin(0.5);
    banner.add([bg, title, sub]);
    banner.setScale(0.7).setAlpha(0);
    this.scene.tweens.add({
      targets: banner,
      scale: 1,
      alpha: 1,
      duration: 300,
      ease: 'Back.easeOut',
      onComplete: () => this.scene.time.delayedCall(900, onDone),
    });
  }

  // ---- cleanup ---------------------------------------------------------

  destroy(): void {
    this.scene.input.keyboard?.off('keydown', this.boundKeyDown);
    this.scene.input.keyboard?.off('keydown-SPACE', this.boundAccelerateDown);
    this.scene.input.keyboard?.off('keyup-SPACE', this.boundAccelerateUp);
    this.view?.destroy();
    this.selectGroup?.destroy(true);
    this.betweenGroup?.destroy(true);
    this.container?.destroy(true);
    logger.debug('BitBattleController destroyed.');
  }
}
