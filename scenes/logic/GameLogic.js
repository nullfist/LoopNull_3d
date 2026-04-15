// ── Grid constants ────────────────────────────────────────────────────────────
export const COLS = 9;
export const ROWS = 9;
export const TILE  = 2;          // world-units per tile
export const GHOST_COLORS = [0x7c6fff, 0xff6b9d, 0xffd166];

// ── Grid ↔ World mapping (pure functions, no Three.js) ───────────────────────
export function gridToWorld(gx, gy) {
    return { x: gx * TILE, y: 0, z: gy * TILE };
}

// ── Wall set builder ──────────────────────────────────────────────────────────
export function buildWallSet(def) {
    const s = new Set();
    for (let x = 0; x < COLS; x++) { s.add(`${x},0`); s.add(`${x},${ROWS-1}`); }
    for (let y = 0; y < ROWS; y++) { s.add(`0,${y}`); s.add(`${COLS-1},${y}`); }
    (def.walls || []).forEach(w => s.add(`${w.x},${w.y}`));
    return s;
}

// ── Plate state builder ───────────────────────────────────────────────────────
export function buildPlates(def) {
    return (def.plates || []).map(p => ({ ...p, active: false }));
}

export function buildFakePlates(def) {
    return (def.fakePlates || []).map(p => ({ ...p, fakeActive: false }));
}

// ── Door state builder ────────────────────────────────────────────────────────
export function buildDoors(def) {
    return (def.doors || []).map(d => ({ ...d, open: false }));
}

// ── Ghost step ────────────────────────────────────────────────────────────────
export function stepGhost(g, wallSet) {
    if (g.step >= g.actions.length) return;
    const { dx, dy } = g.actions[g.step++];
    const nx = g.gx + dx;
    const ny = g.gy + dy;
    if (!wallSet.has(`${nx},${ny}`)) { g.gx = nx; g.gy = ny; }
}

// ── Plate + door evaluation (returns { activatedIds, sequenceProgress }) ──────
export function evaluatePlates(plates, fakePlates, playerGx, playerGy, ghosts, sequenceProgress) {
    const activatedIds = new Set();
    let changed = false;

    plates.forEach(p => {
        const onPlayer = playerGx === p.x && playerGy === p.y;
        const onGhost  = ghosts.some(g => g.gx === p.x && g.gy === p.y);
        const active   = onPlayer || onGhost;
        if (active !== p.active) { p.active = active; changed = true; }
        if (active) {
            activatedIds.add(p.id);
            if (!sequenceProgress.includes(p.id)) sequenceProgress.push(p.id);
        } else {
            sequenceProgress = sequenceProgress.filter(id => id !== p.id);
        }
    });

    fakePlates.forEach(p => {
        const onPlayer = playerGx === p.x && playerGy === p.y;
        const onGhost  = ghosts.some(g => g.gx === p.x && g.gy === p.y);
        p.fakeActive = onPlayer || onGhost;
    });

    return { activatedIds, sequenceProgress, changed };
}

export function evaluateDoors(doors, activatedIds, sequenceProgress) {
    doors.forEach(d => {
        let shouldOpen;
        if (d.sequence) {
            const allActive    = d.requiredPlates.every(id => activatedIds.has(id));
            const correctOrder = allActive && d.sequence.every((id, i) => sequenceProgress[i] === id);
            shouldOpen = correctOrder;
        } else {
            shouldOpen = d.requiredPlates.every(id => activatedIds.has(id));
        }
        d.open = shouldOpen;
    });
}

// ── Snapshot (for undo) ───────────────────────────────────────────────────────
export function snapshot(playerGx, playerGy, recording, step, ghosts, sequenceProgress) {
    return {
        playerGx, playerGy,
        recording: [...recording],
        step,
        sequenceProgress: [...sequenceProgress],
        ghostStates: ghosts.map(g => ({ gx: g.gx, gy: g.gy, step: g.step })),
    };
}

export function restoreSnapshot(snap, playerRef, ghosts, recording) {
    playerRef.gx = snap.playerGx;
    playerRef.gy = snap.playerGy;
    recording.length = 0;
    snap.recording.forEach(m => recording.push(m));
    snap.ghostStates.forEach((gs, i) => {
        if (!ghosts[i]) return;
        ghosts[i].gx   = gs.gx;
        ghosts[i].gy   = gs.gy;
        ghosts[i].step = gs.step;
    });
    return [...snap.sequenceProgress];
}
