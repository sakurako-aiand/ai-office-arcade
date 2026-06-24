/**
 * CrossyOfficeBoard — the playable board for the "Crossy Office" mini-game.
 *
 * A pseudo-3D Crossy-Road-style runner. The player hops forward/left/right
 * across a fixed track (Parking Lot -> Server Room) while cars, delivery
 * carts, and roombas move along horizontal road lanes. Camera follow is a
 * virtual camera (projector + lerped cameraRow) so the HUD stays fixed.
 *
 * Responsibilities:
 *   - track generation (start / floor / road / goal rows with spawn params),
 *   - obstacle pooling + per-row spawning + motion + off-screen release,
 *   - per-frame perspective re-projection of lanes / obstacles / player,
 *   - collision detection (lane-interval overlap, hop-fair row set),
 *   - input: keyboard (arrows + WASD) + mouse/touch tap-zones, with a
 *     directional chevron feedback and one-deep input buffering,
 *   - progress bar + auto-fading instruction overlay,
 *   - win (reach Server Room) / lose (collision) routing via 'win'/'lose'
 *     events; the owning scene maps those to the MiniGameLoader pipeline
 *     (medium = +30 coins on win, 0 on lose/timeout, then auto-kick to hub).
 *
 * Cleanup: destroy() unsubscribes scene update + input listeners, releases the
 * obstacle pool, and tears down every view — no leaks across scene swaps.
 */
import Phaser from 'phaser';
import { ObjectPool } from '../../systems/ObjectPool';
import { audioManager, SfxKeys } from '../../systems/AudioManager';
import { logger } from '../../utils/logger';
import { project } from './projector';
import { ObstacleView } from './ObstacleView';
import { PlayerCharacter } from './PlayerCharacter';
import {
  COLS,
  CENTER_COL,
  TRACK_ROWS,
  GOAL_ROW,
  VISIBLE_ROWS,
  CAMERA_LEAD,
  NEAR_CELL,
  HOP_MS,
  HOP_LIFT_PX,
  INPUT_BUFFER_MS,
  MIN_SPEED,
  MAX_SPEED,
  SPAWN_MIN_MS,
  SPAWN_MAX_MS,
  MAX_OBSTACLES,
  PLAYER_HALF,
  COFFEE_SPAWN_MS,
  MAX_COFFEES,
  CROSSY_COLORS,
} from './config';
import type { RowDef, ObstacleType, MoveDir } from './types';

interface CoffeeState {
  view: Phaser.GameObjects.Container;
  row: number;
  col: number;
  active: boolean;
}

interface HopState {
  fromC: number;
  fromR: number;
  toC: number;
  toR: number;
  t: number; // 0..1
  startedAt: number;
}

export class CrossyOfficeBoard extends Phaser.GameObjects.Container {
  private rows: RowDef[] = [];

  // Virtual camera + player logical state.
  private cameraRow = -CAMERA_LEAD;
  private pCol = CENTER_COL; // continuous (for projection during hops)
  private pRow = 0; // continuous
  private curCol = CENTER_COL; // snapped grid cell
  private curRow = 0;
  private hop: HopState | null = null;
  private buffered: MoveDir | null = null;
  private resolved = false;

  // Views.
  private player: PlayerCharacter;
  private laneGfx: Phaser.GameObjects.Graphics;

  // Obstacle pooling.
  private obstaclePool: ObjectPool<ObstacleView>;
  private activeObstacles: ObstacleView[] = [];

  // Collectibles (coffee) — light, optional, visual-only.
  private coffees: CoffeeState[] = [];
  private nextCoffeeAt = 0;

  // HUD.
  private progressBg: Phaser.GameObjects.Rectangle;
  private progressFill: Phaser.GameObjects.Rectangle;
  private progressLabel: Phaser.GameObjects.Text;

  // Bound handlers (fields so they can be removed on destroy).
  private boundUpdate: (time: number, delta: number) => void;
  private boundKeyDown: (e: KeyboardEvent) => void;
  private boundPointerUp: (p: Phaser.Input.Pointer) => void;

