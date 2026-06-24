/**
 * BattleView — retro-styled battle screen renderer.
 *
 * Pure presentation: it holds no combat state of its own. The controller pushes
 * the current unit arrays + turn/level info via `render()`, and the view draws:
 *   - enemy panel (top) + party panel (bottom) with HP/SP bars,
 *   - the active unit's action menu (Attack / Defend / Skill),
 *   - a compact, auto-scrolling battle log,
 *   - a turn counter + 3-level progress pips.
 *
 * Input is handled by the controller (which owns the menu enable/hover logic);
 * the view exposes the menu button containers so the controller can bind them.
 * Destroying the view tears down every GameObject it created.
 *
 * All visuals are pixel-aligned rectangles + bold text (no sprite assets yet).
 */
import Phaser from 'phaser';
import {
  BB_WIDTH,
  BB_HEIGHT,
  BB_COLORS,
  LAYOUT,
  FONT_RPG,
  FONT_UI,
} from './config';
import type { Unit, PartyAction, LevelId } from './types';
import { skillName } from './CombatModel';

export interface BattleViewState {
  party: Unit[];
  enemies: Unit[];
  level: LevelId;
  turn: number;
  activeUnitId: string | null;
  /** Set when the party must pick a target (after choosing Attack/Skill). */
  targeting: boolean;
  /** Logs newest-last; view keeps the last 5 lines. */
  log: string[];
}

