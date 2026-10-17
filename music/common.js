/* POTENT Music shared UI: API, buyer login, persistent player, cards, buy / video / report / playlist dialogs. */
(function () {
  var API = "/.netlify/functions/";
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function usd(c) { return "$" + (c / 100).toFixed(2).replace(/\.00$/, ""); }
  function $(i) { return document.getElementById(i); }
  var PM = window.PM = { esc: esc, usd: usd, $: $, tracks: {}, products: {}, videos: {}, me: null, queue: [], qi: -1 };
  function gt() { try { return localStorage.getItem("pmu") || ""; } catch (e) { return ""; } }
  function st(t) { try { if (t) localStorage.setItem("pmu", t); else localStorage.removeItem("pmu"); } catch (e) { } }
  PM.token = gt; PM.setToken = st;
  var GETS = { home: 1, browse: 1, artist: 1 };
  PM.api = function (fn, b, token) {
    if (token === "" && fn === "music-api" && GETS[b.action]) { // public reads use GET so the CDN can cache them
      var qs = Object.keys(b).filter(function (k) { return b[k] !== "" && b[k] != null; }).map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(b[k]); }).join("&");
      return fetch(API + fn + "?" + qs).then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || "Something went wrong"); e.status = r.status; throw e; } return j; }); });
    }
    var h = { "Content-Type": "application/json" }, t = token === undefined ? gt() : token; if (t) h.Authorization = "Bearer " + t;
    return fetch(API + fn, { method: "POST", headers: h, body: JSON.stringify(b) }).then(function (r) { return r.json().then(function (j) { if (!r.ok) { var e = new Error(j.error || "Something went wrong"); e.status = r.status; throw e; } return j; }); });
  };
  PM.toast = function (m) { var t = $("pmtoast"); if (!t) { t = document.createElement("div"); t.id = "pmtoast"; t.setAttribute("role", "status"); t.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#e8ff1a;color:#111;padding:10px 16px;border-radius:99px;font-weight:700;z-index:99;display:none;max-width:90%"; document.body.appendChild(t); } t.textContent = m; t.style.display = "block"; clearTimeout(t._h); t._h = setTimeout(function () { t.style.display = "none"; }, 2600); };

  /* ---------- dialog ---------- */
  PM.dialog = function (html, onMount) {
    var d = $("pmdlg"); if (!d) { d = document.createElement("div"); d.id = "pmdlg"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.75);display:none;align-items:center;justify-content:center;padding:14px;z-index:90"; d.innerHTML = '<div id="pmdb" style="background:var(--panel);color:var(--ink);border:1px solid var(--line);border-radius:16px;padding:18px;max-width:520px;width:100%;max-height:92vh;overflow:auto"></div>'; d.onclick = function (e) { if (e.target === d) PM.close(); }; document.body.appendChild(d); }
    $("pmdb").innerHTML = html + '<button class="alt" data-x style="width:100%;margin-top:12px">Close</button>'; d.style.display = "flex";
    $("pmdb").querySelector("[data-x]").onclick = PM.close; if (onMount) onMount($("pmdb"));
  };
  PM.close = function () { var d = $("pmdlg"); if (d) d.style.display = "none"; var v = $("pmdb"); if (v) v.innerHTML = ""; };

  /* ---------- buyer account ---------- */
  PM.loadMe = function () { if (!gt()) { PM.me = null; return Promise.resolve(null); } return PM.api("music-api", { action: "me" }).then(function (j) { PM.me = j; return j; }).catch(function () { st(""); PM.me = null; return null; }); };
  PM.login = function (after) {
    PM.dialog('<h2 style="margin:0 0 8px">Sign in or create an account</h2><small class="muted">An account keeps your purchases, downloads, favorites and playlists in one place.</small><input id="lem" type="email" placeholder="Email" autocomplete="email"><input id="lpw" type="password" placeholder="Password (10+ characters)" autocomplete="current-password"><input id="lnm" placeholder="Your name (new accounts)"><label class="ck"><input type="checkbox" id="lop" style="width:auto"> <span>Email me about new music (optional)</span></label><div class="row"><button id="lgo">Sign in</button><button class="alt" id="lre">Create account</button></div><div class="err" id="ler" style="color:#e74c3c;min-height:20px"></div>', function (m) {
      function go(a) { PM.api("music-api", { action: a, email: $("lem").value, password: $("lpw").value, name: $("lnm").value, marketing_opt_in: $("lop").checked }, "").then(function (j) { st(j.token); return PM.loadMe(); }).then(function () { PM.close(); PM.toast("Signed in"); if (PM.onAuth) PM.onAuth(); if (after) after(); }).catch(function (e) { $("ler").textContent = e.message; }); }
      $("lgo").onclick = function () { go("login"); }; $("lre").onclick = function () { go("register"); };
    });
  };
  PM.need = function (fn) { if (gt() && PM.me) return fn(); PM.loadMe().then(function (m) { if (m) fn(); else PM.login(fn); }); };
  PM.isFav = function (k, id) { return !!(PM.me && PM.me.favorites.some(function (f) { return f.kind === k && f.item_id === id; })); };
  PM.isFollow = function (id) { return !!(PM.me && PM.me.follows.some(function (f) { return f.producer_id === id; })); };

  /* ---------- player ---------- */
  var au = new Audio(); au.preload = "none"; PM.audio = au; var counted = {};
  function bar() {
    if ($("pmbar")) return; var d = document.createElement("div"); d.id = "pmbar";
    d.style.cssText = "position:fixed;left:0;right:0;bottom:0;background:var(--panel);border-top:1px solid var(--line);padding:8px 12px;display:none;z-index:50";
    d.innerHTML = '<div style="max-width:980px;margin:0 auto;display:flex;gap:10px;align-items:center"><button class="alt" id="pmpv" aria-label="Previous">⏮</button><button id="pmpp" aria-label="Play or pause">▶</button><button class="alt" id="pmnx" aria-label="Next">⏭</button><div style="flex:0 1 200px;min-width:0"><b id="pmtt" style="display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis"></b><small id="pmar" class="muted"></small></div><div id="pmpb" style="flex:1;height:6px;background:var(--line);border-radius:4px;cursor:pointer;overflow:hidden"><div id="pmpf" style="height:100%;width:0;background:var(--gold)"></div></div><small id="pmtm" class="muted">0:00</small><input id="pmvl" type="range" min="0" max="100" value="100" aria-label="Volume" style="width:70px;padding:0"></div>';
    document.body.appendChild(d); document.body.style.paddingBottom = "90px";
    $("pmpp").onclick = function () { if (PM.qi < 0) return; au.paused ? au.play() : au.pause(); };
    $("pmnx").onclick = function () { PM.step(1); }; $("pmpv").onclick = function () { PM.step(-1); };
    $("pmpb").onclick = function (e) { if (au.duration) { var r = this.getBoundingClientRect(); au.currentTime = (e.clientX - r.left) / r.width * au.duration; } };
    $("pmvl").oninput = function () { au.volume = this.value / 100; };
  }
  function fmt(t) { if (!isFinite(t)) return "0:00"; return Math.floor(t / 60) + ":" + ("0" + Math.floor(t % 60)).slice(-2); }
  au.onplay = au.onpause = function () { if ($("pmpp")) $("pmpp").textContent = au.paused ? "▶" : "⏸"; if (PM.onPlayState) PM.onPlayState(); };
  au.ontimeupdate = function () { if ($("pmpf")) { $("pmpf").style.width = (au.duration ? au.currentTime / au.duration * 100 : 0) + "%"; $("pmtm").textContent = fmt(au.currentTime) + " / " + fmt(au.duration); } };
  au.onended = function () { PM.step(1); };
  PM.playTrack = function (id, list) {
    var t = PM.tracks[id]; if (!t || !t.audio_url) return; bar();
    if (list) PM.queue = list.slice();
    PM.qi = PM.queue.indexOf(id); if (PM.qi < 0) { PM.queue = [id]; PM.qi = 0; }
    if (au.src && PM.current === id) { au.paused ? au.play() : au.pause(); return; }
    PM.current = id; au.src = t.audio_url; $("pmtt").textContent = t.title; $("pmar").textContent = t.artist || ""; $("pmbar").style.display = "block"; au.play();
    if (!counted[id]) { counted[id] = 1; PM.api("music-api", { action: "track_play", id: id }, "").catch(function () { }); }
  };
  PM.step = function (d) { if (!PM.queue.length) return; var i = PM.qi; for (var n = 0; n < PM.queue.length; n++) { i = (i + d + PM.queue.length) % PM.queue.length; if (PM.tracks[PM.queue[i]]) { PM.current = null; PM.playTrack(PM.queue[i]); return; } } };

  /* ---------- cards ---------- */
  PM.trackRow = function (t) {
    PM.tracks[t.id] = t; var on = PM.current === t.id && !au.paused;
    return '<div class="beat"><div class="cv" style="' + (t.cover_url ? 'background-image:url(' + esc(t.cover_url) + ')' : '') + '"><button class="play" data-play="' + t.id + '" aria-label="Play ' + esc(t.title) + '">' + (on ? "⏸" : "▶") + '</button></div><div class="bi"><b>' + esc(t.title) + (t.explicit ? ' <span class="st">E</span>' : '') + ' <span class="st">Free stream</span></b><small class="muted"><a href="/music/artist.html?s=' + esc(t.slug || "") + '">' + esc(t.artist || "") + '</a>' + (t.genre ? ' · ' + esc(t.genre) : '') + (t.plays ? ' · ' + t.plays + ' plays' : '') + '</small></div><button class="fav' + (PM.isFav("track", t.id) ? ' on' : '') + '" data-fav="track:' + t.id + '" aria-label="Favorite">♥</button><button class="alt" data-add="' + t.id + '" aria-label="Add to playlist">＋</button><button class="alt" data-rep="track:' + t.id + '" aria-label="Report" title="Report">⚑</button></div>';
  };
  PM.productCard = function (p) {
    PM.products[p.id] = p; var out = p.left === 0;
    return '<div class="pc"><div class="pcv" style="' + (p.cover_url ? 'background-image:url(' + esc(p.cover_url) + ')' : '') + '"></div><b>' + esc(p.title) + '</b><small class="muted">' + esc(p.kind.replace("_", " ")) + ' · <a href="/music/artist.html?s=' + esc(p.slug || "") + '">' + esc(p.artist || "") + '</a></small>' + (p.left != null ? '<small class="muted">' + (out ? 'Sold out' : p.left + ' left') + '</small>' : '') + '<div class="row"><button data-prod="' + p.id + '"' + (out ? ' disabled' : '') + '>' + usd(p.price_cents) + ' · Details</button><button class="fav' + (PM.isFav("product", p.id) ? ' on' : '') + '" data-fav="product:' + p.id + '" aria-label="Favorite">♥</button></div></div>';
  };
  PM.videoCard = function (v) {
    PM.videos[v.id] = v; return '<div class="pc"><div class="pcv" style="' + (v.thumb_url ? 'background-image:url(' + esc(v.thumb_url) + ')' : '') + '"><button class="play" data-vid="' + v.id + '" aria-label="Play video">▶</button></div><b>' + esc(v.title) + '</b><small class="muted"><a href="/music/artist.html?s=' + esc(v.slug || "") + '">' + esc(v.artist || "") + '</a> · ' + (v.views || 0) + ' views</small></div>';
  };
  PM.artistCard = function (a) { return '<a class="pc" href="/music/artist.html?s=' + esc(a.slug) + '" style="text-decoration:none;color:inherit"><div class="pcv" style="border-radius:50%;' + (a.avatar_url ? 'background-image:url(' + esc(a.avatar_url) + ')' : '') + '"></div><b>' + esc(a.name) + (a.verified ? ' ✔' : '') + '</b><small class="muted">' + esc(a.city || "") + '</small></a>'; };

  /* ---------- dialogs ---------- */
  PM.productDialog = function (id) {
    var p = PM.products[id]; if (!p) return;
    PM.dialog('<h2 style="margin:0">' + esc(p.title) + '</h2><small class="muted">' + esc(p.kind.replace("_", " ")) + ' by ' + esc(p.artist || "") + ' · Paid download</small>' + (p.cover_url ? '<img alt="" src="' + esc(p.cover_url) + '" style="width:100%;border-radius:12px;margin:10px 0">' : '') + (p.description ? '<p>' + esc(p.description) + '</p>' : '') + (p.preview_url ? '<audio controls preload="none" src="' + esc(p.preview_url) + '" style="width:100%"></audio>' : '') + '<div class="opt"><b>What the buyer is allowed to do</b><p style="margin:4px 0;font-size:14px">' + esc(p.rights_text || "") + '</p>' + (p.sample_disclosure ? '<b>Samples / third-party material</b><p style="margin:4px 0;font-size:14px">' + esc(p.sample_disclosure) + '</p>' : '<small class="muted">No samples or third-party material disclosed by the seller.</small>') + '</div><small class="muted">Price ' + usd(p.price_cents) + '. POTENT\'s 1% platform fee comes out of the seller\'s sale, it is not added to your price. Card fees are separate and are not added either. Buying a digital product does not transfer copyright unless the rights above say so.</small><label class="ck"><input type="checkbox" id="pagr" style="width:auto"><span>I accept these rights and the purchase terms (<a href="/beats/terms.html" target="_blank">v1.0</a>).</span></label><button id="pbuy" style="width:100%">Buy for ' + usd(p.price_cents) + '</button><small class="muted">Have a promo code? You can enter it on the payment page.</small>', function () {
      $("pbuy").onclick = function () { if (!$("pagr").checked) { PM.toast("Accept the terms first"); return; } $("pbuy").disabled = true; PM.api("music-checkout", { product_id: id, agree: true }).then(function (j) { location.href = j.url; }).catch(function (e) { PM.toast(e.message); $("pbuy").disabled = false; }); };
    });
  };
  function embed(u) { var m = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([\w-]{6,})/); if (m) return '<iframe src="https://www.youtube-nocookie.com/embed/' + m[1] + '" allowfullscreen style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px"></iframe>'; m = u.match(/vimeo\.com\/(\d+)/); if (m) return '<iframe src="https://player.vimeo.com/video/' + m[1] + '" allowfullscreen style="width:100%;aspect-ratio:16/9;border:0;border-radius:12px"></iframe>'; return '<video controls playsinline src="' + esc(u) + '" style="width:100%;border-radius:12px"></video>'; }
  PM.videoDialog = function (id) { var v = PM.videos[id]; if (!v) return; au.pause(); PM.dialog('<h2 style="margin:0 0 8px">' + esc(v.title) + '</h2>' + embed(v.video_url) + (v.description ? '<p>' + esc(v.description) + '</p>' : '') + '<button class="alt" data-rep="video:' + id + '" style="margin-top:8px">⚑ Report</button>'); PM.api("music-api", { action: "video_view", id: id }, "").catch(function () { }); };
  PM.reportDialog = function (kind, id) {
    PM.dialog('<h2 style="margin:0 0 8px">Report this ' + esc(kind) + '</h2><small class="muted">Copyright, rights, or content concerns. POTENT reviews every report.</small><textarea id="rrs" rows="4" placeholder="What is wrong?"></textarea><input id="rct" placeholder="Your email (optional, so we can follow up)"><button id="rgo" style="width:100%">Send report</button>', function () {
      $("rgo").onclick = function () { PM.api("music-api", { action: "report", kind: kind, item_id: id, reason: $("rrs").value, contact: $("rct").value }, "").then(function () { PM.close(); PM.toast("Report sent. Thank you."); }).catch(function (e) { PM.toast(e.message); }); };
    });
  };
  PM.playlistDialog = function (trackId) {
    PM.need(function () {
      var ps = PM.me.playlists;
      PM.dialog('<h2 style="margin:0 0 8px">Add to playlist</h2>' + (ps.length ? ps.map(function (p) { return '<button class="alt" data-pl="' + p.id + '" style="width:100%;margin-top:6px">' + esc(p.title) + '</button>'; }).join("") : '<small class="muted">No playlists yet.</small>') + '<input id="npl" placeholder="New playlist name" style="margin-top:10px"><button id="npg" style="width:100%">Create and add</button>', function (m) {
        [].forEach.call(m.querySelectorAll("[data-pl]"), function (b) { b.onclick = function () { PM.api("music-api", { action: "playlist_add", id: b.dataset.pl, track_id: trackId }).then(function () { PM.close(); PM.toast("Added"); }).catch(function (e) { PM.toast(e.message); }); }; });
        $("npg").onclick = function () { PM.api("music-api", { action: "playlist_save", title: $("npl").value }).then(function (j) { return PM.api("music-api", { action: "playlist_add", id: j.id, track_id: trackId }); }).then(function () { return PM.loadMe(); }).then(function () { PM.close(); PM.toast("Playlist created"); }).catch(function (e) { PM.toast(e.message); }); };
      });
    });
  };

  /* ---------- one click handler for all cards ---------- */
  PM.wire = function (root) {
    (root || document).addEventListener("click", function (e) {
      var t = e.target.closest("[data-play],[data-fav],[data-add],[data-rep],[data-prod],[data-vid],[data-follow]"); if (!t) return;
      if (t.dataset.play) PM.playTrack(t.dataset.play, PM.listFor ? PM.listFor(t) : null);
      else if (t.dataset.prod) PM.productDialog(t.dataset.prod);
      else if (t.dataset.vid) PM.videoDialog(t.dataset.vid);
      else if (t.dataset.add) PM.playlistDialog(t.dataset.add);
      else if (t.dataset.rep) { var p = t.dataset.rep.split(":"); PM.reportDialog(p[0], p[1]); }
      else if (t.dataset.fav) { var q = t.dataset.fav.split(":"); PM.need(function () { PM.api("music-api", { action: "fav_toggle", kind: q[0], item_id: q[1] }).then(function (j) { return PM.loadMe(); }).then(function () { if (PM.redraw) PM.redraw(); }).catch(function (er) { PM.toast(er.message); }); }); }
      else if (t.dataset.follow) { PM.need(function () { PM.api("music-api", { action: "follow_toggle", producer_id: t.dataset.follow }).then(function () { return PM.loadMe(); }).then(function () { if (PM.redraw) PM.redraw(); }).catch(function (er) { PM.toast(er.message); }); }); }
    });
  };
  PM.onPlayState = function () { if (PM.redraw) PM.redraw(); };
  PM.css = '.beat{display:flex;gap:10px;align-items:center;padding:8px;border-bottom:1px solid var(--line)}.cv{flex:0 0 52px;height:52px;border-radius:10px;background:var(--line) center/cover;position:relative}.cv .play{position:absolute;inset:3px;opacity:.92;border-radius:50%;padding:0}.bi{flex:1;min-width:0}.bi b{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.st{font-size:11px;border:1px solid var(--line);border-radius:99px;padding:1px 8px;margin-left:4px;color:var(--muted);font-weight:400}.fav{background:transparent;border:1px solid var(--line);color:var(--ink);padding:8px 10px}.fav.on{color:#e74c3c;border-color:#e74c3c}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}.pc{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:10px;display:flex;flex-direction:column;gap:4px}.pcv{aspect-ratio:1;border-radius:12px;background:var(--line) center/cover;position:relative}.pcv .play{position:absolute;inset:auto auto 8px 8px;border-radius:50%}.opt{border:1px solid var(--line);border-radius:12px;padding:12px;margin:10px 0}.ck{display:flex;gap:8px;align-items:flex-start;margin:10px 0;font-size:14px}.ck input{margin-top:4px}a{color:var(--gold)}';
  var s = document.createElement("style"); s.textContent = PM.css; document.head.appendChild(s);
})();
