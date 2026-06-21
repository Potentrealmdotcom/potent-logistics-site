"use strict";
var useState = React.useState;
var useEffect = React.useEffect;
var C = {
    black: "#080808", surface: "#0F0F0F", card: "#141414", border: "#222222",
    orange: "#F0E000", orangeSoft: "#F0E00014", gold: "#C8962A",
    white: "#F2F2F2", dim: "#888888", faint: "#444444",
    green: "#1DB954", red: "#E53E3E", yellow: "#F0E000", blue: "#4299E1", purple: "#9F7AEA",
};
var ADMIN_PW = "POTENTADMIN0421";
var BUSINESS_EMAIL = "potentlogistics@pm.me";
var PHONE_NUMBER = "+17706484228";
var PHONE_DISPLAY = "(770) 648-4228";
var TRUCK_MPG = 9;
var HELPER_FEE = 100;
var GAS_BY_STATE = {
    "GA": 3.76, "FL": 3.82, "AL": 3.68, "MS": 3.65, "TN": 3.71, "SC": 3.74, "NC": 3.79,
    "VA": 3.89, "WV": 3.84, "KY": 3.73, "AR": 3.62, "LA": 3.69,
    "MD": 3.94, "DC": 4.18, "DE": 3.87, "NJ": 3.91, "PA": 3.96, "NY": 4.12,
    "CT": 3.99, "RI": 3.88, "MA": 3.97, "VT": 3.93, "NH": 3.85, "ME": 3.90,
    "OH": 3.82, "IN": 3.78, "IL": 4.05, "MI": 3.86, "WI": 3.80, "MN": 3.83,
    "IA": 3.71, "MO": 3.67, "KS": 3.64, "NE": 3.69, "SD": 3.72, "ND": 3.74,
    "TX": 3.59, "OK": 3.61, "NM": 3.78, "AZ": 3.92, "CO": 3.88, "UT": 3.85,
    "NV": 4.15, "ID": 3.82, "WY": 3.77, "MT": 3.81,
    "CA": 4.89, "OR": 4.12, "WA": 4.18, "AK": 4.35, "HI": 4.72,
};
var NATIONAL_AVG_GAS = 4.07;
var FALLBACK_GAS = 3.76;
function getGasForState(stateAbbr) {
    if (!stateAbbr) return FALLBACK_GAS;
    return GAS_BY_STATE[stateAbbr.toUpperCase()] || NATIONAL_AVG_GAS;
}
var PRICE_TABLE = {
    delivery: { local: 300, regional: 600, longdist: 1200 },
    freight: { local: 400, regional: 750, longdist: 1500 },
    event: { local: 350, regional: 700, longdist: 1300 },
    discreet: { local: 500, regional: 900, longdist: 1800 },
};
var SERVICES = [
    { id: "delivery", icon: "\u{1F4E6}", name: "Delivery", tagline: "Single or multi-item pickup & drop-off", priceRange: "$4.50/mile",
        desc: "We pick it up, load it, deliver it. Items must be ready at curb, driveway, or doorway.",
        includes: ["Curbside or doorway pickup", "Secure loading into 16ft box truck", "Direct transport", "Curbside drop-off"],
        excludes: ["Pickup from inside home", "More than 1 flight of stairs", "Packing services"],
        rule: "Items must be packed, ready, and accessible before driver arrives.",
        sizes: ["Small (fits in a box)", "Medium (appliance-sized)", "Large (furniture-sized)"] },
    { id: "freight", icon: "\u{1F69B}", name: "Freight Transport", tagline: "Business cargo, bulk goods & large loads", priceRange: "$400-$1,500",
        desc: "Built for businesses moving bulk cargo or large commercial loads. Local, regional, and long-distance routes.",
        includes: ["Commercial and business cargo", "Bulk or multi-item loads", "Ground-level or dock access", "Local & long-distance"],
        excludes: ["Hazardous materials", "Interior warehouse retrieval", "Unpacked fragile items"],
        rule: "Freight must be staged at ground level or dock access before arrival.",
        sizes: ["Single pallet", "Multi-pallet", "Full van load"] },
    { id: "event", icon: "\u{1F3AA}", name: "Event Drop-Off", tagline: "Transport event gear, vendor goods & supplies", priceRange: "$4.50/mile",
        desc: "We transport your event materials and supplies to the venue. Drop-off only — no setup included.",
        includes: ["Tables, chairs, decor & displays", "Vendor product transport", "On-time scheduled delivery", "Local & regional routes"],
        excludes: ["Setup or installation", "Return pickup (separate job)", "Items not staged at pickup"],
        rule: "All items must be staged and ready at pickup location before driver arrives.",
        sizes: ["Small load (1-5 items)", "Medium load (van half-full)", "Large load (full van)"] },
    { id: "discreet", icon: "\u{1F512}", name: "Discreet / High-Value", tagline: "Confidential handling for sensitive shipments", priceRange: "$500-$1,800",
        desc: "Private, direct transport for high-value items. No intermediate stops. Minimal visibility.",
        includes: ["Dedicated van for your cargo only", "Direct A-to-B route", "Discreet handling", "Confidential job handling"],
        excludes: ["Multi-stop routes", "Shared vehicle", "Hazardous or illegal items"],
        rule: "High-value items must be secure and packaged before pickup. Verification required.",
        sizes: ["Small high-value item", "Medium secured load", "Full discreet shipment"] },
];
var SPEEDS = [
    { id: "standard", label: "Standard", sub: "Scheduled dispatch", icon: "🟢", mult: 1.0, color: "#1DB954" },
    { id: "urgent", label: "Urgent", sub: "Priority same-day", icon: "⚡", mult: 1.3, color: "#F0E000" },
    { id: "afterhours", label: "After-Hours", sub: "Late night / early morning", icon: "🌙", mult: 1.6, color: "#F0E000" },
    { id: "overnight", label: "Overnight", sub: "Driven through the night — arrives by morning", icon: "🌃", mult: 1.8, color: "#9F7AEA" },
    { id: "emergency", label: "Emergency", sub: "Urgent + after-hours", icon: "🚨", mult: 2.0, color: "#E53E3E" },
];
var ZONES = [
    { id: "local", label: "Local", sub: "0-50 miles", estMiles: 40 },
    { id: "regional", label: "Regional", sub: "51-150 miles", estMiles: 120 },
    { id: "longdist", label: "Long Distance", sub: "150+ miles", estMiles: 280 },
];
var PAYMENTS = [
    { id: "cash", label: "💵 Cash", sub: "10% discount — due at pickup", badge: "BEST DEAL", discount: true },
    { id: "card", label: "💳 Card", sub: "All major cards at pickup", badge: null, discount: false },
    { id: "cashapp", label: "💚 Cash App", sub: "$PotentLogistics — include Job ID", badge: null, discount: false },
    { id: "wire", label: "🏦 Wire Transfer", sub: "Business accounts — invoice provided", badge: "BUSINESS", discount: false },
    { id: "bitcoin", label: "₿ Bitcoin / Crypto", sub: "BTC/ETH/USDC — address sent after booking", badge: "CRYPTO", discount: false },
];
var STATUS_FLOW = ["Confirmed", "En Route", "Arrived", "Loading", "In Transit", "Delivered", "Completed"];
var STATUS_COLOR = { "Confirmed": "#4299E1", "En Route": "#F0E000", "Arrived": "#F0E000", "Loading": "#F6AD55", "In Transit": "#9F7AEA", "Delivered": "#1DB954", "Completed": "#1DB954" };
var CITIES = [
    { id: "atlanta", name: "Atlanta", sub: "Metro Atlanta, GA", zone: "local", emoji: "🏙", grad: "linear-gradient(160deg,#1a0800,#2d1200)", desc: "Same-day and urgent delivery, freight, and event transport across Metro Atlanta." },
    { id: "macon", name: "Macon", sub: "Macon, GA", zone: "regional", emoji: "🌿", grad: "linear-gradient(160deg,#001a0d,#002b18)", desc: "Regional cargo runs to and from Macon. Scheduled and same-day routes available." },
    { id: "conyers", name: "Conyers / Covington", sub: "Home Base", zone: "local", emoji: "🚐", grad: "linear-gradient(160deg,#0d0d1a,#151530)", desc: "Our home base. Fastest response times in the area." },
    { id: "savannah", name: "Savannah", sub: "Savannah, GA", zone: "longdist", emoji: "🌊", grad: "linear-gradient(160deg,#001a1a,#002e2e)", desc: "Long-distance runs to Savannah. 48-72 hr scheduling preferred for best pricing." },
];
var CANCEL_POLICY = [
    { label: "Same-Day / Urgent", rule: "FINAL — no cancellation once confirmed. Non-refundable.", color: "#E53E3E", allowed: false },
    { label: "Under 24 hours", rule: "Dispatch fee ($100) retained. Balance refunded.", color: "#F0E000", allowed: false },
    { label: "24-48 hours", rule: "50% cancellation fee applies.", color: "#F0E000", allowed: true },
    { label: "48+ hours", rule: "Free cancellation. Full refund or credit.", color: "#1DB954", allowed: true },
];
var TIME_SLOTS = [
    { id: "morning", label: "Morning", time: "7:00 AM", icon: "🌅", afterHoursOnly: false },
    { id: "midmorning", label: "Mid-Morning", time: "10:00 AM", icon: "🌤", afterHoursOnly: false },
    { id: "afternoon", label: "Afternoon", time: "1:00 PM", icon: "☀️", afterHoursOnly: false },
    { id: "lateafternoon", label: "Late Afternoon", time: "4:00 PM", icon: "🌆", afterHoursOnly: false },
    { id: "afterhours", label: "After-Hours", time: "7:00 PM", icon: "🌙", afterHoursOnly: true },
    { id: "overnight", label: "Overnight Run", time: "10:00 PM", icon: "🌃", afterHoursOnly: true, overnightOnly: true },
];
var SLOT_BLOCKS = {
    local: 1, regional: 2, longdist: 99, oos: 99,
};
var MAX_JOBS_PER_DAY = 3;
function getSlotsBlocked(slotId, zone) {
    if (slotId === "overnight") return TIME_SLOTS.map(function (s) { return s.id; });
    var count = SLOT_BLOCKS[zone] || 1;
    if (count >= 99) return TIME_SLOTS.map(function (s) { return s.id; });
    var startIdx = TIME_SLOTS.findIndex(function (s) { return s.id === slotId; });
    if (startIdx < 0) return [slotId];
    var blocked = [];
    for (var i = 0; i < count && startIdx + i < TIME_SLOTS.length; i++) {
        blocked.push(TIME_SLOTS[startIdx + i].id);
    }
    return blocked;
}
function getOOSDatesBlocked(startDate, miles) {
    var days = Math.ceil(miles / 400) + 1;
    var dates = [];
    for (var i = 0; i < days; i++) {
        var d = new Date(startDate);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
}
function getDayAvailability(dateStr, jobs, blockedDates) {
    if (blockedDates && blockedDates.indexOf(dateStr) > -1) {
        return { available: false, reason: "Unavailable", slots: [], jobCount: 0 };
    }
    var dayJobs = jobs.filter(function (j) {
        if (j.status === "Cancelled" || j.status === "Completed") return false;
        if (j.oosJob && j.oosBlocked) {
            return j.oosBlocked.indexOf(dateStr) > -1;
        }
        return j.date === dateStr;
    });
    if (dayJobs.length >= MAX_JOBS_PER_DAY) {
        return { available: false, reason: "Fully Booked", slots: [], jobCount: dayJobs.length };
    }
    var takenSlots = [];
    dayJobs.forEach(function (j) {
        if (j.timeSlot) {
            var blocked = getSlotsBlocked(j.timeSlot, j.oosJob ? "oos" : j.zone);
            blocked.forEach(function (s) { if (takenSlots.indexOf(s) < 0) takenSlots.push(s); });
        }
    });
    var availableSlots = TIME_SLOTS.filter(function (s) {
        return takenSlots.indexOf(s.id) < 0;
    });
    return {
        available: availableSlots.length > 0,
        reason: availableSlots.length === 0 ? "Fully Booked" : "Available",
        slots: availableSlots,
        takenSlots: takenSlots,
        jobCount: dayJobs.length,
    };
}
function isSlotAvailable(dateStr, slotId, zone, jobs, blockedDates) {
    var day = getDayAvailability(dateStr, jobs, blockedDates);
    if (!day.available) return false;
    var needed = getSlotsBlocked(slotId, zone);
    var taken = day.takenSlots || [];
    return needed.every(function (s) { return taken.indexOf(s) < 0; });
}
function getNextAvailableDates(jobs, blockedDates, count) {
    var results = [];
    var d = new Date();
    var max = 90;
    while (results.length < count && max > 0) {
        var ds = d.toISOString().split("T")[0];
        var av = getDayAvailability(ds, jobs, blockedDates);
        if (av.available) results.push(ds);
        d.setDate(d.getDate() + 1);
        max--;
    }
    return results;
}
function getCancelPolicy(jobDate, speed) {
    if (speed === "urgent" || speed === "emergency") return CANCEL_POLICY[0];
    var hrs = (new Date(jobDate) - new Date()) / (1000 * 60 * 60);
    if (hrs <= 0) return CANCEL_POLICY[0];
    if (hrs < 24) return CANCEL_POLICY[1];
    if (hrs < 48) return CANCEL_POLICY[2];
    return CANCEL_POLICY[3];
}
    return React.createElement("div", { onClick: function () { props.onChange(!props.value); }, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: props.value ? C.orangeSoft : C.surface, border: "1.5px solid " + (props.value ? C.orange : C.border), borderRadius: 9, cursor: "pointer", marginBottom: 10 } },
        React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: C.white } }, props.label),
            props.sub && React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2 } }, props.sub)),
        React.createElement("div", { style: { width: 22, height: 22, borderRadius: "50%", background: props.value ? C.orange : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#000", fontWeight: 700, flexShrink: 0 } }, props.value ? "✓" : ""));
}
function WeightPicker(props) {
    return React.createElement("div", { style: { marginBottom: 14 } },
        React.createElement(Lbl, null, "Item Weight"),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } }, WEIGHT_TIERS.map(function (w) {
            return React.createElement("div", { key: w.id, onClick: function () { props.onChange(w.id); }, style: { border: "1.5px solid " + (props.value === w.id ? C.orange : C.border), borderRadius: 9, padding: "10px 10px", cursor: "pointer", background: props.value === w.id ? C.orangeSoft : "transparent" } },
                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: props.value === w.id ? C.orange : C.white } },
                    w.label,
                    w.fee > 0 ? " (+$" + w.fee + ")" : ""),
                React.createElement("div", { style: { fontSize: 10, color: C.dim, marginTop: 2 } }, w.sub));
        })));
}
var STRIPE_PUBLISHABLE_KEY = "pk_test_51TkbJt609KMwZrdNFMhtiMoXPybNfnYTGh9ZhCTTkF4oCq7lLpK1vwaNOh99mZJOYNDs6BDfkfRQe2e30VxL8SXv00KGQjFWcW";
function StripeCardForm(props) {
    var sErr = useState("");
    var cardError = sErr[0];
    var setCardError = sErr[1];
    var sProc = useState(false);
    var processing = sProc[0];
    var setProcessing = sProc[1];
    var sStripe = useState(null);
    var stripe = sStripe[0];
    var setStripe = sStripe[1];
    var sCard = useState(null);
    var cardEl = sCard[0];
    var setCardEl = sCard[1];
    var sReady = useState(false);
    var ready = sReady[0];
    var setReady = sReady[1];
    useEffect(function () {
        var attempts = 0;
        var iv = setInterval(function () {
            attempts++;
            if (window.Stripe) {
                clearInterval(iv);
                var s = window.Stripe(STRIPE_PUBLISHABLE_KEY);
                setStripe(s);
                var elements = s.elements();
                var card = elements.create("card", {
                    style: { base: { color: "#fff", fontSize: "16px", fontFamily: "'DM Sans',sans-serif",
                            "::placeholder": { color: "#888" } }, invalid: { color: "#E53E3E" } }
                });
                card.mount("#stripe-card-element");
                setCardEl(card);
                setReady(true);
            }
            else if (attempts > 40) {
                clearInterval(iv);
                setCardError("Could not load card form. Check your connection and try again.");
            }
        }, 150);
        return function () { clearInterval(iv); };
    }, []);
    function handlePay() {
        if (!stripe || !cardEl)
            return;
        setProcessing(true);
        setCardError("");
        fetch("/.netlify/functions/create-payment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: props.amount, jobId: props.jobId, customerName: props.customerName })
        })
            .then(function (res) { return res.json(); })
            .then(function (data) {
            if (data.error) {
                setCardError(data.error);
                setProcessing(false);
                return null;
            }
            return stripe.confirmCardPayment(data.clientSecret, { payment_method: { card: cardEl } });
        })
            .then(function (result) {
            if (!result)
                return;
            if (result.error) {
                setCardError(result.error.message);
                setProcessing(false);
            }
            else if (result.paymentIntent && result.paymentIntent.status === "succeeded") {
                setProcessing(false);
                props.onSuccess(result.paymentIntent.id);
            }
        })
            .catch(function (err) {
            setCardError(err.message || "Payment failed. Please try again.");
            setProcessing(false);
        });
    }
    return React.createElement("div", { style: { background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "18px", marginTop: 14 } },
        React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 4 } }, "\uD83D\uDCB3 Enter Card Details"),
        React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 12 } }, "Secured by Stripe. Your card info never touches our servers."),
        React.createElement("div", { id: "stripe-card-element", style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, padding: "12px 14px", marginBottom: 10, minHeight: 42 } }),
        !ready && React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 10 } }, "Loading secure card form..."),
        cardError && React.createElement("div", { style: { color: C.red, fontSize: 12, marginBottom: 10 } },
            "\u26A0 ",
            cardError),
        React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement(Btn, { variant: "ghost", onClick: props.onCancel, style: { flex: 1 }, disabled: processing }, "Cancel"),
            React.createElement(Btn, { onClick: handlePay, style: { flex: 2 }, disabled: processing || !ready }, processing ? "Processing..." : "Pay $" + props.amount + " Now")));
}
function CallBtns(props) {
    if (!props.phone)
        return null;
    var n = props.phone.replace(/\D/g, "");
    return React.createElement("div", { style: { display: "flex", gap: 6 } },
        React.createElement("a", { href: "tel:" + n, style: { textDecoration: "none" } },
            React.createElement(Btn, { variant: "muted", style: { padding: "6px 12px", fontSize: 11 } }, "\uD83D\uDCDE Call")),
        React.createElement("a", { href: "sms:" + n, style: { textDecoration: "none" } },
            React.createElement(Btn, { variant: "muted", style: { padding: "6px 12px", fontSize: 11 } }, "\uD83D\uDCAC Text")));
}
function StepBar(props) {
    return React.createElement("div", { style: { display: "flex", alignItems: "center", marginBottom: 24 } }, props.steps.map(function (s, i) {
        return React.createElement("div", { key: s, style: { display: "flex", alignItems: "center", flex: i < props.steps.length - 1 ? 1 : "none" } },
            React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3 } },
                React.createElement("div", { style: { width: 26, height: 26, borderRadius: "50%", background: props.current > i + 1 ? C.green : props.current === i + 1 ? C.orange : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#000", flexShrink: 0 } }, props.current > i + 1 ? "✓" : i + 1),
                React.createElement("span", { style: { fontSize: 9, color: props.current === i + 1 ? C.orange : C.faint, fontWeight: props.current === i + 1 ? 700 : 400, textAlign: "center", maxWidth: 52, whiteSpace: "nowrap" } }, s)),
            i < props.steps.length - 1 && React.createElement("div", { style: { flex: 1, height: 1.5, background: props.current > i + 1 ? C.green : C.border, margin: "0 4px", marginBottom: 14 } }));
    }));
}
function Logo(props) {
    var sz = props.size || 22;
    return React.createElement("svg", { width: sz, height: sz, viewBox: "0 0 40 40", fill: "none" },
        React.createElement("polygon", { points: "20,2 24,14 37,14 27,22 31,35 20,27 9,35 13,22 3,14 16,14", fill: "#C8962A", opacity: "0.9" }),
        React.createElement("polygon", { points: "20,8 23,17 32,17 25,22 28,31 20,26 12,31 15,22 8,17 17,17", fill: "#F0E000", opacity: "0.7" }));
}
function BrandName() {
    return React.createElement("span", null,
        React.createElement("span", { style: { color: C.white } }, "POTENT"),
        React.createElement("span", { style: { color: C.orange } }, " LOGISTICS"));
}
function TrackerView(props) {
    var jobs = props.jobs;
    var [input, setInput] = useState("");
    var [job, setJob] = useState(null);
    var [err, setErr] = useState("");
    function search() {
        var found = jobs.find(function (j) { return j.id.toUpperCase() === input.trim().toUpperCase(); });
        if (found) {
            setJob(found);
            setErr("");
        }
        else {
            setJob(null);
            setErr("No job found. Check your Job ID and try again.");
        }
    }
    var idx = job ? STATUS_FLOW.indexOf(job.status) : -1;
    var pol = job ? getCancelPolicy(job.date, job.speed) : null;
    return React.createElement("div", { style: { maxWidth: 480, margin: "0 auto" } },
        React.createElement(Card, { style: { marginBottom: 16 } },
            React.createElement("div", { style: { fontSize: 17, fontWeight: 800, color: C.white, marginBottom: 4 } }, "Track Your Job"),
            React.createElement("div", { style: { color: C.dim, fontSize: 13, marginBottom: 16 } }, "Enter the Job ID from your booking confirmation."),
            React.createElement("div", { style: { display: "flex", gap: 8 } },
                React.createElement("input", { value: input, onChange: function (e) { setInput(e.target.value); }, onKeyDown: function (e) { if (e.key === "Enter")
                        search(); }, placeholder: "e.g. PL-260615-A3F9", style: { flex: 1, background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, outline: "none", fontFamily: "inherit" } }),
                React.createElement(Btn, { onClick: search, disabled: !input.trim() }, "Search")),
            err && React.createElement("div", { style: { color: C.red, fontSize: 12, marginTop: 10 } },
                "\u26A0 ",
                err)),
        job && React.createElement(Card, null,
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 2 } }, "Job ID"),
                    React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.orange, letterSpacing: 1 } }, job.id)),
                React.createElement(Tag, { color: STATUS_COLOR[job.status] || C.dim }, job.status)),
            React.createElement("div", { style: { overflowX: "auto", marginBottom: 20 } },
                React.createElement("div", { style: { display: "flex", alignItems: "flex-start", minWidth: 480 } }, STATUS_FLOW.map(function (s, i) {
                    return React.createElement("div", { key: s, style: { display: "flex", alignItems: "center", flex: i < STATUS_FLOW.length - 1 ? 1 : "none" } },
                        React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 4 } },
                            React.createElement("div", { style: { width: 24, height: 24, borderRadius: "50%", background: i < idx ? C.green : i === idx ? (STATUS_COLOR[s] || C.orange) : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#000" } }, i < idx ? "✓" : i + 1),
                            React.createElement("div", { style: { fontSize: 9, color: i === idx ? (STATUS_COLOR[s] || C.orange) : C.faint, textAlign: "center", maxWidth: 52, fontWeight: i === idx ? 700 : 400 } }, s)),
                        i < STATUS_FLOW.length - 1 && React.createElement("div", { style: { flex: 1, height: 2, background: i < idx ? C.green : C.border, margin: "0 2px", marginBottom: 16 } }));
                }))),
            [["Service", job.serviceName], ["From", job.origin], ["To", job.destination], ["Date", job.date]].map(function (row) {
                return React.createElement("div", { key: row[0], style: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid " + C.border } },
                    React.createElement("span", { style: { color: C.dim } }, row[0]),
                    React.createElement("span", { style: { color: C.white, fontWeight: 600 } }, row[1]));
            }),
            pol && React.createElement("div", { style: { marginTop: 14, borderTop: "1px solid " + C.border, paddingTop: 14 } },
                React.createElement("div", { style: { fontSize: 11, color: C.dim, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 } }, "Cancellation Policy"),
                React.createElement("div", { style: { background: pol.color + "12", border: "1px solid " + pol.color + "33", borderRadius: 9, padding: "10px 12px" } },
                    React.createElement("div", { style: { fontSize: 12, color: pol.color, fontWeight: 700, marginBottom: 3 } }, pol.label),
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, lineHeight: 1.6 } }, pol.rule),
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 6 } },
                        "Questions? Call: ",
                        React.createElement("a", { href: "tel:" + PHONE_NUMBER, style: { color: C.orange, textDecoration: "none", fontWeight: 700 } }, PHONE_DISPLAY))))));
}
function BookingView(props) {
    var [step, setStep] = useState(1);
    var [svc, setSvc] = useState(null);
    var [form, setForm] = useState({ name: "", phone: "", origin: "", destination: "", pickupCity: "", dropoffCity: "", zone: props.preZone || "local", speed: "standard", itemSize: "", helper: false, weightTier: "light", extraStop: false, readyConfirm: false, isBusiness: false, payment: "cash", discreet: false, notes: "", date: "", timeSlot: "" });
    var [quote, setQuote] = useState(null);
    var [jobId, setJobId] = useState(null);
    var [showCardForm, setShowCardForm] = useState(false);
    function set(k, v) { setForm(function (f) { var n = Object.assign({}, f); n[k] = v; return n; }); }
    var isMileageSvc = svc && MILEAGE_SERVICES.indexOf(svc.id) > -1;
    var gaCities = Object.keys(CITY_COORDS).filter(function (c) { return c.indexOf(", GA") > -1; });
    var miles = isMileageSvc ? (estimateMiles(form.pickupCity, form.dropoffCity) || 0) : 0;
    function doQuote() { setQuote(calcQuote(svc.id, form.zone, form.speed, form.payment, form.helper, form.discreet, form.weightTier, form.extraStop, miles)); setStep(4); }
    function doBook(paymentIntentId) {
        var q = calcQuote(svc.id, form.zone, form.speed, form.payment, form.helper, form.discreet, form.weightTier, form.extraStop, miles);
        var id = makeJobId();
        var job = { id: id, customer: form.name, phone: form.phone, service: svc.id, serviceName: svc.name,
            origin: isMileageSvc ? form.pickupCity : form.origin, destination: isMileageSvc ? form.dropoffCity : form.destination,
            zone: form.zone, speed: form.speed,
            basePrice: q.base, finalPrice: q.total, status: "Confirmed", payment: form.payment,
            discreet: form.discreet, isBusiness: form.isBusiness,
            date: form.date || new Date().toISOString().split("T")[0],
            timeSlot: form.timeSlot || "morning",
            notes: (isMileageSvc ? (miles + " mi · $" + INSTATE_RATE_PER_MILE + "/mi" + (form.notes ? " — " + form.notes : "")) : form.notes) + (paymentIntentId ? " · Stripe: " + paymentIntentId : ""),
            helperHours: 0, fuel: 30, weightTier: form.weightTier, miles: isMileageSvc ? miles : null,
            paymentIntentId: paymentIntentId || null, paidOnline: !!paymentIntentId };
        props.onBook(job);
        sendEmail(job);
        setJobId(id);
        setQuote(q);
        setStep(5);
    }
    function handleConfirmClick() {
        if (form.payment === "card") {
            setShowCardForm(true);
        }
        else {
            doBook();
        }
    }
    function reset() {
        setStep(1);
        setSvc(null);
        setShowCardForm(false);
        setForm({ name: "", phone: "", origin: "", destination: "", pickupCity: "", dropoffCity: "", zone: props.preZone || "local", speed: "standard", itemSize: "", helper: false, weightTier: "light", extraStop: false, readyConfirm: false, isBusiness: false, payment: "cash", discreet: false, notes: "", date: "", timeSlot: "" });
        setQuote(null);
        setJobId(null);
    }
    var pay = PAYMENTS.find(function (p) { return p.id === form.payment; }) || PAYMENTS[0];
    var STEPS = ["Service", "Location", "Details", "Quote", "Done"];
    if (step === 1)
        return React.createElement("div", { style: { maxWidth: 560, margin: "0 auto" } },
            React.createElement(StepBar, { steps: STEPS, current: 1 }),
            React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 4 } }, "What do you need moved?"),
            React.createElement("div", { style: { color: C.dim, fontSize: 13, marginBottom: 20 } }, "Select the service that fits your job."),
            React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 10 } }, SERVICES.map(function (s) {
                return React.createElement("div", { key: s.id, onClick: function () { setSvc(s); setStep(2); }, style: { background: C.card, border: "1.5px solid " + C.border, borderRadius: 12, padding: "16px 18px", cursor: "pointer" } },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 } },
                        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
                            React.createElement("span", { style: { fontSize: 22 } }, s.icon),
                            React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: C.white } }, s.name),
                                React.createElement("div", { style: { fontSize: 12, color: C.dim } }, s.tagline))),
                        React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.orange } }, s.priceRange)),
                    React.createElement("div", { style: { fontSize: 12, color: C.dim, lineHeight: 1.6, marginBottom: 10 } }, s.desc),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 8 } }, s.includes.map(function (inc) { return React.createElement("div", { key: inc, style: { fontSize: 11, color: C.dim, display: "flex", gap: 5 } },
                            React.createElement("span", { style: { color: C.green, flexShrink: 0 } }, "\u2713"),
                            inc); })),
                    React.createElement("div", { style: { background: "#E53E3E10", border: "1px solid #E53E3E22", borderRadius: 7, padding: "8px 10px", marginBottom: 8 } },
                        React.createElement("div", { style: { fontSize: 10, color: C.red, fontWeight: 700, textTransform: "uppercase", marginBottom: 4 } }, "Not Included"),
                        s.excludes.map(function (ex) { return React.createElement("div", { key: ex, style: { fontSize: 11, color: C.dim, display: "flex", gap: 5 } },
                            React.createElement("span", { style: { color: C.red } }, "\u2715"),
                            ex); })),
                    React.createElement("div", { style: { fontSize: 11, color: C.orange, fontStyle: "italic" } },
                        "\u26A0 ",
                        s.rule));
            })));
    if (step === 2)
        return React.createElement("div", { style: { maxWidth: 520, margin: "0 auto" } },
            React.createElement(StepBar, { steps: STEPS, current: 2 }),
            React.createElement(Card, null,
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 16 } },
                    React.createElement("span", { style: { fontSize: 20 } }, svc.icon),
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white } }, svc.name)),
                React.createElement(TxtIn, { label: "Your Full Name", value: form.name, onChange: function (v) { set("name", v); }, placeholder: "e.g. Jordan Smith" }),
                React.createElement(TxtIn, { label: "Phone Number", value: form.phone, onChange: function (v) { set("phone", v); }, type: "tel", placeholder: "404-000-0000" }),
                isMileageSvc ? React.createElement("div", null,
                    React.createElement(TxtIn, { label: "Pickup Address", value: form.origin, onChange: function (v) { set("origin", v); }, placeholder: "123 Main St, Conyers, GA" }),
                    React.createElement(TxtIn, { label: "Drop-Off Address", value: form.destination, onChange: function (v) { set("destination", v); }, placeholder: "456 Broad St, Atlanta, GA" }),
                    React.createElement(Lbl, null, "Nearest City \u2014 Pickup"),
                    React.createElement("div", { style: { marginBottom: 14 } },
                        React.createElement("select", { value: form.pickupCity, onChange: function (e) { set("pickupCity", e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } },
                            React.createElement("option", { value: "" }, "\u2014 Select nearest city \u2014"),
                            gaCities.map(function (c) { return React.createElement("option", { key: c, value: c }, c); }))),
                    React.createElement(Lbl, null, "Nearest City \u2014 Drop-Off"),
                    React.createElement("div", { style: { marginBottom: 14 } },
                        React.createElement("select", { value: form.dropoffCity, onChange: function (e) { set("dropoffCity", e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } },
                            React.createElement("option", { value: "" }, "\u2014 Select nearest city \u2014"),
                            gaCities.map(function (c) { return React.createElement("option", { key: c, value: c }, c); }))),
                    form.pickupCity && form.dropoffCity && React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "33", borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 12 } },
                        React.createElement("span", { style: { color: C.dim } }, "Estimated distance: "),
                        React.createElement("span", { style: { color: C.orange, fontWeight: 800 } }, miles + " miles"),
                        React.createElement("span", { style: { color: C.dim } },
                            " \u00B7 $",
                            INSTATE_RATE_PER_MILE,
                            "/mi \u00B7 est. "),
                        React.createElement("span", { style: { color: C.orange, fontWeight: 800 } }, "$" + Math.round(miles * INSTATE_RATE_PER_MILE)))) : React.createElement("div", null,
                    React.createElement(TxtIn, { label: "Pickup Address or City", value: form.origin, onChange: function (v) { set("origin", v); }, placeholder: "123 Main St, Conyers, GA" }),
                    React.createElement(TxtIn, { label: "Drop-Off Address or City", value: form.destination, onChange: function (v) { set("destination", v); }, placeholder: "456 Broad St, Atlanta, GA" }),
                    React.createElement(Lbl, null, "Distance Zone"),
                    React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 14 } }, ZONES.map(function (z) {
                        return React.createElement("div", { key: z.id, onClick: function () { set("zone", z.id); }, style: { flex: 1, border: "1.5px solid " + (form.zone === z.id ? C.orange : C.border), borderRadius: 9, padding: "10px 8px", cursor: "pointer", background: form.zone === z.id ? C.orangeSoft : "transparent", textAlign: "center" } },
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: form.zone === z.id ? C.orange : C.white } }, z.label),
                            React.createElement("div", { style: { fontSize: 10, color: C.dim } }, z.sub));
                    })),
                    form.zone === "longdist" && React.createElement("div", { style: { background: "#4299E112", border: "1px solid #4299E133", borderRadius: 9, padding: "10px 12px", marginBottom: 10 } },
                        React.createElement("div", { style: { fontSize: 11, color: "#4299E1", fontWeight: 700, marginBottom: 2 } }, "\uD83D\uDCC5 Long Distance \u2014 48-72 Hr Notice Preferred"),
                        React.createElement("div", { style: { fontSize: 11, color: C.dim, lineHeight: 1.6 } },
                            "Scheduling ahead gets the best rate. Same-day long distance is Emergency pricing (x2). Call: ",
                            React.createElement("a", { href: "tel:" + PHONE_NUMBER, style: { color: C.orange, textDecoration: "none", fontWeight: 700 } }, PHONE_DISPLAY)))),
                React.createElement("div", { style: { background: "#F0E00012", border: "1px solid #F0E00033", borderRadius: 9, padding: "10px 12px", marginBottom: 14 } },
                    React.createElement("div", { style: { fontSize: 11, color: C.yellow, fontWeight: 700, marginBottom: 2 } }, "\u23F1 15-Minute Ready Rule"),
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, lineHeight: 1.6 } }, "Once driver arrives you have 15 minutes to present all items. If not ready, $100 delay fee applies.")),
                React.createElement(Toggle, { label: "\u2713 Items are packed and ready at curb, driveway, or doorway", sub: "Required to confirm booking", value: form.readyConfirm, onChange: function (v) { set("readyConfirm", v); } }),
                React.createElement(Lbl, null, "Preferred Date"),
                React.createElement("div", { style: { marginBottom: 14 } },
                    React.createElement("input", { type: "date", value: form.date || "", min: new Date().toISOString().split("T")[0], onChange: function (e) { set("date", e.target.value); set("timeSlot", ""); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" } })),
                form.date && (function () {
                    var avail = getDayAvailability(form.date, props.jobs || [], props.blockedDates || []);
                    if (!avail.available)
                        return React.createElement("div", { style: { background: C.red + "12", border: "1px solid " + C.red + "33", borderRadius: 9, padding: "12px 14px", marginBottom: 14 } },
                            React.createElement("div", { style: { color: C.red, fontWeight: 700, marginBottom: 4 } },
                                "\uD83D\uDEAB ",
                                avail.reason),
                            React.createElement("div", { style: { fontSize: 12, color: C.dim } }, "This date is not available. Please select another date."));
                    return React.createElement("div", { style: { marginBottom: 14 } },
                        React.createElement(Lbl, null, "Available Time Slots"),
                        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, avail.slots.map(function (slot) {
                            var isAfterHoursSpeed = form.speed === "afterhours" || form.speed === "emergency";
                            var isOvernightSpeed = form.speed === "overnight";
                            if (slot.overnightOnly && !isOvernightSpeed)
                                return null;
                            if (slot.afterHoursOnly && !slot.overnightOnly && !isAfterHoursSpeed && !isOvernightSpeed)
                                return null;
                            if (!slot.overnightOnly && isOvernightSpeed)
                                return null;
                            var slotOk = isSlotAvailable(form.date, slot.id, form.zone, props.jobs || [], props.blockedDates || []);
                            if (!slotOk)
                                return null;
                            return React.createElement("div", { key: slot.id, onClick: function () { set("timeSlot", slot.id); }, style: { border: "1.5px solid " + (form.timeSlot === slot.id ? C.orange : C.border), borderRadius: 9, padding: "11px 14px", cursor: "pointer", background: form.timeSlot === slot.id ? C.orangeSoft : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
                                    React.createElement("span", { style: { fontSize: 18 } }, slot.icon),
                                    React.createElement("div", null,
                                        React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: form.timeSlot === slot.id ? C.orange : C.white } }, slot.label),
                                        React.createElement("div", { style: { fontSize: 11, color: C.dim } }, slot.time))),
                                form.timeSlot === slot.id && React.createElement("div", { style: { width: 20, height: 20, borderRadius: "50%", background: C.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#000", fontWeight: 800 } }, "\u2713"));
                        })));
                })(),
                React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 4 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setStep(1); }, style: { flex: 1 } }, "\u2190 Back"),
                    React.createElement(Btn, { onClick: function () { setStep(3); }, disabled: !form.name || !form.phone || !form.origin || !form.destination || !form.readyConfirm || !form.date || !form.timeSlot || (isMileageSvc && (!form.pickupCity || !form.dropoffCity)), style: { flex: 2 } }, "Continue \u2192"))));
    if (step === 3)
        return React.createElement("div", { style: { maxWidth: 520, margin: "0 auto" } },
            React.createElement(StepBar, { steps: STEPS, current: 3 }),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 16 } }, "Job Details"),
                React.createElement(Lbl, null, "Item Size"),
                React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 } }, svc.sizes.map(function (sz) {
                    return React.createElement("div", { key: sz, onClick: function () { set("itemSize", sz); }, style: { border: "1.5px solid " + (form.itemSize === sz ? C.orange : C.border), borderRadius: 9, padding: "10px 14px", cursor: "pointer", background: form.itemSize === sz ? C.orangeSoft : "transparent", fontSize: 13, fontWeight: form.itemSize === sz ? 700 : 400, color: form.itemSize === sz ? C.orange : C.white } }, sz);
                })),
                React.createElement(Toggle, { label: "Helper needed", sub: "+$" + HELPER_FEE + " flat — for larger or heavier loads", value: form.helper, onChange: function (v) { set("helper", v); } }),
                React.createElement(WeightPicker, { value: form.weightTier, onChange: function (v) { set("weightTier", v); } }),
                React.createElement(Toggle, { label: "Extra stop needed", sub: "+$" + EXTRA_STOP_FEE + " fee", value: form.extraStop, onChange: function (v) { set("extraStop", v); } }),
                React.createElement(Lbl, null, "Dispatch Speed"),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 } }, SPEEDS.map(function (sp) {
                    return React.createElement("div", { key: sp.id, onClick: function () { set("speed", sp.id); }, style: { border: "1.5px solid " + (form.speed === sp.id ? sp.color : C.border), borderRadius: 9, padding: "10px 12px", cursor: "pointer", background: form.speed === sp.id ? sp.color + "15" : "transparent" } },
                        React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: form.speed === sp.id ? sp.color : C.white } }, sp.icon + " " + sp.label),
                        React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2 } }, sp.sub),
                        React.createElement("div", { style: { fontSize: 11, color: form.speed === sp.id ? sp.color : C.faint, marginTop: 2, fontWeight: 600 } }, sp.mult === 1 ? "Base rate" : "x" + sp.mult + " rate"));
                })),
                form.speed === "overnight" && React.createElement("div", { style: { background: "#9F7AEA12", border: "1px solid #9F7AEA33", borderRadius: 9, padding: "10px 12px", marginBottom: 14 } },
                    React.createElement("div", { style: { fontSize: 11, color: "#9F7AEA", fontWeight: 700, marginBottom: 2 } }, "\uD83C\uDF03 Overnight Run \u2014 Subject to Availability"),
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, lineHeight: 1.6 } }, "We personally drive this overnight and it's only available if we're not already booked that night. If we can't take it, we'll call you back within the hour to confirm or suggest the next available night.")),
                React.createElement(Lbl, null, "Payment Method"),
                React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 } }, PAYMENTS.map(function (p) {
                    return React.createElement("div", { key: p.id, onClick: function () { set("payment", p.id); }, style: { border: "1.5px solid " + (form.payment === p.id ? (p.discount ? C.green : C.orange) : C.border), borderRadius: 9, padding: "10px 14px", cursor: "pointer", background: form.payment === p.id ? (p.discount ? C.green + "12" : C.orangeSoft) : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: form.payment === p.id ? (p.discount ? C.green : C.orange) : C.white } }, p.label),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2 } }, p.sub)),
                        React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
                            p.badge && React.createElement("span", { style: { background: p.discount ? C.green + "22" : C.orange + "22", color: p.discount ? C.green : C.orange, borderRadius: 5, padding: "2px 7px", fontSize: 9, fontWeight: 700 } }, p.badge),
                            form.payment === p.id && React.createElement("div", { style: { width: 18, height: 18, borderRadius: "50%", background: p.discount ? C.green : C.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", fontWeight: 800 } }, "\u2713")));
                })),
                pay.discount && React.createElement("div", { style: { background: C.green + "12", border: "1px solid " + C.green + "33", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: C.green, fontWeight: 700 } }, "\uD83D\uDCB5 10% cash discount applied to your total \u2014 due at pickup!"),
                svc.id === "discreet" && React.createElement(Toggle, { label: "\uD83D\uDD12 Discreet handling confirmed", sub: "Direct route, no stops, confidential (+35%)", value: form.discreet, onChange: function (v) { set("discreet", v); } }),
                React.createElement(Toggle, { label: "\uD83C\uDFE2 Business / Repeat Customer", sub: "Check if booking for a business or returning customer", value: form.isBusiness, onChange: function (v) { set("isBusiness", v); } }),
                React.createElement(TxtIn, { label: "Special Notes (optional)", value: form.notes, onChange: function (v) { set("notes", v); }, placeholder: "Gate code, fragile items, access notes...", rows: 2 }),
                React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 4 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setStep(2); }, style: { flex: 1 } }, "\u2190 Back"),
                    React.createElement(Btn, { onClick: doQuote, style: { flex: 2 } }, "Get My Quote \u2192"))));
    if (step === 4 && quote) {
        var fuel = isMileageSvc
            ? (function () { var rt = miles * 2; var gal = rt / TRUCK_MPG; var ppg = props.gasPPG || FALLBACK_GAS; return { miles: miles, rt: rt, gal: Math.round(gal * 10) / 10, ppg: ppg, cost: Math.round(gal * ppg) }; })()
            : calcFuel(form.zone, props.gasPPG || FALLBACK_GAS);
        var pol = getCancelPolicy(new Date().toISOString().split("T")[0], form.speed);
        return React.createElement("div", { style: { maxWidth: 480, margin: "0 auto" } },
            React.createElement(StepBar, { steps: STEPS, current: 4 }),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 16 } }, "Your Locked Quote"),
                React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "33", borderRadius: 12, padding: "22px", marginBottom: 20, textAlign: "center" } },
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 } }, pay.discount ? "Cash Price — Due at Pickup" : "Estimated Total"),
                    React.createElement("div", { style: { fontSize: 56, fontWeight: 900, color: C.orange, lineHeight: 1 } }, "$" + quote.total),
                    pay.discount && React.createElement("div", { style: { marginTop: 8 } },
                        React.createElement("span", { style: { color: C.dim, fontSize: 13, textDecoration: "line-through", marginRight: 8 } }, "$" + quote.subtotal),
                        React.createElement("span", { style: { color: C.green, fontSize: 13, fontWeight: 700 } }, "You save $" + quote.cashDisc + " (10%)"))),
                React.createElement("div", { style: { marginBottom: 16 } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 } }, "How This Was Calculated"),
                    React.createElement("div", { style: { background: C.surface, borderRadius: 9, padding: "12px 14px", marginBottom: 8 } },
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                            React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, quote.isMileage ? (svc.name + " — " + quote.miles + " miles") : (svc.name + " — " + quote.zn.label)),
                                React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2 } }, quote.isMileage ? (quote.miles + " mi × $" + INSTATE_RATE_PER_MILE + "/mi") : (quote.zn.sub + " · Fixed base rate"))),
                            React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.white } }, "$" + quote.base))),
                    quote.speedFee > 0 && React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "9px 14px", borderBottom: "1px solid " + C.border } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 13, color: C.white, fontWeight: 600 } }, quote.spd.label + " speed"),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim } }, "x" + quote.spd.mult + " on base")),
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: quote.spd.color } }, "+" + "$" + quote.speedFee)),
                    quote.helperFee > 0 && React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid " + C.border } },
                        React.createElement("span", { style: { fontSize: 13, color: C.white, fontWeight: 600 } }, "Helper"),
                        React.createElement("span", { style: { fontSize: 14, fontWeight: 700, color: C.dim } }, "+" + "$" + quote.helperFee)),
                    quote.weightFee > 0 && React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid " + C.border } },
                        React.createElement("span", { style: { fontSize: 13, color: C.white, fontWeight: 600 } }, quote.weightTier.label),
                        React.createElement("span", { style: { fontSize: 14, fontWeight: 700, color: C.dim } }, "+$" + quote.weightFee)),
                    quote.extraStopFee > 0 && React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid " + C.border } },
                        React.createElement("span", { style: { fontSize: 13, color: C.white, fontWeight: 600 } }, "Extra stop"),
                        React.createElement("span", { style: { fontSize: 14, fontWeight: 700, color: C.dim } }, "+$" + quote.extraStopFee)),
                    quote.discreetFee > 0 && React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid " + C.border } },
                        React.createElement("span", { style: { fontSize: 13, color: C.white, fontWeight: 600 } }, "Discreet handling"),
                        React.createElement("span", { style: { fontSize: 14, fontWeight: 700, color: C.purple } }, "+" + "$" + quote.discreetFee)),
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: "1px solid " + C.border } },
                        React.createElement("span", { style: { fontSize: 13, color: C.dim } }, "Subtotal"),
                        React.createElement("span", { style: { fontSize: 13, color: C.white, fontWeight: 700 } }, "$" + quote.subtotal)),
                    pay.discount && React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "10px 14px", background: C.green + "10", borderBottom: "1px solid " + C.border } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 13, color: C.green, fontWeight: 700 } }, "\uD83D\uDCB5 Cash Discount"),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim } }, "10% off entire total")),
                        React.createElement("span", { style: { fontSize: 14, color: C.green, fontWeight: 700 } }, "-$" + quote.cashDisc)),
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: C.orangeSoft, borderRadius: "0 0 9px 9px" } },
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white } }, "Total" + (pay.discount ? " (Cash — Due at Pickup)" : "")),
                        React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: C.orange } }, "$" + quote.total))),
                React.createElement("div", { style: { background: C.surface, borderRadius: 9, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: C.dim, lineHeight: 1.8 } },
                    React.createElement("div", { style: { color: C.white, fontWeight: 700, marginBottom: 4 } }, "\u26FD Fuel Estimate (Your Records)"),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 } },
                        React.createElement("div", null,
                            React.createElement("span", { style: { color: C.faint } }, "Gas today"),
                            React.createElement("br", null),
                            React.createElement("strong", { style: { color: C.white } }, "$" + (props.gasPPG || FALLBACK_GAS).toFixed(2) + "/gal")),
                        React.createElement("div", null,
                            React.createElement("span", { style: { color: C.faint } }, "Est. miles"),
                            React.createElement("br", null),
                            React.createElement("strong", { style: { color: C.white } }, fuel.rt + " mi RT")),
                        React.createElement("div", null,
                            React.createElement("span", { style: { color: C.faint } }, "Fuel cost"),
                            React.createElement("br", null),
                            React.createElement("strong", { style: { color: C.orange } }, "$" + fuel.cost)))),
                React.createElement("div", { style: { background: pol.color + "12", border: "1px solid " + pol.color + "33", borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 12 } },
                    React.createElement("div", { style: { color: pol.color, fontWeight: 700, marginBottom: 3 } }, "📋 Cancellation — " + pol.label),
                    React.createElement("div", { style: { color: C.dim } }, pol.rule),
                    !pol.allowed && React.createElement("div", { style: { color: pol.color, fontWeight: 700, marginTop: 4 } }, "\u26A0 Same-day bookings are FINAL once confirmed.")),
                React.createElement("div", { style: { background: C.surface, borderRadius: 9, padding: "10px 14px", marginBottom: 18, fontSize: 12, color: C.dim, lineHeight: 1.7 } },
                    "\u2705 ",
                    React.createElement("strong", { style: { color: C.white } }, "Price Guarantee:"),
                    " This price is final. No hidden fees, no changes after confirmation."),
                !showCardForm && React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setStep(3); }, style: { flex: 1 } }, "\u2190 Back"),
                    React.createElement(Btn, { onClick: handleConfirmClick, style: { flex: 2 } }, form.payment === "card" ? "Continue to Payment 💳" : "Confirm & Book 🚐")),
                showCardForm && React.createElement(StripeCardForm, { amount: quote.total, jobId: "pending", customerName: form.name, onCancel: function () { setShowCardForm(false); }, onSuccess: function (paymentIntentId) { doBook(paymentIntentId); } })));
    }
    if (step === 5) {
        var cpay = PAYMENTS.find(function (p) { return p.id === form.payment; }) || PAYMENTS[0];
        return React.createElement("div", { style: { maxWidth: 480, margin: "0 auto" } },
            React.createElement(Card, { style: { textAlign: "center" } },
                React.createElement("div", { style: { fontSize: 52, marginBottom: 12 } }, "\uD83D\uDE90"),
                React.createElement("div", { style: { fontSize: 24, fontWeight: 900, color: C.white, marginBottom: 6 } }, "You're Booked!"),
                React.createElement("div", { style: { color: C.dim, fontSize: 14, marginBottom: 4 } }, "We'll contact you shortly, " + form.name + "."),
                React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: C.orange, marginBottom: 2 } }, "$" + (quote && quote.total)),
                React.createElement("div", { style: { color: C.dim, fontSize: 13, marginBottom: 20 } }, "via " + cpay.label + (cpay.discount ? " — due at pickup" : "")),
                React.createElement("div", { style: { background: C.surface, borderRadius: 10, padding: "14px 16px", marginBottom: 14, textAlign: "left" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 } }, "Your Job ID \u2014 Save This"),
                    React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: C.orange, letterSpacing: 2 } }, jobId),
                    React.createElement("div", { style: { fontSize: 12, color: C.dim, marginTop: 4 } }, "Use this to track your job under Track My Job")),
                form.payment === "cashapp" && React.createElement("div", { style: { background: C.green + "22", border: "1px solid " + C.green + "44", borderRadius: 9, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: C.green } },
                    "\uD83D\uDC9A Cash App: Send to ",
                    React.createElement("strong", null, "$PotentLogistics"),
                    " \u2014 include your Job ID"),
                form.payment === "wire" && React.createElement("div", { style: { background: C.orange + "18", border: "1px solid " + C.orange + "44", borderRadius: 9, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: C.orange } },
                    "\uD83C\uDFE6 Wire Transfer: We will call ",
                    React.createElement("strong", null, form.phone),
                    " with banking details."),
                form.payment === "bitcoin" && React.createElement("div", { style: { background: "#F7931A22", border: "1px solid #F7931A44", borderRadius: 9, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: "#F7931A" } },
                    "\u20BF Crypto: We will send wallet address to ",
                    React.createElement("strong", null, form.phone),
                    ". BTC/ETH/USDC accepted."),
                form.payment === "cash" && React.createElement("div", { style: { background: C.green + "12", border: "1px solid " + C.green + "33", borderRadius: 9, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: C.green } }, "\uD83D\uDCB5 Cash due at pickup \u2014 exact amount appreciated. Your 10% discount is applied."),
                form.payment === "card" && React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: C.dim } }, "\uD83D\uDCB3 All major cards accepted at pickup \u2014 Visa, MC, Amex, Discover."),
                React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: C.dim } }, "📧 Booking notification sent to our team. We'll reach out to " + form.phone + " to confirm."),
                React.createElement(Btn, { variant: "ghost", onClick: reset, style: { width: "100%" } }, "Book Another Job")));
    }
    return null;
}
function CalendarView(props) {
    var jobs = props.jobs;
    var today = new Date();
    var [month, setMonth] = useState(today.getMonth());
    var [year, setYear] = useState(today.getFullYear());
    var [selDay, setSelDay] = useState(null);
    var MN = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var dim = new Date(year, month + 1, 0).getDate();
    var firstDay = new Date(year, month, 1).getDay();
    function pad(n) { return String(n).padStart(2, "0"); }
    function dk(d) { return year + "-" + pad(month + 1) + "-" + pad(d); }
    var todayKey = today.getFullYear() + "-" + pad(today.getMonth() + 1) + "-" + pad(today.getDate());
    var byDate = {};
    jobs.forEach(function (j) { if (!byDate[j.date])
        byDate[j.date] = []; byDate[j.date].push(j); });
    function prevM() { if (month === 0) {
        setMonth(11);
        setYear(function (y) { return y - 1; });
    }
    else
        setMonth(function (m) { return m - 1; }); setSelDay(null); }
    function nextM() { if (month === 11) {
        setMonth(0);
        setYear(function (y) { return y + 1; });
    }
    else
        setMonth(function (m) { return m + 1; }); setSelDay(null); }
    var selJobs = selDay ? (byDate[dk(selDay)] || []) : [];
    var selRev = selJobs.reduce(function (s, j) { return s + j.finalPrice; }, 0);
    return React.createElement("div", { style: { maxWidth: 700, margin: "0 auto" } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
            React.createElement("button", { onClick: prevM, style: { background: C.surface, border: "1px solid " + C.border, color: C.white, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 16, fontFamily: "inherit" } }, "\u2190"),
            React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: C.white } }, MN[month] + " " + year),
            React.createElement("button", { onClick: nextM, style: { background: C.surface, border: "1px solid " + C.border, color: C.white, borderRadius: 8, padding: "7px 14px", cursor: "pointer", fontSize: 16, fontFamily: "inherit" } }, "\u2192")),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 4 } }, ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(function (d) { return React.createElement("div", { key: d, style: { textAlign: "center", fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1, padding: "4px 0" } }, d); })),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4, marginBottom: 16 } },
            Array.from({ length: firstDay }).map(function (_, i) { return React.createElement("div", { key: "e" + i }); }),
            Array.from({ length: dim }).map(function (_, i) {
                var d = i + 1;
                var key = dk(d);
                var dj = byDate[key] || [];
                var isToday = key === todayKey;
                var isSel = selDay === d;
                var rev = dj.reduce(function (s, j) { return s + j.finalPrice; }, 0);
                var avail = getDayAvailability(key, props.jobs || [], props.blockedDates || []);
                var isBlocked = (props.blockedDates || []).indexOf(key) > -1;
                var availDot = isBlocked ? C.red : avail.jobCount >= MAX_JOBS_PER_DAY ? C.red : avail.jobCount > 0 ? C.yellow : C.green;
                return React.createElement("div", { key: d, onClick: function () { setSelDay(isSel ? null : d); }, style: { position: "relative", background: isSel ? C.orange + "22" : isToday ? C.surface : "transparent", border: "1.5px solid " + (isSel ? C.orange : isToday ? C.orange + "66" : C.border), borderRadius: 9, padding: "6px 4px", cursor: "pointer", minHeight: 60 } },
                    React.createElement("div", { style: { position: "absolute", top: 4, left: 4, width: 6, height: 6, borderRadius: "50%", background: availDot } }),
                    React.createElement("div", { style: { fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? C.orange : C.dim, textAlign: "right", marginBottom: 3 } }, d),
                    isBlocked && React.createElement("div", { style: { fontSize: 8, color: C.red, fontWeight: 700, textAlign: "center" } }, "BLOCKED"),
                    !isBlocked && dj.slice(0, 2).map(function (j) { return React.createElement("div", { key: j.id, style: { background: (STATUS_COLOR[j.status] || C.dim) + "33", borderRadius: 4, padding: "2px 4px", fontSize: 9, color: STATUS_COLOR[j.status] || C.dim, fontWeight: 700, marginBottom: 2, overflow: "hidden", whiteSpace: "nowrap", textOverflow: "ellipsis" } }, j.customer.split(" ")[0]); }),
                    !isBlocked && dj.length > 2 && React.createElement("div", { style: { fontSize: 9, color: C.dim } }, "+" + (dj.length - 2) + " more"),
                    rev > 0 && React.createElement("div", { style: { fontSize: 9, color: C.orange, fontWeight: 700, marginTop: 2 } }, "$" + rev));
            })),
        selDay && React.createElement("div", null,
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 } },
                React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white } }, MN[month] + " " + selDay + " — " + selJobs.length + " job" + (selJobs.length !== 1 ? "s" : "") + (selJobs.length > 0 ? " · $" + selRev + " revenue" : "")),
                props.onToggleBlock && React.createElement("button", { onClick: function () { props.onToggleBlock(dk(selDay)); }, style: { border: "1px solid " + ((props.blockedDates || []).indexOf(dk(selDay)) > -1 ? C.green : C.red), borderRadius: 7, padding: "5px 12px", cursor: "pointer", background: (props.blockedDates || []).indexOf(dk(selDay)) > -1 ? C.green + "15" : "#E53E3E15", color: (props.blockedDates || []).indexOf(dk(selDay)) > -1 ? C.green : C.red, fontSize: 11, fontWeight: 700, fontFamily: "inherit" } }, (props.blockedDates || []).indexOf(dk(selDay)) > -1 ? "✓ Unblock This Day" : "🚫 Block This Day")),
            (function () {
                var avail = getDayAvailability(dk(selDay), props.jobs || [], props.blockedDates || []);
                return React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" } },
                    React.createElement("div", { style: { fontSize: 11, color: C.dim } }, "Availability:"),
                    (props.blockedDates || []).indexOf(dk(selDay)) > -1
                        ? React.createElement("span", { style: { fontSize: 11, color: C.red, fontWeight: 700 } }, "\uD83D\uDEAB Blocked by admin")
                        : avail.slots.length === 0
                            ? React.createElement("span", { style: { fontSize: 11, color: C.red, fontWeight: 700 } }, "\uD83D\uDD34 Fully Booked")
                            : avail.slots.map(function (s) { return React.createElement("span", { key: s.id, style: { fontSize: 10, background: C.green + "22", color: C.green, borderRadius: 5, padding: "2px 7px", fontWeight: 700 } }, s.icon + " " + s.time); }));
            })(),
            selJobs.length === 0
                ? React.createElement("div", { style: { color: C.dim, fontSize: 13, textAlign: "center", padding: "24px 0" } }, "No jobs scheduled this day.")
                : selJobs.map(function (j) {
                    return React.createElement(Card, { key: j.id, style: { marginBottom: 8, padding: "12px 14px" } },
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, j.id + " — " + j.customer),
                            React.createElement(Tag, { color: STATUS_COLOR[j.status] || C.dim }, j.status)),
                        React.createElement("div", { style: { fontSize: 11, color: C.dim } }, j.serviceName + " · " + j.origin + " → " + j.destination),
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 6 } },
                            React.createElement("div", { style: { fontSize: 11, color: C.dim } }, (SPEEDS.find(function (s) { return s.id === j.speed; }) || { label: j.speed }).label),
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: C.orange } }, "$" + j.finalPrice)));
                })));
}
function DriverPanel(props) {
    var jobs = props.jobs;
    var onUpdateStatus = props.onUpdateStatus;
    var active = jobs.filter(function (j) { return j.status !== "Completed"; });
    var [sel, setSel] = useState((active[0] && active[0].id) || null);
    var [timers, setT] = useState({});
    useEffect(function () {
        var iv = setInterval(function () {
            setT(function (t) {
                var n = Object.assign({}, t);
                Object.keys(n).forEach(function (k) { if (n[k] && n[k].on) {
                    n[k] = Object.assign({}, n[k], { s: (n[k].s || 0) + 1 });
                } });
                return n;
            });
        }, 1000);
        return function () { clearInterval(iv); };
    }, []);
    function fmt(s) { return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); }
    var job = jobs.find(function (j) { return j.id === sel; });
    return React.createElement("div", { style: { maxWidth: 520, margin: "0 auto" } },
        React.createElement("div", { style: { marginBottom: 14 } },
            React.createElement("div", { style: { color: C.dim, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 } }, "Active Jobs (" + active.length + ")"),
            React.createElement("div", { style: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 } }, active.length === 0
                ? React.createElement("div", { style: { color: C.dim, fontSize: 13 } }, "No active jobs.")
                : active.map(function (j) {
                    return React.createElement("div", { key: j.id, onClick: function () { setSel(j.id); }, style: { flexShrink: 0, border: "2px solid " + (sel === j.id ? C.orange : C.border), borderRadius: 9, padding: "10px 14px", cursor: "pointer", background: sel === j.id ? C.orangeSoft : C.card, minWidth: 130 } },
                        React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.white } }, j.id),
                        React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 4 } }, j.customer),
                        React.createElement(Tag, { color: STATUS_COLOR[j.status] || C.dim }, j.status));
                }))),
        job && React.createElement(Card, null,
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 19, fontWeight: 800, color: C.white } }, job.customer),
                    React.createElement("div", { style: { color: C.dim, fontSize: 12, marginBottom: 8 } }, job.phone),
                    React.createElement(CallBtns, { phone: job.phone })),
                React.createElement("div", { style: { textAlign: "right" } },
                    React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: C.orange } }, "$" + job.finalPrice),
                    React.createElement(Tag, { color: STATUS_COLOR[job.status] || C.dim }, job.status))),
            React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 12 } },
                React.createElement("div", { style: { flex: 1, background: C.surface, borderRadius: 8, padding: "10px 12px" } },
                    React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1 } }, "From"),
                    React.createElement("div", { style: { fontSize: 13, color: C.white, fontWeight: 600 } }, job.origin)),
                React.createElement("div", { style: { color: C.orange, fontSize: 16, alignSelf: "center" } }, "\u2192"),
                React.createElement("div", { style: { flex: 1, background: C.surface, borderRadius: 8, padding: "10px 12px" } },
                    React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1 } }, "To"),
                    React.createElement("div", { style: { fontSize: 13, color: C.white, fontWeight: 600 } }, job.destination))),
            job.notes && React.createElement("div", { style: { background: C.surface, borderRadius: 8, padding: "10px 12px", marginBottom: 12, fontSize: 12, color: C.dim } }, "📝 " + job.notes),
            React.createElement("div", { style: { marginBottom: 14 } },
                React.createElement("div", { style: { color: C.dim, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 8 } }, "Update Status"),
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, STATUS_FLOW.map(function (s) {
                    var sc = STATUS_COLOR[s] || C.dim;
                    return React.createElement("button", { key: s, onClick: function () { onUpdateStatus(job.id, s); }, style: { border: "1px solid " + (job.status === s ? sc : C.border), borderRadius: 6, padding: "6px 11px", cursor: "pointer", background: job.status === s ? sc + "22" : C.surface, color: job.status === s ? sc : C.dim, fontSize: 11, fontWeight: 600, fontFamily: "inherit" } }, s);
                }))),
            React.createElement("div", { style: { background: C.surface, borderRadius: 9, padding: "13px 15px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1 } }, "Job Timer"),
                    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C.orange } }, fmt((timers[job.id] && timers[job.id].s) || 0))),
                React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement(Btn, { onClick: function () { setT(function (t) { var n = Object.assign({}, t); n[job.id] = { on: true, s: (t[job.id] && t[job.id].s) || 0 }; return n; }); }, disabled: !!(timers[job.id] && timers[job.id].on), style: { padding: "7px 13px" } }, "\u25B6 Start"),
                    React.createElement(Btn, { variant: "muted", onClick: function () { setT(function (t) { var n = Object.assign({}, t); n[job.id] = Object.assign({}, t[job.id], { on: false }); return n; }); }, disabled: !(timers[job.id] && timers[job.id].on), style: { padding: "7px 13px" } }, "\u23F8 Pause")))));
}
function NewJobModal(props) {
    var [f, setF] = useState({ customer: "", phone: "", origin: "", destination: "", pickupCity: "", dropoffCity: "", serviceId: "delivery", zone: "local", speed: "standard", payment: "cash", discreet: false, notes: "", helper: false, weightTier: "light", priceTier: "standard", helperHours: "0", fuel: "30" });
    function set(k, v) { setF(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); }
    var isMileageSvc = MILEAGE_SERVICES.indexOf(f.serviceId) > -1;
    var gaCities = Object.keys(CITY_COORDS).filter(function (c) { return c.indexOf(", GA") > -1; });
    var miles = isMileageSvc ? (estimateMiles(f.pickupCity, f.dropoffCity) || 0) : 0;
    var q = calcQuote(f.serviceId, f.zone, f.speed, f.payment, f.helper, f.discreet, f.weightTier, false, miles, f.priceTier);
    var payObj = PAYMENTS.find(function (p) { return p.id === f.payment; }) || PAYMENTS[0];
    function submit() {
        if (!f.customer || (isMileageSvc ? (!f.pickupCity || !f.dropoffCity) : (!f.origin || !f.destination)))
            return;
        var svc = SERVICES.find(function (s) { return s.id === f.serviceId; }) || SERVICES[0];
        var job = { id: makeJobId(), customer: f.customer, phone: f.phone, service: f.serviceId, serviceName: svc.name,
            origin: isMileageSvc ? f.pickupCity : f.origin, destination: isMileageSvc ? f.dropoffCity : f.destination,
            zone: f.zone, speed: f.speed,
            basePrice: q.base, finalPrice: q.total, status: "Confirmed", payment: f.payment,
            discreet: f.discreet, isBusiness: false, date: new Date().toISOString().split("T")[0],
            notes: f.notes, helperHours: Number(f.helperHours) || 0, fuel: Number(f.fuel) || 30,
            weightTier: f.weightTier, miles: isMileageSvc ? miles : null, priceTier: f.priceTier };
        props.onAdd(job);
        props.onClose();
    }
    return React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
            props.onClose(); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000CC", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center" } },
        React.createElement("div", { style: { background: C.card, borderRadius: "14px 14px 0 0", padding: "22px 18px 32px", width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 } },
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white } }, "\u2795 Add New Job"),
                React.createElement("button", { onClick: props.onClose, style: { background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer" } }, "\u2715")),
            React.createElement(TxtIn, { label: "Customer Name", value: f.customer, onChange: function (v) { set("customer", v); }, placeholder: "Full name" }),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                React.createElement(TxtIn, { label: "Phone", value: f.phone, onChange: function (v) { set("phone", v); }, type: "tel", placeholder: "404-000-0000" }),
                React.createElement(Sel, { label: "Payment", value: f.payment, onChange: function (v) { set("payment", v); }, options: PAYMENTS })),
            React.createElement(Sel, { label: "Service Type", value: f.serviceId, onChange: function (v) { set("serviceId", v); }, options: SERVICES }),
            isMileageSvc ? React.createElement("div", null,
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "Pickup Address", value: f.origin, onChange: function (v) { set("origin", v); }, placeholder: "City, GA" }),
                    React.createElement(TxtIn, { label: "Drop-Off Address", value: f.destination, onChange: function (v) { set("destination", v); }, placeholder: "City, GA" })),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(Sel, { label: "Nearest City \u2014 Pickup", value: f.pickupCity, onChange: function (v) { set("pickupCity", v); }, options: gaCities }),
                    React.createElement(Sel, { label: "Nearest City \u2014 Drop-Off", value: f.dropoffCity, onChange: function (v) { set("dropoffCity", v); }, options: gaCities })),
                f.pickupCity && f.dropoffCity && React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "33", borderRadius: 9, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: C.dim } }, miles + " miles × $" + INSTATE_RATE_PER_MILE + "/mi = $" + Math.round(miles * INSTATE_RATE_PER_MILE))) : React.createElement("div", null,
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "Pickup", value: f.origin, onChange: function (v) { set("origin", v); }, placeholder: "City, GA" }),
                    React.createElement(TxtIn, { label: "Drop-Off", value: f.destination, onChange: function (v) { set("destination", v); }, placeholder: "City, GA" })),
                React.createElement(Lbl, null, "Zone"),
                React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 14 } }, ZONES.map(function (z) {
                    return React.createElement("div", { key: z.id, onClick: function () { set("zone", z.id); }, style: { flex: 1, border: "1.5px solid " + (f.zone === z.id ? C.orange : C.border), borderRadius: 9, padding: "8px 6px", cursor: "pointer", background: f.zone === z.id ? C.orangeSoft : "transparent", textAlign: "center" } },
                        React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: f.zone === z.id ? C.orange : C.white } }, z.label),
                        React.createElement("div", { style: { fontSize: 10, color: C.dim } }, z.sub));
                }))),
            React.createElement(Lbl, null, "Pricing Tier"),
            React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 } }, PRICE_TIERS.map(function (t) {
                return React.createElement("div", { key: t.id, onClick: function () { set("priceTier", t.id); }, style: { border: "1.5px solid " + (f.priceTier === t.id ? t.color : C.border), borderRadius: 9, padding: "9px 12px", cursor: "pointer", background: f.priceTier === t.id ? t.color + "18" : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: f.priceTier === t.id ? t.color : C.white } }, t.label),
                        React.createElement("div", { style: { fontSize: 10, color: C.dim } }, t.sub)),
                    t.badge && React.createElement("span", { style: { background: t.color + "22", color: t.color, borderRadius: 5, padding: "2px 7px", fontSize: 9, fontWeight: 700 } }, t.badge));
            })),
            React.createElement(Lbl, null, "Speed"),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 14 } }, SPEEDS.map(function (sp) {
                return React.createElement("div", { key: sp.id, onClick: function () { set("speed", sp.id); }, style: { border: "1.5px solid " + (f.speed === sp.id ? sp.color : C.border), borderRadius: 9, padding: "8px 4px", cursor: "pointer", background: f.speed === sp.id ? sp.color + "15" : "transparent", textAlign: "center" } },
                    React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: f.speed === sp.id ? sp.color : C.white } }, sp.icon + " " + sp.label));
            })),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                React.createElement(TxtIn, { label: "Helper Hours", value: f.helperHours, onChange: function (v) { set("helperHours", v); }, type: "number", placeholder: "0" }),
                React.createElement(TxtIn, { label: "Fuel Cost ($)", value: f.fuel, onChange: function (v) { set("fuel", v); }, type: "number", placeholder: "30" })),
            React.createElement(Toggle, { label: "Helper needed (+$" + HELPER_FEE + ")", value: f.helper, onChange: function (v) { set("helper", v); } }),
            React.createElement(WeightPicker, { value: f.weightTier, onChange: function (v) { set("weightTier", v); } }),
            React.createElement(Toggle, { label: "Discreet Handling (+35%)", value: f.discreet, onChange: function (v) { set("discreet", v); } }),
            React.createElement(TxtIn, { label: "Notes", value: f.notes, onChange: function (v) { set("notes", v); }, placeholder: "Special instructions...", rows: 2 }),
            q.tierDisc > 0 && React.createElement("div", { style: { background: "#4299E122", border: "1px solid #4299E133", borderRadius: 8, padding: "8px 12px", marginBottom: 6, fontSize: 12, color: "#4299E1", fontWeight: 600 } }, (q.tier && q.tier.label) + " — saves $" + q.tierDisc + " off standard price"),
            payObj.discount && React.createElement("div", { style: { background: C.green + "12", border: "1px solid " + C.green + "33", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: C.green, fontWeight: 600 } }, "💵 Cash price: $" + q.total + " (saves $" + q.cashDisc + " vs $" + q.subtotal + ") — due at pickup"),
            React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "33", borderRadius: 9, padding: "12px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" } },
                React.createElement("span", { style: { color: C.dim, fontSize: 13 } }, "Quoted Price"),
                React.createElement("span", { style: { color: C.orange, fontSize: 24, fontWeight: 900 } }, "$" + q.total)),
            React.createElement("div", { style: { display: "flex", gap: 8 } },
                React.createElement(Btn, { variant: "ghost", onClick: props.onClose, style: { flex: 1 } }, "Cancel"),
                React.createElement(Btn, { onClick: submit, disabled: !f.customer || (isMileageSvc ? (!f.pickupCity || !f.dropoffCity) : (!f.origin || !f.destination)), style: { flex: 2 } }, "Save Job \u2713"))));
}
function JobsDashboard(props) {
    var jobs = props.jobs;
    var onUpdateStatus = props.onUpdateStatus;
    var onAddJob = props.onAddJob;
    var gas = props.gasPPG || FALLBACK_GAS;
    var [filter, setFilter] = useState("All");
    var [sel, setSel] = useState(null);
    var [showNew, setShowNew] = useState(false);
    var [search, setSearch] = useState("");
    var rev = jobs.reduce(function (s, j) { return s + j.finalPrice; }, 0);
    var fuelCost = jobs.reduce(function (s, j) { return s + calcFuel(j.zone, gas).cost; }, 0);
    var profit = rev - fuelCost;
    var FILTERS = ["All"].concat(STATUS_FLOW).concat(["🏢 Business"]);
    var list = jobs.filter(function (j) {
        var mf = filter === "All" ? true : filter === "🏢 Business" ? j.isBusiness : j.status === filter;
        var mq = !search || j.customer.toLowerCase().indexOf(search.toLowerCase()) > -1 || j.id.toLowerCase().indexOf(search.toLowerCase()) > -1;
        return mf && mq;
    });
    var fL = calcFuel("local", gas);
    var fR = calcFuel("regional", gas);
    var fLd = calcFuel("longdist", gas);
    return React.createElement("div", { style: { maxWidth: 700, margin: "0 auto" } },
        showNew && React.createElement(NewJobModal, { onAdd: function (j) { onAddJob(j); setShowNew(false); }, onClose: function () { setShowNew(false); } }),
        React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 } },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                React.createElement("span", { style: { fontSize: 16 } }, "\u26FD"),
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" } }, "Live Gas \u00B7 Georgia Regular"),
                    React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.orange } },
                        "$" + gas.toFixed(2),
                        React.createElement("span", { style: { fontSize: 11, color: C.dim, fontWeight: 400 } }, "/gal")))),
            React.createElement("div", { style: { display: "flex", gap: 12 } }, [["Local", "$" + fL.cost], ["Regional", "$" + fR.cost], ["Long Dist", "$" + fLd.cost]].map(function (row) {
                return React.createElement("div", { key: row[0], style: { textAlign: "center" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim } }, row[0]),
                    React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: C.white } }, row[1]));
            })),
            React.createElement("div", { style: { fontSize: 10, color: C.faint } }, "16ft box truck · " + TRUCK_MPG + " MPG · RT")),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 18 } }, [{ l: "Revenue", v: "$" + rev.toLocaleString(), c: C.orange }, { l: "Net Profit", v: "$" + profit.toLocaleString(), c: profit >= 0 ? C.green : C.red },
            { l: "Active", v: jobs.filter(function (j) { return j.status !== "Completed"; }).length, c: C.yellow },
            { l: "Completed", v: jobs.filter(function (j) { return j.status === "Completed"; }).length, c: C.dim }
        ].map(function (k) {
            return React.createElement(Card, { key: k.l, style: { padding: "14px 16px" } },
                React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 } }, k.l),
                React.createElement("div", { style: { fontSize: 26, fontWeight: 900, color: k.c } }, k.v));
        })),
        React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 10, alignItems: "center" } },
            React.createElement("input", { value: search, onChange: function (e) { setSearch(e.target.value); }, placeholder: "Search by name or Job ID...", style: { flex: 1, background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.white, padding: "8px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" } }),
            React.createElement(Btn, { onClick: function () { setShowNew(true); }, style: { flexShrink: 0, padding: "8px 14px", fontSize: 12 } }, "\u2795 New Job")),
        React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 14, overflowX: "auto", paddingBottom: 2 } }, FILTERS.map(function (f2) {
            return React.createElement("button", { key: f2, onClick: function () { setFilter(f2); }, style: { flexShrink: 0, border: "1px solid " + (filter === f2 ? C.orange : C.border), borderRadius: 7, padding: "5px 11px", cursor: "pointer", background: filter === f2 ? C.orangeSoft : C.card, color: filter === f2 ? C.orange : C.dim, fontSize: 11, fontWeight: 600, fontFamily: "inherit" } }, f2);
        })),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
            list.length === 0 && React.createElement("div", { style: { color: C.dim, fontSize: 13, textAlign: "center", padding: "32px 0" } }, "No jobs found."),
            list.map(function (j) {
                var jFuel = calcFuel(j.zone, gas).cost;
                var jProfit = j.finalPrice - jFuel;
                var pol = getCancelPolicy(j.date, j.speed);
                var payLbl = (PAYMENTS.find(function (p) { return p.id === j.payment; }) || { label: j.payment }).label;
                var spdLbl = (SPEEDS.find(function (s) { return s.id === j.speed; }) || { label: j.speed }).label;
                return React.createElement(Card, { key: j.id, style: { padding: "13px 16px", cursor: "pointer", border: sel === j.id ? "1.5px solid " + C.orange : "1px solid " + C.border } },
                    React.createElement("div", { onClick: function () { setSel(sel === j.id ? null : j.id); }, style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, j.id + " — " + j.customer),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2 } }, j.serviceName + " · " + j.origin + " → " + j.destination)),
                        React.createElement("div", { style: { textAlign: "right", flexShrink: 0, marginLeft: 12 } },
                            React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: C.orange } }, "$" + j.finalPrice),
                            React.createElement(Tag, { color: STATUS_COLOR[j.status] || C.dim }, j.status))),
                    sel === j.id && React.createElement("div", { style: { marginTop: 14, borderTop: "1px solid " + C.border, paddingTop: 14 } },
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } },
                            React.createElement("span", { style: { color: C.dim, fontSize: 12 } }, j.phone),
                            React.createElement(CallBtns, { phone: j.phone })),
                        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 } }, [["Payment", payLbl], ["Speed", spdLbl], ["Date", j.date], ["Fuel (est)", "$" + jFuel], ["Net Profit", "$" + jProfit], ["Pricing", (PRICE_TIERS.find(function (t) { return t.id === j.priceTier; }) || PRICE_TIERS[0]).label], ["Business", j.isBusiness ? "Yes" : "No"]].map(function (row) {
                            return React.createElement("div", { key: row[0] },
                                React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1 } }, row[0]),
                                React.createElement("div", { style: { fontSize: 12, color: C.white, fontWeight: 600 } }, row[1]));
                        })),
                        j.notes && React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 10 } }, "📝 " + j.notes),
                        React.createElement("div", { style: { background: pol.color + "12", border: "1px solid " + pol.color + "33", borderRadius: 7, padding: "5px 10px", marginBottom: 10, fontSize: 11, color: pol.color } },
                            React.createElement("strong", null, pol.label + ": "),
                            pol.rule),
                        React.createElement("div", { style: { color: C.dim, fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 7 } }, "Update Status"),
                        React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 5 } }, STATUS_FLOW.map(function (s) {
                            var sc = STATUS_COLOR[s] || C.dim;
                            return React.createElement("button", { key: s, onClick: function () { onUpdateStatus(j.id, s); }, style: { border: "1px solid " + (j.status === s ? sc : C.border), borderRadius: 6, padding: "4px 9px", cursor: "pointer", background: j.status === s ? sc + "22" : C.surface, color: j.status === s ? sc : C.dim, fontSize: 11, fontWeight: 600, fontFamily: "inherit" } }, s);
                        }))));
            })));
}
function OOSBookingView(props) {
    var onBook = props.onBook;
    var gasPPG = props.gasPPG || FALLBACK_GAS;
    var sf = useState({
        name: "", phone: "", originCity: "Conyers, GA", destCity: "",
        speed: "standard", service: "delivery", notes: "", payment: "cash",
        discreet: false, helper: false, weightTier: "light",
    });
    var form = sf[0];
    var setForm = sf[1];
    function set(k, v) { setForm(function (f) { var n = Object.assign({}, f); n[k] = v; return n; }); }
    var sq = useState(null);
    var quote = sq[0];
    var setQuote = sq[1];
    var sj = useState(null);
    var jobId = sj[0];
    var setJobId = sj[1];
    var se = useState("");
    var err = se[0];
    var setErr = se[1];
    var ss = useState(1);
    var step = ss[0];
    var setStep = ss[1];
    var scf = useState(false);
    var showCardForm = scf[0];
    var setShowCardForm = scf[1];
    var originKeys = Object.keys(CITY_COORDS).filter(function (c) { return c.indexOf(", GA") > -1; });
    var destKeys = Object.keys(CITY_COORDS).filter(function (c) { return c.indexOf(", GA") === -1; });
    var pay = PAYMENTS.find(function (p) { return p.id === form.payment; }) || PAYMENTS[0];
    function buildQuote() {
        var q = calcOOSQuote(form.originCity, form.destCity, form.speed, form.helper, form.weightTier);
        return q;
    }
    function goQuote() {
        setErr("");
        if (!form.destCity) {
            setErr("Please select a destination city.");
            return;
        }
        var q = buildQuote();
        if (!q) {
            setErr("We don't have coordinates for that city yet. Please call us for a custom quote: " + PHONE_DISPLAY);
            return;
        }
        setQuote(q);
        setStep(3);
    }
    function doBook(paymentIntentId) {
        var q = buildQuote();
        if (!q)
            return;
        var id = makeJobId();
        var destState = getStateFromCity(form.destCity) || "OOS";
        var payObj = PAYMENTS.find(function (p) { return p.id === form.payment; }) || PAYMENTS[0];
        var cashDisc = payObj.discount ? Math.round(q.total * 0.10) : 0;
        var finalTotal = q.total - cashDisc;
        var job = {
            id: id, customer: form.name, phone: form.phone,
            service: "oos_" + form.service, serviceName: "Out-of-State — " +
                (SERVICES.find(function (s) { return s.id === form.service; }) || SERVICES[0]).name,
            origin: form.originCity, destination: form.destCity,
            zone: "longdist", speed: form.speed,
            basePrice: q.total, finalPrice: finalTotal,
            status: "Confirmed", payment: form.payment,
            discreet: form.discreet, isBusiness: false,
            date: new Date().toISOString().split("T")[0],
            notes: "OUT-OF-STATE · " + q.miles + " mi · $" + q.rate + "/mi" + (form.notes ? " — " + form.notes : "") + (paymentIntentId ? " · Stripe: " + paymentIntentId : ""),
            helperHours: 0, fuel: q.fuelCost, weightTier: form.weightTier,
            oosJob: true, miles: q.miles, ratePerMile: q.rate, destState: destState,
            paymentIntentId: paymentIntentId || null, paidOnline: !!paymentIntentId,
        };
        onBook(job);
        sendEmail(job);
        setJobId(id);
        setStep(4);
    }
    function handleConfirmClick() {
        if (form.payment === "card") {
            setShowCardForm(true);
        }
        else {
            doBook();
        }
    }
    function reset() {
        setStep(1);
        setShowCardForm(false);
        setForm({ name: "", phone: "", originCity: "Conyers, GA", destCity: "", speed: "standard",
            service: "delivery", notes: "", payment: "cash", discreet: false, helper: false, weightTier: "light" });
        setQuote(null);
        setJobId(null);
        setErr("");
    }
    var STEPS = ["Service", "Route", "Quote", "Done"];
    if (step === 1)
        return React.createElement("div", { style: { maxWidth: 540, margin: "0 auto" } },
            React.createElement(StepBar, { steps: STEPS, current: 1 }),
            React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: C.white, marginBottom: 4 } }, "Out-of-State Job"),
            React.createElement("div", { style: { color: C.dim, fontSize: 13, marginBottom: 20 } }, "One-way cargo transport anywhere in the continental US. Priced per mile \u2014 no deposit required."),
            React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "33", borderRadius: 10, padding: "14px 16px", marginBottom: 18 } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                    React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.orange } }, "\uD83D\uDCCD One-Way Pricing"),
                    React.createElement("div", { style: { fontSize: 11, color: C.dim } }, "Pickup + drop-off = 2 separate jobs")),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } }, [["Standard Rate", "$6.50 / mile"], ["Same-Day Rate", "$8.50 / mile"], ["No Minimum", "Price = miles × rate"], ["Deposit Required", "None"]].map(function (row) {
                    return React.createElement("div", { key: row[0] },
                        React.createElement("div", { style: { fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: 1 } }, row[0]),
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white } }, row[1]));
                }))),
            React.createElement(Lbl, null, "Service Type"),
            React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 } }, SERVICES.map(function (s) {
                return React.createElement("div", { key: s.id, onClick: function () { set("service", s.id); }, style: { border: "1.5px solid " + (form.service === s.id ? C.orange : C.border), borderRadius: 10, padding: "12px 14px", cursor: "pointer", background: form.service === s.id ? C.orangeSoft : "transparent", display: "flex", alignItems: "center", gap: 10 } },
                    React.createElement("span", { style: { fontSize: 18 } }, s.icon),
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: form.service === s.id ? C.orange : C.white } }, s.name),
                        React.createElement("div", { style: { fontSize: 11, color: C.dim } }, s.tagline)),
                    form.service === s.id && React.createElement("div", { style: { marginLeft: "auto", color: C.orange, fontWeight: 800 } }, "\u2713"));
            })),
            React.createElement(Btn, { onClick: function () { setStep(2); }, style: { width: "100%" } }, "Continue \u2192"));
    if (step === 2)
        return React.createElement("div", { style: { maxWidth: 540, margin: "0 auto" } },
            React.createElement(StepBar, { steps: STEPS, current: 2 }),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 16 } }, "Route & Contact"),
                React.createElement(TxtIn, { label: "Your Full Name", value: form.name, onChange: function (v) { set("name", v); }, placeholder: "e.g. Jordan Smith" }),
                React.createElement(TxtIn, { label: "Phone Number", value: form.phone, onChange: function (v) { set("phone", v); }, type: "tel", placeholder: "404-000-0000" }),
                React.createElement(Lbl, null, "Pickup City (Georgia)"),
                React.createElement("div", { style: { marginBottom: 14 } },
                    React.createElement("select", { value: form.originCity, onChange: function (e) { set("originCity", e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", cursor: "pointer" } }, originKeys.map(function (c) { return React.createElement("option", { key: c, value: c }, c); }))),
                React.createElement(Lbl, null, "Destination City"),
                React.createElement("div", { style: { marginBottom: 14 } },
                    React.createElement("select", { value: form.destCity, onChange: function (e) { set("destCity", e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", cursor: "pointer" } },
                        React.createElement("option", { value: "" }, "\u2014 Select destination \u2014"),
                        destKeys.sort().map(function (c) { return React.createElement("option", { key: c, value: c }, c); }))),
                React.createElement(Lbl, null, "Dispatch Speed"),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 14 } }, SPEEDS.filter(function (sp) { return sp.id !== "overnight"; }).map(function (sp) {
                    return React.createElement("div", { key: sp.id, onClick: function () { set("speed", sp.id); }, style: { border: "1.5px solid " + (form.speed === sp.id ? sp.color : C.border), borderRadius: 9, padding: "10px 12px", cursor: "pointer", background: form.speed === sp.id ? sp.color + "15" : "transparent" } },
                        React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: form.speed === sp.id ? sp.color : C.white } }, sp.icon + " " + sp.label),
                        React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2 } }, sp.sub),
                        React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: form.speed === sp.id ? sp.color : C.faint, marginTop: 2 } }, (sp.id === "urgent" || sp.id === "emergency") ? "$8.50/mi" : "$6.50/mi"));
                })),
                React.createElement(Lbl, null, "Payment Method"),
                React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 7, marginBottom: 14 } }, PAYMENTS.map(function (p) {
                    return React.createElement("div", { key: p.id, onClick: function () { set("payment", p.id); }, style: { border: "1.5px solid " + (form.payment === p.id ? (p.discount ? C.green : C.orange) : C.border), borderRadius: 9, padding: "10px 14px", cursor: "pointer", background: form.payment === p.id ? (p.discount ? C.green + "12" : C.orangeSoft) : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: form.payment === p.id ? (p.discount ? C.green : C.orange) : C.white } }, p.label),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim } }, p.sub)),
                        p.badge && React.createElement("span", { style: { background: p.discount ? C.green + "22" : C.orange + "22", color: p.discount ? C.green : C.orange, borderRadius: 5, padding: "2px 7px", fontSize: 9, fontWeight: 700 } }, p.badge));
                })),
                React.createElement(Toggle, { label: "Helper needed (+$100)", value: form.helper, onChange: function (v) { set("helper", v); } }),
                React.createElement(WeightPicker, { value: form.weightTier, onChange: function (v) { set("weightTier", v); } }),
                React.createElement(Toggle, { label: "\uD83D\uDD12 Discreet / High-Value handling (+35%)", value: form.discreet, onChange: function (v) { set("discreet", v); } }),
                React.createElement(TxtIn, { label: "Notes (optional)", value: form.notes, onChange: function (v) { set("notes", v); }, placeholder: "Load description, access notes, special instructions...", rows: 2 }),
                err && React.createElement("div", { style: { color: C.red, fontSize: 12, marginBottom: 10 } },
                    "\u26A0 ",
                    err),
                React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setStep(1); }, style: { flex: 1 } }, "\u2190 Back"),
                    React.createElement(Btn, { onClick: goQuote, disabled: !form.name || !form.phone || !form.destCity, style: { flex: 2 } }, "Get My Quote \u2192"))));
    if (step === 3 && quote)
        return React.createElement("div", { style: { maxWidth: 480, margin: "0 auto" } },
            React.createElement(StepBar, { steps: STEPS, current: 3 }),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 16 } }, "Your Out-of-State Quote"),
                React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "33", borderRadius: 12, padding: "22px", marginBottom: 20, textAlign: "center" } },
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 } }, quote.isSameDay ? "Same-Day Rate · $8.50/mi" : "Standard Rate · $6.50/mi"),
                    React.createElement("div", { style: { fontSize: 56, fontWeight: 900, color: C.orange, lineHeight: 1 } }, "$" + (pay.discount ? (quote.total - Math.round(quote.total * 0.10)) : quote.total).toLocaleString()),
                    pay.discount && React.createElement("div", { style: { marginTop: 8 } },
                        React.createElement("span", { style: { color: C.dim, fontSize: 13, textDecoration: "line-through", marginRight: 8 } }, "$" + quote.total.toLocaleString()),
                        React.createElement("span", { style: { color: C.green, fontSize: 13, fontWeight: 700 } }, "You save $" + Math.round(quote.total * 0.10).toLocaleString() + " (10% cash)"))),
                React.createElement("div", { style: { marginBottom: 16 } },
                    [
                        ["Route", form.originCity + " → " + form.destCity],
                        ["Est. Miles", quote.miles + " miles (one-way)"],
                        ["Rate per Mile", "$" + quote.rate.toFixed(2)],
                        ["Mileage Charge", "$" + quote.mileageCharge.toLocaleString()],
                        quote.helperFee > 0 && ["Helper", "+$" + quote.helperFee],
                        quote.weightFee > 0 && [quote.weightTier.label, "+$" + quote.weightFee],
                        ["Service", (SERVICES.find(function (s) { return s.id === form.service; }) || { name: "Cargo" }).name],
                        ["Payment", pay.label],
                    ].filter(Boolean).map(function (row) {
                        return React.createElement("div", { key: row[0], style: { display: "flex", justifyContent: "space-between", fontSize: 13, padding: "8px 0", borderBottom: "1px solid " + C.border } },
                            React.createElement("span", { style: { color: C.dim } }, row[0]),
                            React.createElement("span", { style: { color: C.white, fontWeight: 600 } }, row[1]));
                    }),
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", background: C.orangeSoft, borderRadius: 9, paddingLeft: 12, paddingRight: 12, marginTop: 4 } },
                        React.createElement("span", { style: { fontWeight: 800, color: C.white, fontSize: 14 } }, "Total (One-Way)"),
                        React.createElement("span", { style: { fontSize: 22, fontWeight: 900, color: C.orange } },
                            "$",
                            quote.total.toLocaleString()))),
                React.createElement("div", { style: { background: C.surface, borderRadius: 9, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: C.dim, lineHeight: 1.8 } },
                    React.createElement("div", { style: { color: C.white, fontWeight: 700, marginBottom: 4 } },
                        "\u26FD Fuel Transparency \u00B7 ",
                        form.destCity.split(",").pop().trim(),
                        " Gas Price"),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 } },
                        React.createElement("div", null,
                            React.createElement("span", { style: { color: C.faint } }, "Gas price"),
                            React.createElement("br", null),
                            React.createElement("strong", { style: { color: C.white } },
                                "$",
                                quote.ppg.toFixed(2),
                                "/gal")),
                        React.createElement("div", null,
                            React.createElement("span", { style: { color: C.faint } }, "Gallons est."),
                            React.createElement("br", null),
                            React.createElement("strong", { style: { color: C.white } },
                                quote.fuelGal,
                                " gal")),
                        React.createElement("div", null,
                            React.createElement("span", { style: { color: C.faint } }, "Fuel cost"),
                            React.createElement("br", null),
                            React.createElement("strong", { style: { color: C.orange } },
                                "$",
                                quote.fuelCost))),
                    React.createElement("div", { style: { fontSize: 10, color: C.faint, marginTop: 6 } },
                        "16ft box truck \u00B7 ",
                        TRUCK_MPG,
                        " MPG \u00B7 One-way miles \u00B7 ",
                        form.destCity.split(",").pop().trim(),
                        " state rate")),
                pay.discount && React.createElement("div", { style: { background: C.green + "12", border: "1px solid " + C.green + "33", borderRadius: 9, padding: "10px 14px", marginBottom: 10, fontSize: 12 } },
                    React.createElement("div", { style: { color: C.green, fontWeight: 700, marginBottom: 2 } }, "\uD83D\uDCB5 Cash Discount Applied \u2014 10% Off"),
                    React.createElement("div", { style: { color: C.dim } }, "Cash price: $" + (quote.total - Math.round(quote.total * 0.10)).toLocaleString() + " (saves $" + Math.round(quote.total * 0.10).toLocaleString() + " vs $" + quote.total.toLocaleString() + ")")),
                React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 12 } },
                    React.createElement("div", { style: { color: C.white, fontWeight: 700, marginBottom: 2 } }, "\uD83D\uDCB3 Payment Due in Full at Pickup"),
                    React.createElement("div", { style: { color: C.dim } }, "Cash, Card, Cash App, Wire, or Bitcoin accepted. No deposit required in advance.")),
                React.createElement("div", { style: { background: C.surface, borderRadius: 9, padding: "10px 14px", marginBottom: 18, fontSize: 12, color: C.dim, lineHeight: 1.7 } },
                    "\u26A0 ",
                    React.createElement("strong", { style: { color: C.yellow } }, "One-Way Job:"),
                    " This covers pickup to destination only. Return transport is a separate booking. Mileage is estimated \u2014 final miles confirmed at pickup."),
                !showCardForm && React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setStep(2); }, style: { flex: 1 } }, "\u2190 Back"),
                    React.createElement(Btn, { onClick: handleConfirmClick, style: { flex: 2 } }, form.payment === "card" ? "Continue to Payment 💳" : "Confirm & Book 🚐")),
                showCardForm && React.createElement(StripeCardForm, { amount: pay.discount ? (quote.total - Math.round(quote.total * 0.10)) : quote.total, jobId: "pending", customerName: form.name, onCancel: function () { setShowCardForm(false); }, onSuccess: function (paymentIntentId) { doBook(paymentIntentId); } })));
    if (step === 4)
        return React.createElement("div", { style: { maxWidth: 480, margin: "0 auto" } },
            React.createElement(Card, { style: { textAlign: "center" } },
                React.createElement("div", { style: { fontSize: 52, marginBottom: 12 } }, "\uD83D\uDDFA\uFE0F"),
                React.createElement("div", { style: { fontSize: 24, fontWeight: 900, color: C.white, marginBottom: 6 } }, "Out-of-State Job Booked!"),
                React.createElement("div", { style: { color: C.dim, fontSize: 14, marginBottom: 4 } }, "We'll reach out to confirm details, " + form.name + "."),
                React.createElement("div", { style: { fontSize: 26, fontWeight: 900, color: C.orange, marginBottom: 2 } }, "$" + (quote && pay.discount ? (quote.total - Math.round(quote.total * 0.10)) : quote && quote.total).toLocaleString()),
                React.createElement("div", { style: { color: C.dim, fontSize: 13, marginBottom: 20 } }, "via " + pay.label + " · due in full at pickup" + (pay.discount ? " (10% cash discount applied)" : "")),
                React.createElement("div", { style: { background: C.surface, borderRadius: 10, padding: "14px 16px", marginBottom: 14, textAlign: "left" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 } }, "Job ID \u2014 Save This"),
                    React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: C.orange, letterSpacing: 2 } }, jobId),
                    React.createElement("div", { style: { fontSize: 12, color: C.dim, marginTop: 4 } }, "Track your job under Track My Job")),
                React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "33", borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 12, textAlign: "left" } },
                    React.createElement("div", { style: { color: C.orange, fontWeight: 700, marginBottom: 4 } }, "\uD83D\uDCCD Route Confirmed"),
                    React.createElement("div", { style: { color: C.white, fontWeight: 600 } }, form.originCity + " → " + form.destCity),
                    React.createElement("div", { style: { color: C.dim, marginTop: 2 } }, quote && quote.miles + " miles · $" + quote && quote.rate.toFixed(2) + "/mi")),
                React.createElement(Btn, { variant: "ghost", onClick: reset, style: { width: "100%" } }, "Book Another Job")));
    return null;
}
function PhoneQuotePanel(props) {
    var onAddJob = props.onAddJob;
    var gasPPG = props.gasPPG || FALLBACK_GAS;
    var sf = useState({
        name: "", phone: "", serviceId: "delivery", zone: "local",
        speed: "standard", payment: "cash", helper: false, weightTier: "light",
        extraStop: false, discreet: false, isBusiness: false,
        origin: "", destination: "", pickupCity: "", dropoffCity: "", notes: "",
        isOOS: false, destCity: "", originCity: "Conyers, GA", priceTier: "standard",
    });
    var form = sf[0];
    var setForm = sf[1];
    function set(k, v) { setForm(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); }
    var sc = useState(false);
    var confirmed = sc[0];
    var setConfirmed = sc[1];
    var sj = useState(null);
    var savedJob = sj[0];
    var setSavedJob = sj[1];
    var isMileageSvc = !form.isOOS && MILEAGE_SERVICES.indexOf(form.serviceId) > -1;
    var gaCities = Object.keys(CITY_COORDS).filter(function (c) { return c.indexOf(", GA") > -1; });
    var destKeys = Object.keys(CITY_COORDS).filter(function (c) { return c.indexOf(", GA") === -1; });
    var instMiles = isMileageSvc ? (estimateMiles(form.pickupCity, form.dropoffCity) || 0) : 0;
    var q = form.isOOS
        ? (form.destCity ? calcOOSQuote(form.originCity, form.destCity, form.speed, form.helper, form.weightTier, form.priceTier) : null)
        : calcQuote(form.serviceId, form.zone, form.speed, form.payment, form.helper, form.discreet, form.weightTier, form.extraStop, instMiles, form.priceTier);
    var payObj = PAYMENTS.find(function (p) { return p.id === form.payment; }) || PAYMENTS[0];
    var oosPayDisc = (form.isOOS && q && payObj.discount) ? Math.round(q.total * 0.10) : 0;
    var displayTotal = form.isOOS
        ? (q ? (q.total - oosPayDisc) : 0)
        : (q ? q.total : 0);
    function bookIt() {
        if (!form.name || !displayTotal)
            return;
        var id = makeJobId();
        var job;
        if (form.isOOS && q) {
            var svc = SERVICES.find(function (s) { return s.id === form.serviceId; }) || SERVICES[0];
            job = {
                id: id, customer: form.name, phone: form.phone,
                service: "oos_" + form.serviceId, serviceName: "Out-of-State — " + svc.name,
                origin: form.originCity, destination: form.destCity,
                zone: "longdist", speed: form.speed,
                basePrice: q.total, finalPrice: displayTotal,
                status: "Confirmed", payment: form.payment,
                discreet: form.discreet, isBusiness: form.isBusiness,
                date: new Date().toISOString().split("T")[0],
                notes: "OUT-OF-STATE · " + q.miles + " mi · $" + q.rate + "/mi" + (form.notes ? " — " + form.notes : ""),
                helperHours: 0, fuel: q.fuelCost, weightTier: form.weightTier, oosJob: true,
                miles: q.miles, ratePerMile: q.rate, priceTier: form.priceTier,
            };
        }
        else if (q) {
            var svc2 = SERVICES.find(function (s) { return s.id === form.serviceId; }) || SERVICES[0];
            job = {
                id: id, customer: form.name, phone: form.phone,
                service: form.serviceId, serviceName: svc2.name,
                origin: isMileageSvc ? form.pickupCity : form.origin,
                destination: isMileageSvc ? form.dropoffCity : form.destination,
                zone: form.zone, speed: form.speed,
                basePrice: q.base, finalPrice: q.total,
                status: "Confirmed", payment: form.payment,
                discreet: form.discreet, isBusiness: form.isBusiness,
                date: new Date().toISOString().split("T")[0],
                notes: isMileageSvc ? (instMiles + " mi · $" + INSTATE_RATE_PER_MILE + "/mi" + (form.notes ? " — " + form.notes : "")) : form.notes,
                helperHours: 0, fuel: calcFuel(form.zone, gasPPG).cost,
                weightTier: form.weightTier, miles: isMileageSvc ? instMiles : null,
                priceTier: form.priceTier,
            };
        }
        if (job) {
            onAddJob(job);
            sendEmail(job);
            setSavedJob(job);
            setConfirmed(true);
        }
    }
    function reset() {
        setForm({ name: "", phone: "", serviceId: "delivery", zone: "local", speed: "standard",
            payment: "cash", helper: false, weightTier: "light", extraStop: false, discreet: false,
            isBusiness: false, origin: "", destination: "", pickupCity: "", dropoffCity: "", notes: "",
            isOOS: false, destCity: "", originCity: "Conyers, GA", priceTier: "standard" });
        setConfirmed(false);
        setSavedJob(null);
    }
    if (confirmed && savedJob)
        return React.createElement("div", { style: { maxWidth: 500, margin: "0 auto" } },
            React.createElement("div", { style: { background: "#1DB95422", border: "1px solid #1DB95466", borderRadius: 14, padding: "28px 24px", textAlign: "center", marginBottom: 16 } },
                React.createElement("div", { style: { fontSize: 40, marginBottom: 10 } }, "\u2705"),
                React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: C.white, marginBottom: 4 } }, "Job Booked!"),
                React.createElement("div", { style: { fontSize: 13, color: C.dim, marginBottom: 16 } }, "Tell " + savedJob.customer + " their Job ID:"),
                React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C.orange, letterSpacing: 3, marginBottom: 4 } }, savedJob.id),
                React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 20 } }, "They can track at potentlogistics.com \u2192 Track My Job"),
                React.createElement("div", { style: { background: C.surface, borderRadius: 10, padding: "12px 16px", textAlign: "left", marginBottom: 16 } }, [
                    ["Customer", savedJob.customer],
                    ["Phone", savedJob.phone],
                    ["Service", savedJob.serviceName],
                    ["Route", savedJob.origin + " → " + savedJob.destination],
                    ["Total", "$" + savedJob.finalPrice.toLocaleString()],
                    ["Payment", (PAYMENTS.find(function (p) { return p.id === savedJob.payment; }) || { label: savedJob.payment }).label],
                ].map(function (row) {
                    return React.createElement("div", { key: row[0], style: { display: "flex", justifyContent: "space-between", fontSize: 12, padding: "5px 0", borderBottom: "1px solid " + C.border } },
                        React.createElement("span", { style: { color: C.dim } }, row[0]),
                        React.createElement("span", { style: { color: C.white, fontWeight: 600 } }, row[1]));
                })),
                React.createElement(Btn, { onClick: reset, style: { width: "100%" } }, "\uD83D\uDCDE New Quote")));
    return React.createElement("div", { style: { maxWidth: 700, margin: "0 auto" } },
        React.createElement("div", { style: { display: "flex", gap: 12, alignItems: "flex-start", flexWrap: "wrap" } },
            React.createElement("div", { style: { flex: "1 1 340px", minWidth: 0 } },
                React.createElement("div", { style: { background: C.card, border: "2px solid " + C.orange + "44", borderRadius: 12, padding: "14px 16px", marginBottom: 10 } },
                    React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 } }, "\uD83D\uDCB0 Pricing Tier \u2014 Set First"),
                    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, PRICE_TIERS.map(function (t) {
                        return React.createElement("div", { key: t.id, onClick: function () { set("priceTier", t.id); }, style: { border: "1.5px solid " + (form.priceTier === t.id ? t.color : C.border), borderRadius: 9, padding: "10px 14px", cursor: "pointer", background: form.priceTier === t.id ? t.color + "18" : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                            React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: form.priceTier === t.id ? t.color : C.white } }, t.label),
                                React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2 } }, t.sub)),
                            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                                t.badge && React.createElement("span", { style: { background: t.color + "22", color: t.color, borderRadius: 5, padding: "2px 8px", fontSize: 9, fontWeight: 700 } }, t.badge),
                                form.priceTier === t.id && React.createElement("div", { style: { width: 18, height: 18, borderRadius: "50%", background: t.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", fontWeight: 800 } }, "\u2713")));
                    }))),
                React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 18, background: C.surface, borderRadius: 10, padding: 4 } },
                    React.createElement("button", { onClick: function () { set("isOOS", false); }, style: { flex: 1, border: "none", borderRadius: 8, padding: "8px", cursor: "pointer", background: !form.isOOS ? C.orange : "transparent", color: !form.isOOS ? "#000" : C.dim, fontWeight: 700, fontFamily: "inherit", fontSize: 12 } }, "\uD83D\uDCE6 In-State / Local"),
                    React.createElement("button", { onClick: function () { set("isOOS", true); }, style: { flex: 1, border: "none", borderRadius: 8, padding: "8px", cursor: "pointer", background: form.isOOS ? C.orange : "transparent", color: form.isOOS ? "#000" : C.dim, fontWeight: 700, fontFamily: "inherit", fontSize: 12 } }, "\uD83D\uDDFA\uFE0F Out-of-State")),
                React.createElement("div", { style: { background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 16px", marginBottom: 10 } },
                    React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 } }, "\uD83D\uDC64 Customer"),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" } },
                        React.createElement(TxtIn, { label: "Name", value: form.name, onChange: function (v) { set("name", v); }, placeholder: "First Last" }),
                        React.createElement(TxtIn, { label: "Phone", value: form.phone, onChange: function (v) { set("phone", v); }, type: "tel", placeholder: "404-000-0000" })),
                    React.createElement("div", { style: { display: "flex", gap: 8 } },
                        React.createElement(Toggle, { label: "Business account", value: form.isBusiness, onChange: function (v) { set("isBusiness", v); } }))),
                React.createElement("div", { style: { background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 16px", marginBottom: 10 } },
                    React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 } }, "\uD83D\uDCE6 Service Type"),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } }, SERVICES.map(function (s) {
                        return React.createElement("button", { key: s.id, onClick: function () { set("serviceId", s.id); }, style: { border: "1.5px solid " + (form.serviceId === s.id ? C.orange : C.border), borderRadius: 9, padding: "10px 8px", cursor: "pointer", background: form.serviceId === s.id ? C.orangeSoft : "transparent", fontFamily: "inherit", textAlign: "left" } },
                            React.createElement("div", { style: { fontSize: 13 } }, s.icon),
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: form.serviceId === s.id ? C.orange : C.white, marginTop: 3 } }, s.name));
                    }))),
                React.createElement("div", { style: { background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 16px", marginBottom: 10 } },
                    React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 } }, "\uD83D\uDCCD Route"),
                    form.isOOS ? React.createElement("div", null,
                        React.createElement(Lbl, null, "Pickup (Georgia)"),
                        React.createElement("div", { style: { marginBottom: 12 } },
                            React.createElement("select", { value: form.originCity, onChange: function (e) { set("originCity", e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "10px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } }, gaCities.map(function (c) { return React.createElement("option", { key: c, value: c }, c); }))),
                        React.createElement(Lbl, null, "Destination City"),
                        React.createElement("select", { value: form.destCity, onChange: function (e) { set("destCity", e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "10px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } },
                            React.createElement("option", { value: "" }, "\u2014 Select destination \u2014"),
                            destKeys.sort().map(function (c) { return React.createElement("option", { key: c, value: c }, c); }))) : isMileageSvc ? React.createElement("div", null,
                        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" } },
                            React.createElement(TxtIn, { label: "Pickup Address", value: form.origin, onChange: function (v) { set("origin", v); }, placeholder: "Street, City, GA" }),
                            React.createElement(TxtIn, { label: "Drop-Off Address", value: form.destination, onChange: function (v) { set("destination", v); }, placeholder: "Street, City, GA" })),
                        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" } },
                            React.createElement(Sel, { label: "Nearest City \u2014 Pickup", value: form.pickupCity, onChange: function (v) { set("pickupCity", v); }, options: gaCities }),
                            React.createElement(Sel, { label: "Nearest City \u2014 Drop-Off", value: form.dropoffCity, onChange: function (v) { set("dropoffCity", v); }, options: gaCities })),
                        form.pickupCity && form.dropoffCity && React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "33", borderRadius: 9, padding: "8px 12px", marginTop: 4, fontSize: 12, color: C.dim } }, instMiles + " miles × $" + INSTATE_RATE_PER_MILE + "/mi = $" + Math.round(instMiles * INSTATE_RATE_PER_MILE))) : React.createElement("div", null,
                        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" } },
                            React.createElement(TxtIn, { label: "Pickup", value: form.origin, onChange: function (v) { set("origin", v); }, placeholder: "City, GA" }),
                            React.createElement(TxtIn, { label: "Drop-Off", value: form.destination, onChange: function (v) { set("destination", v); }, placeholder: "City, GA" })),
                        React.createElement(Lbl, null, "Zone"),
                        React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 10 } }, ZONES.map(function (z) {
                            return React.createElement("div", { key: z.id, onClick: function () { set("zone", z.id); }, style: { flex: 1, border: "1.5px solid " + (form.zone === z.id ? C.orange : C.border), borderRadius: 8, padding: "8px 4px", cursor: "pointer", background: form.zone === z.id ? C.orangeSoft : "transparent", textAlign: "center" } },
                                React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: form.zone === z.id ? C.orange : C.white } }, z.label),
                                React.createElement("div", { style: { fontSize: 10, color: C.dim } }, z.sub));
                        })))),
                React.createElement("div", { style: { background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 16px", marginBottom: 10 } },
                    React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 } }, "\u26A1 Dispatch Speed"),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } }, (form.isOOS ? SPEEDS.filter(function (sp) { return sp.id !== "overnight"; }) : SPEEDS).map(function (sp) {
                        return React.createElement("button", { key: sp.id, onClick: function () { set("speed", sp.id); }, style: { border: "1.5px solid " + (form.speed === sp.id ? sp.color : C.border), borderRadius: 9, padding: "9px 10px", cursor: "pointer", background: form.speed === sp.id ? sp.color + "18" : "transparent", fontFamily: "inherit", textAlign: "left" } },
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: form.speed === sp.id ? sp.color : C.white } }, sp.icon + " " + sp.label),
                            React.createElement("div", { style: { fontSize: 10, color: C.dim, marginTop: 2 } }, form.isOOS ? (sp.id === "urgent" || sp.id === "emergency" ? "$8.50/mi" : "$6.50/mi") : "x" + sp.mult));
                    }))),
                React.createElement("div", { style: { background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 16px", marginBottom: 10 } },
                    React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 } }, "\u2795 Add-Ons"),
                    React.createElement(Toggle, { label: "Helper needed (+$" + HELPER_FEE + ")", value: form.helper, onChange: function (v) { set("helper", v); } }),
                    React.createElement(WeightPicker, { value: form.weightTier, onChange: function (v) { set("weightTier", v); } }),
                    !form.isOOS && React.createElement(Toggle, { label: "Extra stop (+$" + EXTRA_STOP_FEE + ")", value: form.extraStop, onChange: function (v) { set("extraStop", v); } }),
                    form.serviceId === "discreet" && React.createElement(Toggle, { label: "Discreet handling (+35%)", value: form.discreet, onChange: function (v) { set("discreet", v); } })),
                React.createElement("div", { style: { background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 16px", marginBottom: 10 } },
                    React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 } }, "\uD83D\uDCB3 Payment Method"),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } }, PAYMENTS.map(function (p) {
                        return React.createElement("button", { key: p.id, onClick: function () { set("payment", p.id); }, style: { border: "1.5px solid " + (form.payment === p.id ? (p.discount ? C.green : C.orange) : C.border), borderRadius: 9, padding: "9px 10px", cursor: "pointer", background: form.payment === p.id ? (p.discount ? C.green + "15" : C.orangeSoft) : "transparent", fontFamily: "inherit", textAlign: "left" } },
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: form.payment === p.id ? (p.discount ? C.green : C.orange) : C.white } }, p.label),
                            p.discount && React.createElement("div", { style: { fontSize: 10, color: C.green, marginTop: 2 } }, "10% off"));
                    }))),
                React.createElement(TxtIn, { label: "Notes", value: form.notes, onChange: function (v) { set("notes", v); }, placeholder: "What are they moving? Any special access, fragile items, gate codes...", rows: 2 })),
            React.createElement("div", { style: { flex: "0 0 220px", position: "sticky", top: 80 } },
                React.createElement("div", { style: { background: C.card, border: "2px solid " + (displayTotal > 0 ? C.orange : C.border), borderRadius: 14, padding: "20px 16px", textAlign: "center", marginBottom: 10 } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 } }, "Live Quote"),
                    (function () {
                        var tier = PRICE_TIERS.find(function (t) { return t.id === form.priceTier; }) || PRICE_TIERS[0];
                        return tier.id !== "standard" && React.createElement("div", { style: { background: tier.color + "22", color: tier.color, borderRadius: 6, padding: "2px 8px", fontSize: 9, fontWeight: 700, marginBottom: 8, display: "inline-block" } }, tier.badge);
                    })(),
                    React.createElement("div", { style: { fontSize: 52, fontWeight: 900, color: displayTotal > 0 ? C.orange : C.faint, lineHeight: 1, marginBottom: 4 } }, displayTotal > 0 ? "$" + displayTotal.toLocaleString() : "—"),
                    payObj.discount && displayTotal > 0 && React.createElement("div", { style: { fontSize: 11, color: C.green, fontWeight: 700, marginBottom: 4 } }, "Cash — 10% off applied"),
                    form.isOOS && q && React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 4 } }, q.miles + " mi · $" + q.rate + "/mi" + (q.rate !== q.stdRate ? " (" + form.priceTier + " rate)" : "")),
                    !form.isOOS && q && q.rawSubtotal > 0 && q.tierDisc > 0 && React.createElement("div", { style: { fontSize: 11, color: C.dim, textDecoration: "line-through", marginBottom: 2 } }, "$" + q.rawSubtotal),
                    !form.isOOS && q && q.cashDisc > 0 && React.createElement("div", { style: { fontSize: 11, color: C.dim, textDecoration: "line-through", marginBottom: 2 } }, "$" + q.subtotal),
                    !form.isOOS && q && React.createElement("div", { style: { textAlign: "left", marginTop: 12, borderTop: "1px solid " + C.border, paddingTop: 10 } }, [
                        [q.isMileage ? (instMiles + " mi × $" + INSTATE_RATE_PER_MILE + "/mi") : "Base", q.base],
                        q.speedFee > 0 && ["Speed", "+$" + q.speedFee],
                        q.helperFee > 0 && ["Helper", "+$" + q.helperFee],
                        q.weightFee > 0 && [q.weightTier && q.weightTier.label || "Weight", "+$" + q.weightFee],
                        q.extraStopFee > 0 && ["Extra Stop", "+$" + q.extraStopFee],
                        q.discreetFee > 0 && ["Discreet", "+$" + q.discreetFee],
                        q.tierDisc > 0 && [(q.tier && q.tier.label) || "Tier Disc", "-$" + q.tierDisc],
                        q.cashDisc > 0 && ["Cash 10%", "-$" + q.cashDisc],
                    ].filter(Boolean).map(function (row) {
                        return React.createElement("div", { key: row[0], style: { display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0" } },
                            React.createElement("span", { style: { color: C.dim } }, row[0]),
                            React.createElement("span", { style: { color: C.white, fontWeight: 600 } }, typeof row[1] === "number" ? "$" + row[1] : row[1]));
                    })),
                    form.isOOS && q && React.createElement("div", { style: { textAlign: "left", marginTop: 12, borderTop: "1px solid " + C.border, paddingTop: 10 } }, [
                        ["Mileage", "$" + q.subtotal],
                        oosPayDisc > 0 && ["Cash 10%", "-$" + oosPayDisc],
                        ["⛽ Fuel est.", "$" + q.fuelCost + " (" + q.destState + ")"],
                        ["Est. profit", "$" + ((displayTotal) - q.fuelCost)],
                    ].filter(Boolean).map(function (row) {
                        return React.createElement("div", { key: row[0], style: { display: "flex", justifyContent: "space-between", fontSize: 11, padding: "3px 0" } },
                            React.createElement("span", { style: { color: C.dim } }, row[0]),
                            React.createElement("span", { style: { color: C.white, fontWeight: 600 } }, row[1]));
                    }))),
                displayTotal > 0 && React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "44", borderRadius: 10, padding: "12px 14px", marginBottom: 10, fontSize: 12, textAlign: "center" } },
                    React.createElement("div", { style: { color: C.dim, marginBottom: 4 } }, "Tell the customer:"),
                    React.createElement("div", { style: { color: C.white, fontWeight: 800, fontSize: 15 } }, "Your total is $" + displayTotal.toLocaleString()),
                    isMileageSvc && instMiles > 0 && React.createElement("div", { style: { color: C.dim, fontSize: 11, marginTop: 3 } }, instMiles + " miles × $" + INSTATE_RATE_PER_MILE + "/mi"),
                    payObj.discount && React.createElement("div", { style: { color: C.green, fontSize: 11, marginTop: 2 } }, "Cash gets you 10% off")),
                React.createElement(Btn, { onClick: bookIt, disabled: !form.name || !displayTotal, style: { width: "100%", padding: "13px", fontSize: 14, marginBottom: 8 } }, "\u2705 Book It"),
                React.createElement(Btn, { variant: "ghost", onClick: reset, style: { width: "100%", padding: "10px", fontSize: 12 } }, "\uD83D\uDD04 New Quote"),
                !form.isOOS && React.createElement("div", { style: { marginTop: 10, background: C.surface, borderRadius: 9, padding: "10px 12px", fontSize: 11, color: C.dim } },
                    React.createElement("div", { style: { color: C.white, fontWeight: 700, marginBottom: 4 } }, "\u26FD GA Gas Today"),
                    React.createElement("div", null, "$" + gasPPG.toFixed(2) + "/gal · Est. fuel: $" + calcFuel(form.zone, gasPPG).cost)))));
}
function AdminDashboard(props) {
    var [tab, setTab] = useState("quote");
    return React.createElement("div", { style: { minHeight: "100vh", background: C.black, color: C.white, fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
        React.createElement("div", { style: { borderBottom: "1px solid " + C.border, padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: C.black, zIndex: 100 } },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 7 } },
                React.createElement(Logo, { size: 18 }),
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 14, fontWeight: 900 } },
                        React.createElement(BrandName, null)),
                    React.createElement("div", { style: { fontSize: 8, color: C.gold, letterSpacing: 1.5, textTransform: "uppercase" } }, "Admin \u00B7 A POTENT PR\u00C4D\u018FKT\u00AE COMPANY"))),
            React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
                React.createElement("div", { style: { display: "flex", gap: 3, background: C.surface, borderRadius: 9, padding: 3 } }, [["quote", "📞 Quote"], ["jobs", "📋 Jobs"], ["calendar", "📅 Cal"], ["driver", "🚐 Driver"]].map(function (item) {
                    return React.createElement("button", { key: item[0], onClick: function () { setTab(item[0]); }, style: { border: "none", borderRadius: 7, padding: "6px 10px", cursor: "pointer", background: tab === item[0] ? C.orange : "transparent", color: tab === item[0] ? "#000" : C.dim, fontSize: 11, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap" } }, item[1]);
                })),
                React.createElement(Btn, { variant: "muted", onClick: props.onLogout, style: { padding: "6px 11px", fontSize: 11 } }, "Sign Out"))),
        React.createElement("div", { style: { padding: "20px 14px 60px", maxWidth: 740, margin: "0 auto" } },
            tab === "quote" && React.createElement(PhoneQuotePanel, { onAddJob: props.onAddJob, gasPPG: props.gasPPG }),
            tab === "jobs" && React.createElement(JobsDashboard, { jobs: props.jobs, onUpdateStatus: props.onUpdateStatus, onAddJob: props.onAddJob, gasPPG: props.gasPPG }),
            tab === "calendar" && React.createElement(CalendarView, { jobs: props.jobs, blockedDates: props.blockedDates, onToggleBlock: props.onToggleBlock }),
            tab === "driver" && React.createElement(DriverPanel, { jobs: props.jobs, onUpdateStatus: props.onUpdateStatus })));
}
function AdminLogin(props) {
    var [pw, setPw] = useState("");
    var [err, setErr] = useState(false);
    function go() {
        if (pw === ADMIN_PW) {
            props.onLogin();
        }
        else {
            setErr(true);
            setTimeout(function () { setErr(false); }, 2000);
            setPw("");
        }
    }
    return React.createElement("div", { style: { minHeight: "100vh", background: C.black, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
        React.createElement("div", { style: { width: "100%", maxWidth: 340 } },
            React.createElement("div", { style: { textAlign: "center", marginBottom: 28 } },
                React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 4 } },
                    React.createElement(Logo, { size: 28 }),
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 20, fontWeight: 900 } },
                            React.createElement(BrandName, null)),
                        React.createElement("div", { style: { fontSize: 9, color: C.gold, letterSpacing: 1.5, textTransform: "uppercase" } }, "A POTENT PR\u00C4D\u018FKT\u00AE COMPANY"))),
                React.createElement("div", { style: { color: C.dim, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginTop: 8 } }, "Admin Access")),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: C.white, marginBottom: 16 } }, "\uD83D\uDD10 Sign In"),
                React.createElement(TxtIn, { label: "Password", value: pw, onChange: function (v) { setPw(v); }, type: "password", placeholder: "Enter admin password" }),
                err && React.createElement("div", { style: { color: C.red, fontSize: 12, marginBottom: 10 } }, "\u26A0 Incorrect password."),
                React.createElement(Btn, { onClick: go, disabled: !pw, style: { width: "100%" } }, "Enter Dashboard"))));
}
function PublicApp(props) {
    var [tab, setTab] = useState("home");
    var [bookCity, setBookCity] = useState(null);
    function startBooking(city) { setBookCity(city); setTab("book"); }
    return React.createElement("div", { style: { minHeight: "100vh", background: C.black, color: C.white, fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
        React.createElement("div", { style: { borderBottom: "1px solid " + C.border, position: "sticky", top: 0, background: C.black, zIndex: 200 } },
            React.createElement("div", { style: { padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid " + C.border + "88" } },
                React.createElement("div", { onClick: function () { setTab("home"); }, style: { cursor: "pointer", display: "flex", alignItems: "center", gap: 8 } },
                    React.createElement(Logo, { size: 20 }),
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 15, fontWeight: 900, letterSpacing: -0.5 } },
                            React.createElement(BrandName, null)),
                        React.createElement("div", { style: { fontSize: 7, color: C.gold, letterSpacing: 1.5, textTransform: "uppercase" } }, "A POTENT PR\u00C4D\u018FKT\u00AE COMPANY"))),
                React.createElement("a", { href: "tel:" + PHONE_NUMBER, style: { textDecoration: "none", background: C.orange, color: "#000", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" } }, "📞 " + PHONE_DISPLAY)),
            React.createElement("div", { style: { display: "flex", background: C.surface } }, [["home", "🏠 Home"], ["book", "📦 Book"], ["oos", "🗺️ OOS"], ["track", "📍 Track"]].map(function (item) {
                return React.createElement("button", { key: item[0], onClick: function () { setTab(item[0]); }, style: { flex: 1, border: "none", borderBottom: "2px solid " + (tab === item[0] ? C.orange : "transparent"), padding: "10px 4px", cursor: "pointer", background: tab === item[0] ? C.orange + "12" : "transparent", color: tab === item[0] ? C.orange : C.dim, fontSize: 11, fontWeight: 700, fontFamily: "inherit", textAlign: "center" } }, item[1]);
            }))),
        tab === "home" && React.createElement("div", null,
            React.createElement("div", { style: { position: "relative", width: "100%", minHeight: 480, overflow: "hidden", background: "#000" } },
                React.createElement("video", { autoPlay: true, muted: true, loop: true, playsInline: true, style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.65 } },
                    React.createElement("source", { src: "/potent-promo.mp4", type: "video/mp4" })),
                React.createElement("div", { style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(to bottom,#00000044 0%,#000000bb 60%,#080808 100%)" } }),
                React.createElement("div", { style: { position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 480, padding: "60px 24px 80px", textAlign: "center" } },
                    React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, background: C.orange + "18", border: "1px solid " + C.orange + "44", borderRadius: 20, padding: "4px 14px" } }, "SAME-DAY \u00B7 URGENT \u00B7 STATEWIDE GEORGIA"),
                    React.createElement("div", { style: { fontSize: 48, fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: 12, letterSpacing: -1, textShadow: "0 2px 20px #00000088" } },
                        "Fast. Secure.",
                        React.createElement("br", null),
                        React.createElement("span", { style: { color: C.orange } }, "On Demand.")),
                    React.createElement("div", { style: { fontSize: 14, color: "rgba(255,255,255,0.7)", maxWidth: 480, lineHeight: 1.75, marginBottom: 28 } }, "When other companies tell you next week, POTENT LOGISTICS is built for today."),
                    React.createElement("div", { style: { display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" } },
                        React.createElement("button", { onClick: function () { setTab("book"); }, style: { background: C.orange, color: "#000", border: "none", borderRadius: 9, padding: "13px 28px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" } }, "\uD83D\uDCE6 Book a Job"),
                        React.createElement("a", { href: "tel:" + PHONE_NUMBER, style: { textDecoration: "none" } },
                            React.createElement("button", { style: { background: "transparent", color: "#fff", border: "1.5px solid rgba(255,255,255,0.5)", borderRadius: 9, padding: "13px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "📞 " + PHONE_DISPLAY)),
                        React.createElement("button", { onClick: function () { setTab("track"); }, style: { background: "transparent", color: "rgba(255,255,255,0.6)", border: "1.5px solid rgba(255,255,255,0.2)", borderRadius: 9, padding: "13px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "\uD83D\uDCCD Track My Job")))),
            React.createElement("div", { style: { background: C.surface, borderBottom: "1px solid " + C.border, padding: "40px 24px" } },
                React.createElement("div", { style: { maxWidth: 680, margin: "0 auto" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 12 } }, "Who We Are"),
                    React.createElement("div", { style: { fontSize: 24, fontWeight: 800, color: C.white, lineHeight: 1.3, marginBottom: 16 } }, "Same-day deliveries, urgent freight, event transport, and high-value cargo across Georgia."),
                    React.createElement("div", { style: { fontSize: 14, color: C.dim, lineHeight: 1.85 } }, "When other companies tell you next week, POTENT LOGISTICS is built for today. With real-time tracking, direct routing, and transparent pricing, we help businesses and individuals move what matters \u2014 fast, secure, on demand."),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginTop: 28 } }, [["Same-Day", "Available 7 days"], ["No Hidden Fees", "Price locked at booking"], ["Real-Time", "Live job tracking"]].map(function (row) {
                        return React.createElement("div", { key: row[0], style: { background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 12px", textAlign: "center" } },
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: C.orange, marginBottom: 4 } }, row[0]),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim } }, row[1]));
                    })),
                    React.createElement("div", { style: { marginTop: 20, background: C.card, border: "1.5px solid " + C.orange + "44", borderRadius: 12, padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 2 } }, "Ready to book or have questions?"),
                            React.createElement("div", { style: { fontSize: 12, color: C.dim } }, "Call or text us \u2014 we respond fast.")),
                        React.createElement("a", { href: "tel:" + PHONE_NUMBER, style: { textDecoration: "none" } },
                            React.createElement("div", { style: { background: C.orange, color: "#000", borderRadius: 9, padding: "10px 20px", fontSize: 14, fontWeight: 800 } }, "📞 " + PHONE_DISPLAY))))),
            React.createElement("div", { style: { padding: "40px 20px 20px" } },
                React.createElement("div", { style: { maxWidth: 720, margin: "0 auto" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 6, textAlign: "center" } }, "Service Areas"),
                    React.createElement("div", { style: { fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 6, textAlign: "center" } }, "We Serve These Georgia Cities"),
                    React.createElement("div", { style: { fontSize: 13, color: C.dim, textAlign: "center", marginBottom: 28 } }, "Select your city to start a booking."),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 14 } }, CITIES.map(function (city) {
                        return React.createElement("div", { key: city.id, onClick: function () { startBooking(city); }, style: { background: city.grad, border: "1.5px solid " + C.border, borderRadius: 14, padding: "22px 20px", cursor: "pointer" } },
                            React.createElement("div", { style: { fontSize: 28, marginBottom: 8 } }, city.emoji),
                            React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: C.white, marginBottom: 2 } }, city.name),
                            React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 600, letterSpacing: 1, textTransform: "uppercase", marginBottom: 10 } }, city.sub),
                            React.createElement("div", { style: { fontSize: 12, color: C.dim, lineHeight: 1.65, marginBottom: 14 } }, city.desc),
                            React.createElement("div", { style: { display: "inline-flex", alignItems: "center", gap: 6, color: C.orange, border: "1.5px solid " + C.orange, borderRadius: 7, padding: "7px 14px", fontSize: 12, fontWeight: 700 } }, "Book in " + city.name.split(" ")[0] + " →"));
                    })))),
            React.createElement("div", { style: { background: C.surface, borderTop: "1px solid " + C.border, padding: "40px 24px", marginTop: 20 } },
                React.createElement("div", { style: { maxWidth: 680, margin: "0 auto" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 6, textAlign: "center" } }, "Out-of-State Transport"),
                    React.createElement("div", { style: { fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 8, textAlign: "center" } }, "Moving out of Georgia?"),
                    React.createElement("div", { style: { fontSize: 13, color: C.dim, textAlign: "center", marginBottom: 24, lineHeight: 1.7 } }, "We run one-way cargo and freight anywhere in the continental US. Priced per mile. Payment due at pickup. 10% cash discount applies."),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12, marginBottom: 24 } }, [["$6.50 / mile", "Standard Rate", "Scheduled runs to any state"], ["$8.50 / mile", "Same-Day Rate", "Urgent out-of-state available"], ["10% Off", "Pay Cash", "Cash discount on every out-of-state job"]].map(function (row) {
                        return React.createElement("div", { key: row[0], style: { background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 12px", textAlign: "center" } },
                            React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.orange, marginBottom: 3 } }, row[0]),
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 2 } }, row[1]),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim } }, row[2]));
                    })),
                    React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" } },
                        React.createElement("button", { onClick: function () { setTab("oos"); }, style: { background: C.orange, color: "#000", border: "none", borderRadius: 9, padding: "12px 28px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" } }, "\uD83D\uDDFA\uFE0F Book Out-of-State"),
                        React.createElement("a", { href: "tel:" + PHONE_NUMBER, style: { textDecoration: "none" } },
                            React.createElement("button", { style: { background: "transparent", color: C.white, border: "1.5px solid " + C.border, borderRadius: 9, padding: "12px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } }, "\uD83D\uDCDE Call for Custom Quote"))))),
            React.createElement("div", { style: { background: C.surface, borderTop: "1px solid " + C.border, padding: "40px 24px", marginTop: 20 } },
                React.createElement("div", { style: { maxWidth: 680, margin: "0 auto" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 6, textAlign: "center" } }, "How It Works"),
                    React.createElement("div", { style: { fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 28, textAlign: "center" } }, "Three steps. Zero confusion."),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 16 } }, [["1", "Book & Get a Quote", "Choose your service, location, and speed. Your price is locked before we dispatch."],
                        ["2", "We Pick It Up", "Driver arrives on time. Items must be ready at curbside or doorway."],
                        ["3", "Delivered & Tracked", "Track your job in real time. No surprises."]
                    ].map(function (row) {
                        return React.createElement("div", { key: row[0], style: { background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "18px 16px" } },
                            React.createElement("div", { style: { width: 32, height: 32, borderRadius: "50%", background: C.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#000", marginBottom: 10 } }, row[0]),
                            React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 6 } }, row[1]),
                            React.createElement("div", { style: { fontSize: 12, color: C.dim, lineHeight: 1.65 } }, row[2]));
                    })))),
            React.createElement("div", { style: { padding: "44px 24px", textAlign: "center" } },
                React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C.white, marginBottom: 8 } },
                    "If it needs to move today,",
                    React.createElement("br", null),
                    React.createElement("span", { style: { color: C.orange } }, "it moves.")),
                React.createElement("div", { style: { color: C.dim, fontSize: 13, marginBottom: 24 } }, "No next week. No runaround. Reliable cargo logistics, on demand."),
                React.createElement("button", { onClick: function () { setTab("book"); }, style: { background: C.orange, color: "#000", border: "none", borderRadius: 9, padding: "14px 32px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" } }, "Book a Job Now \uD83D\uDE90"))),
        tab === "book" && React.createElement("div", { style: { padding: "24px 16px 60px", maxWidth: 620, margin: "0 auto" } },
            bookCity && React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" } },
                React.createElement("div", { style: { fontSize: 13, color: C.white, fontWeight: 600 } }, bookCity.emoji + " Booking for " + bookCity.name),
                React.createElement("button", { onClick: function () { setBookCity(null); }, style: { background: "none", border: "none", color: C.dim, fontSize: 12, cursor: "pointer", fontFamily: "inherit" } }, "Change city")),
            React.createElement(BookingView, { onBook: props.onBook, preZone: bookCity && bookCity.zone, gasPPG: props.gasPPG, jobs: props.jobs, blockedDates: props.blockedDates })),
        tab === "track" && React.createElement("div", { style: { padding: "24px 16px 60px", maxWidth: 620, margin: "0 auto" } },
            React.createElement(TrackerView, { jobs: props.jobs })),
        tab === "oos" && React.createElement("div", { style: { padding: "24px 16px 60px", maxWidth: 640, margin: "0 auto" } },
            React.createElement(OOSBookingView, { onBook: props.onBook, gasPPG: props.gasPPG })));
}
function Root() {
    var [jobs, setJobs] = useState(loadJobs);
    var [isAdmin, setIsAdmin] = useState(loadAuth);
    var [showLogin, setShowLogin] = useState(false);
    var [gasPPG, setGasPPG] = useState(FALLBACK_GAS);
    var [blockedDates, setBlockedDates] = useState(function () {
        try {
            var r = localStorage.getItem("pl3_blocked");
            return r ? JSON.parse(r) : [];
        }
        catch (e) {
            return [];
        }
    });
    useEffect(function () { saveJobs(jobs); }, [jobs]);
    useEffect(function () {
        try {
            localStorage.setItem("pl3_blocked", JSON.stringify(blockedDates));
        }
        catch (e) { }
    }, [blockedDates]);
    useEffect(function () {
        fetchGasPrice().then(function (p) { setGasPPG(p); });
        var iv = setInterval(function () { fetchGasPrice().then(function (p) { setGasPPG(p); }); }, 6 * 60 * 60 * 1000);
        return function () { clearInterval(iv); };
    }, []);
    function addJob(j) {
        var newJob = j;
        if (j.oosJob && j.miles) {
            var oosBlocked = getOOSDatesBlocked(j.date, j.miles);
            newJob = Object.assign({}, j, { oosBlocked: oosBlocked });
        }
        setJobs(function (p) { return [newJob].concat(p); });
    }
    function toggleBlockDate(dateStr) {
        setBlockedDates(function (prev) {
            if (prev.indexOf(dateStr) > -1)
                return prev.filter(function (d) { return d !== dateStr; });
            return prev.concat([dateStr]);
        });
    }
    function updateJob(id, s) { setJobs(function (p) { return p.map(function (j) { return j.id === id ? Object.assign({}, j, { status: s }) : j; }); }); }
    function login() { setIsAdmin(true); saveAuth(true); setShowLogin(false); }
    function logout() { setIsAdmin(false); saveAuth(false); }
    if (isAdmin)
        return React.createElement(AdminDashboard, { jobs: jobs, onUpdateStatus: updateJob, onAddJob: addJob, onLogout: logout, gasPPG: gasPPG, blockedDates: blockedDates, onToggleBlock: toggleBlockDate });
    if (showLogin)
        return React.createElement(AdminLogin, { onLogin: login });
    return React.createElement("div", null,
        React.createElement(PublicApp, { jobs: jobs, onBook: addJob, gasPPG: gasPPG, blockedDates: blockedDates }),
        React.createElement("div", { style: { borderTop: "1px solid " + C.border, textAlign: "center", padding: "12px 0 20px", fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
            React.createElement("span", { onClick: function () { setShowLogin(true); }, style: { color: C.faint, fontSize: 11, cursor: "pointer", userSelect: "none" } }, "\u00A9 2026 Potent Logistics LLC \u00B7 A Potent Pr\u00E4d\u0259kt\u00AE Company")));
}
var rootEl = document.getElementById("root");
var reactRoot = ReactDOM.createRoot(rootEl);
reactRoot.render(React.createElement(Root));
