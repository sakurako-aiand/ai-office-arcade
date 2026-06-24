/**
 * Procedural placeholder art helpers.
 *
 * Until real assets are integrated, every visual is generated from colored
 * shapes so the game looks intentional rather than empty. Replace these calls
 * with `this.load.image(...)` in PreloadScene when art is ready.
 */
import Phaser from 'phaser';
import { COLORS, TEXTURE_KEYS } from '../config/constants';

/** 1x1 white pixel texture — the workhorse for rectangles, bars, tints. */
export function makePixelTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.pixel)) return;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0xffffff, 1);
  g.fillRect(0, 0, 1, 1);
  g.generateTexture(TEXTURE_KEYS.pixel, 1, 1);
  g.destroy();
}

/** Rounded platform pad texture (tinted per-difficulty at runtime). */
export function makePlatformTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.platform)) return;
  const w = 220;
  const h = 70;
  const g = scene.make.graphics({ x: 0, y: 0 });
  // base
  g.fillStyle(0x0a1a2a, 1);
  g.fillRoundedRect(0, 0, w, h, 16);
  // top accent
  g.fillStyle(0xffffff, 0.9);
  g.fillRoundedRect(8, 6, w - 16, 10, 6);
  // glow border
  g.lineStyle(3, 0xffffff, 0.5);
  g.strokeRoundedRect(2, 2, w - 4, h - 4, 14);
  g.generateTexture(TEXTURE_KEYS.platform, w, h);
  g.destroy();
}

/** Coin texture (gold disc with inner ring). */
export function makeCoinTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.coin)) return;
  const r = 18;
  const d = r * 2;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(COLORS.coinEdge, 1);
  g.fillCircle(r, r, r);
  g.fillStyle(COLORS.coin, 1);
  g.fillCircle(r, r, r - 3);
  g.lineStyle(2, COLORS.coinEdge, 1);
  g.strokeCircle(r, r, r - 6);
  g.generateTexture(TEXTURE_KEYS.coin, d, d);
  g.destroy();
}

/** Ball texture (tinted at runtime; used by claw machine). */
export function makeBallTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.ball)) return;
  const r = 22;
  const d = r * 2;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0xffffff, 1);
  g.fillCircle(r, r, r);
  // highlight
  g.fillStyle(0xffffff, 0.5);
  g.fillCircle(r - 6, r - 6, 5);
  g.generateTexture(TEXTURE_KEYS.ball, d, d);
  g.destroy();
}

/** Player avatar placeholder (rounded chip with a head silhouette). */
export function makePlayerTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.playerAvatar)) return;
  const w = 96;
  const h = 96;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(COLORS.deepBlue, 1);
  g.fillRoundedRect(0, 0, w, h, 20);
  g.lineStyle(3, COLORS.blue, 1);
  g.strokeRoundedRect(2, 2, w - 4, h - 4, 18);
  // head
  g.fillStyle(COLORS.gray, 1);
  g.fillCircle(w / 2, 38, 16);
  // shoulders
  g.fillCircle(w / 2, 90, 30);
  g.generateTexture(TEXTURE_KEYS.playerAvatar, w, h);
  g.destroy();
}

/** Claw arm texture (simple mechanical grabber). */
export function makeClawTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.claw)) return;
  const w = 60;
  const h = 80;
  const g = scene.make.graphics({ x: 0, y: 0 });
  g.fillStyle(0x9aa7b4, 1);
  g.fillRect(26, 0, 8, 40); // rod
  g.fillStyle(0x6b7785, 1);
  g.fillRect(10, 40, 40, 10); // head
  // prongs
  g.fillStyle(0x9aa7b4, 1);
  g.fillRect(14, 50, 6, 30);
  g.fillRect(40, 50, 6, 30);
  g.generateTexture(TEXTURE_KEYS.claw, w, h);
  g.destroy();
}

/** The ai& wordmark texture, drawn for hub + shop branding. */
export function makeLogoTexture(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE_KEYS.logo)) return;
  const w = 360;
  const h = 120;
  const g = scene.make.graphics({ x: 0, y: 0 });
  // backdrop
  g.fillStyle(0xffffff, 0.06);
  g.fillRoundedRect(0, 0, w, h, 24);
  g.lineStyle(2, COLORS.blue, 0.6);
  g.strokeRoundedRect(1, 1, w - 2, h - 2, 23);
  g.generateTexture(TEXTURE_KEYS.logo, w, h);
  g.destroy();
  // NOTE: the "ai&" text is rendered with a real Text object on top of this
  // texture so it stays crisp at any scale (see HubScene / ShopOverlay).
}

/** Convenience: generate every placeholder texture for a scene. */
export function makeAllPlaceholderTextures(scene: Phaser.Scene): void {
  makePixelTexture(scene);
  makePlatformTexture(scene);
  makeCoinTexture(scene);
  makeBallTexture(scene);
  makePlayerTexture(scene);
  makeClawTexture(scene);
  makeLogoTexture(scene);
}
