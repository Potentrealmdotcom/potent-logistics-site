/* POTENT Music: release plan, details, registrations, statements, promotion, reminders. Loaded by /music/projects.html */
(function () {
  var esc = PM.esc, $ = function (i) { return document.getElementById(i); }, usd = function (c) { return "$" + ((c || 0) / 100).toFixed(2); };
  function rel(b) { return PM.api("music-release", b); }
  var COL = { "COMPLETED": "#2ecc71", "NOT APPLICABLE": "#888", "IN PROGRESS": "#f1c40f", "ACTION REQUIRED": "#e74c3c", "NOT STARTED": "#888" };
  var badge = function (s) { return '<span class="st" style="border-color:' + COL[s] + ';color:' + COL[s] + '">' + s + '</span>'; };
  var PAGE_LABEL = { team: "Add people", splits: "Review splits", audio: "Upload audio", details: "Fill in details", registrations: "Track distribution", money: "Add income" };
  var box, P, pid, open = {};

  function mount(el, project) {
    box = el; P = project; pid = project.id;
    box.innerHTML = '<div class="card"><span class="muted">Loading your release plan…</span></div>';
    rel({ action: "r_track", project_id: pid }).then(draw).catch(function (e) { box.innerHTML = '<div class="card err">' + esc(e.message) + '</div>'; });
  }
  function sec(key, title, body, hint) {
    return '<details class="card" data-sec="' + key + '"' + (open[key] ? " open" : "") + '><summary><b>' + title + '</b>' + (hint ? ' <small class="muted">' + hint + '</small>' : '') + '</summary><div style="margin-top:8px">' + body + '</div></details>';
  }
  function draw(j) {
    var t = j.tracker, w = j.work || {}, h = '<div class="card" style="border-color:var(--gold)"><b>Your release: ' + t.done + ' of ' + t.total + ' steps complete</b><div style="height:8px;background:var(--line);border-radius:6px;margin:8px 0;overflow:hidden"><div style="height:100%;width:' + Math.round(t.done / t.total * 100) + '%;background:var(--gold)"></div></div>' +
      t.steps.map(function (s, i) { return '<div class="row" style="justify-content:space-between;margin-top:6px"><span>' + (i + 1) + '. ' + esc(s.t) + '</span>' + badge(s.s) + '</div>'; }).join("") +
      (t.next ? '<div style="margin-top:10px"><b>Next step: ' + esc(t.next.t) + '</b><div class="muted"><small>' + esc(t.next.d) + '</small></div>' + (t.next.page ? '<button id="relgo" style="margin-top:6px">' + (PAGE_LABEL[t.next.page] || "Open") + '</button>' : '') + '</div>' : '<div style="margin-top:10px"><b>Every step is complete.</b></div>') +
      '<details style="margin-top:8px"><summary class="muted"><small>What do these mean?</small></summary><small class="muted">Completed = the records show it. Action required = something is blocking you. Not applicable = this step does not apply to you. POTENT keeps records and checklists. It does not submit your release, register your song or pay anyone for you.</small></details></div>';
    h += sec("details", "Release details", detailsForm(w), "title, artist, date, IDs");
    h += sec("audio", "Final audio", '<div class="muted"><small>' + (j.has_audio ? "Final audio is saved." : "Not uploaded yet.") + '</small></div><input type="file" id="aud" accept=".mp3,.wav,.m4a,.flac,.aif,.aiff"><div class="row"><button id="audgo">Upload</button>' + (j.has_audio ? '<button class="alt" id="audhear">Open saved file</button>' : '') + '</div><div id="audm" class="muted"></div>');
    h += sec("registrations", "Distribution &amp; registrations", regForm(j), "tracked by you, never sent by us");
    h += sec("statements", "Statements &amp; money", '<div id="stm" class="muted">Open to load.</div>', "who is owed and who was paid");
    h += sec("promo", "Promotion &amp; Atlanta DJs", '<div id="prm" class="muted">Open to load.</div>', "campaigns and outreach");
    h += sec("remind", "Reminders", '<div id="rmd" class="muted">Open to load.</div>');
    h += sec("writer", "My writer / publisher info", '<div id="wrt" class="muted">Open to load.</div>', "saved once, reused");
    box.innerHTML = h;
    [].forEach.call(box.querySelectorAll("details[data-sec]"), function (d) { d.addEventListener("toggle", function () { open[d.dataset.sec] = d.open; if (d.open) lazy(d.dataset.sec); }); });
    Object.keys(open).forEach(function (k) { if (open[k]) lazy(k); });
    if ($("relgo")) $("relgo").onclick = function () { var m = { team: null, splits: null, audio: "audio", details: "details", registrations: "registrations", money: "statements" }[t.next.page]; if (m) { var d = box.querySelector('[data-sec="' + m + '"]'); d.open = true; d.scrollIntoView({ behavior: "smooth" }); } else window.scrollTo({ top: document.body.scrollHeight * 0.3, behavior: "smooth" }); };
    wireForms(j);
  }
  function detailsForm(w) {
    var v = function (k) { return esc(w[k] || ""); };
    return '<input id="wt" placeholder="Release title" value="' + v("release_title") + '"><input id="wa" placeholder="Primary artist" value="' + v("primary_artist") + '"><div class="row"><input id="wd" type="date" value="' + v("release_date") + '"><input id="wg" placeholder="Genre" value="' + v("genre") + '"></div><input id="wl" placeholder="Label (optional)" value="' + v("label") + '">' +
      '<label class="ck"><input type="checkbox" id="we"' + (w.explicit ? " checked" : "") + '><span>Explicit</span></label><details><summary class="muted"><small>Advanced: ISRC, ISWC, UPC</small></summary><input id="wi" placeholder="ISRC (US-ABC-26-00001)" value="' + v("isrc") + '"><input id="ww" placeholder="ISWC (T-123.456.789-0)" value="' + v("iswc") + '"><input id="wu" placeholder="UPC / EAN" value="' + v("upc") + '"><small class="muted">Your distributor usually gives you the ISRC and UPC. Leave blank until you have them. A PRO gives the ISWC after the song is registered.</small></details><button id="wsave">Save details</button> <span id="wmsg" class="muted"></span>';
  }
  function regForm(j) {
    var orgs = j.orgs;
    return '<div class="muted"><small>Add each place you are releasing or registering with and keep its status honest. "Confirmed" needs the confirmation number they gave you.</small></div>' +
      (j.registrations.length ? '<table>' + j.registrations.map(function (r) { return '<tr><td><b>' + esc(r.name) + '</b><br><small class="muted">' + esc(orgs[r.org] || r.org) + (r.confirmation_ref ? ' · ref ' + esc(r.confirmation_ref) : '') + '</small></td><td>' + badge(r.status === "confirmed" ? "COMPLETED" : r.status === "rejected" ? "ACTION REQUIRED" : r.status === "not_started" ? "NOT STARTED" : "IN PROGRESS").replace(/>[^<]*</, ">" + r.status.replace("_", " ").toUpperCase() + "<") + '</td><td><button class="alt" data-rx="' + r.id + '">Remove</button></td></tr>'; }).join("") + '</table>' : '') +
      '<div class="row"><select id="ro">' + Object.keys(orgs).map(function (k) { return '<option value="' + k + '">' + esc(orgs[k]) + '</option>'; }).join("") + '</select><input id="rn" placeholder="Name (e.g. DistroKid, ASCAP)"></div><div class="row"><select id="rs"><option value="not_started">Not started</option><option value="prepared">Prepared</option><option value="submitted">Submitted</option><option value="confirmed">Confirmed</option><option value="rejected">Rejected</option></select><input id="rc" placeholder="Confirmation number (needed for Confirmed)"></div><button id="rsave">Save</button> <span id="rmsg" class="muted"></span>';
  }
  function wireForms(j) {
    var refresh = function (x) { open.keep = 1; draw(Object.assign({}, j, x || {})); rel({ action: "r_track", project_id: pid }).then(draw); };
    if ($("wsave")) $("wsave").onclick = function () { rel({ action: "r_work_save", project_id: pid, release_title: $("wt").value, primary_artist: $("wa").value, release_date: $("wd").value, genre: $("wg").value, label: $("wl").value, explicit: $("we").checked, isrc: $("wi").value, iswc: $("ww").value, upc: $("wu").value }).then(function () { $("wmsg").textContent = "Saved."; rel({ action: "r_track", project_id: pid }).then(draw); }).catch(function (e) { $("wmsg").textContent = e.message; }); };
    if ($("rsave")) $("rsave").onclick = function () { rel({ action: "r_reg_save", project_id: pid, org: $("ro").value, name: $("rn").value, status: $("rs").value, confirmation_ref: $("rc").value }).then(function () { rel({ action: "r_track", project_id: pid }).then(draw); }).catch(function (e) { $("rmsg").textContent = e.message; }); };
    [].forEach.call(box.querySelectorAll("[data-rx]"), function (b) { b.onclick = function () { rel({ action: "r_reg_remove", project_id: pid, id: b.dataset.rx }).then(function () { rel({ action: "r_track", project_id: pid }).then(draw); }); }; });
    if ($("audgo")) $("audgo").onclick = function () {
      var f = $("aud").files[0]; if (!f) { $("audm").textContent = "Pick a file first."; return; } $("audm").textContent = "Uploading…"; this.disabled = true; var btn = this;
      rel({ action: "r_audio_url", project_id: pid, name: f.name }).then(function (u) { var fd = new FormData(); fd.append("cacheControl", "3600"); fd.append("", f, f.name); return fetch(u.uploadUrl, { method: "PUT", body: fd }).then(function (r) { if (!r.ok) throw new Error("Upload failed"); return rel({ action: "r_audio_set", project_id: pid, ref: u.ref }); }); }).then(function () { rel({ action: "r_track", project_id: pid }).then(draw); }).catch(function (e) { $("audm").textContent = e.message; btn.disabled = false; });
    };
    if ($("audhear")) $("audhear").onclick = function () { rel({ action: "r_audio_get", project_id: pid }).then(function (u) { window.open(u.url, "_blank"); }).catch(function (e) { $("audm").textContent = e.message; }); };
  }
  function lazy(k) { ({ statements: statements, promo: promo, remind: remind, writer: writer })[k] && ({ statements: statements, promo: promo, remind: remind, writer: writer })[k](); }

  function statements() {
    rel({ action: "r_statements", project_id: pid }).then(function (j) {
      $("stm").innerHTML = '<div class="muted"><small>' + esc(j.note) + '</small></div><p>' + esc(j.summary) + '</p>' +
        (j.people.length ? '<table><tr><th>Person</th><th>Calculated</th><th>Received</th><th>Awaiting</th></tr>' + j.people.map(function (p) { return '<tr><td>' + esc(p.name) + '</td><td>' + usd(p.calculated_cents) + '</td><td>' + usd(p.received_cents) + '</td><td>' + usd(p.awaiting_cents) + '</td></tr>'; }).join("") + '</table>' : '') +
        '<div class="row"><button class="alt" id="stcsv">Download statements (CSV)</button><button class="alt" id="stai">Explain in plain English</button></div>' +
        '<details><summary class="muted"><small>Import a royalty statement (CSV)</small></summary><select id="imc"><option value="master">Master recording</option><option value="publishing">Songwriting / publishing</option><option value="promo">Promotion</option><option value="other">Other agreed income</option></select><textarea id="imt" rows="4" placeholder="reference,gross,deductions,note&#10;STMT-2026-01,125.50,10,Jan streams"></textarea><small class="muted">Each row is checked like a single entry: it needs an approved split, and the same reference cannot be added twice.</small><button id="imgo">Import</button><div id="imr" class="muted"></div></details>';
      $("stcsv").onclick = function () { rel({ action: "r_statements", project_id: pid, csv: true }).then(function (c) { var a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([c.csv], { type: "text/csv" })); a.download = c.name; a.click(); }); };
      $("stai").onclick = function () { rel({ action: "r_statements", project_id: pid, plain: true }).then(function (c) { $("stm").querySelector("p").textContent = c.summary; }); };
      $("imgo").onclick = function () { rel({ action: "r_import", project_id: pid, category: $("imc").value, csv: $("imt").value }).then(function (r) { $("imr").innerHTML = "Imported " + r.imported + " of " + r.rows.length + "." + r.rows.filter(function (x) { return !x.ok; }).map(function (x) { return "<br>" + esc(x.reference || "(blank)") + ": " + esc(x.error); }).join(""); statements(); }).catch(function (e) { $("imr").textContent = e.message; }); };
    }).catch(function (e) { $("stm").textContent = e.message; });
  }
  function promo() {
    Promise.all([rel({ action: "c_list", project_id: pid }), rel({ action: "dj_list", project_id: pid, city: "Atlanta" })]).then(function (r) {
      var cs = r[0].campaigns, djs = r[1].djs;
      $("prm").innerHTML = '<div class="muted"><small>' + esc(r[0].rule) + '</small></div>' +
        cs.map(function (c) { return '<div class="card"><b>' + esc(c.title) + '</b> <span class="st">' + esc(c.status) + '</span><br><small class="muted">' + (c.music_djs ? esc(c.music_djs.name) + ' · ' : '') + esc(c.comp_type === "flat" ? "flat " + usd(c.comp_flat_cents) : c.comp_type === "percent_promo" ? c.comp_pct + "% via promotion split" : c.comp_type) + (c.due_date ? ' · due ' + esc(c.due_date) : '') + '</small>' +
          c.music_campaign_tasks.map(function (t) { return '<div class="row"><label class="ck"><input type="checkbox" data-tk="' + c.id + ':' + t.id + '"' + (t.done_at ? " checked" : "") + '><span>' + esc(t.title) + '</span></label></div>'; }).join("") +
          '<div class="row"><input data-nt="' + c.id + '" placeholder="Add a task"><button class="alt" data-na="' + c.id + '">Add</button><button class="alt" data-dr="' + c.id + '">Draft message</button></div><div data-dm="' + c.id + '"></div></div>'; }).join("") +
        '<div class="card"><b>New campaign</b><input id="cn" placeholder="Name (e.g. Atlanta club push)"><select id="cd"><option value="">Choose a DJ / promoter (optional)</option>' + djs.map(function (d) { return '<option value="' + d.id + '">' + esc(d.name) + ' (' + esc(d.kind) + ')</option>'; }).join("") + '</select><textarea id="cb" rows="2" placeholder="What do you want them to do?"></textarea><div class="row"><input id="cdd" type="date"><select id="cc"><option value="free">Unpaid</option><option value="flat">Flat fee</option><option value="percent_promo">Percent via promotion split</option><option value="other">Other (describe)</option></select></div><div class="row"><input id="cf" inputmode="decimal" placeholder="Flat fee $"><input id="cp" inputmode="decimal" placeholder="Percent"><input id="co" placeholder="Other terms"></div><button id="cgo">Create campaign</button> <span id="cm" class="muted"></span></div>' +
        '<details><summary class="muted"><small>Add a DJ / promoter to the directory</small></summary><input id="dn" placeholder="Name"><div class="row"><select id="dk"><option value="dj">DJ</option><option value="promoter">Promoter</option><option value="radio">Radio</option><option value="blog">Blog</option><option value="venue">Venue</option></select><input id="dc" value="Atlanta"></div><input id="di" placeholder="Instagram"><input id="de" type="email" placeholder="Contact email (private, only you see it)"><button id="dgo">Save contact</button><div id="dm" class="muted"></div></details>';
      $("cgo").onclick = function () { rel({ action: "c_save", project_id: pid, title: $("cn").value, dj_id: $("cd").value || undefined, brief: $("cb").value, due_date: $("cdd").value, comp_type: $("cc").value, comp_flat_cents: Math.round(parseFloat($("cf").value) * 100), comp_pct: parseFloat($("cp").value), comp_note: $("co").value }).then(promo).catch(function (e) { $("cm").textContent = e.message; }); };
      $("dgo").onclick = function () { rel({ action: "dj_save", project_id: pid, name: $("dn").value, kind: $("dk").value, city: $("dc").value, instagram: $("di").value, contact_email: $("de").value }).then(promo).catch(function (e) { $("dm").textContent = e.message; }); };
      [].forEach.call($("prm").querySelectorAll("[data-tk]"), function (c) { c.onchange = function () { var p = c.dataset.tk.split(":"); rel({ action: "c_task", project_id: pid, campaign_id: p[0], id: p[1], done: c.checked }); }; });
      [].forEach.call($("prm").querySelectorAll("[data-na]"), function (b) { b.onclick = function () { var v = $("prm").querySelector('[data-nt="' + b.dataset.na + '"]').value; rel({ action: "c_task", project_id: pid, campaign_id: b.dataset.na, title: v }).then(promo).catch(function (e) { alert(e.message); }); }; });
      [].forEach.call($("prm").querySelectorAll("[data-dr]"), function (b) { b.onclick = function () { rel({ action: "c_draft", project_id: pid, campaign_id: b.dataset.dr }).then(function (t) { var d = $("prm").querySelector('[data-dm="' + b.dataset.dr + '"]'); d.innerHTML = '<textarea rows="5">' + esc(t.text) + '</textarea><div class="row"><button class="alt" data-cp>Copy</button><button class="alt" data-pl>Polish with AI</button></div>'; d.querySelector("[data-cp]").onclick = function () { navigator.clipboard && navigator.clipboard.writeText(d.querySelector("textarea").value); PM.toast("Copied"); }; d.querySelector("[data-pl]").onclick = function () { rel({ action: "c_draft", project_id: pid, campaign_id: b.dataset.dr, polish: true }).then(function (p) { d.querySelector("textarea").value = p.text; if (p.note) PM.toast(p.note); }); }; }); }; });
    }).catch(function (e) { $("prm").textContent = e.message; });
  }
  function remind() {
    rel({ action: "rem_list", project_id: pid }).then(function (j) {
      $("rmd").innerHTML = (j.items.length ? j.items.map(function (r) { return '<div class="row" style="justify-content:space-between"><span>' + esc(r.text) + ' <small class="muted">' + new Date(r.due_at).toLocaleString() + '</small></span><button class="alt" data-rd="' + r.id + '">Done</button></div>'; }).join("") : '<span class="muted">No open reminders.</span>') + '<div class="row"><input id="rt" placeholder="Remind me to…"><input id="rd" type="datetime-local"><button id="rg">Add</button></div><small class="muted">Due reminders show up under the 🔔 when you next open POTENT Music.</small>';
      $("rg").onclick = function () { rel({ action: "rem_add", project_id: pid, text: $("rt").value, due_at: $("rd").value ? new Date($("rd").value).toISOString() : "" }).then(remind).catch(function (e) { PM.toast(e.message); }); };
      [].forEach.call($("rmd").querySelectorAll("[data-rd]"), function (b) { b.onclick = function () { rel({ action: "rem_done", project_id: pid, id: b.dataset.rd }).then(remind); }; });
    }).catch(function (e) { $("rmd").textContent = e.message; });
  }
  function writer() {
    rel({ action: "w_get", project_id: pid }).then(function (j) {
      var p = j.profile || {}, v = function (k) { return esc(p[k] || ""); };
      $("wrt").innerHTML = '<small class="muted">Saved to your account once and reused on every project. Used for your records and split sheets only.</small><input id="wn" placeholder="Legal name" value="' + v("legal_name") + '"><div class="row"><input id="wpro" placeholder="PRO (ASCAP, BMI, SESAC, GMR…)" value="' + v("pro") + '"><input id="wipi" placeholder="Your IPI/CAE number" value="' + v("ipi") + '"></div><div class="row"><input id="wpn" placeholder="Publisher name (if any)" value="' + v("publisher_name") + '"><input id="wpi" placeholder="Publisher IPI" value="' + v("publisher_ipi") + '"></div><button id="wgo">Save</button> <span id="wm" class="muted"></span>';
      $("wgo").onclick = function () { rel({ action: "w_save", project_id: pid, legal_name: $("wn").value, pro: $("wpro").value, ipi: $("wipi").value, publisher_name: $("wpn").value, publisher_ipi: $("wpi").value }).then(function () { $("wm").textContent = "Saved."; }).catch(function (e) { $("wm").textContent = e.message; }); };
    });
  }
  // Voice or typed note -> a DRAFT project. Nothing is created until the person confirms.
  function voiceCard(el, onCreate) {
    el.innerHTML = '<div class="card"><b>Start from a note</b><br><small class="muted">Say or type who worked on the song. You will see a draft before anything is created.</small><textarea id="vn" rows="3" placeholder="e.g. New song Midnight Run with Mia on vocals and Jay who produced it"></textarea><div class="row">' + (window.SpeechRecognition || window.webkitSpeechRecognition ? '<button class="alt" id="vm">🎤 Speak</button>' : '') + '<button id="vg">Make a draft</button></div><div id="vr"></div></div>';
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR && $("vm")) $("vm").onclick = function () { var r = new SR(); r.lang = "en-US"; r.onresult = function (e) { $("vn").value = e.results[0][0].transcript; }; r.onerror = function () { PM.toast("Could not hear that. You can type instead."); }; r.start(); };
    $("vg").onclick = function () {
      rel({ action: "voice_draft", text: $("vn").value }).then(function (j) {
        var d = j.draft; $("vr").innerHTML = '<p class="muted"><small>' + esc(j.message || "") + '</small></p><label>Project name</label><input id="vt" value="' + esc(d.title) + '">' + (d.people.length ? '<small class="muted">People to add (uncheck any that are wrong):</small>' + d.people.map(function (p, i) { return '<label class="ck"><input type="checkbox" data-vp="' + i + '" checked><span>' + esc(p.name) + ' — ' + esc(p.role) + '</span></label>'; }).join("") : "") + '<button id="vc">Create this project</button>';
        $("vc").onclick = function () { onCreate($("vt").value, d.people.filter(function (p, i) { return $("vr").querySelector('[data-vp="' + i + '"]').checked; })); };
      }).catch(function (e) { $("vr").innerHTML = '<div class="err">' + esc(e.message) + '</div>'; });
    };
  }
  window.REL = { mount: mount, voiceCard: voiceCard };
})();
