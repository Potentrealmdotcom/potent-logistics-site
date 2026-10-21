// Tenant onboarding intake for Elevate on POTENT OS. Asked once at first setup; the owner can edit later.
// Answers belong to ONE company. Nothing from POTENT's own line (prices, discounts, phone numbers, service area) is ever mixed in.
const GROUPS = [
  { id: "company", title: "Your company", q: [
    ["name", "Company name, and the name you want Elevate to say on calls?", true],
    ["services", "What do you haul or what services do you offer? (freight, junk removal, both, other)", true],
    ["area", "Service area: cities, or a radius from your home base?", true],
    ["equipment", "Equipment you run (box truck size, liftgate, pallet jack, crew size)?", false],
    ["hours", "Hours you take calls and jobs?", true] ] },
  { id: "pricing", title: "Your pricing (yours only; Elevate never invents it)", q: [
    ["pricing", "How do you price a job? (per mile, flat, hourly) with your rates and minimums.", true],
    ["extras", "Extra charges you use (waiting time, extra stops, stairs, same-day)?", false],
    ["discounts", "Do you offer any discounts? (referral, family, returning) Give your own amounts, or write none.", true],
    ["refunds", "Are all your sales final, or what is your refund policy, in your words?", true] ] },
  { id: "booking", title: "How you book", q: [
    ["need_to_quote", "What must a caller give you before you can quote? (pickup, delivery, what/weight/size, date)", true],
    ["lead_time", "Lead time you require, and blackout days or times?", false],
    ["site_details", "Pickup or delivery details you always need (dock, gate code, contact on site)?", false],
    ["callback_rule", "When should Elevate take a callback instead of booking? What number does the callback go to?", true] ] },
  { id: "voice", title: "How you talk to customers", q: [
    ["greeting", "Greeting you want used, in your company's name?", false],
    ["upsells", "Upsells you actually offer (tracking, wallet or payment link, repeat or recurring service)?", false],
    ["complaints", "Complaints or price pushback: Elevate handles them (Acknowledge, Associate, Ask) or passes them to the owner?", true],
    ["languages", "Languages your customers speak that Elevate should support?", false] ] },
  { id: "money", title: "Money", q: [
    ["payment", "Your own Stripe or payment setup for the payment-link step (your account, your money).", false],
    ["deposit", "Deposit required before booking, if any: your amount or rule.", false] ] }
];
const QUESTIONS = []; GROUPS.forEach(function (g) { g.q.forEach(function (x, i) { QUESTIONS.push({ id: x[0], group: g.id, text: x[1], required: !!x[2] }); }); });
const IDS = QUESTIONS.map(function (q) { return q.id; });
const clean = function (v, n) { return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, " ").replace(/\s+/g, " ").trim().slice(0, n || 1200); };
function sanitize(a) { const o = {}; IDS.forEach(function (k) { const v = clean(a && a[k]); if (v) o[k] = v; }); return o; }
function missing(a) { return QUESTIONS.filter(function (q) { return q.required && !(a && a[q.id]); }).map(function (q) { return q.id; }); }
// Text added to the system prompt for a tenant. Only the owner's own words go in; blanks are said to be blanks.
function block(a, orgName) {
  a = a || {}; const L = [], say = function (k, label) { L.push(label + ": " + (a[k] ? a[k] : "NOT PROVIDED")); };
  L.push("THIS COMPANY (everything below comes only from the owner; it is the whole truth about this company; you know nothing else about its prices, areas or policies):");
  L.push("Company: " + (a.name || orgName || "the company"));
  say("services", "Services"); say("area", "Service area"); say("equipment", "Equipment"); say("hours", "Hours");
  say("pricing", "How the owner prices jobs"); say("extras", "Extra charges"); say("discounts", "Discounts (the only ones that exist)"); say("refunds", "Refunds and sales policy");
  say("need_to_quote", "Needed before quoting"); say("lead_time", "Lead time and blackout days"); say("site_details", "Site details always needed"); say("callback_rule", "When to take a callback, and where it goes");
  say("upsells", "Upsells the company really offers"); say("complaints", "Complaints and pushback"); say("languages", "Customer languages"); say("deposit", "Deposit");
  L.push("PRICING AND POLICY RULES FOR THIS COMPANY: state a price, minimum, extra charge, discount or refund rule ONLY if it is written above. Do the arithmetic only from the owner's stated rates. If a price or policy is NOT PROVIDED or does not cover the caller's job, do not guess and do not borrow from anywhere else: tell the caller you will have the owner confirm that part and use create_callback_task. Never mention or compare any other company's prices. Offer only the upsells listed above.");
  L.push("DISCOVERY STYLE (applies to every company): open warmly and ask permission; start with situation questions before pitching; ask one open question at a time and let them finish; confirm the problem, its impact and the goal in their words before you offer anything; qualify (need, timing, who decides) before quoting; and handle objections with the 3 A's: Acknowledge what they said, Associate it with what matters to them, then Ask a question. Never argue, never pressure, never promise what the owner did not say.");
  return L.join("\n");
}
module.exports = { GROUPS, QUESTIONS, IDS, sanitize, missing, block };
