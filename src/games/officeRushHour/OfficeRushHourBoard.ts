/**
 * OfficeRushHourBoard — the playable board for the "Office Rush Hour" mini-game.
 *
 * Owns:
 *   - the PuzzleModel (pure logic) + a PieceView per piece (rendering),
 *   - the grid background, the EXIT zone indicator, a move counter, a RESET
 *     button, and an auto-fading instruction overlay,
 *   - all interaction: mouse drag, touch swipe, tap-to-select, and arrow-key
 *     nudging. Pointer down selects via scene-level hit testing; move/up are
 *     scene-scoped so a drag never breaks when the pointer leaves a piece.
 *
 * Win routing: when the employee piece is pushed out through the EXIT, the
 * board emits `'win'`. The owning scene (EasyGameScene) maps that to the
 * MiniGameLoader `this.win()` pipeline (awards 10 coins + auto-kick to hub).
 * Lose/timeout is handled entirely by the loader's 3-minute timer — the board
 * does not award coins or transition scenes itself.
 *
 * Cleanup: `destroy()` removes every scene-level input listener and tears down
 * all PieceViews, so the scene can swap out without leaks.
 */
import Phaser from 'phaser';
import { PuzzleModel } from './PuzzleModel';
import { PieceView } from './PieceView';
import { LEVELS } from './levels';
import { COLORS } from '../../config/constants';
import { audioManager, SfxKeys } from '../../systems/AudioManager';
import { logger } from '../../utils/logger';

export class OfficeRushHourBoard extends Phaser.GameObjects.Container {
  private model: PuzzleModel;
  private views = new Map<string, PieceView>();

  private readonly cellSize: number;
  private readonly gridLeft: number;
  private readonly gridTop: number;

  private moveCount = 0;
  private moveLabel!: Phaser.GameObjects.Text;
  private exitZone!: Phaser.GameObjects.Rectangle;
  private exitLabel!: Phaser.GameObjects.Text;
  private exitArrow!: Phaser.GameObjects.Text;

  private activeView: PieceView | null = null;
  private dragStartPointer = { x: 0, y: 0 };
  private dragStartPos = { x: 0, y: 0 };
  private dragRange = { back: 0, fwd: 0, allowExit: false };
  private dragCellDelta = 0;
  private resolved = false;

  // Bound handlers (kept as fields so they can be removed on destroy).
  private boundDown!: (p: Phaser.Input.Pointer) => void;
  private boundMove!: (p: Phaser.Input.Pointer) => void;
  private boundUp!: (p: Phaser.Input.Pointer) => void;
  private boundKey?: (e: KeyboardEvent) => void;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    const level = LEVELS[0];
    this.model = new PuzzleModel(level);

    const { width, height } = scene.scale;
    this.cellSize = this.computeCellSize(width, height, level.cols, level.rows);
    const gridW = level.cols * this.cellSize;
    const gridH = level.rows * this.cellSize;
    // Shift left of center so the EXIT zone has breathing room on the right.
    this.gridLeft = Math.round((width - gridW) / 2) - 50;
    this.gridTop = Math.round(150 + (height - 150 - 130 - gridH) / 2);

    scene.add.existing(this);

    this.drawGrid(level);
    this.drawExitZone(level);
    this.drawHud(width, height);
    this.buildPieces();

