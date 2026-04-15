/*
 * GameScene.js
 */

const OFFSET_X = 0;
const OFFSET_Y = 52;
const TWEEN_MS = 110;

const GHOST_COLORS = [0x7c6fff, 0xff6b9d, 0xffd166];
const ANOMALY_COLOR = 0xff2244;

// ─── Web Audio helpers ────────────────────────────────────────────────────────
let _audioCtx = null;
function _ac() {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _audioCtx;
}
function _beep(freq, type, duration, vol = 0.18, delay = 0) {
    try {
        const ctx = _ac();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = type; o.frequency.value = freq;
        const t = ctx.currentTime + delay;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + duration);
        o.start(t); o.stop(t + duration);
    } catch (_) {}
}
function soundMove()  { _beep(220, 'square', 0.06, 0.08); }
function soundPlate() { _beep(660, 'sine',   0.18, 0.22); _beep(880, 'sine', 0.12, 0.14, 0.05); }
function soundWhoosh() {
    try {
        const ctx = _ac();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
        const src = ctx.createBufferSource();
        const g = ctx.createGain();
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 0.5;
        src.buffer = buf; src.connect(f); f.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.28, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        src.start();
    } catch (_) {}
}
function soundDoorOpen() { _beep(440, 'sine', 0.25, 0.2); _beep(550, 'sine', 0.2, 0.18, 0.1); _beep(660, 'sine', 0.15, 0.15, 0.2); }
function soundWin()      { [523, 659, 784, 1047].forEach((f, i) => _beep(f, 'sine', 0.3, 0.2, i * 0.12)); }
function soundUndo()     { _beep(330, 'triangle', 0.08, 0.12); _beep(220, 'triangle', 0.08, 0.10, 0.06); }
function soundWarn()     { _beep(180, 'sawtooth', 0.12, 0.15); }
function soundConverge() {
    [261, 329, 392, 523].forEach((f, i) => _beep(f, 'sine', 0.6, 0.14, i * 0.07));
}
function soundAnomaly() { _beep(110, 'sawtooth', 0.08, 0.12); }
function soundTeleport() { _beep(880, 'sine', 0.12, 0.18); _beep(1320, 'sine', 0.08, 0.12, 0.08); }
function soundTimerWarn() { _beep(440, 'square', 0.06, 0.10); }

// ─── Dialogue data ───────────────────────────────────────────────────────────
const DIALOGUES = [
    { start: ['...Hello?', 'Is anyone there?', 'That green light…', 'It feels important.'],
      end:   ['It reacted…', 'Like it was waiting for me.'] },
    { start: ['Wait… what was that?', 'I just saw… myself.'],
      end:   ["That wasn't a reflection.", 'It followed me.'] },
    { start: ["So it's real…", 'Another version of me.'],
      end:   ['We can work together.', 'We have to.'] },
    { start: ['This feels familiar…', "Like I've already failed here."],
      end:   ['Every move stays.', 'Nothing is erased.'] },
    { start: ["It's not just movement…", "It's timing."],
      end:   ['I can control this.', 'If I think ahead.'] },
    { start: ['Why are they in my way?', "They're… me."],
      end:   ["My past doesn't just help…", 'It can trap me.'] },
    { start: ["This isn't random.", "There's a pattern."],
      end:   ['Everything connects.', 'Step by step.'] },
    { start: ['There are too many of us now…', 'But somehow… it makes sense.'],
      end:   ['Each one of me…', 'Has a purpose.'] },
    { start: ['I see it now…', 'The whole plan.', 'C first. Then A. Then B.'],
      end:   ['One mistake…', 'And everything collapses.'] },
    { start: ['All the loops…', 'All the paths…', 'They were leading here.'],
      end:   ["I wasn't trapped in the loop…", 'I was building it.'] },
];

export default class GameScene extends Phaser.Scene {

    constructor() {
        super('GameScene');
        this.level    = 0;
        this.maxLoops = 3;
        this._COLS    = 9;
        this._ROWS    = 9;
        this._GRID    = 64;
    }

    init(data) {
        if (data?.level !== undefined) this.level = data.level;
    }

