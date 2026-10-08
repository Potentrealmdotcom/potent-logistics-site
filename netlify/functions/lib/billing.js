// netlify/functions/lib/billing.js
// One place that turns a company's invoice rows into its license / support /
// Flex Pay status. Used by stripe-webhook.js and auth.js so they never disagree.
//
// invoice row: { kind, status, amount, created_at, meta }
//   kind:   license | flex_down | flex_installment | support | other
//   status: open | paid | failed | void

function t(r) { return new Date(r.paid_at || r.created_at || 0).getTime() || 0; }
function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

function deriveStatus(invoices) {
    var list = (invoices || []).slice().sort(function (a, b) { return t(a) - t(b); });
    var out = { license_status: "unpaid", support_status: "none", flex_status: null, flex_paid: 0, flex_total: null };

    // one-time license paid in full
    var fullPaid = list.some(function (r) { return r.kind === "license" && r.status === "paid"; });

    // Flex Pay: down payment + installments
    var down = list.filter(function (r) { return r.kind === "flex_down" && r.status === "paid"; });
    if (down.length) {
        var inst = list.filter(function (r) { return r.kind === "flex_installment"; });
        var paidSum = down.reduce(function (s, r) { return s + num(r.amount); }, 0) +
            inst.filter(function (r) { return r.status === "paid"; }).reduce(function (s, r) { return s + num(r.amount); }, 0);
        var total = 0;
        down.concat(inst).forEach(function (r) { if (r.meta && num(r.meta.flex_total) > total) total = num(r.meta.flex_total); });
        out.flex_paid = paidSum;
        out.flex_total = total || null;
        var lastInst = inst[inst.length - 1];
        if (total && paidSum >= total) { out.flex_status = "complete"; fullPaid = true; }
        else if (lastInst && lastInst.status === "failed") { out.flex_status = "past_due"; out.license_status = "past_due"; }
        else { out.flex_status = "active"; out.license_status = "flex_active"; }
    }
    if (fullPaid) out.license_status = "paid";

    // monthly support: the newest support invoice decides
    var sup = list.filter(function (r) { return r.kind === "support"; });
    if (sup.length) {
        var last = sup[sup.length - 1];
        out.support_status = last.status === "paid" ? "active" : last.status === "failed" ? "past_due" : last.status === "void" ? "cancelled" : "active";
    }
    return out;
}

// Features that only paid customers get (branding, payouts). Flex customers
// who are current count as paid; past_due / suspended / unpaid do not.
function isPaid(org) {
    var s = String((org && org.license_status) || "").toLowerCase();
    return s === "paid" || s === "flex_active";
}

var TIER_DEFAULTS = {
    starter:    { trucks: 10,  drivers: 10,  dispatch: 100 },
    growth:     { trucks: 50,  drivers: 50,  dispatch: 100 },
    fleet:      { trucks: 150, drivers: 150, dispatch: 100 },
    enterprise: { trucks: 300, drivers: 300, dispatch: null } // null = unlimited dispatch profiles
};
function limitsFor(org) {
    var d = TIER_DEFAULTS[String(org.plan || "starter").toLowerCase()] || TIER_DEFAULTS.starter;
    function pick(v, dv) { return v === null || v === undefined || v === "" || isNaN(Number(v)) ? dv : Number(v); } // dv may be null = unlimited
    return { tier: String(org.plan || "starter").toLowerCase(), trucks: pick(org.max_trucks, d.trucks), drivers: pick(org.max_drivers, d.drivers), dispatch: pick(org.max_dispatch, d.dispatch) };
}


module.exports = { TIER_DEFAULTS: TIER_DEFAULTS, limitsFor: limitsFor, deriveStatus: deriveStatus, isPaid: isPaid };
