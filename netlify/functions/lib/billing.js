function invoiceTime(invoice) { return new Date(invoice.paid_at || invoice.created_at || 0).getTime() || 0; }
function num(value) { var number = Number(value); return isFinite(number) ? number : 0; }

function deriveStatus(invoices) {
    var list = (invoices || []).slice().sort(function (first, second) { return invoiceTime(first) - invoiceTime(second); });
    var out = { license_status: "unpaid", support_status: "none", flex_status: null, flex_paid: 0, flex_total: null };

    var fullPaid = list.some(function (invoice) { return invoice.kind === "license" && invoice.status === "paid"; });

    var down = list.filter(function (invoice) { return invoice.kind === "flex_down" && invoice.status === "paid"; });
    if (down.length) {
        var inst = list.filter(function (invoice) { return invoice.kind === "flex_installment"; });
        var paidSum = down.reduce(function (sum, invoice) { return sum + num(invoice.amount); }, 0) +
            inst.filter(function (invoice) { return invoice.status === "paid"; }).reduce(function (sum, invoice) { return sum + num(invoice.amount); }, 0);
        var total = 0;
        down.concat(inst).forEach(function (invoice) { if (invoice.meta && num(invoice.meta.flex_total) > total) total = num(invoice.meta.flex_total); });
        out.flex_paid = paidSum;
        out.flex_total = total || null;
        var lastInst = inst[inst.length - 1];
        if (total && paidSum >= total) { out.flex_status = "complete"; fullPaid = true; }
        else if (lastInst && lastInst.status === "failed") { out.flex_status = "past_due"; out.license_status = "past_due"; }
        else { out.flex_status = "active"; out.license_status = "flex_active"; }
    }
    if (fullPaid) out.license_status = "paid";

    var sup = list.filter(function (invoice) { return invoice.kind === "support"; });
    if (sup.length) {
        var last = sup[sup.length - 1];
        out.support_status = last.status === "paid" ? "active" : last.status === "failed" ? "past_due" : last.status === "void" ? "cancelled" : "active";
    }
    return out;
}

function isPaid(org) {
    var status = String((org && org.license_status) || "").toLowerCase();
    return status === "paid" || status === "flex_active";
}

var TIER_DEFAULTS = {
    starter:    { trucks: 10,  drivers: 10,  dispatch: 100 },
    growth:     { trucks: 50,  drivers: 50,  dispatch: 100 },
    fleet:      { trucks: 150, drivers: 150, dispatch: 100 },
    enterprise: { trucks: 300, drivers: 300, dispatch: null }
};
function limitsFor(org) {
    var defaults = TIER_DEFAULTS[String(org.plan || "starter").toLowerCase()] || TIER_DEFAULTS.starter;
    function pick(value, defaultValue) { return value === null || value === undefined || value === "" || isNaN(Number(value)) ? defaultValue : Number(value); }
    return { tier: String(org.plan || "starter").toLowerCase(), trucks: pick(org.max_trucks, defaults.trucks), drivers: pick(org.max_drivers, defaults.drivers), dispatch: pick(org.max_dispatch, defaults.dispatch) };
}

module.exports = { TIER_DEFAULTS: TIER_DEFAULTS, limitsFor: limitsFor, deriveStatus: deriveStatus, isPaid: isPaid };
