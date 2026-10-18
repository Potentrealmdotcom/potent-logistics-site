/* POTENT Beat Lab audio engine. Plain Web Audio + MediaRecorder + IndexedDB. No libraries, no AI, no paid services.
   Pure helpers (events, peaks, WAV) also run in Node for tests. */
(function (root) {
  "use strict";
  var E = {};
  var uid = E.uid = function () { return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); };
  E.DRUMS = ["kick", "snare", "hat", "ohat", "clap", "808", "rim", "perc"];
  E.NOTE_LOW = 36; E.NOTE_ROWS = 24; // C2 up two octaves

  E.defaultProject = function () {
    var p = { id: uid(), name: "Pattern 1", steps: 16, rows: [], inst: { src: { type: "synth", wave: "sawtooth" }, notes: [] } };
    ["kick", "snare", "hat", "clap"].forEach(function (d) { p.rows.push({ id: uid(), name: d, src: { type: "synth", kind: d }, vol: 1, steps: new Array(32).fill(0) }); });
    return { v: 1, bpm: 120, swing: 0, bars: 8, patterns: [p], cur: p.id, placements: [], master: { vol: 0.9, rev: 0.35, dly: 0.375, fb: 0.35 }, metro: true,
      tracks: [mkTrack("Beat", "beat"), mkTrack("Keys / 808", "inst")], clips: [], takes: [], latency_ms: 0 };
  };
  function mkTrack(name, kind) { return { id: uid(), name: name, kind: kind, vol: 0.85, pan: 0, mute: false, solo: false, fx: { lo: 0, mid: 0, hi: 0, comp: false, thr: -18, rev: 0, dly: 0 } }; }
  E.mkTrack = mkTrack;
  E.pattern = function (p, id) { return p.patterns.filter(function (x) { return x.id === id; })[0] || p.patterns[0]; };
  E.patBeats = function (pat) { return pat.steps / 4; };

  // Turn a project into a flat, sorted list of timed events (time in beats). mode "pat" loops the current pattern; "song" uses the arrangement.
  E.buildEvents = function (p, mode) {
    var ev = [], swing = Math.max(0, Math.min(0.6, p.swing || 0)), beatTrack = p.tracks[0].id, instTrack = p.tracks[1].id;
    function addPattern(pat, startBeat) {
      var sw = function (s) { return s * 0.25 + (s % 2 === 1 ? swing * 0.25 : 0); };
      pat.rows.forEach(function (row, ri) { for (var s = 0; s < pat.steps; s++) { var v = row.steps[s]; if (v) ev.push({ t: startBeat + sw(s), kind: "hit", pat: pat.id, row: ri, vel: v === 2 ? 1 : 0.75, track: beatTrack }); } });
      (pat.inst.notes || []).forEach(function (n) { if (n.s < pat.steps) ev.push({ t: startBeat + sw(n.s), kind: "note", pat: pat.id, p: n.p, dur: Math.max(0.25, n.l) * 0.25, track: instTrack }); });
    }
    var length;
    if (mode === "pat") { var pat = E.pattern(p, p.cur); addPattern(pat, 0); length = E.patBeats(pat); }
    else {
      var end = 0; p.placements.forEach(function (pl) { var pat = E.pattern(p, pl.pat); if (!pat || pat.id !== pl.pat) return; addPattern(pat, pl.bar * 4); end = Math.max(end, pl.bar * 4 + E.patBeats(pat)); });
      (p.clips || []).forEach(function (c) { var take = p.takes.filter(function (t) { return t.id === c.take; })[0]; if (!take) return; ev.push({ t: c.start, kind: "clip", clip: c.id, track: c.track, off: c.off || 0, dur: c.dur || take.seconds }); end = Math.max(end, c.start + (c.dur || take.seconds) * p.bpm / 60); });
      length = Math.max(end, 4);
    }
    ev.sort(function (a, b) { return a.t - b.t; });
    return { events: ev, length: length };
  };

  E.peaks = function (buf, n) { // min/max style peaks (single max per bucket)
    var ch = buf.getChannelData(0), out = new Array(n).fill(0), size = Math.max(1, Math.floor(ch.length / n));
    for (var i = 0; i < n; i++) { var m = 0, s = i * size, e = Math.min(ch.length, s + size); var st = Math.max(1, Math.floor(size / 32)); for (var j = s; j < e; j += st) { var v = Math.abs(ch[j]); if (v > m) m = v; } out[i] = m; }
    return out;
  };

  // 16-bit PCM WAV. mono=true mixes down to halve the size.
  E.encodeWav = function (buf, mono) {
    var chs = mono ? 1 : Math.min(2, buf.numberOfChannels), len = buf.length, sr = buf.sampleRate, bytes = 44 + len * chs * 2, ab = new ArrayBuffer(bytes), v = new DataView(ab);
    function str(o, s) { for (var i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); }
    str(0, "RIFF"); v.setUint32(4, bytes - 8, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, chs, true); v.setUint32(24, sr, true); v.setUint32(28, sr * chs * 2, true); v.setUint16(32, chs * 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, len * chs * 2, true);
    var d0 = buf.getChannelData(0), d1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d0, o = 44;
    for (var i = 0; i < len; i++) {
      var a = mono ? (d0[i] + d1[i]) / 2 : d0[i]; a = Math.max(-1, Math.min(1, a)); v.setInt16(o, a < 0 ? a * 0x8000 : a * 0x7fff, true); o += 2;
      if (chs === 2) { var b = Math.max(-1, Math.min(1, d1[i])); v.setInt16(o, b < 0 ? b * 0x8000 : b * 0x7fff, true); o += 2; }
    }
    return ab;
  };
  E.wavBytes = function (seconds, sr, mono) { return 44 + Math.ceil(seconds * sr) * (mono ? 1 : 2) * 2; };

  /* ---------- sound generation ---------- */
  var noiseCache = new WeakMap();
  function noise(ctx) { var b = noiseCache.get(ctx); if (b) return b; b = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate); var d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noiseCache.set(ctx, b); return b; }
  function env(ctx, g, t, a, d, peak) { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); }
  E.drum = function (ctx, dest, kind, t, vel) {
    vel = vel || 1; var g = ctx.createGain(); g.connect(dest);
    function osc(type, f0, f1, dur) { var o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); o.connect(g); o.start(t); o.stop(t + dur + 0.05); }
    function nz(type, freq, q, dur) { var s = ctx.createBufferSource(); s.buffer = noise(ctx); var f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; s.connect(f); f.connect(g); s.start(t); s.stop(t + dur + 0.05); }
    if (kind === "kick") { env(ctx, g, t, 0.003, 0.42, vel); osc("sine", 150, 42, 0.18); }
    else if (kind === "808") { env(ctx, g, t, 0.005, 1.1, vel * 0.95); osc("sine", 90, 50, 0.12); }
    else if (kind === "snare") { env(ctx, g, t, 0.002, 0.2, vel * 0.8); nz("bandpass", 1900, 0.7, 0.2); osc("triangle", 220, 160, 0.1); }
    else if (kind === "hat") { env(ctx, g, t, 0.001, 0.05, vel * 0.5); nz("highpass", 7500, 0.7, 0.06); }
    else if (kind === "ohat") { env(ctx, g, t, 0.001, 0.3, vel * 0.45); nz("highpass", 7000, 0.7, 0.32); }
    else if (kind === "clap") { g.gain.setValueAtTime(0.0001, t); [0, 0.011, 0.022].forEach(function (d) { g.gain.setValueAtTime(vel * 0.7, t + d); g.gain.exponentialRampToValueAtTime(0.05, t + d + 0.01); }); g.gain.setValueAtTime(vel * 0.7, t + 0.033); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25); nz("bandpass", 1300, 1.2, 0.28); }
    else if (kind === "rim") { env(ctx, g, t, 0.001, 0.05, vel * 0.6); osc("square", 800, 500, 0.04); }
    else { env(ctx, g, t, 0.002, 0.25, vel * 0.8); osc("sine", 220, 120, 0.2); }
  };
  E.synthNote = function (ctx, dest, wave, midi, t, dur, vel) {
    var o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = wave || "sawtooth"; o.frequency.value = 440 * Math.pow(2, (midi - 69) / 12);
    f.type = "lowpass"; f.frequency.setValueAtTime(3500, t); f.frequency.exponentialRampToValueAtTime(900, t + Math.max(0.1, dur)); o.connect(f); f.connect(g); g.connect(dest);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28 * (vel || 1), t + 0.01); g.gain.setValueAtTime(0.28 * (vel || 1), t + Math.max(0.02, dur - 0.05)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.12); o.start(t); o.stop(t + dur + 0.2);
  };
  E.playBuffer = function (ctx, dest, buf, t, opts) {
    opts = opts || {}; var s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; if (opts.rate) s.playbackRate.value = opts.rate; s.connect(g); g.connect(dest);
    var vel = opts.vel == null ? 1 : opts.vel; g.gain.setValueAtTime(vel, t);
    if (opts.dur) { var end = t + opts.dur; g.gain.setValueAtTime(vel, end); g.gain.linearRampToValueAtTime(0.0001, end + 0.08); s.start(t, opts.off || 0); s.stop(end + 0.1); } else s.start(t, opts.off || 0, opts.len);
    return s;
  };
  function impulse(ctx) { var len = Math.floor(ctx.sampleRate * 2.2), b = ctx.createBuffer(2, len, ctx.sampleRate); for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); } return b; }

  /* ---------- mixer graph (works on a live or an offline context) ---------- */
  E.addChain = function (G, t) { if (!G.chains[t.id]) G.chains[t.id] = chain(G.ctx, t, G); };
  E.makeGraph = function (ctx, p) {
    var master = ctx.createGain(), an = ctx.createAnalyser(); an.fftSize = 512; master.gain.value = p.master.vol; master.connect(an); an.connect(ctx.destination);
    var rev = ctx.createConvolver(); rev.buffer = impulse(ctx); var revIn = ctx.createGain(); revIn.connect(rev); rev.connect(master);
    var dly = ctx.createDelay(2); var fb = ctx.createGain(), dIn = ctx.createGain(); dIn.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(master);
    var G = { ctx: ctx, master: master, masterAn: an, rev: revIn, dly: dIn, delayNode: dly, fb: fb, chains: {} };
    p.tracks.forEach(function (t) { G.chains[t.id] = chain(ctx, t, G); });
    E.applyMaster(G, p); E.applyMix(G, p); return G;
  };
  function chain(ctx, t, G) {
    var inp = ctx.createGain(), lo = ctx.createBiquadFilter(), mid = ctx.createBiquadFilter(), hi = ctx.createBiquadFilter(), comp = ctx.createDynamicsCompressor(), vol = ctx.createGain(), pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null, an = ctx.createAnalyser(), rs = ctx.createGain(), ds = ctx.createGain();
    lo.type = "lowshelf"; lo.frequency.value = 200; mid.type = "peaking"; mid.frequency.value = 1200; mid.Q.value = 0.9; hi.type = "highshelf"; hi.frequency.value = 5000; an.fftSize = 256;
    inp.connect(lo); lo.connect(mid); mid.connect(hi); hi.connect(comp); comp.connect(vol); var last = vol; if (pan) { vol.connect(pan); last = pan; }
    last.connect(an); an.connect(G.master); last.connect(rs); rs.connect(G.rev); last.connect(ds); ds.connect(G.dly);
    return { inp: inp, lo: lo, mid: mid, hi: hi, comp: comp, vol: vol, pan: pan, an: an, rs: rs, ds: ds };
  }
  E.applyMaster = function (G, p) { var t = G.ctx.currentTime; G.master.gain.setTargetAtTime(p.master.vol, t, 0.01); G.delayNode.delayTime.value = Math.max(0.01, Math.min(1.9, (p.master.dly || 0.375) * 60 / p.bpm * 2)); G.fb.gain.value = Math.min(0.85, p.master.fb || 0.35); };
  E.applyMix = function (G, p) {
    var t = G.ctx.currentTime, anySolo = p.tracks.some(function (x) { return x.solo; });
    p.tracks.forEach(function (tr) {
      var c = G.chains[tr.id]; if (!c) return; var audible = !tr.mute && (!anySolo || tr.solo), f = tr.fx;
      c.vol.gain.setTargetAtTime(audible ? tr.vol : 0, t, 0.01); if (c.pan) c.pan.pan.setTargetAtTime(tr.pan, t, 0.01);
      c.lo.gain.value = f.lo; c.mid.gain.value = f.mid; c.hi.gain.value = f.hi;
      c.comp.threshold.value = f.comp ? f.thr : 0; c.comp.ratio.value = f.comp ? 8 : 1; c.comp.knee.value = 12;
      c.rs.gain.setTargetAtTime(f.rev || 0, t, 0.01); c.ds.gain.setTargetAtTime(f.dly || 0, t, 0.01);
    });
  };
  E.level = function (an) { var d = new Uint8Array(an.fftSize); an.getByteTimeDomainData(d); var m = 0; for (var i = 0; i < d.length; i++) { var v = Math.abs(d[i] - 128) / 128; if (v > m) m = v; } return m; };

  // Play one event on a graph. buffers: { assetId|takeId : AudioBuffer }
  E.fire = function (G, p, ev, when, buffers) {
    var ctx = G.ctx, c = G.chains[ev.track]; if (!c) return;
    if (ev.kind === "hit") {
      var pat = E.pattern(p, ev.pat), row = pat.rows[ev.row]; if (!row) return;
      if (row.src.type === "asset") { var b = buffers[row.src.id]; if (b) E.playBuffer(ctx, c.inp, b, when, { vel: ev.vel * (row.vol == null ? 1 : row.vol) }); }
      else E.drum(ctx, c.inp, row.src.kind, when, ev.vel * (row.vol == null ? 1 : row.vol));
    } else if (ev.kind === "note") {
      var inst = E.pattern(p, ev.pat).inst, src = inst.src;
      if (src.type === "asset") { var sb = buffers[src.id]; if (sb) E.playBuffer(ctx, c.inp, sb, when, { rate: Math.pow(2, (ev.p - (src.root || 48)) / 12), dur: ev.dur * 60 / p.bpm, vel: 0.9 }); }
      else E.synthNote(ctx, c.inp, src.wave, ev.p, when, ev.dur * 60 / p.bpm, 1);
    } else if (ev.kind === "clip") { var cl = (p.clips || []).filter(function (x) { return x.id === ev.clip; })[0], tb = cl && buffers[cl.take]; if (tb) E.playBuffer(ctx, c.inp, tb, when, { off: ev.off, len: ev.dur, vel: 1 }); }
  };

  /* ---------- offline mixdown for export ---------- */
  E.render = function (p, buffers, tailSec) {
    var sr = 44100, built = E.buildEvents(p, p.placements.length || p.clips.length ? "song" : "pat"), secs = built.length * 60 / p.bpm + (tailSec == null ? 2 : tailSec);
    var ctx = new (root.OfflineAudioContext || root.webkitOfflineAudioContext)(2, Math.ceil(secs * sr), sr), G = E.makeGraph(ctx, p), bps = p.bpm / 60;
    built.events.forEach(function (ev) { E.fire(G, p, ev, ev.t / bps, buffers); });
    return ctx.startRendering();
  };

  /* ---------- live transport ---------- */
  E.Player = function (opts) { this.p = null; this.buffers = {}; this.ctx = null; this.G = null; this.timer = null; this.playing = false; this.onTick = opts && opts.onTick; this.mode = "pat"; };
  E.Player.prototype.ensure = function () { if (!this.ctx) { var AC = root.AudioContext || root.webkitAudioContext; this.ctx = new AC({ latencyHint: "interactive" }); } if (this.ctx.state === "suspended") this.ctx.resume(); return this.ctx; };
  E.Player.prototype.setProject = function (p) { this.p = p; if (this.G) { var G = this.G; p.tracks.forEach(function (t) { E.addChain(G, t); }); E.applyMaster(G, p); E.applyMix(G, p); } if (this.playing) this.refresh(); };
  E.Player.prototype.graph = function () { this.ensure(); if (!this.G) this.G = E.makeGraph(this.ctx, this.p); return this.G; };
  E.Player.prototype.refresh = function () { if (!this.playing) return; var b = E.buildEvents(this.p, this.mode); this.built = b; var pos = this.beatNow() - this.passOffset; var i = 0; while (i < b.events.length && b.events[i].t < pos + 0.001) i++; this.idx = i; };
  E.Player.prototype.beatNow = function () { return (this.ctx.currentTime - this.t0) * this.p.bpm / 60 + this.from; };
  // from: starting beat. countIn: beats of metronome before beat `from`.
  E.Player.prototype.start = function (mode, from, countIn) {
    this.stop(); var ctx = this.ensure(), G = this.graph(); E.applyMix(G, this.p); E.applyMaster(G, this.p); this.mode = mode; this.from = from || 0; this.countIn = countIn || 0;
    this.t0 = ctx.currentTime + 0.12 + (this.countIn * 60 / this.p.bpm); this.startCtx = this.t0; this.passOffset = 0; this.built = E.buildEvents(this.p, mode); this.idx = 0; this.nextClick = Math.ceil(this.from) - this.countIn;
    while (this.idx < this.built.events.length && this.built.events[this.idx].t < this.from) this.idx++;
    this.playing = true; var self = this; this.timer = setInterval(function () { self.tick(); }, 25); this.tick(); return this.t0;
  };
  E.Player.prototype.tick = function () {
    var ctx = this.ctx, p = this.p, bps = p.bpm / 60, horizon = ctx.currentTime + 0.15, G = this.G, self = this, guard = 0;
    var beatTime = function (beat) { return self.t0 + (beat - self.from) / bps; };
    if (p.metro) while (beatTime(this.nextClick) < horizon && guard++ < 16) { var bt = beatTime(this.nextClick); if (bt >= ctx.currentTime - 0.02) E.drum(ctx, G.chains[p.tracks[0].id].vol, "rim", Math.max(bt, ctx.currentTime), (Math.round(this.nextClick) % 4 === 0) ? 0.9 : 0.5); this.nextClick += 1; }
    else this.nextClick = Math.ceil(Math.max(this.nextClick, this.beatNow() - this.passOffset));
    var loopLen = this.built.length;
    while (guard++ < 400) {
      var ev = this.built.events[this.idx];
      if (!ev) { if (this.mode === "pat") { if (beatTime(loopLen + this.passOffset) > horizon) break; this.passOffset += loopLen; this.built = E.buildEvents(p, "pat"); loopLen = this.built.length; this.idx = 0; continue; } if (beatTime(loopLen) < ctx.currentTime) { this.stop(true); } break; }
      var when = beatTime(ev.t + this.passOffset); if (when > horizon) break;
      if (when >= ctx.currentTime - 0.03) E.fire(G, p, ev, Math.max(when, ctx.currentTime), this.buffers);
      this.idx++;
    }
    if (this.onTick) this.onTick(this.beatNow());
  };
  E.Player.prototype.stop = function (ended) { if (this.timer) clearInterval(this.timer); this.timer = null; var was = this.playing; this.playing = false; if (this.G && this.ctx) { var self = this; try { this.G.master.gain.cancelScheduledValues(0); this.G.master.gain.setValueAtTime(0, this.ctx.currentTime); this.G.master.gain.setTargetAtTime(this.p.master.vol, this.ctx.currentTime + 0.06, 0.02); } catch (e) { } } if (was && this.onStop) this.onStop(!!ended); };
  // Reuse one live graph when stopping (hung notes are cut by the short master dip above).

  /* ---------- microphone recording ---------- */
  E.pickMime = function () { var c = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]; for (var i = 0; i < c.length; i++) if (root.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(c[i])) return c[i]; return ""; };
  E.mimeExt = function (m) { return /mp4/.test(m) ? "m4a" : /ogg/.test(m) ? "ogg" : "webm"; };
  E.Recorder = function () { this.stream = null; this.rec = null; this.chunks = []; };
  E.Recorder.prototype.open = function (deviceId) {
    var self = this; this.close();
    var c = { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } }; if (deviceId) c.audio.deviceId = { exact: deviceId };
    return navigator.mediaDevices.getUserMedia(c).then(function (s) { self.stream = s; return s; });
  };
  E.Recorder.prototype.begin = function () { var self = this, mime = E.pickMime(); this.chunks = []; this.mime = mime; this.rec = mime ? new MediaRecorder(this.stream, { mimeType: mime }) : new MediaRecorder(this.stream); this.mime = this.rec.mimeType || mime; this.rec.ondataavailable = function (e) { if (e.data && e.data.size) self.chunks.push(e.data); }; this.rec.start(1000); /* a chunk every second so a crash loses at most one second */ };
  E.Recorder.prototype.end = function () { var self = this; return new Promise(function (res) { if (!self.rec || self.rec.state === "inactive") return res(new Blob(self.chunks, { type: self.mime })); self.rec.onstop = function () { res(new Blob(self.chunks, { type: self.mime })); }; self.rec.stop(); }); };
  E.Recorder.prototype.close = function () { if (this.stream) this.stream.getTracks().forEach(function (t) { t.stop(); }); this.stream = null; };

  /* ---------- local safety copy (IndexedDB) ---------- */
  var dbp = null;
  function db() { if (dbp) return dbp; dbp = new Promise(function (res, rej) { try { var r = indexedDB.open("potent-lab", 1); r.onupgradeneeded = function () { r.result.createObjectStore("proj"); r.result.createObjectStore("blobs"); }; r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; } catch (e) { rej(e); } }); return dbp; }
  function tx(store, mode, fn) { return db().then(function (d) { return new Promise(function (res, rej) { var t = d.transaction(store, mode), s = t.objectStore(store), r = fn(s); t.oncomplete = function () { res(r && r.result); }; t.onerror = t.onabort = function () { rej(t.error); }; }); }); }
  E.store = {
    put: function (store, key, val) { return tx(store, "readwrite", function (s) { return s.put(val, key); }); },
    get: function (store, key) { return tx(store, "readonly", function (s) { return s.get(key); }); },
    del: function (store, key) { return tx(store, "readwrite", function (s) { return s.delete(key); }); },
    keys: function (store) { return tx(store, "readonly", function (s) { return s.getAllKeys(); }); }
  };
  if (typeof module !== "undefined" && module.exports) module.exports = E; else root.LabEngine = E;
})(typeof window !== "undefined" ? window : globalThis);
