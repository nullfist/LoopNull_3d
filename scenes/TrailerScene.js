/*
 * TrailerScene.js
 * Full story narration + procedural cinematic audio.
 */

// ── Procedural cinematic audio ────────────────────────────────────────────────
let _trailerCtx = null;
function _ac() {
    if (!_trailerCtx) _trailerCtx = new (window.AudioContext || window.webkitAudioContext)();
    return _trailerCtx;
}

function _playDrone(freq = 55, duration = 6, vol = 0.12) {
    try {
        const ctx = _ac();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 300;
        osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sawtooth'; osc.frequency.value = freq;
        const t = ctx.currentTime;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(vol, t + 1.2);
        gain.gain.linearRampToValueAtTime(vol * 0.7, t + duration - 1);
        gain.gain.linearRampToValueAtTime(0, t + duration);
        osc.start(t); osc.stop(t + duration);
    } catch (_) {}
}

function _playPulse(freq = 80, delay = 0) {
    try {
        const ctx = _ac();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sine'; osc.frequency.value = freq;
        const t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.18, t + 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
        osc.start(t); osc.stop(t + 0.65);
    } catch (_) {}
}

function _playRiser(duration = 4) {
    try {
        const ctx = _ac();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass'; filter.frequency.value = 600; filter.Q.value = 2;
        osc.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        osc.type = 'sawtooth';
        const t = ctx.currentTime;
        osc.frequency.setValueAtTime(40, t);
        osc.frequency.linearRampToValueAtTime(200, t + duration);
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.08, t + duration * 0.5);
        gain.gain.linearRampToValueAtTime(0, t + duration);
        osc.start(t); osc.stop(t + duration);
    } catch (_) {}
}

function _playImpact() {
    try {
        const ctx = _ac();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.08));
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass'; filter.frequency.value = 180;
        src.buffer = buf; src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
        gain.gain.setValueAtTime(0.35, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
        src.start();
    } catch (_) {}
}

function _playHeartbeat(bpm = 52, count = 8, startDelay = 0) {
    const interval = 60 / bpm;
    for (let i = 0; i < count; i++) {
        _playPulse(60, startDelay + i * interval);
        _playPulse(50, startDelay + i * interval + 0.12);
    }
}

function _stopAudio() {
    try { _trailerCtx?.close(); } catch (_) {}
    _trailerCtx = null;
}

// ── Scene ─────────────────────────────────────────────────────────────────────
export default class TrailerScene extends Phaser.Scene {
    constructor() { super('TrailerScene'); }

    preload() {
        this.load.image('titlecard', 'assets/Loop_Bloody_Escape.png');
    }

    create() {
        const W = this.scale.width;
        const H = this.scale.height;
        this._done      = false;
        this._activeEl  = null;
        this._typeTimer = null;

        // ── Layers ────────────────────────────────────────────────────────────
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000).setDepth(0);

        this._imgSprite = this.add.image(W / 2, H / 2, 'titlecard')
            .setDisplaySize(W, H).setDepth(1).setAlpha(0);

        // Dark cinematic overlay — always present
        this.add.rectangle(W / 2, H / 2, W, H, 0x000000, 0.45).setDepth(2);

        // Letterbox bars — top and bottom
        this.add.rectangle(W / 2, H * 0.055, W, H * 0.11, 0x000000).setDepth(8);
        this.add.rectangle(W / 2, H * 0.945, W, H * 0.11, 0x000000).setDepth(8);

        // ── Chapter label (top-left) ──────────────────────────────────────────
        this._chapterText = this.add.text(24, H * 0.09, '', {
            fontSize: '9px', fontFamily: 'Segoe UI, Arial',
            fill: '#4a7aaa', fontStyle: 'bold', letterSpacing: 3
        }).setOrigin(0, 0.5).setAlpha(0).setDepth(12);

        // ── Story line (large, centre) ────────────────────────────────────────
        this._storyText = this.add.text(W / 2, H * 0.38, '', {
            fontSize: '26px', fontFamily: 'Segoe UI, Arial',
            fill: '#ffffff', fontStyle: 'bold',
            align: 'center', stroke: '#000000', strokeThickness: 5,
            wordWrap: { width: W - 80 }
        }).setOrigin(0.5).setAlpha(0).setDepth(12);

        // ── Sub-story line (below story) ──────────────────────────────────────
        this._subStoryText = this.add.text(W / 2, H * 0.50, '', {
            fontSize: '14px', fontFamily: 'Segoe UI, Arial',
            fill: '#94a3b8', align: 'center', fontStyle: 'italic',
            wordWrap: { width: W - 100 }
        }).setOrigin(0.5).setAlpha(0).setDepth(12);

        // ── Title text (bottom area, original position) ───────────────────────
        this._titleText = this.add.text(W / 2, H * 0.72, '', {
            fontSize: '18px', fontFamily: 'Segoe UI, Arial',
            fill: '#00e5ff', fontStyle: 'bold',
            align: 'center', stroke: '#000000', strokeThickness: 3,
            wordWrap: { width: W - 80 }
        }).setOrigin(0.5).setAlpha(0).setDepth(12);