    // Scene-level input (single code path for mouse + touch + keyboard).
    this.boundDown = (p) => this.onPointerDown(p);
    this.boundMove = (p) => this.onPointerMove(p);
    this.boundUp = (p) => this.onPointerUp(p);
    scene.input.on(Phaser.Input.Events.POINTER_DOWN, this.boundDown);
    scene.input.on(Phaser.Input.Events.POINTER_MOVE, this.boundMove);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.boundUp);

    const kb = scene.input.keyboard;
    if (kb) {
      this.boundKey = (e) => this.onKey(e);
      kb.on('keydown', this.boundKey);
    }

    this.showInstructions(width, height);
    this.refreshExitGlow();
    logger.info(`OfficeRushHourBoard ready (level "${level.name}", cell ${this.cellSize}px).`);
  }

  // ---- layout -----------------------------------------------------------

  private computeCellSize(width: number, height: number, cols: number, rows: number): number {
    const availW = width - 240; // side padding + EXIT zone space
    const availH = height - 300; // header + footer reserves
    return Math.max(56, Math.min(92, Math.floor(Math.min(availW / cols, availH / rows))));
  }

  private gridRight(): number {
    return this.gridLeft + this.model.cols * this.cellSize;
  }

  /** Subtle checkerboard grid + cell borders. */
  private drawGrid(level: { cols: number; rows: number }): void {
    const g = this.scene.add.graphics();
    g.fillStyle(0x0a1622, 0.85);
    g.fillRect(
      this.gridLeft - 6,
      this.gridTop - 6,
      level.cols * this.cellSize + 12,
      level.rows * this.cellSize + 12
    );

    // Alternating cell tint for a "floor tile" feel.
    for (let c = 0; c < level.cols; c++) {
      for (let r = 0; r < level.rows; r++) {
        if ((c + r) % 2 === 0) {
          g.fillStyle(0x12324a, 0.5);
          g.fillRect(
            this.gridLeft + c * this.cellSize,
            this.gridTop + r * this.cellSize,
            this.cellSize,
            this.cellSize
          );
        }
      }
    }

    // Grid lines.
    g.lineStyle(1, COLORS.grayDark, 0.35);
    for (let c = 0; c <= level.cols; c++) {
      g.lineBetween(
        this.gridLeft + c * this.cellSize,
        this.gridTop,
        this.gridLeft + c * this.cellSize,
        this.gridTop + level.rows * this.cellSize
      );
    }
    for (let r = 0; r <= level.rows; r++) {
      g.lineBetween(
        this.gridLeft,
        this.gridTop + r * this.cellSize,
        this.gridLeft + level.cols * this.cellSize,
        this.gridTop + r * this.cellSize
      );
    }

    // Outer frame.
    g.lineStyle(3, COLORS.blue, 0.7);
    g.strokeRect(
      this.gridLeft - 6,
      this.gridTop - 6,
      level.cols * this.cellSize + 12,
      level.rows * this.cellSize + 12
    );
    this.add(g).setDepth(0);
  }

  /** EXIT zone on the right edge at the exit row. */
  private drawExitZone(level: { exitRow: number }): void {
    const x = this.gridRight() + 8;
    const y = this.gridTop + level.exitRow * this.cellSize;
    const w = this.cellSize * 1.4;
    const h = this.cellSize;

    this.exitZone = this.scene.add
      .rectangle(x + w / 2, y + h / 2, w, h, COLORS.deepBlue, 0.4)
      .setStrokeStyle(2, COLORS.grayDark, 0.6)
      .setDepth(1);
    this.add(this.exitZone);

    this.exitArrow = this.scene.add
      .text(x + w / 2, y + h / 2 - 6, '\u2192', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '26px',
        color: '#6b7785',
        fontStyle: '800',
      })
      .setOrigin(0.5)
      .setDepth(1);
    this.add(this.exitArrow);

    this.exitLabel = this.scene.add
      .text(x + w / 2, y + h / 2 + 16, 'EXIT', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
        color: '#6b7785',
        fontStyle: '800',
      })
      .setOrigin(0.5)
      .setDepth(1);
    this.add(this.exitLabel);

    // Gentle ambient pulse so the exit reads as a destination.
    this.scene.tweens.add({
      targets: this.exitZone,
      alpha: { from: 0.4, to: 0.75 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  /** Move counter (top-left of grid) + RESET button (bottom-right of grid). */
  private drawHud(width: number, height: number): void {
    this.moveLabel = this.scene.add
      .text(this.gridLeft, this.gridTop - 30, 'MOVES: 0', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        color: '#c7d2dc',
        fontStyle: '800',
      })
      .setOrigin(0, 1)
      .setDepth(20);
    this.add(this.moveLabel);

    // RESET button.
    const btnX = this.gridRight() - 70;
    const btnY = this.gridTop + this.model.rows * this.cellSize + 34;
    const btn = this.scene.add.container(btnX, btnY).setDepth(20);
    const bg = this.scene.add
      .rectangle(0, 0, 130, 38, COLORS.grayDark, 0.9)
      .setStrokeStyle(2, 0xffffff, 0.4);
    bg.setInteractive({ useHandCursor: true });
    const label = this.scene.add
      .text(0, 0, '\u21bb RESET', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '15px',
        color: '#ffffff',
        fontStyle: '800',
      })
      .setOrigin(0.5);
    btn.add([bg, label]);
    this.add(btn);

    bg.on(Phaser.Input.Events.POINTER_UP, () => {
      audioManager.play(SfxKeys.click, 0.3);
      this.reset();
    });
    bg.on(Phaser.Input.Events.POINTER_OVER, () =>
      this.scene.tweens.add({ targets: btn, scale: 1.05, duration: 100 })
    );
    bg.on(Phaser.Input.Events.POINTER_OUT, () =>
      this.scene.tweens.add({ targets: btn, scale: 1, duration: 100 })
    );

    void width;
    void height;
  }

  /** Auto-fading instruction overlay (visible ~2s, then fades out). */
  private showInstructions(width: number, height: number): void {
    const overlay = this.scene.add.container(width / 2, height / 2 + 40).setDepth(30);
    const panel = this.scene.add
      .rectangle(0, 0, 620, 70, 0x0a1a2a, 0.92)
      .setStrokeStyle(2, COLORS.blue, 0.7);
    const text = this.scene.add
      .text(
        0,
        0,
        'Drag the furniture to clear a path \u2014 slide the EMPLOYEE to the EXIT \u2192',
        {
          fontFamily: 'Inter, sans-serif',
          fontSize: '15px',
          color: '#ffffff',
          align: 'center',
          wordWrap: { width: 560 },
        }
      )
      .setOrigin(0.5);
    overlay.add([panel, text]);
    this.add(overlay);

    this.scene.tweens.add({
      targets: overlay,
      alpha: 0,
      delay: 2000,
      duration: 600,
      ease: 'Cubic.easeIn',
      onComplete: () => overlay.destroy(),
    });
  }

  // ---- pieces -----------------------------------------------------------

  private buildPieces(): void {
    for (const def of this.model.pieces) {
      const view = new PieceView(this.scene, {
        pieceId: def.id,
        orient: def.orient,
        kind: def.kind,
        length: def.length,
        isExit: !!def.isExit,
        cellSize: this.cellSize,
      });
      view.setCellPosition(def.col, def.row, this.gridLeft, this.gridTop, this.cellSize);
      view.setDepth(10);
      this.add(view);
      this.views.set(def.id, view);
    }
  }

  /** Snap a piece's view to its current model cell. */
  private syncView(id: string): void {
    const p = this.model.piece(id);
    const v = this.views.get(id);
    if (p && v) v.setCellPosition(p.col, p.row, this.gridLeft, this.gridTop, this.cellSize);
  }

  /** Update the EXIT zone color/label to signal readiness. */
  private refreshExitGlow(): void {
    const ready = this.model.canExit();
    this.exitZone.setFillStyle(ready ? COLORS.easy : COLORS.deepBlue, ready ? 0.6 : 0.4);
    this.exitLabel.setColor(ready ? '#22c55e' : '#6b7785');
    this.exitArrow.setColor(ready ? '#22c55e' : '#6b7785');
  }

  // ---- input: pointer ---------------------------------------------------

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (this.resolved) return;
    const hits = this.scene.input.hitTestPointer(pointer);
    const view = this.findPieceView(hits);

    if (view) {
      if (this.activeView && this.activeView !== view) this.activeView.setSelected(false);
      this.activeView = view;
      view.setSelected(true);

      const p = this.model.piece(view.pieceId)!;
      this.dragStartPointer = { x: pointer.x, y: pointer.y };
      this.dragStartPos = { x: view.x, y: view.y };
      this.dragRange = {
        back: this.model.maxShift(view.pieceId, -1),
        fwd: this.model.maxShift(view.pieceId, 1),
        allowExit: view.isExit && this.model.canExit(),
      };
      this.dragCellDelta = 0;
      audioManager.play(SfxKeys.click, 0.3);
    } else if (this.activeView) {
      // Tapped empty space: deselect.
      this.activeView.setSelected(false);
      this.activeView = null;
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const v = this.activeView;
    if (!v || !pointer.isDown) return;

    const raw = v.orient === 'H' ? pointer.x - this.dragStartPointer.x : pointer.y - this.dragStartPointer.y;
    // Small deadzone so a tap doesn't read as a drag.
    let cellDelta = Math.abs(raw) > 4 ? Math.round(raw / this.cellSize) : 0;

    const maxFwd = this.dragRange.fwd + (this.dragRange.allowExit ? 1 : 0);
    if (cellDelta > maxFwd) cellDelta = maxFwd;
    if (cellDelta < -this.dragRange.back) cellDelta = -this.dragRange.back;
    this.dragCellDelta = cellDelta;

    const dx = v.orient === 'H' ? cellDelta * this.cellSize : 0;
    const dy = v.orient === 'V' ? cellDelta * this.cellSize : 0;
    v.setPosition(this.dragStartPos.x + dx, this.dragStartPos.y + dy);
  }

  private onPointerUp(_pointer: Phaser.Input.Pointer): void {
    const v = this.activeView;
    if (!v) return;
    const delta = this.dragCellDelta;

    // Pushed the exit piece into the EXIT zone \u2192 win.
    if (this.dragRange.allowExit && delta > this.dragRange.fwd) {
      this.activeView = null;
      v.setSelected(false);
      this.tryExit();
      return;
    }

    this.activeView = null;
    if (delta !== 0) {
      const applied = this.applyMove(v.pieceId, delta);
      v.setSelected(false);
      if (applied === 0) v.flashInvalid();
    }
    // delta === 0 \u2192 tap-select (keep selected for keyboard nudging).
    this.dragCellDelta = 0;
  }

  /** Resolve the interactive body under the pointer to its PieceView. */
  private findPieceView(hits: Phaser.GameObjects.GameObject[]): PieceView | undefined {
    for (const h of hits) {
      if (h.parentContainer instanceof PieceView) return h.parentContainer;
    }
    return undefined;
  }

  // ---- input: keyboard --------------------------------------------------

  private onKey(event: KeyboardEvent): void {
    if (this.resolved || !this.activeView) return;
    const v = this.activeView;
    let dir = 0;
    if (v.orient === 'H') {
      if (event.key === 'ArrowLeft') dir = -1;
      else if (event.key === 'ArrowRight') dir = 1;
    } else {
      if (event.key === 'ArrowUp') dir = -1;
      else if (event.key === 'ArrowDown') dir = 1;
    }
    if (dir === 0) return;

    // Exit piece at the edge + forward press \u2192 leave the building.
    if (v.isExit && dir === 1 && this.model.canExit()) {
      this.tryExit();
      return;
    }
    const applied = this.applyMove(v.pieceId, dir);
    if (applied === 0) v.flashInvalid();
  }

  // ---- moves & win ------------------------------------------------------

  /** Commit a model move, snap the view, bump the counter. Returns cells moved. */
  private applyMove(pieceId: string, delta: number): number {
    if (this.resolved) return 0;
    const applied = this.model.move(pieceId, delta);
    if (applied !== 0) {
      this.syncView(pieceId);
      this.moveCount++;
      this.moveLabel.setText(`MOVES: ${this.moveCount}`);
      audioManager.play(SfxKeys.click, 0.4);
      this.refreshExitGlow();
    }
    return applied;
  }

  /** Trigger the win: slide the employee out through the EXIT, then emit 'win'. */
  private tryExit(): boolean {
    if (this.resolved || !this.model.canExit()) return false;
    this.resolved = true;
    this.model.exit();
    this.refreshExitGlow();

    // Disable further input on every piece.
    this.views.forEach((v) => v.disableInput());

    const exitView = this.views.get(this.model.exitPiece!.id);
    if (exitView) {
      audioManager.play(SfxKeys.win, 0.5);
      this.scene.tweens.add({
        targets: exitView,
        x: exitView.x + this.cellSize * 2.2,
        alpha: 0.35,
        duration: 480,
        ease: 'Cubic.easeIn',
      });
    }

    // Hand the win to the owning scene (MiniGameLoader awards 10 coins +
    // auto-kicks to the hub). Slight delay so the slide-out is visible.
    this.scene.time.delayedCall(260, () => this.emit('win'));
    return true;
  }

  /** Reset the puzzle to its initial layout (does not count as a loss). */
  private reset(): void {
    if (this.resolved) return; // don't reset after a win (scene is leaving)
    this.model = new PuzzleModel(LEVELS[0]);
    this.moveCount = 0;
    this.moveLabel.setText('MOVES: 0');
    this.views.forEach((v) => {
      v.setSelected(false);
      v.enableInput();
    });
    this.model.pieces.forEach((p) => this.syncView(p.id));
    this.refreshExitGlow();
    this.activeView = null;
    logger.debug('Office Rush Hour reset.');
  }

  // ---- cleanup ---------------------------------------------------------

  destroy(fromScene?: boolean): void {
    const input = this.scene?.input;
    if (input) {
      input.off(Phaser.Input.Events.POINTER_DOWN, this.boundDown);
      input.off(Phaser.Input.Events.POINTER_MOVE, this.boundMove);
      input.off(Phaser.Input.Events.POINTER_UP, this.boundUp);
    }
    if (this.boundKey) this.scene?.input.keyboard?.off('keydown', this.boundKey);
    this.views.forEach((v) => v.destroy());
    this.views.clear();
    this.activeView = null;
    super.destroy(fromScene);
  }
}