    // ─── LEVEL DEFINITIONS ───────────────────────────────────────────
    get levelDefs() {
        return [
            // ── Level 1 ── FALSE CONFIDENCE: no door, no loop needed, just walk to goal
            // Open grid, player walks freely to goal — feels smart, expects more of the same.
            {
                maxLoops: 1,
                playerStart: { x: 1, y: 7 },
                goal:        { x: 7, y: 1 },
                plates: [],
                doors:  [],
                walls:  []
            },

            // ── Level 2 ── THE FIRST BETRAYAL: first loop required
            // Vertical wall x=4 (y=1-7) splits the grid. Door at (4,4) needs plate A.
            // Plate A is on the LEFT at (2,4). Goal is on the RIGHT at (6,4).
            // Player starts at (1,4) — same side as the plate, opposite side from goal.
            // Naive attempt: step on A, door opens, but walking right means leaving A → door closes.
            // Solution: Loop1 → step on A → press R. Ghost replays and holds A.
            //           Loop2 → door stays open → walk right through to goal.
            {
                maxLoops: 2,
                playerStart: { x: 1, y: 4 },
                goal:        { x: 7, y: 4 },
                plates: [{ x: 2, y: 4, id: 'A' }],
                doors:  [{ x: 4, y: 4, requiredPlates: ['A'] }],
                walls: [
                    // Vertical wall x=4, y=1-7 except door at y=4
                    { x: 4, y: 1 }, { x: 4, y: 2 }, { x: 4, y: 3 },
                    { x: 4, y: 5 }, { x: 4, y: 6 }, { x: 4, y: 7 },
                ]
            },

            // ── Level 3 ── DOUBLE DEPENDENCY: 2 plates → 1 door, ghost placement matters
            // Mechanic: both plates A and B must be held simultaneously to open the door.
            // Layout: horizontal wall y=4 (x=1-7), door at (4,4) needs A+B.
            // Plate A at (2,2) top-left. Plate B at (6,2) top-right.
            // Goal at (4,7) bottom-centre. Player starts at (4,1) top-centre.
            // Solution: Loop1 → step A at (2,2) → press R.
            //           Loop2 → ghost holds A → step B at (6,2) → door opens → walk down through (4,4) to goal.
            {
                maxLoops: 2,
                playerStart: { x: 4, y: 1 },
                goal:        { x: 4, y: 7 },
                plates: [
                    { x: 2, y: 2, id: 'A' },
                    { x: 6, y: 2, id: 'B' }
                ],
                doors: [{ x: 4, y: 4, requiredPlates: ['A', 'B'] }],
                walls: [
                    // Horizontal wall y=4, full span except door at x=4
                    { x: 1, y: 4 }, { x: 2, y: 4 }, { x: 3, y: 4 },
                    { x: 5, y: 4 }, { x: 6, y: 4 }, { x: 7, y: 4 },
                    // Funnel: block direct path between A and B so player must commit to one side
                    { x: 4, y: 2 },
                    // Seal top corners so plates are in distinct pockets
                    { x: 1, y: 3 }, { x: 7, y: 3 },
                ]
            },

            // ── Level 4 ── ORDER CONTROLS REALITY: sequence matters, wrong order = unsolvable
            // Mechanic: plate A is locked behind a wall. Must collect A first, then B, then loop.
            // Left wall x=3 (y=1-5 and y=7), door at (3,6) needs A — exit at bottom of chamber.
            // Right wall x=6 (y=1-3 and y=5-7), door at (6,4) needs A+B — final gate.
            // Plate A at (2,4) inside left chamber. Plate B at (5,6) in middle zone.
            // Goal at (7,4). Player starts at (1,4).
            // Route: (1,4)→(2,4) step A → walk down to (2,6) → right through door (3,6) →
            //        right to (5,6) step B → press R.
            // Loop2: ghost replays A+B → both doors open → walk right through (6,4) to goal.
            {
                maxLoops: 2,
                playerStart: { x: 1, y: 4 },
                goal:        { x: 7, y: 4 },
                plates: [
                    { x: 2, y: 4, id: 'A' },
                    { x: 5, y: 6, id: 'B' }
                ],
                doors: [
                    { x: 3, y: 6, requiredPlates: ['A'] },
                    { x: 6, y: 4, requiredPlates: ['A', 'B'] }
                ],
                walls: [
                    // Left wall x=3, y=1-7 except door at y=6
                    { x: 3, y: 1 }, { x: 3, y: 2 }, { x: 3, y: 3 },
                    { x: 3, y: 4 }, { x: 3, y: 5 },
                    { x: 3, y: 7 },
                    // Right wall x=6, y=1-7 except door at y=4
                    { x: 6, y: 1 }, { x: 6, y: 2 }, { x: 6, y: 3 },
                    { x: 6, y: 5 }, { x: 6, y: 6 }, { x: 6, y: 7 },
                    // Seal top of right zone so goal only reachable via door at (6,4)
                    { x: 7, y: 2 }, { x: 7, y: 3 },
                ]
            },

            // ── Level 5 ── TIME IS A WEAPON: two ghosts, two doors, tight coordination
            // Vertical wall x=4 splits the grid. Left door at (4,3) needs A. Right door at (4,5) needs B.
            // Plate A at (1,3) top-left pocket. Plate B at (7,5) bottom-right pocket.
            // Goal at (7,1). Player starts at (1,7).
            // Loop1: walk up to A at (1,3) [4 steps] → R.
            // Loop2: ghost holds A → door (4,3) open → walk through to B at (7,5) [12 steps] → R.
            // Loop3: ghost1 on A + ghost2 on B → both doors open → walk to goal (7,1) [12 steps].
            {
                maxLoops: 3,
                stepLimit: 40,
                playerStart: { x: 1, y: 7 },
                goal:        { x: 7, y: 1 },
                plates: [
                    { x: 1, y: 3, id: 'A' },
                    { x: 7, y: 5, id: 'B' }
                ],
                fakePlates: [
                    { x: 7, y: 3 },
                    { x: 1, y: 5 }
                ],
                doors: [
                    { x: 4, y: 3, requiredPlates: ['A'] },
                    { x: 4, y: 5, requiredPlates: ['B'] }
                ],
                walls: [
                    // Vertical divider x=4, full height except doors at y=3 and y=5
                    { x: 4, y: 1 }, { x: 4, y: 2 },
                    { x: 4, y: 4 },
                    { x: 4, y: 6 }, { x: 4, y: 7 },
                    // Seal goal corner so only reachable from below through right zone
                    { x: 5, y: 1 }, { x: 6, y: 1 },
                    // Seal plate A pocket — must approach from below
                    { x: 2, y: 3 }, { x: 1, y: 2 },
                    // Seal plate B pocket — must approach from above
                    { x: 6, y: 5 }, { x: 7, y: 6 },
                ]
            },

            // ── Level 6 ── SELF-SABOTAGE
            // Player starts top-centre. A and B are in top-left/right pockets.
            // Door (4,3) needs A+B — ghost1 holds A, ghost2 holds B.
            // Plate C is at (4,4) in the middle corridor between the two doors.
            // Door (4,5) needs C — player steps on C after passing door 1, opens door 2, reaches goal.
            // Solution: Loop1 → go left to A(1,2) → R.
            //           Loop2 → ghost holds A → go right to B(7,2) → R.
            //           Loop3 → ghost1 on A + ghost2 on B → door(4,3) opens → walk down → step C(4,4) → door(4,5) opens → goal.
            {
                maxLoops: 3,
                playerStart: { x: 4, y: 1 },
                goal:        { x: 4, y: 7 },
                plates: [
                    { x: 1, y: 2, id: 'A' },
                    { x: 7, y: 2, id: 'B' },
                    { x: 4, y: 4, id: 'C' }
                ],
                fakePlates: [
                    { x: 1, y: 6 },
                    { x: 7, y: 6 }
                ],
                doors: [
                    { x: 4, y: 3, requiredPlates: ['A', 'B'] },
                    { x: 4, y: 5, requiredPlates: ['C'] }
                ],
                walls: [
                    { x: 2, y: 3 }, { x: 3, y: 3 }, { x: 5, y: 3 }, { x: 6, y: 3 },
                    { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 },
                    { x: 2, y: 1 }, { x: 1, y: 3 },
                    { x: 6, y: 1 }, { x: 7, y: 3 },
                ]
            },

            // ── Level 7 ── CHAIN REACTION BRAIN
            // Player (1,7). Plate A(1,3) top-left. Plate B(7,3) top-right.
            // Door (4,3) needs A. Door (4,5) needs A+B. Goal (7,7).
            // Vertical wall x=4 full height except doors at y=3 and y=5.
            // Left side open: player can freely reach A at (1,3).
            // Right side open: once door(4,3) is open (ghost holds A), player crosses to B(7,3).
            // Goal (7,7) is open — reachable from right side after door(4,5) opens.
            // Solution:
            //   Loop1 → walk up to A(1,3) → R.
            //   Loop2 → ghost holds A → door(4,3) open → cross to right → step B(7,3)
            //           → door(4,5) opens → walk down to goal(7,7).
            {
                maxLoops: 3,
                playerStart: { x: 1, y: 7 },
                goal:        { x: 7, y: 7 },
                plates: [
                    { x: 1, y: 3, id: 'A' },
                    { x: 7, y: 3, id: 'B' }
                ],
                fakePlates: [
                    { x: 1, y: 5 },
                    { x: 7, y: 5 }
                ],
                doors: [
                    { x: 4, y: 3, requiredPlates: ['A'] },
                    { x: 4, y: 5, requiredPlates: ['A', 'B'] }
                ],
                walls: [
                    // Vertical divider x=4, full height except doors at y=3 and y=5
                    { x: 4, y: 1 }, { x: 4, y: 2 },
                    { x: 4, y: 4 },
                    { x: 4, y: 6 }, { x: 4, y: 7 },
                    // Seal plate A pocket: approach only from below
                    { x: 2, y: 3 }, { x: 1, y: 2 },
                    // Seal plate B pocket: approach only from below
                    { x: 6, y: 3 }, { x: 7, y: 2 },
                ]
            },

            // ── Level 8 ── PARALLEL MINDS
            // Player (4,1). Plate A(1,3) top-left. Plate B(7,3) top-right. Plate C(4,3) centre.
            // Door (4,5) needs A+B+C. Goal (4,7).
            // A and B are in open top-left/right pockets, freely reachable from start.
            // C is at (4,3), reachable directly from start going straight down.
            // The trick: you need all three held simultaneously for the single door.
            // Solution:
            //   Loop1 → go left to A(1,3) → R.
            //   Loop2 → ghost1 holds A → go right to B(7,3) → R.
            //   Loop3 → ghost1 on A + ghost2 on B → walk down to C(4,3) → step C
            //           → door(4,5) opens (A+B+C all active) → walk to goal(4,7).
            {
                maxLoops: 4,
                playerStart: { x: 4, y: 1 },
                goal:        { x: 4, y: 7 },
                plates: [
                    { x: 1, y: 3, id: 'A' },
                    { x: 7, y: 3, id: 'B' },
                    { x: 4, y: 3, id: 'C' }
                ],
                fakePlates: [
                    { x: 1, y: 6 },
                    { x: 7, y: 6 }
                ],
                doors: [
                    { x: 4, y: 5, requiredPlates: ['A', 'B', 'C'] }
                ],
                walls: [
                    // Seal top-left pocket: A only reachable from above-left
                    { x: 2, y: 3 }, { x: 1, y: 4 },
                    // Seal top-right pocket: B only reachable from above-right
                    { x: 6, y: 3 }, { x: 7, y: 4 },
                    // Block sides of centre column so only path down is x=4
                    { x: 2, y: 4 }, { x: 3, y: 4 }, { x: 5, y: 4 }, { x: 6, y: 4 },
                    // Seal bottom so goal only via door(4,5)
                    { x: 2, y: 5 }, { x: 3, y: 5 }, { x: 5, y: 5 }, { x: 6, y: 5 },
                    { x: 1, y: 5 }, { x: 7, y: 5 },
                    { x: 2, y: 6 }, { x: 3, y: 6 }, { x: 5, y: 6 }, { x: 6, y: 6 },
                ]
            },

            // ── Level 9 ── PERFECT PLAN OR FAIL
            // Enforces C→A→B order structurally via chained doors — no sequence logic needed.
            //
            // Layout:
            //   Player (1,1). C(1,4) left column. A(4,4) centre. B(7,4) right.
            //   Door1 (3,4) needs C   — blocks path from C to A.
            //   Door2 (6,4) needs C+A — blocks path from A to B.
            //   Door3 (4,7) needs C+A+B — final gate to goal (4,7).
            //
            // Horizontal wall y=4 full width except at doors (3,4) and (6,4).
            // Player starts top-left. Must go C→door1 opens→A→door2 opens→B→door3 opens→goal.
            //
            // Solution (2 loops):
            //   Loop1: (1,1)→down→C(1,4)→right through door1(3,4)→A(4,4)→R
            //   Loop2: ghost holds C+A → door1+door2 open → player goes to B(7,4)
            //          → door3 opens (C+A+B) → walk down to goal(4,7).
            {
                maxLoops: 3,
                stepLimit: 45,
                playerStart: { x: 1, y: 1 },
                goal:        { x: 4, y: 7 },
                plates: [
                    { x: 1, y: 4, id: 'C' },
                    { x: 4, y: 4, id: 'A' },
                    { x: 7, y: 4, id: 'B' }
                ],
                fakePlates: [
                    { x: 1, y: 6 },
                    { x: 7, y: 6 }
                ],
                doors: [
                    { x: 3, y: 4, requiredPlates: ['C'] },
                    { x: 6, y: 4, requiredPlates: ['C', 'A'] },
                    { x: 4, y: 6, requiredPlates: ['C', 'A', 'B'] }
                ],
                plateHints: {
                    'C': ['C first.', 'It unlocks the path forward.'],
                    'A': ['A second.', 'One more gate to go.'],
                    'B': ['B last.', 'Now the final door opens.']
                },
                walls: [
                    // Horizontal wall y=4, full width except doors at x=3 and x=6
                    { x: 2, y: 4 },
                    { x: 5, y: 4 },
                    // Seal B pocket: only reachable from left through door2
                    { x: 7, y: 3 }, { x: 7, y: 5 },
                    // Funnel goal: only reachable via door3(4,6)
                    { x: 2, y: 6 }, { x: 3, y: 6 },
                    { x: 5, y: 6 }, { x: 6, y: 6 },
                    // Seal top-right so player can't skip to B directly
                    { x: 5, y: 1 }, { x: 6, y: 1 },
                ]
            },

            // ── Level 10 ── THE ARCHITECT'S TRIAL (BOSS)
            //
            // Layout (9×9, borders are auto-walls):
            //   Player (1,1). A(1,4) left. B(7,4) right. C(4,7) bottom-centre.
            //   Door1 (4,3) needs A+B — vertical divider blocks centre top.
            //   Door2 (4,6) needs A+B+C — final gate above goal.
            //   Goal  (4,7) directly below door2 — no extra walls needed.
            //
            //   Left zone  (x=1-3): open, A at (1,4), freely reachable from start.
            //   Right zone (x=5-7): open, B at (7,4), reachable via top row.
            //   Centre corridor (x=4, y=4-7): open once door1 unlocked.
            //   C at (4,7) = goal tile — stepping it AND being on goal wins.
            //   Wait — C must be a plate, goal must be separate.
            //   Revised: C(4,6), goal(4,7). Door2(4,5) needs A+B+C.
            //
            // Verified paths:
            //   Start(1,1)→down→A(1,4): clear (no walls in left zone) ✓
            //   Start(1,1)→right along y=1→(7,1)→down→B(7,4): clear ✓
            //   Door1(4,3) open when A+B held → (4,4)→(4,5) door2 → needs C too.
            //   C(4,6) reachable from (4,4) going down: (4,4)→(4,5)→(4,6) ✓
            //     BUT door2 is at (4,5) — player can't pass it to reach C(4,6).
            //   Fix: put C above door2. C(4,4), door2(4,5) needs A+B+C, goal(4,7).
            //   Player steps C(4,4) right after passing door1(4,3), then door2(4,5)
            //   opens, walks to goal(4,7). ✓
            //
            // Final layout:
            //   Plates: A(1,4), B(7,4), C(4,4)
            //   Door1 (4,3) needs A+B
            //   Door2 (4,5) needs A+B+C
            //   Goal  (4,7)
            //   Vertical wall x=4 at y=1,2 only (door1 at y=3, C at y=4, door2 at y=5 open)
            //
            // Solution (3 loops):
            //   Loop1: (1,1)→down to A(1,4) → R
            //   Loop2: ghost1 on A → (1,1)→right to (7,1)→down to B(7,4) → R
            //   Loop3: ghost1 on A + ghost2 on B → door1(4,3) opens
            //          → walk down to C(4,4) → door2(4,5) opens (A+B+C)
            //          → walk down to goal(4,7).
            {
                maxLoops: 4,
                stepLimit: 55,
                playerStart: { x: 1, y: 1 },
                goal:        { x: 4, y: 7 },
                plates: [
                    { x: 1, y: 4, id: 'A' },
                    { x: 7, y: 4, id: 'B' },
                    { x: 4, y: 4, id: 'C' }
                ],
                fakePlates: [
                    { x: 1, y: 6 },
                    { x: 7, y: 6 }
                ],
                doors: [
                    { x: 4, y: 3, requiredPlates: ['A', 'B'] },
                    { x: 4, y: 5, requiredPlates: ['A', 'B', 'C'] }
                ],
                walls: [
                    // Vertical divider x=4 at y=1,2 — door at y=3, open below
                    { x: 4, y: 1 }, { x: 4, y: 2 },
                    // Seal A pocket: only reachable from above, not from right
                    { x: 2, y: 4 }, { x: 1, y: 5 },
                    // Seal B pocket: only reachable from above, not from left
                    { x: 6, y: 4 }, { x: 7, y: 5 },
                    // Funnel goal: only reachable via door2(4,5)
                    { x: 3, y: 6 }, { x: 5, y: 6 },
                    { x: 2, y: 7 }, { x: 3, y: 7 },
                    { x: 5, y: 7 }, { x: 6, y: 7 },
                ]
            }
        ];
    }

