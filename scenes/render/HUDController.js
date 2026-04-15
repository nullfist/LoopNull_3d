// Controls all HTML overlay elements inside #three-container
// No Three.js dependency — pure DOM manipulation

export class HUDController {
    constructor(onReset, onUndo, onPause, onResume, onRestart, onTitle) {
        this._el = id => document.getElementById(id);
        this._onPause = onPause;

        // ── D-pad buttons ─────────────────────────────────────────────────────
        this._el('btn-up').addEventListener('pointerdown',    e => { e.stopPropagation(); this._onMove?.(0, -1); });
        this._el('btn-down').addEventListener('pointerdown',  e => { e.stopPropagation(); this._onMove?.(0,  1); });
        this._el('btn-left').addEventListener('pointerdown',  e => { e.stopPropagation(); this._onMove?.(-1, 0); });
        this._el('btn-right').addEventListener('pointerdown', e => { e.stopPropagation(); this._onMove?.( 1, 0); });
        this._el('btn-reset').addEventListener('pointerdown', e => { e.stopPropagation(); onReset(); });
        this._el('btn-undo').addEventListener('pointerdown',  e => { e.stopPropagation(); onUndo(); });
        this._el('hud-pause').addEventListener('pointerdown', e => { e.stopPropagation(); onPause(); });

        // ── Pause overlay buttons ─────────────────────────────────────────────
        this._el('pause-resume').addEventListener('pointerdown', e => {
            e.stopPropagation();
            this.showPause(false);
            onResume();
        });
        this._el('pause-restart').addEventListener('pointerdown', e => {
            e.stopPropagation();
            this.showPause(false);
            onRestart();
        });
        this._el('pause-title').addEventListener('pointerdown', e => {
            e.stopPropagation();
            this.showPause(false);
            setTimeout(() => onTitle(), 80);
        });

        // ── Dialogue tap to advance ───────────────────────────────────────────
        this._el('dialogue-box').addEventListener('pointerdown', e => {
            e.stopPropagation();
            this.advanceDialogue();
        });

        // ── Touch swipe for movement ──────────────────────────────────────────
        this._initSwipe();

        this._dialogueLines  = [];
        this._dialogueIndex  = 0;
        this._dialogueTyping = false;
        this._dialogueTimer  = null;
        this._dialogueOnDone = null;

        this._pipCount = 8;
        this._buildPips();
    }

    setMoveHandler(fn) { this._onMove = fn; }

    // ── Touch swipe — fires move on the canvas area ───────────────────────────
    _initSwipe() {
        const canvas = document.getElementById('three-canvas');
        let sx = 0, sy = 0;
        const MIN = 28; // minimum swipe distance in px

        canvas.addEventListener('touchstart', e => {
            sx = e.touches[0].clientX;
            sy = e.touches[0].clientY;
        }, { passive: true });

        canvas.addEventListener('touchend', e => {
            if (this.isDialogueActive()) {
                this.advanceDialogue();
                return;
            }
            const dx = e.changedTouches[0].clientX - sx;
            const dy = e.changedTouches[0].clientY - sy;
            if (Math.abs(dx) < MIN && Math.abs(dy) < MIN) return;
            if (Math.abs(dx) > Math.abs(dy)) {
                this._onMove?.(dx > 0 ? 1 : -1, 0);
            } else {
                this._onMove?.(0, dy > 0 ? 1 : -1);
            }
        }, { passive: true });
    }

    // ── HUD refresh ───────────────────────────────────────────────────────────
    refresh({ level, loopCount, maxLoops, step, stepLimit }) {
        this._el('hud-level').textContent = `LEVEL ${level + 1}`;
        const loopsLeft = maxLoops - loopCount;
        this._el('hud-loop').textContent =
            `Loop ${loopCount} / ${maxLoops}${loopsLeft === 0 ? '  ⚠ LAST' : ''}`;
        this._el('hud-steps').textContent = `Steps  ${step} / ${stepLimit}`;
        const ghosts = loopCount - 1;
        document.querySelectorAll('.hud-pip').forEach((p, i) => {
            p.classList.toggle('active', i < ghosts);
        });
    }

    _buildPips() {
        const c = this._el('hud-pips');
        c.innerHTML = '';
        for (let i = 0; i < this._pipCount; i++) {
            const d = document.createElement('div');
            d.className = 'hud-pip';
            c.appendChild(d);
        }
    }

    // ── Pause ─────────────────────────────────────────────────────────────────
    showPause(visible) {
        this._el('pause-overlay').style.display = visible ? 'flex' : 'none';
    }

    // ── Dialogue ──────────────────────────────────────────────────────────────
    showDialogue(lines, onDone) {
        if (!lines?.length) { onDone?.(); return; }
        this._dialogueLines  = [...lines];
        this._dialogueIndex  = 0;
        this._dialogueOnDone = onDone || null;
        this._el('dialogue-box').style.display = 'block';
        this._typeNextLine();
    }

