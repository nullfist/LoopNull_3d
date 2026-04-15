/* global THREE */
import { LEVEL_DEFS, DIALOGUES, LEVEL_NAMES } from './logic/LevelDefs.js';
import {
    GHOST_COLORS, buildWallSet, buildPlates, buildFakePlates, buildDoors,
    stepGhost, evaluatePlates, evaluateDoors, snapshot, restoreSnapshot, gridToWorld
} from './logic/GameLogic.js';
import {
    soundMove, soundPlate, soundDoorOpen, soundWin, soundUndo,
    soundWarn, soundWhoosh, soundConverge
} from './logic/Sounds.js';
import { SceneManager }   from './render/SceneManager.js';
import { TileRenderer }   from './render/TileRenderer.js';
import { EntityRenderer } from './render/EntityRenderer.js';
import { HUDController }  from './render/HUDController.js';

export class Game3D {
    constructor(canvas) {
        this._canvas  = canvas;
        this._running = false;
        this._raf     = null;
        this._clock   = { last: 0 };

        // Render layer
        this._scene    = new SceneManager(canvas);
        this._tiles    = new TileRenderer(this._scene.scene, this._scene);
        this._entities = new EntityRenderer(this._scene.scene);

        // HUD — wire all button callbacks
        this._hud = new HUDController(
            () => this._resetLoop(),                    // onReset
            () => this._undo(),                         // onUndo
            () => this._togglePause(),                  // onPause (pause button / ESC)
            () => { this._paused = false; },            // onResume (overlay Resume btn)
            () => { this._paused = false; this.loadLevel(this._level); }, // onRestart
            () => window.goToTitle3D()                  // onTitle
        );
        this._hud.setMoveHandler((dx, dy) => this._tryMove(dx, dy));

        // Keyboard
        this._keys = {};
        this._onKey = e => this._handleKey(e);
        window.addEventListener('keydown', this._onKey);
    }

    // ── Public API ────────────────────────────────────────────────────────────
    loadLevel(index) {
        // Stop the loop during load to prevent lag spikes from mid-frame clears
        const wasRunning = this._running;
        this.stop();

        this._level = index;
        const def   = LEVEL_DEFS[index];
        this._def   = def;

        // ── Logic state ──────────────────────────────────────────────
        this._wallSet          = buildWallSet(def);
        this._plates           = buildPlates(def);
        this._fakePlates       = buildFakePlates(def);
        this._doors            = buildDoors(def);
        this._playerGx         = def.playerStart.x;
        this._playerGy         = def.playerStart.y;
        this._recording        = [];
        this._ghosts           = [];
        this._loopCount        = 1;
        this._step             = 0;
        this._stepLimit        = def.stepLimit ?? 40;
        this._maxLoops         = def.maxLoops ?? (def.plates.length + 1);
        this._sequenceProgress = [];
        this._hintedPlates     = new Set();
        this._undoStack        = [];
        this._loopStack        = [];
        this._gameOver         = false;
        this._paused           = false;
        this._warnedStep       = false;

        // ── Render layer ─────────────────────────────────────────────
        this._scene.clear();
        this._entities.dispose();
        this._tiles.build(def, this._wallSet);
        this._entities.spawnPlayer(def.playerStart.x, def.playerStart.y);

        // ── HUD ──────────────────────────────────────────────────────
        this._hud.hideAll();
        this._hud.showPause(false);
        this._refreshHUD();
        this._drawLevelLabel(index);

        // Restart loop if it was running
        if (wasRunning) this.start();

        // Start dialogue after a short delay
        const d = DIALOGUES[index];
        if (d?.start?.length) {
            setTimeout(() => this._hud.showDialogue(d.start, null), 400);
        }
    }

    start() {
        // Cancel any existing loop before starting a new one
        if (this._raf) {
            cancelAnimationFrame(this._raf);
            this._raf = null;
        }
        this._running = true;
        this._clock.last = performance.now();
        const loop = (now) => {
            if (!this._running) return;
            const delta = Math.min((now - this._clock.last) / 1000, 0.1);
            this._clock.last = now;
            this._tick(delta);
            this._raf = requestAnimationFrame(loop);
        };
        this._raf = requestAnimationFrame(loop);
    }

    stop() {
        this._running = false;
        if (this._raf) {
            cancelAnimationFrame(this._raf);
            this._raf = null;
        }
    }

    // ── Main tick ─────────────────────────────────────────────────────────────
    _tick(delta) {
        if (!this._paused) {
            this._entities.sync(this._playerGx, this._playerGy, this._ghosts, delta);
            this._tiles.sync(this._doors, this._plates, this._fakePlates, delta);
            this._scene.tick(delta);
            const wp = gridToWorld(this._playerGx, this._playerGy);
            this._scene.followTarget(wp.x, wp.z, delta);
        }
        this._scene.render();
    }

