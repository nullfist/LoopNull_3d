export default class BootScene extends Phaser.Scene {
    constructor() { super('BootScene'); }

    create() {
        this._makeFloor('floor',  0x12121a, 0x1a1a28);
        this._makeFloor('floor2', 0x161622, 0x1e1e2e);
        this._makeWall();
        this._makePlayer();
        this._makeGhost();
        this._makePlate();
        this._makeDoor();
        this._makeGoal();
        this.scene.start('TitleScene');
    }

    // ── helpers ──────────────────────────────────────────────────────

    // Draw a pixel grid from a 16×16 string array, each char = 1 pixel = 4px on canvas
    _drawPixels(g, rows, colorMap) {
        const S = 4;
        rows.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                const c = row[x];
                if (c === '.' || !colorMap[c]) continue;
                g.fillStyle(colorMap[c], 1);
                g.fillRect(x * S, y * S, S, S);
            }
        });
    }

    // ── Floor ────────────────────────────────────────────────────────
    _makeFloor(key, base, line) {
        const g = this.make.graphics({ add: false });
        g.fillStyle(base);
        g.fillRect(0, 0, 64, 64);
        // subtle border grid
        g.lineStyle(1, line, 0.5);
        g.strokeRect(0, 0, 64, 64);
        // corner dots
        g.fillStyle(line, 0.4);
        [[2,2],[61,2],[2,61],[61,61]].forEach(([x,y]) => g.fillRect(x, y, 2, 2));
        g.generateTexture(key, 64, 64);
        g.destroy();
    }

    // ── Wall ─────────────────────────────────────────────────────────
    _makeWall() {
        const g = this.make.graphics({ add: false });
        // base fill
        g.fillStyle(0x1e1e2e);
        g.fillRect(0, 0, 64, 64);
        // top-left bevel highlight
        g.fillStyle(0x2e2e44);
        g.fillRect(0, 0, 64, 3);
        g.fillRect(0, 0, 3, 64);
        // bottom-right bevel shadow
        g.fillStyle(0x0a0a0f);
        g.fillRect(0, 61, 64, 3);
        g.fillRect(61, 0, 3, 64);
        // inner recessed panel
        g.fillStyle(0x16161f);
        g.fillRect(5, 5, 54, 54);
        // inner border
        g.lineStyle(1, 0x2a2a3a, 1);
        g.strokeRect(5, 5, 54, 54);
        // cross-hatch texture lines
        g.lineStyle(1, 0x0f0f18, 0.6);
        for (let i = 16; i < 64; i += 16) {
            g.beginPath(); g.moveTo(5, i); g.lineTo(59, i); g.strokePath();
            g.beginPath(); g.moveTo(i, 5); g.lineTo(i, 59); g.strokePath();
        }
        // corner rivets
        g.fillStyle(0x2a2a3a);
        [[10,10],[54,10],[10,54],[54,54]].forEach(([x,y]) => {
            g.fillRect(x-2, y-2, 4, 4);
            g.fillStyle(0x0a0a0f);
            g.fillRect(x-1, y-1, 2, 2);
            g.fillStyle(0x2a2a3a);
        });
        g.generateTexture('wall', 64, 64);
        g.destroy();
    }

    // ── Player: time-traveler humanoid ───────────────────────────────
    _makePlayer() {
        const g = this.make.graphics({ add: false });
        // 16×16 pixel art, S=4 → 64px
        // S=skin, H=helmet dark, V=visor cyan, J=jacket blue, L=light stripe,
        // B=belt gold, T=trousers, G=glove/boot cyan, O=outline
        const rows = [
            '.....OHHHHHO....',
            '.....HSSSSSH....',
            '.....HVVVVVH....',
            '.....OHHHHHO....',
            '....OJJLLJJJO...',
            '...OJJLLLLLJJO..',
            '...OJJLBBLJJO...',
            '...OJJJJJJJJO...',
            '..OGJJJJJJJGOO..',
            '..OGJJJJJJJGOO..',
            '...OTTTTTTTO....',
            '...OTTTTTTTO....',
            '....OTTOOTTO....',
            '....OTTOOTTO....',
            '...OGGOOGGOO....',
            '................',
        ];
        this._drawPixels(g, rows, {
            S: 0xe8b87a,
            H: 0x1a0a2e,
            V: 0x00e5ff,
            J: 0x0d2a6e,
            L: 0x1e5fc8,
            B: 0xffd166,
            T: 0x0a1a3a,
            G: 0x00b8cc,
            O: 0x060d1a,
        });
        g.generateTexture('player', 64, 64);
        g.destroy();
    }

    // ── Ghost: purple, scanline overlay ──────────────────────────────
    _makeGhost() {
        const g = this.make.graphics({ add: false });
        const rows = [
            '........PPPP....',
            '.......PPPPPP...',
            '.......PLLLPP...',
            '.......PPPPPP...',
            '......PPPPPPPP..',
            '......PPPPPPPP..',
            '.......PPPPPP...',
            '......PP....PP..',
            '.....PPP....PPP.',
            '.....PP......PP.',
            '.....PP......PP.',
            '......PP....PP..',
            '......PP....PP..',
            '.....PPP....PPP.',
            '.....PP......PP.',
            '................',
        ];
        this._drawPixels(g, rows, {
            P: 0x7c6fff,
            L: 0xb0a8ff,
            D: 0x4a3fcc,
        });
        // scanline overlay — every other row, semi-transparent dark
        g.fillStyle(0x0d0d1a, 0.3);
        for (let y = 0; y < 16; y += 2) {
            for (let x = 0; x < 16; x++) {
                const c = rows[y][x];
                if (c !== '.') g.fillRect(x * 4, y * 4, 4, 4);
            }
        }
        g.generateTexture('ghost', 64, 64);
        g.destroy();
    }

    // ── Plate: red pressure pad (pink glow when active via tint) ─────
    _makePlate() {
        const g = this.make.graphics({ add: false });
        // outer frame — dark red
        g.fillStyle(0x5a0a0a);
        g.fillRect(4, 4, 56, 56);
        // inner pad — mid red
        g.fillStyle(0xaa1a1a);
        g.fillRect(8, 8, 48, 48);
        // bright centre — vivid red
        g.fillStyle(0xff2222);
        g.fillRect(14, 14, 36, 36);
        // down-arrow symbol
        g.fillStyle(0x5a0a0a);
        g.fillRect(28, 18, 8, 14);
        g.fillTriangle(32, 44, 20, 30, 44, 30);
        // corner accents — bright red
        g.fillStyle(0xff6666);
        [[8,8],[52,8],[8,52],[52,52]].forEach(([x,y]) => g.fillRect(x, y, 4, 4));
        g.generateTexture('plate', 64, 64);
        g.destroy();
    }

    // ── Door: orange block, closed ────────────────────────────────────
    _makeDoor() {
        const g = this.make.graphics({ add: false });
        // body
        g.fillStyle(0xb85c00);
        g.fillRect(0, 0, 64, 64);
        // face
        g.fillStyle(0xff9f1c);
        g.fillRect(4, 4, 56, 56);
        // top highlight
        g.fillStyle(0xffbe5c);
        g.fillRect(4, 4, 56, 6);
        g.fillRect(4, 4, 6, 56);
        // bottom shadow
        g.fillStyle(0x7a3d00);
        g.fillRect(4, 54, 56, 6);
        g.fillRect(54, 4, 6, 56);
        // lock body
        g.fillStyle(0x7a3d00);
        g.fillRect(24, 34, 16, 14);
        // lock shackle
        g.lineStyle(4, 0x7a3d00);
        g.beginPath(); g.arc(32, 34, 7, Math.PI, 0); g.strokePath();
        // keyhole
        g.fillStyle(0xff9f1c);
        g.fillCircle(32, 39, 3);
        g.fillRect(30, 41, 4, 5);
        // X bars across top
        g.lineStyle(3, 0x7a3d00, 0.6);
        g.beginPath(); g.moveTo(10, 10); g.lineTo(54, 28); g.strokePath();
        g.beginPath(); g.moveTo(54, 10); g.lineTo(10, 28); g.strokePath();
        g.generateTexture('door', 64, 64);
        g.destroy();
    }

    // ── Goal: green glowing portal ────────────────────────────────────
    _makeGoal() {
        const g = this.make.graphics({ add: false });
        // outer glow ring
        g.fillStyle(0x003322);
        g.fillCircle(32, 32, 30);
        // mid ring
        g.fillStyle(0x00aa55);
        g.fillCircle(32, 32, 24);
        // bright core
        g.fillStyle(0x00ff9c);
        g.fillCircle(32, 32, 16);
        // white hot centre
        g.fillStyle(0xccffe8);
        g.fillCircle(32, 32, 7);
        // radiating lines
        g.lineStyle(2, 0x00ff9c, 0.7);
        const angles = [0, 45, 90, 135, 180, 225, 270, 315];
        angles.forEach(a => {
            const rad = a * Math.PI / 180;
            g.beginPath();
            g.moveTo(32 + Math.cos(rad) * 18, 32 + Math.sin(rad) * 18);
            g.lineTo(32 + Math.cos(rad) * 28, 32 + Math.sin(rad) * 28);
            g.strokePath();
        });
        g.generateTexture('goal', 64, 64);
        g.destroy();
    }
}
