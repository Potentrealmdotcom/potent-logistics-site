// THE BOOK ENGINE (Jarvis build step 1, Nov 9, 2026 — Tony's ruling: "No Potent stuff hard
// coded. She shouldn't need to know Potent stuff… one person talks… and the other person does
// the work and fact checks everything.").
//
// A business's BOOK is the whole truth for its calls: the services it sells, the questions
// each service needs, the price, and the checks the worker runs. "Complete" for a booking is
// defined HERE, by the book's own question list for the service being booked — never by a
// hard-coded field list in the spine. The talker captures the book's questions conversationally,
// in whatever order the caller gives them; a "don't know" is an answer; nothing outside the
// book is demanded.
//
// Resolution order: (1) cfg.settings.book — the tenant's own loaded book in its config;
// (2) books.js — the shelf of book data keyed by organization slug. A company with no book
// has no book services: the legacy paths behave exactly as before.
const I = require("./intake");
const SHELF = require("./books");

const clip = function (v, n) { return String(v == null ? "" : v).replace(/[\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n || 300); };
const DONT_KNOW = /^(don'?t know|dont know|do not know|unknown|not sure|no idea|n\/?a)$/i;
const KINDS = ["text", "date", "time", "address", "phone", "email", "number"];

function normQuestion(q) {
  if (!q || !q.key) return null;
  return { key: clip(q.key, 60), label: clip(q.label, 160) || clip(q.key, 60), required: q.required !== false, kind: KINDS.indexOf(q.kind) >= 0 ? q.kind : "text" };
}
function normService(s) {
  if (!s || !s.id) return null;
  const qs = (Array.isArray(s.questions) ? s.questions : []).map(normQuestion).filter(Boolean);
  return { id: clip(s.id, 60), name: clip(s.name, 120) || clip(s.id, 60), kind: clip(s.kind, 40) || "appointment",
    price_cents: s.price_cents == null ? null : Math.max(0, Math.round(Number(s.price_cents) || 0)),
    price_label: clip(s.price_label, 80) || null, duration_min: Math.max(0, Math.floor(Number(s.duration_min) || 0)) || null,
    needs_email: !!s.needs_email, questions: qs,
    checks: (Array.isArray(s.checks) ? s.checks : []).map(function (c) { return clip(c, 40); }).filter(Boolean) };
}
function normalize(raw) {
  if (!raw || typeof raw !== "object") return null;
  const services = (Array.isArray(raw.services) ? raw.services : []).map(normService).filter(Boolean);
  if (!services.length) return null;
  return { services: services };
}
// resolve(cfg, slug) -> book | null. Pure and synchronous: safe for prompt building.
function resolve(cfg, slug) {
  const fromCfg = normalize(cfg && cfg.settings && cfg.settings.book);
  if (fromCfg) return fromCfg;
  if (slug && SHELF[slug]) return normalize(SHELF[slug]);
  return null;
}
function serviceById(book, id) {
  if (!book || !id) return null;
  return book.services.find(function (s) { return s.id === String(id); }) || null;
}
function todayET() { return new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); }
// A date answer is readable if it is already YYYY-MM-DD or names a real calendar date the
// caller stated ("November 12", "2026-11-12", "11/12/2026"). Returns YYYY-MM-DD or null.
function parseDate(v) {
  const s = clip(v, 60); if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return okYmd(+m[1], +m[2], +m[3]) ? s.slice(0, 10) : null;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/); if (m) return okYmd(+m[3], +m[1], +m[2]) ? m[3] + "-" + pad(+m[1]) + "-" + pad(+m[2]) : null;
  const t = Date.parse(s); if (isFinite(t)) { const d = new Date(t); return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()); }
  return null;
}
const pad = function (n) { return String(n).padStart(2, "0"); };
function okYmd(y, mo, d) { const x = new Date(Date.UTC(y, mo - 1, d)); return x.getUTCFullYear() === y && x.getUTCMonth() === mo - 1 && x.getUTCDate() === d; }

// validateAnswers(service, fields) — the book's definition of COMPLETE.
// fields = { customer_name, callback_phone, email, answers: {key: value}, unknown: [keys] }.
// Returns { ok, missing: [{key,label}], problems: [codes], data: {answers, unknown} }.
// A required question is missing only when it has NO answer and was NOT answered "don't know".
// An answer of the wrong shape (an unreadable date, a non-number for a number question) is
// missing too — the talker re-asks it conversationally; she never submits around it.
function validateAnswers(service, fields) {
  fields = fields || {};
  const answers = {}, unknown = new Set((Array.isArray(fields.unknown) ? fields.unknown : []).map(String));
  const raw = fields.answers || {};
  const missing = [], problems = [];
  if (!clip(fields.customer_name, 120)) missing.push({ key: "customer_name", label: "the caller's name" });
  if (!I.phone(fields.callback_phone)) missing.push({ key: "callback_phone", label: "the callback number" });
  const email = clip(fields.email, 160).toLowerCase();
  if (service.needs_email) {
    if (!email) missing.push({ key: "email", label: "the caller's email for the written confirmation" });
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) problems.push("email_invalid");
  }
  service.questions.forEach(function (q) {
    let v = raw[q.key]; v = v == null ? "" : clip(v, 300);
    if (v && DONT_KNOW.test(v)) { unknown.add(q.key); v = ""; }
    if (!v) { if (q.required && !unknown.has(q.key)) missing.push({ key: q.key, label: q.label }); return; }
    if (q.kind === "date") { const p = parseDate(v); if (!p) { if (!unknown.has(q.key)) missing.push({ key: q.key, label: q.label }); return; } v = p; }
    else if (q.kind === "number") { const n = Number(String(v).replace(/[^0-9.]/g, "")); if (!(n >= 0) || String(v).replace(/[^0-9.]/g, "") === "") { if (!unknown.has(q.key)) missing.push({ key: q.key, label: q.label }); return; } }
    else if (q.kind === "phone") { const p = I.phone(v); if (!p) { if (!unknown.has(q.key)) missing.push({ key: q.key, label: q.label }); return; } v = p; }
    else if (q.kind === "address") { if (!I.addressCheck(v).ok && !I.stateOf(v)) { if (!unknown.has(q.key)) missing.push({ key: q.key, label: q.label }); return; } }
    else if (q.kind === "email") { if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { if (!unknown.has(q.key)) missing.push({ key: q.key, label: q.label }); return; } }
    answers[q.key] = v;
  });
  return { ok: missing.length === 0 && problems.length === 0, missing: missing, problems: problems, data: { answers: answers, unknown: Array.from(unknown) } };
}

