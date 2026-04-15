/* global THREE */

export class SceneManager {
    constructor(canvas) {
        this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        // Size to actual canvas element dimensions, not hardcoded values
        const w = canvas.clientWidth  || 576;
        const h = canvas.clientHeight || 640;
        this.renderer.setSize(w, h, false);
        this.renderer.setClearColor(0x0b1220);
        this.renderer.shadowMap.enabled = false;

        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.FogExp2(0x0b1220, 0.022);

        const aspect = w / h;
        this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 200);
        this._camOffset  = new THREE.Vector3(0, 15, 11);
        this._camTarget  = new THREE.Vector3(8, 0, 8);
        this._camCurrent = new THREE.Vector3(8, 0, 8);
        this._camDesired = new THREE.Vector3();
        this.camera.position.copy(this._camCurrent).add(this._camOffset);
        this.camera.lookAt(this._camCurrent);

        this._addLighting();

        // Handle resize (orientation change, window resize)
        window.addEventListener('resize', () => this._onResize(canvas));
    }

    _onResize(canvas) {
        const w = canvas.clientWidth  || 576;
        const h = canvas.clientHeight || 640;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    _addLighting() {
        // Lifted ambient — sterile cold-white base, not pitch black
        this.scene.add(new THREE.AmbientLight(0x1f2a44, 4.2));

        // Soft overhead key — cool blue-white, like facility lighting
        const key = new THREE.DirectionalLight(0x8ab4d4, 0.85);
        key.position.set(-3, 16, 5);
        this.scene.add(key);

        // Subtle purple rim — ghost/system identity, kept low
        const rim = new THREE.DirectionalLight(0x7c6fff, 0.28);
        rim.position.set(12, 5, -3);
        this.scene.add(rim);

        // Cyan floor bounce — controlled, not nightclub
        this._floorLight = new THREE.PointLight(0x00e5ff, 0.9, 20);
        this._floorLight.position.set(8, 0.4, 8);
        this.scene.add(this._floorLight);

        // Second fill from opposite corner — lifts shadow areas
        const fill = new THREE.PointLight(0x2a3a5f, 1.4, 28);
        fill.position.set(16, 3, 16);
        this.scene.add(fill);
    }

    // Pulse the floor light — called from TileRenderer when plate activates
    pulseFloorLight(intensity = 1.9, duration = 0.3) {
        this._floorLight.intensity = intensity;
        this._floorLightDecay = duration;
    }

    followTarget(wx, wz, delta) {
        // Reuse _camDesired — no new Vector3 per frame
        this._camDesired.set(wx, 0, wz);
        this._camCurrent.lerp(this._camDesired, 4.5 * delta);
        this.camera.position.copy(this._camCurrent).add(this._camOffset);
        this.camera.lookAt(this._camCurrent);
    }

    tick(delta) {
        // Decay floor light back to base
        if (this._floorLightDecay > 0) {
            this._floorLightDecay -= delta;
            this._floorLight.intensity = THREE.MathUtils.lerp(
                this._floorLight.intensity, 0.9, 8 * delta
            );
        }
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    clear() {
        // Collect only renderable objects — skip lights and the scene itself
        const toRemove = [];
        this.scene.children.forEach(obj => {
            if (!obj.isLight) toRemove.push(obj);
        });
        toRemove.forEach(obj => {
            this.scene.remove(obj);
            // Recursively dispose GPU resources
            obj.traverse(child => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                    else child.material.dispose();
                }
            });
        });
    }
}