interface MenuButton {
  container: Phaser.GameObjects.Container;
  bg: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export class BattleView {
  private scene: Phaser.Scene;
  private gfx: Phaser.GameObjects.Graphics;
  private container: Phaser.GameObjects.Container;

  private unitCards = new Map<string, Phaser.GameObjects.Container>();
  private hpBars = new Map<string, Phaser.GameObjects.Rectangle>();
  private spBars = new Map<string, Phaser.GameObjects.Rectangle>();
  private nameTexts = new Map<string, Phaser.GameObjects.Text>();
  private activeMarker: Phaser.GameObjects.Container;

  private logText: Phaser.GameObjects.Text;
  private turnText: Phaser.GameObjects.Text;
  private levelText: Phaser.GameObjects.Text;
  private levelPips: Phaser.GameObjects.Arc[] = [];

  private menuContainer: Phaser.GameObjects.Container;
  private menuButtons: Record<PartyAction, MenuButton>;
  private menuTitle: Phaser.GameObjects.Text;
  private targetingHint: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.gfx = scene.add.graphics();
    this.container = scene.add.container(0, 0).setDepth(10);

    // Active-unit marker (a bouncing chevron above the active card).
    this.activeMarker = scene.add.container(0, 0).setDepth(20).setVisible(false);
    const chev = scene.add.text(0, 0, '\u25BC', {
      fontFamily: FONT_RPG,
      fontSize: '14px',
      color: '#ffd23a',
    }).setOrigin(0.5);
    this.activeMarker.add(chev);
    scene.tweens.add({
      targets: chev,
      y: 6,
      duration: 350,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    // Turn + level HUD (top-left).
    this.turnText = scene.add.text(LAYOUT.progressX, LAYOUT.progressY - 24, 'TURN 1', {
      fontFamily: FONT_RPG,
      fontSize: '11px',
      color: '#8a93c8',
    });
    this.levelText = scene.add.text(LAYOUT.progressX, LAYOUT.progressY, 'LV.1', {
      fontFamily: FONT_RPG,
      fontSize: '14px',
      color: '#e8ecff',
    });
    for (let i = 0; i < 3; i++) {
      const pip = scene.add.arc(
        LAYOUT.progressX + 60 + i * 22,
        LAYOUT.progressY + 6,
        7,
        0,
        360,
        true,
        i === 0 ? BB_COLORS.select : BB_COLORS.panelEdgeDim
      );
      this.levelPips.push(pip);
    }

    // Battle log (bottom strip).
    const logBg = scene.add.rectangle(BB_WIDTH / 2, LAYOUT.logY + LAYOUT.logH / 2, BB_WIDTH - 32, LAYOUT.logH, BB_COLORS.logBg, 0.9)
      .setStrokeStyle(2, BB_COLORS.panelEdgeDim);
    this.container.add(logBg);
    this.logText = scene.add.text(24, LAYOUT.logY + 8, '', {
      fontFamily: FONT_UI,
      fontSize: '12px',
      color: '#c8ccff',
      wordWrap: { width: BB_WIDTH - 64 },
      lineSpacing: 2,
    });
    this.container.add(this.logText);

    // Action menu (bottom-right).
    this.menuContainer = scene.add.container(LAYOUT.menuX, LAYOUT.menuY).setDepth(15);
    const menuBg = scene.add.rectangle(LAYOUT.menuW / 2, LAYOUT.menuH / 2, LAYOUT.menuW, LAYOUT.menuH, BB_COLORS.panel, 0.95)
      .setStrokeStyle(2, BB_COLORS.panelEdge);
    this.menuTitle = scene.add.text(LAYOUT.menuW / 2, 14, 'ACTIONS', {
      fontFamily: FONT_RPG,
      fontSize: '11px',
      color: '#ffd23a',
    }).setOrigin(0.5);
    this.targetingHint = scene.add.text(LAYOUT.menuW / 2, LAYOUT.menuH - 12, 'PICK A TARGET', {
      fontFamily: FONT_RPG,
      fontSize: '9px',
      color: '#e23a3a',
    }).setOrigin(0.5).setVisible(false);
    this.menuContainer.add([menuBg, this.menuTitle, this.targetingHint]);

    // Three action buttons.
    this.menuButtons = {
      attack: this.makeButton('ATTACK', '[A]', 0),
      defend: this.makeButton('DEFEND', '[D]', 1),
      skill: this.makeButton('SKILL', '[S]', 2),
    };

    this.container.add(this.activeMarker);
  }

  private makeButton(label: string, hint: string, index: number): MenuButton {
    const w = LAYOUT.menuW - 24;
    const h = 30;
    const x = 12;
    const y = 32 + index * (h + 4);
    const c = this.scene.add.container(x, y);
    const bg = this.scene.add.rectangle(w / 2, h / 2, w, h, BB_COLORS.btn)
      .setStrokeStyle(2, BB_COLORS.btnEdge);
    bg.setInteractive({ useHandCursor: true });
    const lbl = this.scene.add.text(12, h / 2, `${label}`, {
      fontFamily: FONT_RPG,
      fontSize: '11px',
      color: '#e8ecff',
    }).setOrigin(0, 0.5);
    const k = this.scene.add.text(w - 12, h / 2, hint, {
      fontFamily: FONT_UI,
      fontSize: '10px',
      color: '#8a93c8',
    }).setOrigin(1, 0.5);
    c.add([bg, lbl, k]);
    this.menuContainer.add(c);
    return { container: c, bg, label: lbl };
  }

  /** Expose the menu buttons so the controller can bind input + hover. */
  getMenuButton(action: PartyAction): MenuButton {
    return this.menuButtons[action];
  }

  /** Enable hover highlight on a button (controller wires pointerover/out). */
  setButtonHover(action: PartyAction, hover: boolean): void {
    const b = this.menuButtons[action];
    b.bg.setFillStyle(hover ? BB_COLORS.btnHover : BB_COLORS.btn);
  }

  /** Full re-render from controller state. */
  render(state: BattleViewState): void {
    this.renderPanel(state.enemies, LAYOUT.enemyPanelY, LAYOUT.enemyPanelH, true);
    this.renderPanel(state.party, LAYOUT.partyPanelY, LAYOUT.partyPanelH, false);
    this.renderLog(state.log);
    this.renderHud(state);
    this.renderMenu(state);
  }

  private renderPanel(units: Unit[], y: number, h: number, isEnemy: boolean): void {
    const g = this.gfx;
    g.fillStyle(BB_COLORS.panel, 0.9);
    g.fillRect(16, y, BB_WIDTH - 32, h);
    g.lineStyle(2, isEnemy ? BB_COLORS.enemy : BB_COLORS.panelEdge);
    g.strokeRect(16, y, BB_WIDTH - 32, h);

    const n = Math.max(units.length, 1);
    const slotW = (BB_WIDTH - 48) / n;
    units.forEach((u, i) => this.renderUnitCard(u, 24 + i * slotW, y + 8, slotW - 8, h - 16, isEnemy));
  }

  private renderUnitCard(
    u: Unit,
    x: number,
    y: number,
    w: number,
    h: number,
    isEnemy: boolean
  ): void {
    let card = this.unitCards.get(u.id);
    if (!card) {
      card = this.scene.add.container(0, 0);
      this.container.add(card);
      this.unitCards.set(u.id, card);

      // Body rectangle (tinted by role).
      const bodyColor = this.roleColor(u, isEnemy);
      const body = this.scene.add.rectangle(0, 0, w - 8, h - 8, bodyColor, 0.85)
        .setStrokeStyle(2, isEnemy ? BB_COLORS.enemy : BB_COLORS.accent);
      card.add(body);
      card.setData('body', body);

      const name = this.scene.add.text(0, -h / 2 + 14, u.name, {
        fontFamily: FONT_RPG,
        fontSize: '11px',
        color: '#ffffff',
      }).setOrigin(0.5);
      card.add(name);
      this.nameTexts.set(u.id, name);

      // HP bar.
      const hpBack = this.scene.add.rectangle(0, -2, w - 24, 8, BB_COLORS.hpBack)
        .setStrokeStyle(1, 0x000000, 0.4);
      const hpFill = this.scene.add.rectangle(-(w - 24) / 2, -2, w - 24, 6, BB_COLORS.hp)
        .setOrigin(0, 0.5);
      card.add([hpBack, hpFill]);
      this.hpBars.set(u.id, hpFill);

      // SP bar (party only).
      let spFill: Phaser.GameObjects.Rectangle | null = null;
      if (u.side === 'party' && u.maxSp > 0) {
        const spBack = this.scene.add.rectangle(0, 12, w - 24, 6, BB_COLORS.spBack)
          .setStrokeStyle(1, 0x000000, 0.4);
        spFill = this.scene.add.rectangle(-(w - 24) / 2, 12, w - 24, 4, BB_COLORS.sp)
          .setOrigin(0, 0.5);
        card.add([spBack, spFill]);
        this.spBars.set(u.id, spFill);
      }

      // HP numeric.
      const hpNum = this.scene.add.text(0, h / 2 - 14, '', {
        fontFamily: FONT_UI,
        fontSize: '11px',
        color: '#e8ecff',
        fontStyle: '800',
      }).setOrigin(0.5);
      card.add(hpNum);
      card.setData('hpNum', hpNum);
    }

    // Position the card.
    card!.setPosition(x + w / 2, y + h / 2);

    // Update HP/SP.
    const hpFill = this.hpBars.get(u.id)!;
    const hpFrac = Math.max(0, u.hp / u.maxHp);
    const maxW = w - 24;
    hpFill.width = maxW * hpFrac;
    hpFill.setFillStyle(
      hpFrac > 0.5 ? BB_COLORS.hp : hpFrac > 0.25 ? BB_COLORS.hpMid : BB_COLORS.hpLow
    );
    const spFill = this.spBars.get(u.id);
    if (spFill && u.maxSp > 0) {
      spFill.width = maxW * Math.max(0, u.sp / u.maxSp);
    }
    const hpNum = card!.getData('hpNum') as Phaser.GameObjects.Text;
    hpNum.setText(u.alive ? `${u.hp}/${u.maxHp}` : 'DOWN');

    // Dead units dim.
    const body = card!.getData('body') as Phaser.GameObjects.Rectangle;
    body.setAlpha(u.alive ? 0.85 : 0.35);
    if (!u.alive) body.setFillStyle(0x2a2438, 0.5);
  }

  private roleColor(u: Unit, isEnemy: boolean): number {
    if (isEnemy) return u.role === 'boss' ? BB_COLORS.boss : BB_COLORS.enemy;
    if (u.role === 'engineer') return 0x2a6cc4;
    if (u.role === 'designer') return 0x9c4cc4;
    return 0x2aa05a;
  }

  private renderLog(lines: string[]): void {
    const recent = lines.slice(-5);
    this.logText.setText(recent.join('\n'));
  }

  private renderHud(state: BattleViewState): void {
    this.turnText.setText(`TURN ${state.turn}`);
    this.levelText.setText(`LV.${state.level}`);
    this.levelPips.forEach((pip, i) => {
      pip.setFillStyle(i < state.level ? BB_COLORS.select : BB_COLORS.panelEdgeDim);
    });
  }

  private renderMenu(state: BattleViewState): void {
    const partyTurn = state.activeUnitId && state.party.some((u) => u.id === state.activeUnitId);
    const showMenu = !!partyTurn && !state.targeting;
    this.menuContainer.setVisible(showMenu);
    this.targetingHint.setVisible(!!partyTurn && state.targeting);

    if (showMenu) {
      const active = state.party.find((u) => u.id === state.activeUnitId);
      if (active) {
        const skill = skillName(active.role as never);
        // The skill button label text node is index 1 of the button's children.
        const skillBtn = this.menuButtons.skill;
        skillBtn.label.setText(skill);
        // Disable skill if not enough SP.
        const cost = active.role === 'engineer' ? 20 : active.role === 'designer' ? 15 : 25;
        const canSkill = active.sp >= cost;
        skillBtn.bg.setAlpha(canSkill ? 1 : 0.4);
        skillBtn.bg.input!.enabled = canSkill;
      }
    }
  }

  /** Move the active marker above the active unit's card. */
  showActiveMarker(unitId: string | null): void {
    if (!unitId) {
      this.activeMarker.setVisible(false);
      return;
    }
    const card = this.unitCards.get(unitId);
    if (!card) {
      this.activeMarker.setVisible(false);
      return;
    }
    this.activeMarker.setPosition(card.x, card.y - 70).setVisible(true);
  }

  /** Brief flash on a unit card (hit/heal feedback). */
  flashUnit(unitId: string, good: boolean): void {
    const card = this.unitCards.get(unitId);
    if (!card) return;
    const body = card.getData('body') as Phaser.GameObjects.Rectangle;
    if (!body) return;
    const orig = body.fillColor;
    this.scene.tweens.add({
      targets: body,
      alpha: { from: 0.4, to: body.alpha },
      duration: 200,
      onStart: () => body.setFillStyle(good ? BB_COLORS.good : BB_COLORS.bad, 0.9),
      onComplete: () => body.setFillStyle(orig, 0.85),
    });
  }

  destroy(): void {
    this.gfx.destroy();
    this.container.destroy(true);
    this.turnText.destroy();
    this.levelText.destroy();
    this.levelPips.forEach((p) => p.destroy());
    this.unitCards.clear();
    this.hpBars.clear();
    this.spBars.clear();
    this.nameTexts.clear();
  }
}