        this._subText = this.add.text(W / 2, H * 0.81, '', {
            fontSize: '12px', fontFamily: 'Segoe UI, Arial',
            fill: '#64748b', align: 'center',
            wordWrap: { width: W - 100 }
        }).setOrigin(0.5).setAlpha(0).setDepth(12);

        // ── Cyan accent line under story text ─────────────────────────────────
        this._accentLine = this.add.rectangle(W / 2, H * 0.56, 0, 1, 0x00e5ff, 0.6).setDepth(12);

        // ── Skip button ───────────────────────────────────────────────────────
        const skipBtn = this.add.text(W - 14, 14, 'SKIP ▶', {
            fontSize: '11px', fontFamily: 'Segoe UI, Arial', fill: '#334155'
        }).setOrigin(1, 0).setDepth(100).setInteractive({ useHandCursor: true });
        skipBtn.on('pointerover',  () => skipBtn.setStyle({ fill: '#94a3b8' }));
        skipBtn.on('pointerout',   () => skipBtn.setStyle({ fill: '#334155' }));
        skipBtn.on('pointerdown',  () => this._finish());
        this.input.keyboard.once('keydown-ESC',   () => this._finish());
        this.input.keyboard.once('keydown-SPACE', () => this._finish());

        // ── Flash overlay ─────────────────────────────────────────────────────
        this._flash = this.add.rectangle(W / 2, H / 2, W, H, 0xffffff, 0).setDepth(50);

        // ── Clip definitions with full story narration ────────────────────────
        this._clips = [
            {
                type:    'video',
                src:     'assets/Loop_Prison_Corridor_Escape.mp4',
                duration: 5500,
                chapter: 'CHAPTER I — THE CELL',
                story:   'You wake up.\nNo memory. No exit.',
                subStory:'Only a corridor that never ends.',
                title:   'A puzzle with no instructions.',
                sub:     '',
                audio:   'heartbeat',
            },
            {
                type:    'video',
                src:     'assets/Loop_Escape_Laser_Corridor.mp4',
                duration: 5500,
                chapter: 'CHAPTER II — THE ECHO',
                story:   'Every step you take…\nleaves a ghost behind.',
                subStory:'Your past self is your only ally.',
                title:   'Your only tool…',
                sub:     '…is your past self.',
                audio:   'drone_low',
            },
            {
                type:    'video',
                src:     'assets/Loop_Shock_Realization_Dramatic.mp4',
                duration: 5500,
                chapter: 'CHAPTER III — THE LOOP',
                story:   'The loop is not a trap.\nIt is a tool.',
                subStory:'Use it. Or be consumed by it.',
                title:   'Every loop leaves a ghost.',
                sub:     'Every ghost holds a memory.',
                audio:   'riser',
            },
            {
                type:    'video',
                src:     'assets/Loop_Heroic_Freeze_Frame_Silhouette.mp4',
                duration: 5500,
                chapter: 'CHAPTER IV — THE ARCHITECT',
                story:   'You were never escaping the loop.',
                subStory:'You were building it.',
                title:   'Plan.  Loop.  Solve.',
                sub:     '',
                audio:   'impact_drone',
            },
            {
                type:     'image',
                src:      null,
                duration: 4000,
                chapter:  '',
                story:    '',
                subStory: '',
                title:    'LOOP ARCHITECT',
                sub:      'Use your past self to solve the present.',
                audio:    'pulse_end',
            },
        ];

