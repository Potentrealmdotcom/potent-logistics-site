/* POTENT Bodega — vanilla JS, no build step */
(function () {
  "use strict";

  // Product photos are served from the POTENT static host (the repo push channel is
  // text-only, so binaries live on the server). Catalog paths stay relative ("img/...").
  var IMG_BASE = "https://voice.potentworld.online/static/bodega/";
  var API = {
    checkout: "/.netlify/functions/bodega-checkout",
    ownership: "/.netlify/functions/bodega-ownership",
    list: "/.netlify/functions/bodega-list",
    market: "/.netlify/functions/bodega-market",
    buy: "/.netlify/functions/bodega-buy",
    admin: "/.netlify/functions/bodega-admin"
  };

  var state = {
    catalog: [],
    byHandle: {},
    history: {}, // handle -> resale count from market endpoint
    listings: [],
    activeFilter: "All",
    search: "",
    view: "shop",
    bag: [],
    myEmail: "",
    myData: null,
    detailHandle: null,
    // viewer state
    viewer: { index: 0, scale: 1, interacted: false, timer: null, mode: "frames", drag: null, pointers: {}, pinchDist: 0 }
  };

  // ---------- helpers ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }
  function fmt(n) {
    var num = Number(n) || 0;
    return "$" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtCents(c) { return fmt((Number(c) || 0) / 100); }
  function fmtDate(v) {
    if (!v) return "—";
    var d = new Date(v);
    if (isNaN(d.getTime())) return String(v);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  }
  function toast(msg, isError) {
    var wrap = $("#toastWrap");
    if (!wrap) return;
    var el = document.createElement("div");
    el.className = "toast" + (isError ? " error" : "");
    el.textContent = msg;
    wrap.appendChild(el);
    setTimeout(function () { el.remove(); }, 5200);
  }
  function showBanner(msg) {
    var b = $("#banner");
    if (!b) return;
    b.textContent = msg;
    b.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(function () { b.hidden = true; }, 9000);
  }
  function isSoldOut(p) {
    return p && Number(p.totalInventory) === 0 && Number(p.variantInventory) <= 0;
  }
  async function fetchJson(url, opts) {
    var res = await fetch(url, opts);
    var data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    return { res: res, data: data };
  }
  async function headOk(url) {
    try {
      var r = await fetch(url, { method: "HEAD" });
      return r.ok;
    } catch (e) { return false; }
  }
  function placeholderHtml(cls) {
    return '<div class="placeholder ' + esc(cls || "") + '"><span>POTENT</span></div>';
  }
  function mediaHtml(p, cls) {
    if (p && p.images && p.images.length) {
      return '<img src="' + esc(p.images[0]) + '" alt="' + esc(p.title) + '" loading="lazy" />';
    }
    return placeholderHtml(cls);
  }

  // ---------- bag (localStorage) ----------
  function loadBag() {
    try {
      var raw = localStorage.getItem("potent-bodega-bag");
      state.bag = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(state.bag)) state.bag = [];
    } catch (e) { state.bag = []; }
  }
  function saveBag() {
    try { localStorage.setItem("potent-bodega-bag", JSON.stringify(state.bag)); } catch (e) {}
    updateBagBadge();
    renderBag();
  }
  function bagQtyTotal() { return state.bag.reduce(function (s, i) { return s + (Number(i.qty) || 0); }, 0); }
  function updateBagBadge() {
    var el = $("#bagCount");
    if (el) el.textContent = String(bagQtyTotal());
  }
  function addToBag(handle, qty) {
    var p = state.byHandle[handle];
    if (!p) { toast("Piece not found.", true); return; }
    if (isSoldOut(p)) { toast("That piece is sold out.", true); return; }
    qty = Math.max(1, Number(qty) || 1);
    var found = state.bag.find(function (i) { return i.handle === handle; });
    if (found) found.qty += qty; else state.bag.push({ handle: handle, qty: qty });
    saveBag();
    toast("Added to bag: " + p.title);
    openBag();
  }

  // ---------- hero ----------
  async function initHero() {
    var ok = await headOk("media/vault-hero.mp4");
    if (!ok) return; // styled fallback stays
    var v = $("#heroVideo");
    var fb = $("#heroFallback");
    var ov = $("#heroOverlayText");
    if (!v) return;
    v.src = "media/vault-hero.mp4";
    v.hidden = false;
    if (fb) fb.hidden = true;
    if (ov) ov.hidden = false;
    var p = v.play();
    if (p && p.catch) p.catch(function () {});
  }

  // ---------- catalog / filters ----------
  async function loadCatalog() {
    var loading = $("#shopLoading");
    try {
      var r = await fetch("catalog.json", { headers: { "Accept": "application/json" } });
      if (!r.ok) throw new Error("catalog " + r.status);
      var data = await r.json();
      state.catalog = Array.isArray(data) ? data : [];
      state.byHandle = {};
      state.catalog.forEach(function (p) {
        if (!p) return;
        if (p.handle) state.byHandle[p.handle] = p;
        if (Array.isArray(p.images)) p.images = p.images.map(function (src) {
          return (typeof src === "string" && src.indexOf("img/") === 0) ? IMG_BASE + src : src;
        });
      });
    } catch (e) {
      state.catalog = [];
      toast("Could not load the catalog. Please refresh.", true);
    } finally {
      if (loading) loading.hidden = true;
    }
    buildChips();
    renderShop();
    // if we landed on a detail hash, re-render detail now catalog is ready
    handleHash();
  }

  async function loadMarket() {
    try {
      var out = await fetchJson(API.market, { method: "GET" });
      if (!out.res.ok) throw new Error("market " + out.res.status);
      var data = out.data || {};
      state.listings = Array.isArray(data.listings) ? data.listings : [];
      state.history = data.history && typeof data.history === "object" ? data.history : {};
    } catch (e) {
      state.listings = [];
      state.history = {};
      // silent-ish: marketplace view will show empty + toast only if user opens it fresh;
      // still surface per robustness rule
      // (avoid double-toast on load if catalog also failed — keep one)
      console.warn("bodega-market failed", e);
    }
    renderMarket();
  }

  function buildChips() {
    var wrap = $("#filterChips");
    if (!wrap) return;
    var types = [];
    var tagCount = {};
    state.catalog.forEach(function (p) {
      if (p.productType && types.indexOf(p.productType) === -1) types.push(p.productType);
      (p.tags || []).forEach(function (t) { if (t) tagCount[t] = (tagCount[t] || 0) + 1; });
    });
    types.sort();
    var tags = Object.keys(tagCount).sort(function (a, b) { return tagCount[b] - tagCount[a] || a.localeCompare(b); }).slice(0, 10);
    // de-dupe tags that duplicate a type
    tags = tags.filter(function (t) { return types.indexOf(t) === -1; });
    var filters = ["All"].concat(types, tags);
    if (filters.indexOf(state.activeFilter) === -1) state.activeFilter = "All";
    wrap.innerHTML = filters.map(function (f) {
      return '<button type="button" class="chip' + (f === state.activeFilter ? " is-active" : "") + '" data-filter="' + esc(f) + '">' + esc(f) + "</button>";
    }).join("");
    $$(".chip", wrap).forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.activeFilter = btn.getAttribute("data-filter");
        buildChipsActiveOnly();
        showView("shop");
        renderShop();
      });
    });
  }
  function buildChipsActiveOnly() {
    $$("#filterChips .chip").forEach(function (c) {
      c.classList.toggle("is-active", c.getAttribute("data-filter") === state.activeFilter);
    });
  }

  function filteredProducts() {
    var q = state.search.trim().toLowerCase();
    return state.catalog.filter(function (p) {
      if (state.activeFilter !== "All") {
        var match = p.productType === state.activeFilter || (p.tags || []).indexOf(state.activeFilter) !== -1;
        if (!match) return false;
      }
      if (q) {
        var hay = (p.title + " " + (p.productType || "") + " " + (p.tags || []).join(" ")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      return true;
    });
  }

  function renderShop() {
    var grid = $("#shopGrid");
    var empty = $("#shopEmpty");
    if (!grid) return;
    var items = filteredProducts();
    if (empty) empty.hidden = items.length !== 0;
    grid.innerHTML = items.map(function (p) {
      var sold = isSoldOut(p);
      return '<article class="card" data-handle="' + esc(p.handle) + '" tabindex="0" role="button" aria-label="' + esc(p.title) + '">' +
        '<div class="card-media">' + mediaHtml(p) +
        (p.images && p.images.length >= 4 ? '<span class="badge badge-360">360°</span>' : "") +
        (sold ? '<span class="badge badge-soldout">SOLD OUT</span>' : "") +
        "</div>" +
        '<div class="card-body"><div class="card-title">' + esc(p.title) + '</div>' +
        '<div class="card-price">' + fmt(p.price) + "</div>" +
        (p.productType ? '<div class="card-meta">' + esc(p.productType) + "</div>" : "") +
        "</div></article>";
    }).join("");
    $$(".card", grid).forEach(function (card) {
      function go() { location.hash = "#/p/" + card.getAttribute("data-handle"); }
      card.addEventListener("click", go);
      card.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    });
  }

  // ---------- views / routing ----------
  function showView(name) {
    state.view = name;
    ["shop", "marketplace", "mypieces", "detail"].forEach(function (v) {
      var el = $("#view-" + v);
      if (el) el.hidden = v !== name;
    });
    $$(".nav-btn").forEach(function (b) {
      b.classList.toggle("is-active", b.getAttribute("data-view") === name || (name === "detail" && b.getAttribute("data-view") === "shop"));
    });
    if (name === "marketplace") { loadMarket(); }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleHash() {
    var h = location.hash || "#/shop";
    if (h.indexOf("#/p/") === 0) {
      var handle = decodeURIComponent(h.slice(4));
      renderDetail(handle);
      return;
    }
    if (h === "#/marketplace") { showView("marketplace"); return; }
    if (h === "#/mypieces") { showView("mypieces"); return; }
    // default shop
    if (state.view === "detail") showView("shop");
    else {
      // keep current non-detail view if hash is shop-ish
      if (h === "#/shop" || h === "#/" || h === "") showView("shop");
    }
  }

  // ---------- product detail + 3D viewer ----------
  function stopAutoRotate() {
    if (state.viewer.timer) { clearInterval(state.viewer.timer); state.viewer.timer = null; }
  }
  function startAutoRotate(product) {
    stopAutoRotate();
    if (!product.images || product.images.length < 2) return;
    state.viewer.timer = setInterval(function () {
      if (state.viewer.interacted || state.viewer.mode !== "frames") { stopAutoRotate(); return; }
      state.viewer.index = (state.viewer.index + 1) % product.images.length;
      updateViewerFrame(product, false);
    }, 900);
  }
  function markInteracted() {
    state.viewer.interacted = true;
    stopAutoRotate();
  }
  function updateViewerFrame(product, updateThumbs) {
    var stage = $("#viewerStage");
    if (!stage) return;
    var img = $("#mainFrame", stage);
    if (img && product.images && product.images.length) {
      img.src = product.images[state.viewer.index];
      img.alt = product.title;
      img.style.transform = "scale(" + state.viewer.scale + ")";
    }
    if (updateThumbs !== false) {
      $$(".thumb", $("#detailContent")).forEach(function (t, i) {
        t.classList.toggle("is-active", i === state.viewer.index);
      });
    }
  }

  function renderDetail(handle) {
    var p = state.byHandle[handle];
    var container = $("#detailContent");
    if (!container) return;
    if (!state.catalog.length) {
      // catalog still loading — show placeholder view
      showView("detail");
      container.innerHTML = '<div class="empty-state">Loading piece…</div>';
      return;
    }
    if (!p) {
      toast("Piece not found.", true);
      location.hash = "#/shop";
      return;
    }
    state.detailHandle = handle;
    state.viewer = { index: 0, scale: 1, interacted: false, timer: null, mode: "frames", drag: null, pointers: {}, pinchDist: 0 };
    showView("detail");

    var sold = isSoldOut(p);
    var floor = p.resaleFloor != null ? Number(p.resaleFloor) : Number(p.price) || 0;
    var histCount = Number(state.history[handle] || 0);
    var hasImages = p.images && p.images.length > 0;

    var thumbs = hasImages ? '<div class="thumbs">' + p.images.map(function (src, i) {
      return '<button type="button" class="thumb' + (i === 0 ? " is-active" : "") + '" data-idx="' + i + '"><img src="' + esc(src) + '" alt="" /></button>';
    }).join("") + "</div>" : "";

    container.innerHTML =
      '<div class="detail-layout">' +
        '<div>' +
          '<div class="viewer-stage" id="viewerStage">' +
            (hasImages
              ? '<img id="mainFrame" class="main-frame" src="' + esc(p.images[0]) + '" alt="' + esc(p.title) + '" draggable="false" />'
              : '<div class="placeholder viewer-placeholder"><span>POTENT</span></div>') +
            (sold ? '<span class="badge badge-soldout" style="position:absolute;right:10px;top:10px">SOLD OUT</span>' : "") +
            (hasImages && p.images.length >= 4 ? '<span class="badge badge-360" style="position:absolute;left:10px;top:10px">360°</span>' : "") +
          "</div>" +
          '<div class="viewer-tools" id="viewerTools">' +
            '<button type="button" class="btn" id="modeFramesBtn">FRAMES</button>' +
            '<button type="button" class="btn" id="modeVideoBtn" hidden>3D VIDEO</button>' +
            '<button type="button" class="btn" id="mode3dBtn" hidden>TRUE 3D</button>' +
          "</div>" +
          '<p class="viewer-hint">Drag / swipe to spin through frames · Scroll or pinch to zoom (1–3×) · Double-click to reset zoom</p>' +
          thumbs +
        "</div>" +
        '<div class="detail-info">' +
          "<h1>" + esc(p.title) + "</h1>" +
          '<div class="detail-price">' + fmt(p.price) + "</div>" +
          (sold ? '<p><span class="badge badge-soldout" style="position:static">SOLD OUT</span></p>' : "") +
          '<p class="detail-desc">' + esc(p.description || "") + "</p>" +
          '<div class="creator-line">Creator: ' + esc(p.creator || "POTENT") + " · Resale floor " + fmt(floor) + "<br/>" +
          '<span class="muted">Resale floor $' + esc(floor.toFixed ? floor.toFixed(2) : floor) + " — listings below the floor are not allowed.</span></div>" +
          (histCount > 0 ? '<p class="history-line">Verified resale history: ' + histCount + " recorded transfer" + (histCount === 1 ? "" : "s") + "</p>" : "") +
          '<div class="qty-row"><label for="qtyInput">Qty</label>' +
            '<button type="button" id="qtyMinus" aria-label="Decrease quantity">−</button>' +
            '<input id="qtyInput" type="number" min="1" value="1" />' +
            '<button type="button" id="qtyPlus" aria-label="Increase quantity">+</button></div>' +
          '<button type="button" id="addToBagBtn" class="btn btn-primary btn-block"' + (sold ? " disabled" : "") + ">" + (sold ? "SOLD OUT" : "Add to Bag") + "</button>" +
          '<p class="tiny muted" style="margin-top:.7rem">ALL SALES FINAL — no refunds.</p>' +
        "</div>" +
      "</div>";

    // qty controls
    var qtyInput = $("#qtyInput");
    $("#qtyMinus").addEventListener("click", function () { qtyInput.value = Math.max(1, (Number(qtyInput.value) || 1) - 1); });
    $("#qtyPlus").addEventListener("click", function () { qtyInput.value = Math.max(1, (Number(qtyInput.value) || 1) + 1); });
    var addBtn = $("#addToBagBtn");
    if (addBtn) addBtn.addEventListener("click", function () { addToBag(handle, Number(qtyInput.value) || 1); });

    // thumbs
    $$(".thumb", container).forEach(function (t) {
      t.addEventListener("click", function () {
        markInteracted();
        setViewerMode(p, "frames");
        state.viewer.index = Number(t.getAttribute("data-idx")) || 0;
        state.viewer.scale = 1;
        updateViewerFrame(p, true);
      });
    });

    // mode buttons
    $("#modeFramesBtn").addEventListener("click", function () { markInteracted(); setViewerMode(p, "frames"); });
    $("#modeVideoBtn").addEventListener("click", function () { markInteracted(); setViewerMode(p, "video"); });
    $("#mode3dBtn").addEventListener("click", function () { markInteracted(); setViewerMode(p, "3d"); });

    setupViewerInteractions(p);
    startAutoRotate(p);

    // async probes — fail silently
    headOk("media/products/" + encodeURIComponent(handle) + ".mp4").then(function (ok) {
      var b = $("#modeVideoBtn"); if (b && ok) b.hidden = false;
    });
    headOk("models/" + encodeURIComponent(handle) + ".glb").then(function (ok) {
      var b = $("#mode3dBtn"); if (b && ok) b.hidden = false;
    });
  }

  function setViewerMode(p, mode) {
    state.viewer.mode = mode;
    var stage = $("#viewerStage");
    if (!stage) return;
    stopAutoRotate();
    if (mode === "frames") {
      var hasImages = p.images && p.images.length;
      stage.innerHTML = hasImages
        ? '<img id="mainFrame" class="main-frame" src="' + esc(p.images[state.viewer.index]) + '" alt="' + esc(p.title) + '" draggable="false" style="transform:scale(' + state.viewer.scale + ')" />'
        : '<div class="placeholder viewer-placeholder"><span>POTENT</span></div>';
      setupViewerInteractions(p, true);
    } else if (mode === "video") {
      stage.innerHTML = '<video src="media/products/' + esc(encodeURIComponent(p.handle)) + '.mp4" loop muted controls autoplay playsinline></video>';
    } else if (mode === "3d") {
      stage.innerHTML = '<div class="empty-state">Loading 3D…</div>';
      loadModelViewer().then(function () {
        if (state.viewer.mode !== "3d") return;
        stage.innerHTML = '<model-viewer src="models/' + esc(encodeURIComponent(p.handle)) + '.glb" camera-controls auto-rotate alt="' + esc(p.title) + '"></model-viewer>';
      }).catch(function () {
        stage.innerHTML = '<div class="empty-state">3D unavailable for this piece.</div>';
      });
    }
  }

  var modelViewerPromise = null;
  function loadModelViewer() {
    if (window.customElements && window.customElements.get("model-viewer")) return Promise.resolve();
    if (modelViewerPromise) return modelViewerPromise;
    modelViewerPromise = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.type = "module";
      s.src = "https://unpkg.com/@google/model-viewer/dist/model-viewer.min.js";
      s.onload = function () { resolve(); };
      s.onerror = function (e) { reject(e); };
      document.head.appendChild(s);
      // module scripts: onload is unreliable in some browsers — poll briefly
      var tries = 0;
      var iv = setInterval(function () {
        tries++;
        if (window.customElements && window.customElements.get("model-viewer")) { clearInterval(iv); resolve(); }
        if (tries > 40) { clearInterval(iv); /* let caller render anyway */ resolve(); }
      }, 150);
    });
    return modelViewerPromise;
  }

  function setupViewerInteractions(p, skipStageBind) {
    var stage = $("#viewerStage");
    if (!stage || !p.images || !p.images.length) return;
    // Avoid double-binding when called from setViewerMode with fresh innerHTML:
    // innerHTML replacement already drops old listeners, so binding is safe.
    var img = function () { return $("#mainFrame", stage); };

    stage.onpointerdown = function (e) {
      markInteracted();
      state.viewer.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(state.viewer.pointers);
      if (ids.length === 2) {
        var a = state.viewer.pointers[ids[0]], b = state.viewer.pointers[ids[1]];
        state.viewer.pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      state.viewer.drag = { startX: e.clientX, startIndex: state.viewer.index, pointerId: e.pointerId };
      try { stage.setPointerCapture(e.pointerId); } catch (err) {}
    };
    stage.onpointermove = function (e) {
      // pinch zoom
      if (state.viewer.pointers[e.pointerId]) {
        state.viewer.pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
        var ids = Object.keys(state.viewer.pointers);
        if (ids.length === 2) {
          var a = state.viewer.pointers[ids[0]], b = state.viewer.pointers[ids[1]];
          var d = Math.hypot(a.x - b.x, a.y - b.y);
          if (state.viewer.pinchDist > 0) {
            var ratio = d / state.viewer.pinchDist;
            state.viewer.scale = Math.min(3, Math.max(1, state.viewer.scale * ratio));
            var im = img(); if (im) im.style.transform = "scale(" + state.viewer.scale + ")";
          }
          state.viewer.pinchDist = d;
          return;
        }
      }
      if (!state.viewer.drag) return;
      var dx = e.clientX - state.viewer.drag.startX;
      // drag distance maps to frame index: ~45px per frame, wraps around
      var steps = Math.round(dx / 45);
      var len = p.images.length;
      var next = ((state.viewer.drag.startIndex - steps) % len + len) % len;
      if (next !== state.viewer.index) {
        state.viewer.index = next;
        updateViewerFrame(p, true);
      }
    };
    function endPointer(e) {
      delete state.viewer.pointers[e.pointerId];
      if (Object.keys(state.viewer.pointers).length < 2) state.viewer.pinchDist = 0;
      if (state.viewer.drag && state.viewer.drag.pointerId === e.pointerId) state.viewer.drag = null;
    }
    stage.onpointerup = endPointer;
    stage.onpointercancel = endPointer;
    stage.onwheel = function (e) {
      if (state.viewer.mode !== "frames") return;
      e.preventDefault();
      markInteracted();
      var delta = e.deltaY < 0 ? 0.15 : -0.15;
      state.viewer.scale = Math.min(3, Math.max(1, state.viewer.scale + delta));
      var im = img(); if (im) im.style.transform = "scale(" + state.viewer.scale + ")";
    };
    stage.ondblclick = function () {
      state.viewer.scale = 1;
      var im = img(); if (im) im.style.transform = "scale(1)";
    };
  }

  // ---------- bag drawer ----------
  function openBag() {
    $("#bagDrawer").hidden = false;
    $("#bagOverlay").hidden = false;
    renderBag();
  }
  function closeBag() {
    var d = $("#bagDrawer"); if (d) d.hidden = true;
    var o = $("#bagOverlay"); if (o) o.hidden = true;
  }
  function renderBag() {
    var wrap = $("#bagItems");
    var empty = $("#bagEmpty");
    var subEl = $("#bagSubtotal");
    if (!wrap) return;
    if (empty) empty.hidden = state.bag.length !== 0;
    var subtotal = 0;
    wrap.innerHTML = state.bag.map(function (item) {
      var p = state.byHandle[item.handle];
      if (!p) return "";
      subtotal += (Number(p.price) || 0) * (Number(item.qty) || 0);
      return '<div class="bag-item">' +
        '<div>' + mediaHtml(p) + "</div>" +
        "<div><strong>" + esc(p.title) + "</strong><br/><span class=\"muted\">" + fmt(p.price) + '</span><div class="bag-qty">' +
        '<button type="button" data-act="minus" data-handle="' + esc(item.handle) + '">−</button><span>' + esc(item.qty) + '</span>' +
        '<button type="button" data-act="plus" data-handle="' + esc(item.handle) + '">+</button></div></div>' +
        '<button type="button" class="btn btn-ghost" data-act="remove" data-handle="' + esc(item.handle) + '" aria-label="Remove">✕</button></div>';
    }).join("");
    if (subEl) subEl.textContent = fmt(subtotal);
    $$("button[data-act]", wrap).forEach(function (btn) {
      btn.addEventListener("click", function () {
        var h = btn.getAttribute("data-handle");
        var act = btn.getAttribute("data-act");
        var it = state.bag.find(function (i) { return i.handle === h; });
        if (act === "remove") state.bag = state.bag.filter(function (i) { return i.handle !== h; });
        else if (it && act === "plus") it.qty += 1;
        else if (it && act === "minus") { it.qty -= 1; if (it.qty <= 0) state.bag = state.bag.filter(function (i) { return i.handle !== h; }); }
        saveBag();
      });
    });
    updateBagBadge();
  }

  async function doCheckout() {
    var emailEl = $("#bagEmail");
    var email = emailEl ? emailEl.value.trim() : "";
    if (!state.bag.length) { toast("Your bag is empty.", true); return; }
    if (!email || email.indexOf("@") === -1) { toast("Enter a valid email to check out.", true); if (emailEl) emailEl.focus(); return; }
    try { localStorage.setItem("potent-bodega-email", email); } catch (e) {}
    try {
      var out = await fetchJson(API.checkout, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, items: state.bag.map(function (i) { return { handle: i.handle, qty: i.qty }; }) })
      });
      var data = out.data || {};
      if (data.error) throw new Error(data.error);
      if (!out.res.ok) throw new Error("Checkout failed (" + out.res.status + ")");
      if (!data.url) throw new Error("No checkout URL returned.");
      location.href = data.url;
    } catch (e) {
      toast("Checkout failed: " + e.message, true);
    }
  }

  // ---------- marketplace ----------
  function renderMarket() {
    var grid = $("#marketGrid");
    var empty = $("#marketEmpty");
    if (!grid) return;
    if (empty) empty.hidden = state.listings.length !== 0;
    grid.innerHTML = state.listings.map(function (l) {
      var p = state.byHandle[l.productHandle];
      var title = l.title || (p ? p.title : l.productHandle);
      var hist = l.historyCount != null ? Number(l.historyCount) : Number(state.history[l.productHandle] || 0);
      var prodLike = p || { title: title, images: [], handle: l.productHandle };
      return '<article class="card" style="cursor:default">' +
        '<div class="card-media">' + mediaHtml(prodLike) + "</div>" +
        '<div class="card-body"><div class="card-title">' + esc(title) + "</div>" +
        (l.editionLabel ? '<div class="card-meta">' + esc(l.editionLabel) + "</div>" : "") +
        '<div class="card-price">' + fmtCents(l.priceCents) + "</div>" +
        '<div class="card-meta">Floor ' + fmtCents(l.floorCents) + " · " + hist + " transfer" + (hist === 1 ? "" : "s") + "</div>" +
        '<button type="button" class="btn btn-primary" data-buy="' + esc(l.id) + '">Buy</button></div></article>';
    }).join("");
    $$("button[data-buy]", grid).forEach(function (btn) {
      btn.addEventListener("click", function () { buyListing(btn.getAttribute("data-buy")); });
    });
  }

  async function buyListing(listingId) {
    var saved = "";
    try { saved = localStorage.getItem("potent-bodega-email") || ""; } catch (e) {}
    var email = window.prompt("Email for this purchase (ownership will be recorded to it):", saved);
    if (!email) return;
    email = email.trim();
    if (email.indexOf("@") === -1) { toast("Enter a valid email.", true); return; }
    try {
      var out = await fetchJson(API.buy, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "checkout", listingId: listingId, email: email })
      });
      var data = out.data || {};
      if (data.error) throw new Error(data.error);
      if (!out.res.ok || !data.url) throw new Error("Could not start resale checkout.");
      try { localStorage.setItem("potent-bodega-email", email); } catch (e) {}
      location.href = data.url;
    } catch (e) {
      toast("Resale checkout failed: " + e.message, true);
    }
  }

  // ---------- my pieces ----------
  async function loadMyPieces(email) {
    state.myEmail = email;
    try {
      var out = await fetchJson(API.ownership, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "list", email: email })
      });
      var data = out.data || {};
      if (data.error) throw new Error(data.error);
      if (!out.res.ok) throw new Error("Request failed (" + out.res.status + ")");
      state.myData = data;
      renderMyPieces();
    } catch (e) {
      toast("Could not load your pieces: " + e.message, true);
    }
  }

  function renderMyPieces() {
    var data = state.myData;
    var info = $("#collectorInfo");
    var grid = $("#myPiecesGrid");
    var empty = $("#myPiecesEmpty");
    var royWrap = $("#royaltiesWrap");
    var royList = $("#royaltiesList");
    if (!data || !grid) return;

    if (info) {
      if (data.collectorNo) {
        info.hidden = false;
        info.innerHTML = "<strong>Collector #" + esc(data.collectorNo) + "</strong> &nbsp;·&nbsp; " + esc(state.myEmail);
      } else info.hidden = true;
    }

    var ownerships = Array.isArray(data.ownerships) ? data.ownerships : [];
    if (empty) empty.hidden = ownerships.length !== 0;
    var now = Date.now();

    grid.innerHTML = ownerships.map(function (o) {
      var p = state.byHandle[o.productHandle];
      var title = p ? p.title : o.productHandle;
      var prodLike = p || { title: title, images: [], handle: o.productHandle };
      var holdMs = o.holdUntil ? new Date(o.holdUntil).getTime() : 0;
      var onHold = holdMs && now < holdMs;
      var daysLeft = onHold ? Math.ceil((holdMs - now) / 86400000) : 0;
      var floorDollars = ((Number(o.resaleFloorCents) || 0) / 100);
      var holdHtml;
      if (onHold) {
        holdHtml = '<p><span class="badge badge-hold">On hold — marketplace eligible ' + esc(fmtDate(o.holdUntil)) + " (" + daysLeft + " day" + (daysLeft === 1 ? "" : "s") + ' left)</span></p>';
      } else {
        holdHtml = '<p><span class="badge badge-eligible">MARKETPLACE ELIGIBLE</span></p>' +
          '<form class="list-form" data-list-form="' + esc(o.id) + '">' +
          '<label>List for resale (USD) — min ' + fmt(floorDollars) + "</label>" +
          '<input type="number" step="0.01" min="' + esc(floorDollars.toFixed(2)) + '" value="' + esc(floorDollars.toFixed(2)) + '" data-price-for="' + esc(o.id) + '" required />' +
          '<span class="hint">Floor: ' + fmt(floorDollars) + ". You cannot list below the resale floor.</span>" +
          '<button type="submit" class="btn btn-primary">List for Resale</button></form>';
        // Cancel support if this ownership is currently listed (contract: bodega-list cancel)
        if (o.listingId || o.status === "listed") {
          holdHtml += '<button type="button" class="btn" data-cancel-listing="' + esc(o.listingId || o.id) + '" style="margin-top:.5rem">Cancel Listing</button>';
        }
      }
      return '<article class="card" style="cursor:default">' +
        '<div class="card-media">' + mediaHtml(prodLike) + "</div>" +
        '<div class="card-body"><div class="card-title">' + esc(title) + "</div>" +
        (o.editionLabel ? '<div class="card-meta">' + esc(o.editionLabel) + "</div>" : "") +
        '<div class="card-meta">Purchased ' + esc(fmtDate(o.purchasedAt)) + "</div>" +
        (o.status ? '<div class="card-meta">Status: ' + esc(o.status) + "</div>" : "") +
        holdHtml + "</div></article>";
    }).join("");

    $$("form[data-list-form]", grid).forEach(function (form) {
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var oid = form.getAttribute("data-list-form");
        var input = $('input[data-price-for="' + oid + '"]', form) || $("input", form);
        var dollars = Number(input ? input.value : 0);
        var own = (state.myData.ownerships || []).find(function (x) { return String(x.id) === String(oid); });
        var minDollars = own ? (Number(own.resaleFloorCents) || 0) / 100 : 0;
        if (!dollars || isNaN(dollars)) { toast("Enter a price.", true); return; }
        if (dollars < minDollars) { toast("Price must be at least the resale floor (" + fmt(minDollars) + ").", true); return; }
        try {
          var out = await fetchJson(API.list, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: state.myEmail, ownershipId: oid, priceCents: Math.round(dollars * 100) })
          });
          var d = out.data || {};
          if (d.error) throw new Error(d.error);
          if (!out.res.ok) throw new Error("Listing failed (" + out.res.status + ")");
          toast("Listed for resale at " + fmt(dollars) + ".");
          loadMyPieces(state.myEmail);
          loadMarket();
        } catch (err) {
          toast("Listing failed: " + err.message, true);
        }
      });
    });

    $$("button[data-cancel-listing]", grid).forEach(function (btn) {
      btn.addEventListener("click", async function () {
        try {
          var out = await fetchJson(API.list, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "cancel", email: state.myEmail, listingId: btn.getAttribute("data-cancel-listing") })
          });
          var d = out.data || {};
          if (d.error) throw new Error(d.error);
          if (!out.res.ok) throw new Error("Cancel failed (" + out.res.status + ")");
          toast("Listing cancelled.");
          loadMyPieces(state.myEmail);
          loadMarket();
        } catch (err) {
          toast("Cancel failed: " + err.message, true);
        }
      });
    });

    var royalties = Array.isArray(data.royalties) ? data.royalties : [];
    if (royWrap && royList) {
      royWrap.hidden = royalties.length === 0;
      royList.innerHTML = royalties.map(function (r) {
        return "<li><strong>" + esc(r.role || "Royalty") + "</strong> — " + fmtCents(r.amountCents) + ' <span class="muted">' + esc(fmtDate(r.createdAt)) + "</span></li>";
      }).join("") || '<li class="muted">No royalties yet.</li>';
    }
  }

  // ---------- admin ----------
  async function openAdmin() {
    var token = "";
    try { token = sessionStorage.getItem("bodega-admin-token") || ""; } catch (e) {}
    if (!token) {
      token = window.prompt("Owner token:");
      if (!token) return;
      try { sessionStorage.setItem("bodega-admin-token", token); } catch (e) {}
    }
    var panel = $("#adminPanel");
    var content = $("#adminContent");
    if (panel) panel.hidden = false;
    if (content) content.innerHTML = '<p class="muted">Loading…</p>';
    try {
      var res = await fetch(API.admin, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
        body: JSON.stringify({ action: "overview" })
      });
      if (res.status === 403) {
        try { sessionStorage.removeItem("bodega-admin-token"); } catch (e) {}
        if (content) content.innerHTML = '<p><strong>Owner only.</strong></p>';
        toast("Owner only.", true);
        return;
      }
      var data = null;
      try { data = await res.json(); } catch (e) {}
      data = data || {};
      if (data.error) throw new Error(data.error);
      if (!res.ok) throw new Error("Admin request failed (" + res.status + ")");
      var owed = Array.isArray(data.royaltiesOwed) ? data.royaltiesOwed : [];
      var owedRows = owed.map(function (r) {
        return "<tr><td>" + esc(r.payee || "—") + "</td><td>" + esc(r.role || "—") + "</td><td>" + fmtCents(r.cents) + "</td></tr>";
      }).join("");
      if (content) {
        content.innerHTML =
          '<div class="admin-stats">' +
          '<div class="stat"><span class="muted">Products</span><strong>' + esc(data.products != null ? data.products : "—") + "</strong></div>" +
          '<div class="stat"><span class="muted">Collectors</span><strong>' + esc(data.collectors != null ? data.collectors : "—") + "</strong></div>" +
          '<div class="stat"><span class="muted">Ownerships</span><strong>' + esc(data.ownerships != null ? data.ownerships : "—") + "</strong></div>" +
          '<div class="stat"><span class="muted">Active Listings</span><strong>' + esc(data.activeListings != null ? data.activeListings : (data.listings != null ? data.listings : "—")) + "</strong></div>" +
          '<div class="stat"><span class="muted">Sales</span><strong>' + esc(data.sales != null ? data.sales : "—") + "</strong></div>" +
          "</div>" +
          "<h3>Royalties Owed</h3>" +
          (owed.length ? "<table><thead><tr><th>Payee</th><th>Role</th><th>Amount</th></tr></thead><tbody>" + owedRows + "</tbody></table>" : '<p class="muted">Nothing owed right now.</p>');
      }
      if (panel) panel.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      if (content) content.innerHTML = '<p class="muted">Could not load overview.</p>';
      toast("Admin failed: " + e.message, true);
    }
  }

  // ---------- return flows ----------
  function cleanUrl() {
    try {
      var url = new URL(location.href);
      url.search = "";
      history.replaceState(null, "", url.pathname + url.search + url.hash);
    } catch (e) {}
  }
  async function handleReturns() {
    var params = new URLSearchParams(location.search);
    var sessionId = params.get("session_id");
    var resaleSession = params.get("resale_session");
    if (sessionId) {
      try {
        var out = await fetchJson(API.ownership, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "claim", sessionId: sessionId })
        });
        var data = out.data || {};
        if (data.error) throw new Error(data.error);
        if (!out.res.ok) throw new Error("Claim failed (" + out.res.status + ")");
        state.bag = [];
        saveBag();
        closeBag();
        showBanner("Payment confirmed — your pieces are now in My Pieces");
        showView("mypieces");
        location.hash = "#/mypieces";
        // prefill my pieces if we have a saved email
        var savedEmail = "";
        try { savedEmail = localStorage.getItem("potent-bodega-email") || ""; } catch (e) {}
        if (savedEmail) {
          var inp = $("#myPiecesEmail"); if (inp) inp.value = savedEmail;
          loadMyPieces(savedEmail);
        }
      } catch (e) {
        toast("Payment confirm failed: " + e.message, true);
      } finally { cleanUrl(); }
    } else if (resaleSession) {
      try {
        var out2 = await fetchJson(API.buy, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "complete", sessionId: resaleSession })
        });
        var data2 = out2.data || {};
        if (data2.error) throw new Error(data2.error);
        if (!out2.res.ok) throw new Error("Resale complete failed (" + out2.res.status + ")");
        showBanner("Resale complete — ownership transferred.");
        showView("mypieces");
        location.hash = "#/mypieces";
      } catch (e) {
        toast("Resale confirm failed: " + e.message, true);
      } finally { cleanUrl(); }
    }
  }

  // ---------- wiring ----------
  function init() {
    loadBag();
    updateBagBadge();

    // prefill emails
    var savedEmail = "";
    try { savedEmail = localStorage.getItem("potent-bodega-email") || ""; } catch (e) {}
    if (savedEmail) {
      var be = $("#bagEmail"); if (be) be.value = savedEmail;
      var me = $("#myPiecesEmail"); if (me) me.value = savedEmail;
    }

    $$(".nav-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        var v = b.getAttribute("data-view");
        if (v === "shop") location.hash = "#/shop";
        else if (v === "marketplace") location.hash = "#/marketplace";
        else if (v === "mypieces") location.hash = "#/mypieces";
        showView(v);
      });
    });

    var search = $("#searchInput");
    if (search) search.addEventListener("input", function () {
      state.search = search.value;
      if (state.view !== "shop" && state.view !== "detail") showView("shop");
      renderShop();
    });

    $("#bagBtn").addEventListener("click", openBag);
    $("#closeBag").addEventListener("click", closeBag);
    $("#bagOverlay").addEventListener("click", closeBag);
    $("#checkoutBtn").addEventListener("click", doCheckout);
    $("#backToShop").addEventListener("click", function () { location.hash = "#/shop"; showView("shop"); });
    var closeOverlay = $("#closeDetailOverlay");
    if (closeOverlay) closeOverlay.addEventListener("click", function () { $("#detailOverlay").hidden = true; });

    var myForm = $("#myPiecesForm");
    if (myForm) myForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var email = $("#myPiecesEmail").value.trim();
      if (!email || email.indexOf("@") === -1) { toast("Enter a valid email.", true); return; }
      try { localStorage.setItem("potent-bodega-email", email); } catch (err) {}
      var be2 = $("#bagEmail"); if (be2 && !be2.value) be2.value = email;
      loadMyPieces(email);
    });

    $("#adminLink").addEventListener("click", openAdmin);
    $("#dismissAdmin").addEventListener("click", function () { $("#adminPanel").hidden = true; });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { closeBag(); var o = $("#detailOverlay"); if (o) o.hidden = true; }
    });

    window.addEventListener("hashchange", handleHash);

    initHero();
    handleReturns();
    loadCatalog();
    loadMarket();
    renderBag();
    // initial route (loadCatalog will re-run handleHash when ready)
    handleHash();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
