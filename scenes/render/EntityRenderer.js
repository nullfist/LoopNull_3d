/* global THREE */
import { TILE, GHOST_COLORS, gridToWorld } from '../logic/GameLogic.js';

const LERP = 10;

// ── Shared geometry cache ─────────────────────────────────────────────────────
const _geo = {};
function sg(key, fn) { if (!_geo[key]) _geo[key] = fn(); return _geo[key]; }

// ── Build humanoid — shared geometries, per-instance materials ────────────────
function buildHumanoid(bodyColor, emissiveColor, opacity) {
    const group   = new THREE.Group();
    const transp  = opacity < 1.0;

    const bodyMat = new THREE.MeshStandardMaterial({
        color: bodyColor, emissive: emissiveColor, emissiveIntensity: 0.3,
        roughness: 0.45, metalness: 0.5, transparent: transp, opacity,
    });
    const accentMat = new THREE.MeshStandardMaterial({
        color: emissiveColor, emissive: emissiveColor, emissiveIntensity: 1.5,
        roughness: 0.1, transparent: transp, opacity,
    });
    const darkMat = new THREE.MeshStandardMaterial({
        color: 0x0b1220, roughness: 0.85, transparent: transp, opacity,
    });

    const add = (geoKey, geoFn, mat, x, y, z) => {
        const mesh = new THREE.Mesh(sg(geoKey, geoFn), mat);
        mesh.position.set(x, y, z);
        mesh.matrixAutoUpdate = false;
        mesh.updateMatrix();
        group.add(mesh);
        return mesh;
    };

    // Torso
    add('torso', () => new THREE.BoxGeometry(0.34, 0.38, 0.22), bodyMat, 0, 0.62, 0);
    // Chest strip
    add('chest', () => new THREE.BoxGeometry(0.08, 0.22, 0.23), accentMat, 0, 0.64, 0.11);
    // Head
    add('head', () => new THREE.BoxGeometry(0.26, 0.24, 0.24), darkMat, 0, 0.96, 0);
    // Visor
    add('visor', () => new THREE.BoxGeometry(0.22, 0.08, 0.25), accentMat, 0, 0.97, 0);

    // Shoulders + dots
    [-1, 1].forEach(s => {
        add('shoulder', () => new THREE.BoxGeometry(0.1, 0.1, 0.24), bodyMat.clone(), s * 0.22, 0.76, 0);
        add('dot', () => new THREE.SphereGeometry(0.04, 4, 3), accentMat, s * 0.28, 0.78, 0);
    });

    // Legs + boots
    [-1, 1].forEach(s => {
        add('leg', () => new THREE.BoxGeometry(0.13, 0.32, 0.14), bodyMat.clone(), s * 0.1, 0.28, 0);
        add('boot', () => new THREE.BoxGeometry(0.14, 0.1, 0.18),
            new THREE.MeshStandardMaterial({ color: emissiveColor, emissive: emissiveColor, emissiveIntensity: 0.7, roughness: 0.3, transparent: transp, opacity }),
            s * 0.1, 0.1, 0.02);
    });

    // Arms
    [-1, 1].forEach(s => {
        add('arm', () => new THREE.BoxGeometry(0.1, 0.28, 0.12), bodyMat.clone(), s * 0.24, 0.58, 0);
    });

    return group;
}

// ── Trail pool ────────────────────────────────────────────────────────────────
const TRAIL_POOL_SIZE = 24;
const _trailGeo = new THREE.CylinderGeometry(0.14, 0.18, 0.04, 6);

export class EntityRenderer {
    constructor(scene) {
        this.scene       = scene;
        this.playerGroup = null;
        this.ghostGroups = [];
        this._t          = 0;

        // Pre-allocate trail pool — no runtime mesh creation
        this._trailPool   = [];
        this._activeTrails = [];
        for (let i = 0; i < TRAIL_POOL_SIZE; i++) {
            const mesh = new THREE.Mesh(
                _trailGeo,
                new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
            );
            mesh.visible = false;
            scene.add(mesh);
            this._trailPool.push(mesh);
        }

        // Reusable Vector3 for lerp target — no per-frame allocation
        this._lerpTarget = new THREE.Vector3();

        // Squash/stretch
        this._prevX = 0;
        this._prevZ = 0;
        this._stretch = 1;
    }

    // ── Player ────────────────────────────────────────────────────────────────
    spawnPlayer(gx, gy) {
        this.playerGroup = buildHumanoid(0x1f2a44, 0x00e5ff, 1.0);
        const pos = gridToWorld(gx, gy);
        this.playerGroup.position.set(pos.x, 0, pos.z);
        this.scene.add(this.playerGroup);
        this._prevX = pos.x;
        this._prevZ = pos.z;

        this._playerLight = new THREE.PointLight(0x00e5ff, 0.6, 4.0);
        this._playerLight.position.set(pos.x, 1.0, pos.z);
        this.scene.add(this._playerLight);
    }

