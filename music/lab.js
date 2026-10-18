/* Beat Lab: project, beat maker, piano roll, arrangement, recording, mixer, saving, export. */
(function () {
  var PM = window.PM, E = window.LabEngine, LAB = window.LAB, S = LAB.S, esc = PM.esc, $ = PM.$;
  var player = LAB.player = new E.Player({ onTick: null });
  var P = null;            // the project JSON being edited
  var J = null;            // server details for it (title, version, links…)
  var rec = new E.Recorder(), mic = { on: false, devices: [], id: "", monitor: false, node: null };
  var armed = null, selClip = null, from = 0, mode = "pat", saving = false, timers = {}, raf = 0, recording = null, countBars = 1;
  var canEdit = true;
  LAB.proj = function () { return P; };

  /* ---------- small helpers ---------- */
  function q(sel, root) { return (root || document).querySelector(sel); }
  function qa(sel, root) { return [].slice.call((root || document).querySelectorAll(sel)); }
  function now() { return new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }); }
  function curPat() { return E.pattern(P, P.cur); }
  function bps() { return P.bpm / 60; }
  function audioTracks() { return P.tracks.filter(function (t) { return t.kind === "audio"; }); }
  function trackOf(id) { return P.tracks.filter(function (t) { return t.id === id; })[0]; }
  function takeOf(id) { return P.takes.filter(function (t) { return t.id === id; })[0]; }
  function secsToBeats(s) { return s * bps(); }
  function fmtDur(s) { s = Math.round(s); return Math.floor(s / 60) + ":" + ("0" + (s % 60)).slice(-2); }
  function clean(d) { // make any saved project safe to use
    d = d && typeof d === "object" && d.patterns ? d : E.defaultProject();
    d.v = 1; d.bpm = Math.max(40, Math.min(300, Number(d.bpm) || 120)); d.swing = Number(d.swing) || 0; d.bars = Math.max(4, Math.min(64, Number(d.bars) || 8));
    d.master = Object.assign({ vol: 0.9, rev: 0.35, dly: 0.375, fb: 0.35 }, d.master || {}); d.placements = d.placements || []; d.clips = d.clips || []; d.takes = d.takes || [];
    d.tracks = d.tracks || []; if (!d.tracks[0] || d.tracks[0].kind !== "beat") d.tracks.unshift(E.mkTrack("Beat", "beat")); if (!d.tracks[1] || d.tracks[1].kind !== "inst") d.tracks.splice(1, 0, E.mkTrack("Keys / 808", "inst"));
    d.tracks.forEach(function (t) { t.fx = Object.assign({ lo: 0, mid: 0, hi: 0, comp: false, thr: -18, rev: 0, dly: 0 }, t.fx || {}); if (t.vol == null) t.vol = 0.85; if (t.pan == null) t.pan = 0; });
    d.patterns.forEach(function (p) { p.steps = p.steps === 32 ? 32 : 16; p.inst = p.inst || { src: { type: "synth", wave: "sawtooth" }, notes: [] }; p.rows.forEach(function (r) { while (r.steps.length < 32) r.steps.push(0); if (r.vol == null) r.vol = 1; }); });
    if (!d.cur || !d.patterns.some(function (p) { return p.id === d.cur; })) d.cur = d.patterns[0].id;
    return d;
  }

  /* ---------- saving: local copy first, POTENT second, and always honest about which ---------- */
  var rev = 0, savedRev = 0, lastSaved = null, localErr = false;
  function setPill(cls, txt) { var p = $("pill"); if (p) { p.className = cls; p.textContent = txt; } }
  function pill() {
    if (!J) return setPill("warn", "No project");
    if (!canEdit) return setPill("warn", "View only");
    if (saving) return setPill("warn", "Saving…");
    if (S.failedUploads) return setPill("bad", "A recording is only on this device. Tap to retry.");
    if (rev === savedRev) return setPill("ok", "Saved to POTENT" + (lastSaved ? " · " + lastSaved : ""));
    return setPill(S.saveError ? "bad" : "warn", S.saveError ? "Not saved to POTENT yet. A copy is kept on this device." : "Unsaved changes. A copy is kept on this device.");
  }
  function touch() {
    if (!canEdit || !P) return; rev++; pill(); player.setProject(P);
    clearTimeout(timers.local); timers.local = setTimeout(localSave, 800);
    clearTimeout(timers.srv); timers.srv = setTimeout(function () { save(); }, 9000);
  }
  function localSave() { if (!J) return Promise.resolve(); return E.store.put("proj", J.id, { data: P, rev: rev, ts: Date.now(), base: J.version, dirty: rev !== savedRev }).then(function () { localErr = false; }).catch(function () { localErr = true; }); }
  function save(snapshot, note) {
    if (!J || !canEdit || saving) return Promise.resolve(false);
    if (rev === savedRev && !snapshot) return Promise.resolve(true);
    saving = true; pill(); var mine = rev;
    return LAB.api({ action: "l_project_save", id: J.id, data: P, bpm: P.bpm, expect_version: J.version, snapshot: snapshot === true, note: note }).then(function (r) {
      J.version = r.version; saving = false; S.saveError = false; if (mine === rev) savedRev = rev; lastSaved = now(); pill(); localSave(); return true;
    }).catch(function (e) {
      saving = false;
      if (e.status === 409) { pill(); conflict(); return false; }
      S.saveError = true; pill(); return false;
    });
  }
  function conflict() {
    PM.dialog('<h2 style="margin:0 0 6px">A newer version exists</h2><div class="muted">Someone saved this project from another place while you were working. Nothing was overwritten. Your work is safe on this device.</div><div class="row"><button id="cKeep">Keep mine as a new project</button><button class="alt" id="cLoad">Load the newer version</button></div>', function () {
      $("cKeep").onclick = function () { LAB.api({ action: "l_project_create", title: (J.title || "Project") + " (my copy)", bpm: P.bpm }).then(function (n) { return LAB.api({ action: "l_project_save", id: n.id, data: P, bpm: P.bpm }).then(function () { PM.close(); openProject(n.id, true); }); }).catch(LAB.err); };
      $("cLoad").onclick = function () { if (confirm("Replace what is on screen with the newer saved version?")) { PM.close(); E.store.del("proj", J.id).catch(function () { }); openProject(J.id, true); } };
    });
  }
  window.addEventListener("beforeunload", function (e) { if (J && canEdit && (rev !== savedRev || S.failedUploads || S.uploading)) { localSave(); e.preventDefault(); e.returnValue = ""; } });
  setInterval(function () { if (J && canEdit && rev !== savedRev) save(); }, 30000);
  document.addEventListener("visibilitychange", function () { if (document.hidden && J && rev !== savedRev) { localSave(); save(); } });

  /* ---------- opening a project ---------- */
  function openProject(id, skipRecover) {
    return LAB.api({ action: "l_project_get", id: id }).then(function (r) {
      J = r.project; canEdit = !!r.can_edit; S.owner = !!r.owner; S.serverTakes = r.takes; J.can_edit = canEdit;
      var p = clean(J.data && J.data.patterns ? J.data : null); p.bpm = Number(J.bpm) || p.bpm;
      return (skipRecover ? Promise.resolve(null) : E.store.get("proj", J.id).catch(function () { return null; })).then(function (loc) {
        P = p; rev = savedRev = 0; S.failedUploads = 0; S.saveError = false;
        if (loc && loc.dirty && loc.data && canEdit && loc.base === J.version && confirm("Your last session on this device has changes that were not saved to POTENT (" + new Date(loc.ts).toLocaleString() + "). Recover them?")) { P = clean(loc.data); rev = 1; }
        try { localStorage.setItem("lab_last", J.id); } catch (e) { }
        player.setProject(P); player.buffers = {}; player.graph(); $("ptitle").textContent = J.title; $("bpm").value = P.bpm; $("metro").checked = !!P.metro; from = 0;
        pill(); renderAll(); return loadBuffers();
      });
    }).catch(LAB.err);
  }
  function loadBuffers() {
    var jobs = [], miss = 0;
    P.patterns.forEach(function (pt) { pt.rows.forEach(function (r) { if (r.src.type === "asset") jobs.push(r.src.id); }); if (pt.inst.src.type === "asset") jobs.push(pt.inst.src.id); });
    jobs.filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (id) { LAB.assetBuffer(id).then(function (b) { player.buffers[id] = b; }).catch(function () { miss++; if (miss === 1) PM.toast("A sound in this project is no longer available"); }); });
    P.takes.forEach(function (t) { loadTake(t); });
    return E.store.keys("blobs").then(function (keys) { return Promise.all(keys.map(function (k) { return E.store.get("blobs", k).then(function (v) { if (v && v.project === J.id && !takeOf(k)) { // a recording that never made it into the saved project
        return addRecovered(k, v); } }); })); }).catch(function () { });
  }
  function loadTake(t) {
    if (player.buffers[t.id]) return Promise.resolve();
    return E.store.get("blobs", t.id).catch(function () { return null; }).then(function (v) {
      if (v && v.blob) return v.blob.arrayBuffer().then(LAB.decode).then(function (b) { player.buffers[t.id] = b; if (t.state !== "saved") { t.state = t.state === "uploading" ? "failed" : t.state; S.failedUploads = P.takes.filter(function (x) { return x.state === "failed" || x.state === "local"; }).length; pill(); } });
      if (!t.serverId) return;
      return LAB.api({ action: "l_take_get", project_id: J.id, id: t.serverId }).then(function (r) { return fetch(r.url); }).then(function (r) { return r.arrayBuffer(); }).then(LAB.decode).then(function (b) { player.buffers[t.id] = b; });
    }).catch(function () { t.missing = true; });
  }
  function addRecovered(key, v) {
    return v.blob.arrayBuffer().then(LAB.decode).then(function (b) {
      var tr = audioTracks()[0]; if (!tr) { tr = E.mkTrack("Vocals 1", "audio"); P.tracks.push(tr); }
      var t = { id: key, track: tr.id, name: "Recovered recording", seconds: b.duration, peaks: E.peaks(b, 120), state: "local", mime: v.blob.type }; P.takes.push(t); player.buffers[key] = b; S.failedUploads = (S.failedUploads || 0) + 1; touch(); pill(); renderRec();
      PM.toast("Found a recording that wasn't saved yet. It's in your takes.");
    });
  }

  /* ---------- tabs ---------- */
  var TAB = "beat";
  function tab(t) { TAB = t; qa(".lab-tabs button").forEach(function (b) { b.classList.toggle("on", b.dataset.t === t); }); ["sounds", "beat", "rec", "mix", "proj"].forEach(function (n) { var el = $("p-" + n); if (el) el.classList.toggle("on", n === t); }); renderAll(); }
  function renderAll() { if (!P) { renderProj(); return; } if (TAB === "sounds") LAB.renderSounds(); if (TAB === "beat") renderBeat(); if (TAB === "rec") renderRec(); if (TAB === "mix") renderMix(); if (TAB === "proj") renderProj(); }

  /* ---------- Beat Maker ---------- */
  function renderBeat() {
    var el = $("p-beat"), pat = curPat();
    el.innerHTML = '<div class="card"><div class="row" style="margin-top:0"><select id="patSel" style="max-width:200px">' + P.patterns.map(function (p) { return '<option value="' + p.id + '"' + (p.id === P.cur ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + '</select><button class="alt" id="patNew">+ New</button><button class="alt" id="patCopy">Copy</button><button class="alt" id="patName">Rename</button><button class="alt" id="patLen">' + pat.steps + ' steps</button><label class="note">Swing <input id="swing" type="range" min="0" max="50" value="' + Math.round(P.swing * 100) + '" style="width:90px"></label></div>' +
      '<div class="seq" id="seq" style="margin-top:8px"></div><div class="row"><button id="addRow" class="alt">+ Drum row</button><small class="muted">Tap a step once for a hit, again for an accent, again to clear. Add your own sounds from the Sound Browser.</small></div></div>' +
      '<div class="card"><b>Piano roll</b> <small class="muted">— tap to add a note, tap a note to remove it, drag sideways to make it longer</small><div class="row"><label class="note">Sound <select id="instSel"></select></label><span id="instRoot"></span></div><canvas id="piano" class="piano"></canvas></div>' +
      '<div class="card"><b>Arrangement</b> <small class="muted">— tap the Beat lane to place the current pattern, tap a block to remove it</small><div id="tlBeat" style="margin-top:6px"></div></div>';
    drawSeq(); drawPiano(); renderInst(); renderTimeline($("tlBeat"), false);
    $("patSel").onchange = function () { P.cur = this.value; touch(); renderBeat(); };
    $("patNew").onclick = function () { if (!canEdit) return; var n = { id: E.uid(), name: "Pattern " + (P.patterns.length + 1), steps: 16, rows: pat.rows.map(function (r) { return { id: E.uid(), name: r.name, src: r.src, vol: r.vol, steps: new Array(32).fill(0) }; }), inst: { src: pat.inst.src, notes: [] } }; P.patterns.push(n); P.cur = n.id; touch(); renderBeat(); };
    $("patCopy").onclick = function () { if (!canEdit) return; var n = JSON.parse(JSON.stringify(pat)); n.id = E.uid(); n.name = pat.name + " copy"; n.rows.forEach(function (r) { r.id = E.uid(); }); P.patterns.push(n); P.cur = n.id; touch(); renderBeat(); };
    $("patName").onclick = function () { var n = prompt("Pattern name", pat.name); if (n && canEdit) { pat.name = n.slice(0, 30); touch(); renderBeat(); } };
    $("patLen").onclick = function () { if (!canEdit) return; pat.steps = pat.steps === 16 ? 32 : 16; touch(); renderBeat(); };
    $("swing").oninput = function () { P.swing = this.value / 100; touch(); };
    $("addRow").onclick = function () { LAB.builtinDialog(); };
  }
  function drawSeq() {
    var pat = curPat(), box = $("seq"); if (!box) return;
    box.innerHTML = pat.rows.map(function (r, ri) {
      return '<div class="seqrow"><span class="nm" data-rn="' + ri + '" title="Tap to rename, change volume or remove">' + esc(r.name) + (r.src.type === "asset" ? " ♪" : "") + '</span><div class="cells">' + Array.apply(null, Array(pat.steps)).map(function (_, s) { var v = r.steps[s]; return '<button class="cell' + (v === 1 ? " on" : v === 2 ? " acc" : "") + '" data-r="' + ri + '" data-s="' + s + '" aria-label="' + esc(r.name) + " step " + (s + 1) + '"></button>'; }).join("") + "</div></div>";
    }).join("") || "<small class='muted'>No rows yet. Add a drum row.</small>";
    qa(".cell", box).forEach(function (c) { c.onclick = function () { if (!canEdit) return; var r = pat.rows[+c.dataset.r], s = +c.dataset.s; r.steps[s] = ((r.steps[s] || 0) + 1) % 3; c.className = "cell" + (r.steps[s] === 1 ? " on" : r.steps[s] === 2 ? " acc" : ""); if (r.steps[s]) auditionRow(r); touch(); }; });
    qa("[data-rn]", box).forEach(function (n) { n.onclick = function () { rowDialog(pat.rows[+n.dataset.rn], +n.dataset.rn); }; });
  }
  function auditionRow(r) { var ctx = player.ensure(), G = player.graph(), c = G.chains[P.tracks[0].id]; if (r.src.type === "asset") { var b = player.buffers[r.src.id]; if (b) E.playBuffer(ctx, c.inp, b, ctx.currentTime, { vel: r.vol }); } else E.drum(ctx, c.inp, r.src.kind, ctx.currentTime, r.vol); }
  function rowDialog(r, ri) {
    PM.dialog('<h2 style="margin:0 0 6px">' + esc(r.name) + '</h2><label class="note">Name<input id="rn" maxlength="24" value="' + esc(r.name) + '"></label><label class="note">Volume<input id="rv" type="range" min="0" max="100" value="' + Math.round(r.vol * 100) + '"></label>' + (r.src.type === "synth" ? '<div class="note">Built-in sound</div><div class="two">' + E.DRUMS.map(function (d) { return '<button class="alt" data-k="' + d + '"' + (r.src.kind === d ? " style='border-color:var(--gold)'" : "") + ">" + d + "</button>"; }).join("") + "</div>" : '<div class="note">Library sound</div>') + '<div class="row"><button id="rok">Done</button><button class="alt" id="rrm" style="color:#e74c3c">Remove row</button></div>', function (d) {
      $("rok").onclick = function () { if (canEdit) { r.name = $("rn").value || r.name; r.vol = $("rv").value / 100; touch(); } PM.close(); renderBeat(); };
      $("rrm").onclick = function () { if (canEdit) { curPat().rows.splice(ri, 1); touch(); } PM.close(); renderBeat(); };
      qa("[data-k]", d).forEach(function (b) { b.onclick = function () { if (!canEdit) return; r.src = { type: "synth", kind: b.dataset.k }; r.name = b.dataset.k; touch(); PM.close(); renderBeat(); }; });
    });
  }
  LAB.addBuiltinRow = function (kind) { if (!P || !canEdit) return PM.toast(P ? "View-only project" : "Open a project first"); var pat = curPat(); pat.rows.push({ id: E.uid(), name: kind, src: { type: "synth", kind: kind }, vol: 1, steps: new Array(32).fill(0) }); touch(); if (TAB === "beat") renderBeat(); else PM.toast("Added " + kind + " to the Beat Maker"); };
  LAB.addRowFromAsset = function (id) {
    if (!P || !canEdit) return PM.toast(P ? "View-only project" : "Open or create a project first");
    LAB.assetBuffer(id).then(function (b) { player.buffers[id] = b; var a = S.urls[id] || {}, pat = curPat(); pat.rows.push({ id: E.uid(), name: (a.name || "sound").slice(0, 24), src: { type: "asset", id: id }, vol: 1, steps: new Array(32).fill(0) }); touch(); PM.toast("Added to " + pat.name); if (TAB === "beat") renderBeat(); }).catch(LAB.err);
  };
  LAB.setInstFromAsset = function (id) {
    if (!P || !canEdit) return PM.toast(P ? "View-only project" : "Open or create a project first");
    LAB.assetBuffer(id).then(function (b) { player.buffers[id] = b; curPat().inst.src = { type: "asset", id: id, root: 48, name: (S.urls[id] || {}).name }; touch(); PM.toast("Piano roll now plays that sound"); if (TAB === "beat") renderBeat(); }).catch(LAB.err);
  };
  function renderInst() {
    var inst = curPat().inst, sel = $("instSel"); if (!sel) return;
    var opts = ["sawtooth", "square", "triangle", "sine"].map(function (w) { return '<option value="w:' + w + '"' + (inst.src.type === "synth" && inst.src.wave === w ? " selected" : "") + ">Synth: " + w + "</option>"; });
    if (inst.src.type === "asset") opts.push('<option value="a" selected>Library: ' + esc(inst.src.name || "sound") + "</option>");
    sel.innerHTML = opts.join(""); sel.onchange = function () { if (!canEdit) return; if (this.value.indexOf("w:") === 0) { inst.src = { type: "synth", wave: this.value.slice(2) }; touch(); renderInst(); } };
    var rt = $("instRoot"); rt.innerHTML = inst.src.type === "asset" ? '<label class="note">Original pitch <select id="rootSel">' + Array.apply(null, Array(36)).map(function (_, i) { var m = 36 + i; return '<option value="' + m + '"' + (m === (inst.src.root || 48) ? " selected" : "") + ">" + noteName(m) + "</option>"; }).join("") + "</select></label>" : "";
    if (inst.src.type === "asset") $("rootSel").onchange = function () { inst.src.root = +this.value; touch(); };
  }
  var NN = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  function noteName(m) { return NN[m % 12] + (Math.floor(m / 12) - 1); }
  var BLACK = { 1: 1, 3: 1, 6: 1, 8: 1, 10: 1 }, drag = null;
  function drawPiano() {
    var cv = $("piano"); if (!cv) return; var pat = curPat(), cw = 28, ch = 18, gut = 46, W = gut + cw * pat.steps, H = ch * E.NOTE_ROWS; cv.width = W; cv.height = H; var g = cv.getContext("2d");
    g.fillStyle = "#0d0d0b"; g.fillRect(0, 0, W, H);
    for (var r = 0; r < E.NOTE_ROWS; r++) { var m = E.NOTE_LOW + E.NOTE_ROWS - 1 - r, y = r * ch; g.fillStyle = BLACK[m % 12] ? "#171714" : "#1d1d19"; g.fillRect(gut, y, W - gut, ch); g.fillStyle = BLACK[m % 12] ? "#333" : "#e8e4d6"; g.fillRect(0, y, gut - 2, ch - 1); g.fillStyle = BLACK[m % 12] ? "#ccc" : "#222"; g.font = "11px sans-serif"; if (m % 12 === 0 || !BLACK[m % 12]) g.fillText(noteName(m), 4, y + 13); }
    g.strokeStyle = "rgba(255,255,255,.08)"; for (var s = 0; s <= pat.steps; s++) { g.strokeStyle = s % 4 === 0 ? "rgba(255,255,255,.28)" : "rgba(255,255,255,.08)"; g.beginPath(); g.moveTo(gut + s * cw, 0); g.lineTo(gut + s * cw, H); g.stroke(); }
    g.fillStyle = "#e8ff1a"; (pat.inst.notes || []).forEach(function (n) { var row = E.NOTE_LOW + E.NOTE_ROWS - 1 - n.p; if (row < 0 || row >= E.NOTE_ROWS) return; g.fillRect(gut + n.s * cw + 1, row * ch + 1, n.l * cw - 2, ch - 2); });
    function pos(e) { var r = cv.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, y = (e.clientY - r.top) * H / r.height; return { s: Math.floor((x - gut) / cw), p: E.NOTE_LOW + E.NOTE_ROWS - 1 - Math.floor(y / ch), x: x }; }
    cv.onpointerdown = function (e) {
      var o = pos(e); if (o.p < E.NOTE_LOW || o.p >= E.NOTE_LOW + E.NOTE_ROWS) return; var ctx = player.ensure(), G = player.graph();
      if (o.x < gut) { E.synthNote(ctx, G.chains[P.tracks[1].id].inp, "sawtooth", o.p, ctx.currentTime, 0.3, 1); return; }
      if (o.s < 0 || o.s >= pat.steps || !canEdit) return;
      var hit = pat.inst.notes.filter(function (n) { return n.p === o.p && o.s >= n.s && o.s < n.s + n.l; })[0];
      if (hit) { pat.inst.notes.splice(pat.inst.notes.indexOf(hit), 1); touch(); drawPiano(); return; }
      var nn = { p: o.p, s: o.s, l: 1 }; pat.inst.notes.push(nn); drag = nn; cv.setPointerCapture(e.pointerId);
      var inst = pat.inst.src; if (inst.type === "asset") { var b = player.buffers[inst.id]; if (b) E.playBuffer(ctx, G.chains[P.tracks[1].id].inp, b, ctx.currentTime, { rate: Math.pow(2, (o.p - (inst.root || 48)) / 12), dur: 0.4 }); } else E.synthNote(ctx, G.chains[P.tracks[1].id].inp, inst.wave, o.p, ctx.currentTime, 0.3, 1);
      drawPiano();
    };
    cv.onpointermove = function (e) { if (!drag) return; var o = pos(e); drag.l = Math.max(1, Math.min(pat.steps - drag.s, o.s - drag.s + 1)); drawPiano(); };
    cv.onpointerup = function () { if (drag) { drag = null; touch(); } };
  }

  /* ---------- Arrangement timeline ---------- */
  var PX = 56;
  function renderTimeline(el, withAudio) {
    if (!el) return; var bars = P.bars, bw = PX * bars, lanes = [];
    var ruler = '<div class="ruler" style="width:' + bw + 'px">' + Array.apply(null, Array(bars)).map(function (_, i) { return '<div style="width:' + PX + 'px">' + (i + 1) + "</div>"; }).join("") + "</div>";
    var beatLane = '<div class="lane" data-lane="beat" style="width:' + bw + 'px;background-size:' + PX + 'px 100%"><span class="lbl">Beat</span>' + P.placements.map(function (pl, i) { var pt = E.pattern(P, pl.pat); return '<div class="blk" data-pl="' + i + '" style="left:' + pl.bar * PX + "px;width:" + (pt.steps / 16) * PX + 'px"><span>' + esc(pt.name) + "</span></div>"; }).join("") + "</div>";
    lanes.push(beatLane);
    if (withAudio) audioTracks().forEach(function (t) { lanes.push('<div class="lane" data-lane="' + t.id + '" style="width:' + bw + 'px;background-size:' + PX + 'px 100%"><span class="lbl">' + esc(t.name) + "</span>" + P.clips.filter(function (c) { return c.track === t.id; }).map(function (c) { var tk = takeOf(c.take); var w = Math.max(6, c.dur * bps() / 4 * PX); return '<div class="blk' + (selClip === c.id ? " sel" : "") + '" data-cl="' + c.id + '" style="left:' + c.start / 4 * PX + "px;width:" + w + 'px"><canvas width="' + Math.round(w) + '" height="36" data-pk="' + c.id + '"></canvas><span>' + esc(tk ? tk.name : "clip") + "</span></div>"; }).join("") + "</div>"); });
    el.innerHTML = '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px"><label class="note">Song length <select class="barsSel">' + [4, 8, 12, 16, 24, 32, 48, 64].map(function (b) { return '<option value="' + b + '"' + (b === P.bars ? " selected" : "") + ">" + b + " bars</option>"; }).join("") + '</select></label><button class="alt fillBtn">Fill with current pattern</button><button class="alt clearBtn">Clear beat lane</button></div><div class="tl"><div class="tl-in" style="width:' + bw + 'px">' + ruler + lanes.join("") + '<div class="ph" data-ph></div></div></div>';
    qa(".barsSel", el).forEach(function (s) { s.onchange = function () { P.bars = +this.value; touch(); renderAll(); }; });
    qa(".fillBtn", el)[0].onclick = function () { if (!canEdit) return; var pt = curPat(), len = pt.steps / 16; P.placements = P.placements.filter(function (pl) { return pl.pat !== pt.id; }); for (var b = 0; b + len <= P.bars; b += len) if (!overlap(b, len)) P.placements.push({ pat: pt.id, bar: b }); touch(); renderAll(); };
    qa(".clearBtn", el)[0].onclick = function () { if (canEdit && confirm("Clear every pattern from the arrangement?")) { P.placements = []; touch(); renderAll(); } };
    qa(".ruler", el)[0].onclick = function (e) { var r = this.getBoundingClientRect(); from = Math.max(0, Math.floor((e.clientX - r.left) / PX * 4) / 1); from = Math.round(from * 1) / 1; movePH(); };
    var bl = q('[data-lane="beat"]', el); bl.onclick = function (e) {
      if (!canEdit) return; var blk = e.target.closest ? e.target.closest("[data-pl]") : null;
      if (blk) { P.placements.splice(+blk.dataset.pl, 1); touch(); renderAll(); return; }
      var r = bl.getBoundingClientRect(), bar = Math.floor((e.clientX - r.left) / PX), len = curPat().steps / 16; if (bar + len > P.bars) bar = P.bars - len; if (overlap(bar, len)) return PM.toast("That spot is taken"); P.placements.push({ pat: P.cur, bar: Math.max(0, bar) }); touch(); renderAll();
    };
    qa("[data-pk]", el).forEach(function (cv) { var c = P.clips.filter(function (x) { return x.id === cv.dataset.pk; })[0], tk = c && takeOf(c.take); if (!tk || !tk.peaks) return; var g = cv.getContext("2d"); g.fillStyle = "rgba(232,255,26,.8)"; var n = tk.peaks.length, i0 = Math.floor(c.off / tk.seconds * n), i1 = Math.ceil((c.off + c.dur) / tk.seconds * n); for (var x = 0; x < cv.width; x++) { var idx = Math.min(n - 1, i0 + Math.floor(x / cv.width * (i1 - i0))), h = Math.max(1, tk.peaks[idx] * 34); g.fillRect(x, 18 - h / 2, 1, h); } });
    qa("[data-cl]", el).forEach(function (blk) { clipDrag(blk); });
    movePH();
  }
  function overlap(bar, len, ignore) { return P.placements.some(function (pl, i) { if (i === ignore) return false; var l = E.pattern(P, pl.pat).steps / 16; return bar < pl.bar + l && pl.bar < bar + len; }); }
  function clipDrag(blk) {
    var c = P.clips.filter(function (x) { return x.id === blk.dataset.cl; })[0], sx = 0, st = 0, moved = false;
    blk.onpointerdown = function (e) { sx = e.clientX; st = c.start; moved = false; blk.setPointerCapture(e.pointerId); };
    blk.onpointermove = function (e) { if (!blk.hasPointerCapture || !blk.hasPointerCapture(e.pointerId) || !canEdit) return; var dx = e.clientX - sx; if (Math.abs(dx) > 3) moved = true; if (moved) blk.style.left = Math.max(0, st / 4 * PX + dx) + "px"; };
    blk.onpointerup = function (e) { if (moved && canEdit) { c.start = Math.max(0, Math.round((st + (e.clientX - sx) / PX * 4) * 4) / 4); touch(); } else { selClip = selClip === c.id ? null : c.id; } renderAll(); };
  }
  function movePH() { qa("[data-ph]").forEach(function (ph) { ph.style.left = (player.playing ? Math.max(0, (player.beatNow() - player.passOffset * 0) / 4) : from / 4) * PX + "px"; }); }

  /* ---------- transport ---------- */
  function startAnim() { cancelAnimationFrame(raf); (function loop() { if (!player.playing) { qa(".cell.now").forEach(function (c) { c.classList.remove("now"); }); return; } if (player.playing) { var b = player.beatNow(); if (mode === "pat") { var pt = curPat(), pb = E.patBeats(pt), stepNow = Math.floor((((b % pb) + pb) % pb) * 4); qa(".cell.now").forEach(function (c) { c.classList.remove("now"); }); qa('.cell[data-s="' + stepNow + '"]').forEach(function (c) { c.classList.add("now"); }); } else qa(".cell.now").forEach(function (c) { c.classList.remove("now"); }); qa("[data-ph]").forEach(function (ph) { ph.style.left = Math.max(0, b / 4 * PX) + "px"; }); }
      meters(); raf = requestAnimationFrame(loop); })(); }
  function meters() { if (TAB !== "mix" || !player.G) return; P.tracks.forEach(function (t) { var c = player.G.chains[t.id], el = q('[data-mt="' + t.id + '"] i'); if (c && el) el.style.width = Math.min(100, E.level(c.an) * 140) + "%"; }); var m = q('[data-mt="master"] i'); if (m) m.style.width = Math.min(100, E.level(player.G.masterAn) * 140) + "%"; }
  function play(m) {
    if (!P) return PM.toast("Open or create a project first"); mode = m; player.setProject(P); player.start(m, m === "song" ? from : 0, 0); startAnim();
    if (m === "song" && !P.placements.length && !P.clips.length) PM.toast("Nothing is on the timeline yet. Use “Fill with current pattern”.");
  }
  function stopAll() { player.stop(); if (recording) finishRecording(); qa(".cell.now").forEach(function (c) { c.classList.remove("now"); }); movePH(); }
  player.onStop = function (ended) { if (recording) finishRecording(); setRecUi(); };

  /* ---------- Recording ---------- */
  function renderRec() {
    var el = $("p-rec"); if (!el) return; var at = audioTracks(); if (!armed || !trackOf(armed)) armed = at[0] && at[0].id;
    var ctx = player.ctx, lat = ctx ? Math.round(((ctx.baseLatency || 0) + (ctx.outputLatency || 0)) * 1000) : 0;
    el.innerHTML = '<div class="card"><b>Microphone</b><div class="warnbox">Recording works in your browser. Your device and browser decide the delay (latency): wired headphones and a wired mic work best, and Bluetooth is usually slow. This is not low-latency pro hardware. If your takes sound a little late, raise the offset below.</div><div class="row"><button id="micOn">' + (mic.on ? "Microphone ready ✓" : "Enable microphone") + '</button><select id="micSel"' + (mic.on ? "" : " disabled") + ">" + (mic.devices.length ? mic.devices.map(function (d) { return '<option value="' + d.deviceId + '"' + (d.deviceId === mic.id ? " selected" : "") + ">" + esc(d.label || "Input") + "</option>"; }).join("") : "<option>Choose after enabling</option>") + '</select></div><div class="row"><label class="note"><input type="checkbox" id="mon"' + (mic.monitor ? " checked" : "") + '> Hear myself (headphones only, or it will feed back)</label><label class="note">Offset <input id="latms" type="number" min="0" max="500" step="5" value="' + (P.latency_ms || 0) + '" style="width:76px"> ms</label><small class="muted">Your browser reports about ' + lat + " ms of output delay.</small></div></div>" +
      '<div class="card"><b>Audio tracks</b><div id="trList">' + (at.map(function (t) { return '<div class="take"><label><input type="radio" name="arm" value="' + t.id + '"' + (armed === t.id ? " checked" : "") + '> Record here</label><input data-tn="' + t.id + '" value="' + esc(t.name) + '" style="flex:1;min-width:120px;width:auto;margin:0" maxlength="24"><small class="muted">' + P.takes.filter(function (x) { return x.track === t.id; }).length + ' takes</small><button class="alt" data-trdel="' + t.id + '">Remove</button></div>'; }).join("") || '<small class="muted">No audio tracks yet.</small>') + '</div><div class="row"><button class="alt" id="addTr">+ Add audio track</button><label class="note">Count-in <select id="cnt"><option value="0">none</option><option value="1" ' + (countBars === 1 ? "selected" : "") + '>1 bar</option><option value="2" ' + (countBars === 2 ? "selected" : "") + '>2 bars</option></select></label><button id="recBtn" style="color:#ff4d4d">● Record</button><button class="alt" id="recStop">■ Stop</button><span id="recSt" class="note"></span></div></div>' +
      '<div class="card"><b>Takes</b><div id="takeList"></div></div><div class="card"><b>Timeline</b> <small class="muted">— drag a clip to move it, tap it to trim or split</small><div id="tlAll" style="margin-top:6px"></div><div id="clipInsp"></div></div>';
    $("micOn").onclick = enableMic; $("micSel").onchange = function () { mic.id = this.value; rec.open(mic.id).then(attachMon).catch(micErr); };
    $("mon").onchange = function () { mic.monitor = this.checked; attachMon(); }; $("latms").onchange = function () { P.latency_ms = Math.max(0, Math.min(500, +this.value || 0)); touch(); };
    $("addTr").onclick = function () { if (!canEdit) return; var t = E.mkTrack("Vocals " + (audioTracks().length + 1), "audio"); P.tracks.push(t); armed = t.id; touch(); player.setProject(P); renderRec(); };
    qa('input[name="arm"]', el).forEach(function (r) { r.onchange = function () { armed = this.value; renderRec(); }; });
    qa("[data-tn]", el).forEach(function (i) { i.onchange = function () { var t = trackOf(i.dataset.tn); if (t && canEdit) { t.name = this.value.slice(0, 24) || t.name; touch(); } }; });
    qa("[data-trdel]", el).forEach(function (b) { b.onclick = function () { var id = b.dataset.trdel; if (!canEdit) return; if (P.clips.some(function (c) { return c.track === id; }) && !confirm("This track has clips on the timeline. Remove it anyway? The recordings stay saved in your takes list.")) return; P.tracks = P.tracks.filter(function (t) { return t.id !== id; }); P.clips = P.clips.filter(function (c) { return c.track !== id; }); touch(); renderRec(); }; });
    $("cnt").onchange = function () { countBars = +this.value; }; $("recBtn").onclick = startRecording; $("recStop").onclick = stopAll;
    takesList(); renderTimeline($("tlAll"), true); inspector(); setRecUi();
  }
  function setRecUi() { var b = $("bRec"), s = $("recSt"); if (b) b.textContent = recording ? "● REC…" : "● Rec"; if (s) s.textContent = recording ? "Recording… press Stop when you're done." : ""; }
  function micErr(e) { var m = e && e.name === "NotAllowedError" ? "Microphone permission was blocked. Allow it in your browser's address bar, then try again." : e && e.name === "NotFoundError" ? "No microphone was found. Plug one in and try again." : "Couldn't open the microphone: " + (e && e.message || e); PM.toast(m); mic.on = false; if (TAB === "rec") renderRec(); }
  function enableMic() { rec.open(mic.id).then(function () { mic.on = true; return navigator.mediaDevices.enumerateDevices(); }).then(function (d) { mic.devices = d.filter(function (x) { return x.kind === "audioinput"; }); if (!mic.id && mic.devices[0]) mic.id = mic.devices[0].deviceId; attachMon(); if (TAB === "rec") renderRec(); }).catch(micErr); }
  function attachMon() { try { if (mic.node) { mic.node.disconnect(); mic.node = null; } if (mic.monitor && rec.stream) { var ctx = player.ensure(); mic.node = ctx.createMediaStreamSource(rec.stream); mic.node.connect(ctx.destination); } } catch (e) { } }
  function startRecording() {
    if (!P || !canEdit) return PM.toast(canEdit ? "Open or create a project first" : "View-only project"); if (recording) return;
    if (!audioTracks().length) { var nt = E.mkTrack("Vocals 1", "audio"); P.tracks.push(nt); armed = nt.id; player.setProject(P); }
    if (!armed) armed = audioTracks()[0].id;
    var go = function () {
      if (!P.placements.length) { var pt = curPat(), len = pt.steps / 16; for (var b = 0; b + len <= P.bars; b += len) P.placements.push({ pat: pt.id, bar: b }); PM.toast("Placed your pattern on the timeline so your take lines up."); }
      mode = "song"; player.setProject(P); var ctx = player.ensure(); rec.begin(); var recAt = ctx.currentTime; var t0 = player.start("song", from, countBars * 4);
      recording = { track: armed, from: from, lead: Math.max(0, t0 - recAt) }; startAnim(); setRecUi();
    };
    if (rec.stream && rec.stream.active) go(); else rec.open(mic.id).then(function () { mic.on = true; attachMon(); return navigator.mediaDevices.enumerateDevices(); }).then(function (d) { mic.devices = d.filter(function (x) { return x.kind === "audioinput"; }); go(); }).catch(micErr);
  }
  function finishRecording() {
    var r = recording; recording = null; setRecUi(); if (!r) return;
    rec.end().then(function (blob) {
      if (!blob || blob.size < 500) { PM.toast("Nothing was recorded"); return; }
      var id = E.uid(); return E.store.put("blobs", id, { blob: blob, project: J.id, ts: Date.now() }).catch(function () { PM.toast("Couldn't keep a copy on this device. Save soon."); }).then(function () { return blob.arrayBuffer(); }).then(LAB.decode).then(function (buf) {
        var off = r.lead + (P.latency_ms || 0) / 1000, dur = Math.max(0.05, buf.duration - off); player.buffers[id] = buf;
        var tk = { id: id, track: r.track, name: "Take " + (P.takes.filter(function (x) { return x.track === r.track; }).length + 1), seconds: buf.duration, peaks: E.peaks(buf, 160), state: "local", mime: blob.type, at: Date.now() }; P.takes.push(tk);
        P.clips = P.clips.filter(function (c) { return !(c.track === r.track && Math.abs(c.start - r.from) < 0.01); }); // a new take replaces the clip at the same spot; older takes stay in the list
        var c = { id: E.uid(), track: r.track, take: id, start: r.from, off: off, dur: dur }; P.clips.push(c); selClip = c.id; touch(); localSave(); renderAll(); uploadTake(tk, blob);
      });
    }).catch(function (e) { PM.toast("Couldn't finish the recording: " + (e && e.message || e)); });
  }
  function uploadTake(tk, blob) {
    if (!J || !canEdit) return; S.uploading = (S.uploading || 0) + 1; tk.state = "uploading"; if (TAB === "rec") takesList();
    var ext = E.mimeExt(blob.type);
    return LAB.api({ action: "l_take_url", project_id: J.id, name: "take-" + tk.id + "." + ext, bytes: blob.size }).then(function (u) { return LAB.put(u.uploadUrl, blob, "take." + ext).then(function () { return LAB.api({ action: "l_take_save", project_id: J.id, file_ref: u.ref, track: tk.name, seconds: Math.round(tk.seconds * 100) / 100, mime: blob.type }); }); }).then(function (r) {
      tk.serverId = r.id; tk.state = "saved"; S.uploading--; E.store.del("blobs", tk.id).catch(function () { }); S.failedUploads = P.takes.filter(function (x) { return x.state === "failed" || x.state === "local"; }).length; touch(); save(); if (TAB === "rec") takesList();
    }).catch(function (e) { tk.state = "failed"; S.uploading--; S.failedUploads = P.takes.filter(function (x) { return x.state === "failed" || x.state === "local"; }).length; pill(); PM.toast("Recording kept on this device. " + (e.message || "")); if (TAB === "rec") takesList(); touch(); });
  }
  function takesList() {
    var el = $("takeList"); if (!el) return; var list = P.takes.filter(function (t) { return t.track === armed; });
    el.innerHTML = list.map(function (t) {
      var st = t.state === "saved" ? '<span class="badge g">saved to POTENT</span>' : t.state === "uploading" ? '<span class="badge w">uploading…</span>' : '<span class="badge w">only on this device</span> <button class="alt" data-rt="' + t.id + '">Retry</button>';
      return '<div class="take"><b>' + esc(t.name) + "</b><small class='muted'>" + fmtDur(t.seconds) + "</small>" + st + '<button class="alt" data-tp="' + t.id + '">▶</button><button class="alt" data-tu="' + t.id + '">Use on timeline</button><button class="alt" data-td="' + t.id + '" style="color:#e74c3c">Delete</button></div>'; }).join("") || '<small class="muted">No takes on this track yet.</small>';
    qa("[data-tp]", el).forEach(function (b) { b.onclick = function () { var buf = player.buffers[b.dataset.tp]; if (!buf) return PM.toast("Still loading"); var ctx = player.ensure(); E.playBuffer(ctx, ctx.destination, buf, ctx.currentTime, {}); }; });
    qa("[data-tu]", el).forEach(function (b) { b.onclick = function () { if (!canEdit) return; var t = takeOf(b.dataset.tu); P.clips = P.clips.filter(function (c) { return !(c.track === t.track && Math.abs(c.start - from) < 0.01); }); var c = { id: E.uid(), track: t.track, take: t.id, start: from, off: 0, dur: t.seconds }; P.clips.push(c); selClip = c.id; touch(); renderRec(); }; });
    qa("[data-td]", el).forEach(function (b) { b.onclick = function () { if (!canEdit || !confirm("Delete this take?")) return; var t = takeOf(b.dataset.td); P.clips = P.clips.filter(function (c) { return c.take !== t.id; }); P.takes = P.takes.filter(function (x) { return x.id !== t.id; }); delete player.buffers[t.id]; E.store.del("blobs", t.id).catch(function () { }); if (t.serverId) LAB.api({ action: "l_take_delete", project_id: J.id, id: t.serverId }).catch(function () { }); S.failedUploads = P.takes.filter(function (x) { return x.state === "failed" || x.state === "local"; }).length; touch(); renderRec(); }; });
    qa("[data-rt]", el).forEach(function (b) { b.onclick = function () { var t = takeOf(b.dataset.rt); E.store.get("blobs", t.id).then(function (v) { if (v && v.blob) uploadTake(t, v.blob); else PM.toast("The local copy is gone. Record it again."); }); }; });
  }
  function inspector() {
    var el = $("clipInsp"); if (!el) return; var c = P.clips.filter(function (x) { return x.id === selClip; })[0]; if (!c) { el.innerHTML = ""; return; }
    var tk = takeOf(c.take), same = P.takes.filter(function (x) { return x.track === c.track; });
    el.innerHTML = '<div class="card"><b>Clip</b> <small class="muted">' + esc(tk ? tk.name : "") + '</small><div class="row"><label class="note">Trim start (s)<input id="cOff" type="number" step="0.05" min="0" value="' + c.off.toFixed(2) + '" style="width:90px"></label><label class="note">Length (s)<input id="cDur" type="number" step="0.05" min="0.05" value="' + c.dur.toFixed(2) + '" style="width:90px"></label><label class="note">Take<select id="cTake">' + same.map(function (t) { return '<option value="' + t.id + '"' + (t.id === c.take ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join("") + '</select></label></div><div class="row"><button class="alt" id="cSplit">✂ Split at playhead</button><button class="alt" id="cDel" style="color:#e74c3c">Delete clip</button></div></div>';
    $("cOff").onchange = function () { if (!canEdit) return; var v = Math.max(0, Math.min(tk.seconds - 0.05, +this.value)); c.dur = Math.max(0.05, c.dur - (v - c.off)); c.off = v; touch(); renderRec(); };
    $("cDur").onchange = function () { if (!canEdit) return; c.dur = Math.max(0.05, Math.min(tk.seconds - c.off, +this.value)); touch(); renderRec(); };
    $("cTake").onchange = function () { if (!canEdit) return; var nt = takeOf(this.value); c.take = nt.id; c.off = 0; c.dur = nt.seconds; touch(); renderRec(); };
    $("cDel").onclick = function () { if (!canEdit) return; P.clips = P.clips.filter(function (x) { return x.id !== c.id; }); selClip = null; touch(); renderRec(); };
    $("cSplit").onclick = function () { if (!canEdit) return; var at = (from - c.start) * 60 / P.bpm; if (at <= 0.05 || at >= c.dur - 0.05) return PM.toast("Tap the ruler inside the clip first to place the playhead"); var c2 = { id: E.uid(), track: c.track, take: c.take, start: from, off: c.off + at, dur: c.dur - at }; c.dur = at; P.clips.push(c2); touch(); renderRec(); };
  }

  /* ---------- Mixer ---------- */
  function renderMix() {
    var el = $("p-mix"); if (!el) return;
    function strip(t) {
      var f = t.fx; return '<div class="strip"><b>' + esc(t.name) + '</b><div class="mt" data-mt="' + t.id + '"><i></i></div><label>Volume<input type="range" min="0" max="120" value="' + Math.round(t.vol * 100) + '" data-m="' + t.id + '" data-k="vol"></label><label>Pan<input type="range" min="-100" max="100" value="' + Math.round(t.pan * 100) + '" data-m="' + t.id + '" data-k="pan"></label><div class="row" style="margin:2px 0"><button class="' + (t.mute ? "" : "alt") + '" data-mu="' + t.id + '">M</button><button class="' + (t.solo ? "" : "alt") + '" data-so="' + t.id + '">S</button></div>' +
        '<details><summary>Effects</summary><label>Low EQ<input type="range" min="-12" max="12" value="' + f.lo + '" data-f="' + t.id + '" data-k="lo"></label><label>Mid EQ<input type="range" min="-12" max="12" value="' + f.mid + '" data-f="' + t.id + '" data-k="mid"></label><label>High EQ<input type="range" min="-12" max="12" value="' + f.hi + '" data-f="' + t.id + '" data-k="hi"></label><label><input type="checkbox" data-f="' + t.id + '" data-k="comp"' + (f.comp ? " checked" : "") + '> Compressor</label><label>Squeeze<input type="range" min="-50" max="0" value="' + f.thr + '" data-f="' + t.id + '" data-k="thr"></label><label>Reverb<input type="range" min="0" max="100" value="' + Math.round(f.rev * 100) + '" data-f="' + t.id + '" data-k="rev"></label><label>Delay<input type="range" min="0" max="100" value="' + Math.round(f.dly * 100) + '" data-f="' + t.id + '" data-k="dly"></label></details></div>';
    }
    el.innerHTML = '<div class="card"><b>Mixer</b> <small class="muted">— the meters move while the song plays</small><div class="strips">' + P.tracks.map(strip).join("") + '<div class="strip"><b>Master</b><div class="mt" data-mt="master"><i></i></div><label>Volume<input type="range" min="0" max="120" value="' + Math.round(P.master.vol * 100) + '" id="mV"></label><label>Delay time<select id="mD"><option value="0.25">1/16</option><option value="0.375">dotted 1/8</option><option value="0.5">1/8</option><option value="1">1/4</option></select></label><label>Delay feedback<input type="range" min="0" max="80" value="' + Math.round(P.master.fb * 100) + '" id="mF"></label></div></div></div>';
    qa("[data-m]", el).forEach(function (i) { i.oninput = function () { var t = trackOf(i.dataset.m); if (!canEdit) return; t[i.dataset.k] = i.dataset.k === "vol" ? this.value / 100 : this.value / 100; touch(); }; });
    qa("[data-f]", el).forEach(function (i) { i.oninput = i.onchange = function () { var t = trackOf(i.dataset.f), k = i.dataset.k; if (!canEdit) return; t.fx[k] = i.type === "checkbox" ? i.checked : (k === "rev" || k === "dly") ? this.value / 100 : +this.value; touch(); }; });
    qa("[data-mu]", el).forEach(function (b) { b.onclick = function () { var t = trackOf(b.dataset.mu); if (canEdit) { t.mute = !t.mute; touch(); renderMix(); } }; });
    qa("[data-so]", el).forEach(function (b) { b.onclick = function () { var t = trackOf(b.dataset.so); if (canEdit) { t.solo = !t.solo; touch(); renderMix(); } }; });
    $("mV").oninput = function () { if (canEdit) { P.master.vol = this.value / 100; touch(); } }; $("mD").value = String(P.master.dly); $("mD").onchange = function () { if (canEdit) { P.master.dly = +this.value; touch(); } }; $("mF").oninput = function () { if (canEdit) { P.master.fb = this.value / 100; touch(); } };
  }

  /* ---------- Project tab ---------- */
  function renderProj() {
    var el = $("p-proj"); if (!el) return;
    LAB.api({ action: "l_projects" }).then(function (r) {
      var list = r.mine.map(function (p) { return '<div class="snd"><div class="i"><b>' + esc(p.title) + '</b><small class="muted">' + esc(p.artist_name || "No artist yet") + " · v" + p.version + " · " + new Date(p.updated_at).toLocaleDateString() + (p.handed_off_at ? ' · <span class="badge g">sent to release</span>' : "") + '</small></div><button data-op="' + p.id + '">Open</button></div>'; }).join("") + r.shared.map(function (p) { return '<div class="snd"><div class="i"><b>' + esc(p.title) + '</b><small class="muted">Shared with you · ' + (p.can_edit ? "can edit" : "view only") + '</small></div><button class="alt" data-op="' + p.id + '">Open</button></div>'; }).join("");
      LAB.api({ action: "l_presets" }).then(function (pr) {
        var tpl = pr.presets.filter(function (x) { return x.kind === "template"; });
        var cur = J && P ? currentProjectHtml() : "";
        el.innerHTML = '<div class="card"><b>Projects</b>' + (list || '<div class="muted">No projects yet. Make your first one below.</div>') + '<div class="row"><input id="npT" placeholder="Project name" maxlength="100"><input id="npA" placeholder="Artist (optional)" maxlength="80"><select id="npTpl"><option value="">Blank</option>' + tpl.map(function (t) { return '<option value="' + t.id + '">' + esc(t.name) + "</option>"; }).join("") + '</select><button id="npGo">Create</button></div></div>' + cur;
        qa("[data-op]", el).forEach(function (b) { b.onclick = function () { if (J && rev !== savedRev) save().then(function () { openProject(b.dataset.op).then(function () { tab("beat"); }); }); else openProject(b.dataset.op).then(function () { tab("beat"); }); }; });
        $("npGo").onclick = function () { LAB.api({ action: "l_project_create", title: $("npT").value, artist_name: $("npA").value, template_id: $("npTpl").value || undefined }).then(function (n) { return openProject(n.id).then(function () { tab("beat"); }); }).catch(LAB.err); };
        if (J && P) bindProject(el);
      });
    }).catch(function (e) { el.innerHTML = '<div class="card">' + esc(e.message) + "</div>"; });
  }
  function currentProjectHtml() {
    var own = S.owner, dis = own ? "" : " disabled";
    return '<div class="card"><b>' + esc(J.title) + '</b> <small class="muted">version ' + J.version + (own ? "" : " · you are a collaborator") + '</small>' +
      '<div class="two"><label class="note">Project name<input id="dT" maxlength="100" value="' + esc(J.title) + '"' + dis + '></label><label class="note">Artist<input id="dA" maxlength="80" value="' + esc(J.artist_name || "") + '"' + dis + '></label><label class="note">Song title<input id="dS" maxlength="100" value="' + esc(J.song_title || "") + '"' + dis + '></label></div>' +
      '<label class="note">Session notes<textarea id="dN" rows="3" maxlength="4000"' + dis + ">" + esc(J.notes || "") + '</textarea></label><b style="font-size:14px">Production credits</b><div id="crd">' + (J.credits || []).map(function (c, i) { return '<div class="row"><input data-cn="' + i + '" value="' + esc(c.name) + '" placeholder="Name"' + dis + '><input data-cr="' + i + '" value="' + esc(c.role) + '" placeholder="Role (producer, engineer…)"' + dis + "></div>"; }).join("") + '</div><div class="row">' + (own ? '<button class="alt" id="crAdd">+ Credit</button><button id="dSave">Save details</button><button class="alt" id="shBtn">Invite collaborators</button><button class="alt" id="tplBtn">Save as template</button>' : "") + '</div><small class="muted">Credits and notes are records. Recording or exporting never changes ownership or revenue splits.</small></div>' +
      (own ? '<div class="card"><b>Link to a POTENT Music song</b><div class="row"><select id="lkSel"><option value="">Loading songs…</option></select><button id="lkGo">Link</button></div><small class="muted" id="lkSt">' + (J.music_project_id ? "Linked. Contributors and split sheets live on that song in Projects." : "Not linked yet. Create the song in Music → Projects first, then link it here.") + '</small></div>' : "") +
      '<div class="card"><b>Versions</b><div class="row"><input id="vN" placeholder="Note (optional)" maxlength="120"><button id="vSave">Save a version now</button></div><div id="vList" class="muted">Loading…</div></div>' +
      '<div class="card"><b>Export &amp; hand-off</b><div class="row"><label class="note"><input type="checkbox" id="xMono"> Mono (half the size)</label><button id="xGo">Render mix to WAV</button></div><div id="xOut" class="note"></div>' +
      (own ? '<div class="row"><button class="alt" id="xSave">Save export to this project</button><button class="alt" id="xHand">Send to the song’s release workflow</button></div><div class="row"><button class="alt" id="xMk">Mark ready to sell as an exclusive beat</button><button class="alt" id="xLive">Mark ready for live sessions</button></div><small class="muted">“Send to release workflow” saves this mix as the song’s final audio. Selling a beat still happens in Beat Man with the exclusive-sale agreement and the 1% fee. Live sessions still need the host to confirm performance rights.</small>' : "") + "</div>" +
      (own ? '<div class="card"><b>Beats you bought</b> <small class="muted">— bring a purchased exclusive master into this project as an audio track</small><div id="bought" class="muted">Loading…</div></div><div class="card"><button class="alt" id="arch" style="color:#e74c3c">Archive this project</button></div>' : "");
  }
  function bindProject(el) {
    var own = S.owner;
    qa("[data-cn],[data-cr]", el).forEach(function () { });
    if (own) {
      $("crAdd").onclick = function () { J.credits = (J.credits || []).concat([{ name: "", role: "" }]); renderProj(); };
      $("dSave").onclick = function () { var cr = (J.credits || []).map(function (c, i) { return { name: (q('[data-cn="' + i + '"]') || {}).value || "", role: (q('[data-cr="' + i + '"]') || {}).value || "" }; }); LAB.api({ action: "l_project_save", id: J.id, expect_version: J.version, title: $("dT").value, artist_name: $("dA").value, song_title: $("dS").value, notes: $("dN").value, credits: cr }).then(function (r) { J.version = r.version; J.title = $("dT").value; J.artist_name = $("dA").value; J.song_title = $("dS").value; J.notes = $("dN").value; J.credits = cr.filter(function (c) { return c.name; }); $("ptitle").textContent = J.title; PM.toast("Saved"); }).catch(LAB.err); };
      $("shBtn").onclick = function () { LAB.shareDialog("project", J.id, J.title); };
      $("tplBtn").onclick = function () { var n = prompt("Template name"); if (!n) return; var t = JSON.parse(JSON.stringify(P)); t.clips = []; t.takes = []; t.id = undefined; LAB.api({ action: "l_preset_save", name: n, kind: "template", data: t }).then(function () { PM.toast("Template saved"); }).catch(LAB.err); };
      LAB.api({ action: "l_my_songs" }).then(function (r) { var s = $("lkSel"); if (!s) return; s.innerHTML = '<option value="">No song</option>' + r.songs.map(function (x) { return '<option value="' + x.id + '"' + (x.id === J.music_project_id ? " selected" : "") + ">" + esc(x.title) + (x.mine ? "" : " (as contributor)") + "</option>"; }).join(""); });
      $("lkGo").onclick = function () { LAB.api({ action: "l_link", id: J.id, music_project_id: $("lkSel").value || null }).then(function () { J.music_project_id = $("lkSel").value || null; PM.toast(J.music_project_id ? "Linked" : "Unlinked"); renderProj(); }).catch(LAB.err); };
      $("xSave").onclick = saveExport; $("xHand").onclick = function () { if (!confirm("Save this mix as the song's final audio? Splits and ownership are not changed.")) return; LAB.api({ action: "l_handoff", id: J.id }).then(function (r) { PM.toast(r.note); renderProj(); }).catch(LAB.err); };
      $("xMk").onclick = function () { LAB.api({ action: "l_prep", id: J.id, target: "marketplace" }).then(function (r) { PM.toast(r.note); }).catch(LAB.err); }; $("xLive").onclick = function () { LAB.api({ action: "l_prep", id: J.id, target: "live" }).then(function (r) { PM.toast(r.note); }).catch(LAB.err); };
      $("arch").onclick = function () { if (confirm("Archive this project? You can still find it by asking support, but it leaves your list.")) LAB.api({ action: "l_project_archive", id: J.id }).then(function () { J = null; P = null; renderProj(); pill(); $("ptitle").textContent = "No project open"; }).catch(LAB.err); };
      boughtList();
    }
    $("xGo").onclick = renderMix2;
    $("vSave").onclick = function () { save(true, $("vN").value).then(versions); }; versions();
  }
  function versions() { LAB.api({ action: "l_versions", id: J.id }).then(function (r) { var l = $("vList"); if (!l) return; l.innerHTML = r.versions.map(function (v) { return '<div class="snd"><div class="i">v' + v.version + " <small class='muted'>" + new Date(v.created_at).toLocaleString() + (v.note ? " · " + esc(v.note) : "") + "</small></div>" + (canEdit ? '<button class="alt" data-vr="' + v.id + '">Restore</button>' : "") + "</div>"; }).join("") || "No saved versions yet."; qa("[data-vr]", l).forEach(function (b) { b.onclick = function () { if (!confirm("Replace what you have now with this version? Your current work will be kept as a version first.")) return; save(true, "before restore").then(function () { return LAB.api({ action: "l_versions", id: J.id, version_id: b.dataset.vr }); }).then(function (v) { P = clean(v.version.data); rev++; player.setProject(P); touch(); PM.toast("Restored"); renderAll(); }).catch(LAB.err); }; }); }).catch(function () { }); }
  var lastWav = null;
  function renderMix2() {
    var out = $("xOut"); out.textContent = "Rendering…"; if (!P.placements.length && !P.clips.length) out.innerHTML = '<span class="muted">Only the current pattern is on the timeline, so it exports as one loop. Fill the timeline to export the whole song.</span><br>';
    var pat = !(P.placements.length || P.clips.length); var prj = P;
    E.render(prj, player.buffers, 2).then(function (buf) {
      var mono = $("xMono").checked, ab = E.encodeWav(buf, mono), blob = new Blob([ab], { type: "audio/wav" }); lastWav = blob; var url = URL.createObjectURL(blob);
      out.innerHTML = (out.innerHTML.indexOf("Rendering") === 0 ? "" : out.innerHTML) + "Ready: " + fmtDur(buf.duration) + ", " + LAB.mb(blob.size) + ' (WAV). <a class="btn" download="' + esc((J.title || "mix").replace(/[^A-Za-z0-9 _-]/g, "")) + '.wav" href="' + url + '">Download</a>' + (blob.size > 50 * 1048576 ? ' <b>Too big to save in POTENT (50 MB limit). Tick Mono or shorten it. You can still download it.</b>' : "");
    }).catch(function (e) { out.textContent = "Couldn't render: " + (e && e.message || e); });
  }
  function saveExport() {
    if (!lastWav) return PM.toast("Render the mix first"); if (lastWav.size > 50 * 1048576) return PM.toast("Too big to save here. Tick Mono or shorten it.");
    LAB.api({ action: "l_export_url", project_id: J.id, name: "mix.wav", bytes: lastWav.size }).then(function (u) { return LAB.put(u.uploadUrl, lastWav, "mix.wav").then(function () { return LAB.api({ action: "l_export_save", project_id: J.id, file_ref: u.ref }); }); }).then(function () { J.export_ref = "set"; PM.toast("Export saved to this project"); }).catch(LAB.err);
  }
  function boughtList() {
    PM.api("music-api", { action: "me" }).then(function (m) { var l = $("bought"); if (!l) return; var beats = (m.library || []).filter(function (x) { return x.kind === "beat" && x.status === "complete"; }); l.innerHTML = beats.map(function (x) { return '<div class="snd"><div class="i"><b>' + esc(x.title) + '</b></div><button class="alt" data-bb="' + x.id + '" data-bt="' + esc(x.title) + '">Use in this project</button></div>'; }).join("") || "No completed beat purchases yet."; qa("[data-bb]", l).forEach(function (b) { b.onclick = function () { importBought(b.dataset.bb, b.dataset.bt); }; }); }).catch(function () { });
  }
  function importBought(id, title) { // goes through the normal download rules (limits, signed link), then becomes a take in this project
    if (!canEdit) return; PM.toast("Fetching your purchased beat…");
    PM.api("music-api", { action: "download", kind: "beat", id: id }).then(function (r) { return fetch(r.url); }).then(function (r) { if (!r.ok) throw new Error("Couldn't download it"); return r.blob(); }).then(function (blob) {
      var tid = E.uid(); return E.store.put("blobs", tid, { blob: blob, project: J.id, ts: Date.now() }).catch(function () { }).then(function () { return blob.arrayBuffer(); }).then(LAB.decode).then(function (buf) {
        var tr = E.mkTrack("Beat: " + String(title).slice(0, 16), "audio"); P.tracks.push(tr); player.buffers[tid] = buf; var tk = { id: tid, track: tr.id, name: title, seconds: buf.duration, peaks: E.peaks(buf, 160), state: "local", mime: blob.type || "audio/wav" }; P.takes.push(tk); P.clips.push({ id: E.uid(), track: tr.id, take: tid, start: 0, off: 0, dur: buf.duration }); touch(); localSave(); PM.toast("Added to the timeline on a new track"); uploadTake(tk, new Blob([blob], { type: blob.type || "audio/wav" }));
      });
    }).catch(LAB.err);
  }

  /* ---------- boot ---------- */
  function bind() {
    qa(".lab-tabs button").forEach(function (b) { b.onclick = function () { tab(b.dataset.t); }; });
    $("bPlayPat").onclick = function () { play("pat"); }; $("bPlaySong").onclick = function () { play("song"); }; $("bStop").onclick = stopAll;
    $("bRec").onclick = function () { tab("rec"); if (!recording) startRecording(); else stopAll(); };
    $("bSave").onclick = function () { save(true, "Manual save").then(function (ok) { if (ok) PM.toast("Saved to POTENT"); }); };
    $("pill").onclick = function () { if (S.failedUploads) tab("rec"); else if (rev !== savedRev) save(); };
    $("bpm").onchange = function () { if (!canEdit || !P) return; P.bpm = Math.max(40, Math.min(300, +this.value || 120)); this.value = P.bpm; touch(); };
    $("metro").onchange = function () { if (P) { P.metro = this.checked; if (canEdit) touch(); } };
    document.addEventListener("keydown", function (e) { if (e.target && /input|select|textarea/i.test(e.target.tagName)) return; if (e.code === "Space") { e.preventDefault(); player.playing ? stopAll() : play(mode); } });
  }
  function gate(msg) { var g = $("gate"); g.style.display = "block"; g.innerHTML = msg; $("lab").style.display = "none"; }
  function boot() {
    if (!window.AudioContext && !window.webkitAudioContext) return gate("This browser can't run Beat Lab. Try a recent Chrome, Edge, Firefox or Safari.");
    PM.need(function () {
      LAB.api({ action: "l_me" }).then(function (m) {
        if (!m.engineer) return gate("<b>Beat Lab is for POTENT engineers.</b><div class='muted'>Your account isn't set up as an engineer yet. Ask POTENT to add " + esc(PM.me && PM.me.user ? PM.me.user.email : "your account") + ".</div>");
        $("gate").style.display = "none"; $("lab").style.display = "block"; S.quota = m.quota_bytes; S.used = m.used_bytes; bind();
        var last = null; try { last = localStorage.getItem("lab_last"); } catch (e) { }
        LAB.refreshPacks().then(function () { LAB.renderSounds(); });
        (last ? openProject(last).then(function () { if (!J) return tab("proj"); tab("beat"); }) : Promise.resolve(tab("proj"))).catch(function () { tab("proj"); });
      }).catch(function (e) { gate(esc(e.message)); });
    });
  }
  window.LABUI = { tab: tab, open: openProject };
  if (document.readyState !== "loading") boot(); else document.addEventListener("DOMContentLoaded", boot);
})();
