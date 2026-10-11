function invoiceTime(invoice) {
    return new Date(invoice.paid_at || invoice.created_at || 0).getTime() || 0;
}

function amountNumber(value) {
    var amount = Number(value);
    return isFinite(amount) ? amount : 0;
}

function deriveStatus(invoices) {
    var list = (invoices || []).slice().sort(function (first, second) {
        return invoiceTime(first) - invoiceTime(second);
    });
    var result = { license_status: "unpaid", support_status: "none", flex_status: null, flex_paid: 0, flex_total: null };
    var fullPaid = list.some(function (invoice) {
        return invoice.kind === "license" && invoice.status === "paid";
    });
    var downPayments = list.filter(function (invoice) {
        return invoice.kind === "flex_down" && invoice.status === "paid";
    });

    if (downPayments.length) {
        var installments = list.filter(function (invoice) { return invoice.kind === "flex_installment"; });
        var paidSum = downPayments.reduce(function (sum, invoice) { return sum + amountNumber(invoice.amount); }, 0) +
            installments.filter(function (invoice) { return invoice.status === "paid"; })
                .reduce(function (sum, invoice) { return sum + amountNumber(invoice.amount); }, 0);
        var total = 0;
        downPayments.concat(installments).forEach(function (invoice) {
            if (invoice.meta && amountNumber(invoice.meta.flex_total) > total) total = amountNumber(invoice.meta.flex_total);
        });
        result.flex_paid = paidSum;
        result.flex_total = total || null;
        var lastInstallment = installments[installments.length - 1];
        if (total && paidSum >= total) { result.flex_status = "complete"; fullPaid = true; }
        else if (lastInstallment && lastInstallment.status === "failed") { result.flex_status = "past_due"; result.license_status = "past_due"; }
        else { result.flex_status = "active"; result.license_status = "flex_active"; }
    }
    if (fullPaid) result.license_status = "paid";

    var support = list.filter(function (invoice) { return invoice.kind === "support"; });
    if (support.length) {
        var latest = support[support.length - 1];
        result.support_status = latest.status === "paid" ? "active" : latest.status === "failed" ? "past_due" : latest.status === "void" ? "cancelled" : "active";
    }
    return result;
}

function isPaid(org) {
    var status = String((org && org.license_status) || "").toLowerCase();
    return status === "paid" || status === "flex_active";
}

var TIER_DEFAULTS = {
    starter: { trucks: 10, drivers: 10, dispatch: 100 },
    growth: { trucks: 50, drivers: 50, dispatch: 100 },
    fleet: { trucks: 150, drivers: 150, dispatch: 100 },
    enterprise: { trucks: 300, drivers: 300, dispatch: null }
};

function limitsFor(org) {
    var defaults = TIER_DEFAULTS[String(org.plan || "starter").toLowerCase()] || TIER_DEFAULTS.starter;
    function pick(value, fallback) {
        return value === null || value === undefined || value === "" || isNaN(Number(value)) ? fallback : Number(value);
    }
    return {
        tier: String(org.plan || "starter").toLowerCase(),
        trucks: pick(org.max_trucks, defaults.trucks),
        drivers: pick(org.max_drivers, defaults.drivers),
        dispatch: pick(org.max_dispatch, defaults.dispatch)
    };
}

module.exports = { TIER_DEFAULTS: TIER_DEFAULTS, limitsFor: limitsFor, deriveStatus: deriveStatus, isPaid: isPaid };
