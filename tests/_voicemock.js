// In-memory PostgREST + RPC + outside-service stand-in for the POTENT VOICE tests.
module.exports = function make(seed) {
  let seq = 0; const uid = () => "eeeeeeee-0000-4000-8000-" + String(++seq).padStart(12, "0");
  const T = Object.assign({ organizations: [], voice_plans: [], voice_subscriptions: [], voice_usage_records: [], voice_billing_events: [], voice_audit_logs: [], voice_agent_config: [], voice_vehicle_profiles: [], voice_sessions: [], voice_events: [], voice_transcripts: [],
    voice_tool_executions: [], voice_quotes: [], voice_bookings: [], voice_capacity_holds: [], voice_handoffs: [], voice_callbacks: [], voice_knowledge_documents: [], voice_consent_records: [], voice_suppression_records: [], voice_campaigns: [], voice_campaign_contacts: [],
    voice_provider_health: [], voice_notifications_sent: [], jobs: [], drivers: [], customers: [], leads: [], b2b_pricing_settings: [] }, seed || {});
  const UNIQ = { voice_sessions: (a, b) => a.provider === b.provider && a.provider_call_id === b.provider_call_id, voice_events: (a, b) => a.org_id === b.org_id && a.event_key === b.event_key, voice_tool_executions: (a, b) => a.org_id === b.org_id && a.call_key === b.call_key,
    voice_transcripts: (a, b) => a.session_id === b.session_id && a.seq === b.seq, voice_bookings: (a, b) => a.org_id === b.org_id && (a.idem_key === b.idem_key || a.reference === b.reference), voice_quotes: (a, b) => a.org_id === b.org_id && a.number === b.number,
    voice_notifications_sent: (a, b) => a.booking_id === b.booking_id && a.channel === b.channel && a.kind === b.kind, voice_suppression_records: (a, b) => a.org_id === b.org_id && a.phone === b.phone, voice_campaign_contacts: (a, b) => a.campaign_id === b.campaign_id && a.phone === b.phone,
    voice_usage_records: (a, b) => a.org_id === b.org_id && a.session_id === b.session_id, voice_billing_events: (a, b) => a.event_key === b.event_key, voice_subscriptions: (a, b) => a.org_id === b.org_id, voice_agent_config: (a, b) => a.org_id === b.org_id,
    leads: () => false, jobs: (a, b) => a.id === b.id };
  const DEF = { voice_sessions: () => ({ state: "ringing", test_mode: false, intake: {}, started_at: new Date().toISOString(), confirmed_by_caller: false, direction: "inbound", provider: "twilio" }), voice_bookings: () => ({ status: "pending_review" }), voice_quotes: () => ({ status: "offered" }), voice_callbacks: () => ({ status: "open" }),
    voice_handoffs: () => ({ status: "requested", requested_at: new Date().toISOString() }), voice_knowledge_documents: () => ({ version: 1, status: "draft" }), voice_campaigns: () => ({ status: "draft", max_attempts: 2, call_window: { start: "09:00", end: "17:00", tz: "America/New_York" } }),
    voice_campaign_contacts: () => ({ status: "queued", attempts: 0 }), voice_usage_records: () => ({ started_at: new Date().toISOString(), kind: "call" }), voice_capacity_holds: () => ({ status: "held" }), voice_vehicle_profiles: () => ({ active: true, authorized: false, version: 1, kind: "company", updated_at: new Date().toISOString() }),
    voice_provider_health: () => ({}), voice_consent_records: () => ({}), voice_agent_config: () => ({ version: 1, settings: {}, ai_enabled: true, emergency_stop: false }), voice_subscriptions: () => ({ status: "none" }) };
  const EXT = { calls: [], census: null, osrm: null, twilio: [], mail: [], twilioFail: false, mailFail: false, censusDown: false, osrmDown: false, failJob: false };
  const num = v => v !== "" && v != null && isFinite(Number(v)) && !/[-:T]/.test(String(v));
  const cmp = (a, b) => (num(a) && num(b) ? Number(a) - Number(b) : String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0);
  function leaf(r, k, v) {
    let m;
    if ((m = v.match(/^eq\.(.*)$/))) return String(r[k]) === m[1]; if ((m = v.match(/^neq\.(.*)$/))) return String(r[k]) !== m[1];
    if ((m = v.match(/^gte\.(.*)$/))) return r[k] != null && cmp(r[k], m[1]) >= 0; if ((m = v.match(/^gt\.(.*)$/))) return r[k] != null && cmp(r[k], m[1]) > 0;
    if ((m = v.match(/^lte\.(.*)$/))) return r[k] != null && cmp(r[k], m[1]) <= 0; if ((m = v.match(/^lt\.(.*)$/))) return r[k] != null && cmp(r[k], m[1]) < 0;
    if ((m = v.match(/^in\.\((.*)\)$/))) return m[1].split(",").includes(String(r[k]));
    if (v === "is.null") return r[k] == null; if (v === "not.is.null") return r[k] != null;
    if ((m = v.match(/^i?like\.(.*)$/))) { const re = new RegExp("^" + m[1].replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", /^ilike/.test(v) ? "i" : ""); return re.test(String(r[k] == null ? "" : r[k])); }
    if ((m = v.match(/^cs\.(.*)$/))) { const want = JSON.parse(m[1]); const have = r[k] || {}; return Object.keys(want).every(kk => Array.isArray(want[kk]) ? want[kk].every(x => (have[kk] || []).includes(x)) : have[kk] === want[kk]); }
    return true;
  }
  function match(r, p) {
    const i = p.indexOf("="), k = p.slice(0, i), v = decodeURIComponent(p.slice(i + 1));
    if (["select", "order", "limit", "offset", "on_conflict"].includes(k)) return true;
    if (k === "or") { const parts = v.replace(/^\(|\)$/g, "").split(","); return parts.some(x => { const j = x.indexOf("."), col = x.slice(0, j), rest = x.slice(j + 1); return leaf(r, col, rest); }); }
    return leaf(r, k, v);
  }
  const filt = (rows, q) => rows.filter(r => q.split("&").filter(Boolean).every(p => match(r, p)));
  const R = (d, s) => ({ ok: (s || 200) < 300, status: s || 200, headers: { get: () => null }, text: async () => JSON.stringify(d), json: async () => d });
  const overlap = (a, b) => new Date(a.window_start) < new Date(b.window_end) && new Date(a.window_end) > new Date(b.window_start);
  function rpc(fn, a) {
    if (fn === "voice_confirm_booking") {
      const b = T.voice_bookings.find(x => x.id === a.p_booking); if (!b) return { ok: false, error: "not_found" };
      if (b.status === "confirmed") return { ok: true, duplicate: true, job_id: b.job_id }; if (b.status !== "pending_review") return { ok: false, error: "bad_state" };
      if (!b.vehicle_profile_id || !b.window_start) return { ok: false, error: "no_window" };
      if (T.voice_capacity_holds.some(h => h.status === "held" && h.vehicle_profile_id === b.vehicle_profile_id && overlap(h, b))) return { ok: false, error: "conflict" };
      if (EXT.failJob) return null;                                                      // simulated database failure: nothing may be left half done
      T.voice_capacity_holds.push({ id: uid(), org_id: b.org_id, vehicle_profile_id: b.vehicle_profile_id, booking_id: b.id, window_start: b.window_start, window_end: b.window_end, status: "held" });
      T.jobs.push(Object.assign({ id: a.p_job_id, org_id: b.org_id, status: "Confirmed", date: a.p_job.date }, a.p_job, { status: "Confirmed", scheduled_time: b.window_start }));
      b.status = "confirmed"; b.job_id = a.p_job_id; b.confirmed_at = new Date().toISOString(); b.review_reason = null; return { ok: true, job_id: a.p_job_id };
    }
    if (fn === "voice_release_booking") { const b = T.voice_bookings.find(x => x.id === a.p_booking); if (!b) return { ok: false, error: "not_found" }; T.voice_capacity_holds.filter(h => h.booking_id === b.id).forEach(h => { h.status = "released"; }); b.status = "cancelled"; b.review_reason = a.p_reason; if (b.job_id) { const j = T.jobs.find(x => x.id === b.job_id); if (j) j.status = "Cancelled"; } return { ok: true }; }
    return null;
  }
  const H = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  const CITY = { atlanta: [33.75, -84.39], marietta: [33.95, -84.55], savannah: [32.08, -81.09], columbia: [34.0, -81.03], macon: [32.84, -83.63] };
  global.fetch = async (u, o) => {
    o = o || {}; u = String(u); const m = o.method || "GET";
    if (u.startsWith("https://geocoding.geo.census.gov")) { EXT.calls.push("census"); if (EXT.censusDown) throw new Error("down"); const addr = decodeURIComponent(u.match(/address=([^&]*)/)[1]); if (/NOWHERE|BADSTREET/i.test(addr)) return R({ result: { addressMatches: [] } });
      const st = (addr.match(/,\s*([A-Z]{2})\b/) || [])[1] || "GA", city = (addr.split(",")[1] || "").trim(), c = CITY[city.toLowerCase()] || CITY.atlanta; return R({ result: { addressMatches: [{ matchedAddress: addr.toUpperCase(), coordinates: { x: c[1], y: c[0] }, addressComponents: { state: st, city: city.toUpperCase(), zip: "30303" } }] } }); }
    if (u.startsWith("https://osrm.test")) { EXT.calls.push("osrm"); if (EXT.osrmDown) throw new Error("down"); const mm = u.match(/driving\/([-\d.]+),([-\d.]+);([-\d.]+),([-\d.]+)/); const d = H([+mm[2], +mm[1]], [+mm[4], +mm[3]]) * 69 * 1.3 * 1609.344; return R({ routes: [{ distance: d, duration: d / 1609.344 * 90 }] }); }
    if (u.startsWith("https://api.twilio.com")) { EXT.twilio.push({ url: u, body: o.body }); return EXT.twilioFail ? R({ message: "nope" }, 500) : R({ sid: "SM1" }, 201); }
    if (u.startsWith("https://api.resend.com")) { EXT.mail.push(JSON.parse(o.body)); return EXT.mailFail ? R({}, 500) : R({ id: "re_1" }); }
    if (u.includes("/rest/v1/rpc/")) { const fn = u.split("/rpc/")[1]; const out = rpc(fn, JSON.parse(o.body)); return out === null ? R({ message: "db error" }, 500) : R(out); }
    const t = (u.match(/rest\/v1\/([a-z_0-9]+)/) || [])[1], q = u.split("?")[1] || "", pref = (o.headers && o.headers.Prefer) || ""; if (!t || !T[t]) return R([]);
    if (m === "GET") { let d = filt(T[t], q); const ord = q.match(/(?:^|&)order=([a-z_]+)\.(asc|desc)/); if (ord) d = d.slice().sort((x, y) => cmp(x[ord[1]], y[ord[1]]) * (ord[2] === "desc" ? -1 : 1)); const off = q.match(/offset=(\d+)/); if (off) d = d.slice(+off[1]); const lim = q.match(/limit=(\d+)/); if (lim) d = d.slice(0, +lim[1]); return R(JSON.parse(JSON.stringify(d))); }
    if (m === "POST") { const out = []; for (const r0 of [].concat(JSON.parse(o.body))) { const r = Object.assign({ id: uid(), created_at: new Date().toISOString() }, (DEF[t] || (() => ({})))(), r0); if (t === "voice_transcripts") delete r.id; const un = UNIQ[t]; if (un && T[t].some(x => un(x, r))) { if (/ignore/.test(pref)) continue; return R({ message: "duplicate" }, 409); } T[t].push(r); out.push(r); } return R(/representation/.test(pref) ? JSON.parse(JSON.stringify(out)) : []); }
    if (m === "PATCH") { const hit = filt(T[t], q); hit.forEach(r => Object.assign(r, JSON.parse(o.body))); return R(JSON.parse(JSON.stringify(hit))); }
    if (m === "DELETE") { filt(T[t], q).forEach(r => T[t].splice(T[t].indexOf(r), 1)); return R([]); }
    return R([]);
  };
  return { T, EXT, uid };
};
