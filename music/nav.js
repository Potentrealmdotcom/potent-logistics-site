/* One shared top bar for the whole POTENT MUSIC world, so everything is reachable from one place. */
(function () {
  var items = [["Discover", "/music/", /^\/music\/(index\.html)?$|^\/music\/artist/], ["Beats", "/beats/", /^\/beats\//], ["Studio", "/studio/", /^\/studio\//], ["Wallet", "/beatman/", /^\/beatman\//], ["Account", "/music/account.html", /account/]];
  var p = location.pathname, me = document.currentScript;
  var d = document.createElement("div");
  d.setAttribute("role", "navigation"); d.setAttribute("aria-label", "POTENT MUSIC");
  d.style.cssText = "display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin:0 0 10px;font:600 14px system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
  d.innerHTML = '<a href="/music/" style="font-weight:800;letter-spacing:.5px;color:inherit;text-decoration:none;margin-right:6px">POTENT <span style="color:#e8ff1a">MUSIC</span></a>' + items.map(function (i) {
    var on = i[2].test(p);
    return '<a href="' + i[1] + '" style="text-decoration:none;border:1px solid ' + (on ? '#e8ff1a' : 'rgba(128,128,128,.4)') + ';background:' + (on ? '#e8ff1a' : 'transparent') + ';color:' + (on ? '#111' : 'inherit') + ';border-radius:99px;padding:5px 12px">' + i[0] + '</a>';
  }).join("");
  me.parentNode.insertBefore(d, me);
})();