    // ── Ghosts ────────────────────────────────────────────────────────────────
    spawnGhost(index, gx, gy) {
        const color   = GHOST_COLORS[index % GHOST_COLORS.length];
        const opacity = Math.max(0.45 - index * 0.07, 0.18);
        const group   = buildHumanoid(color, color, opacity);
        const pos     = gridToWorld(gx, gy);
        group.position.set(pos.x, 0, pos.z);
        this.scene.add(group);
        this.ghostGroups.push(group);
    }

    removeLastGhost() {
        const g = this.ghostGroups.pop();
        if (g) this.scene.remove(g);
    }

    removeAllGhosts() {
        this.ghostGroups.forEach(g => this.scene.remove(g));
        this.ghostGroups = [];
    }

    // ── Sync every frame ──────────────────────────────────────────────────────
    sync(playerGx, playerGy, ghosts, delta) {
        this._t += delta;

        if (this.playerGroup) {
            this._lerpTo(this.playerGroup, playerGx, playerGy, delta);

            // Squash/stretch
            const px = this.playerGroup.position.x;
            const pz = this.playerGroup.position.z;
            const moved = Math.abs(px - this._prevX) + Math.abs(pz - this._prevZ);
            this._stretch = moved > 0.01
                ? this._stretch + (1.12 - this._stretch) * Math.min(1, 12 * delta)
                : this._stretch + (1.0  - this._stretch) * Math.min(1,  8 * delta);
            this._prevX = px; this._prevZ = pz;

            // Breathing + stretch combined — single scale.y write
            this.playerGroup.scale.y = (1 + Math.sin(this._t * 1.8) * 0.016) * this._stretch;
            // Hover bob
            this.playerGroup.position.y = Math.sin(this._t * 2.0) * 0.028;

            if (this._playerLight) {
                this._playerLight.position.x = px;
                this._playerLight.position.z = pz;
                this._playerLight.intensity = 0.55 + Math.sin(this._t * 2.2) * 0.07;
            }
        }

        ghosts.forEach((g, i) => {
            const group = this.ghostGroups[i];
            if (!group) return;
            this._lerpTo(group, g.gx, g.gy, delta);
            group.position.y = Math.sin(this._t * 1.5 + i * 1.3) * 0.035;
        });

        this._tickTrails(delta);
    }

    // ── Trails — pool-based, zero allocation ──────────────────────────────────
    spawnTrail(gx, gy, colorHex) {
        const mesh = this._trailPool.find(t => !t.visible);
        if (!mesh) return; // pool exhausted — skip silently
        const pos = gridToWorld(gx, gy);
        mesh.position.set(pos.x, 0.02, pos.z);
        mesh.material.color.setHex(colorHex);
        mesh.material.opacity = 0.42;
        mesh.scale.setScalar(1);
        mesh.visible = true;
        mesh._life   = 0.5;
        mesh._max    = 0.5;
        this._activeTrails.push(mesh);
    }

    _tickTrails(delta) {
        for (let i = this._activeTrails.length - 1; i >= 0; i--) {
            const t = this._activeTrails[i];
            t._life -= delta;
            if (t._life <= 0) {
                t.visible = false;
                this._activeTrails.splice(i, 1);
                continue;
            }
            const pct = t._life / t._max;
            t.material.opacity = pct * 0.42;
            t.scale.setScalar(pct * 0.7 + 0.3);
        }
    }

    // ── Lerp — reuses _lerpTarget, no allocation ──────────────────────────────
    _lerpTo(group, gx, gy, delta) {
        const pos = gridToWorld(gx, gy);
        this._lerpTarget.set(pos.x, group.position.y, pos.z);
        const f = Math.min(1, LERP * delta);
        group.position.x += (pos.x - group.position.x) * f;
        group.position.z += (pos.z - group.position.z) * f;
    }

    // ── Convergence pulse ─────────────────────────────────────────────────────
    playConvergence(ghosts) {
        [this.playerGroup, ...this.ghostGroups].filter(Boolean).forEach((g, i) => {
            setTimeout(() => {
                g.scale.set(1.45, 1.45, 1.45);
                setTimeout(() => g.scale.set(1, 1, 1), 190);
            }, i * 45);
        });
    }

    dispose() {
        if (this.playerGroup) this.scene.remove(this.playerGroup);
        if (this._playerLight) this.scene.remove(this._playerLight);
        this.removeAllGhosts();
        // Return all active trails to pool
        this._activeTrails.forEach(t => { t.visible = false; });
        this._activeTrails = [];
        this.playerGroup  = null;
        this._playerLight = null;
        this._prevX = 0; this._prevZ = 0; this._stretch = 1;
    }
}
