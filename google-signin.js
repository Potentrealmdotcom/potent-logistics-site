/* google-signin.js — shared "Continue with Google" button for every POTENT platform.
   Shows nothing at all until the site owner sets GOOGLE_CLIENT_ID in Netlify, so it is safe to ship everywhere.
   PotentGoogle.mount(element, {
     endpoint: "/.netlify/functions/auth",   // the platform's own API
     action:   "googlecust",                  // the platform's Google action
     extra:    function () { return {}; },    // extra fields to send (e.g. org_slug, age)
     onResult: function (json) {},            // called with the server's answer (success OR a need-more-info answer)
     onError:  function (message) {}
   });
   The browser only ever sends Google's signed token; the server checks it with Google. */
(function () {
  var loading = null;
  function loadGIS() {
    if (window.google && google.accounts && google.accounts.id) return Promise.resolve();
    if (loading) return loading;
    loading = new Promise(function (res, rej) {
      var s = document.createElement("script"); s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.defer = true;
      s.onload = res; s.onerror = function () { loading = null; rej(new Error("gsi")); }; document.head.appendChild(s);
    });
    return loading;
  }
  function post(endpoint, body) {
    return fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return { ok: false, error: "Server error" }; }); });
  }
  function mount(el, o) {
    if (!el || !o || !o.endpoint || !o.action) return;
    post(o.endpoint, { action: "googleconfig" }).then(function (cfg) {
      if (!cfg || !cfg.enabled || !cfg.clientId) return;                       // not turned on: stay invisible
      return loadGIS().then(function () {
        google.accounts.id.initialize({
          client_id: cfg.clientId, ux_mode: "popup", auto_select: false, cancel_on_tap_outside: true,
          callback: function (resp) {
            if (!resp || !resp.credential) { if (o.onError) o.onError("Google sign-in was cancelled."); return; }
            var extra = typeof o.extra === "function" ? (o.extra() || {}) : {};
            post(o.endpoint, Object.assign({ action: o.action, credential: resp.credential }, extra)).then(function (j) {
              if (j && (j.ok || j.need_signup)) { if (o.onResult) o.onResult(j); }
              else if (o.onError) o.onError((j && j.error) || "Google sign-in failed.");
            }).catch(function () { if (o.onError) o.onError("Can't reach the server. Try again."); });
          }
        });
        el.innerHTML = "";
        google.accounts.id.renderButton(el, { theme: "filled_black", size: "large", text: "continue_with", shape: "pill", logo_alignment: "left", width: Math.min(340, el.clientWidth || 340) });
      });
    }).catch(function () { /* Google unreachable: the password form still works */ });
  }
  window.PotentGoogle = { mount: mount };
})();
