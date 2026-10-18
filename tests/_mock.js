// Tiny in-memory PostgREST + Supabase Storage stand-in for the function tests.
let seq = 0; const uid = () => "dddddddd-0000-4000-8000-" + String(++seq).padStart(12, "0");
module.exports = function make(T, opts) {
  opts = opts || {}; const OBJ = opts.objects || {}; const CALLS = [];
  const UNIQ = opts.unique || {}; // table -> [cols] (or fn(row,other))
  const match = (r, p) => {
    const i = p.indexOf("="); const k = p.slice(0, i), v = decodeURIComponent(p.slice(i + 1));
    if (["select", "order", "limit", "offset", "on_conflict", "or"].includes(k)) return true;
    const eq = v.match(/^eq\.(.*)$/); if (eq) return String(r[k] === undefined && /^(archived|banned|muted|invited)$/.test(k) ? false : r[k]) === eq[1];
    const ne = v.match(/^neq\.(.*)$/); if (ne) return String(r[k]) !== ne[1];
    const inn = v.match(/^in\.\((.*)\)$/); if (inn) return inn[1].split(",").includes(String(r[k]));
    if (v === "is.null") return r[k] == null; if (v === "not.is.null") return r[k] != null;
    const gt = v.match(/^gt\.(.*)$/); if (gt) return Number(r[k]) > Number(gt[1]);
    const gte = v.match(/^gte\.(.*)$/); if (gte) return String(r[k]) >= gte[1];
    return true;
  };
  const filt = (rows, q) => rows.filter(r => q.split("&").filter(Boolean).every(p => match(r, p)));
  const R = (d, s) => ({ ok: (s || 200) < 300, status: s || 200, headers: { get: () => null }, text: async () => JSON.stringify(d), json: async () => d });
  global.fetch = async (u, o) => {
    o = o || {}; u = String(u); const m = o.method || "GET"; CALLS.push(m + " " + u);
    if (u.includes("/storage/v1/")) {
      if (u.includes("/object/upload/sign/")) return R({ url: "/object/upload/sign/" + u.split("/object/upload/sign/")[1] + "?token=t" });
      if (u.includes("/object/authenticated/")) { const k = u.split("/object/authenticated/")[1].replace(/^lab-files\//, ""); const has = OBJ[k] != null; return { ok: has, status: has ? 200 : 404, headers: { get: h => /content-length/i.test(h) ? String(OBJ[k]) : null }, text: async () => "", json: async () => ({}) }; }
      if (u.includes("/object/sign/")) return R({ signedURL: "/object/sign/" + u.split("/object/sign/")[1] + "?token=s" });
      if (u.endsWith("/object/copy")) { const j = JSON.parse(o.body); OBJ[j.destinationBucket + "/" + j.destinationKey] = OBJ[j.sourceKey] || 1; return R({ Key: "x" }); }
      if (m === "DELETE") { delete OBJ[u.split("/object/")[1].replace(/^lab-files\//, "")]; return R({}); }
      return R({});
    }
    const t = (u.match(/rest\/v1\/([a-z_]+)/) || [])[1]; const q = u.split("?")[1] || ""; if (!T[t]) return R([]);
    if (m === "GET") {
      let d = filt(T[t], q); const ord = q.match(/(?:^|&)order=([a-z_]+)\.(asc|desc)/); if (ord) d = d.slice().sort((x, y) => (x[ord[1]] > y[ord[1]] ? 1 : x[ord[1]] < y[ord[1]] ? -1 : 0) * (ord[2] === "desc" ? -1 : 1));
      const off = q.match(/offset=(\d+)/); if (off) d = d.slice(Number(off[1])); const lim = q.match(/limit=(\d+)/); if (lim) d = d.slice(0, Number(lim[1]));
      return R(d.map(r => Object.assign({}, r)));
    }
    if (m === "POST") {
      const out = []; const pref = (o.headers && o.headers.Prefer) || "";
      for (const r0 of [].concat(JSON.parse(o.body))) {
        const r = Object.assign({ id: uid(), created_at: new Date().toISOString() }, (opts.defaults || {})[t] || {}, r0); if (t === "smoke_messages" || t === "smoke_reactions") r.id = ++seq;
        const un = UNIQ[t]; const clash = un && T[t].find(x => un(x, r));
        if (clash) { if (/merge/.test(pref)) { Object.assign(clash, r0); out.push(clash); continue; } if (/ignore/.test(pref)) continue; return R({ message: "duplicate" }, 409); }
        T[t].push(r); out.push(r);
      }
      return R(out, 201);
    }
    if (m === "PATCH") { const hit = filt(T[t], q); hit.forEach(r => Object.assign(r, JSON.parse(o.body))); return R(hit); }
    if (m === "DELETE") { filt(T[t], q).forEach(r => T[t].splice(T[t].indexOf(r), 1)); return R([]); }
    return R([]);
  };
  return { OBJ, CALLS };
};