        this._playClip(0);
    }

    // ── Clip playback ─────────────────────────────────────────────────────────
    _playClip(index) {
        if (this._done || index >= this._clips.length) { this._finish(); return; }
        const clip = this._clips[index];

        this._flashCut(() => {
            this._clearActive();
            this._playClipAudio(clip.audio);

            if (clip.type === 'video') {
                this._imgSprite.setAlpha(0);
                const vid = document.createElement('video');
                vid.src = clip.src;
                vid.autoplay = true;
                vid.muted = true;
                vid.playsInline = true;
                vid.loop = false;
                vid.style.cssText = `
                    position:absolute;top:0;left:0;
                    width:100%;height:100%;
                    object-fit:cover;z-index:0;pointer-events:none;
                `;
                const container = document.getElementById('phaser-container') || document.body;
                container.style.position = 'relative';
                container.insertBefore(vid, container.firstChild);
                vid.play().catch(() => {});
                this._activeEl = vid;
            } else {
                this._imgSprite.setAlpha(1);
            }

            this._showClipContent(clip);
            this.time.delayedCall(clip.duration, () => this._playClip(index + 1));
        });
    }

    // ── Audio per clip ────────────────────────────────────────────────────────
    _playClipAudio(type) {
        switch (type) {
            case 'heartbeat':
                _playDrone(41, 6, 0.08);
                _playHeartbeat(48, 6, 0.5);
                break;
            case 'drone_low':
                _playDrone(55, 6, 0.10);
                _playDrone(82, 6, 0.06);
                _playPulse(110, 1.0);
                _playPulse(110, 3.5);
                break;
            case 'riser':
                _playDrone(46, 5.5, 0.09);
                _playRiser(4.5);
                _playPulse(90, 4.2);
                break;
            case 'impact_drone':
                _playImpact();
                _playDrone(36, 6, 0.14);
                _playPulse(72, 0.8);
                _playPulse(72, 2.4);
                _playPulse(72, 4.0);
                break;
            case 'pulse_end':
                _playDrone(55, 4, 0.08);
                _playPulse(220, 0.3);
                _playPulse(330, 0.9);
                _playPulse(440, 1.5);
                break;
        }
    }

    // ── Text display ──────────────────────────────────────────────────────────
    _showClipContent(clip) {
        const W = this.scale.width;

        // Kill all running tweens on text objects
        [this._chapterText, this._storyText, this._subStoryText,
         this._titleText, this._subText, this._accentLine].forEach(t => {
            this.tweens.killTweensOf(t);
        });

        // Reset
        this._chapterText.setAlpha(0).setText(clip.chapter || '');
        this._storyText.setAlpha(0).setText('');
        this._subStoryText.setAlpha(0).setText(clip.subStory || '');
        this._titleText.setAlpha(0).setText(clip.title || '');
        this._subText.setAlpha(0).setText(clip.sub || '');
        this._accentLine.setSize(0, 1);

        // Chapter label fades in immediately
        if (clip.chapter) {
            this.tweens.add({ targets: this._chapterText, alpha: 0.7, duration: 600, delay: 200 });
            this.tweens.add({ targets: this._chapterText, alpha: 0,   duration: 400, delay: 3200 });
        }

        // Story text — typewriter effect
        if (clip.story) {
            this.time.delayedCall(500, () => {
                this._typewrite(this._storyText, clip.story, 38, () => {
                    // Accent line expands after story finishes typing
                    this.tweens.add({
                        targets: this._accentLine,
                        width: Math.min(280, clip.story.length * 8),
                        duration: 400, ease: 'Quad.easeOut'
                    });
                });
            });
            this.tweens.add({ targets: this._storyText, alpha: 0, duration: 400, delay: 3600 });
            this.tweens.add({ targets: this._accentLine, alpha: 0, duration: 400, delay: 3600 });
        }

        // Sub-story fades in after story
        if (clip.subStory) {
            this.tweens.add({ targets: this._subStoryText, alpha: 0.85, duration: 500, delay: 1400 });
            this.tweens.add({ targets: this._subStoryText, alpha: 0,    duration: 400, delay: 3600 });
        }

        // Bottom title
        if (clip.title) {
            this.tweens.add({ targets: this._titleText, alpha: 1, duration: 400, delay: 800 });
            this.tweens.add({ targets: this._titleText, alpha: 0, duration: 400, delay: clip.duration - 700 });
        }

        // Bottom sub
        if (clip.sub) {
            this.tweens.add({ targets: this._subText, alpha: 0.8, duration: 400, delay: 1200 });
            this.tweens.add({ targets: this._subText, alpha: 0,   duration: 400, delay: clip.duration - 700 });
        }
    }

    // ── Typewriter ────────────────────────────────────────────────────────────
    _typewrite(textObj, fullText, charDelay, onDone) {
        if (this._typeTimer) { this._typeTimer.remove(); this._typeTimer = null; }
        textObj.setText('').setAlpha(1);
        let i = 0;
        this._typeTimer = this.time.addEvent({
            delay: charDelay,
            repeat: fullText.length - 1,
            callback: () => {
                textObj.setText(fullText.substring(0, ++i));
                if (i >= fullText.length) {
                    this._typeTimer = null;
                    onDone?.();
                }
            }
        });
    }

    // ── Helpers ───────────────────────────────────────────────────────────────
    _clearActive() {
        if (this._activeEl) {
            this._activeEl.pause();
            this._activeEl.remove();
            this._activeEl = null;
        }
        this._imgSprite.setAlpha(0);
        if (this._typeTimer) { this._typeTimer.remove(); this._typeTimer = null; }
    }

    _flashCut(onDone) {
        this.tweens.add({
            targets: this._flash, alpha: 0.85,
            duration: 55, ease: 'Quad.easeIn',
            onComplete: () => {
                onDone();
                this.tweens.add({ targets: this._flash, alpha: 0, duration: 220, ease: 'Quad.easeOut' });
            }
        });
    }

    _finish() {
        if (this._done) return;
        this._done = true;
        this._clearActive();
        _stopAudio();
        this.cameras.main.fadeOut(400, 0, 0, 0);
        this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('TitleScene'));
    }

    shutdown() {
        this._clearActive();
        _stopAudio();
    }
}