    // ── Keyboard input ────────────────────────────────────────────────────────
    _handleKey(e) {
        // Dialogue intercepts Enter/Space/Z — never falls through to game actions
        if (this._hud.isDialogueActive()) {
            if (e.key === 'Enter' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
                e.preventDefault();
                this._hud.advanceDialogue();
            }
            return;
        }
        if (this._gameOver) return;
        if (this._paused) {
            if (e.key === 'Escape') this._togglePause();
            return;
        }

        switch (e.key) {
            case 'ArrowLeft':  case 'a': case 'A': this._tryMove(-1,  0); break;
            case 'ArrowRight': case 'd': case 'D': this._tryMove( 1,  0); break;
            case 'ArrowUp':    case 'w': case 'W': this._tryMove( 0, -1); break;
            case 'ArrowDown':  case 's': case 'S': this._tryMove( 0,  1); break;
            case 'r': case 'R': this._resetLoop(); break;
            case 'u': case 'U': this._undo();      break;
            case 'Escape':      this._togglePause(); break;
        }
    }

    // ── Movement ──────────────────────────────────────────────────────────────
    _tryMove(dx, dy) {
        if (this._gameOver || this._paused || this._hud.isDialogueActive()) return;
        if (this._step >= this._stepLimit) return;

        const nx = this._playerGx + dx;
        const ny = this._playerGy + dy;

        if (this._wallSet.has(`${nx},${ny}`)) return;
        if (this._doors.some(d => !d.open && d.x === nx && d.y === ny)) return;

        // Save undo snapshot
        this._undoStack.push(
            snapshot(this._playerGx, this._playerGy, this._recording,
                     this._step, this._ghosts, this._sequenceProgress)
        );

        this._playerGx = nx;
        this._playerGy = ny;
        this._recording.push({ dx, dy });

        // Advance all ghosts one step
        this._ghosts.forEach(g => {
            stepGhost(g, this._wallSet);
            // Spawn trail for each ghost
            this._entities.spawnTrail(g.gx, g.gy, g.color);
        });

        this._step++;
        soundMove();

        // Step-limit warning
        const warnAt = Math.floor(this._stepLimit * 0.875);
        if (this._step === warnAt && !this._warnedStep) {
            this._warnedStep = true;
            soundWarn();
            this._hud.flash('rgba(255,107,0,0.18)');
        }

        this._checkPlates();
        this._checkGoal();
        this._refreshHUD();
    }

    // ── Plate + door logic ────────────────────────────────────────────────────
    _checkPlates() {
        const result = evaluatePlates(
            this._plates, this._fakePlates,
            this._playerGx, this._playerGy,
            this._ghosts, this._sequenceProgress
        );
        this._sequenceProgress = result.sequenceProgress;

        if (result.changed) {
            soundPlate();
            this._scene.pulseFloorLight(2.8, 0.35);
        }

        // Plate hints
        this._plates.forEach(p => {
            if (p.active) {
                const hints = this._def.plateHints?.[p.id];
                const onlyPlayer = this._playerGx === p.x && this._playerGy === p.y
                    && !this._ghosts.some(g => g.gx === p.x && g.gy === p.y);
                if (hints && onlyPlayer && !this._hintedPlates.has(p.id)) {
                    this._hintedPlates.add(p.id);
                    setTimeout(() => this._hud.showDialogue(hints, null), 120);
                }
            }
        });

        const prevOpen = this._doors.map(d => d.open);
        evaluateDoors(this._doors, result.activatedIds, this._sequenceProgress);
        this._doors.forEach((d, i) => {
            if (d.open && !prevOpen[i]) soundDoorOpen();
        });
    }

    // ── Win condition ─────────────────────────────────────────────────────────
    _checkGoal() {
        const g = this._def.goal;
        if (this._playerGx !== g.x || this._playerGy !== g.y) return;
        if (this._doors.length > 0 && !this._doors.every(d => d.open)) return;

        this._gameOver = true;
        soundWin();
        this._hud.flash('rgba(34,197,94,0.35)');

        const isLast   = this._level >= LEVEL_DEFS.length - 1;
        const endLines = DIALOGUES[this._level]?.end;

        const proceed = () => {
            if (isLast) {
                this._hud.flash('rgba(34,197,94,0.5)', 600);
                setTimeout(() => this._hud.showFinalMessage(() => {
                    this._hud.showWin(true, () => this.loadLevel(0));
                }), 400);
            } else {
                setTimeout(() => {
                    this._hud.showWin(false, () => {
                        this.loadLevel(this._level + 1);
                    });
                }, 300);
            }
        };

        if (endLines?.length) {
            setTimeout(() => this._hud.showDialogue(endLines, proceed), 500);
        } else {
            proceed();
        }

        // Save beaten
        const beaten = JSON.parse(localStorage.getItem('looparchitect_beaten') || '[]');
        if (!beaten.includes(this._level)) {
            beaten.push(this._level);
            localStorage.setItem('looparchitect_beaten', JSON.stringify(beaten));
        }
    }

