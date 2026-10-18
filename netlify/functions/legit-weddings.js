// LEGIT Weddings (launch slice): package catalogue, Georgia-only service area, consultation requests, admin review.
// A request is NOT a booking: nothing is charged here and no contract exists until staff send a written proposal.
// Not built yet: contracts, payments, vendor marketplace, logistics job orders, guest/RSVP tools, wedding financials.
const crypto = require("crypto");
const L = require("./lib/legit");
const { J, sb } = L;
const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const rows = r => r.ok && Array.isArray(r.data) ? r.data : [];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/, UUID = /^[0-9a-f-]{36}$/i;
const hits = {};
function limited(k, max, ms) { const n = Date.now(); hits[k] = (hits[k] || []).filter(t => n - t < ms); if (hits[k].length >= max) return true; hits[k].push(n); return false; }
const STATUSES = ["requested", "reviewing", "proposal_sent", "declined", "closed"];
const STATES = { AL:1,AK:1,AZ:1,AR:1,CA:1,CO:1,CT:1,DE:1,FL:1,GA:1,HI:1,ID:1,IL:1,IN:1,IA:1,KS:1,KY:1,LA:1,ME:1,MD:1,MA:1,MI:1,MN:1,MS:1,MO:1,MT:1,NE:1,NV:1,NH:1,NJ:1,NM:1,NY:1,NC:1,ND:1,OH:1,OK:1,OR:1,PA:1,RI:1,SC:1,SD:1,TN:1,TX:1,UT:1,VT:1,VA:1,WA:1,WV:1,WI:1,WY:1,DC:1 };

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") return J(405, { ok: false, error: "POST only" });
  if (!process.env.AUTH_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) return J(500, { ok: false, error: "Server not configured" });
  let b; try { b = JSON.parse(event.body || "{}"); } catch (e) { return J(400, { ok: false, error: "Bad request" }); }
  const a = String(b.action || ""), ip = String((event.headers || {})["x-nf-client-connection-ip"] || "x");
  try {
    if (a === "packages") {
      const [p, ar] = await Promise.all([sb("legit_wedding_packages?active=eq.true&select=*&order=sort.asc"), sb("legit_wedding_areas?enabled=eq.true&select=state,name,note")]);
      return J(200, { ok: true, packages: rows(p), areas: rows(ar), notice: "LEGIT Weddings currently serves Georgia only. Requesting a consultation is free and is not a booking." });
    }
    if (a === "request") {
      if (limited("req:" + ip, 5, 3600e3)) return J(429, { ok: false, error: "Too many requests. Try again later." });
      if (clip(b.website, 50)) return J(200, { ok: true }); // honeypot
      const name = clip(b.name, 120), email = clip(b.email, 200).toLowerCase(), st = clip(b.venue_state, 2).toUpperCase();
      if (name.length < 2 || !EMAIL.test(email)) return J(400, { ok: false, error: "Enter your name and a valid email" });
      if (!STATES[st]) return J(400, { ok: false, error: "Enter the venue's state" });
      const area = rows(await sb("legit_wedding_areas?state=eq." + st + "&select=enabled,name"))[0];
      if (!area || !area.enabled) return J(422, { ok: false, outOfArea: true, error: "LEGIT Weddings isn't available in " + (area ? area.name : st) + " yet. We currently serve Georgia only, so we haven't taken a request or any payment." });
      const city = clip(b.venue_city, 80), venue = clip(b.venue_name, 120);
      if (!city && !venue) return J(400, { ok: false, error: "Enter the venue name or city in Georgia" });
      let pk = clip(b.package_key, 30) || null;
      if (pk && !rows(await sb("legit_wedding_packages?key=eq." + encodeURIComponent(pk) + "&active=eq.true&select=key"))[0]) return J(400, { ok: false, error: "Pick one of the listed packages" });
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(b.event_date || "")) ? b.event_date : null;
      if (date && new Date(date).getTime() < Date.now() - 864e5) return J(400, { ok: false, error: "The event date is in the past" });
      let uid = null; const t = L.verify(L.bearer(event)); if (t && UUID.test(String(t.uid))) uid = t.uid;
      const g = parseInt(b.guest_count, 10);
      const ins = await sb("legit_wedding_requests", { method: "POST", prefer: "return=representation", body: { user_id: uid, package_key: pk, name: name, email: email, phone: clip(b.phone, 40) || null, event_date: date, guest_count: g > 0 && g < 5000 ? g : null, venue_name: venue || null, venue_city: city || null, venue_state: st, venue_zip: clip(b.venue_zip, 10) || null, vision: clip(b.vision, 3000) || null, budget_note: clip(b.budget_note, 300) || null, ip_hash: crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16) } });
      if (!ins.ok) return J(500, { ok: false, error: "Could not save your request" });
      return J(200, { ok: true, status: "requested", message: "Request received. This is not a booking and nothing has been charged. We'll review it and contact you with a written proposal." });
    }
    // ── staff: LEGIT admins only (checked on the server) ──
    if (a.indexOf("a_") === 0) {
      const t = L.verify(L.bearer(event)); if (!t) return J(401, { ok: false, error: "Sign in again" });
      const me = rows(await sb("legit_users?id=eq." + t.uid + "&select=id,is_admin,banned,email"))[0];
      if (!me || me.banned || !me.is_admin) return J(403, { ok: false, error: "Admin only" });
      const log = (act, target, note) => sb("legit_admin_log", { method: "POST", prefer: "return=minimal", body: { actor: me.id, action: act, target: String(target || "").slice(0, 80), note: String(note || "").slice(0, 300) } });
      if (a === "a_list") {
        const [r, p, ar] = await Promise.all([sb("legit_wedding_requests?select=*&order=created_at.desc&limit=200"), sb("legit_wedding_packages?select=*&order=sort.asc"), sb("legit_wedding_areas?select=*&order=state.asc")]);
        return J(200, { ok: true, requests: rows(r), packages: rows(p), areas: rows(ar), statuses: STATUSES });
      }
      if (a === "a_status") {
        if (!UUID.test(String(b.id || "")) || STATUSES.indexOf(b.status) < 0) return J(400, { ok: false, error: "Bad request" });
        const up = await sb("legit_wedding_requests?id=eq." + b.id, { method: "PATCH", prefer: "return=representation", body: { status: b.status, staff_note: clip(b.staff_note, 1000) || null, updated_at: new Date().toISOString() } });
        if (!rows(up).length) return J(404, { ok: false, error: "Not found" });
        await log("wedding_status", b.id, b.status); return J(200, { ok: true });
      }
      if (a === "a_pkg_set") {
        const key = clip(b.key, 30).toLowerCase().replace(/[^a-z0-9_-]/g, ""), price = Math.round(Number(b.price_cents)), arr = x => Array.isArray(x) ? x.map(s => clip(s, 200)).filter(Boolean).slice(0, 40) : [];
        if (!key || !(price >= 100)) return J(400, { ok: false, error: "A key and a price are required" });
        await sb("legit_wedding_packages", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { key: key, title: clip(b.title, 100) || key, price_cents: price, summary: clip(b.summary, 400), includes: arr(b.includes), excludes: arr(b.excludes), guest_limit: Math.max(1, parseInt(b.guest_limit, 10) || 100), payment_schedule: clip(b.payment_schedule, 600), cancellation: clip(b.cancellation, 600), active: b.active !== false, sort: parseInt(b.sort, 10) || 0, updated_at: new Date().toISOString() } });
        await log("wedding_pkg", key, "price " + price); return J(200, { ok: true });
      }
      if (a === "a_area_set") {
        const st = clip(b.state, 2).toUpperCase(); if (!STATES[st]) return J(400, { ok: false, error: "Bad state" });
        await sb("legit_wedding_areas", { method: "POST", prefer: "resolution=merge-duplicates,return=minimal", body: { state: st, name: clip(b.name, 60) || st, enabled: b.enabled === true, note: clip(b.note, 200), updated_at: new Date().toISOString() } });
        await log("wedding_area", st, b.enabled === true ? "enabled" : "disabled"); return J(200, { ok: true });
      }
    }
    return J(400, { ok: false, error: "Unknown action" });
  } catch (e) { console.error("legit-weddings:", e.message); return J(500, { ok: false, error: "Something went wrong" }); }
};
