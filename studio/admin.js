/* POTENT Music studio: owner admin tools. Loaded by /studio/. Each section loads only when opened. */
(function () {
  var C, esc, usd, dlf, box, cur = "orders", $ = function (i) { return document.getElementById(i); };
  var SECS = [["orders", "Orders"], ["events", "Payment events"], ["services", "Art orders"], ["colls", "Collectibles"], ["coupons", "Coupons"], ["staff", "Staff"], ["controls", "Controls"], ["reports", "Reports"], ["remainder", "Remainder (8%)"], ["home", "Home page"]];
  var cd = function (c) { return (c / 100).toFixed(2); };
  function nav() { return '<div class="row" style="flex-wrap:wrap;gap:6px;margin-bottom:8px">' + SECS.map(function (s) { return '<button class="' + (cur === s[0] ? "" : "alt") + ' sm" data-adm="' + s[0] + '">' + s[1] + '</button>'; }).join("") + '</div><div id="admbody"><div class="muted">Loading…</div></div>'; }
  function go(s) { cur = s; box.innerHTML = nav(); [].forEach.call(box.querySelectorAll("[data-adm]"), function (b) { b.onclick = function () { go(b.dataset.adm); }; }); (S[s] || function () {})(); }
  function body(h) { $("admbody").innerHTML = h; }
  function err(e) { $("admbody").innerHTML = '<div class="err">' + esc(e.message) + '</div>'; }
  var S = {};
  S.orders = function () {
    var st = { q: "", status: "", kind: "", page: 0 };
    function load() {
      C("music-admin", "o_orders", st).then(function (j) {
        body('<div class="row"><input id="oq" placeholder="Search buyer email or title" value="' + esc(st.q) + '"><select id="ost"><option value="">Any status</option><option value="complete"' + (st.status === "complete" ? " selected" : "") + '>Complete</option><option value="refunded"' + (st.status === "refunded" ? " selected" : "") + '>Refunded</option></select><select id="okd"><option value="">Beats + music</option><option value="beat"' + (st.kind === "beat" ? " selected" : "") + '>Beats</option><option value="product"' + (st.kind === "product" ? " selected" : "") + '>Music</option></select><button id="ogo">Search</button></div>' +
          '<table><tr><th>Date</th><th>Item</th><th>Buyer</th><th>Paid</th><th></th></tr>' + j.rows.map(function (r) { return '<tr><td>' + new Date(r.date).toLocaleDateString() + '</td><td>' + esc(r.title) + '<br><small class="muted">' + esc(r.seller || "") + ' · ' + r.paid_with + '</small></td><td><small>' + esc(r.buyer || "") + '</small></td><td>$' + cd(r.gross_cents) + '<br><small>' + esc(r.status) + '</small></td><td><button class="alt sm" data-rd="' + r.kind + ':' + r.id + '">Reset downloads</button><br><small class="muted">' + esc(r.id.slice(0, 8)) + '</small></td></tr>'; }).join("") + '</table>' +
          '<div class="row"><button class="alt sm" id="opv"' + (st.page ? "" : " disabled") + '>← Newer</button><span class="muted">Page ' + (st.page + 1) + '</span><button class="alt sm" id="onx"' + (j.more ? "" : " disabled") + '>Older →</button></div>');
        $("ogo").onclick = function () { st.q = $("oq").value; st.status = $("ost").value; st.kind = $("okd").value; st.page = 0; load(); };
        $("opv").onclick = function () { st.page--; load(); }; $("onx").onclick = function () { st.page++; load(); };
        [].forEach.call(document.querySelectorAll("[data-rd]"), function (b) { b.onclick = function () { var p = b.dataset.rd.split(":"); C("music-admin", "o_reset_downloads", { kind: p[0], id: p[1] }).then(function () { b.textContent = "Reset ✓"; }).catch(function (e) { alert(e.message); }); }; });
      }).catch(err);
    }
    load();
  };
  S.events = function () {
    var st = { q: "", page: 0 };
    function load() {
      C("music-admin", "o_events", st).then(function (j) {
        body('<small class="muted">Every sale, refund, dispute, payout, sign-in action and admin change is written here.</small><div class="row"><input id="eq" placeholder="Search action, who, or item id" value="' + esc(st.q) + '"><button id="ego">Search</button></div><table>' + j.rows.map(function (r) { return '<tr><td><small>' + new Date(r.created_at).toLocaleString() + '</small></td><td><b>' + esc(r.action) + '</b><br><small>' + esc(r.actor) + ' · ' + esc(r.target || "") + '</small></td></tr>'; }).join("") + '</table><div class="row"><button class="alt sm" id="epv"' + (st.page ? "" : " disabled") + '>← Newer</button><button class="alt sm" id="enx"' + (j.more ? "" : " disabled") + '>Older →</button></div>');
        $("ego").onclick = function () { st.q = $("eq").value; st.page = 0; load(); }; $("epv").onclick = function () { st.page--; load(); }; $("enx").onclick = function () { st.page++; load(); };
      }).catch(err);
    }
    load();
  };
  S.services = function () {
    C("music-services", "o_svc_list", { limit: 200 }).then(function (j) {
      body('<small class="muted">Fixed tiers are paid first. "Starting price" tiers: set the exact price (not below the start) and the buyer is notified to pay. Paid and refunded are set by Stripe automatically.</small><table>' + j.orders.map(function (o) {
        var price = o.quote_cents != null ? o.quote_cents : o.price_cents, t = o.music_service_tiers || {};
        return '<tr><td><b>' + esc(t.title) + '</b> <span class="pill">' + esc(o.status.replace("_", " ")) + '</span><br><small>' + esc((o.music_users && o.music_users.email) || "") + ' · ' + (price ? "$" + cd(price) : "no price yet") + '</small><br><small>' + esc((o.brief || "").slice(0, 200)) + '</small>' +
          '<div class="row">' + (t.is_quote && (o.status === "quote_requested" || o.status === "awaiting_payment") ? '<input data-qv="' + o.id + '" inputmode="decimal" placeholder="Price $ (min ' + cd(t.price_cents) + ')" style="width:140px"><button class="alt sm" data-qs="' + o.id + '">Set price</button>' : '') +
          (o.paid_at ? '<select data-ss="' + o.id + '"><option value="">Move to…</option><option value="in_progress">In progress</option><option value="review">In review</option><option value="delivered">Delivered</option></select><input data-du="' + o.id + '" placeholder="Delivery link (https)" value="' + esc(o.delivered_url || "") + '"><input data-as="' + o.id + '" placeholder="Assigned to" value="' + esc(o.assigned_to || "") + '" style="width:130px"><button class="alt sm" data-sv="' + o.id + '">Save</button>' : '') + '</div></td></tr>';
      }).join("") + '</table><div id="svr" class="muted"></div>');
      var say = function (m) { $("svr").textContent = m; };
      [].forEach.call(document.querySelectorAll("[data-qs]"), function (b) { b.onclick = function () { C("music-services", "o_svc_update", { id: b.dataset.qs, quote_cents: Math.round(parseFloat(document.querySelector('[data-qv="' + b.dataset.qs + '"]').value) * 100) }).then(S.services).catch(function (e) { say(e.message); }); }; });
      [].forEach.call(document.querySelectorAll("[data-sv]"), function (b) { b.onclick = function () { var id = b.dataset.sv, st = document.querySelector('[data-ss="' + id + '"]').value, p = { id: id, delivered_url: document.querySelector('[data-du="' + id + '"]').value, assigned_to: document.querySelector('[data-as="' + id + '"]').value }; if (st) p.status = st; C("music-services", "o_svc_update", p).then(S.services).catch(function (e) { say(e.message); }); }; });
    }).catch(err);
  };
  S.colls = function () {
    C("music-services", "o_coll_list").then(function (j) {
      body('<div class="card"><b>New collectible</b><small class="muted"> Each one starts at $300. Edition size and price lock after the first sale.</small><input id="kt" placeholder="Title"><textarea id="kd" rows="2" placeholder="Description"></textarea><input id="ki" placeholder="Image link (https)"><div class="row"><input id="kp" inputmode="decimal" placeholder="Price $ (300 or more)"><input id="ks" inputmode="numeric" placeholder="Edition size"><select id="kst"><option value="draft">Draft</option><option value="published">Published</option></select></div><button id="ksv">Save</button> <span id="kr" class="muted"></span></div>' +
        '<div class="card"><b>Editions</b><table>' + j.items.map(function (c) { return '<tr><td><b>' + esc(c.title) + '</b> <span class="pill">' + esc(c.status) + '</span><br><small>$' + cd(c.price_cents) + ' · ' + c.sold_count + ' of ' + c.edition_size + ' sold</small></td><td><button class="alt sm" data-cs="' + c.id + ':' + (c.status === "published" ? "retired" : "published") + '">' + (c.status === "published" ? "Retire" : "Publish") + '</button></td></tr>'; }).join("") + '</table></div>' +
        '<div class="card"><b>Sold units</b><table>' + j.units.map(function (u) { return '<tr><td>' + esc(u.music_collectibles && u.music_collectibles.title) + ' #' + u.edition_no + '<br><small>' + esc(u.buyer_email || "") + ' · code ' + esc(u.certificate_code) + '</small><br><small>' + esc(u.shipping ? JSON.stringify(u.shipping.address || u.shipping).slice(0, 160) : "no address") + '</small></td><td>' + (u.status === "refunded" ? "refunded" : '<select data-us="' + u.id + '"><option value="sold"' + (u.status === "sold" ? " selected" : "") + '>Sold</option><option value="in_production"' + (u.status === "in_production" ? " selected" : "") + '>In production</option><option value="shipped"' + (u.status === "shipped" ? " selected" : "") + '>Shipped</option><option value="delivered"' + (u.status === "delivered" ? " selected" : "") + '>Delivered</option></select><input data-ut="' + u.id + '" placeholder="Tracking" value="' + esc(u.tracking || "") + '"><button class="alt sm" data-ug="' + u.id + '">Save</button>') + '</td></tr>'; }).join("") + '</table></div>');
      $("ksv").onclick = function () { C("music-services", "o_coll_save", { title: $("kt").value, description: $("kd").value, image_url: $("ki").value, price_cents: Math.round(parseFloat($("kp").value) * 100), edition_size: $("ks").value, status: $("kst").value }).then(S.colls).catch(function (e) { $("kr").textContent = e.message; }); };
      [].forEach.call(document.querySelectorAll("[data-cs]"), function (b) { b.onclick = function () { var p = b.dataset.cs.split(":"), c = j.items.filter(function (x) { return x.id === p[0]; })[0]; C("music-services", "o_coll_save", { id: c.id, title: c.title, description: c.description, image_url: c.image_url, price_cents: c.price_cents, edition_size: c.edition_size, status: p[1] }).then(S.colls).catch(function (e) { alert(e.message); }); }; });
      [].forEach.call(document.querySelectorAll("[data-ug]"), function (b) { b.onclick = function () { var id = b.dataset.ug; C("music-services", "o_unit_update", { id: id, status: document.querySelector('[data-us="' + id + '"]').value, tracking: document.querySelector('[data-ut="' + id + '"]').value }).then(S.colls).catch(function (e) { alert(e.message); }); }; });
    }).catch(err);
  };
  S.coupons = function () {
    function load() {
      C("music-admin", "o_coupons").then(function (j) {
        body('<small class="muted">Codes work at checkout for beats and music (made in your Stripe account).</small><div class="row"><input id="cc" placeholder="CODE"><input id="cp" inputmode="decimal" placeholder="% off" style="width:90px"><input id="ca" inputmode="decimal" placeholder="or $ off" style="width:90px"><input id="cm" inputmode="numeric" placeholder="Max uses" style="width:90px"><input id="ce" type="date"><button id="cgo">Create</button></div><div id="cres" class="muted"></div><table>' +
          j.codes.map(function (c) { return '<tr><td><b>' + esc(c.code) + '</b> ' + (c.percent_off ? c.percent_off + "% off" : "$" + cd(c.amount_off) + " off") + '<br><small class="muted">used ' + c.redeemed + (c.max ? " of " + c.max : "") + (c.expires_at ? " · ends " + new Date(c.expires_at * 1000).toLocaleDateString() : "") + '</small></td><td><button class="alt sm" data-co="' + c.id + ':' + (c.active ? 0 : 1) + '">' + (c.active ? "Turn off" : "Turn on") + '</button></td></tr>'; }).join("") + '</table>');
        $("cgo").onclick = function () { C("music-admin", "o_coupon_create", { code: $("cc").value, percent_off: parseFloat($("cp").value) || 0, amount_off_cents: Math.round((parseFloat($("ca").value) || 0) * 100), max_redemptions: $("cm").value, expires_at: $("ce").value || undefined }).then(load).catch(function (e) { $("cres").textContent = e.message; }); };
        [].forEach.call(document.querySelectorAll("[data-co]"), function (b) { b.onclick = function () { var p = b.dataset.co.split(":"); C("music-admin", "o_coupon_active", { id: p[0], active: p[1] === "1" }).then(load); }; });
      }).catch(err);
    }
    load();
  };
  S.staff = function () {
    function load() {
      C("music-admin", "o_roles").then(function (j) {
        body('<small class="muted">Staff use a normal POTENT Music account. Moderators see the review queue and reports. Support sees messages and can reply. Nobody but you sees money.</small><div class="row"><input id="se" placeholder="Their account email"><select id="sr"><option value="moderator">Moderator</option><option value="support">Support</option><option value="store_admin">Store admin</option></select><button id="sgo">Grant</button></div><div id="sres" class="muted"></div><table>' +
          j.roles.map(function (r) { return '<tr><td>' + esc(r.music_users && r.music_users.email) + '<br><small class="muted">' + esc(r.role) + '</small></td><td><button class="alt sm" data-rr="' + esc(r.music_users && r.music_users.email) + '">Remove</button></td></tr>'; }).join("") + '</table>');
        $("sgo").onclick = function () { C("music-admin", "o_role_set", { email: $("se").value, role: $("sr").value }).then(load).catch(function (e) { $("sres").textContent = e.message; }); };
        [].forEach.call(document.querySelectorAll("[data-rr]"), function (b) { b.onclick = function () { C("music-admin", "o_role_set", { email: b.dataset.rr, role: null }).then(load); }; });
      }).catch(err);
    }
    load();
  };
  S.controls = function () {
    C("music-admin", "o_flags_get").then(function (j) {
      var f = j.flags;
      body('<small class="muted">Switch features on or off without changing code.</small>' +
        [["ai", "AI helper (Gemini)"], ["signups", "New buyer sign-ups"], ["cart", "Cart (multi-item checkout)"]].map(function (k) { return '<label class="ck"><input type="checkbox" data-fl="' + k[0] + '"' + (f[k[0]] ? " checked" : "") + '><span>' + k[1] + '</span></label>'; }).join("") +
        '<label>Downloads allowed per purchase<input id="fdl" inputmode="numeric" value="' + f.download_limit + '" style="width:100px"></label><button id="fsv">Save</button> <span id="fres" class="muted"></span>');
      $("fsv").onclick = function () { var b = { download_limit: $("fdl").value }; [].forEach.call(document.querySelectorAll("[data-fl]"), function (c) { b[c.dataset.fl] = c.checked; }); C("music-admin", "o_flags_set", b).then(function () { $("fres").textContent = "Saved."; }).catch(function (e) { $("fres").textContent = e.message; }); };
    }).catch(err);
  };
  S.reports = function () {
    body('<small class="muted">Spreadsheet files (CSV).</small><div class="row"><button data-rp="sales">All sales</button><button data-rp="payouts">Payouts</button><button data-rp="coins">Coin ledger</button><button data-rp="remainder">Remainder assignments</button><button data-rp="acct">Artwork, vinyl &amp; collectibles by category</button></div><div id="rres" class="muted"></div>');
    [].forEach.call(document.querySelectorAll("[data-rp]"), function (b) { b.onclick = function () { (b.dataset.rp === "acct" ? C("music-services", "o_acct_report") : C("music-admin", "o_report", { type: b.dataset.rp })).then(function (j) { dlf(j.name, j.csv); }).catch(function (e) { $("rres").textContent = e.message; }); }; });
  };
  S.remainder = function () {
    Promise.all([C("music-admin", "o_rem_list"), C("beat-api", "o_sales", { limit: 100 })]).then(function (r) {
      var L = r[0], sales = (r[1].sales || []).filter(function (s) { return s.status === "complete" && s.unallocated_cents > 0; }), prods = {};
      sales.forEach(function (s) { prods[s.producer_id] = s.beat_producers && s.beat_producers.name; });
      body('<div class="card"><b>How the extra 8% works</b><br><small class="muted">POTENT keeps 1%. The seller keeps at least 91%. What is left is <b>unassigned</b> and goes to nobody until a written agreement names who. Each agreement is checked on its own: if the shares do not fit in what is left, it is flagged, not guessed. Applying an agreement records the amount. Money moves to a wallet only if you tick that box.</small></div>' +
        '<div class="card"><b>New agreement</b><div class="row"><input id="rl" placeholder="Label (e.g. Agreement with Breeze, 2026)"><input id="rn" placeholder="Receives (name)"></div><div class="row"><input id="rpid" placeholder="Seller id (the producer whose sales it covers)"><input id="rrp" placeholder="Receiving producer id (optional, for wallet credit)"></div><div class="row"><input id="rpc" inputmode="decimal" placeholder="Percent (max 8)" style="width:140px"><select id="rsc"><option value="producer">All this seller\'s beats</option><option value="beat">One beat</option></select><input id="rbid" placeholder="Beat id (if one beat)"></div><input id="rnt" placeholder="Where the written agreement is kept / note"><button id="rsv">Save &amp; check</button><div id="rsr" class="muted"></div></div>' +
        '<div class="card"><b>Agreements</b><table>' + L.agreements.map(function (a) { return '<tr><td><b>' + esc(a.label) + '</b> ' + a.pct + '%<br><small class="muted">→ ' + esc(a.recipient_name) + ' · ' + esc(a.status.replace("_", " ")) + (a.note ? " · " + esc(a.note) : "") + '</small><br><small class="muted">' + esc(a.id) + '</small></td><td>' + (a.status !== "ended" ? '<button class="alt sm" data-re="' + a.id + '">End</button>' : "") + '</td></tr>'; }).join("") + '</table></div>' +
        '<div class="card"><b>Assign on a sale</b><div class="row"><select id="as">' + sales.map(function (s) { return '<option value="' + s.id + '">' + esc(s.title) + ' · unassigned $' + cd(s.unallocated_cents) + '</option>'; }).join("") + '</select><select id="aa">' + L.agreements.filter(function (a) { return a.status === "validated"; }).map(function (a) { return '<option value="' + a.id + '">' + esc(a.label) + ' (' + a.pct + '%)</option>'; }).join("") + '</select></div><label class="ck"><input type="checkbox" id="acw"><span>Also credit the receiving producer\'s wallet now</span></label><button id="aap">Assign</button><div id="aar" class="muted"></div></div>' +
        '<div class="card"><b>Already assigned</b><table>' + L.applied.map(function (x) { return '<tr><td>' + esc(x.recipient_name) + ' $' + cd(x.cents) + '<br><small class="muted">' + (x.credited ? "credited to wallet" : "recorded only") + '</small></td><td><button class="alt sm" data-rv="' + x.id + '">Reverse</button></td></tr>'; }).join("") + '</table></div>');
      $("rsv").onclick = function () { C("music-admin", "o_rem_save", { label: $("rl").value, recipient_name: $("rn").value, producer_id: $("rpid").value.trim(), recipient_producer_id: $("rrp").value.trim(), pct: parseFloat($("rpc").value), scope: $("rsc").value, beat_id: $("rbid").value.trim(), note: $("rnt").value }).then(function (j) { $("rsr").textContent = j.status === "validated" ? "Checked: OK." : "Flagged: " + (j.note || ""); S.remainder(); }).catch(function (e) { $("rsr").textContent = e.message; }); };
      $("aap").onclick = function () { C("music-admin", "o_rem_apply", { sale_id: $("as").value, agreement_id: $("aa").value, credit_wallet: $("acw").checked }).then(function (j) { $("aar").textContent = "Assigned $" + cd(j.cents) + (j.credited ? " and credited." : " (recorded only)."); S.remainder(); }).catch(function (e) { $("aar").textContent = e.message; }); };
      [].forEach.call(document.querySelectorAll("[data-re]"), function (b) { b.onclick = function () { C("music-admin", "o_rem_end", { id: b.dataset.re }).then(S.remainder); }; });
      [].forEach.call(document.querySelectorAll("[data-rv]"), function (b) { b.onclick = function () { if (confirm("Reverse this assignment?")) C("music-admin", "o_rem_reverse", { id: b.dataset.rv }).then(S.remainder); }; });
    }).catch(err);
  };
  S.home = function () {
    C("music-api", "o_home_get").then(function (j) {
      var s = j.site || {}, lines = function (a, f) { return (a || []).map(f).join("\n"); };
      body('<small class="muted">What shows on the public Music home page, release calendar and search results.</small>' +
        '<label>Headline</label><input id="hh" value="' + esc(s.headline || "") + '"><label>Sub line</label><input id="hs" value="' + esc(s.sub || "") + '"><label>Announcement banner</label><input id="hb" value="' + esc(s.banner || "") + '">' +
        '<label>Search title (SEO)</label><input id="hst" value="' + esc(s.seo_title || "") + '"><label>Search description (SEO)</label><input id="hsd" value="' + esc(s.seo_desc || "") + '">' +
        '<label>Spotlights (one per line: Title | Text | link)</label><textarea id="hsp" rows="3">' + esc(lines(s.spotlights, function (x) { return [x.title, x.text, x.url].join(" | "); })) + '</textarea>' +
        '<label>Release calendar (one per line: YYYY-MM-DD | Title | link)</label><textarea id="hcal" rows="3">' + esc(lines(s.calendar, function (x) { return [x.date, x.title, x.url].join(" | "); })) + '</textarea>' +
        '<label>POTENT brand divisions (one per line: Name | Text | link)</label><textarea id="hdv" rows="3">' + esc(lines(s.divisions, function (x) { return [x.name, x.text, x.url].join(" | "); })) + '</textarea>' +
        '<button id="hsv">Save</button> <span id="hres" class="muted"></span>');
      var parse = function (id, f) { return $(id).value.split("\n").map(function (l) { var p = l.split("|").map(function (x) { return x.trim(); }); return p[0] ? f(p) : null; }).filter(Boolean); };
      $("hsv").onclick = function () { C("music-api", "o_home_set", { headline: $("hh").value, sub: $("hs").value, banner: $("hb").value, seo_title: $("hst").value, seo_desc: $("hsd").value, spotlights: parse("hsp", function (p) { return { title: p[0], text: p[1] || "", url: p[2] || "" }; }), calendar: parse("hcal", function (p) { return { date: p[0], title: p[1] || "", url: p[2] || "" }; }), divisions: parse("hdv", function (p) { return { name: p[0], text: p[1] || "", url: p[2] || "" }; }), featured_ids: (s.featured_ids || []) }).then(function () { $("hres").textContent = "Saved."; }).catch(function (e) { $("hres").textContent = e.message; }); };
    }).catch(err);
  };
  window.ADM = { init: function (call, e, u, dl, el) { C = call; esc = e; usd = u; dlf = dl; box = el; cur = "orders"; go(cur); } };
})();