    // ─── LIFECYCLE ───────────────────────────────────────────────────

    create() {
        this.cursors  = this.input.keyboard.createCursorKeys();
        this.keys     = this.input.keyboard.addKeys('W,A,S,D,R,U,ESC');
        this.tweening = false;
        this.gameOver = false;
        this._paused  = false;

        this.game.events.off('touch-move').on('touch-move', ({ dx, dy }) => this._tryMove(dx, dy));
        this.game.events.off('resetLoop').on('resetLoop',   () => this._resetLoop());
        this.game.events.off('restart-level').on('restart-level', () => this.loadLevel(this.level));
        this.game.events.off('undo').on('undo', () => this._undo());
        this.game.events.off('mobile-pause').on('mobile-pause', () => this._togglePause());
        this.game.events.off('goto-title').on('goto-title', () => {
            this.scene.stop('UIScene');
            this.scene.start('TitleScene');
            this.scene.stop('GameScene');
        });
        if (!this.scene.isActive('UIScene')) this.scene.launch('UIScene');

        this.loadLevel(this.level);
    }

    // ─── LEVEL LOADING ───────────────────────────────────────────────

    loadLevel(index) {
        this.children.removeAll(true);
        this.tweening = false;
        this.gameOver = false;
        this._paused  = false;
        this._rewindPlaying = false;

        const def = this.levelDefs[index];
        this.def       = def;
        this.maxLoops  = def.maxLoops ?? def.plates.length + 1;
        this.recording  = [];
        this.ghosts     = [];
        this.loopCount  = 1;
        this.step       = 0;
        this._undoStack  = [];
        this._loopStack  = [];  // saves full loop state so U can undo a reset
        this._warnedStep = false;
        this._stepLimit  = def.stepLimit ?? 40;
        this._sequenceProgress = []; // tracks plate-step order for sequence doors
        this._hintedPlates = new Set(); // plates already hinted this loop

        // Per-level grid dimensions
        this._COLS = def.cols     ?? 9;
        this._ROWS = def.rows     ?? 9;
        this._GRID = def.tileSize ?? 64;

        this._buildWallSet(def);
        this._drawFloor();
        this._drawWalls(def);

        // Ghost trail graphics layer (drawn under sprites)
        this._trailGfx = this.add.graphics().setDepth(3);
        this._ghostPaths = []; // per-ghost array of {x,y} world positions visited

        this.goalSprite = this._addSprite('goal', def.goal.x, def.goal.y);
        this._pulse(this.goalSprite);

        this.plateSprites = def.plates.map(p => {
            const s = this._addSprite('plate', p.x, p.y);
            s.plateId = p.id;
            s.active  = false;
            s.setTint(0xff2222); // red at start
            return s;
        });

        // Fake plates — same visual, never activate doors
        this.fakePlateSprites = (def.fakePlates || []).map(p => {
            const s = this._addSprite('plate', p.x, p.y);
            s.isFake = true;
            s.setTint(0xff2222); // red at start
            return s;
        });

        this.doorSprites = def.doors.map(d => {
            const s = this._addSprite('door', d.x, d.y);
            s.requiredPlates = d.requiredPlates;
            s.sequence = d.sequence || null; // optional ordered sequence
            s.open = false;
            return s;
        });

        // Anomalies — tile-blocking patrol entities
        this.anomalies = (def.anomalies || []).map(a => {
            const s = this.add.rectangle(this._px(a.x), this._py(a.y),
                this._GRID - 8, this._GRID - 8, ANOMALY_COLOR)
                .setAlpha(0.85).setDepth(6);
            this._pulseAnomaly(s);
            return { sprite: s, gx: a.x, gy: a.y, pattern: a.pattern, step: 0 };
        });
        this._anomalySet = new Set(this.anomalies.map(a => `${a.gx},${a.gy}`));

        // Portals — paired teleport tiles
        this.portals = (def.portals || []).map(p => {
            const sa = this._drawPortal(p.ax, p.ay);
            const sb = this._drawPortal(p.bx, p.by);
            return { ax: p.ax, ay: p.ay, bx: p.bx, by: p.by, spriteA: sa, spriteB: sb };
        });

        // Timer plates — activate for N steps when stepped on
        this.timerPlateSprites = (def.timerPlates || []).map(p => {
            const s = this._addSprite('plate', p.x, p.y);
            s.plateId  = p.id;
            s.duration = p.duration;
            s.remaining = 0;  // steps left while active
            s.active   = false;
            s.setTint(0x00e5ff); // cyan tint to distinguish from normal plates
            return s;
        });

        this.goalSprite.gx = def.goal.x;
        this.goalSprite.gy = def.goal.y;

        this.playerSprite = this._addSprite('player', def.playerStart.x, def.playerStart.y);
        this.playerSprite.setDepth(10);
        this.playerGx = def.playerStart.x;
        this.playerGy = def.playerStart.y;

        // Camera follow for large levels
        const cam = this.cameras.main;
        if (def.camera) {
            const worldW = this._COLS * this._GRID;
            const worldH = this._ROWS * this._GRID + OFFSET_Y;
            this.physics.world?.setBounds(0, 0, worldW, worldH);
            cam.setBounds(0, OFFSET_Y, worldW, worldH - OFFSET_Y);
            cam.startFollow(this.playerSprite, true, 0.1, 0.1);
        } else {
            cam.stopFollow();
            cam.setBounds(0, 0, this.scale.width, this.scale.height);
            cam.setScroll(0, 0);
        }

        this._emitUI();
        this._drawLevelLabel(index);
        // Show start dialogue after a short delay
        const d = DIALOGUES[index];
        if (d?.start?.length) this.time.delayedCall(400, () => this._showDialogue(d.start));
    }