    // Public — called by Game3D keyboard handler and touch handler
    advanceDialogue() {
        if (!this.isDialogueActive()) return;
        if (this._dialogueTyping) {
            // Skip to end of current line
            clearInterval(this._dialogueTimer);
            this._dialogueTyping = false;
            this._el('dialogue-text').textContent =
                this._dialogueLines[this._dialogueIndex];
            return;
        }
        this._dialogueIndex++;
        if (this._dialogueIndex < this._dialogueLines.length) {
            this._typeNextLine();
        } else {
            this._closeDialogue();
        }
    }

    _typeNextLine() {
        const line   = this._dialogueLines[this._dialogueIndex];
        const textEl = this._el('dialogue-text');
        textEl.textContent = '';
        this._dialogueTyping = true;
        let i = 0;
        clearInterval(this._dialogueTimer);
        this._dialogueTimer = setInterval(() => {
            textEl.textContent = line.substring(0, ++i);
            if (i >= line.length) {
                clearInterval(this._dialogueTimer);
                this._dialogueTyping = false;
            }
        }, 36);
    }

    _closeDialogue() {
        clearInterval(this._dialogueTimer);
        this._el('dialogue-box').style.display = 'none';
        // Use setTimeout so the closing keydown event doesn't immediately
        // trigger game actions in the same event loop tick
        const cb = this._dialogueOnDone;
        this._dialogueOnDone = null;
        if (cb) setTimeout(cb, 0);
    }

    isDialogueActive() {
        return this._el('dialogue-box').style.display !== 'none';
    }

    // ── Win screen ────────────────────────────────────────────────────────────
    showWin(isLast, onAdvance) {
        const old = document.getElementById('win-overlay');
        if (old) old.remove();
        const div = document.createElement('div');
        div.id = 'win-overlay';
        div.innerHTML = `
            <h1>${isLast ? '✦ THE ARCHITECT ✦' : 'LOOP SOLVED'}</h1>
            <p>${isLast ? "You weren't solving the loop.\nYou were becoming it." : 'Next level unlocked.'}</p>
            <button id="win-btn">${isLast ? 'Play Again' : 'Next Level →'}</button>
        `;
        document.getElementById('three-container').appendChild(div);
        document.getElementById('win-btn').addEventListener('pointerdown', e => {
            e.stopPropagation();
            div.remove();
            onAdvance();
        });
    }

    // ── Final cinematic ───────────────────────────────────────────────────────
    showFinalMessage(onDone) {
        const container = document.getElementById('three-container');
        const overlay   = document.createElement('div');
        overlay.style.cssText = `
            position:absolute;inset:0;background:rgba(0,0,0,0);
            display:flex;flex-direction:column;align-items:center;
            justify-content:center;gap:24px;z-index:60;
            transition:background 0.6s;pointer-events:none;
        `;
        container.appendChild(overlay);
        setTimeout(() => { overlay.style.background = 'rgba(0,0,0,0.92)'; }, 50);
        const lines = [
            { text: "You didn't escape time.",  delay: 700,  size: '18px', color: '#94a3b8' },
            { text: 'You became it.',           delay: 1800, size: '28px', color: '#00e5ff' },
            { text: 'Every loop was a choice.', delay: 3000, size: '18px', color: '#94a3b8' },
            { text: 'Every choice was you.',    delay: 4000, size: '18px', color: '#94a3b8' },
        ];
        lines.forEach(({ text, delay, size, color }) => {
            const p = document.createElement('p');
            p.textContent = text;
            p.style.cssText = `font-size:${size};color:${color};opacity:0;transition:opacity 0.6s;text-align:center;font-family:'Segoe UI',Arial,sans-serif;`;
            overlay.appendChild(p);
            setTimeout(() => { p.style.opacity = '1'; }, delay);
        });
        setTimeout(() => { overlay.remove(); onDone(); }, 5800);
    }

    // ── Flash ─────────────────────────────────────────────────────────────────
    flash(cssColor, durationMs = 400) {
        const container = document.getElementById('three-container');
        const div = document.createElement('div');
        div.style.cssText = `
            position:absolute;inset:0;background:${cssColor};
            opacity:0.5;pointer-events:none;z-index:55;
            transition:opacity ${durationMs}ms ease-out;
        `;
        container.appendChild(div);
        requestAnimationFrame(() => { div.style.opacity = '0'; });
        setTimeout(() => div.remove(), durationMs + 50);
    }

    hideAll() {
        this._el('dialogue-box').style.display = 'none';
        this._el('pause-overlay').style.display = 'none';
        clearInterval(this._dialogueTimer);
        this._dialogueOnDone = null;
        const win = document.getElementById('win-overlay');
        if (win) win.remove();
    }
}