  constructor(scene: Phaser.Scene) {
    super(scene, 0, 0);
    scene.add.existing(this);

    this.buildTrack();

    // Background grid + lanes (redrawn each frame from cameraRow).
    this.laneGfx = scene.add.graphics();
    this.add(this.laneGfx).setDepth(-100);

    // Player.
    this.player = new PlayerCharacter(scene);
    this.add(this.player);

    // Obstacle pool (factory adds each view to this board).
    this.obstaclePool = new ObjectPool<ObstacleView>(
      () => {
        const v = new ObstacleView(scene);
        this.add(v);
        return v;
      },
      6 // prewarm
    );

    // HUD: distance progress bar.
    this.progressBg = scene.add
      .rectangle(scene.scale.width / 2, scene.scale.height - 30, 460, 16, 0x0a1a2a, 0.85)
      .setStrokeStyle(2, CROSSY_COLORS.grid, 0.7)
      .setDepth(500);
    this.add(this.progressBg);
    this.progressFill = scene.add
      .rectangle(
        scene.scale.width / 2 - 228,
        scene.scale.height - 30,
        0,
        10,
        CROSSY_COLORS.goal,
        1
      )
      .setOrigin(0, 0.5)
      .setDepth(501);
    this.add(this.progressFill);
    this.progressLabel = scene.add
      .text(scene.scale.width / 2, scene.scale.height - 52, 'PARKING LOT  ->  SERVER ROOM', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
        color: '#9aa7b4',
        fontStyle: '800',
      })
      .setOrigin(0.5)
      .setDepth(501);
    this.add(this.progressLabel);

    // Input (keyboard + pointer tap-zones). Scene-scoped; removed on destroy.
    this.boundKeyDown = (e) => this.onKeyDown(e);
    this.boundPointerUp = (p) => this.onPointerUp(p);
    scene.input.keyboard?.on('keydown', this.boundKeyDown);
    scene.input.on(Phaser.Input.Events.POINTER_UP, this.boundPointerUp);