    // ─── DIALOGUE SYSTEM ───────────────────────────────────────────────────────────

    _showDialogue(lines, onDone) {
        if (!lines?.length) { onDone?.(); return; }
        this._dialogueActive = true;
        this._dialogueOnDone = onDone || null;
        this._dialogueLines  = [...lines];
        this._dialogueIndex  = 0;
        // end-of-level lines use narrator bar at top; start lines use thought bubble
        this._dialogueIsNarrator = !!onDone;
        this._spawnDialogueUI();
        this._typeNextLine();
    }

    _spawnDialogueUI() {
        this._dialogueContainer?.destroy();
        this._dialogueContainer = this.add.container(0, 0).setDepth(45);

        if (this._dialogueIsNarrator) {
            this._spawnNarratorBar();
        } else {
            this._spawnThoughtBubble();
        }

        this._dialoguePointerHandler = () => this._advanceDialogue();
        this._dialogueKeyHandler = (e) => {
            if (e.keyCode === 32 || e.keyCode === 13 || e.keyCode === 90) this._advanceDialogue();
        };
        this.input.once('pointerdown', this._dialoguePointerHandler);
        this.input.keyboard.on('keydown', this._dialogueKeyHandler);
    }

    _spawnThoughtBubble() {
        // Thought bubble floats above the player's head
        const px = this._px(this.playerGx);
        const py = this._py(this.playerGy);
        const bw = 180, bh = 52;
        // Clamp so bubble stays on screen
        const bx = Phaser.Math.Clamp(px, bw / 2 + 8, this.scale.width - bw / 2 - 8);
        const by = Phaser.Math.Clamp(py - 72, OFFSET_Y + bh / 2 + 6, this.scale.height - bh - 60);

        // Bubble background
        const bg = this.add.rectangle(bx, by, bw, bh, 0x0d1b2a, 0.94)
            .setStrokeStyle(1.5, 0x00e5ff, 0.8);
        // Small tail pointing down toward player
        const tail = this.add.triangle(
            bx, by + bh / 2,
            -8, 0,
             8, 0,
             0, 14,
            0x0d1b2a, 0.94
        );
        // Cyan dot chain (thought bubble dots)
        const d1 = this.add.circle(bx,      by + bh / 2 + 18, 3, 0x00e5ff, 0.7);
        const d2 = this.add.circle(bx + 4,  by + bh / 2 + 26, 2, 0x00e5ff, 0.5);

        this._dialogueText = this.add.text(bx, by, '', {
            fontSize: '12px', fontFamily: 'Segoe UI, Arial',
            fill: '#e2e8f0', align: 'center',
            wordWrap: { width: bw - 16 }
        }).setOrigin(0.5).setDepth(46);

        this._dialogueCursor = this.add.text(bx + bw / 2 - 10, by + bh / 2 - 10, '▼', {
            fontSize: '9px', fill: '#00e5ff'
        }).setAlpha(0).setDepth(46);

        this._dialogueContainer.add([bg, tail, d1, d2]);

        // Pop in
        this._dialogueContainer.setScale(0.6).setAlpha(0);
        this.tweens.add({
            targets: this._dialogueContainer,
            scaleX: 1, scaleY: 1, alpha: 1,
            duration: 180, ease: 'Back.easeOut'
        });
    }

    _spawnNarratorBar() {
        // Narrator bar sits just below the HUD at the top
        const W = this.scale.width;
        const barY = OFFSET_Y + 28;

        const bg = this.add.rectangle(W / 2, barY, W, 44, 0x000000, 0.82)
            .setStrokeStyle(1, 0x7c6fff, 0.7);
        // Left accent line
        this.add.rectangle(4, barY, 3, 36, 0x7c6fff, 0.9);

        this._dialogueText = this.add.text(W / 2, barY, '', {
            fontSize: '12px', fontFamily: 'Segoe UI, Arial',
            fill: '#c4b5fd', align: 'center', fontStyle: 'italic',
            wordWrap: { width: W - 32 }
        }).setOrigin(0.5).setDepth(46);

        this._dialogueCursor = this.add.text(W - 16, barY + 14, '▼', {
            fontSize: '9px', fill: '#7c6fff'
        }).setAlpha(0).setDepth(46);

        this._dialogueContainer.add([bg]);

        // Slide down from top
        this._dialogueContainer.setY(-50).setAlpha(0);
        this.tweens.add({
            targets: this._dialogueContainer,
            y: 0, alpha: 1,
            duration: 200, ease: 'Quad.easeOut'
        });
    }

