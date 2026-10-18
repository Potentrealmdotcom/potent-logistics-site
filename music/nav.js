/* One shared top bar for the whole POTENT MUSIC world, so everything is reachable from one place. */
(function () {
  var items = [["Discover", "/music/", /^\/music\/(index\.html)?$|^\/music\/artist/], ["Beats", "/beats/", /^\/beats\//], ["Studio", "/studio/", /^\/studio\//], ["Coins", "/music/coins.html", /coins|sign/], ["Earnings", "/beatman/", /^\/beatman\//], ["Services", "/music/services.html", /services/], ["Projects", "/music/projects.html", /projects|approve|guide/], ["Account", "/music/account.html", /account/], ["Help", "/music/about.html", /about/]];
  var p = location.pathname, me = document.currentScript;
  var d = document.createElement("div");
  d.setAttribute("role", "navigation"); d.setAttribute("aria-label", "POTENT MUSIC");
  d.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 10px;font:600 14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
  d.innerHTML = '<a href="/music/" style="font-weight:800;letter-spacing:.5px;color:inherit;text-decoration:none;margin-right:6px">POTENT <span style="color:#e8ff1a">MUSIC</span></a>' + items.map(function (i) {
    var on = i[2].test(p);
    return '<a href="' + i[1] + '" style="text-decoration:none;border:1px solid ' + (on ? '#e8ff1a' : 'rgba(128,128,128,.4)') + ';background:' + (on ? '#e8ff1a' : 'transparent') + ';color:' + (on ? '#111' : 'inherit') + ';border-radius:99px;padding:5px 12px">' + i[0] + '</a>';
  }).join("");
  var cb = document.createElement("button"); cb.type = "button"; cb.setAttribute("aria-label", "Cart");
  cb.style.cssText = "border:1px solid rgba(128,128,128,.4);background:transparent;color:inherit;border-radius:99px;padding:5px 12px;font:inherit;cursor:pointer;margin-left:auto";
  function count() { try { return (JSON.parse(localStorage.getItem("pm_cart") || "[]") || []).length; } catch (e) { return 0; } }
  function paint(n) { cb.textContent = "🛒 " + (n == null ? count() : n); }
  paint(); cb.onclick = function () { if (window.PM && PM.cartDialog) PM.cartDialog(); else location.href = "/music/"; };
  var sb = document.createElement("a"); sb.href = "/music/search.html"; sb.setAttribute("aria-label", "Search"); sb.textContent = "🔍";
  sb.style.cssText = "border:1px solid rgba(128,128,128,.4);color:inherit;border-radius:99px;padding:5px 11px;text-decoration:none;margin-left:auto";
  cb.style.marginLeft = "0";
  var bell = document.createElement("a"); bell.href = "/music/account.html#notifications"; bell.setAttribute("aria-label", "Notifications"); bell.style.cssText = "display:none;border:1px solid rgba(128,128,128,.4);color:inherit;border-radius:99px;padding:5px 11px;text-decoration:none"; bell.textContent = "🔔";
  d.appendChild(sb); d.appendChild(bell);
  try { if (localStorage.getItem("pm_nocart")) cb.style.display = "none"; } catch (e) { }
  try { var tk = localStorage.getItem("pmu"); if (tk) fetch("/.netlify/functions/music-admin", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + tk }, body: JSON.stringify({ action: "notif_list" }) }).then(function (r) { return r.json(); }).then(function (j) { if (j && j.items) { bell.style.display = "inline-block"; if (j.unread) bell.textContent = "🔔 " + j.unread; } }).catch(function () {}); } catch (e) {}
  d.appendChild(cb); window.addEventListener("storage", function () { paint(); });
  var tick = setInterval(function () { if (window.PM) { PM.onCart = paint; clearInterval(tick); } }, 300);
  var sk = document.createElement("a"); sk.href = "#main"; sk.className = "skip"; sk.textContent = "Skip to content"; sk.style.cssText = "position:absolute;left:-999px;top:0;background:#e8ff1a;color:#111;padding:8px 12px;z-index:99"; sk.onfocus = function () { sk.style.left = "0"; }; sk.onblur = function () { sk.style.left = "-999px"; };
  me.parentNode.insertBefore(sk, me);
  me.parentNode.insertBefore(d, me);
  var ctx = /^\/beats\//.test(p) ? "beat" : /coins/.test(p) ? "coins" : /projects|receipt|account/.test(p) ? "money" : /studio|beatman/.test(p) ? "money" : "general";
  var ab = document.createElement("button"); ab.type = "button"; ab.setAttribute("aria-label", "Ask for help"); ab.textContent = "? Help";
  ab.style.cssText = "position:fixed;right:14px;bottom:" + (/^\/beats\//.test(p) ? "86" : "16") + "px;z-index:20;border:0;border-radius:99px;padding:10px 16px;background:#e8ff1a;color:#111;font:700 14px system-ui,sans-serif;box-shadow:0 2px 10px rgba(0,0,0,.35);cursor:pointer";
  ab.onclick = function () {
    var ov = document.createElement("div"); ov.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:60;display:flex;align-items:flex-end;justify-content:center;padding:12px";
    var bx = document.createElement("div"); bx.style.cssText = "background:#141412;color:#f7f4ec;border:1px solid rgba(255,255,255,.2);border-radius:16px;padding:16px;max-width:460px;width:100%;font:15px/1.5 system-ui,sans-serif";
    bx.innerHTML = '<b style="font-size:17px">Quick help</b><div id="pm-ans" style="margin:8px 0;color:#d8d3c8">Loading…</div><div style="display:flex;gap:8px"><input id="pm-q" placeholder="Ask about fees, rights, downloads, money…" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,.25);background:#0a0a0a;color:inherit"><button id="pm-go" style="border:0;border-radius:10px;padding:10px 14px;background:#e8ff1a;color:#111;font-weight:700">Ask</button></div><button id="pm-x" style="margin-top:10px;border:1px solid rgba(255,255,255,.25);background:transparent;color:inherit;border-radius:10px;padding:8px 12px">Close</button>';
    ov.appendChild(bx); document.body.appendChild(ov);
    function ask(t) { var h = { "Content-Type": "application/json" }; try { var tk = localStorage.getItem("pmu"); if (tk) h.Authorization = "Bearer " + tk; } catch (e) {}
      fetch("/.netlify/functions/music-release", { method: "POST", headers: h, body: JSON.stringify({ action: "help_ask", ctx: ctx, text: t || "" }) }).then(function (r) { return r.json(); }).then(function (j) { bx.querySelector("#pm-ans").textContent = j.answer || j.error || "Something went wrong."; }).catch(function () { bx.querySelector("#pm-ans").textContent = "Help is not available right now. Everything else still works."; }); }
    ask(""); bx.querySelector("#pm-go").onclick = function () { var v = bx.querySelector("#pm-q").value; if (v.trim()) ask(v); };
    bx.querySelector("#pm-q").onkeydown = function (e) { if (e.key === "Enter") bx.querySelector("#pm-go").click(); };
    bx.querySelector("#pm-x").onclick = function () { ov.remove(); }; ov.onclick = function (e) { if (e.target === ov) ov.remove(); };
  };
  window.addEventListener("DOMContentLoaded", function () { document.body.appendChild(ab); }); if (document.readyState !== "loading") document.body.appendChild(ab);
  if (!document.getElementById("pm-foot")) {
    var f = document.createElement("div"); f.id = "pm-foot"; f.style.cssText = "margin:28px 0 8px;font:13px system-ui,sans-serif;opacity:.75;display:flex;gap:14px;flex-wrap:wrap";
    f.innerHTML = '<a href="/music/releases.html" style="color:inherit">Releases</a><a href="/music/creators.html" style="color:inherit">Creators</a><a href="/music/search.html" style="color:inherit">Search</a><a href="/music/licensing.html" style="color:inherit">Licensing</a><a href="/music/privacy.html" style="color:inherit">Privacy</a><a href="/music/copyright.html" style="color:inherit">Copyright &amp; takedowns</a><a href="/music/about.html" style="color:inherit">Help</a>';
    window.addEventListener("DOMContentLoaded", function () { document.body.appendChild(f); });
    if (document.readyState !== "loading") document.body.appendChild(f);
  }
})();