    // Per-frame update via the scene's update event (self-contained).
    this.boundUpdate = (time, delta) => this.updateBoard(time, delta);
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.boundUpdate);

    this.showInstructions();
    this.syncPlayerProjection();
    logger.info('CrossyOfficeBoard ready.');
  }

  // ---- track generation -------------------------------------------------

  private buildTrack(): void {
    this.rows = [];
    for (let r = 0; r < TRACK_ROWS; r++) {
      if (r === 0) {
        this.rows.push(this.makeRow(r, 'start'));
      } else if (r === GOAL_ROW) {
        this.rows.push(this.makeRow(r, 'goal'));
      } else {
        // ~60% roads, but never 3 roads in a row (keeps it fair + readable).
        const prev2Road =
          r >= 2 && this.rows[r - 1].type === 'road' && this.rows[r - 2].type === 'road';
        const isRoad = !prev2Road && Math.random() < 0.62;
        this.rows.push(this.makeRow(r, isRoad ? 'road' : 'floor'));
      }
    }
    // TODO(level variations): hand-author named tracks or seed the RNG for
    // deterministic daily layouts. TODO(difficulty scaling): raise road density
    // + speed + shorten spawn intervals for a "hard" variant.
  }

  private makeRow(index: number, type: RowDef['type']): RowDef {
    const dir: 1 | -1 = Math.random() < 0.5 ? 1 : -1;
    const speed = type === 'road' ? MIN_SPEED + Math.random() * (MAX_SPEED - MIN_SPEED) : 0;
    const spawnEvery =
      type === 'road' ? SPAWN_MIN_MS + Math.random() * (SPAWN_MAX_MS - SPAWN_MIN_MS) : 0;
    return {
      index,
      type,
      dir,
      speed,
      spawnEvery,
      // Stagger initial spawns so every lane doesn't fire at once.
      nextSpawnAt: type === 'road' ? Math.random() * spawnEvery : 0,
    };
  }

  // ---- input ------------------------------------------------------------

  private onKeyDown(event: KeyboardEvent): void {
    if (this.resolved) return;
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        this.attemptMove('up');
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        this.attemptMove('down');
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        this.attemptMove('left');
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        this.attemptMove('right');
        break;
    }
  }

  /** Tap-zones: left third = left, right third = right, center = forward. */
  private onPointerUp(pointer: Phaser.Input.Pointer): void {
    if (this.resolved) return;
    // Ignore taps on the HUD progress bar area.
    if (pointer.y > this.scene.scale.height - 70) return;
    const third = this.scene.scale.width / 3;
    if (pointer.x < third) this.attemptMove('left');
    else if (pointer.x > third * 2) this.attemptMove('right');
    else this.attemptMove('up');
  }

  private attemptMove(dir: MoveDir): void {
    if (this.resolved) return;
    // Buffer one input near the end of a hop so fast play feels responsive.
    if (this.hop) {
      const elapsed = this.scene.time.now - this.hop.startedAt;
      if (elapsed >= HOP_MS - INPUT_BUFFER_MS) this.buffered = dir;
      return;
    }
    this.startHop(dir);
  }

  private startHop(dir: MoveDir): void {
    let toC = this.curCol;
    let toR = this.curRow;
    if (dir === 'up') toR = Math.min(GOAL_ROW, this.curRow + 1);
    else if (dir === 'down') toR = Math.max(0, this.curRow - 1);
    else if (dir === 'left') toC = Math.max(0, this.curCol - 1);
    else toC = Math.min(COLS - 1, this.curCol + 1);

    // No-op if blocked at an edge.
    if (toC === this.curCol && toR === this.curRow) return;

    this.hop = {
      fromC: this.curCol,
      fromR: this.curRow,
      toC,
      toR,
      t: 0,
      startedAt: this.scene.time.now,
    };
    this.buffered = null;
    audioManager.play(SfxKeys.click, 0.3);
    this.spawnInputFeedback(dir);
  }

  /** Brief directional chevron at the player's position. */
  private spawnInputFeedback(dir: MoveDir): void {
    const p = project(this.pCol, this.pRow, this.cameraRow);
    const glyph = dir === 'up' ? '\u25B2' : dir === 'down' ? '\u25BC' : dir === 'left' ? '\u25C0' : '\u25B6';
    const fb = this.scene.add
      .text(p.x, p.y - 24, glyph, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '20px',
        color: '#bfe3ff',
        fontStyle: '800',
      })
      .setOrigin(0.5)
      .setDepth(600);
    this.scene.tweens.add({
      targets: fb,
      y: fb.y - 24,
      alpha: 0,
      duration: 360,
      ease: 'Cubic.easeOut',
      onComplete: () => fb.destroy(),
    });
  }

  // ---- per-frame update -------------------------------------------------

  private updateBoard(time: number, delta: number): void {
    if (this.resolved) return;

    // 1. Advance the hop.
    if (this.hop) {
      this.hop.t += delta / HOP_MS;
      if (this.hop.t >= 1) {
        this.hop.t = 1;
        this.curCol = this.hop.toC;
        this.curRow = this.hop.toR;
        const finished = this.hop;
        this.hop = null;
        this.onHopLand();
        // If landing resolved the game, stop further simulation.
        if (this.resolved) return;
        void finished;
      }
    }

    // 2. Compute continuous player position (eased) for projection + collision.
    if (this.hop) {
      const e = this.easeOut(this.hop.t);
      this.pCol = this.hop.fromC + (this.hop.toC - this.hop.fromC) * e;
      this.pRow = this.hop.fromR + (this.hop.toR - this.hop.fromR) * e;
    } else {
      this.pCol = this.curCol;
      this.pRow = this.curRow;
    }

    // 3. Virtual camera follow (lerp toward player row).
    const targetCam = Phaser.Math.Clamp(
      this.pRow - CAMERA_LEAD,
      -CAMERA_LEAD,
      GOAL_ROW - VISIBLE_ROWS + CAMERA_LEAD
    );
    const smooth = Math.min(1, delta / 120);
    this.cameraRow += (targetCam - this.cameraRow) * smooth;

    // 4. Spawn / move / release obstacles.
    this.updateObstacles(time, delta);

    // 5. Coffees (optional collectibles).
    this.updateCoffees(time);

    // 6. Render everything (perspective re-projection).
    this.renderLanes();
    this.renderObstacles();
    this.syncPlayerProjection();

    // 7. Progress bar.
    this.progressFill.width = 456 * (this.curRow / GOAL_ROW);

    // 8. Collisions.
    if (!this.resolved) this.checkCollisions();
  }

  private onHopLand(): void {
    // Win check first.
    if (this.curRow >= GOAL_ROW) {
      this.triggerWin();
      return;
    }
    // Consume a buffered input for responsive chaining.
    if (this.buffered) {
      const next = this.buffered;
      this.buffered = null;
      this.startHop(next);
    }
  }

  // ---- obstacles --------------------------------------------------------

  private updateObstacles(time: number, delta: number): void {
    const lo = Math.floor(this.cameraRow - 1);
    const hi = Math.ceil(this.cameraRow + VISIBLE_ROWS + 1);

    // Spawn for road rows in view.
    for (let r = Math.max(0, lo); r <= Math.min(GOAL_ROW, hi); r++) {
      const row = this.rows[r];
      if (row.type !== 'road') continue;
      if (time >= row.nextSpawnAt && this.activeObstacles.length < MAX_OBSTACLES) {
        this.spawnObstacle(row);
        row.nextSpawnAt = time + row.spawnEvery;
      }
    }

    // Move + release.
    const dt = delta / 1000;
    for (let i = this.activeObstacles.length - 1; i >= 0; i--) {
      const o = this.activeObstacles[i];
      o.col += o.dir * o.speed * dt;
      const half = o.length / 2;
      // Release when fully off the track.
      if ((o.dir === 1 && o.col - half > COLS + 0.5) || (o.dir === -1 && o.col + half < -0.5)) {
        this.activeObstacles.splice(i, 1);
        this.obstaclePool.release(o);
      }
    }
  }

  private spawnObstacle(row: RowDef): void {
    const types: ObstacleType[] = ['car', 'cart', 'roomba'];
    const type = types[Math.floor(Math.random() * types.length)];
    const o = this.obstaclePool.obtain();
    const startCol = row.dir === 1 ? -1 : COLS;
    o.configure(type, row.index, startCol, row.dir, row.speed);
    this.activeObstacles.push(o);
  }

  // ---- collectibles (visual-only coffee) -------------------------------

  private updateCoffees(time: number): void {
    if (time >= this.nextCoffeeAt && this.coffees.filter((c) => c.active).length < MAX_COFFEES) {
      this.nextCoffeeAt = time + COFFEE_SPAWN_MS;
      this.spawnCoffee();
    }
    // Pickup: player standing on a coffee cell.
    for (const c of this.coffees) {
      if (!c.active) continue;
      if (c.row === this.curRow && c.col === this.curCol && !this.hop) {
        this.collectCoffee(c);
      }
    }
  }

  private spawnCoffee(): void {
    // Place on a random safe/floor row in view.
    const lo = Math.max(1, Math.floor(this.cameraRow + 1));
    const hi = Math.min(GOAL_ROW - 1, Math.ceil(this.cameraRow + VISIBLE_ROWS - 1));
    if (hi <= lo) return;
    let row = lo;
    let attempts = 0;
    do {
      row = lo + Math.floor(Math.random() * (hi - lo + 1));
      attempts++;
    } while (this.rows[row].type === 'road' && attempts < 8);
    if (this.rows[row].type === 'road') return;

    const col = Math.floor(Math.random() * COLS);
    // Reuse an inactive coffee view if available.
    let slot = this.coffees.find((c) => !c.active);
    if (!slot) {
      const view = this.makeCoffeeView();
      slot = { view, row: 0, col: 0, active: false };
      this.coffees.push(slot);
    }
    slot.row = row;
    slot.col = col;
    slot.active = true;
    slot.view.setVisible(true).setActive(true);
  }

  private makeCoffeeView(): Phaser.GameObjects.Container {
    const c = this.scene.add.container(0, 0).setDepth(200);
    const cup = this.scene.add.rectangle(0, 0, NEAR_CELL * 0.34, NEAR_CELL * 0.4, CROSSY_COLORS.coffee, 1);
    const top = this.scene.add.rectangle(0, -NEAR_CELL * 0.2, NEAR_CELL * 0.3, NEAR_CELL * 0.12, CROSSY_COLORS.coffeeTop, 1);
    c.add([cup, top]);
    this.add(c);
    return c;
  }

  private collectCoffee(c: CoffeeState): void {
    c.active = false;
    c.view.setVisible(false).setActive(false);
    audioManager.play(SfxKeys.coin, 0.35);
    // Pure visual feedback — does not affect scoring.
    const p = project(this.pCol, this.pRow, this.cameraRow);
    const pop = this.scene.add
      .text(p.x, p.y - 20, '\u2615 +1', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        color: '#d4a373',
        fontStyle: '800',
      })
      .setOrigin(0.5)
      .setDepth(600);
    this.scene.tweens.add({
      targets: pop,
      y: pop.y - 30,
      alpha: 0,
      duration: 600,
      onComplete: () => pop.destroy(),
    });
  }

  // ---- collisions -------------------------------------------------------

  private checkCollisions(): void {
    // Rows the player currently overlaps (hop-fair: both ends of a hop).
    const rowSet = new Set<number>();
    if (this.hop) {
      rowSet.add(this.hop.fromR);
      rowSet.add(this.hop.toR);
    } else {
      rowSet.add(this.curRow);
    }

    for (const o of this.activeObstacles) {
      if (!rowSet.has(o.row)) continue;
      // Lane-interval overlap (obstacle col is its CENTER; length spans around it).
      const oL = o.col - o.length / 2;
      const oR = o.col + o.length / 2;
      const pL = this.pCol - PLAYER_HALF;
      const pR = this.pCol + PLAYER_HALF;
      if (pL < oR && pR > oL) {
        this.triggerLose();
        return;
      }
    }
  }

  // ---- rendering --------------------------------------------------------

  private renderLanes(): void {
    const g = this.laneGfx;
    g.clear();
    const lo = Math.floor(this.cameraRow - 1);
    const hi = Math.ceil(this.cameraRow + VISIBLE_ROWS + 1);
    for (let r = Math.max(0, lo); r <= Math.min(GOAL_ROW, hi); r++) {
      this.drawLaneStrip(r);
    }
  }

  /** Draw one row's band (a perspective trapezoid) + its accents. */
  private drawLaneStrip(r: number): void {
    const g = this.laneGfx;
    const row = this.rows[r];
    // Band spans from row r-0.5 (nearer, bottom) to r+0.5 (farther, top).
    const bl = project(-0.5, r - 0.5, this.cameraRow);
    const br = project(COLS - 0.5, r - 0.5, this.cameraRow);
    const tr = project(COLS - 0.5, r + 0.5, this.cameraRow);
    const tl = project(-0.5, r + 0.5, this.cameraRow);

    let fill: number = CROSSY_COLORS.floor;
    if (row.type === 'road') fill = (r % 2 === 0) ? CROSSY_COLORS.road : CROSSY_COLORS.roadEdge;
    else if (row.type === 'start') fill = CROSSY_COLORS.start;
    else if (row.type === 'goal') fill = CROSSY_COLORS.goal;
    else fill = (r % 2 === 0) ? CROSSY_COLORS.floor : CROSSY_COLORS.floorAlt;

    g.fillStyle(fill, 0.95);
    g.fillPoints(
      [
        new Phaser.Geom.Point(bl.x, bl.y),
        new Phaser.Geom.Point(br.x, br.y),
        new Phaser.Geom.Point(tr.x, tr.y),
        new Phaser.Geom.Point(tl.x, tl.y),
      ],
      true,
      true
    );

    // Dashed lane dividers on roads; faint grid lines on floors.
    if (row.type === 'road') {
      g.lineStyle(2, CROSSY_COLORS.laneLine, 0.5);
      for (let c = 1; c < COLS; c++) {
        const a = project(c - 0.5, r - 0.5, this.cameraRow);
        const b = project(c - 0.5, r + 0.5, this.cameraRow);
        // dashed: draw short segments along a-b
        const steps = 4;
        for (let s = 0; s < steps; s += 2) {
          const t0 = s / steps;
          const t1 = (s + 1) / steps;
          g.lineBetween(
            a.x + (b.x - a.x) * t0,
            a.y + (b.y - a.y) * t0,
            a.x + (b.x - a.x) * t1,
            a.y + (b.y - a.y) * t1
          );
        }
      }
    }

    // Row edge line (subtle grid).
    g.lineStyle(1, CROSSY_COLORS.grid, 0.35);
    g.lineBetween(bl.x, bl.y, br.x, br.y);
  }

  private renderObstacles(): void {
    for (const o of this.activeObstacles) {
      const p = project(o.col, o.row, this.cameraRow);
      o.setPosition(p.x, p.y);
      o.setScale(p.scale);
      // Nearer rows draw on top of farther rows.
      o.setDepth(900 - Math.round((o.row - this.cameraRow) * 10));
    }
    // Coffees too.
    for (const c of this.coffees) {
      if (!c.active) continue;
      const p = project(c.col, c.row, this.cameraRow);
      c.view.setPosition(p.x, p.y);
      c.view.setScale(p.scale);
      c.view.setDepth(850 - Math.round((c.row - this.cameraRow) * 10));
    }
  }

  private syncPlayerProjection(): void {
    const p = project(this.pCol, this.pRow, this.cameraRow);
    // Hop arc: lift the player up mid-hop, and pop scale slightly.
    let lift = 0;
    let scaleBoost = 1;
    if (this.hop) {
      lift = Math.sin(this.hop.t * Math.PI) * HOP_LIFT_PX;
      scaleBoost = 1 + Math.sin(this.hop.t * Math.PI) * 0.12;
    }
    this.player.setPosition(p.x, p.y - lift);
    this.player.setScale(p.scale * scaleBoost);
    this.player.setDepth(950 - Math.round((this.pRow - this.cameraRow) * 10));
  }

  // ---- win / lose routing ----------------------------------------------

  private triggerWin(): void {
    if (this.resolved) return;
    this.resolved = true;
    audioManager.play(SfxKeys.win, 0.6);
    // Slide the player into the Server Room for a satisfying finish.
    const p = project(this.pCol, this.pRow, this.cameraRow);
    this.scene.tweens.add({
      targets: this.player,
      y: p.y - 40,
      alpha: 0.5,
      scale: p.scale * 1.2,
      duration: 450,
      ease: 'Back.easeOut',
    });
    this.scene.time.delayedCall(360, () => this.emit('win'));
  }

  private triggerLose(): void {
    if (this.resolved) return;
    this.resolved = true;
    this.player.flashCollision();
    audioManager.play(SfxKeys.lose, 0.6);
    this.scene.time.delayedCall(320, () => this.emit('lose'));
  }

  // ---- instruction overlay ---------------------------------------------

  private showInstructions(): void {
    const { width, height } = this.scene.scale;
    const overlay = this.scene.add.container(width / 2, height / 2 + 30).setDepth(550);
    const panel = this.scene.add
      .rectangle(0, 0, 620, 78, 0x0a1a2a, 0.92)
      .setStrokeStyle(2, CROSSY_COLORS.player, 0.7);
    const text = this.scene.add
      .text(
        0,
        -8,
        'CROSSY OFFICE',
        {
          fontFamily: 'Press Start 2P, monospace',
          fontSize: '13px',
          color: '#22c55e',
        }
      )
      .setOrigin(0.5);
    const sub = this.scene.add
      .text(
        0,
        16,
        'Arrows / WASD / tap to hop \u2014 reach the SERVER ROOM \u2191',
        {
          fontFamily: 'Inter, sans-serif',
          fontSize: '13px',
          color: '#c7d2dc',
        }
      )
      .setOrigin(0.5);
    overlay.add([panel, text, sub]);
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

  // ---- helpers ----------------------------------------------------------

  private easeOut(t: number): number {
    return 1 - (1 - t) * (1 - t); // easeOutQuad
  }

  // ---- cleanup ---------------------------------------------------------

  destroy(fromScene?: boolean): void {
    const scene = this.scene;
    scene?.events.off(Phaser.Scenes.Events.UPDATE, this.boundUpdate);
    scene?.input.keyboard?.off('keydown', this.boundKeyDown);
    scene?.input.off(Phaser.Input.Events.POINTER_UP, this.boundPointerUp);

    this.obstaclePool?.destroy();
    this.activeObstacles = [];
    this.coffees.forEach((c) => c.view.destroy());
    this.coffees = [];
    this.hop = null;
    super.destroy(fromScene);
    logger.debug('CrossyOfficeBoard destroyed.');
  }
}