    _typeNextLine() {
        const line = this._dialogueLines[this._dialogueIndex];
        this._dialogueText.setText('');
        this._dialogueCursor.setAlpha(0);
        this._dialogueTyping = true;

        let i = 0;
        this._dialogueTimer = this.time.addEvent({
            delay: 38,
            repeat: line.length - 1,
            callback: () => {
                this._dialogueText.setText(line.substring(0, ++i));
                if (i >= line.length) {
                    this._dialogueTyping = false;
                    // Blink cursor
                    this.tweens.add({
                        targets: this._dialogueCursor,
                        alpha: 1, duration: 300, yoyo: true, repeat: -1
                    });
                }
            }
        });
    }

    _advanceDialogue() {
        // If still typing, skip to full line
        if (this._dialogueTyping) {
            this._dialogueTimer?.remove();
            this._dialogueTyping = false;
            this._dialogueText.setText(this._dialogueLines[this._dialogueIndex]);
            this.tweens.killTweensOf(this._dialogueCursor);
            this._dialogueCursor.setAlpha(1);
            // Re-register pointer for next advance
            this.input.once('pointerdown', this._dialoguePointerHandler);
            return;
        }

        this._dialogueIndex++;
        if (this._dialogueIndex < this._dialogueLines.length) {
            this.tweens.killTweensOf(this._dialogueCursor);
            this._typeNextLine();
            this.input.once('pointerdown', this._dialoguePointerHandler);
        } else {
            this._closeDialogue();
        }
    }

    _closeDialogue() {
        this.input.off('pointerdown', this._dialoguePointerHandler);
        this.input.keyboard.off('keydown', this._dialogueKeyHandler);
        this._dialogueTimer?.remove();
        this.tweens.killTweensOf(this._dialogueCursor);

        const tweenProps = this._dialogueIsNarrator
            ? { y: -50, alpha: 0 }
            : { scaleX: 0.6, scaleY: 0.6, alpha: 0 };

        this.tweens.add({
            targets: this._dialogueContainer, ...tweenProps,
            duration: 180, ease: 'Quad.easeIn',
            onComplete: () => {
                this._dialogueContainer?.destroy();
                this._dialogueText?.destroy();
                this._dialogueCursor?.destroy();
                this._dialogueContainer = null;
                this._dialogueActive = false;
                this._dialogueOnDone?.();
            }
        });
    }

    // ─── END DIALOGUE SYSTEM ─────────────────────────────────────────────────────────

    _buildWallSet(def) {
        this.wallSet = new Set();
        for (let x = 0; x < this._COLS; x++) {
            this.wallSet.add(`${x},0`);
            this.wallSet.add(`${x},${this._ROWS - 1}`);
        }
        for (let y = 0; y < this._ROWS; y++) {
            this.wallSet.add(`0,${y}`);
            this.wallSet.add(`${this._COLS - 1},${y}`);
        }
        (def.walls || []).forEach(w => this.wallSet.add(`${w.x},${w.y}`));
    }

    _drawFloor() {
        const g = this._GRID;
        for (let y = 0; y < this._ROWS; y++)
            for (let x = 0; x < this._COLS; x++) {
                const img = this.add.image(this._px(x), this._py(y),
                    (x + y) % 2 === 0 ? 'floor' : 'floor2').setDepth(0);
                img.setDisplaySize(g, g);
            }
    }

    _drawWalls(def) {
        const g = this._GRID;
        this.wallSet.forEach(key => {
            const [x, y] = key.split(',').map(Number);
            this.add.image(this._px(x), this._py(y), 'wall').setDepth(1).setDisplaySize(g, g);
        });
    }

    _drawLevelLabel(index) {
        const labels = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN'];
        const names  = ['FALSE CONFIDENCE', 'THE FIRST BETRAYAL', 'DOUBLE DEPENDENCY', 'ORDER CONTROLS REALITY',
                        'TIME IS A WEAPON', 'SELF-SABOTAGE', 'CHAIN OF CONSEQUENCES',
                        'PARALLEL EXECUTION', 'NO MISTAKES ALLOWED', "THE ARCHITECT'S TRIAL"];
        this.add.text(this.scale.width / 2, OFFSET_Y + 14, `LEVEL ${labels[index]}`, {
            fontSize: '11px', fontFamily: 'Segoe UI, Arial',
            fill: '#1e3a5f', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(0);
        this.add.text(this.scale.width / 2, OFFSET_Y + 28, names[index] || '', {
            fontSize: '10px', fontFamily: 'Segoe UI, Arial',
            fill: '#0f2540'
        }).setOrigin(0.5).setDepth(0);
    }

    // ─── UPDATE ──────────────────────────────────────────────────────

    update() {
        if (this._dialogueActive) return;
        if (this.tweening || this.gameOver) return;

        let dx = 0, dy = 0;
        if (Phaser.Input.Keyboard.JustDown(this.cursors.left)  || Phaser.Input.Keyboard.JustDown(this.keys.A))  dx = -1;
        if (Phaser.Input.Keyboard.JustDown(this.cursors.right) || Phaser.Input.Keyboard.JustDown(this.keys.D))  dx =  1;
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)    || Phaser.Input.Keyboard.JustDown(this.keys.W))  dy = -1;
        if (Phaser.Input.Keyboard.JustDown(this.cursors.down)  || Phaser.Input.Keyboard.JustDown(this.keys.S))  dy =  1;

        if (Phaser.Input.Keyboard.JustDown(this.keys.ESC)) { this._togglePause(); return; }
        if (this._paused) return;
        if (dx !== 0 || dy !== 0) this._tryMove(dx, dy);
        if (Phaser.Input.Keyboard.JustDown(this.keys.R)) this._resetLoop();
        if (Phaser.Input.Keyboard.JustDown(this.keys.U)) this._undo();

        // Step-limit warning at 87.5% of limit
        const warnAt = Math.floor(this._stepLimit * 0.875);
        if (this.step === warnAt && !this._warnedStep) { this._warnedStep = true; soundWarn(); this._flashScreen(0xff6b00, 0.12); }
    }

    // ─── MOVEMENT ────────────────────────────────────────────────────

    _tryMove(dx, dy) {
        if (this.tweening || this.gameOver || this._paused) return;

        const nx = this.playerGx + dx;
        const ny = this.playerGy + dy;

        if (this._isWall(nx, ny)) return;
        if (this._isClosedDoor(nx, ny)) return;
        if (this._isAnomaly(nx, ny)) return;

        // Enforce step limit
        if (this.step >= this._stepLimit) return;

        // Save undo snapshot before moving
        this._undoStack.push({
            playerGx: this.playerGx, playerGy: this.playerGy,
            recording: [...this.recording],
            step: this.step,
            sequenceProgress: [...this._sequenceProgress],
            ghostStates: this.ghosts.map(g => ({ gx: g.gx, gy: g.gy, step: g.step })),
            anomalyStates: this.anomalies.map(a => ({ gx: a.gx, gy: a.gy, step: a.step })),
            timerStates: this.timerPlateSprites.map(t => ({ remaining: t.remaining, active: t.active }))
        });

        this.playerGx = nx;
        this.playerGy = ny;
        this.recording.push({ dx, dy });

        // Portal teleport — player and ghosts
        const teleported = this._applyPortal(this.playerGx, this.playerGy);
        if (teleported) { this.playerGx = teleported.x; this.playerGy = teleported.y; soundTeleport(); }

        // Advance every ghost one step unconditionally (ghosts ignore doors and anomalies)
        this.ghosts.forEach(g => {
            this._stepGhost(g);
            const tp = this._applyPortal(g.gx, g.gy);
            if (tp) { g.gx = tp.x; g.gy = tp.y; }
        });
        // Tick timer plates down by 1 step
        this._tickTimerPlates();
        // Advance every anomaly one step
        this.anomalies.forEach(a => this._stepAnomaly(a));
        this._anomalySet = new Set(this.anomalies.map(a => `${a.gx},${a.gy}`));
        this.step++;

        soundMove();
        this.ghosts.forEach(g => {
            this._spawnTrail(g.gx, g.gy, g.color);
            // Record path for persistent trail lines on large levels
            if (this.def.camera) this._recordGhostPath(g);
        });
        if (this.def.camera) this._redrawGhostPaths();

        this.tweening = true;
        const targets = [
            { sprite: this.playerSprite, tx: this._px(this.playerGx), ty: this._py(this.playerGy) },
            ...this.ghosts.map(g => ({ sprite: g.sprite, tx: this._px(g.gx), ty: this._py(g.gy) })),
            ...this.anomalies.map(a => ({ sprite: a.sprite, tx: this._px(a.gx), ty: this._py(a.gy) }))
        ];

        let done = 0;
        targets.forEach(({ sprite, tx, ty }) => {
            this.tweens.add({
                targets: sprite, x: tx, y: ty,
                duration: TWEEN_MS, ease: 'Quad.easeOut',
                onComplete: () => {
                    done++;
                    if (done === targets.length) {
                        this.tweening = false;
                        this._checkPlates();
                        this._checkGoal();
                    }
                }
            });
        });

        if (targets.length === 0) {
            this.tweening = false;
            this._checkPlates();
            this._checkGoal();
        }
    }

