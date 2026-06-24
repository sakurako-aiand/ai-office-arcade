# ai& Office Arcade

A production-ready, modular starter codebase for a 2D arcade-style game built with
**Phaser 3 + TypeScript + Vite**.

Players stand in a stylized **ai&** office hub and step onto one of three platforms
(Easy / Medium / Hard) to enter a strictly timed (3-minute) mini-game. Win → coins,
lose/time-up → back to the hub spawn. Coins are spent in a **claw-machine shop** to
collect colored balls (common / rare / legendary). All progress persists via
`localStorage`.

> **Phase 1 scope:** architecture, flow, and core systems only. Mini-games are
> placeholders with `TODO` markers. Placeholder shapes are used in place of art.

---

## Quick start

```bash
npm install        # install deps
npm run dev        # local dev server (http://localhost:5173)
npm run build      # production build -> ./dist
npm run preview    # preview the production build locally
npm run typecheck  # tsc --noEmit
```

## Deploy

This repo is wired for **build.io** (Heroku-compatible):

- `Procfile` → `web: node server.js`
- `server.js` → thin Express static server for `./dist`
- `heroku-postbuild` script runs `vite build` during the platform build phase

```bash
bld config:set NPM_CONFIG_PRODUCTION=false -a game-ai   # only if build tools get pruned
git push bld main
bld ps:scale web=1 -a game-ai
```

---

## Architecture

```
src/
├── main.ts                 # Phaser game bootstrap + config wiring
├── config/
│   ├── game.config.ts      # Phaser config (renderer, scale, colors, scenes)
│   └── constants.ts        # Tunables: timer, rewards, ball tiers, storage keys
├── state/
│   ├── SaveManager.ts      # localStorage wrapper w/ graceful error handling
│   ├── GameState.ts        # Centralized reactive state store (singleton)
│   ├── CoinManager.ts      # add / remove / save / load coins
│   └── InventoryManager.ts # ball inventory across rarity tiers (persisted)
├── systems/
│   ├── InputHandler.ts     # unified mouse / keyboard / touch input
│   ├── SceneManager.ts     # scene routing + transitions
│   ├── TransitionManager.ts# fade / scan transitions
│   ├── ObjectPool.ts       # generic object pooling (memory-leak safety)
│   └── AudioManager.ts     # ambient + SFX placeholders
├── scenes/
│   ├── BootScene.ts        # scale/style init, generates placeholder textures
│   ├── PreloadScene.ts     # asset loading hook (TODO: real assets)
│   ├── HubScene.ts         # office hub: spawn, 3 platforms, shop, coin HUD
│   ├── MiniGameLoader.ts   # BASE class: 3-min timer, progress bar, auto-kick
│   ├── EasyGameScene.ts    # placeholder (extends MiniGameLoader)
│   ├── MediumGameScene.ts  # placeholder (extends MiniGameLoader)
│   ├── HardGameScene.ts    # placeholder (extends MiniGameLoader)
│   └── ShopOverlay.ts      # claw-machine overlay (insert coin -> claw -> ball)
├── ui/
│   ├── CoinCounter.ts      # coin HUD widget
│   └── CountdownTimer.ts   # 3-min countdown + progress bar widget
└── utils/
    ├── logger.ts           # leveled logging
    └── shapes.ts           # drawing helpers for placeholder shapes/textures
```

### Design rules implemented

- **Centralized state** — `GameState` is the single source of truth; it delegates
  to `CoinManager` / `InventoryManager` and persists through `SaveManager`.
- **Scene-based routing** — `SceneManager` wraps all transitions with fade
  transitions and guarantees scene teardown (no leaks).
- **Strict 3-minute timer** — `MiniGameLoader` owns the countdown, progress bar,
  and the auto-kick pipeline (win / lose / time-up → hub spawn).
- **Economy pipeline** — winning calls `GameState.awardCoins(reward)`; the shop
  consumes coins via `GameState.spendCoins(cost)`.
- **Persistence** — coins + inventory saved to `localStorage` with try/catch
  fallback for privacy mode / quota errors.
- **Input** — mouse, keyboard, and touch unified through `InputHandler`.
- **Branding** — the `ai&` logo is drawn in the hub, loading splash, and shop.

## Tuning

All gameplay constants live in `src/config/constants.ts` (timer length, rewards,
ball drop tables, costs, colors).
