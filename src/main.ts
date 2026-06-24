/**
 * Application entry point.
 *
 * Boots the Phaser game from #game, then removes the HTML boot splash once the
 * canvas is ready. Core systems are lazily created as singletons on first use
 * (see state/systems).
 */
import Phaser from 'phaser';
import { gameConfig } from './config/game.config';
import { logger } from './utils/logger';

// Fail fast and clearly if the mount node is missing.
const parent = document.getElementById('game');
if (!parent) {
  throw new Error('Fatal: #game mount element not found in index.html');
}

logger.info('Booting ai& Office Arcade…');

export const game = new Phaser.Game(gameConfig);

// Remove the HTML splash overlay once Phaser has rendered its first frame.
game.events.once(Phaser.Core.Events.READY, () => {
  const splash = document.getElementById('boot-splash');
  if (splash) {
    splash.style.opacity = '0';
    window.setTimeout(() => splash.remove(), 500);
  }
  logger.info('Phaser ready — splash removed.');
});

// Surface fatal Phaser errors in the console (dev) and could later report them.
game.events.on(Phaser.Core.Events.HIDDEN, () => logger.debug('Game tab hidden.'));
game.events.on(Phaser.Core.Events.VISIBLE, () => logger.debug('Game tab visible.'));

// Expose for debugging in dev tools (read-only intent).
if (import.meta.env?.MODE !== 'production') {
  (window as unknown as { __game?: Phaser.Game }).__game = game;
}