    // ── Loop reset (R) ────────────────────────────────────────────────────────
    _resetLoop() {
        if (this._gameOver || this._paused || this._hud.isDialogueActive()) return;

        // Save loop-level snapshot for U undo
        this._loopStack.push({
            ...snapshot(this._playerGx, this._playerGy, this._recording,
                        this._step, this._ghosts, this._sequenceProgress),
            loopCount: this._loopCount,
            undoStack: [...this._undoStack],
        });

        const colorVal = GHOST_COLORS[this._ghosts.length % GHOST_COLORS.length];
        const start    = this._def.playerStart;

        // Create ghost from current recording
        const ghost = {
            gx: start.x, gy: start.y,
            startGx: start.x, startGy: start.y,
            actions: [...this._recording],
            step: 0,
            color: colorVal,
        };
        this._ghosts.push(ghost);
        this._entities.spawnGhost(this._ghosts.length - 1, start.x, start.y);

        // Rewind all ghosts to start
        this._ghosts.forEach(g => {
            g.gx = g.startGx; g.gy = g.startGy; g.step = 0;
        });

        // Reset player
        this._playerGx = start.x;
        this._playerGy = start.y;
        this._recording        = [];
        this._step             = 0;
        this._undoStack        = [];
        this._sequenceProgress = [];
        this._hintedPlates     = new Set();
        this._warnedStep       = false;
        this._loopCount++;

        soundWhoosh();
        this._hud.flash('rgba(124,111,255,0.18)');
        this._refreshHUD();

        // Convergence effect on final level
        if (this._level >= LEVEL_DEFS.length - 1) {
            soundConverge();
            this._entities.playConvergence(this._ghosts);
        }
    }

    // ── Undo (U) ──────────────────────────────────────────────────────────────
    _undo() {
        if (this._gameOver || this._paused) return;

        if (this._undoStack.length === 0 && this._loopStack.length > 0) {
            this._undoLoop();
            return;
        }
        if (this._undoStack.length === 0) return;

        const snap = this._undoStack.pop();
        const player = { gx: this._playerGx, gy: this._playerGy };
        this._sequenceProgress = restoreSnapshot(snap, player, this._ghosts, this._recording);
        this._playerGx = player.gx;
        this._playerGy = player.gy;
        this._step     = snap.step;
        this._warnedStep = snap.step >= Math.floor(this._stepLimit * 0.875);

        this._checkPlates();
        soundUndo();
        this._refreshHUD();
    }

    _undoLoop() {
        const snap = this._loopStack.pop();
        // Remove last ghost
        this._ghosts.pop();
        this._entities.removeLastGhost();

        const player = { gx: this._playerGx, gy: this._playerGy };
        this._sequenceProgress = restoreSnapshot(snap, player, this._ghosts, this._recording);
        this._playerGx  = player.gx;
        this._playerGy  = player.gy;
        this._step      = snap.step;
        this._loopCount = snap.loopCount;
        this._undoStack = snap.undoStack || [];
        this._warnedStep = snap.step >= Math.floor(this._stepLimit * 0.875);

        this._checkPlates();
        soundUndo();
        this._hud.flash('rgba(124,111,255,0.12)');
        this._refreshHUD();
    }

    // ── Pause ─────────────────────────────────────────────────────────────────
    _togglePause() {
        this._paused = !this._paused;
        // HUDController manages overlay visibility for resume/restart/title buttons
        // This is only called by the pause button and ESC key
        this._hud.showPause(this._paused);
    }

    // ── HUD helpers ───────────────────────────────────────────────────────────
    _refreshHUD() {
        this._hud.refresh({
            level:     this._level,
            loopCount: this._loopCount,
            maxLoops:  this._maxLoops,
            step:      this._step,
            stepLimit: this._stepLimit,
        });
    }

    _drawLevelLabel(index) {
        // Inject a temporary level name banner into the HUD
        const el = document.getElementById('hud-level');
        const labels = ['ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN'];
        el.textContent = `LEVEL ${labels[index] || index + 1}`;
        // Sub-label below
        let sub = document.getElementById('hud-sublabel');
        if (!sub) {
            sub = document.createElement('span');
            sub.id = 'hud-sublabel';
            sub.style.cssText = 'font-size:9px;color:#0f2540;display:block;';
            el.parentNode.appendChild(sub);
        }
        sub.textContent = LEVEL_NAMES[index] || '';
    }
}
