/**
 * CoinCounter — persistent HUD widget (coin icon + live count).
 *
 * Lives in a container so it can be placed once and repositioned. It subscribes
 * to GameState `coins:changed` and animates a little bump whenever the balance
 * changes. The same widget is reused in the hub and the shop overlay.
 */
import Phaser from 'phaser';
import { COLORS, TEXTURE_KEYS } from '../config/constants';
import { gameState, GameStateEvents } from '../state/GameState';
import { audioManager, SfxKeys } from '../systems/AudioManager';

export class CoinCounter extends Phaser.GameObjects.Container {
  private label: Phaser.GameObjects.Text;
  private icon: Phaser.GameObjects.Image;
  private onChange: (coins: number) => void;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y);
    this.setScrollFactor(0).setDepth(50);

    // pill background
    const pill = scene.add.rectangle(0, 0, 150, 48, COLORS.deepBlue, 0.85).setOrigin(0.5);
    pill.setStrokeStyle(2, COLORS.blue, 0.8);
    this.add(pill);

    this.icon = scene.add.image(-48, 0, TEXTURE_KEYS.coin).setScale(1.1);
    this.add(this.icon);

    this.label = scene.add
      .text(-22, 0, '0', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '22px',
        color: '#fde68a',
        fontStyle: '800',
      })
      .setOrigin(0, 0.5);
    this.add(this.label);

    scene.add.existing(this);

    // React to coin changes from anywhere in the app.
    this.onChange = (coins: number) => this.refresh(coins, true);
    gameState.on(GameStateEvents.CoinsChanged, this.onChange);
    this.refresh(gameState.getCoins(), false);
  }

  private refresh(coins: number, animate: boolean): void {
    this.label.setText(String(coins));
    if (animate) {
      audioManager.play(SfxKeys.coin, 0.5);
      this.scene.tweens.add({
        targets: this.icon,
        scale: 1.4,
        duration: 120,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
  }

  destroy(fromScene?: boolean): void {
    gameState.off(GameStateEvents.CoinsChanged, this.onChange);
    super.destroy(fromScene);
  }
}
