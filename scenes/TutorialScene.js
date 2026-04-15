/*
 * TutorialScene.js
 * Step-by-step interactive tutorial. Each "card" explains one mechanic
 * with a live mini-demo rendered in the scene itself.
 */

const W_HALF = 288; // half of 576

export default class TutorialScene extends Phaser.Scene {
    constructor() { super('TutorialScene'); }

    init(data) {
        this.fromTitle = data?.fromTitle ?? false;
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;

        this.cardIndex = 0;
        this.demoObjects = [];
        this._demoTimers = [];

        // ── Background ────────────────────────────────────────────────
        this.add.rectangle(W / 2, H / 2, W, H, 0x060d1a);
        this._drawGrid(W, H);

        // ── Header bar ────────────────────────────────────────────────
        this.add.rectangle(W / 2, 26, W, 52, 0x0d1b2a).setDepth(10);
        this.add.rectangle(W / 2, 52, W, 2, 0x1e3a5f).setDepth(10);
        this.add.text(W / 2, 26, 'HOW TO PLAY', {
            fontSize: '14px', fontFamily: 'Segoe UI, Arial',
            fill: '#00e5ff', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11);

        // ── Card container ────────────────────────────────────────────
        this.cardBg = this.add.rectangle(W / 2, H / 2 + 10, W - 40, 340, 0x0d1b2a, 0.95)
            .setStrokeStyle(1, 0x1e3a5f).setDepth(5);

        this.stepLabel = this.add.text(W / 2, 80, '', {
            fontSize: '11px', fontFamily: 'Segoe UI, Arial', fill: '#334155', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(6);

        this.titleText = this.add.text(W / 2, 105, '', {
            fontSize: '22px', fontFamily: 'Segoe UI, Arial',
            fill: '#00e5ff', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(6);

        this.bodyText = this.add.text(W / 2, 155, '', {
            fontSize: '13px', fontFamily: 'Segoe UI, Arial',
            fill: '#94a3b8', align: 'center', wordWrap: { width: W - 80 }
        }).setOrigin(0.5).setDepth(6);

        // Demo area reference point (below body text, centered)
        this.demoCX = W / 2;
        this.demoCY = 355;

        // ── Navigation ────────────────────────────────────────────────
        const navY = H - 60;

        this.prevBtn = this.add.text(60, navY, '← Back', {
            fontSize: '14px', fontFamily: 'Segoe UI, Arial', fill: '#334155'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true }).setDepth(10);

        this.nextBtn = this.add.rectangle(W - 80, navY, 130, 40, 0x00e5ff)
            .setInteractive({ useHandCursor: true }).setDepth(10);
        this.nextBtnText = this.add.text(W - 80, navY, 'Next →', {
            fontSize: '14px', fontFamily: 'Segoe UI, Arial',
            fill: '#0d1b2a', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(11);

        // Pip dots
        this.pips = [];
        const pipCount = this._cards().length;
        const pipSpacing = 16;
        const pipStartX = W / 2 - ((pipCount - 1) * pipSpacing) / 2;
        for (let i = 0; i < pipCount; i++) {
            this.pips.push(
                this.add.circle(pipStartX + i * pipSpacing, navY, 4, 0x1e3a5f).setDepth(10)
            );
        }

        this.prevBtn.on('pointerover',  () => this.prevBtn.setStyle({ fill: '#94a3b8' }));
        this.prevBtn.on('pointerout',   () => this.prevBtn.setStyle({ fill: '#334155' }));
        this.prevBtn.on('pointerdown',  () => this._navigate(-1));

        this.nextBtn.on('pointerover',  () => this.nextBtn.setFillStyle(0x67e8f9));
        this.nextBtn.on('pointerout',   () => this.nextBtn.setFillStyle(0x00e5ff));
        this.nextBtn.on('pointerdown',  () => this._navigate(1));

        // Keyboard
        this.input.keyboard.on('keydown-RIGHT', () => this._navigate(1));
        this.input.keyboard.on('keydown-LEFT',  () => this._navigate(-1));
        this.input.keyboard.on('keydown-ENTER', () => this._navigate(1));

        this._showCard(0);
    }

    // ─────────────────────────────────────────────────────────────────
    // CARD DATA
    // ─────────────────────────────────────────────────────────────────

    _cards() {
        return [
            {
                step:  'STEP 1 OF 5',
                title: 'Move Around',
                body:  'Use WASD or Arrow Keys to move one tile at a time.\nYou cannot walk through walls.',
                demo:  'movement'
            },
            {
                step:  'STEP 2 OF 5',
                title: 'Pressure Plates',
                body:  'Step on a yellow plate to activate it.\nActivated plates turn white and glow.',
                demo:  'plate'
            },
            {
                step:  'STEP 3 OF 5',
                title: 'Doors',
                body:  'A red door blocks your path.\nIt opens only when all required plates are active.',
                demo:  'door'
            },
            {
                step:  'STEP 4 OF 5',
                title: 'Time Loops',
                body:  'Press R to reset the loop.\nYour past self becomes a ghost that replays every move you made.',
                demo:  'ghost'
            },
            {
                step:  'STEP 5 OF 5',
                title: 'Reach the Goal',
                body:  'The green tile is your goal.\nGet there with all doors open to complete the level.',
                demo:  'goal'
            }
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    // NAVIGATION
    // ─────────────────────────────────────────────────────────────────

    _navigate(dir) {
        const cards = this._cards();
        const next  = this.cardIndex + dir;

        if (next < 0) {
            // Go back to title
            this.scene.start('TitleScene');
            return;
        }
        if (next >= cards.length) {
            this.cameras.main.fadeOut(300, 0, 0, 0);
            this.cameras.main.once('camerafadeoutcomplete', () => {
                window.startGame3D(0);
            });
            return;
        }
        this._showCard(next);
    }

    _showCard(index) {
        this.cardIndex = index;
        const card = this._cards()[index];

        // Clear previous demo
        this._clearDemo();

        // Update text
        this.stepLabel.setText(card.step);
        this.titleText.setText(card.title);
        this.bodyText.setText(card.body);

        // Update pips
        this.pips.forEach((p, i) => p.setFillStyle(i === index ? 0x00e5ff : 0x1e3a5f));

        // Update next button label
        const isLast = index === this._cards().length - 1;
        this.nextBtnText.setText(isLast ? 'Play →' : 'Next →');
        this.nextBtn.setFillStyle(isLast ? 0x22c55e : 0x00e5ff);

        // Update prev button
        this.prevBtn.setStyle({ fill: index === 0 ? '#1e3a5f' : '#334155' });

        // Fade in card content
        this.tweens.add({
            targets: [this.titleText, this.bodyText, this.stepLabel],
            alpha: { from: 0, to: 1 },
            y: { from: (val) => val - 8, to: (val) => val },
            duration: 250,
            ease: 'Quad.easeOut'
        });

        // Run demo
        this._runDemo(card.demo);
    }

    // ─────────────────────────────────────────────────────────────────
    // DEMO ANIMATIONS
    // ─────────────────────────────────────────────────────────────────

    _clearDemo() {
        this.demoObjects.forEach(o => { this.tweens.killTweensOf(o); o.destroy(); });
        this.demoObjects = [];
        this._demoTimers.forEach(t => t.remove());
        this._demoTimers = [];
    }

    _runDemo(type) {
        // All positions are absolute scene coords via _demoTile/_demoActor
        // cx/cy are offsets passed to those helpers (which add demoCX/demoCY)
        const cx = 0;
        const cy = 0;
        const ax = this.demoCX; // absolute center X for tween targets
        const ay = this.demoCY; // absolute center Y

        switch (type) {

            case 'movement': {
                this._demoTile(cx - 96, cy, 0x1e3a5f);
                this._demoTile(cx + 96, cy, 0x1e3a5f);
                const player = this._demoActor(cx - 32, cy, 0x00e5ff);
                this._label(cx - 96, cy + 36, 'WALL', '#1e3a5f');
                this._label(cx + 96, cy + 36, 'WALL', '#1e3a5f');
                this._label(cx, cy + 36, 'YOU', '#00e5ff');

                this.tweens.add({
                    targets: player,
                    x: { from: ax - 32, to: ax + 32 },
                    duration: 500,
                    yoyo: true,
                    repeat: -1,
                    ease: 'Stepped',
                    easeParams: [1],
                    delay: 600
                });
                break;
            }

            case 'plate': {
                const plate = this._demoTile(cx, cy, 0xf59e0b, 48);
                const player = this._demoActor(cx - 96, cy, 0x00e5ff);
                this._label(cx, cy + 36, 'PLATE', '#f59e0b');

                const loopPlate = () => {
                    this.tweens.add({
                        targets: player, x: ax, duration: 400, ease: 'Quad.easeOut',
                        onComplete: () => {
                            plate.setFillStyle(0xffffff);
                            this.tweens.add({ targets: plate, scaleX: 1.2, scaleY: 1.2, duration: 120, yoyo: true });
                            this._demoTimers.push(this.time.delayedCall(700, () => {
                                plate.setFillStyle(0xf59e0b);
                                this.tweens.add({
                                    targets: player, x: ax - 96, duration: 400, ease: 'Quad.easeOut',
                                    onComplete: () => this._demoTimers.push(this.time.delayedCall(400, loopPlate))
                                });
                            }));
                        }
                    });
                };
                this._demoTimers.push(this.time.delayedCall(400, loopPlate));
                break;
            }

            case 'door': {
                const plate = this._demoTile(cx - 80, cy, 0xf59e0b, 40);
                const door  = this._demoTile(cx + 40, cy, 0xef4444, 48);
                this._label(cx - 80, cy + 36, 'PLATE', '#f59e0b');
                this._label(cx + 40, cy + 36, 'DOOR', '#ef4444');

                const loopDoor = () => {
                    plate.setFillStyle(0xffffff);
                    this.tweens.add({
                        targets: door, alpha: 0.15, duration: 300,
                        onComplete: () => {
                            this._demoTimers.push(this.time.delayedCall(800, () => {
                                plate.setFillStyle(0xf59e0b);
                                this.tweens.add({
                                    targets: door, alpha: 1, duration: 300,
                                    onComplete: () => this._demoTimers.push(this.time.delayedCall(400, loopDoor))
                                });
                            }));
                        }
                    });
                };
                this._demoTimers.push(this.time.delayedCall(600, loopDoor));
                break;
            }

            case 'ghost': {
                const player = this._demoActor(cx - 64, cy, 0x00e5ff);
                const ghost  = this._demoActor(cx - 64, cy, 0x7c6fff);
                ghost.setAlpha(0);
                this._label(cx - 64, cy + 36, 'YOU', '#00e5ff');
                this._label(cx + 64, cy + 36, 'GHOST', '#7c6fff');

                const loopGhost = () => {
                    this.tweens.add({
                        targets: player, x: ax + 64, duration: 400, ease: 'Quad.easeOut',
                        onComplete: () => {
                            this.cameras.main.flash(120, 100, 80, 255, false);
                            this._demoTimers.push(this.time.delayedCall(300, () => {
                                player.setPosition(ax - 64, ay);
                                ghost.setAlpha(0.6);
                                ghost.setPosition(ax - 64, ay);
                                this.tweens.add({
                                    targets: ghost, x: ax + 64, duration: 400, ease: 'Quad.easeOut',
                                    onComplete: () => {
                                        this._demoTimers.push(this.time.delayedCall(600, () => {
                                            ghost.setAlpha(0);
                                            loopGhost();
                                        }));
                                    }
                                });
                            }));
                        }
                    });
                };
                this._demoTimers.push(this.time.delayedCall(400, loopGhost));
                break;
            }

            case 'goal': {
                const goal   = this._demoTile(cx + 64, cy, 0x22c55e, 48);
                const player = this._demoActor(cx - 64, cy, 0x00e5ff);
                this._label(cx + 64, cy + 36, 'GOAL', '#22c55e');

                this.tweens.add({
                    targets: goal, scaleX: 1.1, scaleY: 1.1,
                    duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
                });

                const loopGoal = () => {
                    this.tweens.add({
                        targets: player, x: ax + 64, duration: 500, ease: 'Quad.easeOut',
                        onComplete: () => {
                            this.cameras.main.flash(200, 34, 197, 94, false);
                            this._demoTimers.push(this.time.delayedCall(700, () => {
                                player.setPosition(ax - 64, ay);
                                this._demoTimers.push(this.time.delayedCall(300, loopGoal));
                            }));
                        }
                    });
                };
                this._demoTimers.push(this.time.delayedCall(500, loopGoal));
                break;
            }
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // DEMO HELPERS
    // ─────────────────────────────────────────────────────────────────

    _demoTile(x, y, color, size = 52) {
        const r = this.add.rectangle(
            this.demoCX + x,
            this.demoCY + y,
            size, size, color
        ).setDepth(7);
        this.demoObjects.push(r);
        return r;
    }

    _demoActor(x, y, color) {
        const r = this.add.rectangle(
            this.demoCX + x,
            this.demoCY + y,
            38, 38, color
        ).setDepth(8);
        this.demoObjects.push(r);
        return r;
    }

    _label(x, y, text, fill) {
        const t = this.add.text(
            this.demoCX + x,
            this.demoCY + y,
            text,
            { fontSize: '10px', fontFamily: 'Segoe UI, Arial', fill, fontStyle: 'bold' }
        ).setOrigin(0.5).setDepth(8);
        this.demoObjects.push(t);
        return t;
    }

    _drawGrid(W, H) {
        const g = this.add.graphics();
        g.lineStyle(1, 0x1e3a5f, 0.2);
        for (let x = 0; x < W; x += 64) g.lineBetween(x, 0, x, H);
        for (let y = 0; y < H; y += 64) g.lineBetween(0, y, W, y);
    }
}