    _tickTimerPlates() {
        this.timerPlateSprites.forEach(t => {
            // Check if player or any ghost is standing on it
            const onPlayer = this.playerGx === t.gx && this.playerGy === t.gy;
            const onGhost  = this.ghosts.some(g => g.gx === t.gx && g.gy === t.gy);
            if (onPlayer || onGhost) {
                t.remaining = t.duration; // reset/extend timer
                if (!t.active) { t.active = true; soundTimerWarn(); }
            } else if (t.active) {
                t.remaining--;
                if (t.remaining <= 0) { t.remaining = 0; t.active = false; }
            }
            t.setTint(t.active ? 0xffffff : 0x00e5ff);
            if (t.active && t.remaining === 2) soundTimerWarn(); // warning beep
        });
    }

    _applyPortal(gx, gy) {
        for (const p of this.portals) {
            if (gx === p.ax && gy === p.ay) return { x: p.bx, y: p.by };
            if (gx === p.bx && gy === p.by) return { x: p.ax, y: p.ay };
        }
        return null;
    }

    _drawPortal(gx, gy) {
        const g = this._GRID;
        const s = this.add.rectangle(this._px(gx), this._py(gy), g - 4, g - 4, 0x00e5ff)
            .setAlpha(0.35).setDepth(2);
        this.tweens.add({
            targets: s, alpha: 0.7, scaleX: 1.1, scaleY: 1.1,
            duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
        return s;
    }

    _stepAnomaly(a) {
        const move = a.pattern[a.step % a.pattern.length];
        a.step++;
        const nx = a.gx + move.dx;
        const ny = a.gy + move.dy;
        if (!this._isWall(nx, ny)) { a.gx = nx; a.gy = ny; }
        soundAnomaly();
    }

    _pulseAnomaly(sprite) {
        this.tweens.add({
            targets: sprite, alpha: 0.4, scaleX: 0.88, scaleY: 0.88,
            duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
    }

    _stepGhost(g) {
        if (g.step >= g.actions.length) return;
        const { dx, dy } = g.actions[g.step++];
        const nx = g.gx + dx;
        const ny = g.gy + dy;
        if (!this._isWall(nx, ny)) {
            g.gx = nx;
            g.gy = ny;
        }
    }

    // ─── LOOP RESET ──────────────────────────────────────────────────

    _undo() {
        if (this.tweening || this.gameOver) return;

        // If there are ghosts and no move-level undo, undo the last loop reset
        if (this._undoStack.length === 0 && this._loopStack.length > 0) {
            this._undoLoop();
            return;
        }
        if (this._undoStack.length === 0) return;

        const snap = this._undoStack.pop();
        this.playerGx = snap.playerGx;
        this.playerGy = snap.playerGy;
        this.playerSprite.setPosition(this._px(snap.playerGx), this._py(snap.playerGy));
        this.recording = snap.recording;
        this.step = snap.step;
        this._sequenceProgress = snap.sequenceProgress ? [...snap.sequenceProgress] : [];
        this._warnedStep = snap.step >= Math.floor(this._stepLimit * 0.875);
        snap.ghostStates.forEach((gs, i) => {
            this.ghosts[i].gx   = gs.gx;
            this.ghosts[i].gy   = gs.gy;
            this.ghosts[i].step = gs.step;
            this.ghosts[i].sprite.setPosition(this._px(gs.gx), this._py(gs.gy));
        });
        (snap.anomalyStates || []).forEach((as, i) => {
            this.anomalies[i].gx   = as.gx;
            this.anomalies[i].gy   = as.gy;
            this.anomalies[i].step = as.step;
            this.anomalies[i].sprite.setPosition(this._px(as.gx), this._py(as.gy));
        });
        this._anomalySet = new Set(this.anomalies.map(a => `${a.gx},${a.gy}`));
        (snap.timerStates || []).forEach((ts, i) => {
            this.timerPlateSprites[i].remaining = ts.remaining;
            this.timerPlateSprites[i].active    = ts.active;
            this.timerPlateSprites[i].setTint(ts.active ? 0xffffff : 0x00e5ff);
        });
        this._checkPlates();
        this._emitUI();
        soundUndo();
    }

    _undoLoop() {
        // Undo the last R press — remove last ghost, restore pre-reset state
        const snap = this._loopStack.pop();
        // Destroy the last ghost sprite
        const lastGhost = this.ghosts.pop();
        lastGhost?.sprite?.destroy();

        this.playerGx = snap.playerGx;
        this.playerGy = snap.playerGy;
        this.playerSprite.setPosition(this._px(snap.playerGx), this._py(snap.playerGy));
        this.recording = snap.recording;
        this.step = snap.step;
        this.loopCount = snap.loopCount;
        this._sequenceProgress = snap.sequenceProgress ? [...snap.sequenceProgress] : [];
        this._undoStack = snap.undoStack;
        this._warnedStep = snap.step >= Math.floor(this._stepLimit * 0.875);

        // Restore ghost positions to what they were before the reset
        snap.ghostStates.forEach((gs, i) => {
            if (!this.ghosts[i]) return;
            this.ghosts[i].gx   = gs.gx;
            this.ghosts[i].gy   = gs.gy;
            this.ghosts[i].step = gs.step;
            this.ghosts[i].sprite.setPosition(this._px(gs.gx), this._py(gs.gy));
        });

        const anomalyDefs = this.def.anomalies || [];
        this.anomalies.forEach((a, i) => {
            a.gx = anomalyDefs[i].x; a.gy = anomalyDefs[i].y; a.step = 0;
            a.sprite.setPosition(this._px(a.gx), this._py(a.gy));
        });
        this._anomalySet = new Set(this.anomalies.map(a => `${a.gx},${a.gy}`));
        this.timerPlateSprites.forEach(t => { t.remaining = 0; t.active = false; t.setTint(0x00e5ff); });
        this._ghostPaths = this.ghosts.map(() => []);
        this._checkPlates();
        this._emitUI();
        soundUndo();
        this._flashScreen(0x7c6fff, 0.1);
    }

    _togglePause() {
        this._paused = !this._paused;
        this.game.events.emit('pause-toggle', this._paused);
    }

    _resetLoop() {
        if (this.tweening || this._paused) return;

        // Save full loop state so U can undo this reset
        this._loopStack.push({
            playerGx: this.playerGx, playerGy: this.playerGy,
            recording: [...this.recording],
            step: this.step,
            loopCount: this.loopCount,
            sequenceProgress: [...this._sequenceProgress],
            undoStack: [...this._undoStack],
            ghostStates: this.ghosts.map(g => ({ gx: g.gx, gy: g.gy, step: g.step }))
        });

        const colorVal = GHOST_COLORS[this.ghosts.length % GHOST_COLORS.length];
        const start    = this.def.playerStart;

        const gs = Math.round(this._GRID * 0.85);
        const ghostAlpha = Math.max(0.55 - this.ghosts.length * 0.08, 0.2);
        const sprite = this.add.image(this._px(start.x), this._py(start.y), 'ghost')
            .setDisplaySize(gs, gs)
            .setTint(colorVal)
            .setAlpha(ghostAlpha)
            .setDepth(8);

        const ghost = {
            sprite,
            actions: [...this.recording],
            step: 0,
            gx: start.x,
            gy: start.y,
            startGx: start.x,
            startGy: start.y,
            color: colorVal
        };
        this.ghosts.push(ghost);

        this.playerGx = start.x;
        this.playerGy = start.y;
        this.playerSprite.setPosition(this._px(start.x), this._py(start.y));
        this.recording = [];
        this.step = 0;

        // Rewind each ghost to its own start; ghosts loop their actions infinitely
        this.ghosts.forEach(g => {
            g.step = 0;
            g.gx = g.startGx;
            g.gy = g.startGy;
            g.sprite.setPosition(this._px(g.startGx), this._py(g.startGy));
        });
        // Rewind anomalies to their start positions
        const anomalyDefs = this.def.anomalies || [];
        this.anomalies.forEach((a, i) => {
            a.gx = anomalyDefs[i].x;
            a.gy = anomalyDefs[i].y;
            a.step = 0;
            a.sprite.setPosition(this._px(a.gx), this._py(a.gy));
        });
        this._anomalySet = new Set(this.anomalies.map(a => `${a.gx},${a.gy}`));
        // Reset timer plates
        this.timerPlateSprites.forEach(t => {
            t.remaining = 0; t.active = false;
            t.setTint(0x00e5ff);
        });

        this._undoStack = [];
        this._sequenceProgress = [];
        this._hintedPlates = new Set();
        this._warnedStep = false;
        this._ghostPaths = this.ghosts.map(() => []);
        if (this.def.camera) this._redrawGhostPaths();
        this.loopCount++;
        this._emitUI();
        this._screenShake();
        this._flashScreen(0x7c6fff, 0.15);
        soundWhoosh();

        // Convergence moment on final level
        if (this.level >= this.levelDefs.length - 1) this._playConvergence();
    }

    _playConvergence() {
        soundConverge();
        // All ghost sprites pulse outward then snap back in sync
        const allSprites = [this.playerSprite, ...this.ghosts.map(g => g.sprite)];
        allSprites.forEach((s, i) => {
            this.tweens.add({
                targets: s,
                scaleX: 1.5, scaleY: 1.5,
                duration: 180,
                delay: i * 40,
                yoyo: true,
                ease: 'Quad.easeOut'
            });
        });
        // Ripple rings from each ghost position
        this.ghosts.forEach(g => {
            const ring = this.add.circle(this._px(g.gx), this._py(g.gy), 8, g.color, 0)
                .setStrokeStyle(2, g.color, 0.8).setDepth(15);
            this.tweens.add({
                targets: ring,
                scaleX: 4, scaleY: 4, alpha: 0,
                duration: 600, ease: 'Quad.easeOut',
                onComplete: () => ring.destroy()
            });
        });
    }

    // ─── PUZZLE LOGIC ────────────────────────────────────────────────

    _checkPlates() {
        const activatedIds = new Set();
        let plateChanged = false;

        this.plateSprites.forEach(p => {
            const onPlayer = this.playerGx === p.gx && this.playerGy === p.gy;
            const onGhost  = this.ghosts.some(g => g.gx === p.gx && g.gy === p.gy);
            const active   = onPlayer || onGhost;
            if (active !== p.active) {
                p.active = active;
                plateChanged = true;
                this.tweens.add({ targets: p, scaleX: active ? 1.15 : 1, scaleY: active ? 1.15 : 1, duration: 80, ease: 'Back.easeOut' });
                p.setTint(active ? 0xff88ff : 0xff2222);
                if (active) {
                    this._plateGlow(p.gx, p.gy);
                    // Add to sequence only if not already in it
                    if (!this._sequenceProgress.includes(p.plateId))
                        this._sequenceProgress.push(p.plateId);
                    // Show hint dialogue once per plate per loop (player only)
                    const onlyPlayer = onPlayer && !onGhost;
                    const hints = this.def.plateHints?.[p.plateId];
                    if (hints && onlyPlayer && !this._hintedPlates.has(p.plateId)) {
                        this._hintedPlates.add(p.plateId);
                        this.time.delayedCall(120, () => this._showDialogue(hints));
                    }
                } else {
                    // Plate deactivated — remove from sequence so order can be re-established
                    this._sequenceProgress = this._sequenceProgress.filter(id => id !== p.plateId);
                }
            }
            if (active) activatedIds.add(p.plateId);
        });

        // Timer plates contribute their id while active
        this.timerPlateSprites.forEach(t => {
            if (t.active) activatedIds.add(t.plateId);
            this.tweens.add({ targets: t, scaleX: t.active ? 1.15 : 1, scaleY: t.active ? 1.15 : 1, duration: 80, ease: 'Back.easeOut' });
        });

        if (plateChanged) soundPlate();

        // Fake plates: look identical, pulse when stood on, never open doors
        (this.fakePlateSprites || []).forEach(p => {
            const onPlayer = this.playerGx === p.gx && this.playerGy === p.gy;
            const onGhost  = this.ghosts.some(g => g.gx === p.gx && g.gy === p.gy);
            const active   = onPlayer || onGhost;
            if (active !== !!p.fakeActive) {
                p.fakeActive = active;
                this.tweens.add({ targets: p, scaleX: active ? 1.15 : 1, scaleY: active ? 1.15 : 1, duration: 80, ease: 'Back.easeOut' });
                p.setTint(active ? 0xff88ff : 0xff2222); // same visual feedback as real plates
            }
        });

        this.doorSprites.forEach(d => {
            let shouldOpen;
            if (d.sequence) {
                // Sequence door: all required plates active AND stepped in correct order
                const allActive = d.requiredPlates.every(id => activatedIds.has(id));
                const correctOrder = allActive && d.sequence.every((id, i) => this._sequenceProgress[i] === id);
                shouldOpen = correctOrder;
            } else {
                shouldOpen = d.requiredPlates.every(id => activatedIds.has(id));
            }
            if (shouldOpen !== d.open) {
                d.open = shouldOpen;
                this.tweens.add({ targets: d, alpha: shouldOpen ? 0.15 : 1, duration: 150 });
                d.setTint(shouldOpen ? 0x22c55e : 0xef4444);
                if (shouldOpen) { soundDoorOpen(); this._doorGlow(d.gx, d.gy); }
            }
        });
    }

    _checkGoal() {
        const g = this.def.goal;
        if (this.playerGx !== g.x || this.playerGy !== g.y) return;
        if (this.doorSprites.length > 0 && !this.doorSprites.every(d => d.open)) return;

        this.gameOver = true;
        const beaten = JSON.parse(localStorage.getItem('looparchitect_beaten') || '[]');
        if (!beaten.includes(this.level)) { beaten.push(this.level); localStorage.setItem('looparchitect_beaten', JSON.stringify(beaten)); }
        soundWin();
        this._particleBurst(this._px(this.def.goal.x), this._py(this.def.goal.y));

        const isLast = this.level >= this.levelDefs.length - 1;
        const endLines = DIALOGUES[this.level]?.end;

        const proceed = () => {
            if (isLast) {
                this._flashScreen(0x22c55e, 0.4);
                this.time.delayedCall(400, () => this._playRewind());
            } else {
                this._flashScreen(0x22c55e, 0.3);
                this.time.delayedCall(300, () => this._showWin(false));
            }
        };

        if (endLines?.length) {
            this._flashScreen(0x22c55e, 0.2);
            this.time.delayedCall(500, () => this._showDialogue(endLines, proceed));
        } else {
            proceed();
        }
    }

    // ─── FAKE ENDING / REWIND ────────────────────────────────────────

    _playRewind() {
        // Collect all recorded moves from all ghosts + current player recording
        // and reverse-animate every sprite back to start
        const start = this.def.playerStart;
        const allSprites = [
            { sprite: this.playerSprite, gx: this.playerGx, gy: this.playerGy },
            ...this.ghosts.map(g => ({ sprite: g.sprite, gx: g.gx, gy: g.gy }))
        ];

        // Flash white
        this._flashScreen(0xffffff, 0.6);

        // Tween all sprites back to start over 1.2s
        allSprites.forEach(({ sprite }) => {
            this.tweens.add({
                targets: sprite,
                x: this._px(start.x), y: this._py(start.y),
                duration: 1200, ease: 'Cubic.easeInOut'
            });
        });

        // Fade out goal
        this.tweens.add({ targets: this.goalSprite, alpha: 0, duration: 800 });

        this.time.delayedCall(1400, () => this._showFinalMessage());
    }

    _showFinalMessage() {
        const W = this.scale.width, H = this.scale.height;

        // Full dark overlay fades in
        const overlay = this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0).setDepth(25);
        this.tweens.add({ targets: overlay, alpha: 0.92, duration: 600 });

        const lines = [
            { text: 'You didn\'t escape time.',     delay: 700,  y: H / 2 - 70 },
            { text: 'You became it.',               delay: 1800, y: H / 2 - 20 },
            { text: 'Every loop was a choice.',     delay: 3000, y: H / 2 + 40 },
            { text: 'Every choice was you.',        delay: 4000, y: H / 2 + 80 },
        ];

        lines.forEach(({ text, delay, y }) => {
            const fontSize = text === 'You became it.' ? '28px' : '18px';
            const fill     = text === 'You became it.' ? '#00e5ff' : '#94a3b8';
            const t = this.add.text(W / 2, y, text, {
                fontSize, fontFamily: 'Segoe UI, Arial',
                fill, align: 'center'
            }).setOrigin(0.5).setAlpha(0).setDepth(26);
            this.time.delayedCall(delay, () => {
                this.tweens.add({ targets: t, alpha: 1, duration: 600 });
            });
        });

        // After all lines, show the real win screen
        this.time.delayedCall(5800, () => this._showWin(true));
    }

    // ─── WIN SCREEN ──────────────────────────────────────────────────

    _showWin(isLast) {
        const W = this.scale.width, H = this.scale.height;

        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.75).setDepth(27);

        const title    = isLast ? '✦ THE ARCHITECT ✦'    : 'LOOP SOLVED';
        const sub      = isLast ? 'You weren\'t solving the loop.\nYou were becoming it.' : 'Next level unlocked.';
        const btnLabel = isLast ? 'Play Again'           : 'Next Level →';

        this.add.text(W / 2, H / 2 - 55, title, {
            fontSize: '26px', fontFamily: 'Segoe UI, Arial',
            fill: '#00e5ff', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(28);

        this.add.text(W / 2, H / 2 - 10, sub, {
            fontSize: '14px', fontFamily: 'Segoe UI, Arial',
            fill: '#94a3b8', align: 'center'
        }).setOrigin(0.5).setDepth(28);

        const btnBg = this.add.rectangle(W / 2, H / 2 + 50, 160, 44, 0x00e5ff)
            .setDepth(28).setInteractive({ useHandCursor: true });
        this.add.text(W / 2, H / 2 + 50, btnLabel, {
            fontSize: '15px', fontFamily: 'Segoe UI, Arial',
            fill: '#0d1b2a', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(29);

        const advance = () => {
            this.level = isLast ? 0 : this.level + 1;
            this.loadLevel(this.level);
        };

        btnBg.on('pointerdown', advance);
        btnBg.on('pointerover',  () => btnBg.setFillStyle(0x67e8f9));
        btnBg.on('pointerout',   () => btnBg.setFillStyle(0x00e5ff));

        this.time.delayedCall(200, () => {
            this.input.keyboard.once('keydown', advance);
        });
    }

    // ─── HELPERS ─────────────────────────────────────────────────────

    _px(gx) { return OFFSET_X + gx * this._GRID + this._GRID / 2; }
    _py(gy) { return OFFSET_Y + gy * this._GRID + this._GRID / 2; }

    _isWall(gx, gy)       { return this.wallSet.has(`${gx},${gy}`); }
    _isClosedDoor(gx, gy) { return this.doorSprites.some(d => !d.open && d.gx === gx && d.gy === gy); }
    _isAnomaly(gx, gy)    { return this._anomalySet?.has(`${gx},${gy}`) ?? false; }

    _addSprite(key, gx, gy) {
        const g = this._GRID;
        const s = this.add.image(this._px(gx), this._py(gy), key).setDepth(5).setDisplaySize(g, g);
        s.gx = gx; s.gy = gy;
        return s;
    }

    _pulse(sprite) {
        this.tweens.add({
            targets: sprite, scaleX: 1.08, scaleY: 1.08,
            duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut'
        });
    }

    _flashScreen(color, alpha) {
        const W = this.scale.width, H = this.scale.height;
        const flash = this.add.rectangle(W / 2, H / 2, W, H, color, alpha).setDepth(30);
        this.tweens.add({ targets: flash, alpha: 0, duration: 400, onComplete: () => flash.destroy() });
    }

    _screenShake() {
        const cam = this.cameras.main;
        cam.shake(220, 0.007);
    }

    _spawnTrail(gx, gy, color) {
        const ts = Math.round(this._GRID * 0.44);
        const trail = this.add.rectangle(this._px(gx), this._py(gy), ts, ts, color)
            .setAlpha(0.45).setDepth(7);
        this.tweens.add({
            targets: trail, alpha: 0, scaleX: 0.3, scaleY: 0.3,
            duration: 320, ease: 'Quad.easeOut',
            onComplete: () => trail.destroy()
        });
    }

    _recordGhostPath(g) {
        const idx = this.ghosts.indexOf(g);
        if (!this._ghostPaths[idx]) this._ghostPaths[idx] = [];
        const last = this._ghostPaths[idx].at(-1);
        if (!last || last.x !== g.gx || last.y !== g.gy)
            this._ghostPaths[idx].push({ x: g.gx, y: g.gy });
    }

    _redrawGhostPaths() {
        this._trailGfx.clear();
        this._ghostPaths.forEach((path, i) => {
            if (path.length < 2) return;
            const col = GHOST_COLORS[i % GHOST_COLORS.length];
            this._trailGfx.lineStyle(2, col, 0.25);
            this._trailGfx.beginPath();
            this._trailGfx.moveTo(this._px(path[0].x), this._py(path[0].y));
            for (let j = 1; j < path.length; j++)
                this._trailGfx.lineTo(this._px(path[j].x), this._py(path[j].y));
            this._trailGfx.strokePath();
        });
    }

    _plateGlow(gx, gy) {
        const ring = this.add.circle(this._px(gx), this._py(gy), 10, 0xff88ff, 0)
            .setStrokeStyle(3, 0xff88ff, 0.9).setDepth(6);
        this.tweens.add({
            targets: ring, scaleX: 3.2, scaleY: 3.2, alpha: 0,
            duration: 420, ease: 'Quad.easeOut',
            onComplete: () => ring.destroy()
        });
    }

    _doorGlow(gx, gy) {
        const gs = this._GRID + 8;
        const glow = this.add.rectangle(this._px(gx), this._py(gy), gs, gs, 0x22c55e)
            .setAlpha(0.55).setDepth(4);
        this.tweens.add({
            targets: glow, alpha: 0, scaleX: 1.6, scaleY: 1.6,
            duration: 500, ease: 'Quad.easeOut',
            onComplete: () => glow.destroy()
        });
    }

    _particleBurst(px, py) {
        const colors = [0x00e5ff, 0x22c55e, 0xffd166, 0xff6b9d, 0x7c6fff];
        for (let i = 0; i < 10; i++) {
            const angle = (i / 10) * Math.PI * 2;
            const dist  = Phaser.Math.Between(40, 90);
            const p = this.add.rectangle(px, py, 10, 10, colors[i % colors.length]).setDepth(20);
            this.tweens.add({
                targets: p,
                x: px + Math.cos(angle) * dist,
                y: py + Math.sin(angle) * dist,
                alpha: 0, scaleX: 0.2, scaleY: 0.2,
                duration: 500, ease: 'Quad.easeOut',
                onComplete: () => p.destroy()
            });
        }
    }

    _emitUI() {
        this.game.events.emit('ui-update', {
            level: this.level,
            loopCount: this.loopCount,
            maxLoops: this.maxLoops,
            step: this.step,
            stepLimit: this._stepLimit
        });
    }
}
