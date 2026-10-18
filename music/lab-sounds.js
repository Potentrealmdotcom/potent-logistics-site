/* Beat Lab: Sound Browser, uploads and pack management. Shares the LAB object with lab.js. */
(function () {
  var PM = window.PM, esc = PM.esc, $ = PM.$;
  var LAB = window.LAB = { S: { bufs: {}, urls: {}, scope: "mine", kind: "", q: "", view: "sounds", list: [], packs: { mine: [], shared: [], public: [] }, quota: 0, used: 0 } };
  var S = LAB.S;
  LAB.api = function (b) { return PM.api("music-lab", b); };
  LAB.err = function (e) { PM.toast(e && e.message ? e.message : "Something went wrong"); };
  LAB.put = function (url, blob, name) { var fd = new FormData(); fd.append("cacheControl", "3600"); fd.append("", blob, name || "file"); return fetch(url, { method: "PUT", body: fd }).then(function (r) { if (!r.ok) throw new Error("Upload failed. Check your connection and try again."); }); };
  LAB.mb = function (n) { return (n / 1048576).toFixed(n > 1e8 ? 0 : 1) + " MB"; };
  LAB.decode = function (arrayBuf) { var ctx = LAB.player.ensure(); return new Promise(function (res, rej) { var pr = ctx.decodeAudioData(arrayBuf, res, rej); if (pr && pr.catch) pr.catch(function () { }); }); };
  LAB.assetBuffer = function (id) {
    if (S.bufs[id]) return Promise.resolve(S.bufs[id]);
    return LAB.api({ action: "l_asset_url", id: id }).then(function (j) { S.urls[id] = j.asset; return fetch(j.url); }).then(function (r) { if (!r.ok) throw new Error("Could not load that sound"); return r.arrayBuffer(); }).then(LAB.decode).then(function (b) { S.bufs[id] = b; return b; });
  };
  var prev = null;
  LAB.preview = function (id) {
    LAB.assetBuffer(id).then(function (b) { var ctx = LAB.player.ensure(); if (prev) { try { prev.stop(); } catch (e) { } } var s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = b; g.gain.value = 0.9; s.connect(g); g.connect(ctx.destination); s.start(); prev = s; }).catch(LAB.err);
  };
  var KINDS = ["drum", "808", "loop", "sample", "melody", "vocal", "fx", "preset", "other"];
  var PERM = { original: "I made it", licensed: "I hold a licence", cleared: "Cleared in writing", unverified: "Not confirmed" };
  function opts(list, cur, labels) { return list.map(function (k) { return '<option value="' + esc(k) + '"' + (k === cur ? " selected" : "") + ">" + esc(labels ? labels[k] : k) + "</option>"; }).join(""); }

  LAB.renderSounds = function () {
    var el = $("p-sounds"); if (!el) return;
    var meter = S.quota ? '<div class="note">Storage ' + LAB.mb(S.used) + " of " + LAB.mb(S.quota) + "</div>" : "";
    el.innerHTML = '<h2 style="margin-top:0">Sound Browser</h2><div class="tabs">' + [["sounds", "Sounds"], ["packs", "Packs"]].map(function (t) { return '<button data-v="' + t[0] + '"' + (S.view === t[0] ? ' class="on"' : "") + ">" + t[1] + "</button>"; }).join("") + '</div>' + meter + '<div id="sbody"></div>';
    [].forEach.call(el.querySelectorAll("[data-v]"), function (b) { b.onclick = function () { S.view = b.dataset.v; LAB.renderSounds(); }; });
    (S.view === "packs" ? packsView : soundsView)($("sbody"));
  };

  function soundsView(body) {
    body.innerHTML = '<div class="tabs">' + [["mine", "Mine"], ["shared", "Shared with me"], ["public", "Public packs"]].map(function (t) { return '<button data-s="' + t[0] + '"' + (S.scope === t[0] ? ' class="on"' : "") + ">" + t[1] + "</button>"; }).join("") + '</div>' +
      '<div class="row"><input id="sq" placeholder="Search name, tag, key…" value="' + esc(S.q) + '"><select id="sk"><option value="">All types</option>' + opts(KINDS, S.kind) + '</select></div>' +
      '<div class="row"><button id="supl">⬆ Upload sounds</button><button class="alt" id="sdef">Built-in drums</button></div><div id="slist" class="muted" style="margin-top:8px">Loading…</div>';
    [].forEach.call(body.querySelectorAll("[data-s]"), function (b) { b.onclick = function () { S.scope = b.dataset.s; LAB.renderSounds(); }; });
    var t = null; $("sq").oninput = function () { S.q = this.value; clearTimeout(t); t = setTimeout(load, 250); }; $("sk").onchange = function () { S.kind = this.value; load(); };
    $("supl").onclick = uploadDialog; $("sdef").onclick = function () { LAB.builtinDialog(); };
    load();
    function load() {
      LAB.api({ action: "l_assets", scope: S.scope, q: S.q, kind: S.kind }).then(function (j) {
        S.list = j.assets; var l = $("slist"); if (!l) return;
        l.innerHTML = j.assets.length ? j.assets.map(row).join("") : (S.scope === "mine" ? "No sounds yet. Upload your first one." : "Nothing here yet.");
        [].forEach.call(l.querySelectorAll("[data-pv]"), function (b) { b.onclick = function () { LAB.preview(b.dataset.pv); }; });
        [].forEach.call(l.querySelectorAll("[data-ar]"), function (b) { b.onclick = function () { LAB.addRowFromAsset(b.dataset.ar); }; });
        [].forEach.call(l.querySelectorAll("[data-ak]"), function (b) { b.onclick = function () { LAB.setInstFromAsset(b.dataset.ak); }; });
        [].forEach.call(l.querySelectorAll("[data-ed]"), function (b) { b.onclick = function () { editDialog(b.dataset.ed); }; });
      }).catch(function (e) { var l = $("slist"); if (l) l.textContent = e.message; });
    }
  }
  function row(a) {
    var perm = a.permission_status === "unverified" ? '<span class="badge w">permission not confirmed</span>' : '<span class="badge g">' + esc(PERM[a.permission_status]) + "</span>";
    return '<div class="snd"><button class="alt" data-pv="' + a.id + '" aria-label="Preview ' + esc(a.name) + '">▶</button><div class="i"><b>' + esc(a.name) + '</b><small class="muted"><span class="badge">' + esc(a.kind) + "</span>" + (a.bpm ? '<span class="badge">' + a.bpm + " bpm</span>" : "") + (a.musical_key ? '<span class="badge">' + esc(a.musical_key) + "</span>" : "") + perm + (a.commercial_ok ? '<span class="badge g">commercial OK</span>' : "") + "</small></div>" +
      '<button data-ar="' + a.id + '" title="Add as a row in the step sequencer">+ Beat</button><button class="alt" data-ak="' + a.id + '" title="Play it from the piano roll">+ Keys</button>' + (S.scope === "mine" ? '<button class="alt" data-ed="' + a.id + '" aria-label="Manage ' + esc(a.name) + '">⋯</button>' : "") + "</div>";
  }

  LAB.builtinDialog = function () {
    PM.dialog('<h2 style="margin:0 0 6px">Built-in drums</h2><small class="muted">Generated in your browser, so they are always yours to use. Add one as a new row.</small><div class="two" style="margin-top:8px">' + LabEngine.DRUMS.map(function (d) { return '<button class="alt" data-d="' + d + '">+ ' + d + "</button>"; }).join("") + "</div>", function (r) { [].forEach.call(r.querySelectorAll("[data-d]"), function (b) { b.onclick = function () { LAB.addBuiltinRow(b.dataset.d); PM.close(); }; }); });
  };

  function metaFields(a, forUpload) {
    a = a || {};
    return '<label class="note">Type<select id="mk">' + opts(KINDS, a.kind || "sample") + '</select></label><div class="two"><label class="note">BPM<input id="mb" type="number" min="20" max="400" value="' + esc(a.bpm || "") + '"></label><label class="note">Key<input id="mke" placeholder="Am, F#m…" maxlength="12" value="' + esc(a.musical_key || "") + '"></label></div>' +
      '<div class="two"><label class="note">Genre<input id="mg" maxlength="40" value="' + esc(a.genre || "") + '"></label><label class="note">Tags (comma separated)<input id="mt" value="' + esc((a.tags || []).join(", ")) + '"></label></div>' +
      '<label class="note">Pack<select id="mp"><option value="">No pack</option>' + S.packs.mine.map(function (p) { return '<option value="' + p.id + '"' + (a.pack_id === p.id ? " selected" : "") + ">" + esc(p.name) + "</option>"; }).join("") + '</select></label>' +
      '<label class="note">Permission<select id="mpe">' + opts(Object.keys(PERM), a.permission_status || "unverified", PERM) + '</select></label>' +
      '<label class="note">Licence / who allowed it<input id="ml" maxlength="600" placeholder="e.g. All original, made by me" value="' + esc(a.license || "") + '"></label>' +
      '<label class="note">Where it came from<input id="ms" maxlength="300" value="' + esc(a.source || "") + '"></label><label class="note">Usage limits<input id="mr" maxlength="500" placeholder="e.g. not for resale as a sample pack" value="' + esc(a.restrictions || "") + '"></label>' +
      '<label class="note"><input type="checkbox" id="mc"' + (a.commercial_ok ? " checked" : "") + '> Commercially usable (only if the licence above really allows it)</label>';
  }
  function readMeta() { return { kind: $("mk").value, bpm: $("mb").value, musical_key: $("mke").value, genre: $("mg").value, tags: $("mt").value, pack_id: $("mp").value || null, permission_status: $("mpe").value, license: $("ml").value, source: $("ms").value, restrictions: $("mr").value, commercial_ok: $("mc").checked }; }

  function refreshPacks() { return LAB.api({ action: "l_overview" }).then(function (j) { S.packs = { mine: j.mine, shared: j.shared, public: j.public }; S.used = j.used_bytes; S.quota = j.quota_bytes; }); }
  LAB.refreshPacks = refreshPacks;

  function uploadDialog() {
    refreshPacks().then(function () {
      PM.dialog('<h2 style="margin:0 0 6px">Upload sounds</h2><small class="muted">WAV, MP3, M4A, FLAC, OGG or AIFF, up to 50 MB each. Uploads stay private until you decide otherwise.</small><input id="uf" type="file" multiple accept="audio/*,.wav,.mp3,.m4a,.flac,.ogg,.aif,.aiff,.aac">' + metaFields(null, true) +
        '<label class="note" style="display:block;margin-top:8px"><input type="checkbox" id="uat"> I made these sounds or I have the right to use them. I am not uploading other people\'s material without permission.</label><div class="row"><button id="ugo">Upload</button></div><div id="ust" class="note"></div>', function () {
        $("ugo").onclick = function () {
          var files = [].slice.call($("uf").files); if (!files.length) return PM.toast("Choose at least one file"); if (!$("uat").checked) return PM.toast("Please tick the box about permission");
          var done = 0, m = readMeta(); $("ugo").disabled = true;
          (function next() {
            var f = files.shift(); if (!f) { $("ust").textContent = "Done: " + done + " uploaded."; $("ugo").disabled = false; LAB.renderSounds(); return; }
            $("ust").textContent = "Uploading " + f.name + "…";
            LAB.api({ action: "l_upload_url", name: f.name, bytes: f.size }).then(function (u) {
              return LAB.put(u.uploadUrl, f, f.name).then(function () { return u.ref; });
            }).then(function (ref) { return LAB.api(Object.assign({ action: "l_asset_save", file_ref: ref, name: f.name.replace(/\.[^.]+$/, ""), attest: true }, m)); }).then(function () { done++; next(); }).catch(function (e) { $("ust").textContent = e.message; PM.toast(e.message); $("ugo").disabled = false; });
          })();
        };
      });
    }).catch(LAB.err);
  }

  function editDialog(id) {
    var a = S.list.filter(function (x) { return x.id === id; })[0]; if (!a) return;
    PM.dialog('<h2 style="margin:0 0 6px">' + esc(a.name) + '</h2><label class="note">Name<input id="en" maxlength="100" value="' + esc(a.name) + '"></label>' + metaFields(a) + '<div class="row"><button id="esv">Save</button><button class="alt" id="erp">Replace file</button><button class="alt" id="ear">Archive</button><button class="alt" id="edl" style="color:#e74c3c">Delete</button></div><input id="erf" type="file" accept="audio/*" style="display:none">', function () {
      $("esv").onclick = function () { LAB.api(Object.assign({ action: "l_asset_save", id: id, name: $("en").value }, readMeta())).then(function () { PM.close(); LAB.renderSounds(); }).catch(LAB.err); };
      $("ear").onclick = function () { LAB.api({ action: "l_asset_archive", id: id }).then(function () { PM.close(); LAB.renderSounds(); }).catch(LAB.err); };
      $("edl").onclick = function () { if (confirm("Delete this sound for good? Projects that use it will go quiet on that row.")) LAB.api({ action: "l_asset_delete", id: id }).then(function () { delete S.bufs[id]; PM.close(); LAB.renderSounds(); }).catch(LAB.err); };
      $("erp").onclick = function () { $("erf").click(); };
      $("erf").onchange = function () {
        var f = this.files[0]; if (!f) return;
        LAB.api({ action: "l_upload_url", name: f.name, bytes: f.size }).then(function (u) { return LAB.put(u.uploadUrl, f, f.name).then(function () { return LAB.api({ action: "l_asset_replace", id: id, file_ref: u.ref }); }); }).then(function () { delete S.bufs[id]; PM.toast("File replaced"); PM.close(); LAB.renderSounds(); }).catch(LAB.err);
      };
    });
  }

  function packsView(body) {
    body.innerHTML = '<div class="row"><button id="pnew">+ New pack</button></div><div id="plist" class="muted" style="margin-top:8px">Loading…</div>';
    $("pnew").onclick = function () { packDialog(null); };
    refreshPacks().then(function () {
      var h = ""; function sec(t, l, own) { if (!l.length) return ""; return "<h3 style='margin:12px 0 4px;font-size:15px'>" + t + "</h3>" + l.map(function (p) { return '<div class="snd"><div class="i"><b>' + esc(p.name) + '</b><small class="muted"><span class="badge">' + esc(p.visibility.replace("_", " ")) + "</span>" + (p.commercial_ok ? '<span class="badge g">commercial OK</span>' : '<span class="badge">not marked commercial</span>') + (p.license ? " " + esc(p.license).slice(0, 60) : "") + "</small></div>" + (own ? '<button class="alt" data-pe="' + p.id + '">Manage</button>' : "") + "</div>"; }).join(""); }
      h = sec("My packs", S.packs.mine, true) + sec("Shared with me", S.packs.shared, false) + sec("Public (approved)", S.packs.public, false);
      $("plist").innerHTML = h || "No packs yet. A pack groups sounds and holds their licence, e.g. “POTENT 808 Collection”.";
      [].forEach.call($("plist").querySelectorAll("[data-pe]"), function (b) { b.onclick = function () { packDialog(S.packs.mine.filter(function (p) { return p.id === b.dataset.pe; })[0]); }; });
    }).catch(function (e) { $("plist").textContent = e.message; });
  }
  function packDialog(p) {
    p = p || {};
    PM.dialog('<h2 style="margin:0 0 6px">' + (p.id ? "Manage pack" : "New pack") + '</h2><label class="note">Name<input id="pn" maxlength="80" value="' + esc(p.name || "") + '"></label><label class="note">Description<input id="pd" maxlength="600" value="' + esc(p.description || "") + '"></label>' +
      '<label class="note">Licence for this pack<input id="pl" maxlength="600" placeholder="e.g. All sounds original, made by me" value="' + esc(p.license || "") + '"></label><label class="note">Source<input id="ps" maxlength="300" value="' + esc(p.source || "") + '"></label><label class="note">Usage limits<input id="pr" maxlength="600" value="' + esc(p.restrictions || "") + '"></label>' +
      '<label class="note"><input type="checkbox" id="pc"' + (p.commercial_ok ? " checked" : "") + '> Commercially usable (needs a written licence and every sound confirmed)</label>' +
      '<label class="note">Who can see it<select id="pv"><option value="private">Only me</option><option value="shared"' + (p.visibility === "shared" ? " selected" : "") + '>People I share it with</option><option value="public_requested"' + (/^public/.test(p.visibility || "") ? " selected" : "") + '>Ask POTENT to make it public to engineers</option></select></label><small class="muted">Public means other POTENT engineers can use it in Beat Lab. It never lists anything in the store. ' + (p.visibility === "public" ? "<b>Approved.</b> Editing it asks for approval again." : p.visibility === "public_requested" ? "<b>Waiting for approval.</b>" : "") + '</small>' +
      '<div class="row"><button id="psv">Save</button>' + (p.id ? '<button class="alt" id="psh">Share…</button><button class="alt" id="par">Archive</button>' : "") + "</div>", function () {
      $("psv").onclick = function () { LAB.api({ action: "l_pack_save", id: p.id, name: $("pn").value, description: $("pd").value, license: $("pl").value, source: $("ps").value, restrictions: $("pr").value, commercial_ok: $("pc").checked, visibility: $("pv").value }).then(function () { PM.close(); LAB.renderSounds(); }).catch(LAB.err); };
      if (p.id) {
        $("par").onclick = function () { LAB.api({ action: "l_pack_archive", id: p.id }).then(function () { PM.close(); LAB.renderSounds(); }).catch(LAB.err); };
        $("psh").onclick = function () { shareDialog("pack", p.id, p.name); };
      }
    });
  }
  LAB.shareDialog = shareDialog;
  function shareDialog(kind, id, name) {
    LAB.api({ action: "l_shares", id: id }).then(function (j) {
      PM.dialog('<h2 style="margin:0 0 6px">Share “' + esc(name) + '”</h2><small class="muted">' + (kind === "pack" ? "Packs can be shared with other POTENT engineers." : "Collaborators can open the project. Give edit access only to people you trust.") + '</small><div class="row"><input id="se" type="email" placeholder="their Music account email">' + (kind === "project" ? '<label class="note"><input type="checkbox" id="sed"> can edit</label>' : "") + '<button id="sgo">Share</button></div><div id="sl">' + (j.shares.map(function (s) { return '<div class="snd"><div class="i">' + esc(s.name || s.email) + ' <small class="muted">' + esc(s.email) + (s.can_edit ? " · can edit" : "") + '</small></div><button class="alt" data-rm="' + esc(s.email) + '">Remove</button></div>'; }).join("") || '<small class="muted">Not shared with anyone.</small>') + "</div>", function (r) {
        $("sgo").onclick = function () { LAB.api({ action: "l_share", kind: kind, id: id, email: $("se").value, can_edit: kind === "project" && $("sed").checked }).then(function () { shareDialog(kind, id, name); }).catch(LAB.err); };
        [].forEach.call(r.querySelectorAll("[data-rm]"), function (b) { b.onclick = function () { LAB.api({ action: "l_share", kind: kind, id: id, email: b.dataset.rm, remove: true }).then(function () { shareDialog(kind, id, name); }).catch(LAB.err); }; });
      });
    }).catch(LAB.err);
  }
})();
