/* global THREE */
import { COLS, ROWS, TILE, gridToWorld } from '../logic/GameLogic.js';

const WALL_H  = 1.9;
const DOOR_H  = 1.65;
const PLATE_H = 0.07;

// ── Shared geometry cache — built once, reused forever ───────────────────────
const _geo = {};
function g(key, fn) { if (!_geo[key]) _geo[key] = fn(); return _geo[key]; }

// ── Shared material cache — same idea ────────────────────────────────────────
const _mat = {};
function m(key, fn) { if (!_mat[key]) _mat[key] = fn(); return _mat[key]; }

export class TileRenderer {
    constructor(scene, sceneManager) {
        this.scene        = scene;
        this._sm          = sceneManager;
        this._doorEntries = new Map();
        this._plateMeshes = new Map();
        this._fakeEntries = [];
        this._goalGroup   = null;
        this._goalRings   = [];
        this._goalCore    = null;
        this._goalLight   = null;
        this._gridLineMat = null;   // single shared material for all grid lines
        this._shimmerMat  = null;
        this._particles   = [];     // pooled particle objects
        this._particlePool= [];     // dead particles waiting for reuse
        this._t           = 0;
    }

    // ── Build ─────────────────────────────────────────────────────────────────
    build(def, wallSet) {
        this._doorEntries.clear();
        this._plateMeshes.clear();
        this._fakeEntries  = [];
        this._particles    = [];
        this._particlePool = [];
        this._goalRings    = [];
        this._goalCore     = null;
        this._goalLight    = null;
        this._goalGroup    = null;
        this._t            = 0;

        this._buildFloor(wallSet);
        this._buildWalls(wallSet);
        (def.plates    || []).forEach(p => this._spawnPlate(p, false));
        (def.fakePlates|| []).forEach(p => this._spawnPlate(p, true));
        (def.doors     || []).forEach((d, i) => this._spawnDoor(d, i));
        this._spawnGoal(def.goal);
    }

    // ── Floor ─────────────────────────────────────────────────────────────────
    _buildFloor(wallSet) {
        const tileGeo = g('floor', () => new THREE.BoxGeometry(TILE - 0.06, 0.14, TILE - 0.06));
        // Two shared floor materials — no new allocations per tile
        const mat0 = m('floor0', () => new THREE.MeshStandardMaterial({ color: 0x121a2b, roughness: 0.88, metalness: 0.18 }));
        const mat1 = m('floor1', () => new THREE.MeshStandardMaterial({ color: 0x0f1624, roughness: 0.88, metalness: 0.18 }));

        for (let gy = 0; gy < ROWS; gy++) {
            for (let gx = 0; gx < COLS; gx++) {
                if (wallSet.has(`${gx},${gy}`)) continue;
                const pos  = gridToWorld(gx, gy);
                const mesh = new THREE.Mesh(tileGeo, (gx + gy) % 2 === 0 ? mat0 : mat1);
                mesh.position.set(pos.x, -0.07, pos.z);
                mesh.matrixAutoUpdate = false;
                mesh.updateMatrix();
                this.scene.add(mesh);
            }
        }

        // Grid lines — ONE merged LineSegments object instead of 81 separate Lines
        this._buildMergedGridLines(wallSet);
    }

    _buildMergedGridLines(wallSet) {
        const positions = [];
        for (let gy = 0; gy < ROWS; gy++) {
            for (let gx = 0; gx < COLS; gx++) {
                if (wallSet.has(`${gx},${gy}`)) continue;
                const pos = gridToWorld(gx, gy);
                const hw  = TILE / 2 - 0.03;
                const y   = 0.01;
                const x   = pos.x, z = pos.z;
                // 4 edges as line segments (8 points)
                positions.push(x-hw,y,z-hw, x+hw,y,z-hw);
                positions.push(x+hw,y,z-hw, x+hw,y,z+hw);
                positions.push(x+hw,y,z+hw, x-hw,y,z+hw);
                positions.push(x-hw,y,z+hw, x-hw,y,z-hw);
            }
        }
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        this._gridLineMat = new THREE.LineBasicMaterial({ color: 0x2a3a5f, transparent: true, opacity: 0.38 });
        const lines = new THREE.LineSegments(geo, this._gridLineMat);
        lines.matrixAutoUpdate = false;
        lines.updateMatrix();
        this.scene.add(lines);
    }

