let _ctx = null;
function ac() {
    if (!_ctx) _ctx = new (window.AudioContext || window.webkitAudioContext)();
    return _ctx;
}
function beep(freq, type, dur, vol = 0.18, delay = 0) {
    try {
        const ctx = ac();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = type; o.frequency.value = freq;
        const t = ctx.currentTime + delay;
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.start(t); o.stop(t + dur);
    } catch (_) {}
}

export function soundMove()      { beep(220,'square',0.06,0.08); }
export function soundPlate()     { beep(660,'sine',0.18,0.22); beep(880,'sine',0.12,0.14,0.05); }
export function soundDoorOpen()  { beep(440,'sine',0.25,0.2); beep(550,'sine',0.2,0.18,0.1); beep(660,'sine',0.15,0.15,0.2); }
export function soundWin()       { [523,659,784,1047].forEach((f,i) => beep(f,'sine',0.3,0.2,i*0.12)); }
export function soundUndo()      { beep(330,'triangle',0.08,0.12); beep(220,'triangle',0.08,0.10,0.06); }
export function soundWarn()      { beep(180,'sawtooth',0.12,0.15); }
export function soundConverge()  { [261,329,392,523].forEach((f,i) => beep(f,'sine',0.6,0.14,i*0.07)); }
export function soundTeleport()  { beep(880,'sine',0.12,0.18); beep(1320,'sine',0.08,0.12,0.08); }
export function soundWhoosh() {
    try {
        const ctx = ac();
        const buf = ctx.createBuffer(1, ctx.sampleRate * 0.35, ctx.sampleRate);
        const d   = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random()*2-1)*(1-i/d.length);
        const src = ctx.createBufferSource();
        const g   = ctx.createGain();
        const f   = ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 800; f.Q.value = 0.5;
        src.buffer = buf; src.connect(f); f.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.28, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
        src.start();
    } catch (_) {}
}
