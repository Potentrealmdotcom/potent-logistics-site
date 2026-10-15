/* The Potent Playbook — Course app
 * Renders lessons/modules, sidebar nav, progress (localStorage), auth gating.
 * Auth: ?session_id= -> POST /.netlify/functions/playbook-verify {sessionId}
 *       else stored pb_email -> POST /.netlify/functions/playbook-entitlements {email}
 * Tiers: null (preview: lesson 1 only) | regular (lessons 1-14) | deluxe (+ all modules)
 */
(function () {
  "use strict";

  var VERIFY_URL = "/.netlify/functions/playbook-verify";
  var ENTITLEMENTS_URL = "/.netlify/functions/playbook-entitlements";
  var SALES_URL = "/playbook/";
  var AI_LINE = "AI doesn't come out 100% accurate \u2014 you have to edit it, mess around with it, play around with it to get what you want.";

  var state = {
    tier: localStorage.getItem("pb_tier") || null,
    addons: safeJSON("pb_addons", {}),
    email: localStorage.getItem("pb_email") || "",
    progress: safeJSON("pb_progress", {}),
    checks: safeJSON("pb_checks", {}),
    current: null,
    toolsLive: {}
  };
  if (state.tier !== "regular" && state.tier !== "deluxe") state.tier = null;

  function safeJSON(k, fb) {
    try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? fb : v; }
    catch (e) { return fb; }
  }
  function $(id) { return document.getElementById(id); }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"); }

  /* ---------- catalog ---------- */
  var ALL = [];
  PB_COURSE.lessons.forEach(function (l) { l.kind = "lesson"; ALL.push(l); });
  PB_COURSE.modules.forEach(function (m) { m.kind = "module"; ALL.push(m); });
  var TOOLS = PB_COURSE.tools || [];

  function canView(item) {
    if (item.preview) return true;
    if (item.tier === "deluxe") return state.tier === "deluxe";
    return state.tier === "regular" || state.tier === "deluxe";
  }
  function viewable() { return ALL.filter(canView); }

  /* ---------- auth ---------- */
  function normalizeEnt(r) {
    r = r || {};
    var t = String(r.tier || r.plan || r.product || r.level || "").toLowerCase();
    var tier = t.indexOf("deluxe") > -1 ? "deluxe"
      : (t.indexOf("regular") > -1 || t.indexOf("standard") > -1 || t === "100" || t === "297") ? "regular" : null;
    var addons = {};
    var a = r.addons || r.tools || r.entitlements || [];
    if (Array.isArray(a)) a.forEach(function (k) { addons[String(k).toLowerCase()] = true; });
    else if (a && typeof a === "object") Object.keys(a).forEach(function (k) { if (a[k]) addons[k.toLowerCase()] = true; });
    return { tier: tier, addons: addons, email: r.email || r.customer_email || null };
  }
  function saveEnt(ent) {
    if (ent.tier) { state.tier = ent.tier; localStorage.setItem("pb_tier", ent.tier); }
    if (ent.addons && Object.keys(ent.addons).length) {
      state.addons = Object.assign({}, state.addons, ent.addons);
      localStorage.setItem("pb_addons", JSON.stringify(state.addons));
    }
    if (ent.email) { state.email = ent.email; localStorage.setItem("pb_email", ent.email); }
  }
  function postJSON(url, body) {
    return fetch(url, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.json();
    });
  }
  function checkAuth() {
    var params = new URLSearchParams(window.location.search);
    var sid = params.get("session_id") || params.get("sessionId");
    if (sid && /^cs_/.test(sid)) {
      postJSON(VERIFY_URL, { sessionId: sid }).then(function (r) {
        saveEnt(normalizeEnt(r));
        history.replaceState(null, "", window.location.pathname + window.location.hash);
        boot();
      }).catch(function () { boot(); });
      return;
    }
    if (state.email) {
      postJSON(ENTITLEMENTS_URL, { email: state.email }).then(function (r) {
        saveEnt(normalizeEnt(r)); boot();
      }).catch(function () { boot(); });
      return;
    }
    boot();
  }
  function unlockWithEmail() {
    var input = $("pbEmail");
    var email = (input.value || "").trim();
    if (!email || email.indexOf("@") < 0) { toast("Enter a valid email address."); return; }
    toast("Checking your purchase\u2026");
    postJSON(ENTITLEMENTS_URL, { email: email }).then(function (r) {
      var ent = normalizeEnt(r);
      if (!ent.tier) { toast("No playbook purchase found for that email."); return; }
      saveEnt(ent);
      toast(ent.tier === "deluxe" ? "Deluxe unlocked. Welcome in." : "Playbook unlocked. Welcome in.");
      renderAll();
    }).catch(function () { toast("Couldn't reach the server. Try again in a moment."); });
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 2600);
  }

  /* ---------- nav ---------- */
  var PART_ORDER = ["Foundation", "Legal", "Production", "Launch", "Deluxe Exclusive"];
  function renderNav() {
    var nav = $("courseNav"); nav.innerHTML = "";
    var groups = {};
    ALL.forEach(function (it) {
      (groups[it.part] = groups[it.part] || []).push(it);
    });
    PART_ORDER.forEach(function (part) {
      var items = groups[part]; if (!items || !items.length) return;
      var h = document.createElement("div");
      h.className = "nav-part";
      h.innerHTML = (part === "Deluxe Exclusive" ? "&#128274; " : "") + esc(part);
      nav.appendChild(h);
      items.forEach(function (it) {
        var b = document.createElement("button");
        b.type = "button";
        var locked = !canView(it);
        b.className = "nav-item" + (locked ? " locked" : "") + (state.current === it.id ? " active" : "") + (state.progress[it.id] ? " done" : "");
        b.dataset.id = it.id;
        b.innerHTML = '<span class="n">' + esc(it.num) + '</span><span>' + esc(it.title) +
          (locked ? '</span><span class="lock">&#128274;</span>' : '</span>');
        b.addEventListener("click", function () { openItem(it.id); });
        nav.appendChild(b);
      });
    });
    // tools
    var th = document.createElement("div");
    th.className = "nav-part"; th.textContent = "Tools";
    nav.appendChild(th);
    TOOLS.forEach(function (tool) {
      var owned = !!state.addons[tool.addon];
      var live = state.toolsLive[tool.file] !== false;
      var a = document.createElement(owned && live ? "a" : "button");
      a.className = "nav-tool";
      if (owned && live) { a.href = tool.file; }
      else {
        a.type = "button";
        a.addEventListener("click", function () { openTool(tool); });
      }
      a.innerHTML = '<span class="n" style="font-family:\'Bebas Neue\';color:var(--gold);min-width:26px">&#9670;</span><span>' +
        esc(tool.title) + '</span><span class="lock">' + (owned ? (live ? "" : "&#9888;") : "&#128274;") + "</span>";
      nav.appendChild(a);
    });
    renderTierBadge();
  }
  function renderTierBadge() {
    var b = $("tierBadge");
    if (state.tier === "deluxe") { b.textContent = "\u2726 Deluxe member"; }
    else if (state.tier === "regular") { b.textContent = "Playbook member"; }
    else { b.textContent = "Preview access"; }
    var gate = $("emailGate");
    if (gate) gate.style.display = state.tier ? "none" : "";
    var em = $("pbEmail"); if (em && state.email) em.value = state.email;
  }

  /* ---------- block renderers ---------- */
  function renderBlocks(blocks) {
    return blocks.map(function (b) {
      switch (b.t) {
        case "lead": return '<div class="block lead">' + b.html + "</div>";
        case "p": return '<div class="block"><p>' + b.html + "</p></div>";
        case "h": return '<div class="block"><h3>' + esc(b.text) + "</h3></div>";
        case "quote": return '<div class="block"><div class="pullquote">\u201c' + esc(b.text) + "\u201d</div></div>";
        case "list": return '<div class="block"><ul class="blist">' + b.items.map(function (i) { return "<li>" + i + "</li>"; }).join("") + "</ul></div>";
        case "steps": return '<div class="block"><div class="steps">' + b.items.map(function (s) {
          return '<div class="step"><div><strong>' + esc(s.t) + "</strong><p>" + esc(s.d) + "</p></div></div>";
        }).join("") + "</div></div>";
        case "action": return '<div class="block"><div class="action-box"><div class="ab-label">\u2710 Your move</div><p>' + b.html + "</p></div></div>";
        case "callout": return '<div class="block"><div class="callout"><div class="co-title">' + esc(b.title) + "</div><p>" + b.html + "</p></div></div>";
        case "aidisc": return '<div class="block"><div class="ai-disclaimer"><span class="ai-tag">AI NOTE</span><p>\u201c' + esc(AI_LINE) + "\u201d \u2014 Tony</p></div></div>";
        case "links": return '<div class="block"><div class="rlinks">' + b.items.map(function (l) {
          return '<a class="rlink" href="' + esc(l.url) + '" target="_blank" rel="noopener"><strong>' + esc(l.label) + "</strong><span>" + esc(l.note) + "</span></a>";
        }).join("") + "</div></div>";
        case "prompts": return '<div class="block">' + b.items.map(function (p, i) {
          return '<div class="prompt-card"><div class="prompt-body"><strong>' + esc(p.title) + "</strong><p>" + esc(p.text) + "</p></div>" +
            '<button class="copy-btn" type="button" data-prompt="' + i + '">Copy</button></div>';
        }).join("") + "</div>";
        case "templates": return '<div class="block"><div class="tpl-grid">' + b.items.map(function (tp) {
          return '<div class="tpl"><strong>' + esc(tp.name) + "</strong><p>" + esc(tp.desc) + "</p>" +
            '<a href="' + esc(tp.url) + '" target="_blank" rel="noopener">Open in Kittl \u2197</a></div>';
        }).join("") + "</div></div>";
        case "gallery": return '<div class="block"><div class="cgallery">' + b.items.map(function (g) {
          return '<figure><img src="' + esc(g.src) + '" alt="' + esc(g.cap.replace(/"/g, "")) + '" loading="lazy" /><figcaption>' + esc(g.cap) + "</figcaption></figure>";
        }).join("") + "</div></div>";
        case "flow": return '<div class="block"><div class="vflow">' + b.items.map(function (s, i) {
          return (i ? '<div class="vf-arrow">\u2193</div>' : "") +
            '<div class="vf-step"><strong>' + esc(s.t) + "</strong><p>" + esc(s.d) + "</p></div>";
        }).join("") + "</div></div>";
        case "timeline": return '<div class="block"><div class="tline">' + b.items.map(function (r) {
          return '<div class="trow"><span class="tt">' + esc(r.t) + "</span><div><strong>" + esc(r.title) + "</strong><p>" + esc(r.d) + "</p></div></div>";
        }).join("") + "</div></div>";
        case "checklist": return '<div class="block"><div class="check" data-checklist>' + b.items.map(function (c, i) {
          return '<label><input type="checkbox" data-ci="' + i + '" /><span>' + esc(c) + "</span></label>";
        }).join("") + "</div></div>";
        case "chart": return '<div class="block">' + renderChart() + "</div>";
        default: return "";
      }
    }).join("");
  }

  /* ---------- the sell-out workflow chart (lesson 11) ---------- */
  function stage(tag, title, sub, boxes) {
    var html = '<div class="stage"><div class="stage-tag">' + esc(tag) + "</div><h4>" + esc(title) + "</h4>" +
      '<p class="stage-sub">' + esc(sub) + "</p><div class=\"sboxes\">";
    boxes.forEach(function (bx, i) {
      if (i) html += '<div class="sarrow">\u25bc</div>';
      html += '<div class="sbox"><span class="sn">' + (i + 1) + '</span><div><strong>' + esc(bx[0]) + "</strong><span>" + esc(bx[1]) + "</span></div></div>";
    });
    return html + "</div></div>";
  }
  function renderChart() {
    var h = '<div class="syschart" role="img" aria-label="Full sell-out drop workflow: trademark filing to selling live online and in person">';
    h += '<div class="syschart-head"><h4>The Sell-Out Workflow</h4><p>Trademark filing \u2192 brand setup \u2192 design \u2192 production \u2192 marketing \u2192 selling live. Top to bottom. No skipping steps.</p></div>';

    h += stage("Stage 1 \u00b7 Legal lock-in", "Trademark Filing", "Protect the name before it has value \u2014 this is where the workflow starts.", [
      ["USPTO search (free)", "tsdr.uspto.gov \u2014 search your name + variations in Class 25. Taken? Pick a new name now."],
      ["File your trademark", "USPTO Trademark Center \u2014 1A (use) or 1B (intent-to-use) basis, Class 25 for clothing."],
      ["EIN (free)", "irs.gov \u2014 minutes. Needed for business accounts and taxes."],
      ["LLC", "Your state's business site \u2014 separates you from the business."]
    ]);

    h += stage("Stage 2 \u00b7 Foundation", "Brand Setup", "Identity, storefront, and a direct line to your buyers.", [
      ["Brand identity", "What you stand for, the energy you bring, who feels it \u2014 Lesson 3."],
      ["Shopify store", "One product live with a converting page \u2014 Lesson 10."],
      ["SMS list", "Privy/Omnisend pop-up \u2014 \u201cget the drop 1 hour early\u201d \u2014 Lesson 12."],
      ["Reseller certificate", "State Dept. of Revenue \u2014 unlocks wholesale pricing as you scale."]
    ]);

    h += stage("Stage 3 \u00b7 Creative", "Design", "No school needed \u2014 references, AI, and taste.", [
      ["20 references", "Collect images that feel like your brand. Study what repeats."],
      ["AI concepts", "ChatGPT generates 5 concepts in your brand's voice."],
      ["Build in Kittl", "Typography + graphic. Free to start."],
      ["Mockup", "PhotoRoom virtual model \u2014 see it on a body before spending a dollar."]
    ]);

    h += stage("Stage 4 \u00b7 Fulfillment", "Production", "Zero inventory. The order exists after the customer pays.", [
      ["Upload to Tapstitch", "Print on demand \u2014 order 1 or 100."],
      ["Neck labels", "Designed in Kittl, added in Tapstitch's branding tab \u2014 $0."],
      ["Hang tags + polymailers", "Branded packaging that erases the \u201cdropship look.\u201d"],
      ["Ships on order", "You never touch inventory. Shopify \u2192 printer \u2192 customer."]
    ]);

    h += stage("Stage 5 \u00b7 Demand", "Marketing", "Content is the marketing. Scarcity is the brand.", [
      ["AI campaign visuals", "3\u20135 Kive/PhotoRoom shots \u2014 a $1,000 shoot for free."],
      ["Document everything", "Behind-the-scenes, fabric close-ups, the process."],
      ["T-48h \u00b7 Tease", "Sleeve. Tag. Fabric. Never the full product."],
      ["T-24h \u00b7 Hype", "Build energy everywhere. Let them ask \u201cwhat? when?\u201d"],
      ["T-1h \u00b7 Pressure", "SMS: \u201cDrop live in 1 hour. 50 pieces only.\u201d"]
    ]);

    // Stage 6: two lanes
    h += '<div class="stage"><div class="stage-tag">Stage 6 \u00b7 Revenue</div><h4>Selling Live</h4>' +
      '<p class="stage-sub">Two lanes, same drop. Online scales it \u2014 in person makes it real.</p>' +
      '<div class="lanes">' +
      '<div class="lane online"><h5>\u25b6 Online</h5><ul>' +
      "<li>\u201cLIVE NOW\u201d everywhere at once \u2014 site, SMS, social.</li>" +
      "<li>Shopify checkout live \u2014 50 pieces, 24 hours.</li>" +
      "<li>T-0 SMS blast to the full list.</li>" +
      "<li>T+24h: \u201cSOLD OUT\u201d post. No restocks \u2014 ever.</li>" +
      "</ul></div>" +
      '<div class="lane inperson"><h5>\u25b6 In Person</h5><ul>' +
      "<li>Pop-up where your audience hangs out \u2014 presence, not a pitch.</li>" +
      "<li>Wear the product. Let people ask.</li>" +
      "<li>Collect phone numbers at every event \u2014 the in-person list is gold.</li>" +
      "<li>Cash + card on the spot. Announce the next drop face-to-face.</li>" +
      "</ul></div>" +
      "</div></div>";

    return h + "</div>";
  }

  /* ---------- upgrade / locked views ---------- */
  function upgradeHTML(item) {
    var isDeluxe = item.tier === "deluxe";
    var title = isDeluxe ? "Deluxe Exclusive" : "Unlock the Full System";
    var body = isDeluxe
      ? "This module is part of the <strong>Deluxe Edition</strong> \u2014 the secret supplier directory, AI campaign videos, prompt packs, template vault, and the full resource index."
      : "This lesson is part of <strong>The Potent Playbook</strong> \u2014 all 14 lessons of the $0-inventory brand system, step by step.";
    var cta = isDeluxe ? "Upgrade to Deluxe \u2014 $297" : "Get the Playbook \u2014 $100";
    return '<div class="upgrade"><div class="u-label">' + esc(item.part) + " \u00b7 " + esc(item.num) + "</div>" +
      "<h2>" + title + "</h2><p>" + body + "</p>" +
      '<p class="u-terms">One payment. Instant access. <strong>All sales final.</strong></p>' +
      '<a class="button" href="' + SALES_URL + '">' + cta + "</a></div>";
  }
  function toolLockedHTML(tool) {
    var owned = !!state.addons[tool.addon];
    var msg = owned
      ? "This tool hasn't been added to your library yet \u2014 check back after it's released to your account."
      : "The <strong>" + esc(tool.title) + "</strong> is a separate add-on: " + esc(tool.desc);
    return '<div class="upgrade"><div class="u-label">Playbook Tools</div><h2>' + esc(tool.title) + "</h2><p>" + msg + "</p>" +
      (owned ? "" : '<p class="u-terms">One payment. Instant access. <strong>All sales final.</strong></p><a class="button" href="' + SALES_URL + '">Get ' + esc(tool.title) + "</a>") +
      "</div>";
  }

  /* ---------- main render ---------- */
  function openItem(id) {
    var item = ALL.find(function (x) { return x.id === id; });
    if (!item) return;
    state.current = id;
    document.body.classList.remove("nav-open");
    try { history.replaceState(null, "", "#" + id); } catch (e) {}
    renderNav();
    var c = $("content");
    var idx = viewable().findIndex(function (x) { return x.id === id; });
    $("crumb").textContent = item.part;
    $("lessonCount").textContent = canView(item) && idx > -1 ? "Part " + item.num + " \u00b7 " + (idx + 1) + " of " + viewable().length : "Part " + item.num;

    if (!canView(item)) { c.innerHTML = upgradeHTML(item); window.scrollTo(0, 0); return; }

    var h = '<div class="lesson-head"><div class="part-label">' + esc(item.part) + " \u00b7 Lesson " + esc(item.num) + "</div>" +
      "<h1>" + esc(item.title) + "</h1>" +
      '<div class="lesson-meta"><span>' + esc(item.est || "") + "</span>" +
      (item.tier === "deluxe" ? '<span style="color:var(--gold)">\u2726 Deluxe</span>' : "") +
      (state.progress[item.id] ? '<span style="color:var(--gold)">\u2713 Complete</span>' : "") + "</div>" +
      (item.intro ? '<p class="lesson-intro">\u201c' + esc(item.intro) + "\u201d</p>" : "") + "</div>";

    h += renderBlocks(item.blocks);
    h += lessonFoot(item);
    c.innerHTML = h;
    bindContent(item);
    window.scrollTo(0, 0);
  }

  function lessonFoot(item) {
    var vis = viewable();
    var i = vis.findIndex(function (x) { return x.id === item.id; });
    var prev = i > 0 ? vis[i - 1] : null;
    var next = i < vis.length - 1 ? vis[i + 1] : null;
    var done = !!state.progress[item.id];
    return '<div class="lesson-foot">' +
      (prev ? '<button class="foot-btn" type="button" data-nav="' + prev.id + '">\u2190 ' + esc(prev.title) + "</button>" : '<button class="foot-btn" type="button" disabled>\u2190 Start</button>') +
      '<button class="foot-btn primary" type="button" data-complete="' + item.id + '">' + (done ? "\u2713 Completed \u2014 undo" : "Mark complete \u2713") + "</button>" +
      (next ? '<button class="foot-btn" type="button" data-nav="' + next.id + '">' + esc(next.title) + " \u2192</button>" : '<button class="foot-btn" type="button" disabled">End \u2192</button>') +
      "</div>";
  }

  function openTool(tool) {
    state.current = tool.id;
    document.body.classList.remove("nav-open");
    $("crumb").textContent = "Playbook Tools";
    $("lessonCount").textContent = "";
    renderNav();
    $("content").innerHTML = toolLockedHTML(tool);
    window.scrollTo(0, 0);
  }

  function bindContent(item) {
    var c = $("content");
    c.querySelectorAll("[data-nav]").forEach(function (b) {
      b.addEventListener("click", function () { openItem(b.dataset.nav); });
    });
    c.querySelectorAll("[data-complete]").forEach(function (b) {
      b.addEventListener("click", function () {
        var id = b.dataset.complete;
        if (state.progress[id]) delete state.progress[id]; else state.progress[id] = true;
        localStorage.setItem("pb_progress", JSON.stringify(state.progress));
        toast(state.progress[id] ? "Lesson complete. Keep going." : "Marked incomplete.");
        renderProgress();
        openItem(id);
      });
    });
    // copy buttons
    var promptTexts = [];
    (item.blocks || []).forEach(function (bl) { if (bl.t === "prompts") bl.items.forEach(function (p) { promptTexts.push(p.text); }); });
    c.querySelectorAll(".copy-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var txt = promptTexts[+btn.dataset.prompt] || "";
        copyText(txt).then(function () {
          btn.textContent = "Copied"; btn.classList.add("copied");
          setTimeout(function () { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 1600);
        });
      });
    });
    // checklist persistence
    var saved = state.checks[item.id] || [];
    c.querySelectorAll("[data-checklist] input").forEach(function (box) {
      var i = +box.dataset.ci;
      if (saved.indexOf(i) > -1) { box.checked = true; box.closest("label").classList.add("checked"); }
      box.addEventListener("change", function () {
        var arr = state.checks[item.id] || (state.checks[item.id] = []);
        var at = arr.indexOf(i);
        if (box.checked && at < 0) arr.push(i);
        if (!box.checked && at > -1) arr.splice(at, 1);
        localStorage.setItem("pb_checks", JSON.stringify(state.checks));
        box.closest("label").classList.toggle("checked", box.checked);
      });
    });
  }

  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
    return new Promise(function (res) {
      var ta = document.createElement("textarea");
      ta.value = t; document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch (e) {}
      document.body.removeChild(ta); res();
    });
  }

  function renderProgress() {
    var vis = viewable();
    var done = vis.filter(function (x) { return state.progress[x.id]; }).length;
    var pct = vis.length ? Math.round((done / vis.length) * 100) : 0;
    $("progressBar").style.width = pct + "%";
    $("progressPct").textContent = pct + "%";
  }

  function renderAll() {
    renderNav();
    renderProgress();
    openItem(state.current || "l1");
    checkToolsLive();
  }

  function checkToolsLive() {
    // Gracefully detect tool pages built by another agent; never link a 404.
    TOOLS.forEach(function (tool) {
      fetch(tool.file, { method: "HEAD" }).then(function (r) {
        var live = r.ok;
        if (state.toolsLive[tool.file] !== live) { state.toolsLive[tool.file] = live; renderNav(); }
      }).catch(function () {
        if (state.toolsLive[tool.file] !== false) { state.toolsLive[tool.file] = false; renderNav(); }
      });
    });
  }

  function boot() {
    renderAll();
    // deep link
    var hash = (window.location.hash || "").replace("#", "");
    if (hash && ALL.some(function (x) { return x.id === hash; })) openItem(hash);
  }

  /* ---------- chrome ---------- */
  $("menuBtn").addEventListener("click", function () { document.body.classList.toggle("nav-open"); });
  $("scrim").addEventListener("click", function () { document.body.classList.remove("nav-open"); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") document.body.classList.remove("nav-open"); });
  $("pbEmailBtn").addEventListener("click", unlockWithEmail);
  $("pbEmail").addEventListener("keydown", function (e) { if (e.key === "Enter") unlockWithEmail(); });

  checkAuth();
})();