    // ── Walls ─────────────────────────────────────────────────────────────────
    _buildWalls(wallSet) {
        wallSet.forEach(key => {
            const [gx, gy] = key.split(',').map(Number);
            const pos = gridToWorld(gx, gy);
            this._spawnWallPanel(pos.x, pos.z);
        });
    }

    _spawnWallPanel(wx, wz) {
        const group = new THREE.Group();

        // Body — shared geo + shared mat
        const body = new THREE.Mesh(
            g('wallBody', () => new THREE.BoxGeometry(TILE, WALL_H, TILE)),
            m('wallBody', () => new THREE.MeshStandardMaterial({ color: 0x1f2a44, roughness: 0.75, metalness: 0.4 }))
        );
        body.position.y = WALL_H / 2;
        body.matrixAutoUpdate = false;
        body.updateMatrix();
        group.add(body);

        // Top cap — shared
        const cap = new THREE.Mesh(
            g('wallCap', () => new THREE.BoxGeometry(TILE, 0.06, TILE)),
            m('wallCap', () => new THREE.MeshStandardMaterial({ color: 0x2a3a5f, emissive: 0x1a2a4f, emissiveIntensity: 0.6, roughness: 0.3, metalness: 0.7 }))
        );
        cap.position.y = WALL_H + 0.03;
        cap.matrixAutoUpdate = false;
        cap.updateMatrix();
        group.add(cap);

        // Cyan trim — shared geo, shared mat (emissive, no per-frame update needed)
        const trim = new THREE.Mesh(
            g('wallTrim', () => new THREE.BoxGeometry(TILE - 0.12, 0.035, 0.035)),
            m('wallTrim', () => new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.4, roughness: 0.1 }))
        );
        trim.position.set(0, WALL_H * 0.74, TILE / 2 - 0.018);
        trim.matrixAutoUpdate = false;
        trim.updateMatrix();
        group.add(trim);

        const trimS = new THREE.Mesh(
            g('wallTrimS', () => new THREE.BoxGeometry(0.035, 0.035, TILE - 0.12)),
            m('wallTrim', () => new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.4, roughness: 0.1 }))
        );
        trimS.position.set(TILE / 2 - 0.018, WALL_H * 0.74, 0);
        trimS.matrixAutoUpdate = false;
        trimS.updateMatrix();
        group.add(trimS);

        group.position.set(wx, 0, wz);
        group.matrixAutoUpdate = false;
        group.updateMatrix();
        this.scene.add(group);
    }

    // ── Plates ────────────────────────────────────────────────────────────────
    _spawnPlate(p, isFake) {
        const pos = gridToWorld(p.x, p.y);

        // Each plate needs its OWN material instance so we can change color independently
        const pad = new THREE.Mesh(
            g('platePad', () => new THREE.CylinderGeometry(0.72, 0.78, PLATE_H, 6)),
            new THREE.MeshStandardMaterial({ color: 0x3a0808, emissive: 0xff2222, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.5 })
        );
        pad.position.set(pos.x, PLATE_H / 2, pos.z);
        this.scene.add(pad);

        const inner = new THREE.Mesh(
            g('plateInner', () => new THREE.CylinderGeometry(0.48, 0.52, PLATE_H + 0.01, 6)),
            new THREE.MeshStandardMaterial({ color: 0xff2222, emissive: 0xff2222, emissiveIntensity: 1.0, roughness: 0.2 })
        );
        inner.position.set(pos.x, PLATE_H / 2 + 0.005, pos.z);
        this.scene.add(inner);

        const ring = new THREE.Mesh(
            g('plateRing', () => new THREE.RingGeometry(0.78, 0.92, 6)),
            new THREE.MeshBasicMaterial({ color: 0xff2222, transparent: true, opacity: 0.4, side: THREE.DoubleSide })
        );
        ring.rotation.x = -Math.PI / 2;
        ring.position.set(pos.x, 0.005, pos.z);
        this.scene.add(ring);

        // Only real plates get a point light — fake plates don't need one
        let light = null;
        if (!isFake) {
            light = new THREE.PointLight(0xff2222, 0.0, 3.5);
            light.position.set(pos.x, 0.5, pos.z);
            this.scene.add(light);
        }

        const entry = { pad, inner, ring, light, pulseT: 0 };
        if (isFake) {
            this._fakeEntries.push({ ...entry, data: p });
        } else {
            this._plateMeshes.set(p.id, entry);
        }
    }

    // ── Doors ─────────────────────────────────────────────────────────────────
    _spawnDoor(d, idx) {
        const pos   = gridToWorld(d.x, d.y);
        const group = new THREE.Group();
        group.position.set(pos.x, 0, pos.z);
        this.scene.add(group);

        const panelA = new THREE.Mesh(
            g('doorPanel', () => new THREE.BoxGeometry(TILE * 0.44, DOOR_H, TILE * 0.16)),
            new THREE.MeshStandardMaterial({ color: 0x1f2a44, emissive: 0x00e5ff, emissiveIntensity: 0.18, roughness: 0.25, metalness: 0.8 })
        );
        panelA.position.set(-TILE * 0.23, DOOR_H / 2, 0);
        group.add(panelA);

        const panelB = new THREE.Mesh(
            g('doorPanel', () => new THREE.BoxGeometry(TILE * 0.44, DOOR_H, TILE * 0.16)),
            new THREE.MeshStandardMaterial({ color: 0x1f2a44, emissive: 0x00e5ff, emissiveIntensity: 0.18, roughness: 0.25, metalness: 0.8 })
        );
        panelB.position.set(TILE * 0.23, DOOR_H / 2, 0);
        group.add(panelB);

        const edgeMatA = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.6 });
        const edgeMatB = new THREE.MeshStandardMaterial({ color: 0x00e5ff, emissive: 0x00e5ff, emissiveIntensity: 1.6 });

        const eA = new THREE.Mesh(g('doorEdge', () => new THREE.BoxGeometry(0.04, DOOR_H, 0.04)), edgeMatA);
        eA.position.set(TILE * 0.22, DOOR_H / 2, TILE * 0.09);
        group.add(eA);

        const eB = new THREE.Mesh(g('doorEdge', () => new THREE.BoxGeometry(0.04, DOOR_H, 0.04)), edgeMatB);
        eB.position.set(-TILE * 0.22, DOOR_H / 2, TILE * 0.09);
        group.add(eB);

        const light = new THREE.PointLight(0x00e5ff, 0.6, 3.5);
        light.position.set(0, DOOR_H * 0.6, 0);
        group.add(light);

        this._doorEntries.set(idx, { group, panelA, panelB, eA, eB, light, open: false });
    }

    // ── Goal ──────────────────────────────────────────────────────────────────
    _spawnGoal(goal) {
        const pos   = gridToWorld(goal.x, goal.y);
        const group = new THREE.Group();
        group.position.set(pos.x, 0, pos.z);
        this.scene.add(group);
        this._goalGroup = group;

        const base = new THREE.Mesh(
            g('goalBase', () => new THREE.CylinderGeometry(0.8, 0.9, 0.1, 12)),
            new THREE.MeshStandardMaterial({ color: 0x003322, emissive: 0x00aa55, emissiveIntensity: 0.8, roughness: 0.3, metalness: 0.6 })
        );
        base.position.y = 0.05;
        base.matrixAutoUpdate = false;
        base.updateMatrix();
        group.add(base);

        this._goalCore = new THREE.Mesh(
            g('goalCore', () => new THREE.CylinderGeometry(0.45, 0.5, 0.12, 12)),
            new THREE.MeshStandardMaterial({ color: 0x00ff9c, emissive: 0x00ff9c, emissiveIntensity: 2.2, roughness: 0.1 })
        );
        this._goalCore.position.y = 0.11;
        group.add(this._goalCore);

        [0.62, 0.78, 0.94].forEach((r, i) => {
            const ring = new THREE.Mesh(
                new THREE.RingGeometry(r, r + 0.04, 24),
                new THREE.MeshBasicMaterial({ color: 0x00ff9c, transparent: true, opacity: 0.5 - i * 0.12, side: THREE.DoubleSide })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = 0.02 + i * 0.005;
            ring._base = 0.5 - i * 0.12;
            ring._phase = i * 1.2;
            group.add(ring);
            this._goalRings.push(ring);
        });

        this._goalLight = new THREE.PointLight(0x00ff9c, 2.0, 5.5);
        this._goalLight.position.y = 0.5;
        group.add(this._goalLight);

        // Pre-spawn particle pool — fixed size, no runtime allocation
        this._initParticlePool(pos.x, pos.z);
    }

    _initParticlePool(wx, wz) {
        const mat = new THREE.MeshBasicMaterial({ color: 0x00ff9c, transparent: true, opacity: 0.8 });
        const geo = g('goalParticle', () => new THREE.SphereGeometry(0.04, 4, 4));
        for (let i = 0; i < 12; i++) {
            const mesh = new THREE.Mesh(geo, mat.clone());
            mesh.visible = false;
            mesh._wx = wx; mesh._wz = wz;
            this.scene.add(mesh);
            this._particlePool.push(mesh);
        }
    }

    _activateParticle() {
        // Reuse a dead particle from the pool
        const mesh = this._particlePool.find(p => !p.visible);
        if (!mesh) return;
        const angle = Math.random() * Math.PI * 2;
        const r     = 0.3 + Math.random() * 0.5;
        mesh.position.set(
            mesh._wx + Math.cos(angle) * r,
            0.1 + Math.random() * 0.6,
            mesh._wz + Math.sin(angle) * r
        );
        mesh._vx   = (Math.random() - 0.5) * 0.3;
        mesh._vy   = 0.25 + Math.random() * 0.4;
        mesh._vz   = (Math.random() - 0.5) * 0.3;
        mesh._life = 0.8 + Math.random() * 1.0;
        mesh._max  = mesh._life;
        mesh.material.opacity = 0.8;
        mesh.scale.setScalar(1);
        mesh.visible = true;
        this._particles.push(mesh);
    }

    // ── Sync every frame ──────────────────────────────────────────────────────
    sync(doors, plates, fakePlates, delta) {
        this._t += delta;
        this._syncGoal(delta);
        this._syncDoors(doors, delta);
        this._syncPlates(plates, delta);
        this._syncFakePlates(fakePlates, delta);
        this._syncParticles(delta);
        // Grid line opacity — update once per frame on the single shared material
        if (this._gridLineMat) {
            this._gridLineMat.opacity = 0.3 + Math.sin(this._t * 0.5) * 0.08;
        }
    }

    _syncGoal(delta) {
        if (!this._goalGroup) return;
        this._goalGroup.rotation.y += delta * 0.7;
        if (this._goalCore) {
            this._goalCore.material.emissiveIntensity = 1.8 + Math.sin(this._t * 2.8) * 0.5;
        }
        if (this._goalLight) {
            this._goalLight.intensity = 1.8 + Math.sin(this._t * 3.5) * 0.4;
        }
        this._goalRings.forEach(r => {
            r.material.opacity = r._base * (0.7 + Math.sin(this._t * 2.2 + r._phase) * 0.3);
        });
        // Activate one particle per ~6 frames on average
        if (Math.random() < delta * 5) this._activateParticle();
    }

    _syncDoors(doors, delta) {
        const sp = Math.min(1, 6 * delta);
        doors.forEach((d, i) => {
            const e = this._doorEntries.get(i);
            if (!e) return;
            const tx = d.open ? TILE * 0.52 : TILE * 0.23;
            e.panelA.position.x += (-tx - e.panelA.position.x) * sp;
            e.panelB.position.x += ( tx - e.panelB.position.x) * sp;
            const col = d.open ? 0x22c55e : 0x00e5ff;
            e.eA.material.color.setHex(col); e.eA.material.emissive.setHex(col);
            e.eB.material.color.setHex(col); e.eB.material.emissive.setHex(col);
            e.light.color.setHex(col);
            e.light.intensity += ((d.open ? 0.2 : 0.6) - e.light.intensity) * sp;
            [e.panelA, e.panelB].forEach(p => {
                p.material.emissive.setHex(col);
                p.material.emissiveIntensity += ((d.open ? 0.08 : 0.18) - p.material.emissiveIntensity) * sp;
            });
        });
    }

    _syncPlates(plates, delta) {
        plates.forEach(p => {
            const e = this._plateMeshes.get(p.id);
            if (e) this._applyPlateState(e, p.active, delta);
        });
    }

    _syncFakePlates(fakePlates, delta) {
        this._fakeEntries.forEach(e => this._applyPlateState(e, !!e.data.fakeActive, delta));
    }

    _applyPlateState(e, active, delta) {
        const sp = Math.min(1, 8 * delta);
        if (active) {
            e.pulseT = (e.pulseT || 0) + delta * 4;
            const s = 1.0 + Math.sin(e.pulseT * 1.4) * 0.055;
            e.pad.scale.x = s; e.pad.scale.z = s;
            e.inner.scale.x = s; e.inner.scale.z = s;
            e.pad.material.emissive.setHex(0xff88ff);
            e.pad.material.emissiveIntensity += (1.4 - e.pad.material.emissiveIntensity) * sp;
            e.inner.material.color.setHex(0xff88ff);
            e.inner.material.emissive.setHex(0xff88ff);
            e.inner.material.emissiveIntensity += (2.2 - e.inner.material.emissiveIntensity) * sp;
            e.ring.material.color.setHex(0xff88ff);
            e.ring.material.opacity += (0.65 - e.ring.material.opacity) * sp;
            if (e.light) e.light.intensity += (1.6 - e.light.intensity) * sp;
        } else {
            e.pad.scale.x = 1; e.pad.scale.z = 1;
            e.inner.scale.x = 1; e.inner.scale.z = 1;
            e.pad.material.emissive.setHex(0xff2222);
            e.pad.material.emissiveIntensity += (0.5 - e.pad.material.emissiveIntensity) * sp;
            e.inner.material.color.setHex(0xff2222);
            e.inner.material.emissive.setHex(0xff2222);
            e.inner.material.emissiveIntensity += (1.0 - e.inner.material.emissiveIntensity) * sp;
            e.ring.material.color.setHex(0xff2222);
            e.ring.material.opacity += (0.35 - e.ring.material.opacity) * sp;
            if (e.light) e.light.intensity += (0.0 - e.light.intensity) * sp;
        }
    }

    _syncParticles(delta) {
        for (let i = this._particles.length - 1; i >= 0; i--) {
            const p = this._particles[i];
            p._life -= delta;
            if (p._life <= 0) {
                p.visible = false;
                this._particles.splice(i, 1);
                continue;
            }
            const pct = p._life / p._max;
            p.position.x += p._vx * delta;
            p.position.y += p._vy * delta;
            p.position.z += p._vz * delta;
            p._vy -= delta * 0.25;
            p.material.opacity = pct * 0.8;
            p.scale.setScalar(pct * 0.8 + 0.2);
        }
    }
}