// runChecks(service, fields) — the worker's fact-check pass, behind the talker (step 3 uses
// it; defined here because the checks are the book's own data). Each declared check verifies
// one thing the book says must be true. Returns [{check, ok, detail}]; a failed HARD check
// (a date in the past, no reachable phone) means the booking is flagged, never silently saved
// as good.
const HARD = { date_not_past: 1, phone_sane: 1 };
function runChecks(service, fields) {
  fields = fields || {}; const answers = fields.answers || {}, out = [];
  (service.checks || []).forEach(function (c) {
    if (c === "date_not_past") {
      const dq = service.questions.find(function (q) { return q.kind === "date"; });
      const v = dq ? parseDate(answers[dq.key]) : null;
      out.push(v ? { check: c, ok: v >= todayET(), detail: v >= todayET() ? "date " + v + " is not in the past" : "date " + v + " is in the past" }
                 : { check: c, ok: false, detail: "no readable date to check" });
    } else if (c === "phone_sane") {
      out.push({ check: c, ok: !!I.phone(fields.callback_phone), detail: I.phone(fields.callback_phone) ? "callback number is a reachable US number" : "callback number is not a valid US number" });
    } else if (c === "address_sane") {
      const bad = service.questions.filter(function (q) { return q.kind === "address"; }).filter(function (q) { const a = answers[q.key]; return !a || (!I.addressCheck(a).ok && !I.stateOf(a)); });
      out.push({ check: c, ok: bad.length === 0, detail: bad.length ? "address not readable: " + bad.map(function (q) { return q.key; }).join(", ") : "addresses read as real street addresses" });
    } else if (c === "email_sane") {
      const e = clip(fields.email, 160);
      out.push({ check: c, ok: !e || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e), detail: e ? "email shape checked" : "no email given" });
    }
  });
  return out;
}
function hardFailures(results) { return (results || []).filter(function (r) { return !r.ok && HARD[r.check]; }); }

const money = function (c) { return "$" + (c / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
function priceSay(service) {
  if (service.price_cents == null) return null;
  return service.price_cents === 0 ? (service.price_label || "Free") : money(service.price_cents);
}
// The prompt block: the ONLY place the talker learns what this company books. Written for the
// ear: services, prices and the book's own questions — nothing else about the company.
function promptBlock(book) {
  if (!book) return null;
  const L = ["BOOK SERVICES — THIS COMPANY'S BOOK (loaded for this call; it is the whole truth about what can be booked here, what it costs and what must be asked):"];
  book.services.forEach(function (s) {
    const price = s.price_cents == null ? "the price is confirmed in the written confirmation — never invent one" : s.price_cents === 0 ? "free — say so plainly" : money(s.price_cents);
    L.push("- " + s.name + " (service id: " + s.id + "): price " + price + (s.duration_min ? "; about " + s.duration_min + " minutes" : "") + ". Questions for this service: " +
      (s.questions.length ? s.questions.map(function (q) { return q.label + (q.required ? " (needed)" : " (only if they offer it)"); }).join("; ") : "none beyond name and callback number") + (s.needs_email ? "; plus the caller's email for the written confirmation" : "") + ".");
  });
  L.push("BOOK FLOW (for a book service — this replaces the shipment flow for that booking): 1) CAPTURE conversationally, in whatever order the caller gives the answers — ask ONLY this service's questions plus the caller's name, callback number and (when the service needs it) email. Ask for nothing outside the book: a service that does not ask about freight, weight or addresses never hears those questions. A caller who says they don't know an answer HAS answered — note it and move on; never press, never guess for them. 2) READ-BACK: once you have the answers, read the service, the answers and the date back ONCE — the date with its real weekday and date against the DATE ANCHOR — and ask \"Is that correct?\" Only a clear yes unlocks the submit. 3) SUBMIT: call submit_job_packet ONCE with service set to the service id and answers carrying everything, in one packet. If it says a piece is still missing, ask for that ONE piece conversationally and submit again with everything — never say a hold line, never say you are checking anything, never submit the same incomplete packet twice hoping it passes. 4) PRICE: the packet returns the book's price instantly — state it ONCE, plainly, then ask: shall I book it? 5) CONFIRM: on a clear yes, call confirm_job_packet ONCE and keep talking naturally; the back-office worker checks the facts and saves the booking ONCE, and its result is announced to you in this same call — say exactly what it says, once.");
  return L.join("\n");
}
module.exports = { resolve, normalize, serviceById, validateAnswers, runChecks, hardFailures, parseDate, promptBlock, priceSay, DONT_KNOW };
