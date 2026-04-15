import BootScene     from './scenes/BootScene.js';
import TitleScene    from './scenes/TitleScene.js';
import TutorialScene from './scenes/TutorialScene.js';
import TrailerScene  from './scenes/TrailerScene.js';
import { Game3D }    from './scenes/Game3D.js';

// ── Phaser — menus only ───────────────────────────────────────────────────────
const phaserConfig = {
    type: Phaser.AUTO,
    width: 576,
    height: 640,
    parent: 'phaser-container',
    backgroundColor: '#0b1220',
    pixelArt: false,
    antialias: true,
    scene: [BootScene, TitleScene, TutorialScene, TrailerScene],
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }
};
const phaserGame = new Phaser.Game(phaserConfig);

// ── Three.js gameplay ─────────────────────────────────────────────────────────
const threeContainer = document.getElementById('three-container');
const threeCanvas    = document.getElementById('three-canvas');
const game3d         = new Game3D(threeCanvas);

// ── Bridge: Phaser → Three.js ─────────────────────────────────────────────────
window.startGame3D = (levelIndex = 0) => {
    // Stop any running loop before switching
    game3d.stop();
    document.getElementById('phaser-container').style.display = 'none';
    threeContainer.style.display = 'block';
    // loadLevel stops internally, then we start fresh
    game3d.loadLevel(levelIndex);
    game3d.start();
};

// ── Bridge: Three.js → Phaser ─────────────────────────────────────────────────
window.goToTitle3D = () => {
    // Stop RAF immediately — prevents blank frame flash on canvas swap
    game3d.stop();

    // Swap containers
    threeContainer.style.display = 'none';
    document.getElementById('phaser-container').style.display = 'block';

    // Safely restart Phaser at TitleScene
    // Small delay ensures the phaser canvas is painted before scene boots
    setTimeout(() => {
        try {
            phaserGame.scene.getScenes(true).forEach(s => {
                phaserGame.scene.stop(s.sys.settings.key);
            });
        } catch (_) {}
        try {
            phaserGame.scene.start('TitleScene');
        } catch (_) {}
    }, 50);
};
