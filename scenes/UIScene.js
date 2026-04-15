export default class UIScene extends Phaser.Scene {
    constructor() { super({ key: 'UIScene', active: false }); }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;

        // ── HUD top bar ───────────────────────────────────────────────
        this.add.rectangle(0, 0, W, 52, 0x060d1a, 0.95).setOrigin(0, 0);
        this.add.rectangle(0, 52, W, 2, 0x1e3a5f).setOrigin(0, 0);

        this.levelLabel = this.add.text(14, 8, '', {
            fontSize: '14px', fontFamily: 'Segoe UI, Arial', fill: '#94a3b8', fontStyle: 'bold'
        });
        this.loopLabel = this.add.text(14, 28, '', {
            fontSize: '11px', fontFamily: 'Segoe UI, Arial', fill: '#64748b'
        });
        this.stepLabel = this.add.text(W / 2, 26, '', {
            fontSize: '11px', fontFamily: 'Segoe UI, Arial', fill: '#64748b'
        }).setOrigin(0.5);

        // Ghost pip dots — centre of HUD
        this.pips = [];
        for (let i = 0; i < 8; i++) {
            this.pips.push(this.add.circle(W / 2 - 56 + i * 16, 12, 4, 0x1e3a5f));
        }
        this.pipOverflow = this.add.text(W / 2 + 80, 12, '', {
            fontSize: '10px', fontFamily: 'Segoe UI, Arial', fill: '#64748b'
        }).setOrigin(0, 0.5);

        // ── Pause button — top right of HUD ──────────────────────────
        const pauseBtn = this.add.rectangle(W - 30, 26, 44, 36, 0x1e3a5f, 0.9)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.game.events.emit('mobile-pause'))
            .on('pointerover', () => pauseBtn.setFillStyle(0x2d5a8e, 0.95))
            .on('pointerout',  () => pauseBtn.setFillStyle(0x1e3a5f, 0.9));
        this.add.text(W - 30, 26, '⏸', {
            fontSize: '16px', fontFamily: 'Segoe UI, Arial', fill: '#94a3b8'
        }).setOrigin(0.5);

        // ── PSP-style gamepad ─────────────────────────────────────────
        // Layout: D-pad on left, action buttons on right
        // Sits at the very bottom of the screen
        const padY   = H - 68;   // vertical centre of the gamepad row
        const btnS   = 46;       // button size
        const gap    = 4;        // gap between buttons
        const dpadCX = 72;       // D-pad centre X
        const actCX  = W - 72;   // action buttons centre X

        // ── D-pad ─────────────────────────────────────────────────────
        // Centre diamond piece
        this.add.rectangle(dpadCX, padY, btnS * 0.55, btnS * 0.55, 0x0d1b2a, 0.9);

        const dDirs = [
            { label: '▲', dx:  0, dy: -1, ox: 0,           oy: -(btnS + gap) },
            { label: '▼', dx:  0, dy:  1, ox: 0,           oy:  (btnS + gap) },
            { label: '◀', dx: -1, dy:  0, ox: -(btnS + gap), oy: 0 },
            { label: '▶', dx:  1, dy:  0, ox:  (btnS + gap), oy: 0 },
        ];

        dDirs.forEach(d => {
            const bx = dpadCX + d.ox;
            const by = padY   + d.oy;
            const bg = this.add.rectangle(bx, by, btnS, btnS, 0x1a2a4a, 0.92)
                .setStrokeStyle(1, 0x2d4a7a, 0.8)
                .setInteractive()
                .on('pointerdown', () => { bg.setFillStyle(0x2d5a8e, 1); this._emitMove(d.dx, d.dy); })
                .on('pointerup',   () => bg.setFillStyle(0x1a2a4a, 0.92))
                .on('pointerout',  () => bg.setFillStyle(0x1a2a4a, 0.92));
            this.add.text(bx, by, d.label, {
                fontSize: '18px', fontFamily: 'Segoe UI, Arial', fill: '#4a7aaa'
            }).setOrigin(0.5);
        });

        // ── Action buttons (PSP right side) ───────────────────────────
        // R = loop reset (top, red tint)
        // U = undo (bottom, blue tint)
        const actionBtns = [
            { label: 'R', subLabel: 'LOOP', ox: 0, oy: -(btnS * 0.6 + gap),
              col: 0x3a0a0a, colHover: 0x7f1d1d, textCol: '#fca5a5',
              emit: 'resetLoop' },
            { label: 'U', subLabel: 'UNDO', ox: 0, oy:  (btnS * 0.6 + gap),
              col: 0x0a1a3a, colHover: 0x1e3a5f, textCol: '#94a3b8',
              emit: 'undo' },
        ];

        actionBtns.forEach(b => {
            const bx = actCX + b.ox;
            const by = padY  + b.oy;
            const bg = this.add.circle(bx, by, btnS * 0.48, b.col, 0.92)
                .setStrokeStyle(1.5, 0x2d4a7a, 0.7)
                .setInteractive()
                .on('pointerdown', () => { bg.setFillStyle(b.colHover, 1); this.game.events.emit(b.emit); })
                .on('pointerup',   () => bg.setFillStyle(b.col, 0.92))
                .on('pointerout',  () => bg.setFillStyle(b.col, 0.92));
            this.add.text(bx, by - 4, b.label, {
                fontSize: '17px', fontFamily: 'Segoe UI, Arial',
                fill: b.textCol, fontStyle: 'bold'
            }).setOrigin(0.5);
            this.add.text(bx, by + 12, b.subLabel, {
                fontSize: '8px', fontFamily: 'Segoe UI, Arial', fill: '#334155'
            }).setOrigin(0.5);
        });

        // ── Pause overlay ─────────────────────────────────────────────
        this._pauseOverlay = this.add.container(0, 0).setVisible(false).setDepth(50);
        const pBg = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.85);
        const pTitle = this.add.text(W / 2, H / 2 - 80, 'PAUSED', {
            fontSize: '30px', fontFamily: 'Segoe UI, Arial', fill: '#00e5ff', fontStyle: 'bold'
        }).setOrigin(0.5);
        this._pauseOverlay.add([pBg, pTitle]);

        const makeBtn = (label, y, cb) => {
            const bg = this.add.rectangle(W / 2, y, 200, 44, 0x1e3a5f)
                .setStrokeStyle(1, 0x2d5a8e)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', cb)
                .on('pointerover', () => bg.setFillStyle(0x2d5a8e))
                .on('pointerout',  () => bg.setFillStyle(0x1e3a5f));
            const txt = this.add.text(W / 2, y, label, {
                fontSize: '14px', fontFamily: 'Segoe UI, Arial', fill: '#94a3b8'
            }).setOrigin(0.5);
            this._pauseOverlay.add([bg, txt]);
        };

        makeBtn('▶  Resume',        H / 2 - 20, () => this.game.events.emit('pause-toggle', false));
        makeBtn('↺  Restart Level', H / 2 + 34, () => { this.game.events.emit('pause-toggle', false); this.game.events.emit('restart-level'); });
        makeBtn('⌂  Main Menu',     H / 2 + 88, () => { this.game.events.emit('pause-toggle', false); this.game.events.emit('goto-title'); });

        this.game.events.off('pause-toggle').on('pause-toggle', visible => {
            this._pauseOverlay.setVisible(visible);
        });

        // ── Listen for game events ────────────────────────────────────
        this.game.events.off('ui-update');
        this.game.events.on('ui-update', data => this._refresh(data));
    }

    _emitMove(dx, dy) {
        this.game.events.emit('touch-move', { dx, dy });
    }

    _refresh({ level, loopCount, maxLoops, step, stepLimit }) {
        this.levelLabel.setText(`LEVEL ${level + 1}`);
        const ghostsCreated = loopCount - 1;
        const loopsLeft = maxLoops - loopCount;
        this.loopLabel.setText(`Loop ${loopCount} / ${maxLoops}${loopsLeft === 0 ? '  ⚠ LAST' : ''}`);
        this.stepLabel.setText(`Steps  ${step} / ${stepLimit}`);
        const shown = Math.min(ghostsCreated, 8);
        this.pips.forEach((p, i) => p.setFillStyle(i < shown ? 0x00e5ff : 0x1e3a5f));
        const overflow = ghostsCreated > 8 ? `+${ghostsCreated - 8}` : '';
        this.pipOverflow?.setText(overflow);
    }
}
