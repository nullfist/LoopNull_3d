export default class TitleScene extends Phaser.Scene {
    constructor() { super('TitleScene'); }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;

        const gridGfx = this.add.graphics();
        this._drawGrid(gridGfx, W, H);
        this.tweens.add({ targets: gridGfx, y: 64, duration: 8000, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        this._spawnDemoGhosts(W, H);

        const logo = this.add.text(W / 2, H * 0.28, 'LOOP\nARCHITECT', {
            fontSize: '52px', fontFamily: 'Segoe UI, Arial',
            fill: '#00e5ff', fontStyle: 'bold', align: 'center',
            stroke: '#003344', strokeThickness: 6, lineSpacing: 4
        }).setOrigin(0.5).setAlpha(0);

        this.tweens.add({
            targets: logo, alpha: 1, duration: 700, ease: 'Quad.easeOut',
            onComplete: () => this.tweens.add({
                targets: logo, scaleX: 1.02, scaleY: 1.02,
                duration: 2200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
            })
        });

        this.add.text(W / 2, H * 0.52, 'Use your past self to solve the present.', {
            fontSize: '14px', fontFamily: 'Segoe UI, Arial', fill: '#64748b', align: 'center'
        }).setOrigin(0.5);

        const btnY = H * 0.65;
        const btn = this.add.rectangle(W / 2, btnY, 200, 50, 0x00e5ff).setInteractive({ useHandCursor: true });
        const btnText = this.add.text(W / 2, btnY, 'START GAME', {
            fontSize: '16px', fontFamily: 'Segoe UI, Arial', fill: '#0d1b2a', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(1);
        btn.on('pointerover',  () => { btn.setFillStyle(0x67e8f9); btnText.setScale(1.05); });
        btn.on('pointerout',   () => { btn.setFillStyle(0x00e5ff); btnText.setScale(1); });
        btn.on('pointerdown',  () => this._startGame());

        // ── How to Play  |  ▶ Trailer ────────────────────────────────
        const howBtn = this.add.text(W / 2 - 72, H * 0.76, '[ How to Play ]', {
            fontSize: '13px', fontFamily: 'Segoe UI, Arial', fill: '#334155'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        howBtn.on('pointerover',  () => howBtn.setStyle({ fill: '#94a3b8' }));
        howBtn.on('pointerout',   () => howBtn.setStyle({ fill: '#334155' }));
        howBtn.on('pointerdown',  () => this.scene.start('TutorialScene', { fromTitle: true }));

        const trailerBtn = this.add.text(W / 2 + 72, H * 0.76, '[ ▶ Trailer ]', {
            fontSize: '13px', fontFamily: 'Segoe UI, Arial', fill: '#334155'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        trailerBtn.on('pointerover',  () => trailerBtn.setStyle({ fill: '#00e5ff' }));
        trailerBtn.on('pointerout',   () => trailerBtn.setStyle({ fill: '#334155' }));
        trailerBtn.on('pointerdown',  () => {
            this.cameras.main.fadeOut(300, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TrailerScene'));
        });

        // ── Version tag ───────────────────────────────────────────────
        this.add.text(W - 10, H - 10, 'v1.0', {
            fontSize: '11px', fontFamily: 'Segoe UI, Arial', fill: '#1e3a5f'
        }).setOrigin(1, 1);

        // ── Level select ──────────────────────────────────────────────
        const beaten = JSON.parse(localStorage.getItem('looparchitect_beaten') || '[]');
        if (beaten.length > 0) {
            this.add.text(W / 2, H * 0.84, 'LEVEL SELECT', {
                fontSize: '11px', fontFamily: 'Segoe UI, Arial', fill: '#334155', fontStyle: 'bold'
            }).setOrigin(0.5);
            const total = 10, pipW = 28, gap = 6;
            const startX = W / 2 - (total * (pipW + gap) - gap) / 2 + pipW / 2;
            for (let i = 0; i < total; i++) {
                const unlocked = i === 0 || beaten.includes(i - 1);
                const isBeaten = beaten.includes(i);
                const col = isBeaten ? 0x22c55e : (unlocked ? 0x1e3a5f : 0x0d1b2a);
                const pip = this.add.rectangle(startX + i * (pipW + gap), H * 0.91, pipW, pipW, col)
                    .setInteractive({ useHandCursor: unlocked });
                this.add.text(startX + i * (pipW + gap), H * 0.91, `${i + 1}`, {
                    fontSize: '11px', fontFamily: 'Segoe UI, Arial',
                    fill: isBeaten ? '#0d1b2a' : (unlocked ? '#64748b' : '#1e3a5f')
                }).setOrigin(0.5).setDepth(1);
                if (unlocked) {
                    pip.on('pointerdown', () => this._startLevel(i));
                    pip.on('pointerover',  () => pip.setFillStyle(isBeaten ? 0x4ade80 : 0x2d5a8e));
                    pip.on('pointerout',   () => pip.setFillStyle(col));
                }
            }
        }

        const whisper = this.add.text(W / 2, H * 0.96, "You didn't escape time. You became it.", {
            fontSize: '11px', fontFamily: 'Segoe UI, Arial', fill: '#1e3a5f'
        }).setOrigin(0.5).setAlpha(0);
        this.tweens.add({ targets: whisper, alpha: 0.6, duration: 3000, delay: 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

        this.input.keyboard.once('keydown-SPACE', () => this._startGame());
        this.input.keyboard.once('keydown-ENTER', () => this._startGame());
    }

    _startLevel(index) {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => {
            window.startGame3D(index);
        });
    }

    _goToTutorial() {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TutorialScene', { fromTitle: false }));
    }

    _startGame() {
        this.cameras.main.fadeOut(300, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => window.startGame3D(0));
    }

    _drawGrid(gfx, W, H) {
        gfx.lineStyle(1, 0x1e3a5f, 0.4);
        const step = 64;
        for (let x = 0; x < W; x += step) gfx.lineBetween(x, 0, x, H);
        for (let y = 0; y < H; y += step) gfx.lineBetween(0, y, W, y);
    }

    _spawnDemoGhosts(W, H) {
        const colors = [0x7c6fff, 0xff6b9d, 0xffd166, 0x00e5ff];
        for (let i = 0; i < 6; i++) {
            const x = Phaser.Math.Between(32, W - 32);
            const y = Phaser.Math.Between(32, H - 32);
            const sq = this.add.rectangle(x, y, 28, 28, colors[i % colors.length], 0.12);
            this.tweens.add({
                targets: sq,
                x: x + Phaser.Math.Between(-80, 80),
                y: y + Phaser.Math.Between(-80, 80),
                alpha: { from: 0.05, to: 0.18 },
                duration: Phaser.Math.Between(3000, 6000),
                yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: i * 400
            });
        }
    }
}
