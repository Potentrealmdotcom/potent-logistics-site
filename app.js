"use strict";
var useState = React.useState;
var useEffect = React.useEffect;
var useRef = React.useRef;
var C = {
    black: "#080808", surface: "#0F0F0F", card: "#141414", border: "#222222",
    orange: "#F0E000", orangeSoft: "#F0E00014", gold: "#C8962A",
    white: "#F2F2F2", dim: "#888888", faint: "#444444",
    green: "#1DB954", red: "#E53E3E", yellow: "#F0E000", blue: "#4299E1", purple: "#9F7AEA",
};
// ── USER ACCOUNTS ─────────────────────────────────────────────────────
// ── DISPATCH USERS — Add names and passwords here ─────────────────
// commission: percentage they earn on jobs they bring in (0.125 = 12.5%)
// To change a rate: edit the number. 0.10 = 10%, 0.125 = 12.5%, 0.15 = 15%
// Each dispatcher gets their own login. Name shows in activity tracking.
// To add a dispatcher: copy any dispatch line, change id/name/password.
// Passwords: owner sets them, employees never share.
var USERS = [
    { id: "potent", name: "POTENT", role: "owner", password: "POTENTADMIN0421", emoji: "👑", commission: 0, access: ["quote", "jobs", "exceptions", "reports", "advanced", "carriers", "expenses", "accounts", "sales", "audit", "calendar", "driver", "driverapp", "ai", "demo", "leads", "activity", "leaderboard", "payroll", "fleet", "fleetmap", "compliance", "documents"] },
    { id: "dispatch1", name: "Dispatch 1", role: "dispatch", password: "DISPATCH1PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch2", name: "Dispatch 2", role: "dispatch", password: "DISPATCH2PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch3", name: "Dispatch 3", role: "dispatch", password: "DISPATCH3PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch4", name: "Dispatch 4", role: "dispatch", password: "DISPATCH4PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch5", name: "Dispatch 5", role: "dispatch", password: "DISPATCH5PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch6", name: "Dispatch 6", role: "dispatch", password: "DISPATCH6PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch7", name: "Dispatch 7", role: "dispatch", password: "DISPATCH7PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch8", name: "Dispatch 8", role: "dispatch", password: "DISPATCH8PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch9", name: "Dispatch 9", role: "dispatch", password: "DISPATCH9PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch10", name: "Dispatch 10", role: "dispatch", password: "DISPATCH10PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch11", name: "Dispatch 11", role: "dispatch", password: "DISPATCH11PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch12", name: "Dispatch 12", role: "dispatch", password: "DISPATCH12PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch13", name: "Dispatch 13", role: "dispatch", password: "DISPATCH13PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch14", name: "Dispatch 14", role: "dispatch", password: "DISPATCH14PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch15", name: "Dispatch 15", role: "dispatch", password: "DISPATCH15PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch16", name: "Dispatch 16", role: "dispatch", password: "DISPATCH16PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch17", name: "Dispatch 17", role: "dispatch", password: "DISPATCH17PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch18", name: "Dispatch 18", role: "dispatch", password: "DISPATCH18PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch19", name: "Dispatch 19", role: "dispatch", password: "DISPATCH19PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "dispatch20", name: "Dispatch 20", role: "dispatch", password: "DISPATCH20PL", emoji: "📞", commission: 0.125, commLogistics: 0.125, commOS: 0.10, commLoadboard: 0.10, access: ["quote", "jobs", "calendar", "driver", "driverapp", "leads", "leaderboard", "fleetmap", "documents", "ai"] },
    { id: "driver", name: "Driver 1", role: "driver", password: "DRIVERPL", emoji: "🚐", commission: 0, commLogistics: 0, commOS: 0, commLoadboard: 0, access: ["driver", "driverapp", "payroll"] },
    { id: "driver2", name: "Driver 2", role: "driver", password: "DRIVER2PL", emoji: "🚐", commission: 0, commLogistics: 0, commOS: 0, commLoadboard: 0, access: ["driver", "driverapp", "payroll"] },
    { id: "driver3", name: "Driver 3", role: "driver", password: "DRIVER3PL", emoji: "🚐", commission: 0, commLogistics: 0, commOS: 0, commLoadboard: 0, access: ["driver", "driverapp", "payroll"] },
];
// HOW TO RENAME A DISPATCHER:
// Change name:"Dispatch 1" to name:"Marcus" — their name shows on all activity logs, leads board, leaderboard.
// Change password to anything you want — tell them their new password.
// Keep the id the same so existing data stays linked.
//
// ── DISPLAY NAME OVERRIDES — synced via Supabase ─────────────────────
// Real names are set from the app (login screen edit button, or Payroll's
// employee manager) and synced through the user_display_names table so
// "Dispatch 1" becomes "Marcus" on every device, not just the one that
// made the change. localStorage is kept as a fast local cache so names
// render instantly on load without waiting on a network round-trip —
// it's refreshed from Supabase in the background and kept in sync going
// forward via loadNameOverridesFromServer()/saveNameOverride().
var NAME_OVERRIDES_KEY = "pl_emp_settings"; // shares storage with Payroll's empSettings (non-name fields like pay type still live here, local-only)
var NAME_OVERRIDES_CACHE_KEY = "pl_name_overrides_cache"; // just the {userId: name} map, synced copy
function loadNameOverrides() { try {
    var r = localStorage.getItem(NAME_OVERRIDES_KEY);
    return r ? JSON.parse(r) : {};
}
catch (e) {
    return {};
} }
// In-memory cache populated by loadNameOverridesFromServer() on app start.
// getDisplayName() checks this first (instant, already-synced data), then
// falls back to the local emp_settings cache for anything not yet synced.
var _syncedNameCache = null;
function loadSyncedNameCache() {
    if (_syncedNameCache)
        return _syncedNameCache;
    try {
        var r = localStorage.getItem(NAME_OVERRIDES_CACHE_KEY);
        _syncedNameCache = r ? JSON.parse(r) : {};
    }
    catch (e) {
        _syncedNameCache = {};
    }
    return _syncedNameCache;
}
function loadNameOverridesFromServer() {
    return fetch(SUPABASE_URL + "/rest/v1/user_display_names?select=user_id,name", { headers: sbHeaders() })
        .then(function (r) { return r.json(); })
        .then(function (rows) {
        if (!Array.isArray(rows))
            return;
        var map = {};
        rows.forEach(function (row) { map[row.user_id] = row.name; });
        _syncedNameCache = map;
        try {
            localStorage.setItem(NAME_OVERRIDES_CACHE_KEY, JSON.stringify(map));
        }
        catch (e) { }
    })
        .catch(function () { }); // offline/first-load fallback: local cache (if any) still applies
}
function saveNameOverride(userId, newName) {
    // Update local caches immediately so the UI reflects the change without
    // waiting on the network, then sync to Supabase in the background so
    // every other device picks it up on their next load.
    try {
        var all = loadNameOverrides();
        all[userId] = Object.assign({}, all[userId] || {}, { name: newName });
        localStorage.setItem(NAME_OVERRIDES_KEY, JSON.stringify(all));
    }
    catch (e) { }
    var cache = loadSyncedNameCache();
    cache[userId] = newName;
    _syncedNameCache = cache;
    try {
        localStorage.setItem(NAME_OVERRIDES_CACHE_KEY, JSON.stringify(cache));
    }
    catch (e) { }
    fetch(SUPABASE_URL + "/rest/v1/user_display_names?on_conflict=user_id", {
        method: "POST",
        headers: Object.assign({}, sbHeaders(), { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ user_id: userId, name: newName, updated_at: new Date().toISOString() })
    }).catch(function () { }); // best-effort — local cache already has the change either way
}
function getDisplayName(user) {
    var synced = loadSyncedNameCache();
    if (synced[user.id])
        return synced[user.id];
    var overrides = loadNameOverrides();
    return (overrides[user.id] && overrides[user.id].name) || user.name;
}
// ── REVOKED ACCESS — instantly block a login, no redeploy needed ────
// This is the real fix for "I'm firing someone and don't want them
// logging back in": their password is hardcoded in this file, so the
// only way to truly disable it without editing code is to check a
// synced block-list before allowing login. Revoking here takes effect
// the moment the person's browser next tries to log in (or immediately
// if the owner also force-logs-out their session — see revokeAccess()).
var _revokedUserIds = null; // in-memory cache, populated on app load
var REVOKED_CACHE_KEY = "pl_revoked_cache";
function loadRevokedCache() {
    if (_revokedUserIds)
        return _revokedUserIds;
    try {
        var r = localStorage.getItem(REVOKED_CACHE_KEY);
        _revokedUserIds = r ? JSON.parse(r) : [];
    }
    catch (e) {
        _revokedUserIds = [];
    }
    return _revokedUserIds;
}
function loadRevokedFromServer() {
    return fetch(SUPABASE_URL + "/rest/v1/revoked_users?select=user_id", { headers: sbHeaders() })
        .then(function (r) { return r.json(); })
        .then(function (rows) {
        if (!Array.isArray(rows))
            return;
        var ids = rows.map(function (row) { return row.user_id; });
        _revokedUserIds = ids;
        try {
            localStorage.setItem(REVOKED_CACHE_KEY, JSON.stringify(ids));
        }
        catch (e) { }
    })
        .catch(function () { }); // offline: last-known cache still applies, fails safe (blocks stay blocked)
}
function isUserRevoked(userId) {
    return loadRevokedCache().indexOf(userId) > -1;
}
function revokeAccess(userId, revokedByName, reason) {
    var cache = loadRevokedCache();
    if (cache.indexOf(userId) === -1) {
        cache.push(userId);
        _revokedUserIds = cache;
        try {
            localStorage.setItem(REVOKED_CACHE_KEY, JSON.stringify(cache));
        }
        catch (e) { }
    }
    return fetch(SUPABASE_URL + "/rest/v1/revoked_users", {
        method: "POST",
        headers: Object.assign({}, sbHeaders(), { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({ user_id: userId, revoked_by: revokedByName || "", reason: reason || "" })
    }).catch(function () { });
}
function restoreAccess(userId) {
    var cache = loadRevokedCache().filter(function (id) { return id !== userId; });
    _revokedUserIds = cache;
    try {
        localStorage.setItem(REVOKED_CACHE_KEY, JSON.stringify(cache));
    }
    catch (e) { }
    return fetch(SUPABASE_URL + "/rest/v1/revoked_users?user_id=eq." + encodeURIComponent(userId), {
        method: "DELETE", headers: sbHeaders()
    }).catch(function () { });
}
// ── PAYROLL SECURITY CODE ────────────────────────────────────────────
// A separate code (not the same as anyone's login password) required
// before any payout ("Mark Paid" / "Pay Full") can go through. Only the
// owner sees the field to set/change this code, from inside Payroll.
// Default is a placeholder — the owner should change it on first use.
var PAYROLL_CODE_KEY = "pl_payroll_code";
function loadPayrollCode() { try {
    return localStorage.getItem(PAYROLL_CODE_KEY) || "";
}
catch (e) {
    return "";
} }
function savePayrollCode(code) { try {
    localStorage.setItem(PAYROLL_CODE_KEY, code);
}
catch (e) { } }
var ROLES = { OWNER: "owner", DISPATCH: "dispatch", DRIVER: "driver" };
function getUserByPassword(pw) { return USERS.find(function (u) { return u.password === pw; }) || null; }
function loadCurrentUser() { try {
    var r = localStorage.getItem("pl_user");
    return r ? JSON.parse(r) : null;
}
catch (e) {
    return null;
} }
function saveCurrentUser(u) { try {
    if (u)
        localStorage.setItem("pl_user", JSON.stringify(u));
    else
        localStorage.removeItem("pl_user");
}
catch (e) { } }
// ── SUPABASE SYNC — jobs save to both localStorage AND Supabase ────────
var SUPABASE_URL = "https://ymvsatlrkzgxwzxybwmk.supabase.co";
var SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltdnNhdGxya3pneHd6eHlid21rIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc4NzgwMTQsImV4cCI6MjEwMzQ1NDAxNH0.KbW0enJr5FOzJmDQnT3Thhr5NJdbI4Ehp1vkhVEyPEg";
var PL_ORG_SLUG = "potent-logistics";
var _plOrgId = null; // cached after first fetch
function sbHeaders() {
    return { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY, "Content-Type": "application/json" };
}
// ── LIVE GPS TRACKING — driver_locations table ──────────────────────
// One row per driver_id (upsert). Driver App pings every 10s while a job is active.
function pingDriverLocation(loc) {
    // loc: { driver_id, driver_name, job_id, lat, lon, heading, speed, accuracy }
    return fetch(SUPABASE_URL + "/rest/v1/driver_locations?on_conflict=driver_id", {
        method: "POST",
        headers: Object.assign({}, sbHeaders(), { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify(Object.assign({}, loc, { updated_at: new Date().toISOString() }))
    }).catch(function () { });
}
function fetchDriverLocations(filter) {
    var url = SUPABASE_URL + "/rest/v1/driver_locations?select=*" + (filter ? "&" + filter : "");
    return fetch(url, { headers: sbHeaders() }).then(function (r) { return r.json(); }).catch(function () { return []; });
}
function clearDriverLocation(driverId) {
    return fetch(SUPABASE_URL + "/rest/v1/driver_locations?driver_id=eq." + encodeURIComponent(driverId), {
        method: "DELETE", headers: sbHeaders()
    }).catch(function () { });
}
// Pings older than this are treated as offline/stale on maps
var GPS_STALE_MS = 90 * 1000;
// Fetch Potent Logistics org_id once and cache it
function getOrgId() {
    if (_plOrgId)
        return Promise.resolve(_plOrgId);
    return fetch(SUPABASE_URL + "/rest/v1/organizations?slug=eq." + PL_ORG_SLUG + "&select=id", { headers: sbHeaders() })
        .then(function (r) { return r.json(); })
        .then(function (data) {
        if (data && data[0] && data[0].id) {
            _plOrgId = data[0].id;
        }
        return _plOrgId;
    }).catch(function () { return null; });
}
// Push a job to Supabase — runs in the background, never blocks the UI
function syncJobToSupabase(job) {
    getOrgId().then(function (orgId) {
        if (!orgId)
            return;
        var payload = {
            id: job.id,
            org_id: orgId,
            customer: job.customer,
            phone: job.phone,
            email: job.email || "",
            service: job.service,
            service_name: job.serviceName,
            origin: job.origin,
            destination: job.destination || job.origin,
            zone: job.zone || "",
            speed: job.speed || "standard",
            base_price: job.basePrice || 0,
            final_price: job.finalPrice || 0,
            status: job.status || "New",
            payment: job.payment || "cash",
            discreet: job.discreet || false,
            is_business: job.isBusiness || false,
            customer_type: job.customerType || "residential",
            company_name: job.companyName || "",
            payment_terms: job.paymentTerms || "completion",
            date: job.date || new Date().toISOString().split("T")[0],
            time_slot: job.timeSlot || "",
            notes: job.notes || "",
            miles: job.miles || null,
            fuel_cost: job.fuel || null,
            helper_hours: job.helperHours || 0,
            weight_tier: job.weightTier || "light",
            salesperson: job.salesperson || "",
            created_by: job.createdBy || "",
            payment_intent_id: job.paymentIntentId || null,
            paid_online: job.paidOnline || false
        };
        fetch(SUPABASE_URL + "/rest/v1/jobs", {
            method: "POST",
            headers: Object.assign({}, sbHeaders(), { Prefer: "resolution=merge-duplicates" }),
            body: JSON.stringify(payload)
        }).catch(function () { });
    });
}
// Sync a status update to Supabase
function syncStatusToSupabase(jobId, newStatus) {
    getOrgId().then(function (orgId) {
        if (!orgId)
            return;
        fetch(SUPABASE_URL + "/rest/v1/jobs?id=eq." + jobId + "&org_id=eq." + orgId, {
            method: "PATCH",
            headers: sbHeaders(),
            body: JSON.stringify({ status: newStatus })
        }).catch(function () { });
    });
}
var BUSINESS_EMAIL = "potentlogistics@pm.me";
var PHONE_NUMBER = "+17706484228";
var PHONE_DISPLAY = "(770) 648-4228";
// ═══════════════════════════════════════════════════════════════════
// 🌐 TRANSLATIONS — English, Spanish, French
// ═══════════════════════════════════════════════════════════════════
var LANG_KEY = "potent_lang";
function getLang() { try {
    return localStorage.getItem(LANG_KEY) || "en";
}
catch (e) {
    return "en";
} }
function setLang(l) { try {
    localStorage.setItem(LANG_KEY, l);
}
catch (e) { } }
var TX = {
    en: {
        home: "🏠 Home", book: "📦 Book", track: "📍 Track",
        heroTag: "24/7 LOGISTICS · COURIER · PROPERTY CLEANOUTS · JUNK REMOVAL",
        heroTitle: "Fast. Secure.", heroTitleSpan: "On Demand.",
        heroSub: "When other companies say next week, POTENT LOGISTICS delivers today.",
        yourName: "Your Name", phone: "Phone Number", email: "Email Address",
        pickupAddress: "Pickup Address", dropoffAddress: "Drop-Off Address",
        streetAddress: "Street Address", city: "City", state: "State",
        serviceDate: "Service Date", notes: "Special Instructions (optional)",
        paymentMethod: "Payment Method", cash: "Cash", card: "Card Online",
        bookItBtn: "✅ Book It", confirmingBtn: "Confirming...",
        selectService: "Select Your Service",
        bookedTitle: "You're Booked!", bookedSub: "We'll see you soon. Save your Job ID.",
        trackTitle: "Track Your Job", trackPlaceholder: "Enter Job ID (e.g. PL-8842)",
        trackBtn: "Track Job", notFound: "Job not found. Check your Job ID.",
        back: "← Back", lang: "Language",
        readyConfirm: "I confirm the details are correct and I am ready to be contacted.",
        // Admin
        quote: "Quote", jobs: "Jobs", alerts: "Alerts", reports: "Reports", analytics: "Analytics",
        carriers: "Carriers", expenses: "Expenses", accounts: "Accounts", sales: "Sales",
        audit: "Audit", calendar: "Calendar", driver: "Driver", driverApp: "Driver App",
        aiDocs: "AI Docs", leads: "Leads", activity: "Activity", board: "Board",
        payroll: "Payroll", demo: "Demo", more: "More", ops: "Ops", biz: "Biz", team: "Team",
        signOut: "Sign Out", save: "Save", cancel: "Cancel", delete: "Delete",
        confirm: "Confirm", submit: "Submit", search: "Search", filter: "Filter",
        status: "Status", date: "Date", amount: "Amount", total: "Total",
        newJob: "New Job", bookJob: "Book Job", addExpense: "Add Expense",
        paid: "Paid", unpaid: "Unpaid", pending: "Pending", completed: "Completed",
        cancelled: "Cancelled", active: "Active", inactive: "Inactive",
        customer: "Customer", driver2: "Driver", phone2: "Phone", email2: "Email",
        origin: "Pickup", destination: "Drop-off", price: "Price", miles: "Miles",
        notes2: "Notes", service: "Service", payment: "Payment",
        name: "Name", company: "Company", edit: "Edit", view: "View", close: "Close",
        markPaid: "Mark Paid", assign: "Assign", update: "Update",
        loading: "Loading...", noData: "No data yet.", error: "Something went wrong.",
        settings: "Settings", manage: "Manage", credentials: "Credentials",
        hireDate: "Hire Date", payType: "Pay Type", hourlyRate: "Hourly Rate",
        commission: "Commission", salary: "Salary", terminate: "Terminate", reactivate: "Reactivate",
        language: "Language",
    },
    es: {
        home: "🏠 Inicio", book: "📦 Reservar", track: "📍 Rastrear",
        heroTag: "LOGÍSTICA 24/7 · MENSAJERÍA · LIMPIEZA · MUDANZAS · DEMOLICIÓN",
        heroTitle: "Rápido. Seguro.", heroTitleSpan: "A Pedido.",
        heroSub: "Cuando otras empresas dicen la próxima semana, POTENT LOGISTICS entrega hoy.",
        yourName: "Su Nombre", phone: "Número de Teléfono", email: "Correo Electrónico",
        pickupAddress: "Dirección de Recogida", dropoffAddress: "Dirección de Entrega",
        streetAddress: "Dirección", city: "Ciudad", state: "Estado",
        serviceDate: "Fecha del Servicio", notes: "Instrucciones Especiales (opcional)",
        paymentMethod: "Método de Pago", cash: "Efectivo", card: "Tarjeta en Línea",
        bookItBtn: "✅ Confirmar Reserva", confirmingBtn: "Confirmando...",
        selectService: "Seleccione Su Servicio",
        bookedTitle: "¡Reserva Confirmada!", bookedSub: "Nos vemos pronto. Guarde su número de trabajo.",
        trackTitle: "Rastrear Su Trabajo", trackPlaceholder: "Ingrese ID (ej. PL-8842)",
        trackBtn: "Rastrear", notFound: "Trabajo no encontrado. Verifique su ID.",
        back: "← Atrás", lang: "Idioma",
        readyConfirm: "Confirmo que los detalles son correctos y estoy listo para ser contactado.",
        quote: "Cotización", jobs: "Trabajos", alerts: "Alertas", reports: "Reportes", analytics: "Analítica",
        carriers: "Transportistas", expenses: "Gastos", accounts: "Cuentas", sales: "Ventas",
        audit: "Auditoría", calendar: "Calendario", driver: "Conductor", driverApp: "App Conductor",
        aiDocs: "IA Documentos", leads: "Prospectos", activity: "Actividad", board: "Tablero",
        payroll: "Nómina", demo: "Demo", more: "Más", ops: "Ops", biz: "Negocio", team: "Equipo",
        signOut: "Cerrar Sesión", save: "Guardar", cancel: "Cancelar", delete: "Eliminar",
        confirm: "Confirmar", submit: "Enviar", search: "Buscar", filter: "Filtrar",
        status: "Estado", date: "Fecha", amount: "Monto", total: "Total",
        newJob: "Nuevo Trabajo", bookJob: "Reservar", addExpense: "Agregar Gasto",
        paid: "Pagado", unpaid: "No Pagado", pending: "Pendiente", completed: "Completado",
        cancelled: "Cancelado", active: "Activo", inactive: "Inactivo",
        customer: "Cliente", driver2: "Conductor", phone2: "Teléfono", email2: "Correo",
        origin: "Recogida", destination: "Entrega", price: "Precio", miles: "Millas",
        notes2: "Notas", service: "Servicio", payment: "Pago",
        name: "Nombre", company: "Empresa", edit: "Editar", view: "Ver", close: "Cerrar",
        markPaid: "Marcar Pagado", assign: "Asignar", update: "Actualizar",
        loading: "Cargando...", noData: "Sin datos aún.", error: "Algo salió mal.",
        settings: "Configuración", manage: "Gestionar", credentials: "Credenciales",
        hireDate: "Fecha de Contratación", payType: "Tipo de Pago", hourlyRate: "Tarifa por Hora",
        commission: "Comisión", salary: "Salario", terminate: "Terminar", reactivate: "Reactivar",
        language: "Idioma",
    },
    fr: {
        home: "🏠 Accueil", book: "📦 Réserver", track: "📍 Suivre",
        heroTag: "LOGISTIQUE 24/7 · COURRIER · NETTOYAGE · DÉMÉNAGEMENT · DÉMOLITION",
        heroTitle: "Rapide. Sécurisé.", heroTitleSpan: "À la Demande.",
        heroSub: "Quand d'autres disent la semaine prochaine, POTENT LOGISTICS livre aujourd'hui.",
        yourName: "Votre Nom", phone: "Numéro de Téléphone", email: "Adresse Email",
        pickupAddress: "Adresse de Ramassage", dropoffAddress: "Adresse de Livraison",
        streetAddress: "Adresse", city: "Ville", state: "État",
        serviceDate: "Date du Service", notes: "Instructions Spéciales (optionnel)",
        paymentMethod: "Mode de Paiement", cash: "Espèces", card: "Carte en Ligne",
        bookItBtn: "✅ Confirmer", confirmingBtn: "Confirmation...",
        selectService: "Choisissez Votre Service",
        bookedTitle: "Réservation Confirmée!", bookedSub: "À bientôt. Sauvegardez votre numéro.",
        trackTitle: "Suivre Votre Travail", trackPlaceholder: "Entrez ID (ex. PL-8842)",
        trackBtn: "Suivre", notFound: "Travail non trouvé. Vérifiez votre ID.",
        back: "← Retour", lang: "Langue",
        readyConfirm: "Je confirme que les détails sont corrects et je suis prêt à être contacté.",
        quote: "Devis", jobs: "Travaux", alerts: "Alertes", reports: "Rapports", analytics: "Analytique",
        carriers: "Transporteurs", expenses: "Dépenses", accounts: "Comptes", sales: "Ventes",
        audit: "Audit", calendar: "Calendrier", driver: "Conducteur", driverApp: "App Conducteur",
        aiDocs: "IA Documents", leads: "Prospects", activity: "Activité", board: "Tableau",
        payroll: "Paie", demo: "Démo", more: "Plus", ops: "Ops", biz: "Affaires", team: "Équipe",
        signOut: "Déconnexion", save: "Enregistrer", cancel: "Annuler", delete: "Supprimer",
        paid: "Payé", unpaid: "Non payé", completed: "Terminé", cancelled: "Annulé",
        language: "Langue",
    },
    pt: {
        home: "🏠 Início", book: "📦 Reservar", track: "📍 Rastrear",
        heroTag: "LOGÍSTICA 24/7 · COURIER · LIMPEZA · MUDANÇA · DEMOLIÇÃO",
        heroTitle: "Rápido. Seguro.", heroTitleSpan: "Sob Demanda.",
        heroSub: "Quando outras empresas dizem semana que vem, POTENT LOGISTICS entrega hoje.",
        yourName: "Seu Nome", phone: "Número de Telefone", email: "Endereço de Email",
        pickupAddress: "Endereço de Coleta", dropoffAddress: "Endereço de Entrega",
        streetAddress: "Endereço", city: "Cidade", state: "Estado",
        serviceDate: "Data do Serviço", notes: "Instruções Especiais (opcional)",
        paymentMethod: "Forma de Pagamento", cash: "Dinheiro", card: "Cartão Online",
        bookItBtn: "✅ Confirmar Reserva", confirmingBtn: "Confirmando...",
        selectService: "Selecione Seu Serviço",
        bookedTitle: "Reserva Confirmada!", bookedSub: "Até logo. Salve seu número de trabalho.",
        trackTitle: "Rastrear Trabalho", trackPlaceholder: "Digite ID (ex. PL-8842)",
        trackBtn: "Rastrear", notFound: "Trabalho não encontrado. Verifique seu ID.",
        back: "← Voltar", lang: "Idioma",
        readyConfirm: "Confirmo que os detalhes estão corretos e estou pronto para ser contatado.",
        quote: "Cotação", jobs: "Trabalhos", alerts: "Alertas", reports: "Relatórios", analytics: "Análise",
        carriers: "Transportadoras", expenses: "Despesas", accounts: "Contas", sales: "Vendas",
        audit: "Auditoria", calendar: "Calendário", driver: "Motorista", driverApp: "App Motorista",
        aiDocs: "IA Documentos", leads: "Leads", activity: "Atividade", board: "Quadro",
        payroll: "Folha de Pagamento", demo: "Demo", more: "Mais", ops: "Ops", biz: "Negócio", team: "Equipe",
        signOut: "Sair", save: "Salvar", cancel: "Cancelar", delete: "Excluir",
        paid: "Pago", unpaid: "Não Pago", completed: "Concluído", cancelled: "Cancelado",
        customer: "Cliente", driver2: "Motorista", phone2: "Telefone", email2: "Email",
        origin: "Coleta", destination: "Entrega", price: "Preço", miles: "Milhas",
        language: "Idioma",
    },
    kk: {
        home: "🏠 Басты бет", book: "📦 Брондау", track: "📍 Бақылау",
        heroTag: "ЛОГИСТИКА 24/7 · ЖЕТКІЗУ · ТАЗАЛАУ · ЖӨНЕЛТУ · БҰЗУ",
        heroTitle: "Жылдам. Сенімді.", heroTitleSpan: "Тапсырыс бойынша.",
        heroSub: "Басқалар келесі аптаны айтса, POTENT LOGISTICS бүгін жеткізеді.",
        yourName: "Сіздің атыңыз", phone: "Телефон нөміріңіз", email: "Электрондық пошта",
        pickupAddress: "Алу мекенжайы", dropoffAddress: "Жеткізу мекенжайы",
        streetAddress: "Көше мекенжайы", city: "Қала", state: "Штат",
        serviceDate: "Қызмет күні", notes: "Арнайы нұсқаулар (міндетті емес)",
        paymentMethod: "Төлем тәсілі", cash: "Қолма-қол", card: "Онлайн карта",
        bookItBtn: "✅ Брондау", confirmingBtn: "Расталуда...",
        selectService: "Қызметті таңдаңыз",
        bookedTitle: "Сәтті брондалды!", bookedSub: "Жуырда көреміз. Жұмыс нөмірін сақтаңыз.",
        trackTitle: "Жұмысты бақылау", trackPlaceholder: "ID енгізіңіз (мыс. PL-8842)",
        trackBtn: "Бақылау", notFound: "Жұмыс табылмады. ID тексеріңіз.",
        back: "← Артқа", lang: "Тіл",
        readyConfirm: "Мәліметтер дұрыс екенін растаймын және хабарласуға дайынмын.",
        quote: "Баға", jobs: "Жұмыстар", alerts: "Ескертулер", reports: "Есептер", analytics: "Аналитика",
        carriers: "Тасымалдаушылар", expenses: "Шығыстар", accounts: "Шоттар", sales: "Сатылым",
        audit: "Аудит", calendar: "Күнтізбе", driver: "Жүргізуші", driverApp: "Жүргізуші қосымшасы",
        aiDocs: "ЖИ Құжаттар", leads: "Перспективалар", activity: "Белсенділік", board: "Тақта",
        payroll: "Жалақы", demo: "Демо", more: "Көбірек", ops: "Опс", biz: "Бизнес", team: "Команда",
        signOut: "Шығу", save: "Сақтау", cancel: "Болдырмау", delete: "Жою",
        paid: "Төленді", unpaid: "Төленбеді", completed: "Аяқталды", cancelled: "Болдырылмады",
        language: "Тіл",
    },
    ru: {
        home: "🏠 Главная", book: "📦 Заказать", track: "📍 Отследить",
        heroTag: "ЛОГИСТИКА 24/7 · КУРЬЕР · УБОРКА · ПЕРЕЕЗД · ДЕМОНТАЖ",
        heroTitle: "Быстро. Надёжно.", heroTitleSpan: "По запросу.",
        heroSub: "Пока другие говорят «на следующей неделе», POTENT LOGISTICS доставляет сегодня.",
        yourName: "Ваше имя", phone: "Номер телефона", email: "Электронная почта",
        pickupAddress: "Адрес забора груза", dropoffAddress: "Адрес доставки",
        streetAddress: "Улица", city: "Город", state: "Штат",
        serviceDate: "Дата услуги", notes: "Особые инструкции (необязательно)",
        paymentMethod: "Способ оплаты", cash: "Наличные", card: "Карта онлайн",
        bookItBtn: "✅ Подтвердить", confirmingBtn: "Подтверждение...",
        selectService: "Выберите услугу",
        bookedTitle: "Заказ подтверждён!", bookedSub: "До скорой встречи. Сохраните номер заказа.",
        trackTitle: "Отследить заказ", trackPlaceholder: "Введите ID (напр. PL-8842)",
        trackBtn: "Отследить", notFound: "Заказ не найден. Проверьте ID.",
        back: "← Назад", lang: "Язык",
        readyConfirm: "Подтверждаю, что данные верны, и готов к контакту.",
        quote: "Котировка", jobs: "Работы", alerts: "Оповещения", reports: "Отчёты", analytics: "Аналитика",
        carriers: "Перевозчики", expenses: "Расходы", accounts: "Счета", sales: "Продажи",
        audit: "Аудит", calendar: "Календарь", driver: "Водитель", driverApp: "Приложение водителя",
        aiDocs: "ИИ Документы", leads: "Лиды", activity: "Активность", board: "Доска",
        payroll: "Зарплата", demo: "Демо", more: "Ещё", ops: "Операции", biz: "Бизнес", team: "Команда",
        signOut: "Выйти", save: "Сохранить", cancel: "Отмена", delete: "Удалить",
        paid: "Оплачено", unpaid: "Не оплачено", completed: "Завершено", cancelled: "Отменено",
        language: "Язык",
    },
    zh: {
        home: "🏠 首页", book: "📦 预订", track: "📍 追踪",
        heroTag: "24/7 物流 · 快递 · 清洁 · 搬家 · 拆除",
        heroTitle: "快速。可靠。", heroTitleSpan: "按需服务。",
        heroSub: "当其他公司说下周，POTENT LOGISTICS今天就送达。",
        yourName: "您的姓名", phone: "电话号码", email: "电子邮件",
        pickupAddress: "取货地址", dropoffAddress: "送货地址",
        streetAddress: "街道地址", city: "城市", state: "州",
        serviceDate: "服务日期", notes: "特殊说明（可选）",
        paymentMethod: "付款方式", cash: "现金", card: "在线支付",
        bookItBtn: "✅ 确认预订", confirmingBtn: "确认中...",
        selectService: "选择服务",
        bookedTitle: "预订成功！", bookedSub: "再见。请保存您的工作编号。",
        trackTitle: "追踪工作", trackPlaceholder: "输入ID（如 PL-8842）",
        trackBtn: "追踪", notFound: "未找到工作。请检查您的ID。",
        back: "← 返回", lang: "语言",
        readyConfirm: "我确认详细信息正确，并准备好接受联系。",
    },
    ko: {
        home: "🏠 홈", book: "📦 예약", track: "📍 추적",
        heroTag: "24/7 물류 · 택배 · 청소 · 이사 · 철거",
        heroTitle: "빠르게. 안전하게.", heroTitleSpan: "즉시 제공.",
        heroSub: "다른 회사가 다음 주라고 할 때, POTENT LOGISTICS는 오늘 배달합니다.",
        yourName: "이름", phone: "전화번호", email: "이메일 주소",
        pickupAddress: "픽업 주소", dropoffAddress: "배달 주소",
        streetAddress: "도로명 주소", city: "도시", state: "주",
        serviceDate: "서비스 날짜", notes: "특별 지시사항 (선택)",
        paymentMethod: "결제 방법", cash: "현금", card: "온라인 카드",
        bookItBtn: "✅ 예약 확인", confirmingBtn: "확인 중...",
        selectService: "서비스 선택",
        bookedTitle: "예약 완료!", bookedSub: "곧 뵙겠습니다. 작업 ID를 저장하세요.",
        trackTitle: "작업 추적", trackPlaceholder: "ID 입력 (예: PL-8842)",
        trackBtn: "추적", notFound: "작업을 찾을 수 없습니다.",
        back: "← 뒤로", lang: "언어",
        readyConfirm: "세부 정보가 정확하며 연락받을 준비가 되었음을 확인합니다.",
    },
    vi: {
        home: "🏠 Trang chủ", book: "📦 Đặt hàng", track: "📍 Theo dõi",
        heroTag: "LOGISTICS 24/7 · CHUYỂN PHÁT · DỌN DẸP · CHUYỂN NHÀ",
        heroTitle: "Nhanh. An toàn.", heroTitleSpan: "Theo yêu cầu.",
        heroSub: "Khi công ty khác nói tuần tới, POTENT LOGISTICS giao hôm nay.",
        yourName: "Họ và tên", phone: "Số điện thoại", email: "Địa chỉ email",
        pickupAddress: "Địa chỉ lấy hàng", dropoffAddress: "Địa chỉ giao hàng",
        streetAddress: "Địa chỉ đường phố", city: "Thành phố", state: "Tiểu bang",
        serviceDate: "Ngày dịch vụ", notes: "Hướng dẫn đặc biệt (tùy chọn)",
        paymentMethod: "Phương thức thanh toán", cash: "Tiền mặt", card: "Thẻ trực tuyến",
        bookItBtn: "✅ Xác nhận đặt hàng", confirmingBtn: "Đang xác nhận...",
        selectService: "Chọn dịch vụ",
        bookedTitle: "Đã đặt hàng!", bookedSub: "Hẹn gặp lại. Lưu số công việc của bạn.",
        trackTitle: "Theo dõi công việc", trackPlaceholder: "Nhập ID (ví dụ PL-8842)",
        trackBtn: "Theo dõi", notFound: "Không tìm thấy công việc.",
        back: "← Quay lại", lang: "Ngôn ngữ",
        readyConfirm: "Tôi xác nhận thông tin chính xác và sẵn sàng được liên hệ.",
    },
    ar: {
        home: "🏠 الرئيسية", book: "📦 احجز", track: "📍 تتبع",
        heroTag: "لوجستيات ٢٤/٧ · توصيل · تنظيف · نقل · هدم",
        heroTitle: "سريع. آمن.", heroTitleSpan: "عند الطلب.",
        heroSub: "عندما تقول الشركات الأخرى الأسبوع القادم، POTENT LOGISTICS يوصل اليوم.",
        yourName: "اسمك", phone: "رقم الهاتف", email: "البريد الإلكتروني",
        pickupAddress: "عنوان الاستلام", dropoffAddress: "عنوان التسليم",
        streetAddress: "عنوان الشارع", city: "المدينة", state: "الولاية",
        serviceDate: "تاريخ الخدمة", notes: "تعليمات خاصة (اختياري)",
        paymentMethod: "طريقة الدفع", cash: "نقداً", card: "بطاقة إلكترونية",
        bookItBtn: "✅ تأكيد الحجز", confirmingBtn: "جارٍ التأكيد...",
        selectService: "اختر خدمتك",
        bookedTitle: "تم الحجز!", bookedSub: "نراكم قريباً. احفظ رقم عملك.",
        trackTitle: "تتبع عملك", trackPlaceholder: "أدخل المعرف (مثال PL-8842)",
        trackBtn: "تتبع", notFound: "العمل غير موجود. تحقق من المعرف.",
        back: "← رجوع", lang: "اللغة",
        readyConfirm: "أؤكد أن التفاصيل صحيحة وأنا مستعد للتواصل.",
    },
    hi: {
        home: "🏠 होम", book: "📦 बुक करें", track: "📍 ट्रैक करें",
        heroTag: "24/7 लॉजिस्टिक्स · कूरियर · सफाई · शिफ्टिंग · डेमोलिशन",
        heroTitle: "तेज़। सुरक्षित।", heroTitleSpan: "मांग पर।",
        heroSub: "जब दूसरी कंपनियां अगले हफ्ते कहती हैं, POTENT LOGISTICS आज डिलीवर करता है।",
        yourName: "आपका नाम", phone: "फ़ोन नंबर", email: "ईमेल पता",
        pickupAddress: "पिकअप पता", dropoffAddress: "डिलीवरी पता",
        streetAddress: "सड़क का पता", city: "शहर", state: "राज्य",
        serviceDate: "सेवा की तारीख", notes: "विशेष निर्देश (वैकल्पिक)",
        paymentMethod: "भुगतान का तरीका", cash: "नकद", card: "ऑनलाइन कार्ड",
        bookItBtn: "✅ बुकिंग कन्फर्म करें", confirmingBtn: "पुष्टि हो रही है...",
        selectService: "अपनी सेवा चुनें",
        bookedTitle: "बुकिंग हो गई!", bookedSub: "जल्द मिलेंगे। अपना जॉब ID सुरक्षित रखें।",
        trackTitle: "जॉब ट्रैक करें", trackPlaceholder: "जॉब ID दर्ज करें (जैसे PL-8842)",
        trackBtn: "ट्रैक करें", notFound: "जॉब नहीं मिला। ID जांचें।",
        back: "← वापस", lang: "भाषा",
        readyConfirm: "मैं पुष्टि करता हूं कि विवरण सही है और संपर्क के लिए तैयार हूं।",
    },
    ht: {
        home: "🏠 Akèy", book: "📦 Rezève", track: "📍 Swiv",
        heroTag: "LOJISTIK 24/7 · KOURYÈ · NETWAYAJ · DEMENAJMAN",
        heroTitle: "Rapid. Sekirize.", heroTitleSpan: "Sou Demann.",
        heroSub: "Lè lòt konpayi yo di semèn pwochen, POTENT LOGISTICS livré jodi a.",
        yourName: "Non Ou", phone: "Nimewo Telefòn", email: "Adrès Imèl",
        pickupAddress: "Adrès Ranmase", dropoffAddress: "Adrès Livrezon",
        streetAddress: "Adrès Ri", city: "Vil", state: "Eta",
        serviceDate: "Dat Sèvis", notes: "Enstriksyon Espesyal (opsyonèl)",
        paymentMethod: "Metòd Peman", cash: "Lajan Kach", card: "Kat sou Entènèt",
        bookItBtn: "✅ Konfime Rezèvasyon", confirmingBtn: "Konfime...",
        selectService: "Chwazi Sèvis Ou",
        bookedTitle: "Rezèvasyon Konfime!", bookedSub: "Nou pral wè ou byento. Sove nimewo travay ou.",
        trackTitle: "Swiv Travay Ou", trackPlaceholder: "Antre ID (eks. PL-8842)",
        trackBtn: "Swiv", notFound: "Travay pa jwenn. Tcheke ID ou.",
        back: "← Retounen", lang: "Lang",
        readyConfirm: "Mwen konfime detay yo kòrèk epi mwen prè pou yo kontakte m.",
    },
    pl: {
        home: "🏠 Strona główna", book: "📦 Zarezerwuj", track: "📍 Śledź",
        heroTag: "LOGISTYKA 24/7 · KURIER · SPRZĄTANIE · PRZEPROWADZKA · WYBURZANIE",
        heroTitle: "Szybko. Bezpiecznie.", heroTitleSpan: "Na żądanie.",
        heroSub: "Gdy inne firmy mówią za tydzień, POTENT LOGISTICS dostarcza dziś.",
        yourName: "Twoje imię", phone: "Numer telefonu", email: "Adres email",
        pickupAddress: "Adres odbioru", dropoffAddress: "Adres dostawy",
        streetAddress: "Adres ulicy", city: "Miasto", state: "Stan",
        serviceDate: "Data usługi", notes: "Specjalne instrukcje (opcjonalne)",
        paymentMethod: "Metoda płatności", cash: "Gotówka", card: "Karta online",
        bookItBtn: "✅ Potwierdź rezerwację", confirmingBtn: "Potwierdzanie...",
        selectService: "Wybierz usługę",
        bookedTitle: "Rezerwacja potwierdzona!", bookedSub: "Do zobaczenia wkrótce. Zapisz swój numer zadania.",
        trackTitle: "Śledź zadanie", trackPlaceholder: "Wpisz ID (np. PL-8842)",
        trackBtn: "Śledź", notFound: "Zadanie nie znalezione. Sprawdź ID.",
        back: "← Wstecz", lang: "Język",
        readyConfirm: "Potwierdzam, że dane są poprawne i jestem gotowy na kontakt.",
    },
    de: {
        home: "🏠 Startseite", book: "📦 Buchen", track: "📍 Verfolgen",
        heroTag: "LOGISTIK 24/7 · KURIER · REINIGUNG · UMZUG · ABRISS",
        heroTitle: "Schnell. Sicher.", heroTitleSpan: "Auf Abruf.",
        heroSub: "Wenn andere Firmen nächste Woche sagen, liefert POTENT LOGISTICS heute.",
        yourName: "Ihr Name", phone: "Telefonnummer", email: "E-Mail-Adresse",
        pickupAddress: "Abholadresse", dropoffAddress: "Lieferadresse",
        streetAddress: "Straßenadresse", city: "Stadt", state: "Bundesstaat",
        serviceDate: "Servicedatum", notes: "Besondere Anweisungen (optional)",
        paymentMethod: "Zahlungsmethode", cash: "Bargeld", card: "Karte Online",
        bookItBtn: "✅ Buchung bestätigen", confirmingBtn: "Bestätigung...",
        selectService: "Service auswählen",
        bookedTitle: "Buchung bestätigt!", bookedSub: "Bis bald. Speichern Sie Ihre Job-ID.",
        trackTitle: "Job verfolgen", trackPlaceholder: "ID eingeben (z.B. PL-8842)",
        trackBtn: "Verfolgen", notFound: "Job nicht gefunden. Überprüfen Sie Ihre ID.",
        back: "← Zurück", lang: "Sprache",
        readyConfirm: "Ich bestätige, dass die Angaben korrekt sind und bin bereit, kontaktiert zu werden.",
    },
};
// Global language state - shared between public and admin
var _globalLang = getLang();
var _langListeners = [];
function subscribeLang(fn) { _langListeners.push(fn); }
function unsubscribelang(fn) { _langListeners = _langListeners.filter(function (f) { return f !== fn; }); }
function changeGlobalLang(l) { _globalLang = l; setLang(l); _langListeners.forEach(function (f) { f(l); }); }
function t(key) { return (TX[_globalLang] && TX[_globalLang][key]) || TX.en[key] || key; }
function useTranslations() {
    var [lang, setLangState] = useState(getLang);
    function changeLang(l) { changeGlobalLang(l); setLangState(l); }
    function tLocal(key) { return (TX[lang] && TX[lang][key]) || TX.en[key] || key; }
    return { lang, changeLang, t: tLocal };
}
function useLang() {
    var [lang, setLangState] = useState(function () { return _globalLang; });
    React.useEffect(function () {
        subscribeLang(setLangState);
        return function () { unsubscribelang(setLangState); };
    }, []);
    function tl(key) { return (TX[lang] && TX[lang][key]) || TX.en[key] || key; }
    return { lang, t: tl };
}
function LangSwitcher({ lang, changeLang }) {
    var langs = [
        ["en", "🇺🇸"], ["es", "🇲🇽"], ["pt", "🇧🇷"], ["kk", "🇰🇿"],
        ["ru", "🇷🇺"], ["fr", "🇫🇷"], ["zh", "🇨🇳"], ["ko", "🇰🇷"],
        ["vi", "🇻🇳"], ["ar", "🇦🇪"], ["hi", "🇮🇳"], ["ht", "🇭🇹"],
        ["pl", "🇵🇱"], ["de", "🇩🇪"],
    ];
    var [open, setOpen] = useState(false);
    var current = langs.find(function (l) { return l[0] === lang; }) || langs[0];
    return React.createElement("div", { style: { position: "relative" } },
        React.createElement("button", { onClick: function () { setOpen(!open); }, style: { background: "transparent", border: "1px solid " + C.border, borderRadius: 6, padding: "4px 8px", cursor: "pointer", fontSize: 16, display: "flex", alignItems: "center", gap: 4 } },
            current[1],
            React.createElement("span", { style: { fontSize: 9, color: C.dim, marginLeft: 2 } }, "\u25BC")),
        open && React.createElement("div", { style: { position: "absolute", right: 0, top: "110%", background: C.card, border: "1px solid " + C.border, borderRadius: 8, padding: 6, zIndex: 999, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 3, minWidth: 140 } }, langs.map(function (l) {
            return React.createElement("button", { key: l[0], onClick: function () { changeLang(l[0]); setOpen(false); }, title: l[0].toUpperCase(), style: { background: lang === l[0] ? C.orange + "22" : "transparent", border: "1px solid " + (lang === l[0] ? C.orange : C.border), borderRadius: 5, padding: "5px 4px", cursor: "pointer", fontSize: 16, lineHeight: 1 } }, l[1]);
        })));
}
// Global language state - shared between public and admin
var _globalLang = getLang();
var _langListeners = [];
function subscribeLang(fn) { _langListeners.push(fn); }
function unsubscribelang(fn) { _langListeners = _langListeners.filter(function (f) { return f !== fn; }); }
function changeGlobalLang(l) { _globalLang = l; setLang(l); _langListeners.forEach(function (f) { f(l); }); }
function t(key) { return (TX[_globalLang] && TX[_globalLang][key]) || TX.en[key] || key; }
function useTranslations() {
    var [lang, setLangState] = useState(getLang);
    function changeLang(l) { changeGlobalLang(l); setLangState(l); }
    function tLocal(key) { return (TX[lang] && TX[lang][key]) || TX.en[key] || key; }
    return { lang, changeLang, t: tLocal };
}
function useLang() {
    var [lang, setLangState] = useState(function () { return _globalLang; });
    React.useEffect(function () {
        subscribeLang(setLangState);
        return function () { unsubscribelang(setLangState); };
    }, []);
    function tl(key) { return (TX[lang] && TX[lang][key]) || TX.en[key] || key; }
    return { lang, t: tl };
}
function LangSwitcher({ lang, changeLang }) {
    return React.createElement("div", { style: { display: "flex", gap: 4, alignItems: "center" } }, [["en", "🇺🇸"], ["es", "🇲🇽"], ["fr", "🇫🇷"]].map(function (l) {
        return React.createElement("button", { key: l[0], onClick: function () { changeLang(l[0]); }, style: {
                background: lang === l[0] ? C.orange : "transparent",
                border: "1px solid " + (lang === l[0] ? C.orange : C.border),
                borderRadius: 6, padding: "3px 7px", cursor: "pointer",
                fontSize: 14, lineHeight: 1, fontFamily: "inherit",
                opacity: lang === l[0] ? 1 : 0.5,
            } }, l[1]);
    }));
}
var TRUCK_MPG = 9;
var TRUCK_MAX_LBS = 4300;
var TRUCK_LENGTH = "16ft";
var TRUCK_WIDTH = "93 inches wide";
var HELPER_FEE = 100;
// ─── STATE GAS PRICES (as of June 15, 2026) ──────────────────────────
// Source: AAA, GasBuddy. Updated manually or via EIA API for GA.
// Out-of-state jobs use destination state price (fueling up there).
var GAS_BY_STATE = {
    // Southeast — lowest prices in US
    "GA": 3.76, "FL": 3.82, "AL": 3.68, "MS": 3.65, "TN": 3.71, "SC": 3.74, "NC": 3.79,
    "VA": 3.89, "WV": 3.84, "KY": 3.73, "AR": 3.62, "LA": 3.69,
    // Mid-Atlantic / Northeast — highest prices
    "MD": 3.94, "DC": 4.18, "DE": 3.87, "NJ": 3.91, "PA": 3.96, "NY": 4.12,
    "CT": 3.99, "RI": 3.88, "MA": 3.97, "VT": 3.93, "NH": 3.85, "ME": 3.90,
    // Midwest
    "OH": 3.82, "IN": 3.78, "IL": 4.05, "MI": 3.86, "WI": 3.80, "MN": 3.83,
    "IA": 3.71, "MO": 3.67, "KS": 3.64, "NE": 3.69, "SD": 3.72, "ND": 3.74,
    // South / Southwest
    "TX": 3.59, "OK": 3.61, "NM": 3.78, "AZ": 3.92, "CO": 3.88, "UT": 3.85,
    "NV": 4.15, "ID": 3.82, "WY": 3.77, "MT": 3.81,
    // West Coast — most expensive
    "CA": 4.89, "OR": 4.12, "WA": 4.18, "AK": 4.35, "HI": 4.72,
};
var NATIONAL_AVG_GAS = 4.07; // AAA national average June 15 2026
var FALLBACK_GAS = 3.76; // Georgia default
function getGasForState(stateAbbr) {
    if (!stateAbbr)
        return FALLBACK_GAS;
    return GAS_BY_STATE[stateAbbr.toUpperCase()] || NATIONAL_AVG_GAS;
}
// ─── DIESEL PRICES BY STATE ─────────────────────────────────────────
// Diesel typically runs $0.55-0.75/gal above regular unleaded — table
// below reflects that spread per state using the same June 2026 baseline.
var DIESEL_BY_STATE = {
    "GA": 4.38, "FL": 4.46, "AL": 4.29, "MS": 4.24, "TN": 4.33, "SC": 4.36, "NC": 4.42,
    "VA": 4.54, "WV": 4.48, "KY": 4.31, "AR": 4.19, "LA": 4.27,
    "MD": 4.61, "DC": 4.89, "DE": 4.52, "NJ": 4.58, "PA": 4.65, "NY": 4.85,
    "CT": 4.68, "RI": 4.55, "MA": 4.66, "VT": 4.62, "NH": 4.50, "ME": 4.57,
    "OH": 4.47, "IN": 4.41, "IL": 4.74, "MI": 4.51, "WI": 4.44, "MN": 4.48,
    "IA": 4.32, "MO": 4.26, "KS": 4.21, "NE": 4.30, "SD": 4.33, "ND": 4.35,
    "TX": 4.16, "OK": 4.18, "NM": 4.43, "AZ": 4.59, "CO": 4.53, "UT": 4.49,
    "NV": 4.81, "ID": 4.47, "WY": 4.40, "MT": 4.45,
    "CA": 5.68, "OR": 4.79, "WA": 4.86, "AK": 5.02, "HI": 5.41,
};
var NATIONAL_AVG_DIESEL = 4.72; // national average, same baseline date
var FALLBACK_DIESEL = 4.38; // Georgia default
function getDieselForState(stateAbbr) {
    if (!stateAbbr)
        return FALLBACK_DIESEL;
    return DIESEL_BY_STATE[stateAbbr.toUpperCase()] || NATIONAL_AVG_DIESEL;
}
// Unified lookup — pass "regular" or "diesel" as fuelType.
function getFuelPriceForState(stateAbbr, fuelType) {
    return fuelType === "diesel" ? getDieselForState(stateAbbr) : getGasForState(stateAbbr);
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
    { id: "junkremoval", icon: "\u{1F5D1}", name: "Junk Removal", tagline: "Single item to a full 16ft truckload", priceRange: "$200-$1,000",
        desc: "Couches, mattresses, appliances, interior room removal, garage and yard cleanouts. Priced by how much of our truck your junk fills.",
        includes: ["Loading & hauling from inside the home", "Standard disposal fees included", "Same-day available", "Single item to full truckload", "Interior room removal"],
        excludes: ["Hazardous materials", "Whole-property cleanouts (see Property Cleanouts)", "Permitted demo work"],
        rule: "Items must be identified and ready for removal. We go inside — just show us what needs to go.",
        sizes: ["Single item / minimum load", "Quarter load", "Half load", "Three-quarter load", "Full load"] },
    { id: "cleanout", icon: "\u{1F3E0}", name: "Property Cleanouts", tagline: "Estate, foreclosure, eviction, commercial & more", priceRange: "$1,200-$20,000+",
        desc: "Whole-property cleanouts priced by size and scope. We'll confirm final pricing by phone.",
        includes: ["Full property clearing", "Phone-confirmed quote review", "Estate, foreclosure, eviction & commercial jobs", "Custom quote for hoarder & large-scale jobs"],
        excludes: ["Deep cleaning / sanitization", "Asset appraisal or estate sale services", "Permitted demolition"],
        rule: "Starting prices are estimates. Final price confirmed by phone after a quick walkthrough.",
        sizes: ["Studio / 1 Bedroom", "2 Bedroom", "3 Bedroom", "4 Bedroom", "5+ Bedroom", "Hoarder House", "Commercial / School / Warehouse"] },
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
// ── JUNK REMOVAL — priced by load size, your 16ft box truck holds ~2x a standard junk truck ──
var LOAD_SIZES = [
    { id: "minimum", label: "Single Item / Minimum", sub: "One item or a small pile", price: 200 },
    { id: "quarter", label: "Quarter Load", sub: "A few items — couch, small cleanout", price: 350 },
    { id: "half", label: "Half Load", sub: "Bedroom set, multiple appliances", price: 600 },
    { id: "threequarter", label: "Three-Quarter Load", sub: "Garage or large room cleanout", price: 800 },
    { id: "full", label: "Full Load", sub: "Full 16ft truck — biggest single trip", price: 1000 },
];
var EXTRA_TRUCKLOAD_FEE = 1000; // each additional full truckload beyond the first, on big jobs
// Real Georgia landfill/transfer station per-item fees, admin-reference only — never shown to customers.
// 3x markup is the suggested add-on; admin decides whether to apply it to a quote.
var DUMP_FEES = [
    { id: "mattress", label: "Mattress", realFee: 12, markup: 36 },
    { id: "boxspring", label: "Box Spring", realFee: 12, markup: 36 },
    { id: "tireoffrim", label: "Tire (off rim)", realFee: 8, markup: 24 },
    { id: "tireonrim", label: "Tire (on rim)", realFee: 10, markup: 30 },
    { id: "fridge", label: "Refrigerator / Freezer (refrigerant)", realFee: 20, markup: 60 },
    { id: "ac", label: "AC Unit (refrigerant)", realFee: 20, markup: 60 },
    { id: "tv", label: "TV / Monitor (e-waste)", realFee: 15, markup: 45 },
    { id: "paint", label: "Paint Can (per gallon)", realFee: 5, markup: 15 },
];
var GA_AVG_DUMP_RATE_PER_TON = 50; // Georgia statewide average ~$55.76/ton (EREF 2024); used for job-profit reference only
// ── PROPERTY CLEANOUTS — starting estimates only, admin confirms final price by phone ──
var CLEANOUT_TIERS = [
    { id: "studio", label: "Studio / 1 Bedroom", startPrice: 1200 },
    { id: "2br", label: "2 Bedroom", startPrice: 2000 },
    { id: "3br", label: "3 Bedroom", startPrice: 3500 },
    { id: "4br", label: "4 Bedroom", startPrice: 5000 },
    { id: "5br", label: "5+ Bedroom", startPrice: 6500 },
    { id: "hoarder", label: "Hoarder House", startPrice: 8000 },
    { id: "commercial", label: "Commercial / School / Warehouse", startPrice: 0 }, // always custom quote
];
var CLEANOUT_SUBTYPES = [
    { id: "estate", label: "Estate Cleanout", minPrice: 1200 },
    { id: "foreclosure", label: "Foreclosure Cleanout", minPrice: 1500 },
    { id: "eviction", label: "Eviction Cleanout", minPrice: 1200 },
    { id: "realtor", label: "Realtor Property Prep", minPrice: 1200 },
    { id: "hoarder", label: "Hoarder Cleanout", minPrice: 8000 },
    { id: "office", label: "Office Cleanout", minPrice: 2500 },
    { id: "school", label: "School Cleanout", minPrice: 3500 },
    { id: "warehouse", label: "Warehouse Cleanout", minPrice: 5000 },
];
// ── INSTITUTIONAL / BULK DEBRIS HAULING — admin reference only, always Custom Price Override ──
// Post-demo debris hauling for large institutional jobs (you haul, you don't demo).
// No customer-facing calculator — these get sold as a negotiated flat number, not a per-load formula.
var INSTITUTIONAL_TYPES = [
    { id: "barracks_unit", label: "Single Barracks Unit / Small Structure", sub: "~2-4 truckloads", minPrice: 2000, maxPrice: 4000 },
    { id: "school_wing", label: "School Wing / Housing Complex Building", sub: "~5-10 truckloads", minPrice: 5000, maxPrice: 10000 },
    { id: "full_barracks", label: "Full Barracks Building / Large School / Warehouse", sub: "~10-20 truckloads", minPrice: 10000, maxPrice: 20000 },
    { id: "multi_building", label: "Multi-Building Base / Complex Contract", sub: "20+ truckloads", minPrice: 20000, maxPrice: 0 }, // 0 max = open-ended, custom contract
];
var INSTITUTIONAL_DISCOUNT_NOTE = "Military, government, schools, and large facility contracts — ask about discount rates for recurring or multi-building work.";
// ── DEMOLITION — light demo, mostly ranges since scope varies a lot ──
var DEMO_TYPES = [
    { id: "shed", label: "Shed Removal", minPrice: 900, maxPrice: 2500 },
    { id: "deck", label: "Deck Removal/Demo", minPrice: 1500, maxPrice: 4000 },
    { id: "fence", label: "Fence Removal", minPrice: 600, maxPrice: 2000 },
    { id: "kitchen", label: "Kitchen Demo", minPrice: 2500, maxPrice: 7500 },
    { id: "bathroom", label: "Bathroom Demo", minPrice: 1500, maxPrice: 4000 },
    { id: "flooring", label: "Flooring Removal", minPrice: 800, maxPrice: 3000 },
    { id: "interior", label: "Interior Demolition", minPrice: 0, maxPrice: 0 }, // always custom quote
];
// ── EMERGENCY / RUSH ADD-ONS — stack onto any service, same pattern as courier speed tiers ──
var EMERGENCY_ADDONS = [
    { id: "dispatch247", label: "24/7 Emergency Dispatch", fee: 250 },
    { id: "samedayguarantee", label: "Same-Day Guaranteed Arrival", fee: 150 },
    { id: "holiday", label: "Holiday Service", fee: 300 },
];
// ── TERMS OF SERVICE ────────────────────────────────────────────────
var TOS_VERSION = "1.0";
var TOS_SECTIONS = [
    { title: "1. Agreement to Terms",
        body: "By booking a job with Potent Logistics LLC (\"Potent Logistics,\" \"we,\" \"us\"), you agree to these Terms of Service. If you do not agree, do not book or use our services." },
    { title: "2. Binding Arbitration — No Court Lawsuits",
        body: "Any dispute, claim, or disagreement arising from or related to our services shall be resolved exclusively through binding arbitration, not in a court of law. Arbitration will be conducted by a neutral, mutually agreed-upon arbitrator under standard commercial arbitration rules. The arbitrator's decision is final and binding on both parties. By agreeing to these terms, you waive any right to a jury trial or to bring a claim in state or federal court." },
    { title: "3. No Class Actions",
        body: "You agree to bring any claim against Potent Logistics solely in your individual capacity, not as a plaintiff or class member in any purported class, collective, or representative proceeding." },
    { title: "4. Limitation of Liability",
        body: "To the maximum extent permitted by law, Potent Logistics' total liability for any claim arising from a job is limited to the amount actually paid for that specific job. We are not liable for indirect, incidental, consequential, or speculative damages, including but not limited to lost wages, emotional distress, or claims of unjust enrichment. This limitation does not apply to liability that cannot be limited or waived under applicable law (such as liability for gross negligence or intentional misconduct)." },
    { title: "5. Insurance",
        body: "Potent Logistics maintains commercial insurance coverage. Claims involving property damage or injury directly caused by our negligence during a job should be reported immediately so they may be handled through our insurance process." },
    { title: "6. Claim Reporting Window",
        body: "Any claim or dispute regarding a completed job must be reported to us in writing within 7 days of job completion. Claims reported after this window may be declined." },
    { title: "7. Service Description & Pricing",
        body: "Quoted prices are based on information provided at booking (load size, property size, distance, etc.). Final pricing may be adjusted on-site if the actual job differs materially from what was described at booking, and you will be notified before any adjusted charge is finalized." },
    { title: "8. Cancellation Policy",
        body: "Cancellation terms vary by job type and timing and are disclosed during booking. Same-day and urgent bookings are generally final and non-refundable once confirmed." },
    { title: "9. Changes to These Terms",
        body: "We may update these Terms of Service from time to time. Continued use of our services after changes are posted constitutes acceptance of the updated terms." },
    { title: "10. Contact",
        body: "Questions about these terms can be directed to " + BUSINESS_EMAIL + " or " + PHONE_NUMBER + "." },
];
// ── PHASE 9: DISPATCH ENHANCEMENTS ──────────────────────────────────
var LANE_HISTORY_KEY = "pl_lanes";
var DEADHEAD_KEY = "pl_deadhead";
function loadLanes() { try {
    var r = localStorage.getItem(LANE_HISTORY_KEY);
    return r ? JSON.parse(r) : [];
}
catch (e) {
    return [];
} }
function saveLanes(l) { try {
    localStorage.setItem(LANE_HISTORY_KEY, JSON.stringify(l.slice(0, 500)));
}
catch (e) { } }
function trackLane(job) {
    if (!job.origin || !job.destination)
        return;
    var lanes = loadLanes();
    var key = job.origin.split(",")[1]?.trim() + "→" + job.destination.split(",")[1]?.trim();
    var existing = lanes.find(function (l) { return l.key === key; });
    if (existing) {
        existing.count++;
        existing.totalRevenue += job.finalPrice;
        existing.lastDate = job.date;
        existing.avgRevenue = Math.round(existing.totalRevenue / existing.count);
    }
    else {
        lanes.unshift({ key, origin: job.origin, destination: job.destination, count: 1, totalRevenue: job.finalPrice, avgRevenue: job.finalPrice, lastDate: job.date });
    }
    saveLanes(lanes);
}
var PAYMENTS = [
    { id: "cash", label: "💵 Cash", sub: "10% discount — due in full at pickup", badge: "BEST DEAL", discount: true },
    { id: "card", label: "💳 Card", sub: "Pay securely online now to confirm booking", badge: null, discount: false },
];
var STATUS_FLOW = ["New", "Pending Quote", "Confirmed", "Assigned", "En Route", "Arrived", "In Progress", "Loading", "In Transit", "Delivered", "Paid", "Completed", "Cancelled"];
var STATUS_COLOR = { "New": "#4299E1", "Pending Quote": "#9F7AEA", "Confirmed": "#4299E1", "Assigned": "#F6AD55", "En Route": "#F0E000", "Arrived": "#F0E000", "In Progress": "#F6AD55", "Loading": "#F6AD55", "In Transit": "#9F7AEA", "Delivered": "#1DB954", "Paid": "#1DB954", "Completed": "#1DB954", "Cancelled": "#E53E3E" };
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
// ─── SCHEDULING & AVAILABILITY ────────────────────────────────────────
var TIME_SLOTS = [
    { id: "morning", label: "Morning", time: "7:00 AM", icon: "🌅", afterHoursOnly: false },
    { id: "midmorning", label: "Mid-Morning", time: "10:00 AM", icon: "🌤", afterHoursOnly: false },
    { id: "afternoon", label: "Afternoon", time: "1:00 PM", icon: "☀️", afterHoursOnly: false },
    { id: "lateafternoon", label: "Late Afternoon", time: "4:00 PM", icon: "🌆", afterHoursOnly: false },
    { id: "afterhours", label: "After-Hours", time: "7:00 PM", icon: "🌙", afterHoursOnly: true },
    { id: "overnight", label: "Overnight Run", time: "10:00 PM", icon: "🌃", afterHoursOnly: true, overnightOnly: true },
];
// How many slots a job blocks based on zone
var SLOT_BLOCKS = {
    local: 1, regional: 2, longdist: 99, oos: 99,
};
var MAX_JOBS_PER_DAY = 3;
// Returns array of slot IDs blocked by a job starting at slotId for given zone
function getSlotsBlocked(slotId, zone) {
    // Overnight runs take the whole night + next day to recover — block everything
    if (slotId === "overnight")
        return TIME_SLOTS.map(function (s) { return s.id; });
    var count = SLOT_BLOCKS[zone] || 1;
    if (count >= 99)
        return TIME_SLOTS.map(function (s) { return s.id; });
    var startIdx = TIME_SLOTS.findIndex(function (s) { return s.id === slotId; });
    if (startIdx < 0)
        return [slotId];
    var blocked = [];
    for (var i = 0; i < count && startIdx + i < TIME_SLOTS.length; i++) {
        blocked.push(TIME_SLOTS[startIdx + i].id);
    }
    return blocked;
}
// Get all dates an OOS job blocks (date + estimated days on road)
function getOOSDatesBlocked(startDate, miles) {
    var days = Math.ceil(miles / 400) + 1; // ~400 miles/day max, +1 buffer day
    var dates = [];
    for (var i = 0; i < days; i++) {
        var d = new Date(startDate);
        d.setDate(d.getDate() + i);
        dates.push(d.toISOString().split("T")[0]);
    }
    return dates;
}
// Check availability for a given date
function getDayAvailability(dateStr, jobs, blockedDates) {
    // Check if date is manually blocked
    if (blockedDates && blockedDates.indexOf(dateStr) > -1) {
        return { available: false, reason: "Unavailable", slots: [], jobCount: 0 };
    }
    // Get confirmed jobs on this date (including OOS multi-day)
    var dayJobs = jobs.filter(function (j) {
        if (j.status === "Cancelled" || j.status === "Completed")
            return false;
        if (j.oosJob && j.oosBlocked) {
            return j.oosBlocked.indexOf(dateStr) > -1;
        }
        return j.date === dateStr;
    });
    if (dayJobs.length >= MAX_JOBS_PER_DAY) {
        return { available: false, reason: "Fully Booked", slots: [], jobCount: dayJobs.length };
    }
    // Figure out which slots are taken
    var takenSlots = [];
    dayJobs.forEach(function (j) {
        if (j.timeSlot) {
            var blocked = getSlotsBlocked(j.timeSlot, j.oosJob ? "oos" : j.zone);
            blocked.forEach(function (s) { if (takenSlots.indexOf(s) < 0)
                takenSlots.push(s); });
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
// Check if a specific slot is available
function isSlotAvailable(dateStr, slotId, zone, jobs, blockedDates) {
    var day = getDayAvailability(dateStr, jobs, blockedDates);
    if (!day.available)
        return false;
    var needed = getSlotsBlocked(slotId, zone);
    var taken = day.takenSlots || [];
    return needed.every(function (s) { return taken.indexOf(s) < 0; });
}
// Get next N available dates from today
function getNextAvailableDates(jobs, blockedDates, count) {
    var results = [];
    var d = new Date();
    var max = 90; // look up to 90 days ahead
    while (results.length < count && max > 0) {
        var ds = d.toISOString().split("T")[0];
        var av = getDayAvailability(ds, jobs, blockedDates);
        if (av.available)
            results.push(ds);
        d.setDate(d.getDate() + 1);
        max--;
    }
    return results;
}
function getCancelPolicy(jobDate, speed) {
    if (speed === "urgent" || speed === "emergency")
        return CANCEL_POLICY[0];
    var hrs = (new Date(jobDate) - new Date()) / (1000 * 60 * 60);
    if (hrs <= 0)
        return CANCEL_POLICY[0];
    if (hrs < 24)
        return CANCEL_POLICY[1];
    if (hrs < 48)
        return CANCEL_POLICY[2];
    return CANCEL_POLICY[3];
}
function loadJobs() { try {
    var r = localStorage.getItem("pl4_jobs");
    return r ? JSON.parse(r) : [];
}
catch (e) {
    return [];
} }
function saveJobs(j) { try {
    localStorage.setItem("pl4_jobs", JSON.stringify(j));
}
catch (e) { } }
function loadAuth() { try {
    return localStorage.getItem("pl3_auth") === "1";
}
catch (e) {
    return false;
} }
function saveAuth(v) { try {
    localStorage.setItem("pl3_auth", v ? "1" : "");
}
catch (e) { } }
function makeJobId() {
    var now = new Date();
    var yy = String(now.getFullYear()).slice(-2);
    var mm = String(now.getMonth() + 1).padStart(2, "0");
    var dd = String(now.getDate()).padStart(2, "0");
    var rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return "PL-" + yy + mm + dd + "-" + rand;
}
function calcFuel(zone, gas, stateAbbr) {
    var zn = ZONES.find(function (z) { return z.id === zone; }) || ZONES[0];
    var ppg = stateAbbr ? getGasForState(stateAbbr) : (gas || FALLBACK_GAS);
    var rt = zn.estMiles * 2;
    var gal = rt / TRUCK_MPG;
    return { miles: zn.estMiles, rt: rt, gal: Math.round(gal * 10) / 10, ppg: ppg, cost: Math.round(gal * ppg), state: stateAbbr || "GA" };
}
async function fetchGasPrice() {
    // Fetches Georgia regular unleaded from EIA (most recent weekly reading)
    // Other states use GAS_BY_STATE table above
    try {
        var res = await fetch("https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=DEMO_KEY&frequency=weekly&data[0]=value&facets[duoarea][]=SGA&facets[product][]=EPM0&sort[0][column]=period&sort[0][direction]=desc&length=1");
        var json = await res.json();
        var d = json && json.response && json.response.data && json.response.data[0];
        var p = d && d.value;
        if (p && p > 2 && p < 7) {
            // Update GA in the table too
            GAS_BY_STATE["GA"] = parseFloat(p);
            return parseFloat(p);
        }
    }
    catch (e) { }
    return FALLBACK_GAS;
}
async function fetchDieselPrice() {
    // Fetches Georgia on-highway diesel from EIA (most recent weekly reading)
    // Other states use DIESEL_BY_STATE table above
    try {
        var res = await fetch("https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=DEMO_KEY&frequency=weekly&data[0]=value&facets[duoarea][]=SGA&facets[product][]=EPD2D&sort[0][column]=period&sort[0][direction]=desc&length=1");
        var json = await res.json();
        var d = json && json.response && json.response.data && json.response.data[0];
        var p = d && d.value;
        if (p && p > 2 && p < 8) {
            DIESEL_BY_STATE["GA"] = parseFloat(p);
            return parseFloat(p);
        }
    }
    catch (e) { }
    return FALLBACK_DIESEL;
}
var WEIGHT_TIERS = [
    { id: "light", label: "Light", sub: "Under 50 lbs — boxes, small furniture", fee: 0 },
    { id: "medium", label: "Medium", sub: "50-150 lbs — couch, dresser, appliance", fee: 50 },
    { id: "heavy", label: "Heavy", sub: "150-300 lbs — large appliance, safe", fee: 100 },
    { id: "piano", label: "Piano-Class", sub: "300+ lbs — piano, pool table, specialty item", fee: 200 },
];
var EXTRA_STOP_FEE = 40;
// ─── OUT-OF-STATE MILEAGE PRICING ─────────────────────────────────────
var OOS_RATE_STANDARD = 6.50;
var OOS_RATE_SAMEDAY = 8.50;
var OOS_MIN_CHARGE = 0;
// ─── ADMIN PRICING TIERS ─────────────────────────────────────────
var PRICE_TIERS = [
    {
        id: "standard",
        label: "💛 Standard",
        sub: "Full rate — all customers",
        color: "#F0E000",
        discountPct: 0,
        oosStandard: 6.50,
        oosSameDay: 8.50,
        badge: null,
    },
    {
        id: "family",
        label: "👨‍👩‍👧 Family / Loyalty",
        sub: "15% off — repeat customers & referrals",
        color: "#4299E1",
        discountPct: 0.15,
        oosStandard: null, // 15% off mileage charge
        oosSameDay: null, // 15% off mileage charge
        badge: "15% OFF",
    },
    {
        id: "lowest",
        label: "🤝 Lowest",
        sub: "20% off — absolute floor, no further negotiation",
        color: "#1DB954",
        discountPct: 0.20,
        oosStandard: 4.50,
        oosSameDay: 6.50,
        badge: "FLOOR PRICE",
    },
];
// Major US city coordinates for distance estimation
// Format: "City, ST": [lat, lng]
var CITY_COORDS = {
    // Georgia (origin cities) — expanded statewide coverage
    "Conyers, GA": [33.6676, -83.9960], "Covington, GA": [33.5968, -83.8602],
    "Atlanta, GA": [33.7490, -84.3880], "Macon, GA": [32.8407, -83.6324],
    "Savannah, GA": [32.0835, -81.0998], "Augusta, GA": [33.4735, -82.0105],
    "Columbus, GA": [32.4610, -84.9877], "Albany, GA": [31.5785, -84.1557],
    "Athens, GA": [33.9519, -83.3576], "Marietta, GA": [33.9526, -84.5499],
    "Roswell, GA": [34.0234, -84.3616], "Sandy Springs, GA": [33.9304, -84.3733],
    "Warner Robins, GA": [32.6130, -83.5996], "Valdosta, GA": [30.8327, -83.2785],
    "Griffin, GA": [33.2467, -84.2640], "Newnan, GA": [33.3807, -84.7997],
    "McDonough, GA": [33.4473, -84.1469], "Stockbridge, GA": [33.5442, -84.2341],
    "Jonesboro, GA": [33.5212, -84.3552], "Fayetteville, GA": [33.4487, -84.4549],
    "Peachtree City, GA": [33.3968, -84.5963], "LaGrange, GA": [33.0379, -85.0316],
    "Carrollton, GA": [33.5801, -85.0766], "Rome, GA": [34.2570, -85.1647],
    "Cartersville, GA": [34.1651, -84.7999], "Calhoun, GA": [34.5023, -84.9510],
    "Dalton, GA": [34.7698, -84.9702], "Gainesville, GA": [34.2979, -83.8241],
    "Cumming, GA": [34.2073, -84.1402], "Lawrenceville, GA": [33.9562, -83.9879],
    "Duluth, GA": [34.0029, -84.1446], "Suwanee, GA": [34.0518, -84.0716],
    "Snellville, GA": [33.8553, -84.0163],
    "Decatur, GA": [33.7748, -84.2963], "Smyrna, GA": [33.8839, -84.5144],
    "Douglasville, GA": [33.7515, -84.7477], "Dallas, GA": [33.9237, -84.8444],
    "Canton, GA": [34.2367, -84.4905], "Woodstock, GA": [34.1015, -84.5194],
    "Kennesaw, GA": [34.0234, -84.6155], "Acworth, GA": [34.0654, -84.6769],
    "Forsyth, GA": [33.0357, -83.9357], "Milledgeville, GA": [33.0801, -83.2321],
    "Dublin, GA": [32.5404, -82.9038], "Statesboro, GA": [32.4488, -81.7832],
    "Vidalia, GA": [32.2176, -82.4135], "Waycross, GA": [31.2136, -82.3540],
    "Brunswick, GA": [31.1499, -81.4915], "St. Marys, GA": [30.7305, -81.5565],
    "Thomasville, GA": [30.8366, -83.9788], "Moultrie, GA": [31.1796, -83.7891],
    "Tifton, GA": [31.4504, -83.5085], "Americus, GA": [32.0723, -84.2327],
    "Cordele, GA": [31.9635, -83.7826], "Fitzgerald, GA": [31.7152, -83.2516],
    "Hinesville, GA": [31.8469, -81.5959], "Jesup, GA": [31.6074, -81.8851],
    "Sylvester, GA": [31.5305, -83.8341], "Bainbridge, GA": [30.9032, -84.5738],
    "Camilla, GA": [31.2349, -84.2202], "Blakely, GA": [31.3788, -84.9341],
    "Toccoa, GA": [34.5773, -83.3324], "Clarkesville, GA": [34.6126, -83.5266],
    "Cornelia, GA": [34.5112, -83.5277], "Jefferson, GA": [34.1132, -83.5749],
    "Monroe, GA": [33.7943, -83.7124], "Madison, GA": [33.5957, -83.4685],
    "Eatonton, GA": [33.3251, -83.3885], "Sandersville, GA": [32.9810, -82.8068],
    "Swainsboro, GA": [32.5934, -82.3338], "Louisville, GA": [33.0029, -82.4071],
    "Washington, GA": [33.7368, -82.7385], "Thomson, GA": [33.4707, -82.5052],
    "Greensboro, GA": [33.5754, -83.1899], "Social Circle, GA": [33.6543, -83.7174],
    "Hartwell, GA": [34.3534, -82.9329], "Elberton, GA": [34.1098, -82.8688],
    "Royston, GA": [34.2862, -83.1158], "Commerce, GA": [34.2090, -83.4574],
    "Winder, GA": [33.9926, -83.7224], "Loganville, GA": [33.8384, -83.9018],
    "Oxford, GA": [33.6151, -83.8624],
    "Locust Grove, GA": [33.3429, -84.1085], "Hampton, GA": [33.3865, -84.2877],
    "Forest Park, GA": [33.6212, -84.3690], "College Park, GA": [33.6529, -84.4496],
    "East Point, GA": [33.6796, -84.4394], "Union City, GA": [33.5862, -84.5424],
    "Fairburn, GA": [33.5662, -84.5849], "Tyrone, GA": [33.3990, -84.5944],
    "Senoia, GA": [33.3015, -84.5563], "Sharpsburg, GA": [33.3868, -84.7385],
    "Zebulon, GA": [33.0982, -84.3416], "Barnesville, GA": [33.0529, -84.1546],
    "Thomaston, GA": [32.8884, -84.3266], "Manchester, GA": [32.8526, -84.6177],
    "Greenville, GA": [33.0190, -84.7158], "Hogansville, GA": [33.1690, -84.9152],
    // Southeast
    "Nashville, TN": [36.1627, -86.7816], "Memphis, TN": [35.1495, -90.0490],
    "Knoxville, TN": [35.9606, -83.9207], "Chattanooga, TN": [35.0456, -85.3097],
    "Birmingham, AL": [33.5186, -86.8104], "Huntsville, AL": [34.7304, -86.5861],
    "Mobile, AL": [30.6954, -88.0399], "Montgomery, AL": [32.3668, -86.2999],
    "Miami, FL": [25.7617, -80.1918], "Orlando, FL": [28.5383, -81.3792],
    "Tampa, FL": [27.9506, -82.4572], "Jacksonville, FL": [30.3322, -81.6557],
    "Tallahassee, FL": [30.4518, -84.2807], "Fort Lauderdale, FL": [26.1224, -80.1373],
    "Charlotte, NC": [35.2271, -80.8431], "Raleigh, NC": [35.7796, -78.6382],
    "Greensboro, NC": [36.0726, -79.7920], "Durham, NC": [35.9940, -78.8986],
    "Columbia, SC": [34.0007, -81.0348], "Charleston, SC": [32.7765, -79.9311],
    "Greenville, SC": [34.8526, -82.3940],
    // Mid-Atlantic
    "Richmond, VA": [37.5407, -77.4360], "Virginia Beach, VA": [36.8529, -75.9780],
    "Norfolk, VA": [36.8508, -76.2859], "Washington, DC": [38.9072, -77.0369],
    "Baltimore, MD": [39.2904, -76.6122], "Philadelphia, PA": [39.9526, -75.1652],
    "New York, NY": [40.7128, -74.0060], "Newark, NJ": [40.7357, -74.1724],
    "Boston, MA": [42.3601, -71.0589], "Hartford, CT": [41.7658, -72.6851],
    // Midwest
    "Chicago, IL": [41.8781, -87.6298], "Columbus, OH": [39.9612, -82.9988],
    "Cleveland, OH": [41.4993, -81.6944], "Cincinnati, OH": [39.1031, -84.5120],
    "Detroit, MI": [42.3314, -83.0458], "Indianapolis, IN": [39.7684, -86.1581],
    "Louisville, KY": [38.2527, -85.7585], "Lexington, KY": [38.0406, -84.5037],
    "St. Louis, MO": [38.6270, -90.1994], "Kansas City, MO": [39.0997, -94.5786],
    "Milwaukee, WI": [43.0389, -87.9065], "Minneapolis, MN": [44.9778, -93.2650],
    // South/Southwest
    "Dallas, TX": [32.7767, -96.7970], "Houston, TX": [29.7604, -95.3698],
    "San Antonio, TX": [29.4241, -98.4936], "Austin, TX": [30.2672, -97.7431],
    "Fort Worth, TX": [32.7555, -97.3308], "El Paso, TX": [31.7619, -106.4850],
    "New Orleans, LA": [29.9511, -90.0715], "Baton Rouge, LA": [30.4515, -91.1871],
    "Little Rock, AR": [34.7465, -92.2896], "Jackson, MS": [32.2988, -90.1848],
    "Oklahoma City, OK": [35.4676, -97.5164], "Tulsa, OK": [36.1540, -95.9928],
    // West
    "Denver, CO": [39.7392, -104.9903], "Colorado Springs, CO": [38.8339, -104.8214],
    "Phoenix, AZ": [33.4484, -112.0740], "Tucson, AZ": [32.2226, -110.9747],
    "Las Vegas, NV": [36.1699, -115.1398], "Los Angeles, CA": [34.0522, -118.2437],
    "San Diego, CA": [32.7157, -117.1611], "San Francisco, CA": [37.7749, -122.4194],
    "Sacramento, CA": [38.5816, -121.4944], "Portland, OR": [45.5051, -122.6750],
    "Seattle, WA": [47.6062, -122.3321], "Salt Lake City, UT": [40.7608, -111.8910],
    "Albuquerque, NM": [35.0844, -106.6504], "Boise, ID": [43.6150, -116.2023],
    // Northeast
    "Pittsburgh, PA": [40.4406, -79.9959], "Buffalo, NY": [42.8864, -78.8784],
    "Albany, NY": [42.6526, -73.7562], "Providence, RI": [41.8240, -71.4128],
    "Portland, ME": [43.6591, -70.2568], "Manchester, NH": [42.9956, -71.4548],
};
// Haversine distance in miles between two [lat,lng] points
function haversine(a, b) {
    var R = 3958.8;
    var dLat = (b[0] - a[0]) * Math.PI / 180;
    var dLon = (b[1] - a[1]) * Math.PI / 180;
    var lat1 = a[0] * Math.PI / 180;
    var lat2 = b[0] * Math.PI / 180;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}
// Road distance estimate: straight-line * 1.25 factor (accounts for roads)
function estimateMiles(originCity, destCity) {
    var a = CITY_COORDS[originCity];
    var b = CITY_COORDS[destCity];
    if (!a || !b)
        return null;
    return Math.round(haversine(a, b) * 1.25);
}
// Real address-to-coordinates lookup via our serverless function,
// which calls the US Census Bureau's free geocoder (US addresses only, no API key, no limits).
function geocodeAddress(address) {
    if (!address || address.trim().length < 5)
        return Promise.resolve(null);
    return fetch("/.netlify/functions/geocode?address=" + encodeURIComponent(address))
        .then(function (res) { return res.json(); })
        .then(function (data) {
        if (!data || !data.found)
            return null;
        return [data.lat, data.lon];
    })
        .catch(function () { return null; });
}
function calcRealMilesFromAddresses(originAddress, destAddress) {
    return Promise.all([geocodeAddress(originAddress), geocodeAddress(destAddress)])
        .then(function (results) {
        var a = results[0];
        var b = results[1];
        if (!a || !b)
            return null;
        return Math.round(haversine(a, b) * 1.25);
    });
}
function getStateFromCity(cityStr) {
    // Extract 2-letter state from "City, ST" format
    if (!cityStr)
        return null;
    var parts = cityStr.split(",");
    if (parts.length < 2)
        return null;
    return parts[parts.length - 1].trim().toUpperCase().substring(0, 2);
}
function calcOOSQuote(originCity, destCity, speed, helper, weightTier, priceTierId) {
    var miles = estimateMiles(originCity, destCity);
    if (!miles)
        return null;
    var tier = PRICE_TIERS.find(function (t) { return t.id === priceTierId; }) || PRICE_TIERS[0];
    var isSameDay = (speed === "urgent" || speed === "emergency");
    // Rate: use tier's floor rate if set, otherwise apply % discount to standard rate
    var stdRate = isSameDay ? OOS_RATE_SAMEDAY : OOS_RATE_STANDARD;
    var tierRate = isSameDay
        ? (tier.oosSameDay !== null ? tier.oosSameDay : stdRate * (1 - tier.discountPct))
        : (tier.oosStandard !== null ? tier.oosStandard : stdRate * (1 - tier.discountPct));
    var rate = Math.round(tierRate * 100) / 100;
    var mileageCharge = Math.round(miles * rate);
    var helperFee = helper ? HELPER_FEE : 0;
    var wTier = WEIGHT_TIERS.find(function (w) { return w.id === weightTier; }) || WEIGHT_TIERS[0];
    var weightFee = wTier.fee;
    var subtotal = mileageCharge + helperFee + weightFee;
    // Fuel cost uses destination state gas price (buying fuel near destination)
    var destState = getStateFromCity(destCity);
    var ppg = getGasForState(destState);
    var fuelGal = Math.round((miles / TRUCK_MPG) * 10) / 10;
    var fuelCost = Math.round(fuelGal * ppg);
    var isSameDay = (speed === "urgent" || speed === "emergency");
    return { miles: miles, rate: rate, mileageCharge: mileageCharge, helperFee: helperFee,
        weightFee: weightFee, weightTier: wTier, subtotal: subtotal, total: subtotal,
        tier: tier, stdRate: stdRate, isSameDay: isSameDay, hitMinimum: false,
        destState: destState || "?", ppg: ppg, fuelGal: fuelGal, fuelCost: fuelCost,
        netProfit: subtotal - fuelCost };
}
// Services priced by real distance instead of a fixed zone table
var MILEAGE_SERVICES = ["delivery", "event"];
var INSTATE_RATE_PER_MILE = 4.50;
function calcQuote(serviceId, zone, speed, payId, helper, discreet, weightTier, extraStop, miles, priceTierId) {
    var svc = SERVICES.find(function (s) { return s.id === serviceId; }) || SERVICES[0];
    var zn = ZONES.find(function (z) { return z.id === zone; }) || ZONES[0];
    var spd = SPEEDS.find(function (s) { return s.id === speed; }) || SPEEDS[0];
    var pay = PAYMENTS.find(function (p) { return p.id === payId; }) || PAYMENTS[0];
    var tier = PRICE_TIERS.find(function (t) { return t.id === priceTierId; }) || PRICE_TIERS[0];
    var isMileage = MILEAGE_SERVICES.indexOf(serviceId) > -1;
    var base;
    if (isMileage) {
        base = Math.round((miles || 0) * INSTATE_RATE_PER_MILE);
    }
    else {
        var tbl = PRICE_TABLE[serviceId] || PRICE_TABLE.delivery;
        base = tbl[zone] || tbl.local || 300;
    }
    var speedFee = Math.round(base * (spd.mult - 1));
    var helperFee = helper ? HELPER_FEE : 0;
    var wTier = WEIGHT_TIERS.find(function (w) { return w.id === weightTier; }) || WEIGHT_TIERS[0];
    var weightFee = wTier.fee;
    var extraStopFee = extraStop ? EXTRA_STOP_FEE : 0;
    var discreetFee = discreet ? Math.round(base * 0.35) : 0;
    var rawSubtotal = base + speedFee + helperFee + weightFee + extraStopFee + discreetFee;
    var tierDisc = tier.discountPct > 0 ? Math.round(rawSubtotal * tier.discountPct) : 0;
    var subtotal = rawSubtotal - tierDisc;
    var cashDisc = pay.discount ? Math.round(subtotal * 0.10) : 0;
    var total = subtotal - cashDisc;
    return { base: base, speedFee: speedFee, helperFee: helperFee, weightFee: weightFee, weightTier: wTier,
        extraStopFee: extraStopFee, discreetFee: discreetFee, rawSubtotal: rawSubtotal,
        tierDisc: tierDisc, tier: tier, subtotal: subtotal, cashDisc: cashDisc, total: total,
        spd: spd, zn: zn, svc: svc, pay: pay, isMileage: isMileage, miles: miles || 0 };
}
// ── JUNK REMOVAL QUOTE — simple load-size pricing, no zones/mileage involved ──
function calcJunkRemovalQuote(loadSizeId, payId, emergencyAddonIds) {
    var load = LOAD_SIZES.find(function (l) { return l.id === loadSizeId; }) || LOAD_SIZES[0];
    var pay = PAYMENTS.find(function (p) { return p.id === payId; }) || PAYMENTS[0];
    var addonFees = (emergencyAddonIds || []).reduce(function (sum, id) {
        var a = EMERGENCY_ADDONS.find(function (e) { return e.id === id; });
        return sum + (a ? a.fee : 0);
    }, 0);
    var subtotal = load.price + addonFees;
    var cashDisc = pay.discount ? Math.round(subtotal * 0.10) : 0;
    var total = subtotal - cashDisc;
    return { base: load.price, load: load, addonFees: addonFees, subtotal: subtotal, cashDisc: cashDisc, total: total, pay: pay };
}
// ── PROPERTY CLEANOUT QUOTE — starting estimate only; commercial/hoarder route to custom quote ──
function calcCleanoutQuote(tierId, payId, extraTruckloads) {
    var tier = CLEANOUT_TIERS.find(function (t) { return t.id === tierId; }) || CLEANOUT_TIERS[0];
    var pay = PAYMENTS.find(function (p) { return p.id === payId; }) || PAYMENTS[0];
    var isCustomQuote = tier.startPrice === 0;
    var extraFee = (Number(extraTruckloads) || 0) * EXTRA_TRUCKLOAD_FEE;
    var subtotal = tier.startPrice + extraFee;
    var cashDisc = (pay.discount && subtotal > 0) ? Math.round(subtotal * 0.10) : 0;
    var total = subtotal - cashDisc;
    return { base: tier.startPrice, tier: tier, extraFee: extraFee, subtotal: subtotal, cashDisc: cashDisc, total: total, pay: pay, isCustomQuote: isCustomQuote };
}
function sendEmail(job) {
    try {
        var params = { to_email: BUSINESS_EMAIL, job_id: job.id, customer: job.customer, phone: job.phone,
            service: job.serviceName, origin: job.origin, destination: job.destination,
            total: "$" + job.finalPrice, payment: job.payment, date: job.date, notes: job.notes || "None" };
        fetch("https://api.emailjs.com/api/v1.0/email/send", { method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ service_id: "service_e3qn0bs", template_id: "template_nxubdce", user_id: "6Qs0HIOLjJ6jfWHtp",
                template_params: params }) });
    }
    catch (e) { }
}
// ── LEAD EMAIL AUTOMATION — EmailJS ─────────────────────────────────
// Reuses the same EmailJS service/template already wired for booking
// confirmations. We tell it which "email_type" this is and pass the
// subject/body text pre-built here, so template_nxubdce just needs to
// render {{subject}} and {{message_html}} (or your own field names —
// see note at bottom of this function).
var LEAD_EMAIL_TEMPLATES = {
    intro: {
        label: "👋 Intro Email",
        subject: function (lead) { return "Quick question about " + (lead.category ? lead.category.replace(/^[^\w]+/, "").trim() : "your business") + " logistics"; },
        body: function (lead) {
            return "Hi " + (lead.name || "there") + ",\n\n" +
                "I'm reaching out from POTENT Logistics — we handle same-day and scheduled freight, delivery, and moving jobs" + (lead.city ? " around " + lead.city : "") + ".\n\n" +
                (lead.notes ? "I know " + lead.notes.toLowerCase() + " can be a headache, and " : "") +
                "we built our whole operation around fast, reliable pickup and delivery with live tracking so you always know where your load is.\n\n" +
                "Would it be worth a quick 5-minute call this week to see if we're a fit for " + (lead.name || "your team") + "?\n\n" +
                "Best,\nPOTENT Logistics\n" + PHONE_DISPLAY;
        }
    },
    follow_up: {
        label: "🔁 Follow-Up Email",
        subject: function (lead) { return "Following up — POTENT Logistics"; },
        body: function (lead) {
            return "Hi " + (lead.name || "there") + ",\n\n" +
                "Just following up on my last message — wanted to see if you had a chance to think about how POTENT Logistics could help with your delivery/freight needs" + (lead.city ? " in " + lead.city : "") + ".\n\n" +
                "Happy to answer any questions or put together a quick quote — no pressure either way.\n\n" +
                "Best,\nPOTENT Logistics\n" + PHONE_DISPLAY;
        }
    },
    quote: {
        label: "💰 Quote Delivery Email",
        subject: function (lead) { return "Your quote from POTENT Logistics"; },
        body: function (lead) {
            return "Hi " + (lead.name || "there") + ",\n\n" +
                "Thanks for your interest! Here's a summary of what we discussed:\n\n" +
                (lead.service_type ? "Needs: " + lead.service_type + "\n" : "") +
                "\nWe'll follow up shortly to lock in details and get you scheduled. If you have any questions in the meantime, just reply to this email or call us at " + PHONE_DISPLAY + ".\n\n" +
                "Best,\nPOTENT Logistics";
        }
    },
};
function sendLeadEmail(lead, templateKey, senderName) {
    var tpl = LEAD_EMAIL_TEMPLATES[templateKey];
    if (!tpl || !lead || !lead.email) {
        return Promise.reject(new Error("Missing template or lead has no email on file."));
    }
    var subject = tpl.subject(lead);
    var body = tpl.body(lead);
    var params = {
        to_email: lead.email,
        to_name: lead.name || "",
        subject: subject,
        message: body,
        message_html: body.replace(/\n/g, "<br>"),
        from_name: senderName || "POTENT Logistics",
        reply_to: BUSINESS_EMAIL,
    };
    // NOTE: template_nxubdce needs a "To Email" field mapped to {{to_email}}
    // and a body that renders {{subject}} / {{message}} (or {{message_html}}).
    // If your EmailJS template uses different variable names, adjust the
    // `params` object above — the fetch call itself never needs to change.
    return fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_id: "service_e3qn0bs", template_id: "template_nxubdce", user_id: "6Qs0HIOLjJ6jfWHtp", template_params: params })
    });
}
// ── CUSTOMER ETA ALERT — "your truck is close" email ────────────────
// Reuses the same EmailJS service already wired up for lead outreach.
// Sent once per job when the live-tracked truck comes within
// ETA_ALERT_MILES of the destination — a simple straight-line distance
// check (same haversine function used for job pricing), not a real
// routing ETA, so the "close" threshold is intentionally generous.
var ETA_ALERT_MILES = 3;
function sendETAAlert(job) {
    if (!job || !job.email)
        return Promise.reject(new Error("No email on file for this job."));
    var subject = "Your POTENT Logistics truck is almost there!";
    var body = "Hi " + (job.customer || "there") + ",\n\n" +
        "Good news \u2014 your driver is getting close to " + (job.destination || "your delivery address") + ".\n\n" +
        "Job ID: " + job.id + "\n\n" +
        "If you have any last-minute access instructions (gate code, parking, etc.), reply to this email or call us at " + PHONE_DISPLAY + ".\n\n" +
        "Best,\nPOTENT Logistics";
    var params = {
        to_email: job.email, to_name: job.customer || "",
        subject: subject, message: body, message_html: body.replace(/\n/g, "<br>"),
        from_name: "POTENT Logistics", reply_to: BUSINESS_EMAIL,
    };
    return fetch("https://api.emailjs.com/api/v1.0/email/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ service_id: "service_e3qn0bs", template_id: "template_nxubdce", user_id: "6Qs0HIOLjJ6jfWHtp", template_params: params })
    });
}
// ── SHARED UI ─────────────────────────────────────────────────────
function Tag(props) {
    var color = props.color || "#F0E000";
    return React.createElement("span", { style: { background: color + "22", color: color, border: "1px solid " + color + "40", borderRadius: 5, padding: "2px 9px", fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" } }, props.children);
}
function Card(props) {
    return React.createElement("div", { onClick: props.onClick, style: Object.assign({ background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "18px 20px" }, props.style || {}) }, props.children);
}
function Btn(props) {
    var v = props.variant || "primary";
    var bg = v === "ghost" ? "transparent" : v === "muted" ? C.border : v === "danger" ? "#E53E3E" : C.orange;
    var col = v === "primary" ? "#000" : v === "ghost" ? C.orange : C.white;
    var brd = v === "ghost" ? "1.5px solid " + C.orange : "none";
    return React.createElement("button", { onClick: props.onClick, disabled: props.disabled || false, style: Object.assign({ background: bg, color: col, border: brd, borderRadius: 9, padding: "11px 20px", fontSize: 13, fontWeight: 700, cursor: props.disabled ? "not-allowed" : "pointer", opacity: props.disabled ? 0.45 : 1, fontFamily: "inherit" }, props.style || {}) }, props.children);
}
function Lbl(props) { return React.createElement("div", { style: { color: C.dim, fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 7 } }, props.children); }
function TxtIn(props) {
    var s = { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
    var field = props.rows
        ? React.createElement("textarea", { value: props.value, onChange: function (e) { props.onChange(e.target.value); }, placeholder: props.placeholder, rows: props.rows, style: Object.assign({}, s, { resize: "vertical" }) })
        : React.createElement("input", { type: props.type || "text", value: props.value, onChange: function (e) { props.onChange(e.target.value); }, placeholder: props.placeholder, style: s });
    return React.createElement("div", { style: { marginBottom: 14 } },
        props.label && React.createElement(Lbl, null, props.label),
        props.voice
            ? React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "flex-start" } },
                React.createElement("div", { style: { flex: 1 } }, field),
                React.createElement(VoiceMicButton, { currentValue: props.value, onTranscript: props.onChange, size: "sm" }))
            : field);
}
function Sel(props) {
    return React.createElement("div", { style: { marginBottom: 14 } },
        props.label && React.createElement(Lbl, null, props.label),
        React.createElement("select", { value: props.value, onChange: function (e) { props.onChange(e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", cursor: "pointer" } }, props.options.map(function (o) {
            var val = (o && o.id) || o;
            var display = (o && (o.label || o.name)) || o;
            return React.createElement("option", { key: val, value: val }, display);
        })));
}
// ── VOICE-TO-TEXT MIC BUTTON — dictate into any text field ──────────
// Single-shot dictation (not continuous like Driver App voice commands):
// tap, speak, tap again or pause, and the transcribed text gets appended
// to whatever value the field currently has. Uses the same free browser
// Web Speech API as the Driver App — no server calls, no per-use cost.
function VoiceMicButton(props) {
    // props: currentValue (string), onTranscript(newFullValue), size ("sm"|"md")
    var [listening, setListening] = useState(false);
    var [supported, setSupported] = useState(true);
    var recognitionRef = useRef(null);
    useEffect(function () {
        var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            setSupported(false);
        }
        return function () {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
            }
        };
    }, []);
    function toggleListening() {
        var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec)
            return;
        if (listening) {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
            }
            setListening(false);
            return;
        }
        var recognition = new SpeechRec();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";
        recognition.onresult = function (event) {
            var transcript = event.results[0][0].transcript;
            var current = props.currentValue || "";
            var joined = current && !current.endsWith(" ") && !current.endsWith("\n") ? current + " " + transcript : current + transcript;
            props.onTranscript(joined);
        };
        recognition.onerror = function () { setListening(false); };
        recognition.onend = function () { setListening(false); };
        recognitionRef.current = recognition;
        setListening(true);
        try {
            recognition.start();
        }
        catch (e) { setListening(false); }
    }
    if (!supported)
        return null; // silently hide on unsupported browsers rather than clutter the UI
    var sz = props.size === "sm" ? 28 : 34;
    return React.createElement("button", { type: "button", onClick: toggleListening, title: listening ? "Stop dictating" : "Tap to dictate", style: { width: sz, height: sz, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: listening ? C.red : C.orange, color: listening ? "#fff" : "#000", fontSize: sz === 28 ? 13 : 15, animation: listening ? "pulse 1.2s infinite" : "none" } }, "\uD83C\uDF99\uFE0F");
}
function Toggle(props) {
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
        })),
        React.createElement("div", { style: { fontSize: 10, color: C.faint, marginTop: 6, lineHeight: 1.6 } }, "Weight classifications are estimates based on the heaviest individual item. Final pricing may change if actual items differ from submitted details."));
}
// ── NET 7 PARTNER ACCOUNT APPLICATION ─────────────────────────────
var PARTNER_ACCOUNT_TYPES = [
    { id: "property_mgmt", label: "Property Management Company" },
    { id: "realtor", label: "Realtor / Real Estate Investor" },
    { id: "contractor", label: "Contractor / Construction Company" },
    { id: "school", label: "School / Educational Institution" },
    { id: "government", label: "Government / Military" },
    { id: "warehouse", label: "Warehouse / Distribution Center" },
    { id: "senior_living", label: "Senior Living / Assisted Living" },
    { id: "other_business", label: "Other Business" },
];
var MONTHLY_VOLUME_OPTIONS = [
    { id: "1_5k", label: "$1,000 – $5,000/month" },
    { id: "5_10k", label: "$5,000 – $10,000/month" },
    { id: "10_25k", label: "$10,000 – $25,000/month" },
    { id: "25k_plus", label: "$25,000+/month" },
];
function PartnerApplicationModal(props) {
    var [f, setF] = useState({ companyName: "", contactPerson: "", title: "", phone: "", email: "", businessAddress: "", businessType: "property_mgmt", monthlyVolume: "1_5k", services: [], paymentTerms: "net7", billingEmail: "", notes: "", agreeToTerms: false });
    var [sent, setSent] = useState(false);
    var [step, setStep] = useState(1);
    function set(k, v) { setF(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); }
    function toggleService(s) { setF(function (p) { var n = Object.assign({}, p); var list = p.services.slice(); var i = list.indexOf(s); if (i > -1)
        list.splice(i, 1);
    else
        list.push(s); n.services = list; return n; }); }
    function submit() {
        if (!f.companyName || !f.contactPerson || !f.phone || !f.email || !f.agreeToTerms)
            return;
        sendEmail({ id: "PARTNER-" + Date.now(), customer: f.contactPerson, phone: f.phone,
            serviceName: "NET 7 PARTNER ACCOUNT APPLICATION",
            origin: f.businessAddress, destination: "", finalPrice: 0, payment: "net7",
            date: new Date().toISOString().split("T")[0],
            notes: "Company: " + f.companyName + " | Type: " + f.businessType + " | Volume: " + f.monthlyVolume + " | Services: " + f.services.join(", ") + " | Billing Email: " + f.billingEmail + " | Notes: " + f.notes + " | Email: " + f.email
        });
        setSent(true);
    }
    return React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
            props.onClose(); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000DD", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
        React.createElement("div", { style: { background: C.card, borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
            React.createElement("div", { style: { background: "linear-gradient(135deg,#1a1a1a,#0d0d0d)", borderRadius: "14px 14px 0 0", padding: "20px 22px", borderBottom: "2px solid " + C.orange } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: C.white } }, "\uD83E\uDD1D Partner Account Application"),
                        React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2 } }, "Net 7 billing \u2014 pay 7 days after service")),
                    React.createElement("button", { onClick: props.onClose, style: { background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer" } }, "\u2715"))),
            sent ? React.createElement("div", { style: { padding: "32px 24px", textAlign: "center" } },
                React.createElement("div", { style: { fontSize: 48, marginBottom: 16 } }, "\uD83C\uDF89"),
                React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: C.white, marginBottom: 8 } }, "Application Submitted!"),
                React.createElement("div", { style: { fontSize: 13, color: C.dim, marginBottom: 6, lineHeight: 1.7 } },
                    "We've received your partner account application for ",
                    React.createElement("strong", { style: { color: C.orange } }, f.companyName),
                    "."),
                React.createElement("div", { style: { fontSize: 13, color: C.dim, marginBottom: 24, lineHeight: 1.7 } }, "Our team will review your application and contact you within 1-2 business days to discuss your Net 7 account and service agreement."),
                React.createElement("div", { style: { background: C.surface, borderRadius: 10, padding: "14px", marginBottom: 20, textAlign: "left", fontSize: 12, color: C.dim, lineHeight: 1.8 } },
                    React.createElement("div", { style: { fontWeight: 700, color: C.white, marginBottom: 6 } }, "What happens next:"),
                    React.createElement("div", null, "1. Our team reviews your application"),
                    React.createElement("div", null, "2. We call to verify your business details"),
                    React.createElement("div", null, "3. You sign a service agreement"),
                    React.createElement("div", null, "4. Your Net 7 account is activated"),
                    React.createElement("div", null, "5. You receive a dedicated account number for billing")),
                React.createElement(Btn, { onClick: props.onClose, style: { width: "100%" } }, "Close")) : React.createElement("div", { style: { padding: "20px 22px" } },
                step === 1 && React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.orange, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 } }, "Step 1 of 2 \u2014 Company Information"),
                    React.createElement(TxtIn, { label: "Company Name *", value: f.companyName, onChange: function (v) { set("companyName", v); }, placeholder: "Your company name" }),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                        React.createElement(TxtIn, { label: "Contact Person *", value: f.contactPerson, onChange: function (v) { set("contactPerson", v); }, placeholder: "Full name" }),
                        React.createElement(TxtIn, { label: "Title / Position", value: f.title, onChange: function (v) { set("title", v); }, placeholder: "e.g. Operations Manager" })),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                        React.createElement(TxtIn, { label: "Phone *", value: f.phone, onChange: function (v) { set("phone", v); }, type: "tel", placeholder: "404-000-0000" }),
                        React.createElement(TxtIn, { label: "Email *", value: f.email, onChange: function (v) { set("email", v); }, type: "email", placeholder: "you@company.com" })),
                    React.createElement(TxtIn, { label: "Business Address", value: f.businessAddress, onChange: function (v) { set("businessAddress", v); }, placeholder: "123 Business Blvd, Atlanta, GA" }),
                    React.createElement(Lbl, null, "Business Type *"),
                    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 } }, PARTNER_ACCOUNT_TYPES.map(function (t) {
                        return React.createElement("div", { key: t.id, onClick: function () { set("businessType", t.id); }, style: { border: "1.5px solid " + (f.businessType === t.id ? C.orange : C.border), borderRadius: 8, padding: "9px 12px", cursor: "pointer", background: f.businessType === t.id ? C.orangeSoft : "transparent", fontSize: 12, fontWeight: 600, color: f.businessType === t.id ? C.orange : C.white } }, t.label);
                    })),
                    React.createElement(Btn, { onClick: function () { setStep(2); }, disabled: !f.companyName || !f.contactPerson || !f.phone || !f.email, style: { width: "100%" } }, "Continue \u2192")),
                step === 2 && React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.orange, letterSpacing: 1, textTransform: "uppercase", marginBottom: 16 } }, "Step 2 of 2 \u2014 Services & Billing"),
                    React.createElement(Lbl, null, "Estimated Monthly Service Volume"),
                    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 } }, MONTHLY_VOLUME_OPTIONS.map(function (v) {
                        return React.createElement("div", { key: v.id, onClick: function () { set("monthlyVolume", v.id); }, style: { border: "1.5px solid " + (f.monthlyVolume === v.id ? C.orange : C.border), borderRadius: 8, padding: "9px 12px", cursor: "pointer", background: f.monthlyVolume === v.id ? C.orangeSoft : "transparent", fontSize: 12, fontWeight: 600, color: f.monthlyVolume === v.id ? C.orange : C.white } }, v.label);
                    })),
                    React.createElement(Lbl, null, "Services You Need (select all that apply)"),
                    React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 } }, ["Courier & Delivery", "Freight Transport", "Junk Removal", "Property Cleanouts", "Demolition Debris", "Emergency Services"].map(function (s) {
                        var on = f.services.indexOf(s) > -1;
                        return React.createElement("div", { key: s, onClick: function () { toggleService(s); }, style: { border: "1px solid " + (on ? C.orange : C.border), borderRadius: 7, padding: "6px 11px", cursor: "pointer", background: on ? C.orangeSoft : "transparent", fontSize: 11, fontWeight: 600, color: on ? C.orange : C.dim } }, s);
                    })),
                    React.createElement(TxtIn, { label: "Billing Email (for invoices)", value: f.billingEmail, onChange: function (v) { set("billingEmail", v); }, type: "email", placeholder: "billing@company.com" }),
                    React.createElement(TxtIn, { label: "Notes / Special Requirements", value: f.notes, onChange: function (v) { set("notes", v); }, placeholder: "Recurring routes, special scheduling needs, volume discounts...", rows: 2 }),
                    React.createElement("div", { style: { background: "#4299E115", border: "1px solid #4299E133", borderRadius: 9, padding: "12px 14px", marginBottom: 14 } },
                        React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "#4299E1", marginBottom: 6 } }, "\uD83D\uDCB3 Net 7 Payment Terms"),
                        React.createElement("div", { style: { fontSize: 11, color: C.dim, lineHeight: 1.7 } }, "Invoices are issued after each job is completed. Payment is due within 7 days of invoice date. Accounts more than 14 days past due revert to cash-on-delivery until balance is cleared. Net 7 approval is subject to credit review and execution of a service agreement.")),
                    React.createElement("div", { style: { display: "flex", alignItems: "flex-start", gap: 10, background: C.surface, border: "1px solid " + C.border, borderRadius: 9, padding: "12px 14px", marginBottom: 14 } },
                        React.createElement("div", { onClick: function () { set("agreeToTerms", !f.agreeToTerms); }, style: { width: 20, height: 20, borderRadius: 5, background: f.agreeToTerms ? C.orange : "transparent", border: "1.5px solid " + (f.agreeToTerms ? C.orange : C.border), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#000", fontWeight: 800, flexShrink: 0, marginTop: 1, cursor: "pointer" } }, f.agreeToTerms ? "✓" : ""),
                        React.createElement("div", { style: { fontSize: 11, color: C.dim, lineHeight: 1.6 } }, "I confirm this information is accurate and I understand that Net 7 account activation requires approval and a signed service agreement with Potent Logistics LLC.")),
                    React.createElement("div", { style: { display: "flex", gap: 8 } },
                        React.createElement(Btn, { variant: "ghost", onClick: function () { setStep(1); }, style: { flex: 1 } }, "\u2190 Back"),
                        React.createElement(Btn, { onClick: submit, disabled: !f.agreeToTerms || f.services.length === 0, style: { flex: 2 } }, "Submit Application \uD83E\uDD1D"))))));
}
function TrustSection() {
    return React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: "16px 18px", marginBottom: 16 } },
        React.createElement("div", { style: { fontSize: 12, fontWeight: 800, color: C.white, marginBottom: 10, textAlign: "center", letterSpacing: 1 } }, "WHY CHOOSE POTENT LOGISTICS"),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } }, ["Instant Online Quotes", "Transparent Pricing", "Commercially Insured", "DOT Registered", "24/7 Availability", "Professional Communication", "Secure Transportation", "Direct Service — No Middleman"].map(function (item) {
            return React.createElement("div", { key: item, style: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: C.dim } },
                React.createElement("span", { style: { color: C.green, fontWeight: 700, flexShrink: 0 } }, "\u2713"),
                item);
        })));
}
function CustomQuoteModal(props) {
    var [f, setF] = useState({ name: "", phone: "", email: "", description: "", jobType: "large_commercial" });
    var [sent, setSent] = useState(false);
    function set(k, v) { setF(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); }
    function submit() {
        if (!f.name || !f.phone || !f.description)
            return;
        sendEmail({ id: "CQ-" + Date.now(), customer: f.name, phone: f.phone, serviceName: "CUSTOM QUOTE REQUEST",
            origin: f.description, destination: "", finalPrice: 0, payment: "tbd", date: new Date().toISOString().split("T")[0],
            notes: "Email: " + f.email + " | Type: " + f.jobType + " | Details: " + f.description });
        setSent(true);
    }
    return React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
            props.onClose(); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000CC", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
        React.createElement("div", { style: { background: C.card, borderRadius: 14, padding: "24px 20px", width: "100%", maxWidth: 500, fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
                React.createElement("div", { style: { fontSize: 17, fontWeight: 800, color: C.white } }, "Request Custom Quote"),
                React.createElement("button", { onClick: props.onClose, style: { background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer" } }, "\u2715")),
            sent ? React.createElement("div", { style: { textAlign: "center", padding: "20px 0" } },
                React.createElement("div", { style: { fontSize: 40, marginBottom: 12 } }, "\uD83D\uDCCB"),
                React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: C.white, marginBottom: 8 } }, "Request Received!"),
                React.createElement("div", { style: { fontSize: 13, color: C.dim, marginBottom: 20 } }, "We'll contact you within 2 hours to discuss your project."),
                React.createElement(Btn, { onClick: props.onClose, style: { width: "100%" } }, "Close")) : React.createElement("div", null,
                React.createElement("div", { style: { background: C.surface, borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.dim, lineHeight: 1.6 } }, "For: large commercial projects \u00B7 multiple truckloads \u00B7 specialty items \u00B7 unusual access \u00B7 recurring business routes"),
                React.createElement(TxtIn, { label: t("yourName"), value: f.name, onChange: function (v) { set("name", v); }, placeholder: "Full name" }),
                React.createElement(TxtIn, { label: t("phone"), value: f.phone, onChange: function (v) { set("phone", v); }, type: "tel", placeholder: "404-000-0000" }),
                React.createElement(TxtIn, { label: "Email", value: f.email, onChange: function (v) { set("email", v); }, type: "email", placeholder: "your@email.com" }),
                React.createElement(Lbl, null, "Project Type"),
                React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 } }, [["large_commercial", "Large Commercial Project"], ["multi_truck", "Multiple Truckloads"], ["specialty", "Specialty Items"], ["recurring", "Recurring Business Route"], ["other", "Other / Unusual Requirements"]].map(function (opt) {
                    return React.createElement("div", { key: opt[0], onClick: function () { set("jobType", opt[0]); }, style: { border: "1.5px solid " + (f.jobType === opt[0] ? C.orange : C.border), borderRadius: 8, padding: "9px 12px", cursor: "pointer", background: f.jobType === opt[0] ? C.orangeSoft : "transparent", fontSize: 12, fontWeight: 600, color: f.jobType === opt[0] ? C.orange : C.white } }, opt[1]);
                })),
                React.createElement(TxtIn, { label: "Project Description", value: f.description, onChange: function (v) { set("description", v); }, placeholder: "Describe your project, location, timeline, and any special requirements...", rows: 3 }),
                React.createElement(Btn, { onClick: submit, disabled: !f.name || !f.phone || !f.description, style: { width: "100%" } }, "Submit Custom Quote Request"))));
}
// ─── STRIPE PAYMENT ───────────────────────────────────────────────
// TEST KEY for now — swap to live key (pk_live_...) once ready to take real payments.
var STRIPE_PUBLISHABLE_KEY = "pk_live_51RYvZCDw93YFbYhIoSZPUDge7a6BSkontrdV8dpSYCcD8rt0F99oC0LDbxtGgDfLeWnF3qYwb12mwUVxwSXV5Yif00jmoIT2gC";
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
function TermsOfServiceModal(props) {
    return React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
            props.onClose(); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000CC", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
        React.createElement("div", { style: { background: C.card, borderRadius: 14, padding: "24px 22px", width: "100%", maxWidth: 560, maxHeight: "85vh", overflowY: "auto", fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: C.white } }, "Terms of Service"),
                React.createElement("button", { onClick: props.onClose, style: { background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer" } }, "\u2715")),
            React.createElement("div", { style: { fontSize: 11, color: C.faint, marginBottom: 18 } }, "© 2026 ANTHONY EMMANUEL FIGUEROA MENDES® · POTENT PRÄDƏKT® · Version " + TOS_VERSION),
            TOS_SECTIONS.map(function (s) {
                return React.createElement("div", { key: s.title, style: { marginBottom: 16 } },
                    React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.orange, marginBottom: 4 } }, s.title),
                    React.createElement("div", { style: { fontSize: 12, color: C.dim, lineHeight: 1.7 } }, s.body));
            }),
            React.createElement(Btn, { onClick: props.onClose, style: { width: "100%", marginTop: 6 } }, "Close")));
}
function TosCheckbox(props) {
    var [showTos, setShowTos] = useState(false);
    return React.createElement("div", { style: { marginBottom: 14 } },
        showTos && React.createElement(TermsOfServiceModal, { onClose: function () { setShowTos(false); } }),
        React.createElement("div", { style: { display: "flex", alignItems: "flex-start", gap: 10, background: C.surface, border: "1px solid " + C.border, borderRadius: 9, padding: "12px 14px" } },
            React.createElement("div", { onClick: function () { props.onChange(!props.value); }, style: { width: 20, height: 20, borderRadius: 5, background: props.value ? C.orange : "transparent", border: "1.5px solid " + (props.value ? C.orange : C.border), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, color: "#000", fontWeight: 800, flexShrink: 0, marginTop: 1, cursor: "pointer" } }, props.value ? "✓" : ""),
            React.createElement("div", { style: { fontSize: 12, color: C.dim, lineHeight: 1.6 } },
                "I confirm that my job details are accurate and I agree to the POTENT LOGISTICS ",
                React.createElement("span", { onClick: function () { setShowTos(true); }, style: { color: C.orange, fontWeight: 700, cursor: "pointer", textDecoration: "underline" } }, "Terms of Service"),
                ", Payment Policy, and Cancellation Policy.")));
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
// ── LOGO SVG ──────────────────────────────────────────────────────
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
// ── LEAFLET LOADER — loads Leaflet.js from CDN once, on demand ─────
var _leafletLoadPromise = null;
function loadLeaflet() {
    if (window.L)
        return Promise.resolve(window.L);
    if (_leafletLoadPromise)
        return _leafletLoadPromise;
    _leafletLoadPromise = new Promise(function (resolve, reject) {
        var css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
        document.head.appendChild(css);
        var script = document.createElement("script");
        script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
        script.onload = function () { resolve(window.L); };
        script.onerror = function () { reject(new Error("Failed to load map library.")); };
        document.head.appendChild(script);
    });
    return _leafletLoadPromise;
}
function truckDivIcon(L, color) {
    return L.divIcon({
        className: "", html: "<div style=\"width:34px;height:34px;border-radius:50%;background:" + (color || C.orange) + ";border:3px solid #000;display:flex;align-items:center;justify-content:center;font-size:16px;box-shadow:0 2px 8px rgba(0,0,0,.5)\">\uD83D\uDE9A</div>",
        iconSize: [34, 34], iconAnchor: [17, 17]
    });
}
// ── CUSTOMER-FACING: live truck map for a single job ────────────────
function TruckMap(props) {
    var jobId = props.jobId;
    var job = props.job;
    var mapElRef = useRef(null);
    var mapRef = useRef(null);
    var markerRef = useRef(null);
    var [loc, setLoc] = useState(null);
    var [status, setStatus] = useState("loading"); // loading | live | stale | none | error
    var destCoordsRef = useRef(null);
    var etaAlertSentRef = useRef(false);
    useEffect(function () {
        // Geocode the destination once per job, so each GPS poll can check
        // distance without re-hitting the geocoder every 10 seconds.
        destCoordsRef.current = null;
        etaAlertSentRef.current = false;
        if (job && job.destination) {
            geocodeAddress(job.destination).then(function (coords) { destCoordsRef.current = coords; });
        }
    }, [jobId]);
    useEffect(function () {
        var cancelled = false;
        var pollId = null;
        loadLeaflet().then(function (L) {
            if (cancelled || !mapElRef.current)
                return;
            mapRef.current = L.map(mapElRef.current, { zoomControl: true, attributionControl: true }).setView([33.749, -84.388], 10);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "\u00A9 OpenStreetMap contributors", maxZoom: 19
            }).addTo(mapRef.current);
            function poll() {
                fetchDriverLocations("job_id=eq." + encodeURIComponent(jobId) + "&order=updated_at.desc&limit=1").then(function (rows) {
                    if (cancelled)
                        return;
                    if (!Array.isArray(rows) || rows.length === 0) {
                        setStatus("none");
                        return;
                    }
                    var row = rows[0];
                    var age = Date.now() - new Date(row.updated_at).getTime();
                    setStatus(age > GPS_STALE_MS ? "stale" : "live");
                    setLoc(row);
                    var latlng = [row.lat, row.lon];
                    if (!markerRef.current) {
                        markerRef.current = L.marker(latlng, { icon: truckDivIcon(L, age > GPS_STALE_MS ? C.dim : C.orange) }).addTo(mapRef.current);
                        mapRef.current.setView(latlng, 13);
                    }
                    else {
                        markerRef.current.setLatLng(latlng);
                        markerRef.current.setIcon(truckDivIcon(L, age > GPS_STALE_MS ? C.dim : C.orange));
                        mapRef.current.panTo(latlng);
                    }
                    // ETA alert check — fires once per job, only while the fix is
                    // fresh (not stale), only if we successfully geocoded a
                    // destination, and only if the job has an email on file.
                    if (!etaAlertSentRef.current && destCoordsRef.current && age <= GPS_STALE_MS && job && job.email) {
                        var distMiles = haversine([row.lat, row.lon], destCoordsRef.current);
                        if (distMiles <= ETA_ALERT_MILES) {
                            etaAlertSentRef.current = true; // set before the async call so a fast double-poll can't send twice
                            sendETAAlert(job).catch(function (e) { console.error("ETA alert failed:", e); });
                        }
                    }
                }).catch(function () { if (!cancelled)
                    setStatus("error"); });
            }
            poll();
            pollId = setInterval(poll, 10000);
        }).catch(function () { if (!cancelled)
            setStatus("error"); });
        return function () {
            cancelled = true;
            if (pollId)
                clearInterval(pollId);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markerRef.current = null;
            }
        };
    }, [jobId]);
    if (status === "none")
        return null; // driver hasn't gone live yet — don't show an empty map
    return React.createElement("div", { style: { marginTop: 14, borderTop: "1px solid " + C.border, paddingTop: 14 } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } },
            React.createElement("div", { style: { fontSize: 11, color: C.dim, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase" } }, "\uD83D\uDE9A Live Truck Location"),
            status === "live" && React.createElement("span", { style: { fontSize: 10, color: C.green, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 } },
                React.createElement("span", { style: { width: 6, height: 6, borderRadius: "50%", background: C.green, display: "inline-block" } }), "LIVE"),
            status === "stale" && React.createElement("span", { style: { fontSize: 10, color: C.faint, fontWeight: 700 } }, "Last seen a while ago"),
            status === "error" && React.createElement("span", { style: { fontSize: 10, color: C.red, fontWeight: 700 } }, "Map failed to load")),
        React.createElement("div", { ref: mapElRef, style: { width: "100%", height: 260, borderRadius: 10, overflow: "hidden", background: C.surface } }),
        loc && React.createElement("div", { style: { fontSize: 10, color: C.faint, marginTop: 6 } }, "Updated " + new Date(loc.updated_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })));
}
// ── ADMIN: fleet-wide live map, all active trucks ────────────────────
function FleetMap() {
    var mapElRef = useRef(null);
    var mapRef = useRef(null);
    var markersRef = useRef({});
    var [trucks, setTrucks] = useState([]);
    var [mapReady, setMapReady] = useState(false);
    var [err, setErr] = useState("");
    useEffect(function () {
        var cancelled = false;
        var pollId = null;
        loadLeaflet().then(function (L) {
            if (cancelled || !mapElRef.current)
                return;
            mapRef.current = L.map(mapElRef.current).setView([33.749, -84.388], 9);
            L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
                attribution: "\u00A9 OpenStreetMap contributors", maxZoom: 19
            }).addTo(mapRef.current);
            setMapReady(true);
            function poll() {
                fetchDriverLocations("order=updated_at.desc").then(function (rows) {
                    if (cancelled || !Array.isArray(rows))
                        return;
                    setTrucks(rows);
                    var seen = {};
                    rows.forEach(function (row) {
                        var age = Date.now() - new Date(row.updated_at).getTime();
                        var isLive = age <= GPS_STALE_MS;
                        seen[row.driver_id] = true;
                        var latlng = [row.lat, row.lon];
                        if (!markersRef.current[row.driver_id]) {
                            var m = L.marker(latlng, { icon: truckDivIcon(L, isLive ? C.orange : C.dim) }).addTo(mapRef.current);
                            m.bindPopup(popupHtml(row, isLive));
                            markersRef.current[row.driver_id] = m;
                        }
                        else {
                            markersRef.current[row.driver_id].setLatLng(latlng);
                            markersRef.current[row.driver_id].setIcon(truckDivIcon(L, isLive ? C.orange : C.dim));
                            markersRef.current[row.driver_id].setPopupContent(popupHtml(row, isLive));
                        }
                    });
                    // Remove markers for drivers no longer in the result set
                    Object.keys(markersRef.current).forEach(function (id) {
                        if (!seen[id]) {
                            mapRef.current.removeLayer(markersRef.current[id]);
                            delete markersRef.current[id];
                        }
                    });
                    if (rows.length > 0 && Object.keys(markersRef.current).length > 0) {
                        var group = L.featureGroup(Object.values(markersRef.current));
                        if (rows.length > 1)
                            mapRef.current.fitBounds(group.getBounds().pad(0.3));
                    }
                }).catch(function () { });
            }
            function popupHtml(row, isLive) {
                var age = Date.now() - new Date(row.updated_at).getTime();
                var mins = Math.round(age / 60000);
                return "<div style=\"font-family:sans-serif;min-width:150px\"><b>" + (row.driver_name || row.driver_id) + "</b><br>" +
                    (row.job_id ? "Job: " + row.job_id + "<br>" : "No active job<br>") +
                    (isLive ? "<span style=\"color:#1DB954\">\u25CF Live</span>" : "<span style=\"color:#888\">\u25CF " + mins + "m ago</span>") + "</div>";
            }
            poll();
            pollId = setInterval(poll, 10000);
        }).catch(function () { if (!cancelled)
            setErr("Map failed to load. Check your connection."); });
        return function () {
            cancelled = true;
            if (pollId)
                clearInterval(pollId);
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
                markersRef.current = {};
            }
        };
    }, []);
    var liveCount = trucks.filter(function (t) { return Date.now() - new Date(t.updated_at).getTime() <= GPS_STALE_MS; }).length;
    return React.createElement("div", { style: { maxWidth: 900, margin: "0 auto" } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 } },
            React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: C.white } }, "\uD83D\uDDFA\uFE0F Fleet Map"),
            React.createElement("div", { style: { fontSize: 12, color: C.dim } }, liveCount + " truck" + (liveCount !== 1 ? "s" : "") + " live \u00B7 " + trucks.length + " total tracked")),
        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 14 } }, "Updates every 10 seconds. Trucks go gray after 90 seconds without a ping."),
        err && React.createElement("div", { style: { color: C.red, fontSize: 12, marginBottom: 10 } }, "\u26A0 " + err),
        React.createElement("div", { ref: mapElRef, style: { width: "100%", height: 520, borderRadius: 12, overflow: "hidden", background: C.surface, border: "1px solid " + C.border } }),
        trucks.length > 0 && React.createElement("div", { style: { marginTop: 16 } },
            React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 } }, "Active Drivers"),
            trucks.map(function (t) {
                var age = Date.now() - new Date(t.updated_at).getTime();
                var isLive = age <= GPS_STALE_MS;
                return React.createElement("div", { key: t.driver_id, style: { display: "flex", justifyContent: "space-between", alignItems: "center", background: C.card, border: "1px solid " + C.border, borderRadius: 8, padding: "10px 14px", marginBottom: 6 } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, t.driver_name || t.driver_id),
                        React.createElement("div", { style: { fontSize: 10, color: C.dim } }, t.job_id ? "Job: " + t.job_id : "No active job")),
                    React.createElement("div", { style: { fontSize: 10, fontWeight: 700, color: isLive ? C.green : C.faint } }, isLive ? "\u25CF LIVE" : "\u25CF " + Math.round(age / 60000) + "m ago"));
            })));
}
// ── TRACKER ───────────────────────────────────────────────────────
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
            (job.status === "Assigned" || job.status === "En Route" || job.status === "Arrived" || job.status === "In Progress" || job.status === "Loading" || job.status === "In Transit") && React.createElement(TruckMap, { jobId: job.id, job: job }),
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
// ── BOOKING ───────────────────────────────────────────────────────
function BookingView(props) {
    var t = props.t || function (k) { return (TX && TX.en && TX.en[k]) || k; };
    var [step, setStep] = useState(1);
    var [svc, setSvc] = useState(null);
    var [form, setForm] = useState({ name: "", phone: "", email: "", origin: "", destination: "", originStreet: "", originCity: "", originState: "GA", destStreet: "", destCity: "", destState: "GA", miles: "", zone: props.preZone || "local", speed: "standard", itemSize: "", helper: false, weightTier: "light", extraStop: false, readyConfirm: false, customerType: "residential", isBusiness: false, companyName: "", companyAddress: "", contactPerson: "", paymentTerms: "completion", payment: "cash", discreet: false, notes: "", date: "", timeSlot: "", loadSize: "quarter", cleanoutTier: "2br", cleanoutSubtype: "", extraTruckloads: "0", emergencyAddons: [], tosAccepted: false });
    var [quote, setQuote] = useState(null);
    var [jobId, setJobId] = useState(null);
    var [showCardForm, setShowCardForm] = useState(false);
    function set(k, v) { setForm(function (f) { var n = Object.assign({}, f); n[k] = v; return n; }); }
    function toggleAddon(id) { setForm(function (f) { var n = Object.assign({}, f); var list = f.emergencyAddons.slice(); var i = list.indexOf(id); if (i > -1)
        list.splice(i, 1);
    else
        list.push(id); n.emergencyAddons = list; return n; }); }
    var isMileageSvc = svc && MILEAGE_SERVICES.indexOf(svc.id) > -1;
    var isLoadSizeSvc = svc && svc.id === "junkremoval";
    var isCleanoutSvc = svc && svc.id === "cleanout";
    var [autoMiles, setAutoMiles] = useState(null);
    var [geoLoading, setGeoLoading] = useState(false);
    var [geoFailed, setGeoFailed] = useState(false);
    useEffect(function () {
        if (!isMileageSvc || !form.origin || !form.destination) {
            setAutoMiles(null);
            setGeoFailed(false);
            setGeoLoading(false);
            return;
        }
        var cancelled = false;
        setGeoLoading(true);
        setGeoFailed(false);
        var timer = setTimeout(function () {
            calcRealMilesFromAddresses(form.origin, form.destination).then(function (result) {
                if (cancelled)
                    return;
                setGeoLoading(false);
                if (result == null) {
                    setAutoMiles(null);
                    setGeoFailed(true);
                }
                else {
                    setAutoMiles(result);
                    setGeoFailed(false);
                }
            });
        }, 900);
        return function () { cancelled = true; clearTimeout(timer); };
    }, [form.origin, form.destination, isMileageSvc]);
    var miles = isMileageSvc ? (autoMiles != null ? autoMiles : (Number(form.miles) || 0)) : 0;
    function doQuote() {
        var q;
        if (isLoadSizeSvc)
            q = calcJunkRemovalQuote(form.loadSize, form.payment, form.emergencyAddons);
        else if (isCleanoutSvc)
            q = calcCleanoutQuote(form.cleanoutTier, form.payment, form.extraTruckloads);
        else
            q = calcQuote(svc.id, form.zone, form.speed, form.payment, form.helper, form.discreet, form.weightTier, form.extraStop, miles);
        setQuote(q);
        setStep(4);
    }
    function doBook(paymentIntentId) {
        var q;
        if (isLoadSizeSvc)
            q = calcJunkRemovalQuote(form.loadSize, form.payment, form.emergencyAddons);
        else if (isCleanoutSvc)
            q = calcCleanoutQuote(form.cleanoutTier, form.payment, form.extraTruckloads);
        else
            q = calcQuote(svc.id, form.zone, form.speed, form.payment, form.helper, form.discreet, form.weightTier, form.extraStop, miles);
        var id = makeJobId();
        var statusForJob = isCleanoutSvc ? "Pending Quote" : "Confirmed";
        var notesForJob;
        if (isLoadSizeSvc)
            notesForJob = form.loadSize + " load" + (form.notes ? " — " + form.notes : "");
        else if (isCleanoutSvc)
            notesForJob = (form.cleanoutSubtype ? CLEANOUT_SUBTYPES.find(function (s) { return s.id === form.cleanoutSubtype; }).label + " — " : "") + q.tier.label + (q.isCustomQuote ? " — CUSTOM QUOTE NEEDED" : " (starting estimate, confirm by phone)") + (form.notes ? " — " + form.notes : "");
        else
            notesForJob = (isMileageSvc ? (miles + " mi · $" + INSTATE_RATE_PER_MILE + "/mi" + (form.notes ? " — " + form.notes : "")) : form.notes) + (paymentIntentId ? " · Stripe: " + paymentIntentId : "");
        var job = { id: id, customer: form.name, phone: form.phone, email: form.email || "", service: svc.id, serviceName: svc.name,
            origin: form.origin, destination: form.destination || form.origin,
            zone: form.zone, speed: form.speed,
            basePrice: q.base, finalPrice: q.total, status: statusForJob, payment: form.payment,
            discreet: form.discreet, isBusiness: form.isBusiness,
            customerType: form.customerType || "residential",
            companyName: form.companyName || "", paymentTerms: form.paymentTerms || "completion",
            date: form.date || new Date().toISOString().split("T")[0],
            timeSlot: form.timeSlot || "morning",
            notes: notesForJob,
            helperHours: 0, fuel: 30, weightTier: form.weightTier, miles: isMileageSvc ? miles : null,
            paymentIntentId: paymentIntentId || null, paidOnline: !!paymentIntentId };
        props.onBook(job);
        sendEmail(job);
        setJobId(id);
        setQuote(q);
        setStep(5);
    }
    function handleConfirmClick() {
        if (form.payment === "card" && !isCleanoutSvc) {
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
        setForm({ name: "", phone: "", email: "", origin: "", destination: "", miles: "", zone: props.preZone || "local", speed: "standard", itemSize: "", helper: false, weightTier: "light", extraStop: false, readyConfirm: false, customerType: "residential", isBusiness: false, companyName: "", companyAddress: "", contactPerson: "", paymentTerms: "completion", payment: "cash", discreet: false, notes: "", date: "", timeSlot: "", loadSize: "quarter", cleanoutTier: "2br", cleanoutSubtype: "", extraTruckloads: "0", emergencyAddons: [], tosAccepted: false });
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
                React.createElement(TxtIn, { label: t("email"), value: form.email, onChange: function (v) { set("email", v); }, type: "email", placeholder: "your@email.com" }),
                React.createElement(Lbl, null, "Customer Type"),
                React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 14 } }, [["residential", "🏠 Residential"], ["business", "🏢 Business / Commercial"], ["repeat", "⭐ Repeat Customer"]].map(function (opt) {
                    return React.createElement("div", { key: opt[0], onClick: function () { set("customerType", opt[0]); set("isBusiness", opt[0] === "business" || opt[0] === "repeat"); }, style: { flex: 1, border: "1.5px solid " + (form.customerType === opt[0] ? C.orange : C.border), borderRadius: 9, padding: "9px 8px", cursor: "pointer", background: form.customerType === opt[0] ? C.orangeSoft : "transparent", textAlign: "center", fontSize: 11, fontWeight: 600, color: form.customerType === opt[0] ? C.orange : C.dim } }, opt[1]);
                })),
                form.customerType === "business" && React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.orange + "33", borderRadius: 10, padding: "14px", marginBottom: 14 } },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.orange, marginBottom: 10 } }, "\uD83C\uDFE2 Commercial Account Request"),
                    React.createElement(TxtIn, { label: "Company Name", value: form.companyName, onChange: function (v) { set("companyName", v); }, placeholder: "Company name" }),
                    React.createElement(TxtIn, { label: "Business Address", value: form.companyAddress, onChange: function (v) { set("companyAddress", v); }, placeholder: "123 Business Blvd, Atlanta, GA" }),
                    React.createElement(TxtIn, { label: "Contact Person", value: form.contactPerson, onChange: function (v) { set("contactPerson", v); }, placeholder: "Contact person name" }),
                    React.createElement(Lbl, null, "Requested Payment Terms"),
                    React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 8 } }, [["completion", "Pay Upon Completion"], ["net14", "Request Net 14 Approval"]].map(function (opt) {
                        return React.createElement("div", { key: opt[0], onClick: function () { set("paymentTerms", opt[0]); }, style: { flex: 1, border: "1.5px solid " + (form.paymentTerms === opt[0] ? C.orange : C.border), borderRadius: 8, padding: "9px 8px", cursor: "pointer", background: form.paymentTerms === opt[0] ? C.orangeSoft : "transparent", textAlign: "center", fontSize: 11, fontWeight: 600, color: form.paymentTerms === opt[0] ? C.orange : C.white } }, opt[1]);
                    })),
                    form.paymentTerms === "net14" && React.createElement("div", { style: { fontSize: 10, color: C.faint, lineHeight: 1.6 } }, "Commercial payment terms require approval before services are provided. We will contact you to review your account.")),
                (isLoadSizeSvc || isCleanoutSvc) ? React.createElement("div", null,
                    React.createElement(TxtIn, { label: t("pickupAddress"), value: form.origin, onChange: function (v) { set("origin", v); }, placeholder: "123 Main St, Conyers, GA" })) : isMileageSvc ? React.createElement("div", null,
                    React.createElement("div", { style: { marginBottom: 10 } },
                        React.createElement(Lbl, null, "Pickup Address"),
                        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
                            React.createElement("input", { value: form.originStreet || "", onChange: function (e) { var s = e.target.value; set("originStreet", s); set("origin", s + ", " + (form.originCity || "") + ", " + (form.originState || "GA")); }, placeholder: "Street Address (e.g. 123 Main St)", style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } }),
                            React.createElement("div", { style: { display: "flex", gap: 6 } },
                                React.createElement("input", { value: form.originCity || "", onChange: function (e) { var c = e.target.value; set("originCity", c); set("origin", (form.originStreet || "") + ", " + c + ", " + (form.originState || "GA")); }, placeholder: "City (e.g. Conyers)", style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, flex: 2, outline: "none", fontFamily: "inherit", boxSizing: "border-box" } }),
                                React.createElement("input", { value: form.originState || "", onChange: function (e) { var st = e.target.value.toUpperCase().substring(0, 2); set("originState", st); set("origin", (form.originStreet || "") + ", " + (form.originCity || "") + ", " + st); }, placeholder: "State (GA)", maxLength: 2, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, flex: 1, outline: "none", fontFamily: "inherit", boxSizing: "border-box", textTransform: "uppercase" } })))),
                    React.createElement("div", { style: { marginBottom: 10 } },
                        React.createElement(Lbl, null, "Drop-Off Address"),
                        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
                            React.createElement("input", { value: form.destStreet || "", onChange: function (e) { var s = e.target.value; set("destStreet", s); set("destination", s + ", " + (form.destCity || "") + ", " + (form.destState || "GA")); }, placeholder: "Street Address (e.g. 44 Howes Rd)", style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } }),
                            React.createElement("div", { style: { display: "flex", gap: 6 } },
                                React.createElement("input", { value: form.destCity || "", onChange: function (e) { var c = e.target.value; set("destCity", c); set("destination", (form.destStreet || "") + ", " + c + ", " + (form.destState || "GA")); }, placeholder: "City (e.g. South Yarmouth)", style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, flex: 2, outline: "none", fontFamily: "inherit", boxSizing: "border-box" } }),
                                React.createElement("input", { value: form.destState || "", onChange: function (e) { var st = e.target.value.toUpperCase().substring(0, 2); set("destState", st); set("destination", (form.destStreet || "") + ", " + (form.destCity || "") + ", " + st); }, placeholder: "State (MA)", maxLength: 2, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, flex: 1, outline: "none", fontFamily: "inherit", boxSizing: "border-box", textTransform: "uppercase" } })))),
                    geoLoading && React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 14 } }, "\uD83D\uDCCD Calculating distance..."),
                    !geoLoading && geoFailed && React.createElement("div", null,
                        React.createElement(Lbl, null, "Estimated Distance (miles)"),
                        React.createElement("div", { style: { marginBottom: 6 } },
                            React.createElement("input", { type: "number", value: form.miles, onChange: function (e) { set("miles", e.target.value); }, placeholder: "e.g. 12", style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } })),
                        React.createElement("div", { style: { fontSize: 11, color: C.faint, marginBottom: 14 } }, "We couldn't find that address \u2014 please double check it or enter the estimated miles yourself.")),
                    !geoLoading && miles > 0 && React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "33", borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 12 } },
                        React.createElement("span", { style: { color: C.dim } }, autoMiles != null ? "Distance: " : "Estimated price: "),
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
                React.createElement(Toggle, { label: "\u2713 Items are identified and ready for removal", sub: "Required to confirm booking", value: form.readyConfirm, onChange: function (v) { set("readyConfirm", v); } }),
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
                    React.createElement(Btn, { onClick: function () { setStep(3); }, disabled: !form.name || !form.phone || !(form.origin || (form.originStreet && form.originCity && form.originState)) || ((!isLoadSizeSvc && !isCleanoutSvc) && !(form.destination || (form.destStreet && form.destCity && form.destState))) || !form.readyConfirm || !form.date || !form.timeSlot || (isMileageSvc && !(miles > 0)), style: { flex: 2 } }, "Continue \u2192"))));
    if (step === 3)
        return React.createElement("div", { style: { maxWidth: 520, margin: "0 auto" } },
            React.createElement(StepBar, { steps: STEPS, current: 3 }),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 16 } }, "Job Details"),
                isLoadSizeSvc && React.createElement("div", null,
                    React.createElement(Lbl, null, "Load Size"),
                    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 } }, LOAD_SIZES.map(function (l) {
                        return React.createElement("div", { key: l.id, onClick: function () { set("loadSize", l.id); }, style: { border: "1.5px solid " + (form.loadSize === l.id ? C.orange : C.border), borderRadius: 9, padding: "10px 14px", cursor: "pointer", background: form.loadSize === l.id ? C.orangeSoft : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                            React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: form.loadSize === l.id ? C.orange : C.white } }, l.label),
                                React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2 } }, l.sub)),
                            React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: form.loadSize === l.id ? C.orange : C.dim } }, "$" + l.price));
                    })),
                    React.createElement(Lbl, null, "Rush / Emergency Add-Ons (optional)"),
                    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 } }, EMERGENCY_ADDONS.map(function (a) {
                        var on = form.emergencyAddons.indexOf(a.id) > -1;
                        return React.createElement("div", { key: a.id, onClick: function () { toggleAddon(a.id); }, style: { border: "1.5px solid " + (on ? C.purple : C.border), borderRadius: 9, padding: "9px 14px", cursor: "pointer", background: on ? C.purple + "15" : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: on ? C.purple : C.white } }, a.label),
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: on ? C.purple : C.dim } }, "+$" + a.fee));
                    }))),
                isCleanoutSvc && React.createElement("div", null,
                    React.createElement(Lbl, null, "Property Size"),
                    React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 } }, CLEANOUT_TIERS.map(function (t) {
                        return React.createElement("div", { key: t.id, onClick: function () { set("cleanoutTier", t.id); }, style: { border: "1.5px solid " + (form.cleanoutTier === t.id ? C.orange : C.border), borderRadius: 9, padding: "10px 14px", cursor: "pointer", background: form.cleanoutTier === t.id ? C.orangeSoft : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: form.cleanoutTier === t.id ? C.orange : C.white } }, t.label),
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: form.cleanoutTier === t.id ? C.orange : C.dim } }, t.startPrice > 0 ? ("Starting $" + t.startPrice) : "Custom Quote"));
                    })),
                    React.createElement(Lbl, null, "Cleanout Type (optional)"),
                    React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 } }, CLEANOUT_SUBTYPES.map(function (s) {
                        return React.createElement("div", { key: s.id, onClick: function () { set("cleanoutSubtype", form.cleanoutSubtype === s.id ? "" : s.id); }, style: { border: "1px solid " + (form.cleanoutSubtype === s.id ? C.orange : C.border), borderRadius: 7, padding: "6px 11px", cursor: "pointer", background: form.cleanoutSubtype === s.id ? C.orangeSoft : "transparent", fontSize: 11, fontWeight: 600, color: form.cleanoutSubtype === s.id ? C.orange : C.dim } }, s.label);
                    })),
                    React.createElement(TxtIn, { label: "Extra Truckloads Beyond First (if known)", value: form.extraTruckloads, onChange: function (v) { set("extraTruckloads", v); }, type: "number", placeholder: "0" }),
                    React.createElement("div", { style: { background: "#9F7AEA12", border: "1px solid #9F7AEA33", borderRadius: 9, padding: "10px 12px", marginBottom: 14 } },
                        React.createElement("div", { style: { fontSize: 11, color: "#9F7AEA", fontWeight: 700, marginBottom: 2 } }, "\uD83D\uDCCB Starting Estimate \u2014 Not Final"),
                        React.createElement("div", { style: { fontSize: 11, color: C.dim, lineHeight: 1.6 } }, "Property cleanouts vary a lot job to job. We'll call you to confirm the final price after a quick phone walkthrough."))),
                (!isLoadSizeSvc && !isCleanoutSvc) && React.createElement("div", null,
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
                        React.createElement("div", { style: { fontSize: 11, color: C.dim, lineHeight: 1.6 } }, "We personally drive this overnight and it's only available if we're not already booked that night. If we can't take it, we'll call you back within the hour to confirm or suggest the next available night."))),
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
                pay.discount && React.createElement("div", { style: { background: C.green + "12", border: "1px solid " + C.green + "33", borderRadius: 8, padding: "8px 12px", marginBottom: 14, fontSize: 12, color: C.green, fontWeight: 700 } }, "\uD83D\uDCB5 10% Cash Discount \u2014 Available when payment is made in full at pickup."),
                svc.id === "discreet" && React.createElement(Toggle, { label: "\uD83D\uDD12 Discreet handling confirmed", sub: "Direct route, no stops, confidential (+35%)", value: form.discreet, onChange: function (v) { set("discreet", v); } }),
                React.createElement(Toggle, { label: "\uD83C\uDFE2 Business / Repeat Customer", sub: "Check if booking for a business or returning customer", value: form.isBusiness, onChange: function (v) { set("isBusiness", v); } }),
                React.createElement(TxtIn, { label: "Special Notes (optional)", value: form.notes, onChange: function (v) { set("notes", v); }, placeholder: "Gate code, fragile items, access notes...", rows: 2 }),
                React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 4 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setStep(2); }, style: { flex: 1 } }, "\u2190 Back"),
                    React.createElement(Btn, { onClick: doQuote, style: { flex: 2 } }, "Get My Quote \u2192"))));
    if (step === 4 && quote && (isLoadSizeSvc || isCleanoutSvc)) {
        return React.createElement("div", { style: { maxWidth: 480, margin: "0 auto" } },
            React.createElement(StepBar, { steps: STEPS, current: 4 }),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 16 } }, isCleanoutSvc ? "Your Starting Estimate" : "Your Locked Quote"),
                React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "33", borderRadius: 12, padding: "22px", marginBottom: 20, textAlign: "center" } },
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 } }, quote.isCustomQuote ? "Custom Quote Required" : (pay.discount ? "Cash Price — Due at Pickup" : "Estimated Total")),
                    quote.isCustomQuote ? React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C.orange, lineHeight: 1.3 } }, "We'll Call You") : React.createElement("div", { style: { fontSize: 56, fontWeight: 900, color: C.orange, lineHeight: 1 } }, "$" + quote.total),
                    !quote.isCustomQuote && pay.discount && React.createElement("div", { style: { marginTop: 8 } },
                        React.createElement("span", { style: { color: C.dim, fontSize: 13, textDecoration: "line-through", marginRight: 8 } }, "$" + quote.subtotal),
                        React.createElement("span", { style: { color: C.green, fontSize: 13, fontWeight: 700 } }, "You save $" + quote.cashDisc + " (10%)"))),
                !quote.isCustomQuote && React.createElement("div", { style: { marginBottom: 16 } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 } }, "How This Was Calculated"),
                    React.createElement("div", { style: { background: C.surface, borderRadius: 9, padding: "12px 14px", marginBottom: 8 } },
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                            React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, isLoadSizeSvc ? quote.load.label : quote.tier.label),
                                React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2 } }, isLoadSizeSvc ? quote.load.sub : "Starting estimate")),
                            React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.white } }, "$" + quote.base))),
                    isLoadSizeSvc && quote.addonFees > 0 && React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid " + C.border } },
                        React.createElement("span", { style: { fontSize: 13, color: C.white, fontWeight: 600 } }, "Rush / Emergency Add-Ons"),
                        React.createElement("span", { style: { fontSize: 14, fontWeight: 700, color: C.purple } }, "+$" + quote.addonFees)),
                    isCleanoutSvc && quote.extraFee > 0 && React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "9px 14px", borderBottom: "1px solid " + C.border } },
                        React.createElement("span", { style: { fontSize: 13, color: C.white, fontWeight: 600 } }, "Extra Truckloads"),
                        React.createElement("span", { style: { fontSize: 14, fontWeight: 700, color: C.dim } }, "+$" + quote.extraFee)),
                    pay.discount && React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "10px 14px", background: C.green + "10", borderBottom: "1px solid " + C.border } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 13, color: C.green, fontWeight: 700 } }, "\uD83D\uDCB5 Cash Discount"),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim } }, "10% off entire total")),
                        React.createElement("span", { style: { fontSize: 14, color: C.green, fontWeight: 700 } }, "-$" + quote.cashDisc)),
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 14px", background: C.orangeSoft, borderRadius: "0 0 9px 9px" } },
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white } }, "Total"),
                        React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: C.orange } }, "$" + quote.total))),
                isCleanoutSvc && React.createElement("div", { style: { background: "#9F7AEA12", border: "1px solid #9F7AEA33", borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 12 } },
                    React.createElement("div", { style: { color: "#9F7AEA", fontWeight: 700, marginBottom: 3 } }, "\uD83D\uDCCB Not a Final Price"),
                    React.createElement("div", { style: { color: C.dim, lineHeight: 1.6 } }, quote.isCustomQuote ? "This type of job needs a custom quote. We'll call to schedule a walkthrough." : "This is a starting estimate. We'll call you to confirm the final price after a quick walkthrough.")),
                isLoadSizeSvc && React.createElement("div", { style: { background: C.surface, borderRadius: 9, padding: "10px 14px", marginBottom: 18, fontSize: 12, color: C.dim, lineHeight: 1.7 } },
                    "\u2705 ",
                    React.createElement("strong", { style: { color: C.white } }, "Price Guarantee:"),
                    " Your confirmed quote will not change unless job details, requested services, item quantity, access conditions, or scope of work changes after booking. Customers are responsible for providing accurate job details before confirmation."),
                React.createElement(TrustSection, null),
                !showCardForm && React.createElement(TosCheckbox, { value: form.tosAccepted, onChange: function (v) { set("tosAccepted", v); } }),
                !showCardForm && React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setStep(3); }, style: { flex: 1 } }, "\u2190 Back"),
                    React.createElement(Btn, { onClick: handleConfirmClick, disabled: !form.tosAccepted, style: { flex: 2 } }, isCleanoutSvc ? "Submit Request 📋" : (form.payment === "card" ? "Continue to Payment 💳" : "Confirm & Book 🚐"))),
                showCardForm && React.createElement(StripeCardForm, { amount: quote.total, jobId: "pending", customerName: form.name, onCancel: function () { setShowCardForm(false); }, onSuccess: function (paymentIntentId) { doBook(paymentIntentId); } })));
    }
    if (step === 4 && quote && !isLoadSizeSvc && !isCleanoutSvc) {
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
                    " Your confirmed quote will not change unless job details, requested services, item quantity, access conditions, or scope of work changes after booking. Customers are responsible for providing accurate job details before confirmation."),
                React.createElement(TrustSection, null),
                !showCardForm && React.createElement(TosCheckbox, { value: form.tosAccepted, onChange: function (v) { set("tosAccepted", v); } }),
                !showCardForm && React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setStep(3); }, style: { flex: 1 } }, "\u2190 Back"),
                    React.createElement(Btn, { onClick: handleConfirmClick, disabled: !form.tosAccepted, style: { flex: 2 } }, form.payment === "card" ? "Continue to Payment 💳" : "Confirm & Book 🚐")),
                showCardForm && React.createElement(StripeCardForm, { amount: quote.total, jobId: "pending", customerName: form.name, onCancel: function () { setShowCardForm(false); }, onSuccess: function (paymentIntentId) { doBook(paymentIntentId); } })));
    }
    if (step === 5) {
        var cpay = PAYMENTS.find(function (p) { return p.id === form.payment; }) || PAYMENTS[0];
        return React.createElement("div", { style: { maxWidth: 480, margin: "0 auto" } },
            React.createElement(Card, { style: { textAlign: "center" } },
                React.createElement("div", { style: { fontSize: 52, marginBottom: 12 } }, isCleanoutSvc ? "📋" : "🚐"),
                React.createElement("div", { style: { fontSize: 24, fontWeight: 900, color: C.white, marginBottom: 6 } }, isCleanoutSvc ? "Request Received!" : "You're Booked!"),
                React.createElement("div", { style: { color: C.dim, fontSize: 14, marginBottom: 4 } }, isCleanoutSvc ? ("We'll call you to confirm final pricing, " + form.name + ".") : ("We'll contact you shortly, " + form.name + ".")),
                React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: C.orange, marginBottom: 2 } }, quote && quote.isCustomQuote ? "Custom Quote" : ("$" + (quote && quote.total))),
                React.createElement("div", { style: { color: C.dim, fontSize: 13, marginBottom: 20 } }, isCleanoutSvc ? "Starting estimate — final price confirmed by phone" : ("via " + cpay.label + (cpay.discount ? " — due at pickup" : ""))),
                React.createElement("div", { style: { background: C.surface, borderRadius: 10, padding: "14px 16px", marginBottom: 14, textAlign: "left" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 } }, "Your Job ID \u2014 Save This"),
                    React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: C.orange, letterSpacing: 2 } }, jobId),
                    React.createElement("div", { style: { fontSize: 12, color: C.dim, marginTop: 4 } }, "Use this to track your job under Track My Job")),
                !isCleanoutSvc && form.payment === "cash" && React.createElement("div", { style: { background: C.green + "12", border: "1px solid " + C.green + "33", borderRadius: 9, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: C.green } }, "\uD83D\uDCB5 10% Cash Discount applied. Payment due in full at pickup \u2014 exact amount appreciated."),
                !isCleanoutSvc && form.payment === "card" && React.createElement("div", { style: { background: C.green + "12", border: "1px solid " + C.green + "33", borderRadius: 9, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: C.green } }, "\uD83D\uDCB3 Payment confirmed online \u2014 your card has been charged. Receipt sent to your phone."),
                isCleanoutSvc && React.createElement("div", { style: { background: "#9F7AEA12", border: "1px solid #9F7AEA33", borderRadius: 9, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: "#9F7AEA" } }, "\uD83D\uDCCB We've received your details. Expect a call shortly to lock in your final price."),
                React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, padding: "10px 14px", marginBottom: 20, fontSize: 12, color: C.dim } }, "📧 Booking notification sent to our team. We'll reach out to " + form.phone + " to confirm."),
                React.createElement(Btn, { variant: "ghost", onClick: reset, style: { width: "100%" } }, "Book Another Job")));
    }
    return null;
}
// ── CALENDAR ──────────────────────────────────────────────────────
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
// ── DRIVER PANEL ──────────────────────────────────────────────────
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
// ── NEW JOB MODAL ─────────────────────────────────────────────────
function NewJobModal(props) {
    var [f, setF] = useState({ customer: "", phone: "", origin: "", destination: "", miles: "", serviceId: "delivery", zone: "local", speed: "standard", payment: "cash", discreet: false, notes: "", helper: false, weightTier: "light", priceTier: "standard", helperHours: "0", fuel: "30", loadSize: "quarter", cleanoutTier: "2br", extraTruckloads: "0", customPriceOn: false, customPrice: "", vehicleId: "", assignedDriverName: "" });
    function set(k, v) { setF(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); }
    var [fleetVehicles] = useState(loadFleet);
    var selectedVehicle = fleetVehicles.find(function (v) { return v.id === f.vehicleId; });
    var vehicleFlags = getVehicleFlags(selectedVehicle);
    var driverUsers = USERS.filter(function (u) { return u.role === "driver"; });
    var hosStatus = f.assignedDriverName ? getDriverHOSStatus(f.assignedDriverName, props.allJobs || [], f.date || new Date().toISOString().split("T")[0]) : null;
    var isMileageSvc = MILEAGE_SERVICES.indexOf(f.serviceId) > -1;
    var isLoadSizeSvc = f.serviceId === "junkremoval";
    var isCleanoutSvc = f.serviceId === "cleanout";
    var [autoMiles, setAutoMiles] = useState(null);
    var [geoLoading, setGeoLoading] = useState(false);
    var [geoFailed, setGeoFailed] = useState(false);
    useEffect(function () {
        if (!isMileageSvc || !f.origin || !f.destination) {
            setAutoMiles(null);
            setGeoFailed(false);
            setGeoLoading(false);
            return;
        }
        var cancelled = false;
        setGeoLoading(true);
        setGeoFailed(false);
        var timer = setTimeout(function () {
            calcRealMilesFromAddresses(f.origin, f.destination).then(function (result) {
                if (cancelled)
                    return;
                setGeoLoading(false);
                if (result == null) {
                    setAutoMiles(null);
                    setGeoFailed(true);
                }
                else {
                    setAutoMiles(result);
                    setGeoFailed(false);
                }
            });
        }, 900);
        return function () { cancelled = true; clearTimeout(timer); };
    }, [f.origin, f.destination, isMileageSvc]);
    var miles = isMileageSvc ? (autoMiles != null ? autoMiles : (Number(f.miles) || 0)) : 0;
    var q;
    if (isLoadSizeSvc)
        q = calcJunkRemovalQuote(f.loadSize, f.payment, []);
    else if (isCleanoutSvc)
        q = calcCleanoutQuote(f.cleanoutTier, f.payment, f.extraTruckloads);
    else
        q = calcQuote(f.serviceId, f.zone, f.speed, f.payment, f.helper, f.discreet, f.weightTier, false, miles, f.priceTier);
    var calculatedTotal = q.total;
    var finalTotal = (f.customPriceOn && Number(f.customPrice) > 0) ? Number(f.customPrice) : calculatedTotal;
    var payObj = PAYMENTS.find(function (p) { return p.id === f.payment; }) || PAYMENTS[0];
    function submit() {
        if (!f.customer || !f.origin || (!isLoadSizeSvc && !isCleanoutSvc && !f.destination) || (isMileageSvc && !(miles > 0)))
            return;
        var svc = SERVICES.find(function (s) { return s.id === f.serviceId; }) || SERVICES[0];
        var customNote = (f.customPriceOn && Number(f.customPrice) > 0) ? (" · CUSTOM PRICE (calc'd: $" + calculatedTotal + ")") : "";
        var statusForJob = isCleanoutSvc ? "Pending Quote" : "Confirmed";
        var job = { id: makeJobId(), customer: f.customer, phone: f.phone, service: f.serviceId, serviceName: svc.name,
            origin: f.origin, destination: f.destination || f.origin,
            zone: f.zone, speed: f.speed,
            basePrice: q.base, finalPrice: finalTotal, status: statusForJob, payment: f.payment,
            discreet: f.discreet, isBusiness: false, date: new Date().toISOString().split("T")[0],
            notes: (f.notes || "") + customNote, helperHours: Number(f.helperHours) || 0, fuel: Number(f.fuel) || 30,
            weightTier: f.weightTier, miles: isMileageSvc ? miles : null, priceTier: f.priceTier,
            vehicleId: f.vehicleId || null, vehicleLabel: selectedVehicle ? (selectedVehicle.year + " " + selectedVehicle.make + " " + selectedVehicle.model) : "",
            assignedDriverName: f.assignedDriverName || "", assignedTo: f.assignedDriverName || null };
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
            (isLoadSizeSvc || isCleanoutSvc) ? React.createElement("div", null,
                React.createElement(TxtIn, { label: "Pickup Address", value: f.origin, onChange: function (v) { set("origin", v); }, placeholder: "Street, City, State (e.g. 123 Main St, Conyers, GA)" })) : isMileageSvc ? React.createElement("div", null,
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "Pickup Address", value: f.origin, onChange: function (v) { set("origin", v); }, placeholder: "Street, City, State (e.g. 123 Main St, Conyers, GA)" }),
                    React.createElement(TxtIn, { label: t("dropoffAddress"), value: f.destination, onChange: function (v) { set("destination", v); }, placeholder: "456 Broad St, City, GA" })),
                geoLoading && React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 10 } }, "\uD83D\uDCCD Calculating distance..."),
                !geoLoading && geoFailed && React.createElement(TxtIn, { label: "Estimated Distance (miles)", value: f.miles, onChange: function (v) { set("miles", v); }, type: "number", placeholder: "e.g. 12" }),
                !geoLoading && miles > 0 && React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "33", borderRadius: 9, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: C.dim } }, (autoMiles != null ? "Auto-detected: " : "") + miles + " miles × $" + INSTATE_RATE_PER_MILE + "/mi = $" + Math.round(miles * INSTATE_RATE_PER_MILE))) : React.createElement("div", null,
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "Pickup", value: f.origin, onChange: function (v) { set("origin", v); }, placeholder: "City, GA" }),
                    React.createElement(TxtIn, { label: "Drop-Off", value: f.destination, onChange: function (v) { set("destination", v); }, placeholder: "City, GA" })),
                React.createElement(Lbl, null, "Zone"),
                React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 14 } }, ZONES.map(function (z) {
                    return React.createElement("div", { key: z.id, onClick: function () { set("zone", z.id); }, style: { flex: 1, border: "1.5px solid " + (f.zone === z.id ? C.orange : C.border), borderRadius: 9, padding: "8px 6px", cursor: "pointer", background: f.zone === z.id ? C.orangeSoft : "transparent", textAlign: "center" } },
                        React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: f.zone === z.id ? C.orange : C.white } }, z.label),
                        React.createElement("div", { style: { fontSize: 10, color: C.dim } }, z.sub));
                }))),
            isLoadSizeSvc && React.createElement("div", null,
                React.createElement(Lbl, null, "Load Size"),
                React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 } }, LOAD_SIZES.map(function (l) {
                    return React.createElement("div", { key: l.id, onClick: function () { set("loadSize", l.id); }, style: { border: "1.5px solid " + (f.loadSize === l.id ? C.orange : C.border), borderRadius: 9, padding: "9px 12px", cursor: "pointer", background: f.loadSize === l.id ? C.orangeSoft : "transparent", display: "flex", justifyContent: "space-between" } },
                        React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: f.loadSize === l.id ? C.orange : C.white } }, l.label),
                        React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: f.loadSize === l.id ? C.orange : C.dim } }, "$" + l.price));
                })),
                React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, padding: "10px 12px", marginBottom: 14 } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 } }, "Dump Fee Reference (admin only \u2014 3x suggested markup)"),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 } }, DUMP_FEES.map(function (d) { return React.createElement("div", { key: d.id, style: { fontSize: 10, color: C.dim, display: "flex", justifyContent: "space-between" } },
                        React.createElement("span", null, d.label),
                        React.createElement("span", { style: { color: C.purple, fontWeight: 700 } }, "+$" + d.markup)); })))),
            isCleanoutSvc && React.createElement("div", null,
                React.createElement(Lbl, null, "Property Size"),
                React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 } }, CLEANOUT_TIERS.map(function (t) {
                    return React.createElement("div", { key: t.id, onClick: function () { set("cleanoutTier", t.id); }, style: { border: "1.5px solid " + (f.cleanoutTier === t.id ? C.orange : C.border), borderRadius: 9, padding: "9px 12px", cursor: "pointer", background: f.cleanoutTier === t.id ? C.orangeSoft : "transparent", display: "flex", justifyContent: "space-between" } },
                        React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: f.cleanoutTier === t.id ? C.orange : C.white } }, t.label),
                        React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: f.cleanoutTier === t.id ? C.orange : C.dim } }, t.startPrice > 0 ? ("$" + t.startPrice) : "Custom"));
                })),
                React.createElement(TxtIn, { label: "Extra Truckloads Beyond First", value: f.extraTruckloads, onChange: function (v) { set("extraTruckloads", v); }, type: "number", placeholder: "0" })),
            fleetVehicles.length > 0 && React.createElement("div", null,
                React.createElement(Lbl, null, "Assign Vehicle (optional)"),
                React.createElement("select", { value: f.vehicleId, onChange: function (e) { set("vehicleId", e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "10px 14px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 } },
                    React.createElement("option", { value: "" }, "\u2014 No vehicle assigned \u2014"),
                    fleetVehicles.map(function (v) {
                        var flags = getVehicleFlags(v);
                        var tag = flags.expired.length > 0 ? " \u26A0 EXPIRED: " + flags.expired.join(", ") : flags.expiringSoon.length > 0 ? " \u26A0 due soon" : "";
                        return React.createElement("option", { key: v.id, value: v.id }, v.year + " " + v.make + " " + v.model + (v.plate ? " (" + v.plate + ")" : "") + tag);
                    })),
                selectedVehicle && vehicleFlags.expired.length > 0 && React.createElement("div", { style: { background: C.red + "18", border: "1px solid " + C.red + "44", borderRadius: 9, padding: "10px 14px", marginBottom: 14 } },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 3 } }, "\uD83D\uDEA8 This vehicle has expired: " + vehicleFlags.expired.join(", ")),
                    React.createElement("div", { style: { fontSize: 11, color: C.dim } }, "Assigning this job to this vehicle is not recommended until it's resolved. Check Fleet Maintenance.")),
                selectedVehicle && vehicleFlags.expired.length === 0 && vehicleFlags.expiringSoon.length > 0 && React.createElement("div", { style: { background: C.orange + "15", border: "1px solid " + C.orange + "44", borderRadius: 9, padding: "10px 14px", marginBottom: 14 } },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.orange } }, "\u26A0 " + vehicleFlags.expiringSoon.join(", ") + " due within 7 days \u2014 schedule service soon."))),
            driverUsers.length > 0 && React.createElement("div", null,
                React.createElement(Lbl, null, "Assign Driver (optional)"),
                React.createElement("select", { value: f.assignedDriverName, onChange: function (e) { set("assignedDriverName", e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "10px 14px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 8 } },
                    React.createElement("option", { value: "" }, "\u2014 No driver assigned yet \u2014"),
                    driverUsers.map(function (u) { return React.createElement("option", { key: u.id, value: u.name }, u.name); })),
                hosStatus && hosStatus.overDailyDrive && React.createElement("div", { style: { background: C.red + "18", border: "1px solid " + C.red + "44", borderRadius: 9, padding: "10px 14px", marginBottom: 14 } },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 3 } }, "\uD83D\uDEA8 Likely over the 11-hour daily driving limit"),
                    React.createElement("div", { style: { fontSize: 11, color: C.dim } }, hosStatus.todayJobCount + " job(s) already assigned today (\u2248" + Math.round(hosStatus.todayMinutes / 60) + " est. hrs). This is an estimate from job records, not a real ELD \u2014 verify with the driver before assigning another job.")),
                hosStatus && !hosStatus.overDailyDrive && hosStatus.nearDailyDrive && React.createElement("div", { style: { background: C.orange + "15", border: "1px solid " + C.orange + "44", borderRadius: 9, padding: "10px 14px", marginBottom: 14 } },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.orange } }, "\u26A0 Approaching daily driving limit \u2014 \u2248" + Math.round(hosStatus.todayMinutes / 60) + " est. hrs today already.")),
                hosStatus && hosStatus.overWeekly && React.createElement("div", { style: { background: C.red + "18", border: "1px solid " + C.red + "44", borderRadius: 9, padding: "10px 14px", marginBottom: 14 } },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.red } }, "\uD83D\uDEA8 Likely over the 60-hour weekly limit \u2014 " + hosStatus.weekJobCount + " jobs in the last 7 days."))),
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
            payObj.discount && React.createElement("div", { style: { background: C.green + "12", border: "1px solid " + C.green + "33", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: C.green, fontWeight: 600 } }, "💵 10% Cash Discount — Cash price: $" + q.total + " (saves $" + q.cashDisc + "). Payment due in full at pickup."),
            React.createElement("div", { style: { background: C.card, border: "1.5px solid " + (f.customPriceOn ? C.purple : C.border), borderRadius: 9, padding: "10px 12px", marginBottom: 14 } },
                React.createElement("div", { onClick: function () { set("customPriceOn", !f.customPriceOn); }, style: { display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" } },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: f.customPriceOn ? C.purple : C.white } }, "\uD83C\uDF9B Custom Price Override"),
                    React.createElement("div", { style: { width: 18, height: 18, borderRadius: "50%", background: f.customPriceOn ? C.purple : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", fontWeight: 700 } }, f.customPriceOn ? "✓" : "")),
                f.customPriceOn && React.createElement("input", { type: "number", value: f.customPrice, onChange: function (e) { set("customPrice", e.target.value); }, placeholder: "Calculator says $" + calculatedTotal, style: { marginTop: 8, background: C.surface, border: "1px solid " + C.border, borderRadius: 7, color: C.white, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } })),
            React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "33", borderRadius: 9, padding: "12px 14px", marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center" } },
                React.createElement("span", { style: { color: C.dim, fontSize: 13 } }, "Quoted Price"),
                React.createElement("span", { style: { color: C.orange, fontSize: 24, fontWeight: 900 } }, "$" + finalTotal)),
            React.createElement("div", { style: { display: "flex", gap: 8 } },
                React.createElement(Btn, { variant: "ghost", onClick: props.onClose, style: { flex: 1 } }, "Cancel"),
                React.createElement(Btn, { onClick: submit, disabled: !f.customer || !f.origin || ((!isLoadSizeSvc && !isCleanoutSvc) && !f.destination) || (isMileageSvc && !(miles > 0)), style: { flex: 2 } }, "Save Job \u2713"))));
}
// ── JOBS DASHBOARD ────────────────────────────────────────────────
function JobsDashboard(props) {
    var jobs = props.jobs;
    var onUpdateStatus = props.onUpdateStatus;
    var onAddJob = props.onAddJob;
    var gas = props.gasPPG || FALLBACK_GAS;
    var diesel = props.dieselPPG || FALLBACK_DIESEL;
    var [filter, setFilter] = useState("All");
    var [sel, setSel] = useState(null);
    var [showNew, setShowNew] = useState(false);
    var [search, setSearch] = useState("");
    var [selected, setSelected] = useState([]); // for bulk actions
    var [showBulk, setShowBulk] = useState(false);
    var [bulkStatus, setBulkStatus] = useState("");
    var [showLanes, setShowLanes] = useState(false);
    var [showDeadhead, setShowDeadhead] = useState(false);
    var [deadheadMiles, setDeadheadMiles] = useState("");
    var [deadheadDate, setDeadheadDate] = useState(new Date().toISOString().split("T")[0]);
    var lanes = loadLanes();
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
    function toggleSelect(id) { setSelected(function (p) { return p.indexOf(id) > -1 ? p.filter(function (x) { return x !== id; }) : [...p, id]; }); }
    function selectAll() { setSelected(list.map(function (j) { return j.id; })); }
    function clearSelect() { setSelected([]); }
    function applyBulkStatus() {
        if (!bulkStatus)
            return;
        selected.forEach(function (id) { onUpdateStatus(id, bulkStatus); });
        clearSelect();
        setShowBulk(false);
        setBulkStatus("");
    }
    function cloneJob(job) {
        var cloned = Object.assign({}, job, { id: makeJobId(), status: "New", date: new Date().toISOString().split("T")[0], paymentIntentId: null, paidOnline: false, notes: (job.notes || "") + " [CLONED]" });
        onAddJob(cloned);
    }
    return React.createElement("div", { style: { maxWidth: 700, margin: "0 auto" } },
        showNew && React.createElement(NewJobModal, { onAdd: function (j) { onAddJob(j); setShowNew(false); }, onClose: function () { setShowNew(false); }, allJobs: jobs }),
        showLanes && React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
                setShowLanes(false); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000CC", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
            React.createElement("div", { style: { background: C.card, borderRadius: 14, width: "100%", maxWidth: 560, maxHeight: "80vh", overflowY: "auto", padding: "20px" } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white } }, "\uD83D\uDDFA Lane History"),
                    React.createElement("button", { onClick: function () { setShowLanes(false); }, style: { background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer" } }, "\u2715")),
                lanes.length === 0 ? React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "30px 0" } }, "No lane history yet. Complete jobs will build your lane data.")
                    : lanes.map(function (l) {
                        return React.createElement("div", { key: l.key, style: { background: C.surface, borderRadius: 9, padding: "12px 14px", marginBottom: 8 } },
                            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white } }, l.key),
                                React.createElement("div", { style: { fontSize: 14, fontWeight: 900, color: C.orange } },
                                    "$",
                                    l.avgRevenue.toLocaleString(),
                                    " avg")),
                            React.createElement("div", { style: { fontSize: 10, color: C.dim, marginTop: 4 } },
                                l.count,
                                " run",
                                l.count !== 1 ? "s" : "",
                                " \u00B7 Total $",
                                l.totalRevenue.toLocaleString(),
                                " \u00B7 Last: ",
                                l.lastDate));
                    }))),
        showDeadhead && React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
                setShowDeadhead(false); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000CC", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
            React.createElement("div", { style: { background: C.card, borderRadius: 14, width: "100%", maxWidth: 400, padding: "20px" } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white } }, "\uD83D\uDE9B Log Deadhead Miles"),
                    React.createElement("button", { onClick: function () { setShowDeadhead(false); }, style: { background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer" } }, "\u2715")),
                React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 14 } }, "Empty miles between loads \u2014 tracked separately for accurate cost analysis."),
                React.createElement(Lbl, null, "Date"),
                React.createElement("input", { type: "date", value: deadheadDate, onChange: function (e) { setDeadheadDate(e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "10px 14px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12, colorScheme: "dark" } }),
                React.createElement(TxtIn, { label: "Deadhead Miles", value: deadheadMiles, onChange: setDeadheadMiles, type: "number", placeholder: "e.g. 45" }),
                React.createElement("div", { style: { background: C.surface, borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.dim } },
                    "Fuel cost: ",
                    React.createElement("span", { style: { color: C.red, fontWeight: 700 } },
                        "$",
                        deadheadMiles > 0 ? Math.round((Number(deadheadMiles) / TRUCK_MPG) * gas).toFixed(2) : "0.00")),
                React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setShowDeadhead(false); }, style: { flex: 1 } }, "Cancel"),
                    React.createElement(Btn, { onClick: function () {
                            if (!deadheadMiles)
                                return;
                            var exp = { id: Date.now(), date: deadheadDate, type: "fuel", amount: Number(((Number(deadheadMiles) / TRUCK_MPG) * gas).toFixed(2)), note: "Deadhead " + deadheadMiles + " miles", jobId: "" };
                            var exps = loadExpenses();
                            exps.unshift(exp);
                            saveExpenses(exps);
                            setShowDeadhead(false);
                            setDeadheadMiles("");
                        }, disabled: !deadheadMiles, style: { flex: 2 } }, "Log Deadhead \u2713")))),
        selected.length > 0 && React.createElement("div", { style: { background: C.orange, borderRadius: 10, padding: "10px 14px", marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" } },
            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "#000" } },
                selected.length,
                " job",
                selected.length !== 1 ? "s" : "",
                " selected"),
            React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
                React.createElement("select", { value: bulkStatus, onChange: function (e) { setBulkStatus(e.target.value); }, style: { background: "#000", color: C.white, border: "none", borderRadius: 7, padding: "6px 10px", fontSize: 11, fontFamily: "inherit" } },
                    React.createElement("option", { value: "" }, "Change Status..."),
                    STATUS_FLOW.map(function (s) { return React.createElement("option", { key: s, value: s }, s); })),
                React.createElement(Btn, { onClick: applyBulkStatus, disabled: !bulkStatus, style: { padding: "6px 12px", fontSize: 11, background: "#000", color: C.orange } }, "Apply"),
                React.createElement(Btn, { onClick: clearSelect, variant: "ghost", style: { padding: "6px 10px", fontSize: 11, color: "#000", border: "1px solid #000" } }, "\u2715 Clear"))),
        React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: "10px 16px", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 } },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" } },
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                    React.createElement("span", { style: { fontSize: 16 } }, "\u26FD"),
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" } }, "Regular \u00B7 Georgia"),
                        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.orange } },
                            "$" + gas.toFixed(2),
                            React.createElement("span", { style: { fontSize: 11, color: C.dim, fontWeight: 400 } }, "/gal")))),
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                    React.createElement("span", { style: { fontSize: 16 } }, "\uD83D\uDEE2"),
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1.2, textTransform: "uppercase" } }, "Diesel \u00B7 Georgia"),
                        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: "#4299E1" } },
                            "$" + diesel.toFixed(2),
                            React.createElement("span", { style: { fontSize: 11, color: C.dim, fontWeight: 400 } }, "/gal"))))),
            React.createElement("div", { style: { display: "flex", gap: 12 } }, [["Local", "$" + fL.cost], ["Regional", "$" + fR.cost], ["Long Dist", "$" + fLd.cost]].map(function (row) {
                return React.createElement("div", { key: row[0], style: { textAlign: "center" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim } }, row[0]),
                    React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: C.white } }, row[1]));
            })),
            React.createElement("div", { style: { fontSize: 10, color: C.faint } }, "16ft · 93\" wide · 4,300 lb max · " + TRUCK_MPG + " MPG · RT · fuel est. below uses Regular")),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 18 } }, [{ l: "Revenue", v: "$" + rev.toLocaleString(), c: C.orange }, { l: "Net Profit", v: "$" + profit.toLocaleString(), c: profit >= 0 ? C.green : C.red },
            { l: "Active", v: jobs.filter(function (j) { return j.status !== "Completed" && j.status !== "Paid" && j.status !== "Cancelled"; }).length, c: C.yellow },
            { l: "Completed", v: jobs.filter(function (j) { return j.status === "Completed" || j.status === "Paid"; }).length, c: C.dim }
        ].map(function (k) {
            return React.createElement(Card, { key: k.l, style: { padding: "14px 16px" } },
                React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2, marginBottom: 4 } }, k.l),
                React.createElement("div", { style: { fontSize: 26, fontWeight: 900, color: k.c } }, k.v));
        })),
        React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 10, alignItems: "center", flexWrap: "wrap" } },
            React.createElement("input", { value: search, onChange: function (e) { setSearch(e.target.value); }, placeholder: "Search by name or Job ID...", style: { flex: 1, minWidth: 160, background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.white, padding: "8px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" } }),
            React.createElement(Btn, { onClick: function () { setShowNew(true); }, style: { flexShrink: 0, padding: "8px 14px", fontSize: 12 } }, "\u2795 New Job"),
            React.createElement(Btn, { onClick: function () { setShowLanes(true); }, variant: "ghost", style: { flexShrink: 0, padding: "8px 12px", fontSize: 11 } }, "\uD83D\uDDFA Lanes"),
            React.createElement(Btn, { onClick: function () { setShowDeadhead(true); }, variant: "ghost", style: { flexShrink: 0, padding: "8px 12px", fontSize: 11 } }, "\uD83D\uDE9B Deadhead"),
            selected.length === 0 ? React.createElement(Btn, { onClick: selectAll, variant: "ghost", style: { flexShrink: 0, padding: "8px 12px", fontSize: 11 } }, "\u2611 Select All") : React.createElement(Btn, { onClick: clearSelect, variant: "ghost", style: { flexShrink: 0, padding: "8px 12px", fontSize: 11 } }, "\u2715 Clear")),
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
                var isChecked = selected.indexOf(j.id) > -1;
                return React.createElement(Card, { key: j.id, style: { padding: "13px 16px", cursor: "pointer", border: (isChecked ? "1.5px solid " + C.orange : sel === j.id ? "1.5px solid " + C.orange : "1px solid " + C.border), background: isChecked ? C.orangeSoft : C.card } },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                        React.createElement("div", { onClick: function () { toggleSelect(j.id); }, style: { width: 20, height: 20, borderRadius: 5, background: isChecked ? C.orange : "transparent", border: "1.5px solid " + (isChecked ? C.orange : C.border), display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: "#000", fontWeight: 800, flexShrink: 0, marginRight: 10 } }, isChecked ? "✓" : ""),
                        React.createElement("div", { onClick: function () { setSel(sel === j.id ? null : j.id); }, style: { flex: 1, display: "flex", justifyContent: "space-between", alignItems: "center" } },
                            React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, j.id + " — " + j.customer),
                                React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2 } }, j.serviceName + " · " + j.origin + " → " + j.destination)),
                            React.createElement("div", { style: { textAlign: "right", flexShrink: 0, marginLeft: 12 } },
                                React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: C.orange } }, "$" + j.finalPrice),
                                React.createElement(Tag, { color: STATUS_COLOR[j.status] || C.dim }, j.status)))),
                    sel === j.id && React.createElement("div", { style: { marginTop: 14, borderTop: "1px solid " + C.border, paddingTop: 14 } },
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } },
                            React.createElement("span", { style: { color: C.dim, fontSize: 12 } }, j.phone),
                            React.createElement("div", { style: { display: "flex", gap: 8 } },
                                React.createElement(Btn, { onClick: function (e) { e.stopPropagation(); cloneJob(j); }, variant: "ghost", style: { padding: "4px 10px", fontSize: 10 } }, "\uD83D\uDCCB Clone"),
                                React.createElement(CallBtns, { phone: j.phone }))),
                        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 } }, [["Payment", payLbl], ["Speed", spdLbl], ["Date", j.date], ["Booked By", j.salesperson || "—"], ["Fuel (est)", "$" + jFuel], ["Net Profit", "$" + jProfit], ["Pricing", (PRICE_TIERS.find(function (t) { return t.id === j.priceTier; }) || PRICE_TIERS[0]).label], ["Business", j.isBusiness ? "Yes" : "No"]].map(function (row) {
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
// ─── OUT-OF-STATE BOOKING VIEW ────────────────────────────────────────
function OOSBookingView(props) {
    var onBook = props.onBook;
    var gasPPG = props.gasPPG || FALLBACK_GAS;
    var sf = useState({
        name: "", phone: "", originCity: "Conyers, GA", destCity: "",
        speed: "standard", service: "delivery", notes: "", payment: "cash",
        discreet: false, helper: false, weightTier: "light", tosAccepted: false,
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
            service: "delivery", notes: "", payment: "cash", discreet: false, helper: false, weightTier: "light", tosAccepted: false });
        setQuote(null);
        setJobId(null);
        setErr("");
    }
    var STEPS = ["Service", "Route", "Quote", "Done"];
    // STEP 1 — Service type
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
    // STEP 2 — Route + details
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
    // STEP 3 — Quote
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
                    React.createElement("div", { style: { color: C.dim } }, "Cash or Card accepted. No deposit required in advance.")),
                React.createElement("div", { style: { background: C.surface, borderRadius: 9, padding: "10px 14px", marginBottom: 18, fontSize: 12, color: C.dim, lineHeight: 1.7 } },
                    "\u26A0 ",
                    React.createElement("strong", { style: { color: C.yellow } }, "One-Way Job:"),
                    " This covers pickup to destination only. Return transport is a separate booking. Mileage is estimated \u2014 final miles confirmed at pickup."),
                !showCardForm && React.createElement(TosCheckbox, { value: form.tosAccepted, onChange: function (v) { set("tosAccepted", v); } }),
                !showCardForm && React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setStep(2); }, style: { flex: 1 } }, "\u2190 Back"),
                    React.createElement(Btn, { onClick: handleConfirmClick, disabled: !form.tosAccepted, style: { flex: 2 } }, form.payment === "card" ? "Continue to Payment 💳" : "Confirm & Book 🚐")),
                showCardForm && React.createElement(StripeCardForm, { amount: pay.discount ? (quote.total - Math.round(quote.total * 0.10)) : quote.total, jobId: "pending", customerName: form.name, onCancel: function () { setShowCardForm(false); }, onSuccess: function (paymentIntentId) { doBook(paymentIntentId); } })));
    // STEP 4 — Confirmed
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
// ─── PHONE QUOTE PANEL ────────────────────────────────────────────────
// Built for live phone calls — fill in as customer talks, quote updates instantly
function PhoneQuotePanel(props) {
    var onAddJob = props.onAddJob;
    var gasPPG = props.gasPPG || FALLBACK_GAS;
    var sf = useState({
        name: "", phone: "", serviceId: "delivery", zone: "local",
        speed: "standard", payment: "cash", helper: false, weightTier: "light",
        extraStop: false, discreet: false, isBusiness: false,
        origin: "", destination: "", miles: "", notes: "",
        isOOS: false, destCity: "", originCity: "Conyers, GA", priceTier: "standard",
        customPriceOn: false, customPrice: "",
        loadSize: "quarter", cleanoutTier: "2br", cleanoutSubtype: "", extraTruckloads: "0", emergencyAddons: [],
    });
    var form = sf[0];
    var setForm = sf[1];
    function set(k, v) { setForm(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); }
    function toggleAddon(id) { setForm(function (p) { var n = Object.assign({}, p); var list = p.emergencyAddons.slice(); var i = list.indexOf(id); if (i > -1)
        list.splice(i, 1);
    else
        list.push(id); n.emergencyAddons = list; return n; }); }
    var sc = useState(false);
    var confirmed = sc[0];
    var setConfirmed = sc[1];
    var sj = useState(null);
    var savedJob = sj[0];
    var setSavedJob = sj[1];
    var isMileageSvc = !form.isOOS && MILEAGE_SERVICES.indexOf(form.serviceId) > -1;
    var isLoadSizeSvc = !form.isOOS && form.serviceId === "junkremoval";
    var isCleanoutSvc = !form.isOOS && form.serviceId === "cleanout";
    var gaCities = Object.keys(CITY_COORDS).filter(function (c) { return c.indexOf(", GA") > -1; });
    var destKeys = Object.keys(CITY_COORDS).filter(function (c) { return c.indexOf(", GA") === -1; });
    var [autoInstMiles, setAutoInstMiles] = useState(null);
    var [geoLoading, setGeoLoading] = useState(false);
    var [geoFailed, setGeoFailed] = useState(false);
    useEffect(function () {
        if (!isMileageSvc || !form.origin || !form.destination) {
            setAutoInstMiles(null);
            setGeoFailed(false);
            setGeoLoading(false);
            return;
        }
        var cancelled = false;
        setGeoLoading(true);
        setGeoFailed(false);
        var timer = setTimeout(function () {
            calcRealMilesFromAddresses(form.origin, form.destination).then(function (result) {
                if (cancelled)
                    return;
                setGeoLoading(false);
                if (result == null) {
                    setAutoInstMiles(null);
                    setGeoFailed(true);
                }
                else {
                    setAutoInstMiles(result);
                    setGeoFailed(false);
                }
            });
        }, 900);
        return function () { cancelled = true; clearTimeout(timer); };
    }, [form.origin, form.destination, isMileageSvc]);
    var instMiles = isMileageSvc ? (autoInstMiles != null ? autoInstMiles : (Number(form.miles) || 0)) : 0;
    // Live quote — recalculates on every field change
    var q = form.isOOS
        ? (form.destCity ? calcOOSQuote(form.originCity, form.destCity, form.speed, form.helper, form.weightTier, form.priceTier) : null)
        : isLoadSizeSvc ? calcJunkRemovalQuote(form.loadSize, form.payment, form.emergencyAddons)
            : isCleanoutSvc ? calcCleanoutQuote(form.cleanoutTier, form.payment, form.extraTruckloads)
                : calcQuote(form.serviceId, form.zone, form.speed, form.payment, form.helper, form.discreet, form.weightTier, form.extraStop, instMiles, form.priceTier);
    var payObj = PAYMENTS.find(function (p) { return p.id === form.payment; }) || PAYMENTS[0];
    var oosPayDisc = (form.isOOS && q && payObj.discount) ? Math.round(q.total * 0.10) : 0;
    var calculatedTotal = form.isOOS
        ? (q ? (q.total - oosPayDisc) : 0)
        : (q ? q.total : 0);
    var displayTotal = (form.customPriceOn && Number(form.customPrice) > 0) ? Number(form.customPrice) : calculatedTotal;
    function bookIt() {
        if (!form.name || !displayTotal)
            return;
        var customNote = (form.customPriceOn && Number(form.customPrice) > 0) ? (" · CUSTOM PRICE (calc'd: $" + calculatedTotal + ")") : "";
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
                notes: "OUT-OF-STATE · " + q.miles + " mi · $" + q.rate + "/mi" + customNote + (form.notes ? " — " + form.notes : ""),
                helperHours: 0, fuel: q.fuelCost, weightTier: form.weightTier, oosJob: true,
                miles: q.miles, ratePerMile: q.rate, priceTier: form.priceTier,
            };
        }
        else if (q) {
            var svc2 = SERVICES.find(function (s) { return s.id === form.serviceId; }) || SERVICES[0];
            var statusForJob = isCleanoutSvc ? "Pending Quote" : "Confirmed";
            var notesForJob;
            if (isLoadSizeSvc)
                notesForJob = form.loadSize + " load" + customNote + (form.notes ? " — " + form.notes : "");
            else if (isCleanoutSvc)
                notesForJob = (form.cleanoutSubtype ? CLEANOUT_SUBTYPES.find(function (s) { return s.id === form.cleanoutSubtype; }).label + " — " : "") + q.tier.label + customNote + (form.notes ? " — " + form.notes : "");
            else
                notesForJob = (isMileageSvc ? (instMiles + " mi · $" + INSTATE_RATE_PER_MILE + "/mi") : "") + customNote + (form.notes ? " — " + form.notes : "");
            job = {
                id: id, customer: form.name, phone: form.phone,
                service: form.serviceId, serviceName: svc2.name,
                origin: form.origin,
                destination: form.destination || form.origin,
                zone: form.zone, speed: form.speed,
                basePrice: q.base, finalPrice: displayTotal,
                status: statusForJob, payment: form.payment,
                discreet: form.discreet, isBusiness: form.isBusiness,
                date: new Date().toISOString().split("T")[0],
                notes: notesForJob,
                helperHours: 0, fuel: calcFuel(form.zone, gasPPG).cost,
                weightTier: form.weightTier, miles: isMileageSvc ? instMiles : null,
                priceTier: form.priceTier,
            };
        }
        if (job) {
            var taggedJob = Object.assign({}, job, { salesperson: props.currentUser ? props.currentUser.name : "Unknown", createdBy: props.currentUser ? props.currentUser.id : "unknown" });
            onAddJob(taggedJob);
            sendEmail(taggedJob);
            setSavedJob(taggedJob);
            setConfirmed(true);
        }
    }
    function reset() {
        setForm({ name: "", phone: "", serviceId: "delivery", zone: "local", speed: "standard",
            payment: "cash", helper: false, weightTier: "light", extraStop: false, discreet: false,
            isBusiness: false, origin: "", destination: "", miles: "", notes: "",
            isOOS: false, destCity: "", originCity: "Conyers, GA", priceTier: "standard",
            customPriceOn: false, customPrice: "",
            loadSize: "quarter", cleanoutTier: "2br", cleanoutSubtype: "", extraTruckloads: "0", emergencyAddons: [] });
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
                (!isLoadSizeSvc && !isCleanoutSvc) && React.createElement("div", { style: { background: C.card, border: "2px solid " + C.orange + "44", borderRadius: 12, padding: "14px 16px", marginBottom: 10 } },
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
                    (isLoadSizeSvc || isCleanoutSvc) ? React.createElement("div", null,
                        React.createElement(TxtIn, { label: "Pickup Address", value: form.origin, onChange: function (v) { set("origin", v); }, placeholder: "Street, City, State (e.g. 123 Main St, Conyers, GA)" })) : form.isOOS ? React.createElement("div", null,
                        React.createElement(Lbl, null, "Pickup (Georgia)"),
                        React.createElement("div", { style: { marginBottom: 12 } },
                            React.createElement("select", { value: form.originCity, onChange: function (e) { set("originCity", e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "10px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } }, gaCities.map(function (c) { return React.createElement("option", { key: c, value: c }, c); }))),
                        React.createElement(Lbl, null, "Destination City"),
                        React.createElement("select", { value: form.destCity, onChange: function (e) { set("destCity", e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "10px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } },
                            React.createElement("option", { value: "" }, "\u2014 Select destination \u2014"),
                            destKeys.sort().map(function (c) { return React.createElement("option", { key: c, value: c }, c); }))) : isMileageSvc ? React.createElement("div", null,
                        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" } },
                            React.createElement(TxtIn, { label: "Pickup Address", value: form.origin, onChange: function (v) { set("origin", v); }, placeholder: "Street, City, State (e.g. 123 Main St, Conyers, GA)" }),
                            React.createElement(TxtIn, { label: "Drop-Off Address", value: form.destination, onChange: function (v) { set("destination", v); }, placeholder: "Street, City, GA" })),
                        geoLoading && React.createElement("div", { style: { fontSize: 12, color: C.dim, marginTop: 4 } }, "\uD83D\uDCCD Calculating distance..."),
                        !geoLoading && geoFailed && React.createElement(TxtIn, { label: "Estimated Distance (miles)", value: form.miles, onChange: function (v) { set("miles", v); }, type: "number", placeholder: "e.g. 12" }),
                        !geoLoading && instMiles > 0 && React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "33", borderRadius: 9, padding: "8px 12px", marginTop: 4, fontSize: 12, color: C.dim } }, (autoInstMiles != null ? "Auto-detected: " : "") + instMiles + " miles × $" + INSTATE_RATE_PER_MILE + "/mi = $" + Math.round(instMiles * INSTATE_RATE_PER_MILE))) : React.createElement("div", null,
                        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px" } },
                            React.createElement(TxtIn, { label: "Pickup", value: form.origin, onChange: function (v) { set("origin", v); }, placeholder: "City, GA" }),
                            React.createElement(TxtIn, { label: "Drop-Off", value: form.destination, onChange: function (v) { set("destination", v); }, placeholder: "City, GA" })),
                        React.createElement(Lbl, null, "Zone"),
                        React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 10 } }, ZONES.map(function (z) {
                            return React.createElement("div", { key: z.id, onClick: function () { set("zone", z.id); }, style: { flex: 1, border: "1.5px solid " + (form.zone === z.id ? C.orange : C.border), borderRadius: 8, padding: "8px 4px", cursor: "pointer", background: form.zone === z.id ? C.orangeSoft : "transparent", textAlign: "center" } },
                                React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: form.zone === z.id ? C.orange : C.white } }, z.label),
                                React.createElement("div", { style: { fontSize: 10, color: C.dim } }, z.sub));
                        })))),
                isLoadSizeSvc && React.createElement("div", null,
                    React.createElement("div", { style: { background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 16px", marginBottom: 10 } },
                        React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 } }, "\uD83D\uDDD1\uFE0F Load Size"),
                        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, LOAD_SIZES.map(function (l) {
                            return React.createElement("div", { key: l.id, onClick: function () { set("loadSize", l.id); }, style: { border: "1.5px solid " + (form.loadSize === l.id ? C.orange : C.border), borderRadius: 9, padding: "9px 12px", cursor: "pointer", background: form.loadSize === l.id ? C.orangeSoft : "transparent", display: "flex", justifyContent: "space-between" } },
                                React.createElement("div", null,
                                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: form.loadSize === l.id ? C.orange : C.white } }, l.label),
                                    React.createElement("div", { style: { fontSize: 10, color: C.dim } }, l.sub)),
                                React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: form.loadSize === l.id ? C.orange : C.dim } }, "$" + l.price));
                        }))),
                    React.createElement("div", { style: { background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 16px", marginBottom: 10 } },
                        React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 } }, "\uD83D\uDEA8 Rush / Emergency Add-Ons"),
                        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, EMERGENCY_ADDONS.map(function (a) {
                            var on = form.emergencyAddons.indexOf(a.id) > -1;
                            return React.createElement("div", { key: a.id, onClick: function () { toggleAddon(a.id); }, style: { border: "1.5px solid " + (on ? C.purple : C.border), borderRadius: 9, padding: "9px 12px", cursor: "pointer", background: on ? C.purple + "15" : "transparent", display: "flex", justifyContent: "space-between" } },
                                React.createElement("div", { style: { fontSize: 12, fontWeight: 600, color: on ? C.purple : C.white } }, a.label),
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: on ? C.purple : C.dim } }, "+$" + a.fee));
                        }))),
                    React.createElement("div", { style: { background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 16px", marginBottom: 10 } },
                        React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 } }, "\uD83D\uDCB2 Dump Fee Reference (admin only)"),
                        React.createElement("div", { style: { fontSize: 10, color: C.dim, marginBottom: 8 } }, "3x markup suggested \u2014 add manually via Custom Price Override below if the load has these items."),
                        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 } }, DUMP_FEES.map(function (d) { return React.createElement("div", { key: d.id, style: { fontSize: 10, color: C.dim, display: "flex", justifyContent: "space-between" } },
                            React.createElement("span", null, d.label),
                            React.createElement("span", { style: { color: C.purple, fontWeight: 700 } }, "+$" + d.markup)); })))),
                isCleanoutSvc && React.createElement("div", null,
                    React.createElement("div", { style: { background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "14px 16px", marginBottom: 10 } },
                        React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 } }, "\uD83C\uDFE0 Property Size"),
                        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 } }, CLEANOUT_TIERS.map(function (t) {
                            return React.createElement("div", { key: t.id, onClick: function () { set("cleanoutTier", t.id); }, style: { border: "1.5px solid " + (form.cleanoutTier === t.id ? C.orange : C.border), borderRadius: 9, padding: "9px 12px", cursor: "pointer", background: form.cleanoutTier === t.id ? C.orangeSoft : "transparent", display: "flex", justifyContent: "space-between" } },
                                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: form.cleanoutTier === t.id ? C.orange : C.white } }, t.label),
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: form.cleanoutTier === t.id ? C.orange : C.dim } }, t.startPrice > 0 ? ("$" + t.startPrice) : "Custom"));
                        })),
                        React.createElement(Lbl, null, "Cleanout Type (optional)"),
                        React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 } }, CLEANOUT_SUBTYPES.map(function (s) {
                            return React.createElement("div", { key: s.id, onClick: function () { set("cleanoutSubtype", form.cleanoutSubtype === s.id ? "" : s.id); }, style: { border: "1px solid " + (form.cleanoutSubtype === s.id ? C.orange : C.border), borderRadius: 7, padding: "5px 10px", cursor: "pointer", background: form.cleanoutSubtype === s.id ? C.orangeSoft : "transparent", fontSize: 10, fontWeight: 600, color: form.cleanoutSubtype === s.id ? C.orange : C.dim } }, s.label);
                        })),
                        React.createElement(TxtIn, { label: "Extra Truckloads Beyond First", value: form.extraTruckloads, onChange: function (v) { set("extraTruckloads", v); }, type: "number", placeholder: "0" })),
                    form.cleanoutTier === "commercial" && React.createElement("div", { style: { background: C.card, border: "1.5px solid " + C.purple + "44", borderRadius: 12, padding: "14px 16px", marginBottom: 10 } },
                        React.createElement("div", { style: { fontSize: 11, color: C.purple, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 6 } }, "\uD83C\uDFDB Institutional / Bulk Debris Hauling"),
                        React.createElement("div", { style: { fontSize: 10, color: C.dim, marginBottom: 10, lineHeight: 1.6 } }, INSTITUTIONAL_DISCOUNT_NOTE),
                        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, INSTITUTIONAL_TYPES.map(function (it) {
                            return React.createElement("div", { key: it.id, style: { border: "1px solid " + C.border, borderRadius: 9, padding: "9px 12px", background: C.surface } },
                                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white } }, it.label),
                                React.createElement("div", { style: { fontSize: 10, color: C.dim, marginTop: 2 } }, it.sub),
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: C.purple, marginTop: 3 } }, it.maxPrice > 0 ? ("$" + it.minPrice.toLocaleString() + " – $" + it.maxPrice.toLocaleString()) : ("$" + it.minPrice.toLocaleString() + "+ — custom contract")));
                        })),
                        React.createElement("div", { style: { fontSize: 10, color: C.faint, marginTop: 10, lineHeight: 1.6 } }, "Sold as a flat negotiated number, not shown to customer as a formula. Agree on a price, then enter it below via Custom Price Override."))),
                (!isLoadSizeSvc && !isCleanoutSvc) && React.createElement("div", null,
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
                        form.serviceId === "discreet" && React.createElement(Toggle, { label: "Discreet handling (+35%)", value: form.discreet, onChange: function (v) { set("discreet", v); } }))),
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
                React.createElement(Btn, { onClick: bookIt, disabled: !form.name || !displayTotal, style: { width: "100%", padding: "13px", fontSize: 14, marginBottom: 8 } }, isCleanoutSvc ? "📋 Save Pending Quote" : "✅ Book It"),
                React.createElement(Btn, { variant: "ghost", onClick: reset, style: { width: "100%", padding: "10px", fontSize: 12 } }, "\uD83D\uDD04 New Quote"),
                !form.isOOS && React.createElement("div", { style: { marginTop: 10, background: C.surface, borderRadius: 9, padding: "10px 12px", fontSize: 11, color: C.dim } },
                    React.createElement("div", { style: { color: C.white, fontWeight: 700, marginBottom: 4 } }, "\u26FD GA Gas Today"),
                    React.createElement("div", null, "$" + gasPPG.toFixed(2) + "/gal · Est. fuel: $" + calcFuel(form.zone, gasPPG).cost)))));
}
// ── ADMIN DASHBOARD ───────────────────────────────────────────────
// ── AUDIT TRAIL ───────────────────────────────────────────────────────
function loadAudit() { try {
    var r = localStorage.getItem("pl_audit");
    return r ? JSON.parse(r) : [];
}
catch (e) {
    return [];
} }
function saveAudit(entries) { try {
    localStorage.setItem("pl_audit", JSON.stringify(entries.slice(0, 500)));
}
catch (e) { } }
function addAuditEntry(action, jobId, field, before, after, role) {
    var entries = loadAudit();
    entries.unshift({ id: Date.now(), ts: new Date().toISOString(), action: action, jobId: jobId || "", field: field || "", before: String(before || ""), after: String(after || ""), role: role || "unknown" });
    saveAudit(entries);
}
// ── EXPENSES ──────────────────────────────────────────────────────────
function loadExpenses() { try {
    var r = localStorage.getItem("pl_expenses");
    return r ? JSON.parse(r) : [];
}
catch (e) {
    return [];
} }
function saveExpenses(e) { try {
    localStorage.setItem("pl_expenses", JSON.stringify(e));
}
catch (e2) { } }
// ── ACCESSORIAL CHARGES — detention, layover, lumper fees, etc. ─────
// Kept separate from expenses (which are costs the business pays out)
// since these are charges owed TO the business BY the customer — closer
// to unbilled revenue than a cost. Dispatch reviews and approves before
// they get added to a job's final invoice, so a bad GPS timestamp or an
// honest driver delay doesn't silently overbill a customer.
function loadAccessorialCharges() { try {
    var r = localStorage.getItem("pl_accessorial_charges");
    return r ? JSON.parse(r) : [];
}
catch (e) {
    return [];
} }
function saveAccessorialCharges(c) { try {
    localStorage.setItem("pl_accessorial_charges", JSON.stringify(c));
}
catch (e) { } }
function addAccessorialCharge(charge) {
    var charges = loadAccessorialCharges();
    charges.unshift(charge);
    saveAccessorialCharges(charges);
}
// ── DOCUMENT LOG — BOL/load numbers, seal numbers, packing lists, weight
// tickets, fuel receipts. Each entry can optionally link to a job. ──────
function loadDocuments() { try {
    var r = localStorage.getItem("pl_documents");
    return r ? JSON.parse(r) : [];
}
catch (e) {
    return [];
} }
function saveDocuments(d) { try {
    localStorage.setItem("pl_documents", JSON.stringify(d));
}
catch (e) { } }
function addDocument(doc) {
    var docs = loadDocuments();
    docs.unshift(Object.assign({ id: Date.now() }, doc));
    saveDocuments(docs);
    return docs;
}
// ── REVIEWS ───────────────────────────────────────────────────────────
function loadReviews() { try {
    var r = localStorage.getItem("pl_reviews");
    return r ? JSON.parse(r) : [];
}
catch (e) {
    return [];
} }
function saveReviews(r) { try {
    localStorage.setItem("pl_reviews", JSON.stringify(r));
}
catch (e) { } }
// ── SALES LEADS ───────────────────────────────────────────────────────
function loadLeads() { try {
    var r = localStorage.getItem("pl_leads");
    return r ? JSON.parse(r) : [];
}
catch (e) {
    return [];
} }
function saveLeads(l) { try {
    localStorage.setItem("pl_leads", JSON.stringify(l));
}
catch (e) { } }
// ── REVIEW MODAL (PUBLIC) ─────────────────────────────────────────────
function ReviewModal(props) {
    var [f, setF] = useState({ name: "", jobId: "", rating: 5, comment: "" });
    var [sent, setSent] = useState(false);
    function set(k, v) { setF(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); }
    function submit() {
        if (!f.name || !f.comment)
            return;
        var reviews = loadReviews();
        reviews.unshift({ id: Date.now(), name: f.name, jobId: f.jobId, rating: f.rating, comment: f.comment, date: new Date().toISOString().split("T")[0] });
        saveReviews(reviews);
        setSent(true);
    }
    return React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
            props.onClose(); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000CC", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
        React.createElement("div", { style: { background: C.card, borderRadius: 14, padding: "24px 20px", width: "100%", maxWidth: 480, fontFamily: "'DM Sans','Segoe UI',sans-serif" } }, sent ? React.createElement("div", { style: { textAlign: "center", padding: "20px 0" } },
            React.createElement("div", { style: { fontSize: 48, marginBottom: 12 } }, "\u2B50"),
            React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 8 } }, "Thank You!"),
            React.createElement("div", { style: { fontSize: 13, color: C.dim, marginBottom: 20 } }, "Your review means a lot to us and helps other customers choose Potent Logistics."),
            React.createElement(Btn, { onClick: props.onClose, style: { width: "100%" } }, "Close")) : React.createElement("div", null,
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
                React.createElement("div", { style: { fontSize: 17, fontWeight: 800, color: C.white } }, "Leave a Review"),
                React.createElement("button", { onClick: props.onClose, style: { background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer" } }, "\u2715")),
            React.createElement(TxtIn, { label: "Your Name", value: f.name, onChange: function (v) { set("name", v); }, placeholder: "First name or initials" }),
            React.createElement(TxtIn, { label: "Job ID (optional)", value: f.jobId, onChange: function (v) { set("jobId", v); }, placeholder: "e.g. PL-260615-A1B2" }),
            React.createElement(Lbl, null, "Rating"),
            React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 14 } }, [5, 4, 3, 2, 1].map(function (n) {
                return React.createElement("div", { key: n, onClick: function () { set("rating", n); }, style: { flex: 1, border: "1.5px solid " + (f.rating === n ? C.orange : C.border), borderRadius: 8, padding: "8px 4px", cursor: "pointer", background: f.rating === n ? C.orangeSoft : "transparent", textAlign: "center", fontSize: 18 } }, n >= f.rating ? "⭐" : "☆");
            })),
            React.createElement(TxtIn, { label: "Your Review", value: f.comment, onChange: function (v) { set("comment", v); }, placeholder: "Tell us about your experience...", rows: 3 }),
            React.createElement(Btn, { onClick: submit, disabled: !f.name || !f.comment, style: { width: "100%" } }, "Submit Review \u2B50"))));
}
// ── EXCEPTION DASHBOARD ───────────────────────────────────────────────
function ExceptionDashboard(props) {
    var jobs = props.jobs || [];
    var now = new Date();
    var todayStr = now.toISOString().split("T")[0];
    var lateJobs = jobs.filter(function (j) { return j.date < todayStr && j.status !== "Completed" && j.status !== "Paid" && j.status !== "Cancelled"; });
    var unassigned = jobs.filter(function (j) { return (j.status === "New" || j.status === "Confirmed") && !j.assignedTo; });
    var paymentFailed = jobs.filter(function (j) { return j.paymentFailed; });
    var cancelled = jobs.filter(function (j) { return j.status === "Cancelled"; });
    var priceOverrides = jobs.filter(function (j) { return j.notes && j.notes.indexOf("CUSTOM PRICE") > -1; });
    var pendingQuotes = jobs.filter(function (j) { return j.status === "Pending Quote"; });
    var [charges, setCharges] = useState(loadAccessorialCharges);
    var pendingCharges = charges.filter(function (c) { return c.status === "pending_approval"; });
    function approveCharge(charge) {
        if (props.onApplyAccessorial)
            props.onApplyAccessorial(charge.jobId, charge.amount, charge.type);
        var updated = charges.map(function (c) { return c.id === charge.id ? Object.assign({}, c, { status: "approved" }) : c; });
        setCharges(updated);
        saveAccessorialCharges(updated);
    }
    function dismissCharge(charge) {
        var updated = charges.map(function (c) { return c.id === charge.id ? Object.assign({}, c, { status: "dismissed" }) : c; });
        setCharges(updated);
        saveAccessorialCharges(updated);
    }
    function ExSection(props2) {
        if (!props2.items || props2.items.length === 0)
            return React.createElement("div", { style: { background: C.surface, borderRadius: 9, padding: "10px 14px", marginBottom: 10, fontSize: 12, color: C.green } }, "✅ " + props2.label + " — All clear");
        return React.createElement("div", { style: { marginBottom: 14 } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: props2.color || C.red } }, props2.icon + " " + props2.label),
                React.createElement("div", { style: { background: props2.color || C.red, color: "#fff", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 } }, props2.items.length)),
            props2.items.map(function (j) {
                return React.createElement("div", { key: j.id, style: { background: C.surface, borderRadius: 8, padding: "10px 12px", marginBottom: 6, fontSize: 12 } },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between" } },
                        React.createElement("span", { style: { color: C.white, fontWeight: 700 } }, j.id),
                        React.createElement("span", { style: { color: C.dim } }, j.date)),
                    React.createElement("div", { style: { color: C.dim, marginTop: 2 } },
                        j.customer,
                        " \u00B7 ",
                        j.serviceName),
                    React.createElement("div", { style: { color: props2.color || C.red, marginTop: 2, fontWeight: 600 } }, props2.note ? props2.note(j) : j.status));
            }));
    }
    return React.createElement("div", { style: { maxWidth: 700, margin: "0 auto" } },
        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 4 } }, "\uD83D\uDEA8 Exception Dashboard"),
        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 20 } }, "Items requiring your attention right now."),
        pendingCharges.length > 0 && React.createElement("div", { style: { marginBottom: 14 } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.green } }, "\uD83D\uDCB0 Detention / Accessorial Charges \u2014 Awaiting Approval"),
                React.createElement("div", { style: { background: C.green, color: "#000", borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 } }, pendingCharges.length)),
            pendingCharges.map(function (c) {
                var relatedJob = jobs.find(function (j) { return j.id === c.jobId; });
                return React.createElement("div", { key: c.id, style: { background: C.surface, borderRadius: 8, padding: "12px 14px", marginBottom: 6 } },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 4 } },
                        React.createElement("span", { style: { color: C.white, fontWeight: 700, fontSize: 13 } }, c.type + " \u2014 " + c.jobId),
                        React.createElement("span", { style: { color: C.green, fontWeight: 800, fontSize: 15 } }, "+$" + c.amount)),
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 8 } },
                        (relatedJob ? relatedJob.customer + " \u00B7 " : "") + c.minutesOnSite + " min on site (" + c.freeMinutes + " min free) \u00B7 " + c.billableHours + " billable hrs @ $" + c.rate + "/hr"),
                    React.createElement("div", { style: { display: "flex", gap: 8 } },
                        React.createElement(Btn, { onClick: function () { approveCharge(c); }, style: { flex: 1, padding: "7px", fontSize: 11 } }, "\u2713 Approve & Add to Invoice"),
                        React.createElement(Btn, { onClick: function () { dismissCharge(c); }, variant: "ghost", style: { flex: 1, padding: "7px", fontSize: 11 } }, "Dismiss")));
            })),
        React.createElement(ExSection, { label: "Late Jobs", icon: "\u23F0", color: C.red, items: lateJobs, note: function (j) { return "Overdue since " + j.date; } }),
        React.createElement(ExSection, { label: "Unassigned Jobs", icon: "\uD83D\uDC64", color: C.yellow, items: unassigned, note: function (j) { return "Status: " + j.status + " — not yet assigned"; } }),
        React.createElement(ExSection, { label: "Pending Quotes (Awaiting Call)", icon: "\uD83D\uDCCB", color: "#9F7AEA", items: pendingQuotes, note: function (j) { return "Call customer to confirm final price"; } }),
        React.createElement(ExSection, { label: "Price Overrides", icon: "\uD83D\uDCB2", color: C.orange, items: priceOverrides, note: function (j) { return "Custom price applied — review if needed"; } }),
        React.createElement(ExSection, { label: "Payment Failures", icon: "\uD83D\uDCB3", color: C.red, items: paymentFailed, note: function (j) { return "Payment failed — follow up with customer"; } }),
        React.createElement(ExSection, { label: "Cancelled Jobs", icon: "\u274C", color: C.red, items: cancelled, note: function (j) { return "Cancelled — check refund status"; } }));
}
// ── DAILY PROFIT REPORT ───────────────────────────────────────────────
function ProfitReport(props) {
    var jobs = props.jobs || [];
    var expenses = loadExpenses();
    var [selectedDate, setSelectedDate] = useState(new Date().toISOString().split("T")[0]);
    var [reportTab, setReportTab] = useState("daily");
    var [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
    var [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
    var dayJobs = jobs.filter(function (j) { return j.date === selectedDate && j.status !== "Cancelled"; });
    var dayExpenses = expenses.filter(function (e) { return e.date === selectedDate; });
    // ── Phase 10: Advanced Metrics ──────────────────────────────────────
    var rangeJobs = jobs.filter(function (j) { return j.date >= dateFrom && j.date <= dateTo && j.status !== "Cancelled"; });
    var rangeExpenses = expenses.filter(function (e) { return e.date >= dateFrom && e.date <= dateTo; });
    var totalRevenue = rangeJobs.reduce(function (s, j) { return s + j.finalPrice; }, 0);
    var totalMiles = rangeJobs.reduce(function (s, j) { return s + (j.miles || 0); }, 0);
    var totalJobs = rangeJobs.length;
    var totalExpenses = rangeExpenses.reduce(function (s, e) { return s + e.amount; }, 0);
    var stripeFees = Math.round(rangeJobs.filter(function (j) { return j.payment === "card"; }).reduce(function (s, j) { return s + j.finalPrice * 0.029 + 0.30; }, 0));
    var totalCost = totalExpenses + stripeFees;
    var totalProfit = totalRevenue - totalCost;
    var rpm = totalMiles > 0 ? (totalRevenue / totalMiles).toFixed(2) : 0; // Revenue per mile
    var cpm = totalMiles > 0 ? (totalCost / totalMiles).toFixed(2) : 0; // Cost per mile
    var ppm = totalMiles > 0 ? (totalProfit / totalMiles).toFixed(2) : 0; // Profit per mile
    var avgTicket = totalJobs > 0 ? (totalRevenue / totalJobs).toFixed(0) : 0;
    var margin = totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) : 0;
    // Revenue by customer
    var byCustomer = {};
    rangeJobs.forEach(function (j) {
        var k = j.customer;
        if (!byCustomer[k])
            byCustomer[k] = { name: k, jobs: 0, revenue: 0, miles: 0 };
        byCustomer[k].jobs++;
        byCustomer[k].revenue += j.finalPrice;
        byCustomer[k].miles += (j.miles || 0);
    });
    var customerList = Object.values(byCustomer).sort(function (a, b) { return b.revenue - a.revenue; });
    // Revenue by service
    var byService = {};
    rangeJobs.forEach(function (j) {
        var k = j.serviceName || j.service;
        if (!byService[k])
            byService[k] = { name: k, jobs: 0, revenue: 0 };
        byService[k].jobs++;
        byService[k].revenue += j.finalPrice;
    });
    var serviceList = Object.values(byService).sort(function (a, b) { return b.revenue - a.revenue; });
    // Revenue by salesperson
    var bySales = {};
    rangeJobs.forEach(function (j) {
        var k = j.salesperson || "Unassigned";
        if (!bySales[k])
            bySales[k] = { name: k, jobs: 0, revenue: 0 };
        bySales[k].jobs++;
        bySales[k].revenue += j.finalPrice;
    });
    var salesList = Object.values(bySales).sort(function (a, b) { return b.revenue - a.revenue; });
    // AR Aging — unpaid jobs by age
    var today = new Date();
    var unpaid = jobs.filter(function (j) { return j.status !== "Paid" && j.status !== "Completed" && j.status !== "Cancelled" && j.payment === "net7"; });
    var aging = { current: 0, days30: 0, days60: 0, days90: 0 };
    unpaid.forEach(function (j) {
        var days = Math.floor((today - new Date(j.date)) / (1000 * 60 * 60 * 24));
        if (days <= 30)
            aging.current += j.finalPrice;
        else if (days <= 60)
            aging.days30 += j.finalPrice;
        else if (days <= 90)
            aging.days60 += j.finalPrice;
        else
            aging.days90 += j.finalPrice;
    });
    var revenue = dayJobs.reduce(function (s, j) { return s + j.finalPrice; }, 0);
    var driverPay = dayJobs.reduce(function (s, j) { return s + (j.helperHours || 0) * 18; }, 0);
    var fuelCost = dayExpenses.filter(function (e) { return e.type === "fuel"; }).reduce(function (s, e) { return s + e.amount; }, 0) || dayJobs.reduce(function (s, j) { return s + (j.fuel || 0); }, 0);
    var tolls = dayExpenses.filter(function (e) { return e.type === "tolls"; }).reduce(function (s, e) { return s + e.amount; }, 0);
    var supplies = dayExpenses.filter(function (e) { return e.type === "supplies"; }).reduce(function (s, e) { return s + e.amount; }, 0);
    var other = dayExpenses.filter(function (e) { return e.type === "other"; }).reduce(function (s, e) { return s + e.amount; }, 0);
    var stripeFees = Math.round(dayJobs.filter(function (j) { return j.payment === "card"; }).reduce(function (s, j) { return s + j.finalPrice * 0.029 + 0.30; }, 0));
    var totalExpenses = driverPay + fuelCost + tolls + supplies + other + stripeFees;
    var netProfit = revenue - totalExpenses;
    var totalMiles = dayJobs.reduce(function (s, j) { return s + (j.miles || 0); }, 0);
    function Row(p) {
        return React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "9px 0", borderBottom: "1px solid " + C.border } },
            React.createElement("span", { style: { fontSize: 13, color: C.dim } }, p.label),
            React.createElement("span", { style: { fontSize: 13, fontWeight: 700, color: p.color || C.white } }, p.value));
    }
    return React.createElement("div", { style: { maxWidth: 700, margin: "0 auto" } },
        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 4 } }, "\uD83D\uDCCA Reports"),
        React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 16, overflowX: "auto" } }, [["daily", "📅 Daily"], ["advanced", "📈 Advanced"], ["customers", "🏢 Customers"], ["services", "⚙ Services"], ["sales", "👤 Sales"], ["aging", "💳 AR Aging"]].map(function (t) {
            return React.createElement("button", { key: t[0], onClick: function () { setReportTab(t[0]); }, style: { border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", background: reportTab === t[0] ? C.orange : "transparent", color: reportTab === t[0] ? "#000" : C.dim, fontWeight: 700, fontFamily: "inherit", fontSize: 11, whiteSpace: "nowrap" } }, t[1]);
        })),
        reportTab === "advanced" && React.createElement("div", null,
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px", marginBottom: 12 } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 } }, "From"),
                    React.createElement("input", { type: "date", value: dateFrom, onChange: function (e) { setDateFrom(e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "10px 14px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark", marginBottom: 12 } })),
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 } }, "To"),
                    React.createElement("input", { type: "date", value: dateTo, onChange: function (e) { setDateTo(e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "10px 14px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark", marginBottom: 12 } }))),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 8, marginBottom: 16 } }, [["Revenue", "$" + totalRevenue.toLocaleString(), C.orange], ["Profit", "$" + totalProfit.toLocaleString(), totalProfit >= 0 ? C.green : C.red], ["Margin", margin + "%", C.blue], ["Avg Ticket", "$" + avgTicket, C.white], ["Total Miles", totalMiles.toFixed(0) + " mi", C.dim], ["Jobs", totalJobs, C.yellow]].map(function (s) {
                return React.createElement(Card, { key: s[0], style: { padding: "12px 14px" } },
                    React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 } }, s[0]),
                    React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: s[2] } }, s[1]));
            })),
            React.createElement(Card, { style: { marginBottom: 12 } },
                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 12 } }, "Per Mile Analysis"),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8 } }, [["Revenue/Mile (RPM)", "$" + rpm, C.orange], ["Cost/Mile (CPM)", "$" + cpm, C.red], ["Profit/Mile (PPM)", "$" + ppm, Number(ppm) >= 0 ? C.green : C.red]].map(function (s) {
                    return React.createElement("div", { key: s[0], style: { background: C.surface, borderRadius: 8, padding: "12px", textAlign: "center" } },
                        React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, lineHeight: 1.3 } }, s[0]),
                        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: s[2] } }, s[1]));
                })))),
        reportTab === "customers" && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 12 } }, "Customer Profitability"),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px", marginBottom: 12 } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 600, marginBottom: 4, textTransform: "uppercase" } }, "From"),
                    React.createElement("input", { type: "date", value: dateFrom, onChange: function (e) { setDateFrom(e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "10px 14px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark", marginBottom: 12 } })),
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 600, marginBottom: 4, textTransform: "uppercase" } }, "To"),
                    React.createElement("input", { type: "date", value: dateTo, onChange: function (e) { setDateTo(e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "10px 14px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark", marginBottom: 12 } }))),
            customerList.length === 0 ? React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "30px 0", fontSize: 13 } }, "No jobs in this date range.")
                : customerList.map(function (c) {
                    return React.createElement(Card, { key: c.name, style: { marginBottom: 8 } },
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                            React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, c.name),
                                React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                                    c.jobs,
                                    " job",
                                    c.jobs !== 1 ? "s" : "",
                                    " \u00B7 ",
                                    c.miles.toFixed(0),
                                    " mi")),
                            React.createElement("div", { style: { textAlign: "right" } },
                                React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.orange } },
                                    "$",
                                    c.revenue.toLocaleString()),
                                React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                                    "$",
                                    c.jobs > 0 ? Math.round(c.revenue / c.jobs) : 0,
                                    " avg/job"))));
                })),
        reportTab === "services" && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 12 } }, "Revenue by Service"),
            serviceList.length === 0 ? React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "30px 0", fontSize: 13 } }, "No jobs yet.")
                : serviceList.map(function (s) {
                    var pct = totalRevenue > 0 ? Math.round((s.revenue / totalRevenue) * 100) : 0;
                    return React.createElement(Card, { key: s.name, style: { marginBottom: 8 } },
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, s.name),
                            React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.orange } },
                                "$",
                                s.revenue.toLocaleString())),
                        React.createElement("div", { style: { background: C.surface, borderRadius: 4, height: 6, marginBottom: 4 } },
                            React.createElement("div", { style: { background: C.orange, borderRadius: 4, height: 6, width: pct + "%" } })),
                        React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                            s.jobs,
                            " jobs \u00B7 ",
                            pct,
                            "% of revenue"));
                })),
        reportTab === "sales" && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 12 } }, "Revenue by Team Member"),
            salesList.length === 0 ? React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "30px 0", fontSize: 13 } }, "No jobs yet.")
                : salesList.map(function (s, i) {
                    return React.createElement(Card, { key: s.name, style: { marginBottom: 8 } },
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
                                React.createElement("div", { style: { width: 28, height: 28, borderRadius: "50%", background: i === 0 ? C.orange : C.surface, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: i === 0 ? "#000" : C.dim } },
                                    "#",
                                    i + 1),
                                React.createElement("div", null,
                                    React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, s.name),
                                    React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                                        s.jobs,
                                        " job",
                                        s.jobs !== 1 ? "s" : ""))),
                            React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.orange } },
                                "$",
                                s.revenue.toLocaleString())));
                })),
        reportTab === "aging" && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 12 } }, "Accounts Receivable Aging"),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 8, marginBottom: 16 } }, [["Current (0-30 days)", "$" + aging.current.toLocaleString(), C.green], ["31-60 Days", "$" + aging.days30.toLocaleString(), C.yellow], ["61-90 Days", "$" + aging.days60.toLocaleString(), C.orange], ["90+ Days (Critical)", "$" + aging.days90.toLocaleString(), C.red]].map(function (a) {
                return React.createElement(Card, { key: a[0], style: { padding: "12px 14px" } },
                    React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4, lineHeight: 1.4 } }, a[0]),
                    React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: a[2] } }, a[1]));
            })),
            unpaid.length === 0 ? React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "20px 0", fontSize: 12 } }, "No outstanding AR. All Net 7 accounts are current.")
                : unpaid.map(function (j) {
                    var days = Math.floor((today - new Date(j.date)) / (1000 * 60 * 60 * 24));
                    return React.createElement(Card, { key: j.id, style: { marginBottom: 8, border: "1px solid " + (days > 90 ? C.red : days > 60 ? C.orange : C.border) + "66" } },
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between" } },
                            React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white } }, j.customer),
                                React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                                    j.id,
                                    " \u00B7 ",
                                    j.date)),
                            React.createElement("div", { style: { textAlign: "right" } },
                                React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: days > 60 ? C.red : C.orange } },
                                    "$",
                                    j.finalPrice),
                                React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                                    days,
                                    " days outstanding"))));
                })),
        reportTab === "daily" && React.createElement("div", null,
            React.createElement("div", { style: { marginBottom: 16 } },
                React.createElement("input", { type: "date", value: selectedDate, onChange: function (e) { setSelectedDate(e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "10px 14px", fontSize: 14, outline: "none", fontFamily: "inherit", colorScheme: "dark" } })),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 12 } }, "Revenue — " + selectedDate),
                React.createElement("div", { style: { background: C.orangeSoft, border: "1px solid " + C.orange + "33", borderRadius: 10, padding: "16px", textAlign: "center", marginBottom: 16 } },
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, letterSpacing: 1, textTransform: "uppercase" } }, "Total Revenue"),
                    React.createElement("div", { style: { fontSize: 48, fontWeight: 900, color: C.orange } }, "$" + revenue.toLocaleString()),
                    React.createElement("div", { style: { fontSize: 12, color: C.dim } }, dayJobs.length + " jobs completed")),
                React.createElement(Row, { label: "\uD83D\uDCB0 Gross Revenue", value: "$" + revenue.toLocaleString(), color: C.green }),
                React.createElement(Row, { label: "\uD83D\uDC77 Driver / Helper Pay", value: "-$" + driverPay }),
                React.createElement(Row, { label: "\u26FD Fuel", value: "-$" + fuelCost }),
                React.createElement(Row, { label: "\uD83D\uDEE3 Tolls", value: "-$" + tolls }),
                React.createElement(Row, { label: "\uD83E\uDDF0 Supplies", value: "-$" + supplies }),
                React.createElement(Row, { label: "\uD83D\uDCB3 Stripe Processing Fees (est.)", value: "-$" + stripeFees }),
                React.createElement(Row, { label: "\uD83D\uDCE6 Other Expenses", value: "-$" + other }),
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "12px 0", background: netProfit >= 0 ? C.green + "12" : C.red + "12", borderRadius: 8, paddingLeft: 12, paddingRight: 12, marginTop: 6 } },
                    React.createElement("span", { style: { fontSize: 15, fontWeight: 800, color: C.white } }, "Net Profit"),
                    React.createElement("span", { style: { fontSize: 20, fontWeight: 900, color: netProfit >= 0 ? C.green : C.red } }, "$" + netProfit.toLocaleString())),
                React.createElement("div", { style: { marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 } }, [["Miles", totalMiles + " mi"], ["Jobs", dayJobs.length], ["Margin", revenue > 0 ? Math.round((netProfit / revenue) * 100) + "%" : "—"]].map(function (r) {
                    return React.createElement("div", { key: r[0], style: { background: C.surface, borderRadius: 8, padding: "10px", textAlign: "center" } },
                        React.createElement("div", { style: { fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: 1 } }, r[0]),
                        React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: C.white, marginTop: 4 } }, r[1]));
                })),
                (function () {
                    var byPerson = {};
                    dayJobs.forEach(function (j) { var name = j.salesperson || "Unassigned"; if (!byPerson[name])
                        byPerson[name] = { name: name, jobs: 0, revenue: 0 }; byPerson[name].jobs++; byPerson[name].revenue += j.finalPrice; });
                    var people = Object.values(byPerson);
                    if (people.length === 0)
                        return null;
                    return React.createElement("div", { style: { marginTop: 14 } },
                        React.createElement("div", { style: { fontSize: 11, color: C.dim, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 } }, "Revenue by Team Member"),
                        people.map(function (p) {
                            return React.createElement("div", { key: p.name, style: { display: "flex", justifyContent: "space-between", alignItems: "center", background: C.surface, borderRadius: 8, padding: "9px 12px", marginBottom: 6 } },
                                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white } }, p.name),
                                React.createElement("div", { style: { display: "flex", gap: 12 } },
                                    React.createElement("span", { style: { fontSize: 11, color: C.dim } }, p.jobs + " job" + (p.jobs !== 1 ? "s" : "")),
                                    React.createElement("span", { style: { fontSize: 13, fontWeight: 800, color: C.orange } }, "$" + p.revenue.toLocaleString())));
                        }));
                })())));
}
// ── AUDIT TRAIL VIEW ─────────────────────────────────────────────────
function AuditTrailView() {
    var entries = loadAudit();
    return React.createElement("div", { style: { maxWidth: 700, margin: "0 auto" } },
        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 4 } }, "\uD83D\uDC41 Owner Audit Trail"),
        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 20 } }, "Every change made to jobs \u2014 who, what, when."),
        entries.length === 0 && React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "40px 0", fontSize: 13 } }, "No audit entries yet. Changes to jobs will appear here."),
        entries.map(function (e) {
            return React.createElement("div", { key: e.id, style: { background: C.surface, borderRadius: 9, padding: "12px 14px", marginBottom: 8 } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 4 } },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white } }, e.action),
                    React.createElement("div", { style: { fontSize: 10, color: C.dim } }, e.ts ? e.ts.replace("T", " ").substring(0, 16) : "")),
                React.createElement("div", { style: { fontSize: 11, color: C.dim } },
                    "Job: ",
                    React.createElement("span", { style: { color: C.orange } }, e.jobId),
                    " \u00B7 By: ",
                    React.createElement("span", { style: { color: C.green } }, e.role)),
                e.field && React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 4 } },
                    "Field: ",
                    React.createElement("strong", { style: { color: C.white } }, e.field),
                    e.before && React.createElement("span", null,
                        " \u00B7 Before: ",
                        React.createElement("span", { style: { color: C.red } }, e.before)),
                    e.after && React.createElement("span", null,
                        " \u00B7 After: ",
                        React.createElement("span", { style: { color: C.green } }, e.after))));
        }));
}
// ── EXPENSE CAPTURE ───────────────────────────────────────────────────
function ExpenseCapture(props) {
    var jobs = props.jobs || [];
    var [expenses, setExpenses] = useState(loadExpenses);
    var [f, setF] = useState({ jobId: "", type: "fuel", amount: "", note: "", date: new Date().toISOString().split("T")[0] });
    function set(k, v) { setF(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); }
    function addExpense() {
        if (!f.amount || !f.type)
            return;
        var newExp = { id: Date.now(), jobId: f.jobId, type: f.type, amount: Number(f.amount), note: f.note, date: f.date };
        var updated = [newExp].concat(expenses);
        setExpenses(updated);
        saveExpenses(updated);
        setF(function (p) { return Object.assign({}, p, { amount: "", note: "", jobId: "" }); });
        if (f.jobId)
            addAuditEntry("Expense Added", f.jobId, "expense", "", "$" + f.amount + " (" + f.type + ")", props.role);
    }
    var totalToday = expenses.filter(function (e) { return e.date === new Date().toISOString().split("T")[0]; }).reduce(function (s, e) { return s + e.amount; }, 0);
    return React.createElement("div", { style: { maxWidth: 600, margin: "0 auto" } },
        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 4 } }, "\uD83D\uDCB8 Expense Capture"),
        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 20 } }, "Today's expenses: $" + totalToday.toFixed(2)),
        React.createElement(Card, { style: { marginBottom: 16 } },
            React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 12 } }, "Add Expense"),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                React.createElement("div", { style: { marginBottom: 14 } },
                    React.createElement(Lbl, null, "Type"),
                    React.createElement("select", { value: f.type, onChange: function (e) { set("type", e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } }, [["fuel", "⛽ Fuel"], ["tolls", "🛣 Tolls"], ["parking", "🅿️ Parking"], ["supplies", "🧰 Supplies"], ["other", "📦 Other"]].map(function (o) { return React.createElement("option", { key: o[0], value: o[0] }, o[1]); }))),
                React.createElement(TxtIn, { label: "Amount ($)", value: f.amount, onChange: function (v) { set("amount", v); }, type: "number", placeholder: "0.00" })),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                React.createElement("div", { style: { marginBottom: 14 } },
                    React.createElement(Lbl, null, "Link to Job (optional)"),
                    React.createElement("select", { value: f.jobId, onChange: function (e) { set("jobId", e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } },
                        React.createElement("option", { value: "" }, "\u2014 No specific job \u2014"),
                        jobs.filter(function (j) { return j.status !== "Cancelled"; }).map(function (j) { return React.createElement("option", { key: j.id, value: j.id }, j.id + " · " + j.customer); }))),
                React.createElement("div", null,
                    React.createElement(Lbl, null, "Date"),
                    React.createElement("input", { type: "date", value: f.date, onChange: function (e) { set("date", e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" } }))),
            React.createElement(TxtIn, { label: "Note", value: f.note, onChange: function (v) { set("note", v); }, placeholder: "e.g. Gas station on I-20, job supplies..." }),
            React.createElement(Btn, { onClick: addExpense, disabled: !f.amount, style: { width: "100%" } }, "Add Expense")),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } }, expenses.slice(0, 30).map(function (e) {
            return React.createElement("div", { key: e.id, style: { background: C.surface, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white } },
                        e.type.toUpperCase(),
                        e.note ? " — " + e.note : ""),
                    React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                        e.date,
                        e.jobId ? " · " + e.jobId : "")),
                React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: C.red } }, "$" + e.amount.toFixed(2)));
        })));
}
// ── BUSINESS ACCOUNT HISTORY ──────────────────────────────────────────
function BusinessHistory(props) {
    var jobs = props.jobs || [];
    var bizJobs = jobs.filter(function (j) { return j.isBusiness; });
    var companies = {};
    bizJobs.forEach(function (j) {
        var key = j.companyName || j.customer;
        if (!companies[key])
            companies[key] = { name: key, contact: j.customer, phone: j.phone, email: j.email || "", jobs: [], revenue: 0, paid: 0, outstanding: 0 };
        companies[key].jobs.push(j);
        companies[key].revenue += j.finalPrice;
        if (j.status === "Paid" || j.status === "Completed")
            companies[key].paid += j.finalPrice;
        else if (j.status !== "Cancelled")
            companies[key].outstanding += j.finalPrice;
    });
    var compList = Object.values(companies).sort(function (a, b) { return b.revenue - a.revenue; });
    var [sel, setSel] = useState(null);
    var selComp = sel ? companies[sel] : null;
    return React.createElement("div", { style: { maxWidth: 700, margin: "0 auto" } },
        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 4 } }, "\uD83C\uDFE2 Business Account History"),
        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 20 } }, compList.length + " commercial accounts"),
        compList.length === 0 && React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "40px 0", fontSize: 13 } }, "No business accounts yet. Commercial bookings will appear here."),
        compList.map(function (c) {
            var avgTicket = c.jobs.length > 0 ? Math.round(c.revenue / c.jobs.length) : 0;
            return React.createElement(Card, { key: c.name, style: { marginBottom: 10, cursor: "pointer", border: sel === c.name ? "1.5px solid " + C.orange : "1px solid " + C.border }, onClick: function () { setSel(sel === c.name ? null : c.name); } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white } }, c.name),
                        React.createElement("div", { style: { fontSize: 11, color: C.dim } },
                            c.contact,
                            c.phone ? " · " + c.phone : "")),
                    React.createElement("div", { style: { textAlign: "right" } },
                        React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.orange } }, "$" + c.revenue.toLocaleString()),
                        React.createElement("div", { style: { fontSize: 10, color: C.dim } }, c.jobs.length + " jobs"))),
                sel === c.name && React.createElement("div", { style: { marginTop: 12, borderTop: "1px solid " + C.border, paddingTop: 12 } },
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10 } }, [["Total Revenue", "$" + c.revenue.toLocaleString(), C.orange], ["Paid", "$" + c.paid.toLocaleString(), C.green], ["Outstanding", "$" + c.outstanding.toLocaleString(), c.outstanding > 0 ? C.red : C.dim], ["Jobs", c.jobs.length, C.white], ["Avg Ticket", "$" + avgTicket, C.white], ["Email", c.email || "—", C.dim]].map(function (r) {
                        return React.createElement("div", { key: r[0], style: { background: C.surface, borderRadius: 8, padding: "8px" } },
                            React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1 } }, r[0]),
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: r[2], marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, r[1]));
                    })),
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, fontWeight: 700, marginBottom: 6 } }, "Job History"),
                    c.jobs.map(function (j) {
                        return React.createElement("div", { key: j.id, style: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid " + C.border, fontSize: 11 } },
                            React.createElement("span", { style: { color: C.dim } }, j.date),
                            React.createElement("span", { style: { color: C.white } }, j.serviceName),
                            React.createElement("span", { style: { color: STATUS_COLOR[j.status] || C.dim } }, j.status),
                            React.createElement("span", { style: { color: C.orange, fontWeight: 700 } }, "$" + j.finalPrice));
                    })));
        }));
}
// ── SALESPERSON SCOREBOARD ────────────────────────────────────────────
function SalesScoreboard(props) {
    var jobs = props.jobs || [];
    var leads = loadLeads();
    var [showAddLead, setShowAddLead] = useState(false);
    var [f, setF] = useState({ salesperson: "", company: "", phone: "", email: "", status: "called", notes: "", followUpDate: "" });
    function set(k, v) { setF(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); }
    // Build scoreboard from jobs with salesperson field
    var salespeople = {};
    jobs.forEach(function (j) {
        if (j.salesperson) {
            if (!salespeople[j.salesperson])
                salespeople[j.salesperson] = { name: j.salesperson, bookings: 0, revenue: 0, profit: 0 };
            salespeople[j.salesperson].bookings++;
            salespeople[j.salesperson].revenue += j.finalPrice;
        }
    });
    leads.forEach(function (l) {
        if (!salespeople[l.salesperson])
            salespeople[l.salesperson] = { name: l.salesperson, bookings: 0, revenue: 0, profit: 0 };
        if (!salespeople[l.salesperson].leads)
            salespeople[l.salesperson].leads = [];
        salespeople[l.salesperson].leads.push(l);
    });
    var board = Object.values(salespeople).sort(function (a, b) { return b.revenue - a.revenue; });
    function saveLead() {
        if (!f.salesperson || !f.company)
            return;
        var updated = [{ id: Date.now(), salesperson: f.salesperson, company: f.company, phone: f.phone, email: f.email, status: f.status, notes: f.notes, followUpDate: f.followUpDate, date: new Date().toISOString().split("T")[0] }].concat(leads);
        saveLeads(updated);
        setShowAddLead(false);
        setF({ salesperson: "", company: "", phone: "", email: "", status: "called", notes: "", followUpDate: "" });
    }
    return React.createElement("div", { style: { maxWidth: 700, margin: "0 auto" } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 } },
            React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white } }, "\uD83C\uDFC6 Salesperson Scoreboard"),
            React.createElement(Btn, { onClick: function () { setShowAddLead(true); }, style: { padding: "8px 14px", fontSize: 12 } }, "+ Log Lead")),
        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 20 } }, "Track calls, leads, quotes, bookings, and revenue by rep."),
        showAddLead && React.createElement(Card, { style: { marginBottom: 16, border: "1.5px solid " + C.orange } },
            React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 12 } }, "Log a Sales Activity"),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                React.createElement(TxtIn, { label: "Salesperson", value: f.salesperson, onChange: function (v) { set("salesperson", v); }, placeholder: "Rep name" }),
                React.createElement(TxtIn, { label: "Company / Lead", value: f.company, onChange: function (v) { set("company", v); }, placeholder: "Company name" })),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                React.createElement(TxtIn, { label: "Phone", value: f.phone, onChange: function (v) { set("phone", v); }, type: "tel", placeholder: "404-000-0000" }),
                React.createElement(TxtIn, { label: "Email", value: f.email, onChange: function (v) { set("email", v); }, type: "email", placeholder: "contact@company.com" })),
            React.createElement(Lbl, null, "Status"),
            React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 } }, [["called", "📞 Called"], ["left_vm", "📲 Left VM"], ["quoted", "💲 Quoted"], ["follow_up", "🔄 Follow-Up"], ["booked", "✅ Booked"], ["lost", "❌ Lost"]].map(function (s) {
                return React.createElement("div", { key: s[0], onClick: function () { set("status", s[0]); }, style: { border: "1px solid " + (f.status === s[0] ? C.orange : C.border), borderRadius: 7, padding: "5px 10px", cursor: "pointer", background: f.status === s[0] ? C.orangeSoft : "transparent", fontSize: 11, fontWeight: 600, color: f.status === s[0] ? C.orange : C.dim } }, s[1]);
            })),
            React.createElement(TxtIn, { label: "Notes", value: f.notes, onChange: function (v) { set("notes", v); }, placeholder: "What was discussed..." }),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                React.createElement("div", null,
                    React.createElement(Lbl, null, "Follow-Up Date"),
                    React.createElement("input", { type: "date", value: f.followUpDate, onChange: function (e) { set("followUpDate", e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark", marginBottom: 14 } })),
                React.createElement("div", { style: { display: "flex", alignItems: "flex-end", paddingBottom: 14 } },
                    React.createElement(Btn, { onClick: saveLead, disabled: !f.salesperson || !f.company, style: { width: "100%" } }, "Save Activity"))),
            React.createElement(Btn, { variant: "ghost", onClick: function () { setShowAddLead(false); }, style: { width: "100%" } }, "Cancel")),
        board.length === 0 && React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "40px 0", fontSize: 13 } }, "No sales activity yet. Log leads above to start tracking."),
        board.map(function (s, idx) {
            var repLeads = (s.leads || []);
            var called = repLeads.filter(function (l) { return l.status === "called" || l.status === "left_vm"; }).length;
            var quoted = repLeads.filter(function (l) { return l.status === "quoted"; }).length;
            var booked = s.bookings || repLeads.filter(function (l) { return l.status === "booked"; }).length;
            var followUps = repLeads.filter(function (l) { return l.status === "follow_up"; }).length;
            var closeRate = repLeads.length > 0 ? Math.round((booked / repLeads.length) * 100) : 0;
            return React.createElement(Card, { key: s.name, style: { marginBottom: 10 } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } },
                    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 10 } },
                        React.createElement("div", { style: { width: 32, height: 32, borderRadius: "50%", background: idx === 0 ? C.orange : idx === 1 ? C.dim : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#000" } },
                            "#",
                            idx + 1),
                        React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: C.white } }, s.name)),
                    React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: C.orange } }, "$" + s.revenue.toLocaleString())),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 } }, [["Calls", called], ["Quotes", quoted], ["Booked", booked], ["Close Rate", closeRate + "%"], ["Revenue", "$" + s.revenue.toLocaleString()], ["Follow-Ups", followUps]].map(function (r) {
                    return React.createElement("div", { key: r[0], style: { background: C.surface, borderRadius: 8, padding: "8px", textAlign: "center" } },
                        React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1 } }, r[0]),
                        React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: C.white, marginTop: 3 } }, r[1]));
                })),
                repLeads.filter(function (l) { return l.status === "follow_up"; }).length > 0 && React.createElement("div", { style: { marginTop: 10, background: C.orange + "12", border: "1px solid " + C.orange + "33", borderRadius: 8, padding: "8px 12px" } },
                    React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700 } },
                        "\u26A0 ",
                        followUps,
                        " follow-up",
                        followUps !== 1 ? "s" : "",
                        " pending"),
                    repLeads.filter(function (l) { return l.status === "follow_up"; }).map(function (l) {
                        return React.createElement("div", { key: l.id, style: { fontSize: 10, color: C.dim, marginTop: 4 } },
                            l.company,
                            l.followUpDate ? " — due " + l.followUpDate : "");
                    })));
        }));
}
// ── REVIEW SECTION (PUBLIC HOMEPAGE) ─────────────────────────────────
function ReviewsSection(props) {
    var reviews = loadReviews();
    var [showModal, setShowModal] = useState(false);
    if (reviews.length === 0 && !props.showEmpty)
        return null;
    var avgRating = reviews.length > 0 ? Math.round(reviews.reduce(function (s, r) { return s + r.rating; }, 0) / reviews.length * 10) / 10 : 0;
    return React.createElement("div", { style: { padding: "40px 24px", borderTop: "1px solid " + C.border } },
        showModal && React.createElement(ReviewModal, { onClose: function () { setShowModal(false); } }),
        React.createElement("div", { style: { maxWidth: 680, margin: "0 auto" } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 4 } }, "Customer Reviews"),
                    React.createElement("div", { style: { fontSize: 22, fontWeight: 800, color: C.white } }, reviews.length > 0 ? ("⭐ " + avgRating + " · " + reviews.length + " review" + (reviews.length !== 1 ? "s" : "")) : "Be the first to leave a review")),
                React.createElement("button", { onClick: function () { setShowModal(true); }, style: { background: C.orange, color: "#000", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" } }, "Leave a Review")),
            reviews.slice(0, 6).map(function (r) {
                return React.createElement("div", { key: r.id, style: { background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 16px", marginBottom: 10 } },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: 6 } },
                        React.createElement("div", { style: { fontWeight: 700, color: C.white, fontSize: 13 } }, r.name),
                        React.createElement("div", { style: { fontSize: 12, color: C.dim } }, r.date)),
                    React.createElement("div", { style: { color: C.orange, fontSize: 14, marginBottom: 6 } }, "⭐".repeat(r.rating) + "☆".repeat(5 - r.rating)),
                    React.createElement("div", { style: { fontSize: 12, color: C.dim, lineHeight: 1.7 } }, r.comment),
                    r.jobId && React.createElement("div", { style: { fontSize: 10, color: C.faint, marginTop: 6 } },
                        "Job #",
                        r.jobId));
            })));
}
// ── TAB NAVIGATION — Grouped dropdown design ──────────────────────
function getTabGroups() {
    return [
        { label: "⚡ " + t("ops"), color: "#4299E1", tabs: [["quote", "📞 " + t("quote")], ["jobs", "📋 " + t("jobs")], ["exceptions", "🚨 " + t("alerts")], ["calendar", "📅 " + t("calendar")]] },
        { label: "📋 " + t("leads"), color: "#1DB954", tabs: [["leads", "📋 " + t("leads")], ["activity", "👥 " + t("activity")], ["leaderboard", "🏆 " + t("board")]] },
        { label: "🚐 " + t("driver"), color: "#9F7AEA", tabs: [["driver", "🚐 " + t("driver")], ["driverapp", "🚐 " + t("driverApp")]] },
        { label: "📊 " + t("reports"), color: C.orange, tabs: [["reports", "📊 " + t("reports")], ["advanced", "📈 " + t("analytics")], ["sales", "🏆 " + t("sales")]] },
        { label: "💼 " + t("biz"), color: "#F6E05E", tabs: [["carriers", "🤝 " + t("carriers")], ["expenses", "💸 " + t("expenses")], ["accounts", "🏢 " + t("accounts")], ["audit", "👁 " + t("audit")]] },
        { label: "🚗 Fleet", color: "#F6AD55", tabs: [["fleet", "🚗 Fleet"], ["fleetmap", "🗺️ Live Map"], ["compliance", "🛡 Compliance"], ["documents", "📁 Documents"]] },
        { label: "👥 " + t("team"), color: "#FC8181", tabs: [["payroll", "💰 " + t("payroll")], ["ai", "🤖 " + t("aiDocs")]] },
        { label: "🎬 " + t("more"), color: "#888", tabs: [["demo", "🎬 " + t("demo")]] },
    ];
}
function TabNav({ tab, setTab, currentUser }) {
    var [openGroup, setOpenGroup] = useState(null);
    var hasAccess = function (id) { return !currentUser || currentUser.access.indexOf(id) > -1; };
    var activeGroup = getTabGroups().find(function (g) { return g.tabs.some(function (t) { return t[0] === tab; }); }) || null;
    function handleGroupClick(e, gi) {
        e.stopPropagation();
        var g = getTabGroups()[gi];
        var accessible = g.tabs.filter(function (t) { return hasAccess(t[0]); });
        if (accessible.length === 1) {
            setTab(accessible[0][0]);
            setOpenGroup(null);
            return;
        }
        setOpenGroup(openGroup === gi ? null : gi);
    }
    // Close dropdown on outside click
    React.useEffect(function () {
        function close() { setOpenGroup(null); }
        document.addEventListener("click", close);
        return function () { document.removeEventListener("click", close); };
    }, []);
    return React.createElement("div", { style: { display: "flex", gap: 4, alignItems: "center", flexWrap: "nowrap" } },
        React.createElement("div", { style: { background: C.orange, borderRadius: 7, padding: "5px 10px", fontSize: 11, fontWeight: 700, color: "#000", whiteSpace: "nowrap", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis" } }, getTabGroups().flatMap(function (g) { return g.tabs; }).find(function (t) { return t[0] === tab; })?.[1] || tab),
        React.createElement("div", { style: { display: "flex", gap: 3, position: "relative" } }, getTabGroups().map(function (g, gi) {
            var accessible = g.tabs.filter(function (t) { return hasAccess(t[0]); });
            if (accessible.length === 0)
                return null;
            var isActiveGroup = g.tabs.some(function (t) { return t[0] === tab; });
            var isOpen = openGroup === gi;
            return React.createElement("div", { key: gi, style: { position: "relative" } },
                React.createElement("button", { onClick: function (e) { handleGroupClick(e, gi); }, style: {
                        border: "1px solid " + (isActiveGroup ? g.color : C.border),
                        borderRadius: 7, padding: "5px 8px", cursor: "pointer",
                        background: isActiveGroup ? g.color + "22" : "transparent",
                        color: isActiveGroup ? g.color : C.dim,
                        fontSize: 10, fontWeight: 700, fontFamily: "inherit", whiteSpace: "nowrap",
                        display: "flex", alignItems: "center", gap: 3,
                    } },
                    g.label,
                    React.createElement("span", { style: { fontSize: 8 } }, accessible.length > 1 ? "▾" : "")),
                isOpen && React.createElement("div", { onClick: function (e) { e.stopPropagation(); }, style: {
                        position: "absolute", top: "110%", left: 0,
                        background: C.card, border: "1px solid " + C.border,
                        borderRadius: 9, padding: 6, zIndex: 999, minWidth: 150,
                        boxShadow: "0 8px 24px rgba(0,0,0,0.4)"
                    } },
                    React.createElement("div", { style: { fontSize: 9, color: g.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, padding: "4px 8px 4px" } }, g.label),
                    accessible.map(function (item) {
                        return React.createElement("button", { key: item[0], onClick: function () { setTab(item[0]); setOpenGroup(null); }, style: {
                                display: "block", width: "100%", textAlign: "left",
                                border: "none", borderRadius: 6, padding: "7px 10px", cursor: "pointer",
                                background: tab === item[0] ? C.orange + "22" : "transparent",
                                color: tab === item[0] ? C.orange : C.white,
                                fontSize: 12, fontWeight: tab === item[0] ? 700 : 400, fontFamily: "inherit",
                            } }, item[1]);
                    })));
        })));
}
function AdminDashboard(props) {
    var [tab, setTab] = useState(props.role === ROLES.DRIVER ? "driver" : "quote");
    var langObj = useLang();
    var adminLang = langObj.lang;
    var tA = langObj.t;
    return React.createElement("div", { style: { minHeight: "100vh", background: C.black, color: C.white, fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
        React.createElement("div", { style: { borderBottom: "1px solid " + C.border, padding: "13px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: C.black, zIndex: 100 } },
            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 7 } },
                React.createElement(Logo, { size: 18 }),
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 14, fontWeight: 900 } },
                        React.createElement(BrandName, null)),
                    React.createElement("div", { style: { fontSize: 8, color: C.gold, letterSpacing: 1.5, textTransform: "uppercase" } }, "POTENT OS \u00B7 A POTENT PR\u00C4D\u018FKT\u00AE PRODUCT")),
                React.createElement(LangSwitcher, { lang: adminLang, changeLang: changeGlobalLang })),
            React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
                React.createElement(TabNav, { tab: tab, setTab: setTab, currentUser: props.currentUser }),
                React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 } },
                    React.createElement("div", { style: { fontSize: 11, color: C.white, fontWeight: 700 } }, props.currentUser ? props.currentUser.emoji + " " + props.currentUser.name : "Admin"),
                    React.createElement("div", { style: { fontSize: 9, color: props.role === ROLES.OWNER ? C.orange : props.role === ROLES.DRIVER ? C.green : C.blue, fontWeight: 600, textTransform: "capitalize", letterSpacing: 1 } }, props.role),
                    React.createElement(Btn, { variant: "muted", onClick: props.onLogout, style: { padding: "4px 10px", fontSize: 10 } }, tA("signOut"))))),
        React.createElement("div", { style: { padding: "20px 14px 60px", maxWidth: 740, margin: "0 auto" } },
            tab === "quote" && React.createElement(PhoneQuotePanel, { onAddJob: props.onAddJob, gasPPG: props.gasPPG, role: props.role, currentUser: props.currentUser }),
            tab === "jobs" && React.createElement(JobsDashboard, { jobs: props.jobs, onUpdateStatus: props.onUpdateStatus, onAddJob: props.onAddJob, gasPPG: props.gasPPG, dieselPPG: props.dieselPPG, role: props.role }),
            tab === "exceptions" && React.createElement(ExceptionDashboard, { jobs: props.jobs, onApplyAccessorial: props.onApplyAccessorial }),
            tab === "reports" && React.createElement(ProfitReport, { jobs: props.jobs }),
            tab === "expenses" && React.createElement(ExpenseCapture, { jobs: props.jobs, role: props.role }),
            tab === "accounts" && React.createElement(BusinessHistory, { jobs: props.jobs }),
            tab === "sales" && React.createElement(SalesScoreboard, { jobs: props.jobs }),
            tab === "audit" && React.createElement(AuditTrailView, null),
            tab === "calendar" && React.createElement(CalendarView, { jobs: props.jobs, blockedDates: props.blockedDates, onToggleBlock: props.onToggleBlock }),
            tab === "driver" && React.createElement(DriverPanel, { jobs: props.jobs, onUpdateStatus: props.onUpdateStatus }),
            tab === "driverapp" && React.createElement(EnhancedDriverApp, { jobs: props.jobs, onUpdateStatus: props.onUpdateStatus, currentUser: props.currentUser }),
            tab === "advanced" && React.createElement(AdvancedReports, { jobs: props.jobs }),
            tab === "carriers" && React.createElement(CarrierBrokerManager, null),
            tab === "ai" && React.createElement(AIDocumentExtractor, { onAddJob: props.onAddJob }),
            tab === "demo" && React.createElement(DemoDataLoader, { onAddJob: props.onAddJob }),
            tab === "leads" && React.createElement(LeadsBoard, { currentUser: props.currentUser }),
            tab === "activity" && React.createElement(ActivityDashboard, null),
            tab === "leaderboard" && React.createElement(LeaderBoard, { currentUser: props.currentUser }),
            tab === "payroll" && React.createElement(PayrollDashboard, { currentUser: props.currentUser, users: USERS }),
            tab === "fleet" && React.createElement(FleetMaintenance, null),
            tab === "fleetmap" && React.createElement(FleetMap, null),
            tab === "compliance" && React.createElement(ComplianceTracker, { users: USERS }),
            tab === "documents" && React.createElement(DocumentLogView, null)));
}
// ── ADMIN LOGIN ───────────────────────────────────────────────────
function AdminLogin(props) {
    var [selected, setSelected] = useState("");
    var [pw, setPw] = useState("");
    var [err, setErr] = useState(false);
    var [nameVersion, setNameVersion] = useState(0); // bump to force re-read of overrides
    var [editingName, setEditingName] = useState(false);
    var [editValue, setEditValue] = useState("");
    var [revokedErr, setRevokedErr] = useState(false);
    function go() {
        if (!selected)
            return;
        var user = USERS.find(function (u) { return u.id === selected; });
        if (user && isUserRevoked(user.id)) {
            setRevokedErr(true);
            setPw("");
            return;
        }
        if (user && pw === user.password) {
            props.onLogin(Object.assign({}, user, { name: getDisplayName(user) }));
        }
        else {
            setErr(true);
            setTimeout(function () { setErr(false); }, 2000);
            setPw("");
        }
    }
    var selectedUser = USERS.find(function (u) { return u.id === selected; });
    function startEdit() {
        if (!selectedUser)
            return;
        setEditValue(getDisplayName(selectedUser));
        setEditingName(true);
    }
    function saveEdit() {
        if (!selectedUser || !editValue.trim())
            return;
        saveNameOverride(selectedUser.id, editValue.trim());
        setEditingName(false);
        setNameVersion(function (v) { return v + 1; });
    }
    return React.createElement("div", { style: { minHeight: "100vh", background: C.black, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
        React.createElement("div", { style: { width: "100%", maxWidth: 380 } },
            React.createElement("div", { style: { textAlign: "center", marginBottom: 24 } },
                React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 4 } },
                    React.createElement(Logo, { size: 28 }),
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 20, fontWeight: 900 } },
                            React.createElement(BrandName, null)),
                        React.createElement("div", { style: { fontSize: 9, color: C.gold, letterSpacing: 1.5, textTransform: "uppercase" } }, "A POTENT PR\u00C4D\u018FKT\u00AE COMPANY"))),
                React.createElement("div", { style: { color: C.dim, fontSize: 11, letterSpacing: 2, textTransform: "uppercase", marginTop: 8 } }, "Team Sign In")),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 4 } }, "Who are you?"),
                React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 14 } }, "Choose your name from the list, then enter your password."),
                React.createElement("div", { style: { marginBottom: 10 } },
                    React.createElement("select", { value: selected, onChange: function (e) { setSelected(e.target.value); setPw(""); setErr(false); setRevokedErr(false); setEditingName(false); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "12px 14px", fontSize: 14, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", cursor: "pointer" } },
                        React.createElement("option", { value: "" }, "\u2014 Select your name \u2014"),
                        USERS.map(function (u) { return React.createElement("option", { key: u.id, value: u.id }, u.emoji + " " + getDisplayName(u) + " (" + u.role + ")"); }))),
                selectedUser && !editingName && React.createElement("div", { style: { display: "flex", justifyContent: "flex-end", marginBottom: 14 } },
                    React.createElement("button", { onClick: startEdit, style: { background: "none", border: "none", color: C.orange, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", textDecoration: "underline" } }, "\u270F Edit my name")),
                selectedUser && editingName && React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.orange + "44", borderRadius: 9, padding: "12px 14px", marginBottom: 14 } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 } }, "Change Display Name"),
                    React.createElement("input", { value: editValue, onChange: function (e) { setEditValue(e.target.value); }, placeholder: "e.g. Marcus", style: { background: C.card, border: "1px solid " + C.border, borderRadius: 7, color: C.white, padding: "9px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 } }),
                    React.createElement("div", { style: { display: "flex", gap: 8 } },
                        React.createElement(Btn, { variant: "ghost", onClick: function () { setEditingName(false); }, style: { flex: 1, padding: "8px", fontSize: 12 } }, "Cancel"),
                        React.createElement(Btn, { onClick: saveEdit, disabled: !editValue.trim(), style: { flex: 2, padding: "8px", fontSize: 12 } }, "\u2713 Save Name"))),
                selected && React.createElement("div", null,
                    React.createElement(TxtIn, { label: "Your Password", value: pw, onChange: function (v) { setPw(v); }, type: "password", placeholder: "Enter your password" }),
                    err && React.createElement("div", { style: { color: C.red, fontSize: 12, marginBottom: 10 } }, "\u26A0 Wrong password. Try again or contact POTENT."),
                    revokedErr && React.createElement("div", { style: { color: C.red, fontSize: 12, marginBottom: 10, fontWeight: 700 } }, "\uD83D\uDEAB This account no longer has access. Contact the owner."),
                    React.createElement(Btn, { onClick: go, disabled: !pw, style: { width: "100%" } }, "Sign In \u2192")))));
}
// ── PUBLIC APP ────────────────────────────────────────────────────
function PublicApp(props) {
    var [tab, setTab] = useState("home");
    var [bookCity, setBookCity] = useState(null);
    var [showCustomQuote, setShowCustomQuote] = useState(false);
    var [showPartnerApp, setShowPartnerApp] = useState(false);
    var txObj = useTranslations();
    var t = txObj.t;
    var lang = txObj.lang;
    var changeLang = txObj.changeLang;
    function startBooking(city) { setBookCity(city); setTab("book"); }
    return React.createElement("div", { style: { minHeight: "100vh", background: C.black, color: C.white, fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
        showCustomQuote && React.createElement(CustomQuoteModal, { onClose: function () { setShowCustomQuote(false); } }),
        showPartnerApp && React.createElement(PartnerApplicationModal, { onClose: function () { setShowPartnerApp(false); } }),
        React.createElement("div", { style: { borderBottom: "1px solid " + C.border, position: "sticky", top: 0, background: C.black, zIndex: 200 } },
            React.createElement("div", { style: { padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid " + C.border + "88" } },
                React.createElement("div", { onClick: function () { setTab("home"); }, style: { cursor: "pointer", display: "flex", alignItems: "center", gap: 8 } },
                    React.createElement(Logo, { size: 20 }),
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 15, fontWeight: 900, letterSpacing: -0.5 } },
                            React.createElement(BrandName, null)),
                        React.createElement("div", { style: { fontSize: 7, color: C.gold, letterSpacing: 1.5, textTransform: "uppercase" } }, "A POTENT PR\u00C4D\u018FKT\u00AE COMPANY"))),
                React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
                    React.createElement(LangSwitcher, { lang: lang, changeLang: changeLang }),
                    React.createElement("a", { href: "tel:" + PHONE_NUMBER, style: { textDecoration: "none", background: C.orange, color: "#000", borderRadius: 8, padding: "7px 12px", fontSize: 12, fontWeight: 800, whiteSpace: "nowrap" } }, "📞 " + PHONE_DISPLAY))),
            React.createElement("div", { style: { display: "flex", background: C.surface } }, [["home", t("home")], ["book", t("book")], ["track", t("track")]].map(function (item) {
                return React.createElement("button", { key: item[0], onClick: function () { setTab(item[0]); }, style: { flex: 1, border: "none", borderBottom: "2px solid " + (tab === item[0] ? C.orange : "transparent"), padding: "10px 4px", cursor: "pointer", background: tab === item[0] ? C.orange + "12" : "transparent", color: tab === item[0] ? C.orange : C.dim, fontSize: 11, fontWeight: 700, fontFamily: "inherit", textAlign: "center" } }, item[1]);
            }))),
        tab === "home" && React.createElement("div", null,
            React.createElement("div", { style: { position: "relative", width: "100%", minHeight: 480, overflow: "hidden", background: "#000" } },
                React.createElement("video", { autoPlay: true, muted: true, loop: true, playsInline: true, style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: "100%", height: "100%", objectFit: "cover", opacity: 0.65 } },
                    React.createElement("source", { src: "/potent-promo.mp4", type: "video/mp4" })),
                React.createElement("div", { style: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, background: "linear-gradient(to bottom,#00000044 0%,#000000bb 60%,#080808 100%)" } }),
                React.createElement("div", { style: { position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 480, padding: "60px 24px 80px", textAlign: "center" } },
                    React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14, background: C.orange + "18", border: "1px solid " + C.orange + "44", borderRadius: 20, padding: "4px 14px" } }, "24/7 LOGISTICS \u00B7 COURIER \u00B7 PROPERTY CLEANOUTS \u00B7 JUNK REMOVAL \u00B7 DEMOLITION"),
                    React.createElement("div", { style: { fontSize: 48, fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: 12, letterSpacing: -1, textShadow: "0 2px 20px #00000088" } },
                        t("heroTitle"),
                        React.createElement("br", null),
                        React.createElement("span", { style: { color: C.orange } }, t("heroTitleSpan"))),
                    React.createElement("div", { style: { fontSize: 14, color: "rgba(255,255,255,0.7)", maxWidth: 480, lineHeight: 1.75, marginBottom: 10 } }, t("heroSub")),
                    React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center", marginBottom: 28 } }, ["Fast Dispatch", "Licensed & Insured", "Upfront Pricing", "Same-Day Service"].map(function (badge) {
                        return React.createElement("span", { key: badge, style: { fontSize: 10, color: "rgba(255,255,255,0.85)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 20, padding: "3px 11px", fontWeight: 600 } }, "✓ " + badge);
                    })),
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
            React.createElement("div", { style: { padding: "40px 24px", borderBottom: "1px solid " + C.border } },
                React.createElement("div", { style: { maxWidth: 720, margin: "0 auto" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.orange, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 6, textAlign: "center" } }, "What We Do"),
                    React.createElement("div", { style: { fontSize: 22, fontWeight: 800, color: C.white, marginBottom: 24, textAlign: "center" } }, "One Call. Every Service."),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 14, marginBottom: 24 } }, [
                        { icon: "🚚", title: "Courier & Logistics", items: ["Same-Day Delivery", "Scheduled Delivery", "Medical Courier", "Legal Document Delivery", "Retail & Store Deliveries", "Freight & Pallet Delivery", "White Glove Delivery", "Last-Mile Delivery"] },
                        { icon: "🗑️", title: "Junk Removal", items: ["Single Item Pickup", "Residential Junk Removal", "Commercial Junk Removal", "Appliance Removal", "Furniture Removal", "Yard Debris Removal", "Construction Debris Removal", "Storage Unit Cleanouts"] },
                        { icon: "🏠", title: "Property Cleanouts", items: ["Estate Cleanouts", "Foreclosure Cleanouts", "Eviction Cleanouts", "Realtor Property Prep", "Hoarder Cleanouts", "Office Cleanouts", "School Cleanouts", "Warehouse Cleanouts"] },
                        { icon: "🔨", title: "Demolition", items: ["Shed Removal", "Deck Removal", "Fence Removal", "Kitchen Demo", "Bathroom Demo", "Flooring Removal", "Interior Demolition"] },
                        { icon: "🚨", title: "Emergency Services", items: ["24/7 Emergency Response", "Same-Day Junk Removal", "Storm Cleanup", "Flood Debris Removal", "Fire Damage Debris Removal", "Board-Up Cleanup", "Disaster Response"] },
                    ].map(function (cat) {
                        return React.createElement("div", { key: cat.title, style: { background: C.card, border: "1px solid " + C.border, borderRadius: 12, padding: "16px 18px" } },
                            React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 } },
                                React.createElement("span", { style: { fontSize: 18 } }, cat.icon),
                                cat.title),
                            React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4 } }, cat.items.map(function (item) {
                                return React.createElement("div", { key: item, style: { fontSize: 12, color: C.dim, display: "flex", gap: 6 } },
                                    React.createElement("span", { style: { color: C.orange } }, "\u00B7"),
                                    item);
                            })));
                    })),
                    React.createElement("div", { style: { background: C.card, border: "1.5px solid " + C.orange + "44", borderRadius: 12, padding: "18px 20px", textAlign: "center" } },
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 4 } }, "\uD83C\uDFE2 Business Accounts Available"),
                        React.createElement("div", { style: { fontSize: 12, color: C.dim, lineHeight: 1.6, marginBottom: 12 } }, "Realtors, contractors, property managers, and repeat customers \u2014 set up a Net 7 billing account and get priority scheduling with no payment required until 7 days after each job."),
                        React.createElement("button", { onClick: function () { setShowPartnerApp(true); }, style: { background: C.orange, color: "#000", border: "none", borderRadius: 9, padding: "11px 24px", fontSize: 13, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", width: "100%" } }, "\uD83E\uDD1D Apply for a Partner Account (Net 7)")))),
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
            React.createElement(ReviewsSection, { showEmpty: true }),
            React.createElement("div", { style: { padding: "44px 24px", textAlign: "center" } },
                React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C.white, marginBottom: 8 } },
                    "If it needs to move today,",
                    React.createElement("br", null),
                    React.createElement("span", { style: { color: C.orange } }, "it moves.")),
                React.createElement("div", { style: { color: C.dim, fontSize: 13, marginBottom: 24 } }, "No next week. No runaround. Reliable cargo logistics, on demand."),
                React.createElement("button", { onClick: function () { setTab("book"); }, style: { background: C.orange, color: "#000", border: "none", borderRadius: 9, padding: "14px 32px", fontSize: 15, fontWeight: 800, cursor: "pointer", fontFamily: "inherit" } }, "Book a Job Now \uD83D\uDE90"),
                React.createElement("button", { onClick: function () { setShowCustomQuote(true); }, style: { background: "transparent", color: C.orange, border: "1.5px solid " + C.orange, borderRadius: 9, padding: "14px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginTop: 8 } }, "Need Something Unique? Request Custom Quote"))),
        tab === "book" && React.createElement("div", { style: { padding: "24px 16px 60px", maxWidth: 620, margin: "0 auto" } },
            bookCity && React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: "10px 14px", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" } },
                React.createElement("div", { style: { fontSize: 13, color: C.white, fontWeight: 600 } }, bookCity.emoji + " Booking for " + bookCity.name),
                React.createElement("button", { onClick: function () { setBookCity(null); }, style: { background: "none", border: "none", color: C.dim, fontSize: 12, cursor: "pointer", fontFamily: "inherit" } }, "Change city")),
            React.createElement(BookingView, { onBook: props.onBook, t: t, lang: lang, preZone: bookCity && bookCity.zone, gasPPG: props.gasPPG, jobs: props.jobs, blockedDates: props.blockedDates })),
        tab === "track" && React.createElement("div", { style: { padding: "24px 16px 60px", maxWidth: 620, margin: "0 auto" } },
            React.createElement(TrackerView, { jobs: props.jobs })));
}
// ── ROOT ──────────────────────────────────────────────────────────
// ── POTENT OS WAITLIST PAGE — FULL SALES PAGE ──────────────────────────
// Access at: potentoperations.netlify.app?apply
// ── PDF GENERATORS ────────────────────────────────────────────────────
function generateGuidePDF() {
    var content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>The 7 Hidden Costs of Your Trucking Software Stack</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1a1a1a;}
h1{color:#C8962A;border-bottom:3px solid #C8962A;padding-bottom:10px;}
h2{color:#1a1a1a;margin-top:30px;}
.cost{background:#fff8e7;border-left:4px solid #C8962A;padding:15px 20px;margin:15px 0;border-radius:4px;}
.cost-number{font-size:24px;font-weight:bold;color:#C8962A;}
.footer{border-top:2px solid #C8962A;margin-top:40px;padding-top:20px;color:#888;font-size:12px;}
@media print{body{padding:20px;}}</style></head><body>
<h1>The 7 Hidden Costs of Your Trucking Software Stack</h1>
<p><strong>A free guide from POTENT OS</strong> — The TMS built by a carrier, for carriers.</p>
<p>Most fleet owners know what they pay for their software. What they don't know is how much their software stack is actually costing them when you add it all up.</p>

<h2>Cost #1: The Subscription Trap</h2>
<div class="cost"><span class="cost-number">$500–$2,000/month</span><br>Samsara charges $35–50/truck/month. 10 trucks = $500/month. Every year they can raise it. You have no leverage. You don't own anything.</div>

<h2>Cost #2: The Login Tax</h2>
<div class="cost"><span class="cost-number">3–5 hours/week</span><br>The average dispatcher logs into 5–7 different systems per day. Each switch costs 15–20 minutes of context-switching. That's 3–5 hours per week of pure waste — just moving between tabs.</div>

<h2>Cost #3: The Data Migration Fee</h2>
<div class="cost"><span class="cost-number">$1,500–$5,000 one-time</span><br>When you switch software (and you will), migrating your job history, customer records, and driver files is either expensive or impossible. You're held hostage by your own data.</div>

<h2>Cost #4: The Per-User Penalty</h2>
<div class="cost"><span class="cost-number">+$50–150/month per person</span><br>Add a dispatcher? That's $50–150/month more. Add a driver? Another $30–50/month. Growth penalizes you. The bigger you get, the more they charge.</div>

<h2>Cost #5: The API Dependency Tax</h2>
<div class="cost"><span class="cost-number">$100–500/month in hidden fees</span><br>Your ELD data goes to Highway. Highway connects to brokers. Motive connects to Highway. Then Motive changes their API — now Highway charges more, and that cost gets passed to you. (This happened in 2025.)</div>

<h2>Cost #6: The Dispatcher Labor Drain</h2>
<div class="cost"><span class="cost-number">$18,000–$36,000/year</span><br>If your dispatcher spends 3–4 hours per day copying data between systems at $20/hour, that's $1,500–$1,760/month — $18,000–$21,120/year — on pure manual data entry. Not dispatch. Data entry.</div>

<h2>Cost #7: The IFTA Panic Cost</h2>
<div class="cost"><span class="cost-number">$500–$2,000/quarter</span><br>Every quarter, carriers scramble to compile fuel receipts, match them to state miles, and file IFTA. Without a system tracking this automatically, you're paying an accountant or spending 2–3 days doing it yourself. That's $500–$2,000 per quarter you don't have to spend.</div>

<h2>The Total Picture</h2>
<div class="cost" style="background:#1a1a1a;color:#F0E000;border-color:#F0E000;">
<span style="font-size:28px;font-weight:bold;color:#F0E000;">$30,000–$60,000/year</span><br>
<span style="color:#fff;">That's the real cost of a fragmented software stack for a 10-truck fleet. Not $500/month. $30,000–$60,000 per year when you count it all.</span></div>

<h2>What POTENT OS Does Differently</h2>
<p>One system. Everything in it. One-time license. You own it forever. No one can raise your price next year because they changed an API policy.</p>
<ul>
<li>Dispatch + Driver Settlements + IFTA + Fleet Maintenance + Compliance + CRM — all in one login</li>
<li>No per-user fees. No per-truck fees. No integration fees.</li>
<li>$3,500–$12,500 once. Then yours forever.</li>
</ul>

<div class="footer">
<strong>POTENT OS</strong> · potentoperations.netlify.app/apply · (770) 648-4228 · potentlogistics@pm.me<br>
© 2026 ANTHONY EMMANUEL FIGUEROA MENDES® · POTENT PRÄDƏKT® · Private access only
</div>
</body></html>`;
    var blob = new Blob([content], { type: "text/html" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "7-Hidden-Costs-Guide-POTENT-OS.html";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
function generateCheatSheetPDF() {
    var content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>The Dispatch Cheat Sheet — POTENT OS</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:30px;color:#1a1a1a;}
h1{color:#C8962A;border-bottom:3px solid #C8962A;padding-bottom:8px;font-size:28px;}
h2{color:#C8962A;font-size:16px;margin-top:20px;margin-bottom:6px;}
table{width:100%;border-collapse:collapse;margin:10px 0;}
th{background:#1a1a1a;color:#F0E000;padding:8px 10px;text-align:left;font-size:13px;}
td{padding:7px 10px;border-bottom:1px solid #eee;font-size:13px;}
tr:nth-child(even){background:#f9f9f9;}
.badge{background:#F0E000;color:#1a1a1a;padding:2px 8px;border-radius:10px;font-size:11px;font-weight:bold;}
.red{color:#E53E3E;font-weight:bold;}
.green{color:#1DB954;font-weight:bold;}
.footer{border-top:2px solid #C8962A;margin-top:30px;padding-top:15px;color:#888;font-size:11px;}
@media print{body{padding:15px;}}
</style></head><body>
<h1>The Dispatch Cheat Sheet</h1>
<p style="color:#888;font-size:13px;"><strong>POTENT OS</strong> · Your daily operations reference · Print this and keep it at your desk</p>

<h2>PRICING QUICK REFERENCE</h2>
<table><tr><th>Service</th><th>Pricing Model</th><th>Base Rate</th></tr>
<tr><td>Delivery</td><td>Per mile</td><td>$4.50/mile</td></tr>
<tr><td>Freight Transport</td><td>Fixed zone</td><td>Local $400 · Regional $750 · Long Dist $1,500</td></tr>
<tr><td>Event Drop-Off</td><td>Per mile</td><td>$4.50/mile</td></tr>
<tr><td>Discreet/High-Value</td><td>Fixed zone</td><td>Local $500 · Regional $900 · Long Dist $1,800</td></tr>
<tr><td>Junk Removal</td><td>Load size</td><td>$200 / $350 / $600 / $800 / $1,000</td></tr>
<tr><td>Property Cleanouts</td><td>Property size</td><td>$1,200–$8,000+ (Pending Quote)</td></tr></table>

<h2>SPEED MULTIPLIERS</h2>
<table><tr><th>Speed</th><th>Multiplier</th><th>When to Use</th></tr>
<tr><td>Standard</td><td>×1.0</td><td>Normal scheduled dispatch</td></tr>
<tr><td>Urgent</td><td>×1.3</td><td>Priority same-day</td></tr>
<tr><td>After-Hours</td><td>×1.6</td><td>Late night / early morning</td></tr>
<tr><td>Overnight</td><td>×1.8</td><td>Drives overnight, arrives by morning</td></tr>
<tr><td>Emergency</td><td>×2.0</td><td>Urgent + after-hours combined</td></tr></table>

<h2>PRICING TIERS (SET FIRST ON EVERY CALL)</h2>
<table><tr><th>Tier</th><th>Discount</th><th>When to Apply</th></tr>
<tr><td>💛 Standard</td><td>Full rate</td><td>New customers, one-time jobs</td></tr>
<tr><td>👨‍👩‍👧 Family/Loyalty</td><td>15% off</td><td>Returning customers, referrals</td></tr>
<tr><td>🤝 Lowest Floor</td><td class="red">20% off</td><td class="red">ONLY when needed to close. Never lead with this.</td></tr></table>

<h2>ADD-ONS QUICK REFERENCE</h2>
<table><tr><th>Add-On</th><th>Fee</th></tr>
<tr><td>Helper needed</td><td>+$100</td></tr>
<tr><td>Extra stop</td><td>+$40</td></tr>
<tr><td>Medium weight (50–150 lbs)</td><td>+$50</td></tr>
<tr><td>Heavy weight (150–300 lbs)</td><td>+$100</td></tr>
<tr><td>Piano-class (300+ lbs)</td><td>+$200</td></tr>
<tr><td>24/7 Emergency Dispatch</td><td>+$250</td></tr>
<tr><td>Same-Day Guaranteed</td><td>+$150</td></tr>
<tr><td>Holiday Service</td><td>+$300</td></tr>
<tr><td>Cash payment</td><td>−10%</td></tr></table>

<h2>JOB STATUS FLOW</h2>
<table><tr><th>Status</th><th>Meaning</th><th>Who Updates It</th></tr>
<tr><td><span class="badge">New</span></td><td>Just booked</td><td>System (auto)</td></tr>
<tr><td><span class="badge">Confirmed</span></td><td>Customer confirmed</td><td>Dispatch</td></tr>
<tr><td><span class="badge">Assigned</span></td><td>Driver assigned</td><td>Dispatch</td></tr>
<tr><td><span class="badge">En Route</span></td><td>Heading to pickup</td><td>Driver</td></tr>
<tr><td><span class="badge">Arrived</span></td><td>At customer location</td><td>Driver</td></tr>
<tr><td><span class="badge">In Progress</span></td><td>Working the job</td><td>Driver</td></tr>
<tr><td><span class="badge">Loading</span></td><td>Loading the truck</td><td>Driver</td></tr>
<tr><td><span class="badge">In Transit</span></td><td>Heading to destination</td><td>Driver</td></tr>
<tr><td><span class="badge">Delivered</span></td><td>Job complete</td><td>Driver</td></tr>
<tr><td><span class="badge" style="background:#1DB954;">Paid</span></td><td>Payment received</td><td>Dispatch</td></tr>
<tr><td><span class="badge" style="background:#1DB954;">Completed</span></td><td>Fully closed out</td><td>Dispatch</td></tr>
<tr><td><span class="badge" style="background:#E53E3E;color:#fff;">Cancelled</span></td><td>Cancelled — note reason</td><td>Dispatch/Owner</td></tr></table>

<h2>CANCELLATION POLICY (TELL EVERY CUSTOMER)</h2>
<table><tr><th>Timing</th><th>Policy</th></tr>
<tr><td>Same-day / Urgent jobs</td><td class="red">NON-REFUNDABLE. Final once confirmed.</td></tr>
<tr><td>Under 24 hours</td><td>$100 dispatch fee retained. Balance refunded.</td></tr>
<tr><td>24–48 hours</td><td>50% cancellation fee.</td></tr>
<tr><td class="green">48+ hours</td><td class="green">Free cancellation. Full refund.</td></tr></table>

<h2>DUMP FEES (INTERNAL — NEVER SHARE WITH CUSTOMERS)</h2>
<table><tr><th>Item</th><th>Dump Fee</th></tr>
<tr><td>Mattress / Box Spring</td><td>$36 each</td></tr>
<tr><td>Tire off rim</td><td>$24</td></tr>
<tr><td>Tire on rim</td><td>$30</td></tr>
<tr><td>Refrigerator / AC</td><td>$60</td></tr>
<tr><td>TV</td><td>$45</td></tr>
<tr><td>Paint / Hazmat</td><td>$15</td></tr></table>

<div class="footer">
<strong>POTENT OS</strong> · A POTENT PRÄDƏKT® Product · © 2026 ANTHONY EMMANUEL FIGUEROA MENDES®<br>
Keep this confidential — for authorized POTENT OS users only.
</div>
</body></html>`;
    var blob = new Blob([content], { type: "text/html" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "Dispatch-Cheat-Sheet-POTENT-OS.html";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
function generateQuizReport(answers) {
    var swCost = (answers.swMonthly || 0) * 12;
    var laborCost = Math.round((answers.hoursPerDay || 0) * (answers.hourlyRate || 0) * 22 * 12);
    var iftaCost = Math.round((answers.truckCount || 1) * 500);
    var migrationRisk = 2500;
    var totalBurn = swCost + laborCost + iftaCost + migrationRisk;
    var plan = answers.truckCount <= 10 ? "Starter ($3,500)" : answers.truckCount <= 50 ? "Growth ($6,500)" : "Fleet ($12,500)";
    var planCost = answers.truckCount <= 10 ? 3500 : answers.truckCount <= 50 ? 6500 : 12500;
    var year1Savings = totalBurn - planCost;
    var year3Savings = (totalBurn * 3) - planCost;
    var content = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Your Software Cost Diagnostic — POTENT OS</title>
<style>body{font-family:Arial,sans-serif;max-width:800px;margin:0 auto;padding:40px;color:#1a1a1a;}
h1{color:#C8962A;border-bottom:3px solid #C8962A;padding-bottom:10px;}
.total{background:#1a1a1a;color:#F0E000;padding:20px 24px;border-radius:8px;margin:20px 0;text-align:center;}
.total-num{font-size:48px;font-weight:bold;color:#F0E000;}
.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;}
.label{color:#888;}
.value{font-weight:bold;color:#E53E3E;}
.green{color:#1DB954!important;}
.rec{background:#fff8e7;border-left:4px solid #C8962A;padding:15px 20px;margin:20px 0;border-radius:4px;}
.footer{border-top:2px solid #C8962A;margin-top:40px;padding-top:20px;color:#888;font-size:12px;}
@media print{body{padding:20px;}}</style></head><body>
<h1>Your Software Stack Cost Diagnostic</h1>
<p>Generated by POTENT OS · Based on your answers · ${new Date().toLocaleDateString()}</p>
<p><strong>Fleet:</strong> ${answers.truckCount || 0} trucks · ${answers.driverCount || 0} drivers · ${answers.state || "GA"}</p>
<p><strong>Current software:</strong> ${(answers.software || []).join(", ") || "Not specified"}</p>

<h2>Your Annual Cost Breakdown</h2>
<div class="row"><span class="label">Software subscriptions (${answers.swMonthly || 0}/mo × 12)</span><span class="value">$${swCost.toLocaleString()}/yr</span></div>
<div class="row"><span class="label">Dispatcher labor — data entry (${answers.hoursPerDay || 0} hrs/day × $${answers.hourlyRate || 0}/hr × 22 days × 12 mo)</span><span class="value">$${laborCost.toLocaleString()}/yr</span></div>
<div class="row"><span class="label">IFTA compliance cost (manual tracking + filing)</span><span class="value">$${iftaCost.toLocaleString()}/yr</span></div>
<div class="row"><span class="label">Data migration risk / switching cost (estimated)</span><span class="value">$${migrationRisk.toLocaleString()}</span></div>

<div class="total">
<div style="font-size:16px;margin-bottom:8px;color:#fff;">YOUR TOTAL ANNUAL SOFTWARE STACK COST</div>
<div class="total-num">$${totalBurn.toLocaleString()}</div>
<div style="color:#ccc;font-size:14px;">per year — every year — as long as you use your current stack</div>
</div>

<div class="rec">
<h2 style="margin-top:0;color:#C8962A;">Recommended Plan: ${plan}</h2>
<div class="row"><span class="label">POTENT OS one-time cost</span><span class="value" style="color:#1DB954;">$${planCost.toLocaleString()} (once)</span></div>
<div class="row"><span class="label">Year 1 savings</span><span class="value" style="color:#1DB954;">$${year1Savings.toLocaleString()}</span></div>
<div class="row"><span class="label">3-year savings</span><span class="value" style="color:#1DB954;">$${year3Savings.toLocaleString()}</span></div>
<div class="row"><span class="label">Year 2 and beyond (annual savings)</span><span class="value" style="color:#1DB954;">$${totalBurn.toLocaleString()}/yr (free after year 1)</span></div>
</div>

<h2>What's Bleeding You The Most</h2>
${swCost > laborCost ? '<p>Your biggest cost is <strong>software subscriptions</strong>. You\'re paying for software that raises its price every year and you own nothing.</p>' : '<p>Your biggest cost is <strong>dispatcher labor</strong> — the hidden hours spent copying data between systems that POTENT OS eliminates entirely.</p>'}

<h2>Next Step</h2>
<p>Apply for early access to POTENT OS at:</p>
<p style="font-size:20px;font-weight:bold;color:#C8962A;">potentoperations.netlify.app/apply</p>
<p>3 slots available this month. Private access only. We review every application personally.</p>

<div class="footer">
<strong>POTENT OS</strong> · potentoperations.netlify.app · (770) 648-4228 · potentlogistics@pm.me<br>
© 2026 ANTHONY EMMANUEL FIGUEROA MENDES® · POTENT PRÄDƏKT® · Actual savings may vary.
</div>
</body></html>`;
    var blob = new Blob([content], { type: "text/html" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "My-Software-Cost-Diagnostic-POTENT-OS.html";
    a.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}
// ── DIAGNOSTIC QUIZ COMPONENT ──────────────────────────────────────────
function DiagnosticQuiz(props) {
    var [step, setStep] = useState(1);
    var [a, setA] = useState({ truckCount: 1, driverCount: 1, state: "GA", software: [], swMonthly: 0, hoursPerDay: 2, hourlyRate: 20 });
    function set(k, v) { setA(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); }
    function toggleSw(sw) { setA(function (p) { var n = Object.assign({}, p); var list = p.software.slice(); var i = list.indexOf(sw); if (i > -1)
        list.splice(i, 1);
    else
        list.push(sw); n.software = list; return n; }); }
    var swCost = (a.swMonthly || 0) * 12;
    var laborCost = Math.round((a.hoursPerDay || 0) * (a.hourlyRate || 0) * 22 * 12);
    var totalBurn = swCost + laborCost + Math.round((a.truckCount || 1) * 500) + 2500;
    var planCost = a.truckCount <= 10 ? 3500 : a.truckCount <= 50 ? 6500 : 12500;
    var savings = totalBurn - planCost;
    var inputStyle = { background: "#1a1a1a", border: "1px solid #333", borderRadius: 9, color: "#F2F2F2", padding: "12px 16px", fontSize: 15, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
    var labelStyle = { fontSize: 11, color: "#888", fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 1, display: "block" };
    return React.createElement("div", { style: { fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#F2F2F2" } },
        step === 1 && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: "#F2F2F2", marginBottom: 6 } }, "Step 1 of 3 \u2014 Your Fleet"),
            React.createElement("div", { style: { fontSize: 12, color: "#888", marginBottom: 20 } }, "Tell us about your operation so we can calculate your real software costs."),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px", marginBottom: 14 } },
                React.createElement("div", null,
                    React.createElement("label", { style: labelStyle }, "Trucks"),
                    React.createElement("input", { type: "number", value: a.truckCount, min: 1, onChange: function (e) { set("truckCount", Number(e.target.value)); }, style: inputStyle })),
                React.createElement("div", null,
                    React.createElement("label", { style: labelStyle }, "Drivers"),
                    React.createElement("input", { type: "number", value: a.driverCount, min: 1, onChange: function (e) { set("driverCount", Number(e.target.value)); }, style: inputStyle })),
                React.createElement("div", null,
                    React.createElement("label", { style: labelStyle }, "State"),
                    React.createElement("input", { value: a.state, onChange: function (e) { set("state", e.target.value.toUpperCase().substring(0, 2)); }, style: inputStyle, placeholder: "GA" }))),
            React.createElement("label", { style: labelStyle }, "What software are you currently using? (select all)"),
            React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 } }, ["Samsara", "Motive/KeepTruckin", "QuickBooks", "Excel/Spreadsheets", "DAT/Truckstop", "Axele", "Rose Rocket", "McLeod", "Aljex", "TruckingOffice", "Google Calendar", "Paper/Manual", "Other"].map(function (sw) {
                var on = a.software.indexOf(sw) > -1;
                return React.createElement("div", { key: sw, onClick: function () { toggleSw(sw); }, style: { border: "1px solid " + (on ? "#F0E000" : "#333"), borderRadius: 7, padding: "7px 14px", cursor: "pointer", background: on ? "#F0E00018" : "transparent", fontSize: 12, fontWeight: 600, color: on ? "#F0E000" : "#888" } }, sw);
            })),
            React.createElement("button", { onClick: function () { setStep(2); }, disabled: !a.truckCount, style: { background: "#F0E000", color: "#000", border: "none", borderRadius: 9, padding: "13px 32px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", width: "100%" } }, "Next \u2192")),
        step === 2 && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: "#F2F2F2", marginBottom: 6 } }, "Step 2 of 3 \u2014 Your Costs"),
            React.createElement("div", { style: { fontSize: 12, color: "#888", marginBottom: 20 } }, "Be honest \u2014 this is just for your own diagnosis."),
            React.createElement("div", { style: { marginBottom: 14 } },
                React.createElement("label", { style: labelStyle }, "Total monthly software spend (all subscriptions combined)"),
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                    React.createElement("span", { style: { color: "#888", fontSize: 16 } }, "$"),
                    React.createElement("input", { type: "number", value: a.swMonthly, min: 0, onChange: function (e) { set("swMonthly", Number(e.target.value)); }, style: inputStyle, placeholder: "e.g. 800" }))),
            React.createElement("div", { style: { marginBottom: 14 } },
                React.createElement("label", { style: labelStyle }, "Hours per day your dispatcher (or you) spends moving data between systems"),
                React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } }, [1, 2, 3, 4, 5, 6].map(function (n) { return React.createElement("div", { key: n, onClick: function () { set("hoursPerDay", n); }, style: { border: "1.5px solid " + (a.hoursPerDay === n ? "#F0E000" : "#333"), borderRadius: 8, padding: "10px 18px", cursor: "pointer", background: a.hoursPerDay === n ? "#F0E00018" : "transparent", fontSize: 14, fontWeight: 700, color: a.hoursPerDay === n ? "#F0E000" : "#888" } },
                    n,
                    "hr"); }))),
            React.createElement("div", { style: { marginBottom: 20 } },
                React.createElement("label", { style: labelStyle }, "Dispatcher hourly rate (or your own hourly value if you do dispatch)"),
                React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                    React.createElement("span", { style: { color: "#888", fontSize: 16 } }, "$"),
                    React.createElement("input", { type: "number", value: a.hourlyRate, min: 10, onChange: function (e) { set("hourlyRate", Number(e.target.value)); }, style: inputStyle, placeholder: "e.g. 20" }))),
            React.createElement("div", { style: { display: "flex", gap: 8 } },
                React.createElement("button", { onClick: function () { setStep(1); }, style: { background: "transparent", color: "#888", border: "1px solid #333", borderRadius: 9, padding: "12px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", flex: 1 } }, "\u2190 Back"),
                React.createElement("button", { onClick: function () { setStep(3); }, style: { background: "#F0E000", color: "#000", border: "none", borderRadius: 9, padding: "12px 20px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", flex: 2 } }, "Calculate My Costs \u2192"))),
        step === 3 && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 18, fontWeight: 800, color: "#F2F2F2", marginBottom: 16 } }, "Your Diagnosis"),
            React.createElement("div", { style: { background: "#1a1a1a", border: "2px solid #F0E000", borderRadius: 12, padding: "20px", textAlign: "center", marginBottom: 16 } },
                React.createElement("div", { style: { fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 } }, "Your Annual Software Stack Cost"),
                React.createElement("div", { style: { fontSize: 52, fontWeight: 900, color: "#F0E000" } }, "$" + totalBurn.toLocaleString()),
                React.createElement("div", { style: { fontSize: 12, color: "#666", marginTop: 4 } }, "every year \u00B7 as long as you use your current stack")),
            [["Software subscriptions", "$" + swCost.toLocaleString() + "/yr", "#E53E3E"], ["Dispatcher labor (data entry)", "$" + laborCost.toLocaleString() + "/yr", "#E53E3E"], ["IFTA compliance cost (est.)", "$" + Math.round((a.truckCount || 1) * 500).toLocaleString() + "/yr", "#E53E3E"], ["Data migration risk", "$2,500", "#E53E3E"]].map(function (r) {
                return React.createElement("div", { key: r[0], style: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #222", fontSize: 13 } },
                    React.createElement("span", { style: { color: "#888" } }, r[0]),
                    React.createElement("span", { style: { fontWeight: 700, color: r[2] } }, r[1]));
            }),
            React.createElement("div", { style: { background: "#1DB95418", border: "1px solid #1DB95444", borderRadius: 10, padding: "14px 16px", marginTop: 16, marginBottom: 16 } },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: "#1DB954", marginBottom: 8 } }, "Recommended Plan: " + (a.truckCount <= 10 ? "🟢 Starter $3,500" : a.truckCount <= 50 ? "🔵 Growth $6,500" : "🟣 Fleet $12,500")),
                [["One-time cost", "$" + planCost.toLocaleString(), "#1DB954"], ["Year 1 savings", "$" + savings.toLocaleString(), "#1DB954"], ["Annual savings after year 1", "$" + totalBurn.toLocaleString() + "/yr", "#1DB954"]].map(function (r) {
                    return React.createElement("div", { key: r[0], style: { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #1DB95422", fontSize: 12 } },
                        React.createElement("span", { style: { color: "#888" } }, r[0]),
                        React.createElement("span", { style: { fontWeight: 700, color: r[2] } }, r[1]));
                })),
            React.createElement("button", { onClick: function () { generateQuizReport(a); }, style: { background: "#F0E000", color: "#000", border: "none", borderRadius: 9, padding: "13px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", width: "100%", marginBottom: 8 } }, "\uD83D\uDCE5 Download My Full Report"),
            React.createElement("button", { onClick: function () { props.onApply(); }, style: { background: "transparent", color: "#F0E000", border: "1.5px solid #F0E000", borderRadius: 9, padding: "11px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", width: "100%" } }, "Apply for Early Access \u2192")));
}
// ── FULL WAITLIST PAGE ─────────────────────────────────────────────────
function WaitlistPage() {
    var [f, setF] = useState({ company_name: "", contact_name: "", email: "", phone: "", truck_count: "", driver_count: "", state: "", service_type: "", monthly_revenue: "", how_heard: "", notes: "" });
    var [sent, setSent] = useState(false);
    var [loading, setLoading] = useState(false);
    var [err, setErr] = useState(false);
    var [showQuiz, setShowQuiz] = useState(false);
    var [activeSection, setActiveSection] = useState("home");
    function set(k, v) { setF(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); }
    function submit() {
        if (!f.company_name || !f.contact_name || !f.email)
            return;
        setLoading(true);
        fetch(SUPABASE_URL + "/rest/v1/waitlist", {
            method: "POST",
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "return=minimal" },
            body: JSON.stringify(Object.assign({}, f, { truck_count: Number(f.truck_count) || 0, driver_count: Number(f.driver_count) || 0, status: "pending" }))
        }).then(function (r) {
            setLoading(false);
            if (r.ok || r.status === 201) {
                setSent(true);
            }
            else {
                setErr(true);
                setTimeout(function () { setErr(false); }, 4000);
            }
        }).catch(function () { setLoading(false); setErr(true); setTimeout(function () { setErr(false); }, 4000); });
    }
    var C2 = { black: "#080808", card: "#111111", surface: "#161616", border: "#222222", orange: "#F0E000", dim: "#888888", faint: "#333333", white: "#F2F2F2", green: "#1DB954", red: "#E53E3E", blue: "#4299E1" };
    var ff = "'DM Sans','Segoe UI',sans-serif";
    var ALL_FEATURES = [
        { cat: "📦 Booking & Dispatch", items: ["Public customer booking wizard (5-step)", "Admin phone quote panel", "Manual job creation", "Instant online quotes", "Save pending quote for follow-up", "13-step job status tracking", "Job search and filtering", "Job notes", "Job tagged with booking employee", "Extra stop tracking", "Helper needed tracking", "Item weight tracking (4 tiers)", "Custom Price Override", "Load cloning", "Bulk status changes", "Bulk assignment", "Multi-stop load planning", "Deadhead tracking", "Lane history"] },
        { cat: "💲 Pricing Engine", items: ["6 service types with distinct pricing", "Distance-based pricing ($4.50/mile)", "Fixed zone pricing (Freight & Discreet)", "Load size pricing (Junk Removal)", "Property size pricing (Cleanouts)", "Speed multipliers (×1 to ×2)", "Weight add-ons (4 tiers)", "Helper add-on (+$100)", "Extra stop fee (+$40)", "Emergency add-ons (3 types)", "Pricing tiers (Standard/Loyalty/Floor)", "Cash discount (10%)", "Custom Price Override", "Live real-time quote updates", "Line-item quote breakdown", "Fuel cost shown in quote", "Price guarantee language"] },
        { cat: "⛽ Fuel & Gas Tracking", items: ["Gas price updates every 5 minutes", "All 50 states coverage", "Live fuel cost per trip", "Fuel cost shown in customer quote", "Fuel cost feeds job profitability", "Automatic fuel cost calculation"] },
        { cat: "⏱ Stop Timer & Job Cost", items: ["Built-in job timer", "Start/Pause functionality", "Tracks total job time", "Feeds into job cost calculation", "True profit per job (revenue − fuel − labor − expenses)"] },
        { cat: "📅 Calendar & Anti-Overbooking", items: ["Monthly calendar view", "Color-coded availability", "Block/Unblock days", "Prevents overbooking", "Driver availability tracking", "Equipment availability tracking"] },
        { cat: "🚨 Exception Dashboard", items: ["Late jobs alerts", "Unassigned jobs alerts", "Pending quotes alerts", "Price override alerts", "Payment failure alerts", "Cancelled jobs alerts", "Proactive operations management"] },
        { cat: "💸 Expense Tracking", items: ["Fuel expense capture", "Toll/parking/supplies tracking", "Link expense to specific job", "State field for IFTA", "Today's expenses summary", "Feeds into profitability"] },
        { cat: "💰 Driver Settlements", items: ["Per mile pay structure", "Per load (flat) pay structure", "Percentage of load pay structure", "Auto-calculation when job Completed", "Fuel advance deductions", "Damage deductions", "Insurance deductions", "Equipment rental deductions", "Other deductions with notes", "Settlement sheet with gross/net pay", "Export as PDF/print view", "Paid vs unpaid tracking", "Driver sees own settlement history", "CSV export for QuickBooks"] },
        { cat: "📄 Document Management", items: ["Documents tab on each job", "BOL photo upload", "POD photo upload", "Receipt upload", "Scale ticket upload", "Lumper receipt upload", "Camera integration (direct photo)", "Link documents to jobs/customers", "Document search", "E-signature capture on phone", "BOL template from job data"] },
        { cat: "⛽ IFTA Report Generator", items: ["Track fuel purchases by state", "Track miles driven by state", "Quarterly IFTA report generation", "Miles per state breakdown", "Gallons per state breakdown", "Tax owed/credit calculation", "Export as CSV for filing", "IFTA summary dashboard"] },
        { cat: "🚛 Fleet Maintenance", items: ["Truck/trailer records", "VIN tracking", "Make/model/year/plate tracking", "Registration expiry alerts", "Preventive maintenance scheduling", "Oil change tracking", "Tire rotation tracking", "Brake inspection tracking", "Repair history with cost", "Alert when maintenance due", "Insurance policy expiry alerts"] },
        { cat: "📋 Compliance Tracking", items: ["CDL number and expiry tracking", "Medical card expiry tracking", "MVR date tracking", "30-day expiration alerts", "CDL photo storage", "Medical card photo storage", "Accident records", "Ticket records", "DOT inspection records", "Drug test tracking", "Alcohol test tracking", "Clearinghouse status tracking"] },
        { cat: "🎯 CRM Pipeline", items: ["Lead capture form on public site", "Lead stage tracking (5 stages)", "Follow-up reminders", "Sales activity log", "Convert lead to customer", "Salesperson scoreboard", "Calls/quotes/bookings per rep", "Close rate per rep", "Revenue per rep", "Follow-ups pending per rep"] },
        { cat: "🌐 Customer Portal", items: ["Customer login with email", "View own jobs and status", "Live status tracker on each job", "Request new booking", "Rate quote request form", "Call/text dispatcher directly", "Delivery notifications"] },
        { cat: "🚐 Driver App", items: ["Browser-based (no app store needed)", "View assigned loads", "Accept/Decline loads", "Turn-by-turn navigation (Google/Apple Maps)", "BOL/POD photo capture", "E-signature capture", "Log fuel purchases by state", "Status updates from phone", "Job history view"] },
        { cat: "📈 Reporting & Analytics", items: ["Revenue per truck", "Revenue per mile (RPM)", "Cost per mile (CPM)", "Profit per mile", "Profit per job", "Lane profitability", "Driver productivity", "Customer profitability", "Equipment utilization", "On-time performance", "Accounts receivable aging", "Cash flow report", "Deadhead tracking", "Lane history", "KPI dashboard"] },
        { cat: "📊 QuickBooks Export", items: ["Invoice CSV export", "Expense CSV export", "Settlement CSV export", "QuickBooks-compatible format", "One-click download"] },
        { cat: "💳 Payments", items: ["Stripe live integration", "Card payments at booking", "Cash discount (10%)", "Payment status tracking", "Refund process (Owner only)", "Payment failure alerts", "Net 7 partner accounts", "Net 14 payment terms"] },
        { cat: "📧 Communications", items: ["EmailJS booking confirmations", "Customer confirmation email", "Call/text buttons from job records", "Status notification emails", "Quote request via customer portal"] },
        { cat: "🤖 AI Document Extraction", items: ["Rate confirmation scanning", "BOL scanning", "Receipt/expense scanning", "CDL scanning", "Auto-creates draft job from rate con", "Auto-logs expense from receipt", "~$0.01 per scan"] },
        { cat: "🤝 Carrier & Broker Management", items: ["Carrier database (MC/DOT/contact)", "Insurance expiry tracking", "30-day insurance alerts", "Carrier performance rating (1-5 stars)", "Rate agreement notes", "Broker database", "Broker credit score tracking", "Broker days-to-pay tracking", "Credit limit tracking"] },
        { cat: "📍 Geocoding & Mapping", items: ["Real geocoding for any US address", "Distance calculation (haversine)", "Road factor adjustment (×1.25)", "Route state breakdown for IFTA"] },
        { cat: "👥 Customer Types & Accounts", items: ["Residential customers", "Repeat customers (loyalty discount)", "Business/Commercial customers", "Net 7 partner accounts", "Net 14 payment terms", "Customer credit limits", "Business account history"] },
        { cat: "🔐 Access Control", items: ["4 individual logins", "Role-based tab access", "Owner — full access (all tabs)", "Dispatch — quote/jobs/calendar/driver", "Driver — driver app only", "Login persistence", "Audit trail", "Per-employee earnings tracking", "Job tagged to booking employee"] },
        { cat: "⚖ Trust & Legal", items: ["Terms of Service checkbox required", "Price guarantee language", "Cancellation policy displayed", "Binding arbitration clause", "Liability cap", "7-day claims window", "ToS footer link"] },
        { cat: "⭐ Social Proof", items: ["Customer reviews section on homepage", "Star rating system", "Review modal for customers", "Reviews display publicly"] },
        { cat: "🏢 POTENT OS SaaS Platform", items: ["Multi-tenant architecture", "One codebase, unlimited customers", "Org-level data isolation", "Row Level Security (Supabase)", "License manager dashboard", "Waitlist management", "One-click customer onboarding", "Starter/Growth/Fleet plan tiers", "Plan-based feature flags", "Platform audit log"] },
    ];
    var totalFeatures = ALL_FEATURES.reduce(function (s, c) { return s + c.items.length; }, 0);
    if (sent)
        return React.createElement("div", { style: { minHeight: "100vh", background: C2.black, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: ff } },
            React.createElement("div", { style: { maxWidth: 520, textAlign: "center" } },
                React.createElement("div", { style: { fontSize: 60, marginBottom: 16 } }, "\uD83C\uDF89"),
                React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C2.white, marginBottom: 10 } }, "Application Received!"),
                React.createElement("div", { style: { fontSize: 14, color: C2.dim, lineHeight: 1.8, marginBottom: 24 } },
                    "We've received your application for ",
                    React.createElement("strong", { style: { color: C2.orange } }, f.company_name),
                    ". Our team reviews every application personally and will reach out within 1-2 business days."),
                React.createElement("div", { style: { background: C2.card, border: "1px solid " + C2.border, borderRadius: 12, padding: "20px", textAlign: "left", marginBottom: 20 } },
                    React.createElement("div", { style: { fontSize: 12, color: C2.dim, lineHeight: 2.2 } },
                        React.createElement("div", null, "\u2705 Application received"),
                        React.createElement("div", null, "\u23F3 Personal review (1-2 business days)"),
                        React.createElement("div", null, "\uD83D\uDCDE We call to discuss your operation"),
                        React.createElement("div", null, "\uD83D\uDE80 Onboarding & setup"))),
                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C2.orange, marginBottom: 12 } }, "While you wait \u2014 grab your free tools:"),
                React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
                    React.createElement("button", { onClick: generateGuidePDF, style: { background: "transparent", color: C2.orange, border: "1.5px solid " + C2.orange, borderRadius: 9, padding: "11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: ff } }, "\uD83D\uDCE5 Download: 7 Hidden Costs Guide"),
                    React.createElement("button", { onClick: generateCheatSheetPDF, style: { background: "transparent", color: C2.orange, border: "1.5px solid " + C2.orange, borderRadius: 9, padding: "11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: ff } }, "\uD83D\uDCE5 Download: Dispatch Cheat Sheet"))));
    return React.createElement("div", { style: { minHeight: "100vh", background: C2.black, fontFamily: ff, color: C2.white } },
        React.createElement("div", { style: { position: "sticky", top: 0, background: C2.black + "EE", borderBottom: "1px solid " + C2.border, padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", zIndex: 100, backdropFilter: "blur(8px)" } },
            React.createElement("div", { style: { fontSize: 18, fontWeight: 900 } },
                "POTENT ",
                React.createElement("span", { style: { color: C2.orange } }, "OS")),
            React.createElement("div", { style: { display: "flex", gap: 8 } },
                React.createElement("a", { href: "#free-tools", style: { textDecoration: "none" } },
                    React.createElement("button", { style: { background: "transparent", color: C2.dim, border: "1px solid " + C2.border, borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: ff } }, "Free Tools")),
                React.createElement("a", { href: "#apply", style: { textDecoration: "none" } },
                    React.createElement("button", { style: { background: C2.orange, color: "#000", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 11, fontWeight: 800, cursor: "pointer", fontFamily: ff } }, "Apply Now")))),
        React.createElement("div", { style: { background: "linear-gradient(180deg,#0d0d0d,#080808)", padding: "70px 20px 50px", textAlign: "center", borderBottom: "1px solid " + C2.border } },
            React.createElement("div", { style: { fontSize: 11, color: C2.orange, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", marginBottom: 14 } }, "PRIVATE ACCESS \u00B7 BY APPLICATION ONLY \u00B7 3 SLOTS THIS MONTH"),
            React.createElement("div", { style: { fontSize: 60, fontWeight: 900, color: C2.white, lineHeight: 1.05, marginBottom: 14 } },
                "POTENT ",
                React.createElement("span", { style: { color: C2.orange } }, "OS")),
            React.createElement("div", { style: { fontSize: 20, color: C2.dim, maxWidth: 620, margin: "0 auto 12px", lineHeight: 1.6 } }, "The same system that runs Potent Logistics. Built by a carrier, for carriers. One-time license. No monthly fees. You own it forever."),
            React.createElement("div", { style: { fontSize: 14, color: C2.orange, fontWeight: 700, marginBottom: 30 } },
                totalFeatures,
                "+ features \u00B7 All-in-one \u00B7 No integrations needed"),
            React.createElement("div", { style: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 40 } }, ["Driver Settlements", "Fleet Maintenance", "IFTA Reports", "Compliance Tracking", "CRM Pipeline", "AI Document Extraction", "QuickBooks Export", "Real-Time Gas Prices", "Anti-Overbooking Calendar"].map(function (feat) {
                return React.createElement("span", { key: feat, style: { background: C2.orange + "18", border: "1px solid " + C2.orange + "44", color: C2.orange, borderRadius: 20, padding: "5px 14px", fontSize: 11, fontWeight: 600 } },
                    "\u2713 ",
                    feat);
            })),
            React.createElement("div", { style: { display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" } },
                React.createElement("a", { href: "#apply", style: { textDecoration: "none" } },
                    React.createElement("button", { style: { background: C2.orange, color: "#000", border: "none", borderRadius: 9, padding: "15px 36px", fontSize: 15, fontWeight: 900, cursor: "pointer", fontFamily: ff } }, "Apply for Early Access \uD83D\uDE80")),
                React.createElement("a", { href: "#free-tools", style: { textDecoration: "none" } },
                    React.createElement("button", { style: { background: "transparent", color: C2.white, border: "1.5px solid " + C2.border, borderRadius: 9, padding: "15px 28px", fontSize: 14, fontWeight: 700, cursor: "pointer", fontFamily: ff } }, "Get Free Tools First \u2192")))),
        React.createElement("div", { style: { padding: "50px 20px", borderBottom: "1px solid " + C2.border } },
            React.createElement("div", { style: { maxWidth: 720, margin: "0 auto" } },
                React.createElement("div", { style: { textAlign: "center", marginBottom: 30 } },
                    React.createElement("div", { style: { fontSize: 11, color: C2.orange, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 8 } }, "The Real Cost of Your Current Stack"),
                    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C2.white } }, "You're paying for POTENT OS whether you buy it or not.")),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 } },
                    React.createElement("div", { style: { background: C2.red + "10", border: "1px solid " + C2.red + "33", borderRadius: 12, padding: "20px" } },
                        React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: C2.red, marginBottom: 14 } }, "\u274C What You're Paying Now"),
                        [["Samsara/Motive (10 trucks)", "$6,000/yr"], ["TMS Software", "$2,400–4,800/yr"], ["Dispatcher data entry labor", "$18,000–36,000/yr"], ["IFTA manual compliance", "$2,000/yr"], ["Switching/migration costs", "$2,500+"]].map(function (r) {
                            return React.createElement("div", { key: r[0], style: { display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid " + C2.red + "22", fontSize: 12 } },
                                React.createElement("span", { style: { color: C2.dim } }, r[0]),
                                React.createElement("span", { style: { color: C2.red, fontWeight: 700 } }, r[1]));
                        }),
                        React.createElement("div", { style: { marginTop: 12, textAlign: "center", fontSize: 20, fontWeight: 900, color: C2.red } }, "$30,000\u201360,000/yr")),
                    React.createElement("div", { style: { background: C2.green + "10", border: "1px solid " + C2.green + "33", borderRadius: 12, padding: "20px" } },
                        React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: C2.green, marginBottom: 14 } }, "\u2705 POTENT OS"),
                        [["Starter (1-10 trucks)", "$3,500 once"], ["Growth (11-50 trucks)", "$6,500 once"], ["Fleet (51-150+ trucks)", "$12,500 once"], ["Monthly fees", "$0"], ["Per-user fees", "$0"], ["Per-truck fees", "$0"]].map(function (r) {
                            return React.createElement("div", { key: r[0], style: { display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid " + C2.green + "22", fontSize: 12 } },
                                React.createElement("span", { style: { color: C2.dim } }, r[0]),
                                React.createElement("span", { style: { color: C2.green, fontWeight: 700 } }, r[1]));
                        }),
                        React.createElement("div", { style: { marginTop: 12, textAlign: "center", fontSize: 20, fontWeight: 900, color: C2.green } }, "Then free forever."))))),
        React.createElement("div", { id: "free-tools", style: { padding: "60px 20px", borderBottom: "1px solid " + C2.border, background: "#0A0A0A" } },
            React.createElement("div", { style: { maxWidth: 720, margin: "0 auto" } },
                React.createElement("div", { style: { textAlign: "center", marginBottom: 36 } },
                    React.createElement("div", { style: { fontSize: 11, color: C2.orange, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 8 } }, "Free Resources"),
                    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C2.white, marginBottom: 10 } }, "Get value before you decide anything."),
                    React.createElement("div", { style: { fontSize: 13, color: C2.dim, maxWidth: 500, margin: "0 auto" } }, "These are yours free. No email required. No catch. We give before we ask.")),
                React.createElement("div", { style: { background: C2.card, border: "1px solid " + C2.border, borderRadius: 14, padding: "24px", marginBottom: 16, display: "flex", gap: 20, alignItems: "flex-start" } },
                    React.createElement("div", { style: { fontSize: 40, flexShrink: 0 } }, "\uD83D\uDCD6"),
                    React.createElement("div", { style: { flex: 1 } },
                        React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C2.white, marginBottom: 6 } }, "Free Guide: \"The 7 Hidden Costs of Your Trucking Software Stack\""),
                        React.createElement("div", { style: { fontSize: 12, color: C2.dim, marginBottom: 14, lineHeight: 1.7 } }, "Most fleet owners think they pay $500/month for software. The real number is $30,000\u201360,000 per year when you count what they don't tell you about. This guide breaks down all 7 costs with real numbers."),
                        React.createElement("button", { onClick: generateGuidePDF, style: { background: C2.orange, color: "#000", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: ff } }, "\uD83D\uDCE5 Download Free Guide"))),
                React.createElement("div", { style: { background: C2.card, border: "1px solid " + C2.border, borderRadius: 14, padding: "24px", marginBottom: 16 } },
                    React.createElement("div", { style: { display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 16 } },
                        React.createElement("div", { style: { fontSize: 40, flexShrink: 0 } }, "\uD83E\uDDEE"),
                        React.createElement("div", { style: { flex: 1 } },
                            React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C2.white, marginBottom: 6 } }, "Free Diagnostic: \"How Much Is Your Software Stack Actually Costing You?\""),
                            React.createElement("div", { style: { fontSize: 12, color: C2.dim, lineHeight: 1.7 } }, "Answer 6 questions. Get your personalized cost breakdown \u2014 software, labor, IFTA, migration risk \u2014 and a downloadable report with your exact numbers and recommended plan."))),
                    !showQuiz ? React.createElement("button", { onClick: function () { setShowQuiz(true); }, style: { background: "transparent", color: C2.orange, border: "1.5px solid " + C2.orange, borderRadius: 8, padding: "10px 20px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: ff, width: "100%" } }, "\uD83E\uDDEE Take Free Diagnostic \u2192")
                        : React.createElement("div", { style: { background: C2.surface, borderRadius: 10, padding: "20px" } },
                            React.createElement(DiagnosticQuiz, { onApply: function () { document.getElementById("apply").scrollIntoView({ behavior: "smooth" }); } }))),
                React.createElement("div", { style: { background: C2.card, border: "1px solid " + C2.border, borderRadius: 14, padding: "24px", display: "flex", gap: 20, alignItems: "flex-start" } },
                    React.createElement("div", { style: { fontSize: 40, flexShrink: 0 } }, "\uD83D\uDCCB"),
                    React.createElement("div", { style: { flex: 1 } },
                        React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C2.white, marginBottom: 6 } }, "Free Playbook Excerpt: \"The Dispatch Cheat Sheet\""),
                        React.createElement("div", { style: { fontSize: 12, color: C2.dim, marginBottom: 14, lineHeight: 1.7 } }, "Every pricing tier, speed multiplier, add-on fee, job status, cancellation policy, and dump fee reference \u2014 in one printable page. The exact cheat sheet our dispatchers use every day."),
                        React.createElement("button", { onClick: generateCheatSheetPDF, style: { background: C2.orange, color: "#000", border: "none", borderRadius: 8, padding: "10px 20px", fontSize: 12, fontWeight: 800, cursor: "pointer", fontFamily: ff } }, "\uD83D\uDCE5 Download Cheat Sheet"))))),
        React.createElement("div", { style: { padding: "60px 20px", borderBottom: "1px solid " + C2.border } },
            React.createElement("div", { style: { maxWidth: 900, margin: "0 auto" } },
                React.createElement("div", { style: { textAlign: "center", marginBottom: 36 } },
                    React.createElement("div", { style: { fontSize: 11, color: C2.orange, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 8 } }, "Complete Feature List"),
                    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C2.white, marginBottom: 6 } },
                        totalFeatures,
                        "+ Features. One System."),
                    React.createElement("div", { style: { fontSize: 13, color: C2.dim } }, "Everything you need to run a trucking company. Nothing you don't.")),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 } }, ALL_FEATURES.map(function (cat) {
                    return React.createElement("div", { key: cat.cat, style: { background: C2.card, border: "1px solid " + C2.border, borderRadius: 12, padding: "16px 18px" } },
                        React.createElement("div", { style: { fontSize: 13, fontWeight: 800, color: C2.white, marginBottom: 10, borderBottom: "1px solid " + C2.border, paddingBottom: 8 } }, cat.cat),
                        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 4 } }, cat.items.map(function (item) {
                            return React.createElement("div", { key: item, style: { display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: C2.dim, lineHeight: 1.5 } },
                                React.createElement("span", { style: { color: C2.orange, flexShrink: 0, fontWeight: 700 } }, "\u2713"),
                                item);
                        })));
                })))),
        React.createElement("div", { style: { padding: "60px 20px", borderBottom: "1px solid " + C2.border, background: "#0A0A0A" } },
            React.createElement("div", { style: { maxWidth: 720, margin: "0 auto" } },
                React.createElement("div", { style: { textAlign: "center", marginBottom: 36 } },
                    React.createElement("div", { style: { fontSize: 11, color: C2.orange, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 8 } }, "How It Works"),
                    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C2.white } }, "From application to live in 48 hours.")),
                React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 0 } }, [
                    { n: "01", t: "You Apply", d: "Fill out the application below. Tell us about your operation — trucks, drivers, state, current software. We review every application personally." },
                    { n: "02", t: "We Review", d: "Within 1-2 business days we call you. Not to pitch — to understand your operation and confirm it's a fit. If it's not, we'll tell you." },
                    { n: "03", t: "You Pay Once", d: "We send you a payment link for your plan ($3,500 / $6,500 / $12,500). One payment. Yours forever. No recurring fees." },
                    { n: "04", t: "We Onboard You", d: "We set up your workspace, configure your team logins, and walk you through the system personally. Not a help desk. The builder." },
                    { n: "05", t: "You Run Better", d: "Your team logs in. Dispatch books jobs. Driver updates status. IFTA tracks automatically. Settlements calculate automatically. You see real profit numbers." },
                ].map(function (step, i) {
                    return React.createElement("div", { key: step.n, style: { display: "flex", gap: 20, padding: "24px 0", borderBottom: i < 4 ? "1px solid " + C2.border : "none" } },
                        React.createElement("div", { style: { width: 48, height: 48, borderRadius: "50%", background: C2.orange + "22", border: "2px solid " + C2.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 900, color: C2.orange, flexShrink: 0 } }, step.n),
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 15, fontWeight: 800, color: C2.white, marginBottom: 4 } }, step.t),
                            React.createElement("div", { style: { fontSize: 12, color: C2.dim, lineHeight: 1.7 } }, step.d)));
                })))),
        React.createElement("div", { style: { padding: "60px 20px", borderBottom: "1px solid " + C2.border } },
            React.createElement("div", { style: { maxWidth: 720, margin: "0 auto" } },
                React.createElement("div", { style: { textAlign: "center", marginBottom: 36 } },
                    React.createElement("div", { style: { fontSize: 11, color: C2.orange, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 8 } }, "Pricing"),
                    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C2.white } }, "One-time. No surprises. Ever.")),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 16 } }, [{ t: "🟢 Starter", u: "1–10 users", p: "$3,500", s: "$149/mo", color: "#1DB954" },
                    { t: "🔵 Growth", u: "11–50 users", p: "$6,500", s: "$249/mo", color: "#4299E1" },
                    { t: "🟣 Fleet", u: "51–150+ users", p: "$12,500", s: "$399/mo", color: "#9F7AEA" }].map(function (plan) {
                    return React.createElement("div", { key: plan.t, style: { background: C2.card, border: "2px solid " + plan.color + "44", borderRadius: 14, padding: "24px", textAlign: "center" } },
                        React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C2.white, marginBottom: 4 } }, plan.t),
                        React.createElement("div", { style: { fontSize: 11, color: C2.dim, marginBottom: 12 } }, plan.u),
                        React.createElement("div", { style: { fontSize: 36, fontWeight: 900, color: C2.orange, marginBottom: 4 } }, plan.p),
                        React.createElement("div", { style: { fontSize: 12, color: C2.green, fontWeight: 700, marginBottom: 8 } }, "one-time license"),
                        React.createElement("div", { style: { fontSize: 11, color: C2.dim } },
                            plan.s,
                            " optional support"));
                })),
                React.createElement("div", { style: { textAlign: "center", marginTop: 20, fontSize: 12, color: C2.dim } }, "No per-user fees. No per-truck fees. No storage fees. No integration fees. No hidden costs. Ever."))),
        React.createElement("div", { style: { padding: "60px 20px", borderBottom: "1px solid " + C2.border, background: "#0A0A0A" } },
            React.createElement("div", { style: { maxWidth: 720, margin: "0 auto" } },
                React.createElement("div", { style: { textAlign: "center", marginBottom: 30 } },
                    React.createElement("div", { style: { fontSize: 11, color: C2.orange, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 8 } }, "Competitive Advantage"),
                    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C2.white } }, "Features nobody else has.")),
                React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 12 } }, [
                    { f: "Real-time gas prices — all 50 states, every 5 minutes", w: "Fuel cost shown in every quote. No other TMS does this." },
                    { f: "Stop timer → true job cost", w: "Revenue minus fuel minus labor = real profit. No other TMS calculates this." },
                    { f: "Anti-overbooking calendar", w: "System prevents double-booking automatically. Built in." },
                    { f: "One-time payment, own forever", w: "No competitor offers a one-time license. Not Samsara. Not McLeod. Not Rose Rocket." },
                    { f: "No integrations, no API dependencies", w: "Nobody can raise your price by changing their API policy. (See the Motive/Highway situation — 2025.)" },
                    { f: "AI document extraction (~$0.01/scan)", w: "Photo a rate con — AI creates a draft job. Photo a receipt — AI logs the expense. First TMS to do this at this price." },
                ].map(function (r) {
                    return React.createElement("div", { key: r.f, style: { background: C2.card, border: "1px solid " + C2.border, borderRadius: 10, padding: "14px 18px", display: "flex", gap: 14, alignItems: "flex-start" } },
                        React.createElement("span", { style: { color: C2.orange, fontWeight: 700, flexShrink: 0, marginTop: 1 } }, "\u2192"),
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C2.white, marginBottom: 3 } }, r.f),
                            React.createElement("div", { style: { fontSize: 11, color: C2.dim, lineHeight: 1.6 } }, r.w)));
                })))),
        React.createElement("div", { id: "apply", style: { padding: "60px 20px 80px" } },
            React.createElement("div", { style: { maxWidth: 580, margin: "0 auto" } },
                React.createElement("div", { style: { textAlign: "center", marginBottom: 28 } },
                    React.createElement("div", { style: { fontSize: 11, color: C2.orange, fontWeight: 700, letterSpacing: 2.5, textTransform: "uppercase", marginBottom: 8 } }, "Apply for Early Access"),
                    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C2.white, marginBottom: 8 } }, "3 slots available this month."),
                    React.createElement("div", { style: { fontSize: 13, color: C2.dim, lineHeight: 1.7 } }, "We review every application personally. We're selective \u2014 we want serious operators who will grow with the platform. If it's not a fit, we'll tell you.")),
                React.createElement("div", { style: { background: C2.card, border: "1px solid " + C2.border, borderRadius: 14, padding: "24px" } },
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } }, [["company_name", "Company Name *", "text", "e.g. Acme Hauling LLC"], ["contact_name", "Your Name *", "text", "Full name"]].map(function (fi) {
                        return React.createElement("div", { key: fi[0], style: { marginBottom: 12 } },
                            React.createElement("div", { style: { fontSize: 10, color: C2.dim, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 } }, fi[1]),
                            React.createElement("input", { type: fi[2], value: f[fi[0]], onChange: function (e) { set(fi[0], e.target.value); }, placeholder: fi[3], style: { background: C2.surface, border: "1px solid " + C2.border, borderRadius: 8, color: C2.white, padding: "10px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: ff, boxSizing: "border-box" } }));
                    })),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } }, [["email", "Email *", "email", "your@company.com"], ["phone", "Phone", "tel", "404-000-0000"]].map(function (fi) {
                        return React.createElement("div", { key: fi[0], style: { marginBottom: 12 } },
                            React.createElement("div", { style: { fontSize: 10, color: C2.dim, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 } }, fi[1]),
                            React.createElement("input", { type: fi[2], value: f[fi[0]], onChange: function (e) { set(fi[0], e.target.value); }, placeholder: fi[3], style: { background: C2.surface, border: "1px solid " + C2.border, borderRadius: 8, color: C2.white, padding: "10px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: ff, boxSizing: "border-box" } }));
                    })),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px" } }, [["truck_count", "# of Trucks", "number", "10"], ["driver_count", "# of Drivers", "number", "5"], ["state", "State", "text", "GA"]].map(function (fi) {
                        return React.createElement("div", { key: fi[0], style: { marginBottom: 12 } },
                            React.createElement("div", { style: { fontSize: 10, color: C2.dim, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 } }, fi[1]),
                            React.createElement("input", { type: fi[2], value: f[fi[0]], onChange: function (e) { set(fi[0], e.target.value); }, placeholder: fi[3], style: { background: C2.surface, border: "1px solid " + C2.border, borderRadius: 8, color: C2.white, padding: "10px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: ff, boxSizing: "border-box" } }));
                    })),
                    React.createElement("div", { style: { marginBottom: 12 } },
                        React.createElement("div", { style: { fontSize: 10, color: C2.dim, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 } }, "Primary Service Type"),
                        React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, ["Courier & Delivery", "Freight / Trucking", "Junk Removal", "Property Services", "Mixed Services"].map(function (s) {
                            return React.createElement("div", { key: s, onClick: function () { set("service_type", f.service_type === s ? "" : s); }, style: { border: "1px solid " + (f.service_type === s ? C2.orange : C2.border), borderRadius: 7, padding: "6px 12px", cursor: "pointer", background: f.service_type === s ? C2.orange + "18" : "transparent", fontSize: 11, fontWeight: 600, color: f.service_type === s ? C2.orange : C2.dim } }, s);
                        }))),
                    React.createElement("div", { style: { marginBottom: 12 } },
                        React.createElement("div", { style: { fontSize: 10, color: C2.dim, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 } }, "Monthly Revenue Range"),
                        React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, ["Under $10K", "$10K–$25K", "$25K–$50K", "$50K–$100K", "Over $100K"].map(function (r) {
                            return React.createElement("div", { key: r, onClick: function () { set("monthly_revenue", f.monthly_revenue === r ? "" : r); }, style: { border: "1px solid " + (f.monthly_revenue === r ? C2.orange : C2.border), borderRadius: 7, padding: "6px 12px", cursor: "pointer", background: f.monthly_revenue === r ? C2.orange + "18" : "transparent", fontSize: 11, fontWeight: 600, color: f.monthly_revenue === r ? C2.orange : C2.dim } }, r);
                        }))),
                    React.createElement("div", { style: { marginBottom: 12 } },
                        React.createElement("div", { style: { fontSize: 10, color: C2.dim, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 } }, "How did you hear about us?"),
                        React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 } }, ["Referral", "Social Media", "Google", "Word of Mouth", "Other"].map(function (h) {
                            return React.createElement("div", { key: h, onClick: function () { set("how_heard", f.how_heard === h ? "" : h); }, style: { border: "1px solid " + (f.how_heard === h ? C2.orange : C2.border), borderRadius: 7, padding: "6px 12px", cursor: "pointer", background: f.how_heard === h ? C2.orange + "18" : "transparent", fontSize: 11, fontWeight: 600, color: f.how_heard === h ? C2.orange : C2.dim } }, h);
                        }))),
                    React.createElement("div", { style: { marginBottom: 16 } },
                        React.createElement("div", { style: { fontSize: 10, color: C2.dim, fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.8 } }, "Tell us about your operation (optional)"),
                        React.createElement("textarea", { value: f.notes, onChange: function (e) { set("notes", e.target.value); }, placeholder: "What challenges are you trying to solve? What software are you using now? What would make this a 10/10 decision?", rows: 3, style: { background: C2.surface, border: "1px solid " + C2.border, borderRadius: 8, color: C2.white, padding: "10px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: ff, boxSizing: "border-box", resize: "vertical" } })),
                    err && React.createElement("div", { style: { background: C2.red + "12", border: "1px solid " + C2.red + "33", borderRadius: 8, padding: "10px 14px", marginBottom: 12, fontSize: 12, color: C2.red } }, "Something went wrong. Please try again or call (770) 648-4228."),
                    React.createElement("button", { onClick: submit, disabled: !f.company_name || !f.contact_name || !f.email || loading, style: { background: C2.orange, color: "#000", border: "none", borderRadius: 9, padding: "14px", fontSize: 15, fontWeight: 900, cursor: (!f.company_name || !f.contact_name || !f.email || loading) ? "not-allowed" : "pointer", fontFamily: ff, width: "100%", opacity: (!f.company_name || !f.contact_name || !f.email || loading) ? 0.5 : 1 } }, loading ? "Submitting..." : "Submit Application 🚀"),
                    React.createElement("div", { style: { fontSize: 10, color: C2.faint, textAlign: "center", marginTop: 10, lineHeight: 1.6 } }, "We review all applications within 1-2 business days. Not all applicants will be accepted. 3 slots available this month.")),
                React.createElement("div", { style: { textAlign: "center", marginTop: 24, fontSize: 12, color: C2.dim } },
                    "Questions? Call ",
                    React.createElement("a", { href: "tel:+17706484228", style: { color: C2.orange, textDecoration: "none" } }, "(770) 648-4228"),
                    " \u00B7 ",
                    React.createElement("a", { href: "mailto:potentlogistics@pm.me", style: { color: C2.orange, textDecoration: "none" } }, "potentlogistics@pm.me")))));
}
// ── POTENT OS LICENSE MANAGER ─────────────────────────────────────────
// Access at: yourdomain.com?potent-os-admin
// Password protected — owner eyes only
var POS_ADMIN_PW = "POTENTOS_ADMIN_2026";
var PLAN_PRICES = { starter: 3500, growth: 6500, fleet: 12500 };
var PLAN_LIMITS = { starter: "1-10 users", growth: "11-50 users", fleet: "51-150+ users" };
var PLAN_SUPPORT = { starter: 149, growth: 249, fleet: 399 };
function LicenseManager() {
    var [authed, setAuthed] = useState(function () { try {
        return localStorage.getItem("pos_authed") === "1";
    }
    catch (e) {
        return false;
    } });
    var [pw, setPw] = useState("");
    var [err, setErr] = useState(false);
    var [orgs, setOrgs] = useState([]);
    var [waitlist, setWaitlist] = useState([]);
    var [loading, setLoading] = useState(false);
    var [tab, setTab] = useState("dashboard");
    var [showAdd, setShowAdd] = useState(false);
    var [showOnboard, setShowOnboard] = useState(null);
    // Auto-load data when already authenticated
    useEffect(function () {
        if (authed)
            loadData();
    }, [authed]);
    function sbFetch(table, query) {
        return fetch(SUPABASE_URL + "/rest/v1/" + table + "?" + (query || "order=created_at.desc"), {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY }
        }).then(function (r) { return r.json(); });
    }
    function sbInsert(table, data) {
        return fetch(SUPABASE_URL + "/rest/v1/" + table, {
            method: "POST",
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
            body: JSON.stringify(data)
        }).then(function (r) { return r.json(); });
    }
    function sbUpdate(table, id, data) {
        return fetch(SUPABASE_URL + "/rest/v1/" + table + "?id=eq." + id, {
            method: "PATCH",
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY, "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });
    }
    function loadData() {
        setLoading(true);
        Promise.all([
            sbFetch("organizations"),
            sbFetch("waitlist"),
        ]).then(function (res) {
            setOrgs(Array.isArray(res[0]) ? res[0] : []);
            setWaitlist(Array.isArray(res[1]) ? res[1] : []);
            setLoading(false);
        }).catch(function () { setLoading(false); });
    }
    function doLogin() {
        if (pw === POS_ADMIN_PW) {
            try {
                localStorage.setItem("pos_authed", "1");
            }
            catch (e) { }
            setAuthed(true);
            loadData();
        }
        else {
            setErr(true);
            setTimeout(function () { setErr(false); }, 2000);
            setPw("");
        }
    }
    function doLogout() {
        try {
            localStorage.removeItem("pos_authed");
        }
        catch (e) { }
        setAuthed(false);
    }
    var totalRevenue = orgs.reduce(function (s, o) { return s + (o.plan_price || 0); }, 0);
    var activeOrgs = orgs.filter(function (o) { return o.status === "active"; }).length;
    var pendingWaitlist = waitlist.filter(function (w) { return w.status === "pending"; }).length;
    if (!authed)
        return React.createElement("div", { style: { minHeight: "100vh", background: C.black, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
            React.createElement("div", { style: { width: "100%", maxWidth: 360 } },
                React.createElement("div", { style: { textAlign: "center", marginBottom: 24 } },
                    React.createElement("div", { style: { fontSize: 32, fontWeight: 900, color: C.white } },
                        "POTENT ",
                        React.createElement("span", { style: { color: C.orange } }, "OS")),
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, letterSpacing: 2, textTransform: "uppercase", marginTop: 4 } }, "License Management")),
                React.createElement(Card, null,
                    React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 4 } }, "\uD83D\uDD10 Owner Access Only"),
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 14 } }, "This panel is for managing POTENT OS customer licenses."),
                    React.createElement(TxtIn, { label: "Password", value: pw, onChange: function (v) { setPw(v); }, type: "password", placeholder: "Enter owner password" }),
                    err && React.createElement("div", { style: { color: C.red, fontSize: 12, marginBottom: 10 } }, "\u26A0 Incorrect password."),
                    React.createElement(Btn, { onClick: doLogin, disabled: !pw, style: { width: "100%" } }, "Enter License Manager \u2192"))));
    if (loading)
        return React.createElement("div", { style: { minHeight: "100vh", background: C.black, display: "flex", alignItems: "center", justifyContent: "center", color: C.dim, fontFamily: "'DM Sans','Segoe UI',sans-serif" } }, "Loading...");
    return React.createElement("div", { style: { minHeight: "100vh", background: C.black, color: C.white, fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
        React.createElement("div", { style: { borderBottom: "1px solid " + C.border, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: C.black, zIndex: 100 } },
            React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 16, fontWeight: 900 } },
                    "POTENT ",
                    React.createElement("span", { style: { color: C.orange } }, "OS")),
                React.createElement("div", { style: { fontSize: 9, color: C.dim, letterSpacing: 1.5, textTransform: "uppercase" } }, "License Manager")),
            React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
                React.createElement(Btn, { onClick: function () { setShowAdd(true); }, style: { padding: "7px 14px", fontSize: 11 } }, "+ New Customer"),
                React.createElement(Btn, { variant: "ghost", onClick: doLogout, style: { padding: "6px 10px", fontSize: 10 } }, "Sign Out"))),
        React.createElement("div", { style: { display: "flex", gap: 4, padding: "8px 12px", borderBottom: "1px solid " + C.border, overflowX: "auto" } }, [["dashboard", "📊 Dashboard"], ["customers", "🏢 Customers"], ["waitlist", "📋 Waitlist (" + pendingWaitlist + ")"]].map(function (t) {
            return React.createElement("button", { key: t[0], onClick: function () { setTab(t[0]); }, style: { border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", background: tab === t[0] ? C.orange : "transparent", color: tab === t[0] ? "#000" : C.dim, fontWeight: 700, fontFamily: "inherit", fontSize: 11, whiteSpace: "nowrap" } }, t[1]);
        })),
        React.createElement("div", { style: { padding: "20px 16px 60px", maxWidth: 720, margin: "0 auto" } },
            tab === "dashboard" && React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 4 } }, "Platform Overview"),
                React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 20 } }, "Your POTENT OS customer base at a glance."),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 10, marginBottom: 24 } }, [["Active Customers", activeOrgs, C.green], ["Waitlist", pendingWaitlist, C.orange], ["Total Licenses", orgs.length, C.blue], ["License Revenue", "$" + totalRevenue.toLocaleString(), C.purple]].map(function (s) {
                    return React.createElement(Card, { key: s[0], style: { padding: "14px 16px" } },
                        React.createElement("div", { style: { fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 } }, s[0]),
                        React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: s[2] } }, s[1]));
                })),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 } }, [["starter", "🟢 Starter", "$3,500"], ["growth", "🔵 Growth", "$6,500"], ["fleet", "🟣 Fleet", "$12,500"]].map(function (p) {
                    var count = orgs.filter(function (o) { return o.plan === p[0]; }).length;
                    return React.createElement(Card, { key: p[0], style: { textAlign: "center", padding: "14px" } },
                        React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 4 } }, p[1]),
                        React.createElement("div", { style: { fontSize: 24, fontWeight: 900, color: C.orange, marginBottom: 2 } }, count),
                        React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                            p[2],
                            " each"),
                        React.createElement("div", { style: { fontSize: 10, color: C.faint } }, PLAN_LIMITS[p[0]]));
                }))),
            tab === "customers" && React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: C.white, marginBottom: 16 } }, "\uD83C\uDFE2 Active Customers"),
                orgs.length === 0 ? React.createElement("div", { style: { textAlign: "center", padding: "40px 0", color: C.dim, fontSize: 13 } }, "No customers yet. Add your first customer or approve a waitlist application.")
                    : orgs.map(function (org) {
                        return React.createElement(Card, { key: org.id, style: { marginBottom: 10 } },
                            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 } },
                                React.createElement("div", null,
                                    React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white } }, org.name),
                                    React.createElement("div", { style: { fontSize: 11, color: C.dim } },
                                        org.owner_email,
                                        " \u00B7 ",
                                        org.owner_phone),
                                    React.createElement("div", { style: { fontSize: 10, color: C.faint } },
                                        org.state,
                                        " \u00B7 Slug: ",
                                        org.slug)),
                                React.createElement("div", { style: { textAlign: "right" } },
                                    React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.orange } },
                                        "$",
                                        (org.plan_price || 0).toLocaleString()),
                                    React.createElement("div", { style: { background: (org.plan === "fleet" ? C.purple : org.plan === "growth" ? C.blue : C.green) + "22", color: (org.plan === "fleet" ? C.purple : org.plan === "growth" ? C.blue : C.green), borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 700, display: "inline-block", marginTop: 4 } }, org.plan?.toUpperCase()))),
                            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, marginTop: 8 } },
                                React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                                    "Max Users: ",
                                    React.createElement("span", { style: { color: C.white } }, org.max_users)),
                                React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                                    "Support: ",
                                    React.createElement("span", { style: { color: org.support_plan ? C.green : C.faint } }, org.support_plan ? "✓ $" + org.support_price + "/mo" : "None")),
                                React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                                    "Status: ",
                                    React.createElement("span", { style: { color: org.status === "active" ? C.green : C.red } }, org.status)),
                                React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                                    "Since: ",
                                    React.createElement("span", { style: { color: C.white } }, org.created_at ? org.created_at.split("T")[0] : "—"))),
                            org.notes && React.createElement("div", { style: { fontSize: 10, color: C.faint, marginTop: 6, borderTop: "1px solid " + C.border, paddingTop: 6 } }, org.notes),
                            React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 10 } },
                                React.createElement(Btn, { onClick: async function () { await sbUpdate("organizations", org.id, { status: org.status === "active" ? "suspended" : "active" }); loadData(); }, variant: org.status === "active" ? "ghost" : "success", style: { flex: 1, padding: "6px", fontSize: 10 } }, org.status === "active" ? "⏸ Suspend" : "▶ Reactivate")));
                    })),
            tab === "waitlist" && React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: C.white, marginBottom: 16 } }, "\uD83D\uDCCB Waitlist Applications"),
                waitlist.length === 0 ? React.createElement("div", { style: { textAlign: "center", padding: "40px 0", color: C.dim, fontSize: 13 } }, "No waitlist applications yet. Share your waitlist link to start collecting applications.")
                    : waitlist.map(function (w) {
                        return React.createElement(Card, { key: w.id, style: { marginBottom: 10 } },
                            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 } },
                                React.createElement("div", null,
                                    React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white } }, w.company_name),
                                    React.createElement("div", { style: { fontSize: 11, color: C.dim } },
                                        w.contact_name,
                                        " \u00B7 ",
                                        w.email,
                                        " \u00B7 ",
                                        w.phone),
                                    React.createElement("div", { style: { fontSize: 10, color: C.faint, marginTop: 2 } },
                                        w.truck_count,
                                        " trucks \u00B7 ",
                                        w.driver_count,
                                        " drivers \u00B7 ",
                                        w.state,
                                        " \u00B7 ",
                                        w.monthly_revenue)),
                                React.createElement("div", { style: { background: (w.status === "pending" ? C.orange : w.status === "converted" ? C.green : C.red) + "22", color: (w.status === "pending" ? C.orange : w.status === "converted" ? C.green : C.red), borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 700 } }, w.status)),
                            w.notes && React.createElement("div", { style: { fontSize: 11, color: C.dim, fontStyle: "italic", marginBottom: 8 } },
                                "\"",
                                w.notes,
                                "\""),
                            w.status === "pending" && React.createElement("div", { style: { display: "flex", gap: 8 } },
                                React.createElement(Btn, { onClick: function () { setShowOnboard(w); }, variant: "success", style: { flex: 2, padding: "8px", fontSize: 11 } }, "\u2705 Approve & Onboard"),
                                React.createElement(Btn, { onClick: async function () { await sbUpdate("waitlist", w.id, { status: "rejected" }); loadData(); }, variant: "danger", style: { flex: 1, padding: "8px", fontSize: 11 } }, "\u274C Reject")));
                    }))),
        showAdd && React.createElement(AddCustomerModal, { onClose: function () { setShowAdd(false); }, onSave: async function (data) {
                var res = await sbInsert("organizations", data);
                if (Array.isArray(res) && res[0]) {
                    await sbInsert("org_users", { org_id: res[0].id, name: data.owner_name, email: data.owner_email, phone: data.owner_phone, role: "owner", password_hash: data.slug.toUpperCase() + "2026", status: "active" });
                }
                setShowAdd(false);
                loadData();
            } }),
        showOnboard && React.createElement(AddCustomerModal, { entry: showOnboard, onClose: function () { setShowOnboard(null); }, onSave: async function (data) {
                var res = await sbInsert("organizations", data);
                if (Array.isArray(res) && res[0]) {
                    await sbInsert("org_users", { org_id: res[0].id, name: data.owner_name, email: data.owner_email, phone: data.owner_phone, role: "owner", password_hash: data.slug.toUpperCase() + "2026", status: "active" });
                    await sbUpdate("waitlist", showOnboard.id, { status: "converted" });
                }
                setShowOnboard(null);
                loadData();
            } }));
}
function AddCustomerModal(props) {
    var entry = props.entry || {};
    var [f, setF] = useState({
        name: entry.company_name || "",
        slug: (entry.company_name || "").toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""),
        plan: "starter", plan_price: 3500, support_plan: false, support_price: 149, max_users: 10,
        owner_name: entry.contact_name || "", owner_email: entry.email || "", owner_phone: entry.phone || "",
        state: entry.state || "GA", dot_number: "", mc_number: "", notes: "", status: "active"
    });
    function set(k, v) { setF(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); }
    return React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
            props.onClose(); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000CC", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
        React.createElement("div", { style: { background: C.card, borderRadius: 14, width: "100%", maxWidth: 540, maxHeight: "90vh", overflowY: "auto", fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "18px 20px", borderBottom: "1px solid " + C.border } },
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white } },
                    "\uD83C\uDFE2 ",
                    entry.id ? "Onboard from Waitlist" : "Add New Customer"),
                React.createElement("button", { onClick: props.onClose, style: { background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer" } }, "\u2715")),
            React.createElement("div", { style: { padding: "18px 20px" } },
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "Company Name *", value: f.name, onChange: function (v) { set("name", v); set("slug", v.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")); } }),
                    React.createElement(TxtIn, { label: "URL Slug *", value: f.slug, onChange: function (v) { set("slug", v); } })),
                React.createElement(Lbl, null, "Plan *"),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 } }, [["starter", "🟢 Starter", "$3,500", "1-10 users"], ["growth", "🔵 Growth", "$6,500", "11-50 users"], ["fleet", "🟣 Fleet", "$12,500", "51-150+ users"]].map(function (p) {
                    return React.createElement("div", { key: p[0], onClick: function () { set("plan", p[0]); set("plan_price", PLAN_PRICES[p[0]]); set("support_price", PLAN_SUPPORT[p[0]]); set("max_users", p[0] === "starter" ? 10 : p[0] === "growth" ? 50 : 150); }, style: { border: "1.5px solid " + (f.plan === p[0] ? C.orange : C.border), borderRadius: 9, padding: "10px 8px", cursor: "pointer", background: f.plan === p[0] ? C.orangeSoft : "transparent", textAlign: "center" } },
                        React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: f.plan === p[0] ? C.orange : C.white } }, p[1]),
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 900, color: C.orange, marginTop: 2 } }, p[2]),
                        React.createElement("div", { style: { fontSize: 9, color: C.dim } }, p[3]));
                })),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "License Price ($)", value: f.plan_price, onChange: function (v) { set("plan_price", Number(v)); }, type: "number" }),
                    React.createElement(TxtIn, { label: "Support Price ($/mo)", value: f.support_price, onChange: function (v) { set("support_price", Number(v)); }, type: "number" })),
                React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: C.dim } }, "\uD83D\uDCA1 Support plan ($149-$399/mo) is optional \u2014 discuss with customer separately if they want ongoing updates and support."),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "Owner Name *", value: f.owner_name, onChange: function (v) { set("owner_name", v); } }),
                    React.createElement(TxtIn, { label: "Owner Email", value: f.owner_email, onChange: function (v) { set("owner_email", v); }, type: "email" })),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "Phone", value: f.owner_phone, onChange: function (v) { set("owner_phone", v); }, type: "tel" }),
                    React.createElement(TxtIn, { label: "State", value: f.state, onChange: function (v) { set("state", v); } })),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "DOT Number", value: f.dot_number, onChange: function (v) { set("dot_number", v); } }),
                    React.createElement(TxtIn, { label: "MC Number", value: f.mc_number, onChange: function (v) { set("mc_number", v); } })),
                React.createElement(TxtIn, { label: "Notes", value: f.notes, onChange: function (v) { set("notes", v); }, rows: 2 }),
                React.createElement("div", { style: { background: C.surface, borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 11, color: C.dim } },
                    "Default owner password will be: ",
                    React.createElement("strong", { style: { color: C.orange } }, f.slug.toUpperCase() + "2026"),
                    " \u2014 share this with the customer when you onboard them."),
                React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement(Btn, { variant: "ghost", onClick: props.onClose, style: { flex: 1 } }, "Cancel"),
                    React.createElement(Btn, { onClick: function () { props.onSave(Object.assign({}, f, { status: "active", license_activated_at: new Date().toISOString() })); }, disabled: !f.name || !f.owner_name || !f.slug, style: { flex: 2 } }, "Create Customer \u2713")))));
}
function Root() {
    var [jobs, setJobs] = useState(loadJobs);
    var [isAdmin, setIsAdmin] = useState(loadAuth);
    var [currentUser, setCurrentUser] = useState(function () { return loadCurrentUser(); });
    var adminRole = currentUser ? currentUser.role : "";
    var [showLogin, setShowLogin] = useState(false);
    var [gasPPG, setGasPPG] = useState(FALLBACK_GAS);
    var [dieselPPG, setDieselPPG] = useState(FALLBACK_DIESEL);
    var [blockedDates, setBlockedDates] = useState(function () {
        try {
            var r = localStorage.getItem("pl4_blocked");
            return r ? JSON.parse(r) : [];
        }
        catch (e) {
            return [];
        }
    });
    useEffect(function () { saveJobs(jobs); }, [jobs]);
    // Pull the latest synced display names once on load so any renames made
    // on other devices show up here too. nameSyncVersion is a dummy counter
    // used purely to force a re-render once the fetch resolves — getDisplayName()
    // reads from a module-level cache, not React state, so nothing else here
    // would know new names arrived without this.
    var [nameSyncVersion, setNameSyncVersion] = useState(0);
    useEffect(function () {
        loadNameOverridesFromServer().then(function () { setNameSyncVersion(function (v) { return v + 1; }); });
    }, []);
    // Revoked-access check: on load, and then every 60s while someone is
    // logged in, re-check the synced revoke list. If the currently logged
    // in user shows up on it (owner revoked them from another device,
    // mid-session), force them out immediately rather than waiting for
    // them to refresh or re-login on their own.
    useEffect(function () {
        function checkRevoked() {
            loadRevokedFromServer().then(function () {
                var u = loadCurrentUser();
                if (u && isUserRevoked(u.id)) {
                    setIsAdmin(false);
                    setCurrentUser(null);
                    saveAuth(false);
                    saveCurrentUser(null);
                }
            });
        }
        checkRevoked();
        var iv = setInterval(checkRevoked, 60000);
        return function () { clearInterval(iv); };
    }, []);
    useEffect(function () {
        try {
            localStorage.setItem("pl4_blocked", JSON.stringify(blockedDates));
        }
        catch (e) { }
    }, [blockedDates]);
    useEffect(function () {
        fetchGasPrice().then(function (p) { setGasPPG(p); });
        fetchDieselPrice().then(function (p) { setDieselPPG(p); });
        var iv = setInterval(function () {
            fetchGasPrice().then(function (p) { setGasPPG(p); });
            fetchDieselPrice().then(function (p) { setDieselPPG(p); });
        }, 6 * 60 * 60 * 1000);
        return function () { clearInterval(iv); };
    }, []);
    function addJob(j) {
        var newJob = j;
        if (j.oosJob && j.miles) {
            var oosBlocked = getOOSDatesBlocked(j.date, j.miles);
            newJob = Object.assign({}, j, { oosBlocked: oosBlocked });
        }
        setJobs(function (p) { return [newJob].concat(p); });
        syncJobToSupabase(newJob);
    }
    function toggleBlockDate(dateStr) {
        setBlockedDates(function (prev) {
            if (prev.indexOf(dateStr) > -1)
                return prev.filter(function (d) { return d !== dateStr; });
            return prev.concat([dateStr]);
        });
    }
    // ── DETENTION / ACCESSORIAL TRACKING ─────────────────────────────
    // Real pain point: fleets lose money because nobody proves how long a
    // driver actually sat waiting at a pickup/dropoff. This stamps a real
    // timestamp when a driver marks "Arrived", and when they move past it
    // (loading, in progress, departed, delivered), checks how long they
    // were sitting. Past a free-time threshold, it auto-drafts a detention
    // charge as a flagged expense — dispatch reviews and approves it
    // rather than it just disappearing into "the driver was slow today."
    var DETENTION_FREE_MINUTES = 120; // 2 hours free, matches common industry standard
    var DETENTION_RATE_PER_HOUR = 75; // adjustable — this is a starting number, not a regulation
    function updateJob(id, s) {
        var oldJob = jobs.find(function (j) { return j.id === id; });
        if (oldJob) {
            addAuditEntry("Status Changed", id, "status", oldJob.status, s, adminRole);
        }
        var timestampPatch = {};
        var now = new Date().toISOString();
        if (s === "Arrived") {
            timestampPatch.arrivedAt = now;
        }
        // Leaving "Arrived" into any forward-moving status — check for detention
        var leavingArrived = oldJob && oldJob.status === "Arrived" && s !== "Arrived" && oldJob.arrivedAt;
        if (leavingArrived) {
            var arrivedMs = new Date(oldJob.arrivedAt).getTime();
            var elapsedMin = Math.round((Date.now() - arrivedMs) / 60000);
            if (elapsedMin > DETENTION_FREE_MINUTES) {
                var billableMin = elapsedMin - DETENTION_FREE_MINUTES;
                var billableHours = Math.round((billableMin / 60) * 10) / 10;
                var amount = Math.round(billableHours * DETENTION_RATE_PER_HOUR);
                addAccessorialCharge({
                    id: Date.now(), jobId: id, type: "Detention", createdAt: now,
                    minutesOnSite: elapsedMin, freeMinutes: DETENTION_FREE_MINUTES,
                    billableHours: billableHours, rate: DETENTION_RATE_PER_HOUR, amount: amount,
                    status: "pending_approval", // dispatch reviews before it hits the customer's invoice
                });
            }
        }
        setJobs(function (p) { return p.map(function (j) { return j.id === id ? Object.assign({}, j, { status: s }, timestampPatch) : j; }); });
        syncStatusToSupabase(id, s);
    }
    // Applies an approved accessorial charge (detention, layover, etc.) to
    // a job's final price. Kept as a separate, explicit action rather than
    // silently folded into the original quote, so the audit trail shows
    // exactly when and why a price changed after booking.
    function addAccessorialToJobPrice(jobId, amount, label) {
        var oldJob = jobs.find(function (j) { return j.id === jobId; });
        if (!oldJob)
            return;
        var newPrice = (oldJob.finalPrice || 0) + amount;
        addAuditEntry("Accessorial Charge Applied", jobId, "finalPrice", "$" + (oldJob.finalPrice || 0), "$" + newPrice + " (+" + label + " $" + amount + ")", adminRole);
        setJobs(function (p) { return p.map(function (j) { return j.id === jobId ? Object.assign({}, j, { finalPrice: newPrice, notes: (j.notes || "") + " · " + label + " +$" + amount }) : j; }); });
    }
    function login(user) {
        setIsAdmin(true);
        setCurrentUser(user);
        saveAuth(true);
        saveCurrentUser(user);
        setShowLogin(false);
    }
    function logout() {
        setIsAdmin(false);
        setCurrentUser(null);
        saveAuth(false);
        saveCurrentUser(null);
    }
    var [showFooterTos, setShowFooterTos] = useState(false);
    // ── POTENT OS LICENSE MANAGER — hidden route (?potent-os-admin) ────
    var _href = typeof window !== "undefined" ? (window.location.href || "") : "";
    var isPOSAdmin = _href.indexOf("potent-os-admin") > -1;
    var isWaitlist = _href.indexOf("apply") > -1;
    if (isPOSAdmin)
        return React.createElement(LicenseManager, null);
    if (isWaitlist)
        return React.createElement(WaitlistPage, null);
    if (isAdmin)
        return React.createElement(AdminDashboard, { jobs: jobs, onUpdateStatus: updateJob, onAddJob: addJob, onLogout: logout, gasPPG: gasPPG, dieselPPG: dieselPPG, blockedDates: blockedDates, onToggleBlock: toggleBlockDate, role: adminRole, currentUser: currentUser, onApplyAccessorial: addAccessorialToJobPrice });
    if (showLogin)
        return React.createElement(AdminLogin, { onLogin: login, key: "login-" + nameSyncVersion });
    return React.createElement("div", null,
        showFooterTos && React.createElement(TermsOfServiceModal, { onClose: function () { setShowFooterTos(false); } }),
        React.createElement(PublicApp, { jobs: jobs, onBook: addJob, gasPPG: gasPPG, blockedDates: blockedDates }),
        React.createElement("div", { style: { borderTop: "1px solid " + C.border, textAlign: "center", padding: "12px 0 20px", fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
            React.createElement("span", { onClick: function () { setShowLogin(true); }, style: { color: C.faint, fontSize: 11, cursor: "pointer", userSelect: "none" } }, "\u00A9 2026 ANTHONY EMMANUEL FIGUEROA MENDES\u00AE \u00B7 POTENT PR\u00C4D\u018FKT\u00AE \u00B7 All Rights Reserved"),
            React.createElement("span", { style: { color: C.faint, fontSize: 11 } }, " \u00B7 "),
            React.createElement("span", { onClick: function () { setShowFooterTos(true); }, style: { color: C.faint, fontSize: 11, cursor: "pointer", userSelect: "none", textDecoration: "underline" } }, "Terms of Service")));
}
// ═══════════════════════════════════════════════════════════════════
// PHASE 10 — ADVANCED REPORTING
// ═══════════════════════════════════════════════════════════════════
function AdvancedReports(props) {
    var jobs = props.jobs || [];
    var expenses = loadExpenses();
    var [reportTab, setReportTab] = useState("overview");
    var [dateFrom, setDateFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]);
    var [dateTo, setDateTo] = useState(new Date().toISOString().split("T")[0]);
    var filtered = jobs.filter(function (j) { return j.date >= dateFrom && j.date <= dateTo && j.status !== "Cancelled"; });
    var filteredExp = expenses.filter(function (e) { return e.date >= dateFrom && e.date <= dateTo; });
    var totalRevenue = filtered.reduce(function (s, j) { return s + j.finalPrice; }, 0);
    var totalMiles = filtered.reduce(function (s, j) { return s + (j.miles || 0); }, 0);
    var totalExpenses = filteredExp.reduce(function (s, e) { return s + e.amount; }, 0);
    var totalFuel = filteredExp.filter(function (e) { return e.type === "fuel"; }).reduce(function (s, e) { return s + e.amount; }, 0);
    var totalProfit = totalRevenue - totalExpenses;
    var rpm = totalMiles > 0 ? Math.round(totalRevenue / totalMiles * 100) / 100 : 0;
    var cpm = totalMiles > 0 ? Math.round(totalExpenses / totalMiles * 100) / 100 : 0;
    var ppm = totalMiles > 0 ? Math.round(totalProfit / totalMiles * 100) / 100 : 0;
    // Revenue per truck
    var byVehicle = {};
    filtered.forEach(function (j) {
        var k = j.vehicleId || "Truck 1";
        if (!byVehicle[k]) {
            byVehicle[k] = { name: k, jobs: 0, revenue: 0, miles: 0 };
        }
        byVehicle[k].jobs++;
        byVehicle[k].revenue += j.finalPrice;
        byVehicle[k].miles += (j.miles || 0);
    });
    // Revenue per driver
    var byDriver = {};
    filtered.forEach(function (j) {
        var k = j.salesperson || "Unassigned";
        if (!byDriver[k]) {
            byDriver[k] = { name: k, jobs: 0, revenue: 0, miles: 0 };
        }
        byDriver[k].jobs++;
        byDriver[k].revenue += j.finalPrice;
        byDriver[k].miles += (j.miles || 0);
    });
    // Lane profitability
    var byLane = {};
    filtered.forEach(function (j) {
        if (!j.origin || !j.destination)
            return;
        var k = (j.origin.split(",")[0] || j.origin).trim() + "→" + (j.destination.split(",")[0] || j.destination).trim();
        if (!byLane[k]) {
            byLane[k] = { lane: k, jobs: 0, revenue: 0, miles: 0 };
        }
        byLane[k].jobs++;
        byLane[k].revenue += j.finalPrice;
        byLane[k].miles += (j.miles || 0);
    });
    // Customer profitability
    var byCustomer = {};
    filtered.forEach(function (j) {
        var k = j.companyName || j.customer;
        if (!byCustomer[k]) {
            byCustomer[k] = { name: k, jobs: 0, revenue: 0 };
        }
        byCustomer[k].jobs++;
        byCustomer[k].revenue += j.finalPrice;
    });
    // On-time performance
    var completed = filtered.filter(function (j) { return j.status === "Completed" || j.status === "Paid" || j.status === "Delivered"; });
    var onTimeRate = filtered.length > 0 ? Math.round((completed.length / filtered.length) * 100) : 0;
    // AR Aging
    var today = new Date();
    var ar = { current: 0, days30: 0, days60: 0, days90: 0 };
    filtered.filter(function (j) { return j.payment === "net7" || j.status !== "Paid"; }).forEach(function (j) {
        var age = (today - new Date(j.date)) / (1000 * 60 * 60 * 24);
        if (age <= 30)
            ar.current += j.finalPrice;
        else if (age <= 60)
            ar.days30 += j.finalPrice;
        else if (age <= 90)
            ar.days60 += j.finalPrice;
        else
            ar.days90 += j.finalPrice;
    });
    var TABS = [["overview", "📊 Overview"], ["trucks", "🚛 Per Truck"], ["drivers", "👤 Per Driver"], ["lanes", "🗺 Lanes"], ["customers", "🏢 Customers"], ["ar", "💳 AR Aging"], ["cashflow", "💰 Cash Flow"]];
    function Row(p) {
        return React.createElement("div", { style: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid " + C.border } },
            React.createElement("span", { style: { fontSize: 12, color: C.dim } }, p.label),
            React.createElement("span", { style: { fontSize: 12, fontWeight: 700, color: p.color || C.white } }, p.value));
    }
    return React.createElement("div", { style: { maxWidth: 720, margin: "0 auto" } },
        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 4 } }, "\uD83D\uDCC8 Advanced Reports"),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px", marginBottom: 16 } },
            React.createElement("div", null,
                React.createElement(Lbl, null, "From"),
                React.createElement("input", { type: "date", value: dateFrom, onChange: function (e) { setDateFrom(e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "9px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark", marginBottom: 12 } })),
            React.createElement("div", null,
                React.createElement(Lbl, null, "To"),
                React.createElement("input", { type: "date", value: dateTo, onChange: function (e) { setDateTo(e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "9px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark", marginBottom: 12 } }))),
        React.createElement("div", { style: { display: "flex", gap: 4, overflowX: "auto", marginBottom: 16, paddingBottom: 2 } }, TABS.map(function (t) { return React.createElement("button", { key: t[0], onClick: function () { setReportTab(t[0]); }, style: { border: "none", borderRadius: 7, padding: "6px 10px", cursor: "pointer", background: reportTab === t[0] ? C.orange : "transparent", color: reportTab === t[0] ? "#000" : C.dim, fontWeight: 700, fontFamily: "inherit", fontSize: 10, whiteSpace: "nowrap" } }, t[1]); })),
        reportTab === "overview" && React.createElement("div", null,
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 10, marginBottom: 16 } }, [["Revenue", "$" + totalRevenue.toLocaleString(), C.orange], ["Profit", "$" + totalProfit.toLocaleString(), totalProfit >= 0 ? C.green : C.red], ["RPM", "$" + rpm + "/mi", C.blue], ["CPM", "$" + cpm + "/mi", C.red], ["PPM", "$" + ppm + "/mi", C.green], ["On-Time", onTimeRate + "%", onTimeRate >= 90 ? C.green : C.yellow], ["Jobs", filtered.length, C.white], ["Miles", totalMiles.toLocaleString() + " mi", C.dim]].map(function (s) {
                return React.createElement(Card, { key: s[0], style: { padding: "12px 14px" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 } }, s[0]),
                    React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: s[2] } }, s[1]));
            })),
            React.createElement(Card, null,
                React.createElement(Row, { label: "Total Revenue", value: "$" + totalRevenue.toLocaleString(), color: C.orange }),
                React.createElement(Row, { label: "Total Expenses", value: "$" + totalExpenses.toLocaleString(), color: C.red }),
                React.createElement(Row, { label: "Fuel Cost", value: "$" + totalFuel.toLocaleString() }),
                React.createElement(Row, { label: "Net Profit", value: "$" + totalProfit.toLocaleString(), color: totalProfit >= 0 ? C.green : C.red }),
                React.createElement(Row, { label: "Profit Margin", value: totalRevenue > 0 ? Math.round((totalProfit / totalRevenue) * 100) + "%" : "—" }),
                React.createElement(Row, { label: "Revenue Per Mile", value: "$" + rpm + "/mi", color: C.blue }),
                React.createElement(Row, { label: "Cost Per Mile", value: "$" + cpm + "/mi", color: C.red }),
                React.createElement(Row, { label: "Profit Per Mile", value: "$" + ppm + "/mi", color: C.green }),
                React.createElement(Row, { label: "On-Time Rate", value: onTimeRate + "%", color: onTimeRate >= 90 ? C.green : C.yellow }),
                React.createElement(Row, { label: "Total Miles", value: totalMiles.toLocaleString() + " mi" }),
                React.createElement(Row, { label: "Jobs Completed", value: completed.length + " of " + filtered.length }))),
        reportTab === "trucks" && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 12 } }, "Revenue & Performance Per Truck"),
            Object.keys(byVehicle).length === 0 ? React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "40px 0", fontSize: 13 } }, "No truck data yet. Jobs need vehicle assignments.")
                : Object.values(byVehicle).sort(function (a, b) { return b.revenue - a.revenue; }).map(function (v) {
                    var util = filtered.length > 0 ? Math.round((v.jobs / filtered.length) * 100) : 0;
                    return React.createElement(Card, { key: v.name, style: { marginBottom: 8 } },
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, "🚛 " + v.name),
                            React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.orange } }, "$" + v.revenue.toLocaleString())),
                        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6 } }, [["Jobs", v.jobs], ["Miles", v.miles + " mi"], ["RPM", v.miles > 0 ? "$" + (v.revenue / v.miles).toFixed(2) : "—"], ["Util", util + "%"]].map(function (r) {
                            return React.createElement("div", { key: r[0], style: { background: C.surface, borderRadius: 7, padding: "6px 8px", textAlign: "center" } },
                                React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase" } }, r[0]),
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginTop: 2 } }, r[1]));
                        })));
                })),
        reportTab === "drivers" && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 12 } }, "Driver Productivity"),
            Object.keys(byDriver).length === 0 ? React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "40px 0", fontSize: 13 } }, "No driver data yet.")
                : Object.values(byDriver).sort(function (a, b) { return b.revenue - a.revenue; }).map(function (d, i) {
                    return React.createElement(Card, { key: d.name, style: { marginBottom: 8 } },
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                            React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                                React.createElement("div", { style: { width: 28, height: 28, borderRadius: "50%", background: i === 0 ? C.orange : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 900, color: "#000" } },
                                    "#",
                                    i + 1),
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, d.name)),
                            React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.orange } }, "$" + d.revenue.toLocaleString())),
                        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 } }, [["Jobs", d.jobs], ["Miles", d.miles + " mi"], ["Avg Ticket", "$" + Math.round(d.revenue / d.jobs)]].map(function (r) {
                            return React.createElement("div", { key: r[0], style: { background: C.surface, borderRadius: 7, padding: "6px 8px", textAlign: "center" } },
                                React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase" } }, r[0]),
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginTop: 2 } }, r[1]));
                        })));
                })),
        reportTab === "lanes" && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 12 } }, "Lane Profitability"),
            Object.keys(byLane).length === 0 ? React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "40px 0", fontSize: 13 } }, "No lane data yet.")
                : Object.values(byLane).sort(function (a, b) { return b.revenue - a.revenue; }).map(function (l) {
                    return React.createElement(Card, { key: l.lane, style: { marginBottom: 8 } },
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 } },
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white } }, l.lane),
                            React.createElement("div", { style: { fontSize: 15, fontWeight: 900, color: C.orange } }, "$" + l.revenue.toLocaleString())),
                        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 } }, [["Runs", l.jobs], ["RPM", l.miles > 0 ? "$" + (l.revenue / l.miles).toFixed(2) : "—"], ["Avg", "$" + Math.round(l.revenue / l.jobs)]].map(function (r) {
                            return React.createElement("div", { key: r[0], style: { background: C.surface, borderRadius: 7, padding: "6px 8px", textAlign: "center" } },
                                React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase" } }, r[0]),
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginTop: 2 } }, r[1]));
                        })));
                })),
        reportTab === "customers" && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 12 } }, "Customer Profitability"),
            Object.keys(byCustomer).length === 0 ? React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "40px 0", fontSize: 13 } }, "No customer data yet.")
                : Object.values(byCustomer).sort(function (a, b) { return b.revenue - a.revenue; }).map(function (c) {
                    return React.createElement(Card, { key: c.name, style: { marginBottom: 8, display: "flex", justifyContent: "space-between", alignItems: "center" } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, c.name),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim } }, c.jobs + " job" + (c.jobs !== 1 ? "s" : "") + " · Avg $" + Math.round(c.revenue / c.jobs))),
                        React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.orange } }, "$" + c.revenue.toLocaleString()));
                })),
        reportTab === "ar" && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 12 } }, "Accounts Receivable Aging"),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 16 } }, [["Current (0-30 days)", "$" + ar.current.toLocaleString(), C.green], ["31-60 Days", "$" + ar.days30.toLocaleString(), C.yellow], ["61-90 Days", "$" + ar.days60.toLocaleString(), C.orange], ["90+ Days", "$" + ar.days90.toLocaleString(), C.red]].map(function (r) {
                return React.createElement(Card, { key: r[0], style: { padding: "12px 14px" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, marginBottom: 4 } }, r[0]),
                    React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: r[2] } }, r[1]));
            })),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 10 } }, "Unpaid or Net 7 jobs by age:"),
                filtered.filter(function (j) { return j.status !== "Paid" && j.status !== "Completed"; }).map(function (j) {
                    var age = Math.round((today - new Date(j.date)) / (1000 * 60 * 60 * 24));
                    return React.createElement("div", { key: j.id, style: { display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid " + C.border, fontSize: 12 } },
                        React.createElement("span", { style: { color: C.dim } },
                            j.id,
                            " \u00B7 ",
                            j.customer),
                        React.createElement("span", { style: { color: age > 90 ? C.red : age > 60 ? C.orange : age > 30 ? C.yellow : C.green, fontWeight: 700 } }, age + " days · $" + j.finalPrice));
                }))),
        reportTab === "cashflow" && React.createElement("div", null,
            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 12 } }, "Cash Flow Report"),
            React.createElement(Card, { style: { marginBottom: 16 } },
                React.createElement(Row, { label: "Total Revenue In", value: "$" + totalRevenue.toLocaleString(), color: C.green }),
                React.createElement(Row, { label: "Total Expenses Out", value: "$" + totalExpenses.toLocaleString(), color: C.red }),
                React.createElement(Row, { label: "Net Cash Flow", value: "$" + totalProfit.toLocaleString(), color: totalProfit >= 0 ? C.green : C.red }),
                React.createElement(Row, { label: "Cash Collected (Cash jobs)", value: "$" + filtered.filter(function (j) { return j.payment === "cash"; }).reduce(function (s, j) { return s + j.finalPrice; }, 0).toLocaleString() }),
                React.createElement(Row, { label: "Card Payments", value: "$" + filtered.filter(function (j) { return j.payment === "card"; }).reduce(function (s, j) { return s + j.finalPrice; }, 0).toLocaleString() }),
                React.createElement(Row, { label: "Outstanding (Unpaid)", value: "$" + filtered.filter(function (j) { return j.status !== "Paid" && j.status !== "Completed"; }).reduce(function (s, j) { return s + j.finalPrice; }, 0).toLocaleString(), color: C.orange }))));
}
// ═══════════════════════════════════════════════════════════════════
// PHASE 11 — CARRIER / BROKER MANAGEMENT
// ═══════════════════════════════════════════════════════════════════
function loadCarriers() { try {
    var r = localStorage.getItem("pl_carriers");
    return r ? JSON.parse(r) : [];
}
catch (e) {
    return [];
} }
function saveCarriers(c) { try {
    localStorage.setItem("pl_carriers", JSON.stringify(c));
}
catch (e) { } }
function loadBrokers() { try {
    var r = localStorage.getItem("pl_brokers");
    return r ? JSON.parse(r) : [];
}
catch (e) {
    return [];
} }
function saveBrokers(b) { try {
    localStorage.setItem("pl_brokers", JSON.stringify(b));
}
catch (e) { } }
function CarrierBrokerManager(props) {
    var [tab, setTab] = useState("carriers");
    var [carriers, setCarriers] = useState(loadCarriers);
    var [brokers, setBrokers] = useState(loadBrokers);
    var [showAddCarrier, setShowAddCarrier] = useState(false);
    var [showAddBroker, setShowAddBroker] = useState(false);
    var [sel, setSel] = useState(null);
    var today = new Date();
    var days30 = new Date(today);
    days30.setDate(today.getDate() + 30);
    var expiringCarriers = carriers.filter(function (c) {
        var ins = c.insuranceExpiry ? new Date(c.insuranceExpiry) : null;
        return ins && ins <= days30;
    });
    function addCarrier(data) {
        var updated = [Object.assign({ id: Date.now() }, data)].concat(carriers);
        setCarriers(updated);
        saveCarriers(updated);
        setShowAddCarrier(false);
    }
    function addBroker(data) {
        var updated = [Object.assign({ id: Date.now() }, data)].concat(brokers);
        setBrokers(updated);
        saveBrokers(updated);
        setShowAddBroker(false);
    }
    function rateCarrier(id, rating) {
        var updated = carriers.map(function (c) { return c.id === id ? Object.assign({}, c, { rating: rating }) : c; });
        setCarriers(updated);
        saveCarriers(updated);
    }
    return React.createElement("div", { style: { maxWidth: 700, margin: "0 auto" } },
        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 4 } }, "\uD83E\uDD1D Carrier & Broker Management"),
        expiringCarriers.length > 0 && React.createElement(Card, { style: { marginBottom: 14, border: "1px solid " + C.red + "44", background: C.red + "08" } },
            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 6 } },
                "\u26A0 ",
                expiringCarriers.length,
                " Insurance Expiring Soon"),
            expiringCarriers.map(function (c) { return React.createElement("div", { key: c.id, style: { fontSize: 11, color: C.dim } },
                c.name,
                " \u2014 expires ",
                c.insuranceExpiry); })),
        React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 16 } },
            [["carriers", "🚛 Carriers (" + carriers.length + ")"], ["brokers", "📋 Brokers (" + brokers.length + ")"]].map(function (t) {
                return React.createElement("button", { key: t[0], onClick: function () { setTab(t[0]); setSel(null); }, style: { border: "none", borderRadius: 8, padding: "8px 16px", cursor: "pointer", background: tab === t[0] ? C.orange : "transparent", color: tab === t[0] ? "#000" : C.dim, fontWeight: 700, fontFamily: "inherit", fontSize: 12 } }, t[1]);
            }),
            React.createElement("div", { style: { flex: 1 } }),
            React.createElement(Btn, { onClick: function () { tab === "carriers" ? setShowAddCarrier(true) : setShowAddBroker(true); }, style: { padding: "8px 14px", fontSize: 11 } }, "+ Add " + (tab === "carriers" ? "Carrier" : "Broker"))),
        tab === "carriers" && React.createElement("div", null, carriers.length === 0 ? React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "40px 0", fontSize: 13 } }, "No carriers yet. Add carriers you work with regularly.")
            : carriers.map(function (c) {
                return React.createElement(Card, { key: c.id, style: { marginBottom: 8, cursor: "pointer" }, onClick: function () { setSel(sel === c.id ? null : c.id); } },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, c.name),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim } },
                                "MC: ",
                                c.mcNumber || "—",
                                " \u00B7 DOT: ",
                                c.dotNumber || "—"),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim } },
                                c.phone,
                                " \u00B7 ",
                                c.email)),
                        React.createElement("div", { style: { textAlign: "right" } },
                            React.createElement("div", { style: { color: "#FFD700", fontSize: 14 } }, "★".repeat(c.rating || 0) + "☆".repeat(5 - (c.rating || 0))),
                            React.createElement("div", { style: { fontSize: 10, color: c.insuranceExpiry && new Date(c.insuranceExpiry) <= days30 ? C.red : C.green, marginTop: 4 } },
                                "Ins: ",
                                c.insuranceExpiry || "—"))),
                    sel === c.id && React.createElement("div", { style: { marginTop: 12, borderTop: "1px solid " + C.border, paddingTop: 12 } },
                        React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 8 } }, "Rate this carrier:"),
                        React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 10 } }, [1, 2, 3, 4, 5].map(function (n) { return React.createElement("button", { key: n, onClick: function (e) { e.stopPropagation(); rateCarrier(c.id, n); }, style: { background: (c.rating || 0) >= n ? C.orange + "22" : "transparent", border: "1px solid " + (c.rating || 0) >= n ? C.orange : C.border, borderRadius: 7, padding: "4px 10px", cursor: "pointer", color: (c.rating || 0) >= n ? C.orange : C.dim, fontSize: 12, fontFamily: "inherit" } }, "★" + n); })),
                        c.notes && React.createElement("div", { style: { fontSize: 11, color: C.dim } }, c.notes)));
            })),
        tab === "brokers" && React.createElement("div", null, brokers.length === 0 ? React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "40px 0", fontSize: 13 } }, "No brokers yet. Add brokers you work with to track credit and payment history.")
            : brokers.map(function (b) {
                var creditColor = b.creditScore >= 80 ? C.green : b.creditScore >= 60 ? C.yellow : C.red;
                return React.createElement(Card, { key: b.id, style: { marginBottom: 8 } },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, b.name),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim } },
                                "MC: ",
                                b.mcNumber || "—",
                                " \u00B7 Pays in ",
                                b.daysToPay || "?",
                                " days"),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim } },
                                b.phone,
                                " \u00B7 ",
                                b.email)),
                        React.createElement("div", { style: { textAlign: "right" } },
                            b.creditScore && React.createElement("div", { style: { background: creditColor + "22", color: creditColor, borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 700 } },
                                "Credit: ",
                                b.creditScore),
                            b.creditLimit && React.createElement("div", { style: { fontSize: 10, color: C.dim, marginTop: 4 } },
                                "Limit: $",
                                b.creditLimit))),
                    b.notes && React.createElement("div", { style: { fontSize: 10, color: C.faint, marginTop: 6 } }, b.notes));
            })),
        showAddCarrier && React.createElement(AddCarrierModal, { onClose: function () { setShowAddCarrier(false); }, onSave: addCarrier }),
        showAddBroker && React.createElement(AddBrokerModal, { onClose: function () { setShowAddBroker(false); }, onSave: addBroker }));
}
function AddCarrierModal(props) {
    var [f, setF] = useState({ name: "", mcNumber: "", dotNumber: "", phone: "", email: "", address: "", insuranceExpiry: "", insuranceCarrier: "", rating: 0, notes: "" });
    var set = function (k, v) { setF(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); };
    return React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
            props.onClose(); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000CC", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
        React.createElement("div", { style: { background: C.card, borderRadius: 14, width: "100%", maxWidth: 500, maxHeight: "90vh", overflowY: "auto", padding: "20px" } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white } }, "\uD83D\uDE9B Add Carrier"),
                React.createElement("button", { onClick: props.onClose, style: { background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer" } }, "\u2715")),
            React.createElement(TxtIn, { label: "Carrier Name *", value: f.name, onChange: function (v) { set("name", v); } }),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                React.createElement(TxtIn, { label: "MC Number", value: f.mcNumber, onChange: function (v) { set("mcNumber", v); } }),
                React.createElement(TxtIn, { label: "DOT Number", value: f.dotNumber, onChange: function (v) { set("dotNumber", v); } })),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                React.createElement(TxtIn, { label: "Phone", value: f.phone, onChange: function (v) { set("phone", v); }, type: "tel" }),
                React.createElement(TxtIn, { label: "Email", value: f.email, onChange: function (v) { set("email", v); }, type: "email" })),
            React.createElement(TxtIn, { label: "Address", value: f.address, onChange: function (v) { set("address", v); } }),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                React.createElement(TxtIn, { label: "Insurance Expiry", value: f.insuranceExpiry, onChange: function (v) { set("insuranceExpiry", v); }, type: "date" }),
                React.createElement(TxtIn, { label: "Insurance Carrier", value: f.insuranceCarrier, onChange: function (v) { set("insuranceCarrier", v); } })),
            React.createElement(TxtIn, { label: "Notes / Rate Agreement", value: f.notes, onChange: function (v) { set("notes", v); }, rows: 2 }),
            React.createElement("div", { style: { display: "flex", gap: 8 } },
                React.createElement(Btn, { variant: "ghost", onClick: props.onClose, style: { flex: 1 } }, "Cancel"),
                React.createElement(Btn, { onClick: function () { props.onSave(f); }, disabled: !f.name, style: { flex: 2 } }, "Add Carrier \u2713"))));
}
function AddBrokerModal(props) {
    var [f, setF] = useState({ name: "", mcNumber: "", phone: "", email: "", creditScore: "", creditLimit: "", daysToPay: "", notes: "" });
    var set = function (k, v) { setF(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); };
    return React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
            props.onClose(); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000CC", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
        React.createElement("div", { style: { background: C.card, borderRadius: 14, width: "100%", maxWidth: 500, padding: "20px" } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white } }, "\uD83D\uDCCB Add Broker"),
                React.createElement("button", { onClick: props.onClose, style: { background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer" } }, "\u2715")),
            React.createElement(TxtIn, { label: "Broker Name *", value: f.name, onChange: function (v) { set("name", v); } }),
            React.createElement(TxtIn, { label: "MC Number", value: f.mcNumber, onChange: function (v) { set("mcNumber", v); } }),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                React.createElement(TxtIn, { label: "Phone", value: f.phone, onChange: function (v) { set("phone", v); }, type: "tel" }),
                React.createElement(TxtIn, { label: "Email", value: f.email, onChange: function (v) { set("email", v); }, type: "email" })),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 12px" } },
                React.createElement(TxtIn, { label: "Credit Score (0-100)", value: f.creditScore, onChange: function (v) { set("creditScore", Number(v)); }, type: "number" }),
                React.createElement(TxtIn, { label: "Credit Limit ($)", value: f.creditLimit, onChange: function (v) { set("creditLimit", v); }, type: "number" }),
                React.createElement(TxtIn, { label: "Avg Days to Pay", value: f.daysToPay, onChange: function (v) { set("daysToPay", Number(v)); }, type: "number" })),
            React.createElement(TxtIn, { label: "Notes", value: f.notes, onChange: function (v) { set("notes", v); }, rows: 2 }),
            React.createElement("div", { style: { display: "flex", gap: 8 } },
                React.createElement(Btn, { variant: "ghost", onClick: props.onClose, style: { flex: 1 } }, "Cancel"),
                React.createElement(Btn, { onClick: function () { props.onSave(f); }, disabled: !f.name, style: { flex: 2 } }, "Add Broker \u2713"))));
}
// ═══════════════════════════════════════════════════════════════════
// PHASE 12 — CUSTOMER PORTAL
// ═══════════════════════════════════════════════════════════════════
function CustomerPortal(props) {
    var jobs = props.jobs || [];
    var [email, setEmail] = useState("");
    var [authed, setAuthed] = useState(false);
    var [customerJobs, setCustomerJobs] = useState([]);
    var [tab, setTab] = useState("jobs");
    var [showQuote, setShowQuote] = useState(false);
    var [qf, setQf] = useState({ name: "", phone: "", service: "", from: "", to: "", notes: "" });
    function login() {
        if (!email)
            return;
        var found = jobs.filter(function (j) { return j.email && j.email.toLowerCase() === email.toLowerCase(); });
        if (found.length > 0) {
            setCustomerJobs(found);
            setAuthed(true);
        }
        else {
            alert("No jobs found for that email. Check your booking confirmation email for the address you used.");
        }
    }
    function submitQuote() {
        sendEmail({ id: "QUOTE-" + Date.now(), customer: qf.name, phone: qf.phone, serviceName: "CUSTOMER PORTAL QUOTE REQUEST", origin: qf.from, destination: qf.to, finalPrice: 0, payment: "tbd", date: new Date().toISOString().split("T")[0], notes: qf.service + " — " + qf.notes });
        setShowQuote(false);
        alert("Quote request sent! We'll contact you within 2 hours.");
    }
    if (!authed)
        return React.createElement("div", { style: { minHeight: "100vh", background: C.black, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
            React.createElement("div", { style: { width: "100%", maxWidth: 380 } },
                React.createElement("div", { style: { textAlign: "center", marginBottom: 24 } },
                    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C.white } },
                        "POTENT ",
                        React.createElement("span", { style: { color: C.orange } }, "LOGISTICS")),
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, letterSpacing: 2, textTransform: "uppercase", marginTop: 4 } }, "Customer Portal")),
                React.createElement(Card, null,
                    React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4 } }, "Track Your Jobs"),
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 14 } }, "Enter the email address you used when booking."),
                    React.createElement(TxtIn, { label: "Your Email Address", value: email, onChange: setEmail, type: "email", placeholder: "your@email.com" }),
                    React.createElement(Btn, { onClick: login, disabled: !email, style: { width: "100%" } }, "Access My Jobs \u2192"))));
    return React.createElement("div", { style: { minHeight: "100vh", background: C.black, fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
        React.createElement("div", { style: { borderBottom: "1px solid " + C.border, padding: "12px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", position: "sticky", top: 0, background: C.black, zIndex: 100 } },
            React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 15, fontWeight: 900, color: C.white } },
                    "POTENT ",
                    React.createElement("span", { style: { color: C.orange } }, "LOGISTICS")),
                React.createElement("div", { style: { fontSize: 9, color: C.dim } }, email)),
            React.createElement("div", { style: { display: "flex", gap: 8 } },
                React.createElement(Btn, { onClick: function () { setShowQuote(true); }, style: { padding: "6px 12px", fontSize: 11 } }, "\uD83D\uDCCB Request Quote"),
                React.createElement(Btn, { variant: "ghost", onClick: function () { setAuthed(false); setEmail(""); setCustomerJobs([]); }, style: { padding: "6px 10px", fontSize: 10 } }, "Sign Out"))),
        React.createElement("div", { style: { padding: "20px 16px", maxWidth: 600, margin: "0 auto" } },
            React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: C.white, marginBottom: 4 } }, "Your Jobs"),
            React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 16 } }, customerJobs.length + " job" + (customerJobs.length !== 1 ? "s" : "") + " found"),
            customerJobs.map(function (j) {
                var idx = STATUS_FLOW.indexOf(j.status);
                return React.createElement(Card, { key: j.id, style: { marginBottom: 12 } },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.orange, letterSpacing: 1 } }, j.id),
                            React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white, marginTop: 2 } }, j.serviceName),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim } }, j.date)),
                        React.createElement("div", { style: { textAlign: "right" } },
                            React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.orange } },
                                "$",
                                j.finalPrice),
                            React.createElement("div", { style: { background: (STATUS_COLOR[j.status] || C.dim) + "22", color: STATUS_COLOR[j.status] || C.dim, borderRadius: 20, padding: "2px 10px", fontSize: 10, fontWeight: 700, marginTop: 4 } }, j.status))),
                    React.createElement("div", { style: { background: C.surface, borderRadius: 9, padding: "10px 12px", marginBottom: 8, fontSize: 11, color: C.dim } },
                        React.createElement("div", null,
                            "\uD83D\uDCCD From: ",
                            React.createElement("span", { style: { color: C.white } }, j.origin)),
                        React.createElement("div", { style: { marginTop: 4 } },
                            "\uD83D\uDCCD To: ",
                            React.createElement("span", { style: { color: C.white } }, j.destination))),
                    idx >= 0 && React.createElement("div", { style: { overflowX: "auto" } },
                        React.createElement("div", { style: { display: "flex", alignItems: "center", minWidth: 400 } }, STATUS_FLOW.slice(0, 8).map(function (s, i) {
                            return React.createElement("div", { key: s, style: { display: "flex", alignItems: "center", flex: i < 7 ? "1" : "none" } },
                                React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: 3 } },
                                    React.createElement("div", { style: { width: 18, height: 18, borderRadius: "50%", background: i < idx ? C.green : i === idx ? STATUS_COLOR[s] || C.orange : C.border, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, color: "#000" } }, i < idx ? "✓" : i + 1),
                                    React.createElement("div", { style: { fontSize: 7, color: i === idx ? STATUS_COLOR[s] || C.orange : C.faint, textAlign: "center", maxWidth: 40 } }, s)),
                                i < 7 && React.createElement("div", { style: { flex: 1, height: 1.5, background: i < idx ? C.green : C.border, margin: "0 2px", marginBottom: 12 } }));
                        }))),
                    React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 8 } },
                        React.createElement("a", { href: "tel:" + PHONE_NUMBER, style: { textDecoration: "none", flex: 1 } },
                            React.createElement(Btn, { variant: "ghost", style: { width: "100%", padding: "7px", fontSize: 11 } }, "\uD83D\uDCDE Call Us")),
                        React.createElement("a", { href: "sms:" + PHONE_NUMBER, style: { textDecoration: "none", flex: 1 } },
                            React.createElement(Btn, { variant: "ghost", style: { width: "100%", padding: "7px", fontSize: 11 } }, "\uD83D\uDCAC Text Us"))));
            })),
        showQuote && React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
                setShowQuote(false); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000CC", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
            React.createElement("div", { style: { background: C.card, borderRadius: 14, width: "100%", maxWidth: 480, padding: "20px" } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white } }, "\uD83D\uDCCB Request a Quote"),
                    React.createElement("button", { onClick: function () { setShowQuote(false); }, style: { background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer" } }, "\u2715")),
                React.createElement(TxtIn, { label: "Your Name", value: qf.name, onChange: function (v) { setQf(function (p) { return Object.assign({}, p, { name: v }); }); } }),
                React.createElement(TxtIn, { label: "Phone", value: qf.phone, onChange: function (v) { setQf(function (p) { return Object.assign({}, p, { phone: v }); }); }, type: "tel" }),
                React.createElement(TxtIn, { label: "Service Needed", value: qf.service, onChange: function (v) { setQf(function (p) { return Object.assign({}, p, { service: v }); }); }, placeholder: "e.g. Junk removal, delivery..." }),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "Pickup Location", value: qf.from, onChange: function (v) { setQf(function (p) { return Object.assign({}, p, { from: v }); }); } }),
                    React.createElement(TxtIn, { label: "Drop-Off", value: qf.to, onChange: function (v) { setQf(function (p) { return Object.assign({}, p, { to: v }); }); } })),
                React.createElement(TxtIn, { label: "Additional Notes", value: qf.notes, onChange: function (v) { setQf(function (p) { return Object.assign({}, p, { notes: v }); }); }, rows: 2 }),
                React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setShowQuote(false); }, style: { flex: 1 } }, "Cancel"),
                    React.createElement(Btn, { onClick: submitQuote, disabled: !qf.name || !qf.phone, style: { flex: 2 } }, "Send Request \uD83D\uDE80")))));
}
// ═══════════════════════════════════════════════════════════════════
// PHASE 13 — DRIVER APP ENHANCEMENTS
// ═══════════════════════════════════════════════════════════════════
function EnhancedDriverApp(props) {
    var jobs = props.jobs || [];
    var onUpdateStatus = props.onUpdateStatus;
    var currentUser = props.currentUser;
    var [sel, setSel] = useState(null);
    var [showCamera, setShowCamera] = useState(false);
    var [photos, setPhotos] = useState({});
    var [fuelLog, setFuelLog] = useState({ state: "GA", gallons: "", price: "", date: new Date().toISOString().split("T")[0] });
    var [showFuel, setShowFuel] = useState(false);
    var [declineNote, setDeclineNote] = useState("");
    var [showDecline, setShowDecline] = useState(null);
    var [sharingLocation, setSharingLocation] = useState(false);
    var [gpsError, setGpsError] = useState("");
    var [lastPing, setLastPing] = useState(null);
    var watchIdRef = useRef(null);
    var intervalRef = useRef(null);
    var latestCoordsRef = useRef(null);
    var myJobs = jobs.filter(function (j) { return j.status !== "Completed" && j.status !== "Paid" && j.status !== "Cancelled"; });
    var job = myJobs.find(function (j) { return j.id === sel; });
    // Stable driver id for this device: prefer the logged-in user, fall back to a
    // persisted per-device id so tracking still works if no login is wired up.
    function getDriverId() {
        if (currentUser && currentUser.id)
            return currentUser.id;
        try {
            var existing = localStorage.getItem("pl_driver_device_id");
            if (existing)
                return existing;
            var fresh = "device-" + Math.random().toString(36).slice(2, 10);
            localStorage.setItem("pl_driver_device_id", fresh);
            return fresh;
        }
        catch (e) { return "device-unknown"; }
    }
    var driverId = getDriverId();
    var driverName = (currentUser && currentUser.name) || "Driver";
    // ── GPS broadcast: watch position continuously, but only PUSH to
    // Supabase every 10 seconds (keeps writes cheap; watchPosition itself
    // is cheap on battery since the OS coalesces updates). ──
    useEffect(function () {
        if (!sharingLocation) {
            if (watchIdRef.current !== null && navigator.geolocation) {
                navigator.geolocation.clearWatch(watchIdRef.current);
                watchIdRef.current = null;
            }
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
            return;
        }
        if (!navigator.geolocation) {
            setGpsError("This device/browser doesn't support GPS location.");
            setSharingLocation(false);
            return;
        }
        setGpsError("");
        watchIdRef.current = navigator.geolocation.watchPosition(function (pos) {
            latestCoordsRef.current = pos.coords;
        }, function (err) {
            setGpsError(err.message || "Location permission denied.");
        }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 });
        function pushPing() {
            var c = latestCoordsRef.current;
            if (!c)
                return;
            pingDriverLocation({
                driver_id: driverId, driver_name: driverName, job_id: sel || null,
                lat: c.latitude, lon: c.longitude, heading: c.heading || null,
                speed: c.speed || null, accuracy: c.accuracy || null
            });
            setLastPing(new Date());
        }
        pushPing(); // send one immediately, then every 10s
        intervalRef.current = setInterval(pushPing, 10000);
        return function () {
            if (watchIdRef.current !== null && navigator.geolocation)
                navigator.geolocation.clearWatch(watchIdRef.current);
            if (intervalRef.current)
                clearInterval(intervalRef.current);
        };
    }, [sharingLocation, sel]);
    // Stop sharing + clear the row when the driver leaves the app/tab
    useEffect(function () {
        function onUnload() { if (sharingLocation)
            clearDriverLocation(driverId); }
        window.addEventListener("beforeunload", onUnload);
        return function () { window.removeEventListener("beforeunload", onUnload); };
    }, [sharingLocation, driverId]);
    function openNav(job) {
        var dest = encodeURIComponent(job.destination || "");
        var ua = navigator.userAgent;
        if (/iPhone|iPad/i.test(ua)) {
            window.open("maps://maps.apple.com/?daddr=" + dest);
        }
        else {
            window.open("https://www.google.com/maps/dir/?api=1&destination=" + dest);
        }
    }
    function takePhoto(jobId) {
        var input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.capture = "environment";
        input.onchange = function (e) {
            var file = e.target.files[0];
            if (!file)
                return;
            var reader = new FileReader();
            reader.onload = function (ev) {
                setPhotos(function (p) { var n = Object.assign({}, p); n[jobId] = (n[jobId] || []).concat([{ url: ev.target.result, time: new Date().toISOString() }]); return n; });
                setShowCamera(false);
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }
    function logFuel() {
        if (!fuelLog.gallons || !fuelLog.state)
            return;
        var exp = { id: Date.now(), date: fuelLog.date, type: "fuel", amount: Number(fuelLog.gallons) * Number(fuelLog.price || 0), note: "Fuel: " + fuelLog.gallons + " gal @ $" + fuelLog.price + "/gal — " + fuelLog.state, jobId: sel || "" };
        var exps = loadExpenses();
        exps.unshift(exp);
        saveExpenses(exps);
        setShowFuel(false);
        setFuelLog({ state: "GA", gallons: "", price: "", date: new Date().toISOString().split("T")[0] });
        alert("Fuel logged ✅");
    }
    // ── VOICE COMMANDS — hands-free status updates while driving ────────
    // Uses the browser's built-in Web Speech API (free, no server calls,
    // works in Chrome/Edge/Safari on most phones). This is genuinely
    // best-effort: road noise, accents, and spotty signal all hurt
    // accuracy, so every command shows exactly what it heard and what it
    // did — the driver should glance at it, not blindly trust it.
    var [voiceOn, setVoiceOn] = useState(false);
    var [voiceSupported, setVoiceSupported] = useState(true);
    var [voiceError, setVoiceError] = useState("");
    var [lastHeard, setLastHeard] = useState("");
    var [lastAction, setLastAction] = useState("");
    var recognitionRef = useRef(null);
    // Maps spoken phrases to a STATUS_FLOW value. Checked in order — first
    // match wins — so put more specific phrases first where they could
    // overlap (e.g. "in transit" before "transit").
    var VOICE_STATUS_MAP = [
        ["en route", "En Route"], ["on my way", "En Route"], ["heading there", "En Route"],
        ["arrived", "Arrived"], ["i'm here", "Arrived"], ["im here", "Arrived"],
        ["in progress", "In Progress"], ["starting job", "In Progress"], ["start job", "In Progress"],
        ["loading", "Loading"], ["loaded up", "Loading"],
        ["in transit", "In Transit"], ["on the road", "In Transit"],
        ["delivered", "Delivered"], ["dropped off", "Delivered"], ["drop off complete", "Delivered"],
        ["complete", "Completed"], ["completed", "Completed"], ["job done", "Completed"], ["all done", "Completed"],
        ["assigned", "Assigned"],
    ];
    function parseVoiceCommand(transcript) {
        var text = transcript.toLowerCase().trim();
        if (!job) {
            setLastAction("No job selected — pick a job first, then try again.");
            return;
        }
        // "log fuel" opens the fuel modal (still needs numbers typed —
        // reading gallons/price aloud reliably is a phase-2 problem)
        if (text.indexOf("log fuel") > -1 || text.indexOf("fuel log") > -1) {
            setShowFuel(true);
            setLastAction("Opened fuel log for you to fill in.");
            return;
        }
        if (text.indexOf("navigate") > -1 || text.indexOf("directions") > -1 || text.indexOf("take me there") > -1) {
            openNav(job);
            setLastAction("Opening navigation to " + (job.destination || "destination") + ".");
            return;
        }
        if (text.indexOf("call customer") > -1 || text.indexOf("call them") > -1) {
            if (job.phone)
                window.location.href = "tel:" + job.phone;
            setLastAction(job.phone ? "Calling " + job.customer + "." : "No phone number on file for this job.");
            return;
        }
        for (var i = 0; i < VOICE_STATUS_MAP.length; i++) {
            if (text.indexOf(VOICE_STATUS_MAP[i][0]) > -1) {
                var newStatus = VOICE_STATUS_MAP[i][1];
                onUpdateStatus(job.id, newStatus);
                setLastAction("Marked " + job.id + " as \"" + newStatus + "\".");
                return;
            }
        }
        setLastAction("Didn't recognize that as a command — try \"delivered\", \"en route\", \"log fuel\", or \"navigate\".");
    }
    useEffect(function () {
        var SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRec) {
            setVoiceSupported(false);
            return;
        }
        if (!voiceOn) {
            if (recognitionRef.current) {
                try { recognitionRef.current.stop(); } catch (e) { }
                recognitionRef.current = null;
            }
            return;
        }
        var recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = false;
        recognition.lang = "en-US";
        recognition.onresult = function (event) {
            var last = event.results[event.results.length - 1];
            var transcript = last[0].transcript;
            setLastHeard(transcript);
            parseVoiceCommand(transcript);
        };
        recognition.onerror = function (event) {
            if (event.error === "no-speech" || event.error === "aborted")
                return; // normal pauses, not real errors
            setVoiceError("Mic error: " + event.error + ". Tap the mic to restart.");
            setVoiceOn(false);
        };
        recognition.onend = function () {
            // Browsers auto-stop listening after a pause — restart seamlessly
            // as long as the driver hasn't turned voice off themselves.
            if (voiceOn && recognitionRef.current === recognition) {
                try { recognition.start(); } catch (e) { }
            }
        };
        recognitionRef.current = recognition;
        setVoiceError("");
        try {
            recognition.start();
        }
        catch (e) {
            setVoiceError("Couldn't start listening. Check mic permissions.");
            setVoiceOn(false);
        }
        return function () {
            try { recognition.stop(); } catch (e) { }
        };
    }, [voiceOn, job]);
    return React.createElement("div", { style: { maxWidth: 520, margin: "0 auto" } },
        React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: C.white, marginBottom: 4 } }, "\uD83D\uDE90 Driver App"),
        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 16 } }, myJobs.length + " active job" + (myJobs.length !== 1 ? "s" : "")),
        React.createElement(Card, { style: { marginBottom: 16, padding: "12px 14px", display: "flex", justifyContent: "space-between", alignItems: "center" } },
            React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white, display: "flex", alignItems: "center", gap: 6 } },
                    sharingLocation && React.createElement("span", { style: { width: 7, height: 7, borderRadius: "50%", background: C.green, display: "inline-block", animation: "pulse 1.5s infinite" } }),
                    "\uD83D\uDCE1 Live Location Sharing"),
                React.createElement("div", { style: { fontSize: 10, color: C.dim, marginTop: 2 } },
                    sharingLocation ? (lastPing ? "Last sent " + lastPing.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }) : "Getting GPS fix\u2026") : "Off \u2014 dispatch/customer can't see your truck"),
                gpsError && React.createElement("div", { style: { fontSize: 10, color: C.red, marginTop: 2 } }, "\u26A0 ", gpsError)),
            React.createElement("button", { onClick: function () {
                    if (sharingLocation)
                        clearDriverLocation(driverId);
                    setSharingLocation(!sharingLocation);
                }, style: { border: "none", borderRadius: 20, padding: "8px 16px", cursor: "pointer", background: sharingLocation ? C.green : C.orange, color: "#000", fontSize: 11, fontWeight: 800, fontFamily: "inherit", flexShrink: 0 } }, sharingLocation ? "ON" : "Go Live")),
        voiceSupported && React.createElement(Card, { style: { marginBottom: 16, padding: "12px 14px" } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: voiceOn ? 10 : 0 } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white, display: "flex", alignItems: "center", gap: 6 } },
                        voiceOn && React.createElement("span", { style: { width: 7, height: 7, borderRadius: "50%", background: C.red, display: "inline-block", animation: "pulse 1.5s infinite" } }),
                        "\uD83C\uDF99\uFE0F Voice Commands"),
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, marginTop: 2 } }, voiceOn ? "Listening \u2014 say a status like \"delivered\" or \"en route\"" : "Off \u2014 hands-free status updates while driving"),
                    voiceError && React.createElement("div", { style: { fontSize: 10, color: C.red, marginTop: 2 } }, "\u26A0 " + voiceError)),
                React.createElement("button", { onClick: function () { setVoiceOn(!voiceOn); setVoiceError(""); setLastHeard(""); setLastAction(""); }, style: { border: "none", borderRadius: 20, padding: "8px 16px", cursor: "pointer", background: voiceOn ? C.red : C.orange, color: voiceOn ? "#fff" : "#000", fontSize: 11, fontWeight: 800, fontFamily: "inherit", flexShrink: 0 } }, voiceOn ? "STOP" : "\uD83C\uDF99\uFE0F Start")),
            voiceOn && !job && React.createElement("div", { style: { fontSize: 11, color: C.orange, marginTop: 8 } }, "\u26A0 Select a job below first \u2014 voice commands apply to whichever job is selected."),
            voiceOn && lastHeard && React.createElement("div", { style: { background: C.surface, borderRadius: 8, padding: "8px 10px", marginTop: 4 } },
                React.createElement("div", { style: { fontSize: 9, color: C.faint, textTransform: "uppercase", letterSpacing: 1 } }, "Heard"),
                React.createElement("div", { style: { fontSize: 12, color: C.white, fontStyle: "italic" } }, "\u201C" + lastHeard + "\u201D"),
                lastAction && React.createElement("div", { style: { fontSize: 11, color: C.green, marginTop: 4 } }, "\u2713 " + lastAction)),
            voiceOn && React.createElement("div", { style: { fontSize: 9, color: C.faint, marginTop: 8, lineHeight: 1.5 } }, "Try: \u201Cen route\u201D \u00B7 \u201Carrived\u201D \u00B7 \u201Cdelivered\u201D \u00B7 \u201Clog fuel\u201D \u00B7 \u201Cnavigate\u201D \u00B7 \u201Ccall customer\u201D. Voice recognition isn't perfect \u2014 always glance at what it heard.")),
        !voiceSupported && React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, padding: "10px 14px", marginBottom: 16, fontSize: 11, color: C.dim } }, "\uD83C\uDF99\uFE0F Voice commands aren't supported in this browser. Try Chrome or Safari."),
        myJobs.length === 0 && React.createElement("div", { style: { textAlign: "center", padding: "40px 0", color: C.dim, fontSize: 13 } }, "No active jobs assigned to you right now."),
        React.createElement("div", { style: { display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4, marginBottom: 16 } }, myJobs.map(function (j) {
            return React.createElement("div", { key: j.id, onClick: function () { setSel(j.id); }, style: { flexShrink: 0, border: "2px solid " + (sel === j.id ? C.orange : C.border), borderRadius: 9, padding: "10px 14px", cursor: "pointer", background: sel === j.id ? C.orangeSoft : C.card, minWidth: 140 } },
                React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.white } }, j.id),
                React.createElement("div", { style: { fontSize: 10, color: C.dim, marginTop: 2 } }, j.customer),
                React.createElement("div", { style: { background: (STATUS_COLOR[j.status] || C.dim) + "22", color: STATUS_COLOR[j.status] || C.dim, borderRadius: 20, padding: "2px 8px", fontSize: 9, fontWeight: 700, marginTop: 6, display: "inline-block" } }, j.status));
        })),
        job && React.createElement("div", null,
            React.createElement(Card, { style: { marginBottom: 12 } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.white } }, job.customer),
                        React.createElement("div", { style: { fontSize: 11, color: C.dim } }, job.phone)),
                    React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.orange } },
                        "$",
                        job.finalPrice)),
                React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 12 } },
                    React.createElement("div", { style: { flex: 1, background: C.surface, borderRadius: 8, padding: "10px 12px" } },
                        React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1 } }, "Pickup"),
                        React.createElement("div", { style: { fontSize: 12, color: C.white, fontWeight: 600, marginTop: 2 } }, job.origin)),
                    React.createElement("div", { style: { color: C.orange, fontSize: 16, alignSelf: "center" } }, "\u2192"),
                    React.createElement("div", { style: { flex: 1, background: C.surface, borderRadius: 8, padding: "10px 12px" } },
                        React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 1 } }, "Drop-Off"),
                        React.createElement("div", { style: { fontSize: 12, color: C.white, fontWeight: 600, marginTop: 2 } }, job.destination))),
                job.notes && React.createElement("div", { style: { background: C.surface, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 11, color: C.dim } },
                    "\uD83D\uDCDD ",
                    job.notes),
                React.createElement(Btn, { onClick: function () { openNav(job); }, style: { width: "100%", marginBottom: 8, background: "#4285F4", color: "#fff" } }, "\uD83D\uDDFA Navigate to Destination"),
                React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 12 } },
                    React.createElement("a", { href: "tel:" + job.phone, style: { textDecoration: "none", flex: 1 } },
                        React.createElement(Btn, { variant: "ghost", style: { width: "100%", padding: "8px", fontSize: 11 } }, "\uD83D\uDCDE Call Customer")),
                    React.createElement("a", { href: "sms:" + job.phone, style: { textDecoration: "none", flex: 1 } },
                        React.createElement(Btn, { variant: "ghost", style: { width: "100%", padding: "8px", fontSize: 11 } }, "\uD83D\uDCAC Text Customer"))),
                React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 } }, "Update Status"),
                React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 } }, STATUS_FLOW.map(function (s) {
                    var sc = STATUS_COLOR[s] || C.dim;
                    // POD requirement: "Delivered" needs at least one photo on file first.
                    // This closes the real "proof of delivery shows up 3 days late as a
                    // text message" problem — by the time billing needs it, it's already
                    // attached to the job instead of buried in someone's texts.
                    var needsPOD = s === "Delivered" && (!photos[job.id] || photos[job.id].length === 0);
                    return React.createElement("button", { key: s, onClick: function () {
                            if (needsPOD) {
                                alert("Take a delivery photo first \u2014 tap \uD83D\uDCF8 Photo / BOL below, then mark Delivered.");
                                return;
                            }
                            onUpdateStatus(job.id, s);
                        }, style: { border: "1px solid " + (job.status === s ? sc : needsPOD ? C.orange + "66" : C.border), borderRadius: 6, padding: "6px 10px", cursor: "pointer", background: job.status === s ? sc + "22" : C.surface, color: job.status === s ? sc : needsPOD ? C.orange : C.dim, fontSize: 11, fontWeight: 600, fontFamily: "inherit" } }, needsPOD ? "\uD83D\uDCF8 " + s : s);
                })),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } },
                    React.createElement(Btn, { onClick: function () { takePhoto(job.id); }, variant: "ghost", style: { padding: "9px", fontSize: 11 } }, "\uD83D\uDCF8 Photo / BOL"),
                    React.createElement(Btn, { onClick: function () { setShowFuel(true); }, variant: "ghost", style: { padding: "9px", fontSize: 11 } }, "\u26FD Log Fuel")),
                photos[job.id] && photos[job.id].length > 0 && React.createElement("div", { style: { marginTop: 12 } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 } }, photos[job.id].length + " Photo" + (photos[job.id].length !== 1 ? "s" : "") + " Captured"),
                    React.createElement("div", { style: { display: "flex", gap: 6, overflowX: "auto" } }, photos[job.id].map(function (p, i) {
                        return React.createElement("img", { key: i, src: p.url, style: { width: 64, height: 64, borderRadius: 8, objectFit: "cover", border: "1px solid " + C.border, flexShrink: 0 } });
                    }))))),
        showFuel && React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
                setShowFuel(false); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000CC", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
            React.createElement("div", { style: { background: C.card, borderRadius: 14, width: "100%", maxWidth: 400, padding: "20px" } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white } }, "\u26FD Log Fuel Purchase"),
                    React.createElement("button", { onClick: function () { setShowFuel(false); }, style: { background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer" } }, "\u2715")),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "State", value: fuelLog.state, onChange: function (v) { setFuelLog(function (p) { return Object.assign({}, p, { state: v.toUpperCase().substring(0, 2) }); }); }, placeholder: "GA" }),
                    React.createElement(TxtIn, { label: "Date", value: fuelLog.date, onChange: function (v) { setFuelLog(function (p) { return Object.assign({}, p, { date: v }); }); }, type: "date" })),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "Gallons", value: fuelLog.gallons, onChange: function (v) { setFuelLog(function (p) { return Object.assign({}, p, { gallons: v }); }); }, type: "number", placeholder: "0.000" }),
                    React.createElement(TxtIn, { label: "Price/Gallon", value: fuelLog.price, onChange: function (v) { setFuelLog(function (p) { return Object.assign({}, p, { price: v }); }); }, type: "number", placeholder: "$0.00" })),
                fuelLog.gallons && fuelLog.price && React.createElement("div", { style: { background: C.orangeSoft, borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 12, color: C.orange, fontWeight: 700 } },
                    "Total: $",
                    (Number(fuelLog.gallons) * Number(fuelLog.price)).toFixed(2),
                    " \u00B7 State: ",
                    fuelLog.state),
                React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setShowFuel(false); }, style: { flex: 1 } }, "Cancel"),
                    React.createElement(Btn, { onClick: logFuel, disabled: !fuelLog.gallons || !fuelLog.state, style: { flex: 2 } }, "Log Fuel \u2713")))));
}
// ═══════════════════════════════════════════════════════════════════
// PHASE 14 — AI DOCUMENT EXTRACTION
// ═══════════════════════════════════════════════════════════════════
function AIDocumentExtractor(props) {
    var [docType, setDocType] = useState("ratecon");
    var [loading, setLoading] = useState(false);
    var [result, setResult] = useState(null);
    var [error, setError] = useState("");
    var [preview, setPreview] = useState(null);
    var DOC_TYPES = [
        { id: "ratecon", label: "📄 Rate Confirmation", desc: "Extract job details from a rate con" },
        { id: "bol", label: "📋 Bill of Lading", desc: "BOL, load #, and seal number if sealed freight" },
        { id: "packinglist", label: "📦 Packing List", desc: "Item counts, weights, and descriptions for a load" },
        { id: "weightticket", label: "⚖️ Weight Ticket", desc: "Scale ticket — gross/tare/net weight" },
        { id: "fuelreceipt", label: "⛽ Fuel Receipt", desc: "Fuel purchase with timestamp for IFTA/expenses" },
        { id: "receipt", label: "🧾 Other Receipt / Expense", desc: "Non-fuel expense data" },
        { id: "cdl", label: "🪪 CDL / Driver License", desc: "Extract driver license info" },
    ];
    function pickImage() {
        var input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.capture = "environment";
        input.onchange = function (e) {
            var file = e.target.files[0];
            if (!file)
                return;
            var reader = new FileReader();
            reader.onload = function (ev) {
                setPreview(ev.target.result);
                setResult(null);
                setError("");
            };
            reader.readAsDataURL(file);
        };
        input.click();
    }
    async function extract() {
        if (!preview)
            return;
        setLoading(true);
        setError("");
        setResult(null);
        try {
            var res = await fetch("/.netlify/functions/extract-document", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ imageBase64: preview, docType: docType })
            });
            var data = await res.json();
            if (data.success) {
                setResult(data.data);
            }
            else {
                setError(data.error || "Extraction failed. Try a clearer photo.");
            }
        }
        catch (e) {
            setError("Network error. Check your connection.");
        }
        setLoading(false);
    }
    function useAsJob() {
        if (!result || docType !== "ratecon")
            return;
        var job = {
            id: makeJobId(),
            customer: result.customerName || "",
            phone: result.customerPhone || "",
            email: "",
            service: "delivery",
            serviceName: "Delivery",
            origin: result.pickupAddress || "",
            destination: result.deliveryAddress || "",
            zone: "local", speed: "standard",
            basePrice: Number(result.rate) || 0,
            finalPrice: Number(result.rate) || 0,
            status: "New",
            payment: "cash",
            date: result.pickupDate || new Date().toISOString().split("T")[0],
            notes: "[AI EXTRACTED] " + result.commodity + " · " + result.weight + " · Load #" + result.loadNumber + " · Broker: " + result.brokerName,
            salesperson: "AI Extract",
            isBusiness: true,
            companyName: result.brokerName || "",
        };
        if (props.onAddJob) {
            props.onAddJob(job);
            alert("Draft job created! Check Jobs tab to review and confirm.");
        }
    }
    function useAsExpense() {
        if (!result || docType !== "receipt")
            return;
        var exp = { id: Date.now(), date: result.date || new Date().toISOString().split("T")[0], type: result.expenseType || "other", amount: Number(result.amount) || 0, note: result.vendor + " — " + result.description, jobId: "", state: result.state || "" };
        var exps = loadExpenses();
        exps.unshift(exp);
        saveExpenses(exps);
        alert("Expense logged! Check Expenses tab.");
    }
    // Fuel receipts get their own handler: they log to Expenses (for
    // profit/IFTA reporting, same as before) AND to the Document Log with
    // a timestamp captured at the moment of the scan — separate from
    // whatever date the receipt itself shows, so there's always a record
    // of exactly when the receipt was photographed/logged.
    function useAsFuelReceipt() {
        if (!result || docType !== "fuelreceipt")
            return;
        var scannedAt = new Date().toISOString();
        var exp = { id: Date.now(), date: result.date || new Date().toISOString().split("T")[0], type: "fuel", amount: Number(result.amount) || 0, note: (result.vendor || "Fuel") + (result.gallons ? " — " + result.gallons + " gal" : "") + (result.pricePerGallon ? " @ $" + result.pricePerGallon + "/gal" : ""), jobId: "", state: result.state || "" };
        var exps = loadExpenses();
        exps.unshift(exp);
        saveExpenses(exps);
        addDocument({ docType: "fuelreceipt", scannedAt: scannedAt, receiptDate: result.date || "", receiptTime: result.time || "", vendor: result.vendor || "", amount: result.amount || "", gallons: result.gallons || "", pricePerGallon: result.pricePerGallon || "", state: result.state || "", imageData: preview });
        alert("Fuel receipt logged to Expenses \u2014 timestamp saved: " + new Date(scannedAt).toLocaleString());
    }
    function useAsDocument(label) {
        if (!result)
            return;
        addDocument({ docType: docType, scannedAt: new Date().toISOString(), data: result, imageData: preview });
        alert((label || "Document") + " saved to Document Log. Check the Documents tab under 🚗 Fleet, or your job record.");
    }
    return React.createElement("div", { style: { maxWidth: 600, margin: "0 auto" } },
        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 4 } }, "\uD83E\uDD16 AI Document Extraction"),
        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 20 } }, "Take a photo of any document \u2014 AI reads it and fills in the data automatically. ~$0.01 per scan."),
        docType === "bol" && React.createElement("div", { style: { background: "#E53E3E12", border: "1px solid #E53E3E33", borderRadius: 9, padding: "12px 14px", marginBottom: 16 } },
            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.red, marginBottom: 4 } }, "\uD83D\uDD12 Sealed Freight \u2014 Always Record the Seal Number"),
            React.createElement("div", { style: { fontSize: 11, color: C.dim, lineHeight: 1.7 } }, "If the load is sealed, write down the seal number before it ever leaves the dock \u2014 it's your proof the load wasn't tampered with in transit. If DOT cuts the seal during an inspection, get the inspector's name/badge number and a copy of the inspection report, note the new seal number if they reseal it, and call dispatch immediately. Without a documented seal number, you have no way to prove a claim of cargo theft or tampering wasn't an inside job.")),
        React.createElement(Lbl, null, "Document Type"),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 } }, DOC_TYPES.map(function (d) {
            return React.createElement("div", { key: d.id, onClick: function () { setDocType(d.id); setResult(null); setPreview(null); }, style: { border: "1.5px solid " + (docType === d.id ? C.orange : C.border), borderRadius: 9, padding: "10px 14px", cursor: "pointer", background: docType === d.id ? C.orangeSoft : "transparent", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: docType === d.id ? C.orange : C.white } }, d.label),
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, marginTop: 2 } }, d.desc)),
                docType === d.id && React.createElement("div", { style: { width: 18, height: 18, borderRadius: "50%", background: C.orange, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#000", fontWeight: 800 } }, "\u2713"));
        })),
        React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 16 } },
            React.createElement(Btn, { onClick: pickImage, variant: "ghost", style: { flex: 1, padding: "12px" } }, "\uD83D\uDCF8 Take Photo / Upload"),
            preview && React.createElement(Btn, { onClick: extract, disabled: loading, style: { flex: 2, padding: "12px" } }, loading ? "🤖 Analyzing..." : "🤖 Extract Data")),
        preview && React.createElement("div", { style: { marginBottom: 16 } },
            React.createElement("img", { src: preview, style: { width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 9, border: "1px solid " + C.border, background: C.surface } })),
        error && React.createElement("div", { style: { background: C.red + "12", border: "1px solid " + C.red + "33", borderRadius: 9, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: C.red } }, error),
        result && React.createElement("div", null,
            React.createElement(Card, { style: { marginBottom: 12 } },
                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 12 } }, "\u2705 Extracted Data"),
                Object.entries(result).filter(function (e) { return e[1]; }).map(function (e) {
                    return React.createElement("div", { key: e[0], style: { display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid " + C.border, fontSize: 12 } },
                        React.createElement("span", { style: { color: C.dim, textTransform: "capitalize" } }, e[0].replace(/([A-Z])/g, " $1").trim()),
                        React.createElement("span", { style: { color: C.white, fontWeight: 600, textAlign: "right", maxWidth: "60%" } }, e[1]));
                })),
            React.createElement("div", { style: { display: "flex", gap: 8 } },
                docType === "ratecon" && React.createElement(Btn, { onClick: useAsJob, style: { flex: 1 } }, "\uD83D\uDCCB Create Draft Job"),
                docType === "receipt" && React.createElement(Btn, { onClick: useAsExpense, style: { flex: 1 } }, "\uD83D\uDCB8 Log as Expense"),
                docType === "fuelreceipt" && React.createElement(Btn, { onClick: useAsFuelReceipt, style: { flex: 1 } }, "\u26FD Log Fuel Receipt"),
                (docType === "bol" || docType === "packinglist" || docType === "weightticket") && React.createElement(Btn, { onClick: function () { useAsDocument(DOC_TYPES.find(function (d) { return d.id === docType; }).label); }, style: { flex: 1 } }, "\uD83D\uDCC1 Save to Document Log"),
                React.createElement(Btn, { variant: "ghost", onClick: function () { setResult(null); setPreview(null); }, style: { flex: 1 } }, "\uD83D\uDD04 Scan Another"))));
}
// ═══════════════════════════════════════════════════════════════════
// DEMO DATA LOADER — OWNER ONLY (🎬 Demo tab)
// ═══════════════════════════════════════════════════════════════════
function DemoDataLoader(props) {
    var [loaded, setLoaded] = useState(false);
    var [loading, setLoading] = useState(false);
    var [cleared, setCleared] = useState(false);
    function loadDemoData() {
        setLoading(true);
        setTimeout(function () {
            var today = new Date();
            function daysAgo(n) { var d = new Date(today); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }
            // ── 12 REALISTIC JOBS ─────────────────────────────────────────
            var demoJobs = [
                { id: "PL-8842", customer: "Marcus Thompson", phone: "(404) 291-7733", email: "marcus@atl-realty.com", service: "delivery", serviceName: "Delivery", origin: "1234 Peachtree Rd NW, Atlanta, GA", destination: "5678 Roswell Rd, Sandy Springs, GA", zone: "local", speed: "standard", basePrice: 225, finalPrice: 225, payment: "card", date: daysAgo(0), status: "En Route", miles: 12, salesperson: "Dispatch 1", isBusiness: false, customerType: "residential", priceTier: "standard", weightTier: "medium", helperNeeded: false, paidOnline: true, notes: "Sectional sofa, 3 pieces", createdBy: "Dispatch 1" },
                { id: "PL-8841", customer: "Apex Construction LLC", phone: "(770) 834-5512", email: "ops@apexconstruction.com", service: "junkremoval", serviceName: "Junk Removal", origin: "892 Industrial Blvd, Conyers, GA", destination: "892 Industrial Blvd, Conyers, GA", zone: "local", speed: "urgent", basePrice: 600, finalPrice: 780, payment: "card", date: daysAgo(0), status: "In Progress", miles: 0, salesperson: "Dispatch 2", isBusiness: true, companyName: "Apex Construction LLC", customerType: "commercial", priceTier: "standard", weightTier: "heavy", helperNeeded: true, paidOnline: true, notes: "Construction debris — drywall, lumber scraps", createdBy: "Dispatch 2" },
                { id: "PL-8840", customer: "Priya Nair", phone: "(678) 445-9901", email: "pnair@gmail.com", service: "cleanout", serviceName: "Property Cleanout", origin: "317 Oak Street, Covington, GA", destination: "317 Oak Street, Covington, GA", zone: "local", speed: "standard", basePrice: 3500, finalPrice: 3500, payment: "cash", date: daysAgo(1), status: "Completed", miles: 0, salesperson: "POTENT", isBusiness: false, customerType: "residential", priceTier: "standard", weightTier: "heavy", helperNeeded: true, paidOnline: false, notes: "3-bedroom estate cleanout — full house contents", createdBy: "POTENT" },
                { id: "PL-8839", customer: "DeShawn Williams Transport", phone: "(404) 667-2281", email: "dwilliams@dwtransport.com", service: "freight", serviceName: "Freight Transport", origin: "3300 Fulton Industrial Blvd, Atlanta, GA", destination: "7841 Broad St, Chattanooga, TN", zone: "longdist", speed: "standard", basePrice: 1500, finalPrice: 1500, payment: "net7", date: daysAgo(1), status: "Paid", miles: 118, salesperson: "Dispatch 1", isBusiness: true, companyName: "DeShawn Williams Transport", customerType: "commercial", priceTier: "standard", weightTier: "light", helperNeeded: false, paidOnline: false, notes: "Auto parts shipment — 2 pallets", createdBy: "Dispatch 1" },
                { id: "PL-8838", customer: "Keisha Monroe", phone: "(770) 552-3849", email: "kmonroe@email.com", service: "delivery", serviceName: "Delivery", origin: "4521 Browns Bridge Rd, Gainesville, GA", destination: "1100 Commerce Dr, Buford, GA", zone: "regional", speed: "standard", basePrice: 337, finalPrice: 337, payment: "card", date: daysAgo(2), status: "Paid", miles: 75, salesperson: "Dispatch 2", isBusiness: false, customerType: "residential", priceTier: "standard", weightTier: "light", helperNeeded: false, paidOnline: true, notes: "Antique dresser — fragile", createdBy: "Dispatch 2" },
                { id: "PL-8837", customer: "Atlanta Event Co.", phone: "(404) 991-0044", email: "events@atlantaeventco.com", service: "event", serviceName: "Event Drop-Off", origin: "100 Park Plaza Dr, Atlanta, GA", destination: "2200 Convention Center Dr, Columbus, GA", zone: "longdist", speed: "overnight", basePrice: 2700, finalPrice: 2700, payment: "card", date: daysAgo(2), status: "Completed", miles: 105, salesperson: "POTENT", isBusiness: true, companyName: "Atlanta Event Co.", customerType: "commercial", priceTier: "standard", weightTier: "medium", helperNeeded: true, paidOnline: true, notes: "Event staging equipment — 8 tables, 60 chairs, AV equipment", createdBy: "POTENT" },
                { id: "PL-8836", customer: "Roberto Sanchez", phone: "(678) 229-4401", email: "rsanchez@outlook.com", service: "junkremoval", serviceName: "Junk Removal", origin: "889 Tara Blvd, Jonesboro, GA", destination: "889 Tara Blvd, Jonesboro, GA", zone: "local", speed: "standard", basePrice: 350, finalPrice: 315, payment: "cash", date: daysAgo(3), status: "Paid", miles: 0, salesperson: "Dispatch 1", isBusiness: false, customerType: "residential", priceTier: "loyal", weightTier: "medium", helperNeeded: false, paidOnline: false, notes: "Repeat customer — garage cleanout, mostly boxes and old furniture", createdBy: "Dispatch 1" },
                { id: "PL-8835", customer: "Northside Medical Partners", phone: "(404) 881-7700", email: "facilities@northsidemedical.com", service: "discreet", serviceName: "Discreet / High-Value", origin: "1000 Johnson Ferry Rd NE, Atlanta, GA", destination: "4200 Hospital Pkwy, Tucker, GA", zone: "local", speed: "urgent", basePrice: 650, finalPrice: 650, payment: "card", date: daysAgo(4), status: "Paid", miles: 18, salesperson: "POTENT", isBusiness: true, companyName: "Northside Medical Partners", customerType: "commercial", priceTier: "standard", weightTier: "light", helperNeeded: false, paidOnline: true, notes: "Medical records transfer — confidential", createdBy: "POTENT" },
                { id: "PL-8834", customer: "James & Linda Porter", phone: "(770) 338-8821", email: "porterfamily@gmail.com", service: "cleanout", serviceName: "Property Cleanout", origin: "2240 Sigman Rd, Conyers, GA", destination: "2240 Sigman Rd, Conyers, GA", zone: "local", speed: "standard", basePrice: 5000, finalPrice: 5000, payment: "card", date: daysAgo(5), status: "Paid", miles: 0, salesperson: "Dispatch 2", isBusiness: false, customerType: "residential", priceTier: "standard", weightTier: "heavy", helperNeeded: true, paidOnline: true, notes: "4-bedroom estate cleanout — deceased relative's home, contents to donation center", createdBy: "Dispatch 2" },
                { id: "PL-8833", customer: "Bulldog Freight LLC", phone: "(706) 443-2219", email: "dispatch@bulldogfreight.com", service: "freight", serviceName: "Freight Transport", origin: "1700 Athens Hwy, Loganville, GA", destination: "5500 Peach State Blvd, Macon, GA", zone: "regional", speed: "standard", basePrice: 750, finalPrice: 750, payment: "net7", date: daysAgo(6), status: "Paid", miles: 87, salesperson: "Dispatch 1", isBusiness: true, companyName: "Bulldog Freight LLC", customerType: "commercial", priceTier: "standard", weightTier: "light", helperNeeded: false, paidOnline: false, notes: "Manufacturing components — 3 pallets", createdBy: "Dispatch 1" },
                { id: "PL-8832", customer: "Tamika Brooks", phone: "(404) 772-5509", email: "tbrooks@yahoo.com", service: "delivery", serviceName: "Delivery", origin: "3801 Camp Creek Pkwy, East Point, GA", destination: "5555 New Peachtree Rd, Chamblee, GA", zone: "local", speed: "afterhours", basePrice: 288, finalPrice: 288, payment: "card", date: daysAgo(7), status: "Paid", miles: 16, salesperson: "Dispatch 2", isBusiness: false, customerType: "residential", priceTier: "standard", weightTier: "light", helperNeeded: false, paidOnline: true, notes: "After-hours delivery — customer works day shift", createdBy: "Dispatch 2" },
                { id: "PL-8831", customer: "City of Conyers — Parks Dept", phone: "(770) 929-6300", email: "parks@conyersga.gov", service: "junkremoval", serviceName: "Junk Removal", origin: "1184 Scott St NE, Conyers, GA", destination: "1184 Scott St NE, Conyers, GA", zone: "local", speed: "standard", basePrice: 1000, finalPrice: 1000, payment: "net7", date: daysAgo(8), status: "Paid", miles: 0, salesperson: "POTENT", isBusiness: true, companyName: "City of Conyers", customerType: "institutional", priceTier: "standard", weightTier: "heavy", helperNeeded: true, paidOnline: false, notes: "Municipal debris removal — park renovation project", createdBy: "POTENT" },
            ];
            // ── 3 SAMPLE DRIVERS ──────────────────────────────────────────
            var demoDrivers = [
                { id: "d1", name: "Marcus J. Lewis", phone: "(470) 441-2233", email: "mlewis@email.com", pay_type: "per_load", pay_rate: 120, cdl_number: "GA-CDL-883821", cdl_expiry: daysAgo(-180), medical_card_expiry: daysAgo(-90), hire_date: daysAgo(365), status: "active", org_id: "potent-logistics" },
                { id: "d2", name: "DeShawn Carter", phone: "(404) 556-7788", email: "dcarter@email.com", pay_type: "per_mile", pay_rate: 0.45, cdl_number: "GA-CDL-441209", cdl_expiry: daysAgo(-365), medical_card_expiry: daysAgo(-200), hire_date: daysAgo(180), status: "active", org_id: "potent-logistics" },
                { id: "d3", name: "Terrence Washington", phone: "(678) 993-4421", email: "twash@email.com", pay_type: "percentage", pay_rate: 30, cdl_number: "GA-CDL-662847", cdl_expiry: daysAgo(25), medical_card_expiry: daysAgo(18), hire_date: daysAgo(90), status: "active", org_id: "potent-logistics" },
            ];
            // ── SETTLEMENTS ───────────────────────────────────────────────
            var demoSettlements = [
                { id: "s1", driver_id: "d1", driver_name: "Marcus J. Lewis", period_start: daysAgo(14), period_end: daysAgo(7), gross_pay: 480, fuel_advance: 40, damages: 0, insurance_deduction: 25, equipment_rental: 0, other_deductions: 0, net_pay: 415, status: "paid", paid_date: daysAgo(5), notes: "4 loads completed" },
                { id: "s2", driver_id: "d2", driver_name: "DeShawn Carter", period_start: daysAgo(14), period_end: daysAgo(7), gross_pay: 360, fuel_advance: 50, damages: 0, insurance_deduction: 25, equipment_rental: 0, other_deductions: 0, net_pay: 285, status: "paid", paid_date: daysAgo(5), notes: "800 miles" },
                { id: "s3", driver_id: "d1", driver_name: "Marcus J. Lewis", period_start: daysAgo(7), period_end: daysAgo(0), gross_pay: 600, fuel_advance: 0, damages: 0, insurance_deduction: 25, equipment_rental: 0, other_deductions: 0, net_pay: 575, status: "unpaid", notes: "5 loads this period" },
                { id: "s4", driver_id: "d3", driver_name: "Terrence Washington", period_start: daysAgo(7), period_end: daysAgo(0), gross_pay: 390, fuel_advance: 60, damages: 0, insurance_deduction: 25, equipment_rental: 0, other_deductions: 0, net_pay: 305, status: "unpaid", notes: "30% of 3 loads" },
            ];
            // ── EXPENSES ──────────────────────────────────────────────────
            var demoExpenses = [
                { id: "e1", date: daysAgo(0), type: "fuel", amount: 87.42, note: "Fuel — Love's Travel Stop", jobId: "PL-8842", state: "GA" },
                { id: "e2", date: daysAgo(1), type: "fuel", amount: 124.18, note: "Fuel — Pilot Flying J, Chattanooga", jobId: "PL-8839", state: "TN" },
                { id: "e3", date: daysAgo(2), type: "tolls", amount: 12.50, note: "I-285 E-ZPass tolls", jobId: "PL-8838", state: "GA" },
                { id: "e4", date: daysAgo(2), type: "fuel", amount: 98.75, note: "Fuel — Shell, Gainesville", jobId: "PL-8838", state: "GA" },
                { id: "e5", date: daysAgo(3), type: "supplies", amount: 45.00, note: "Moving blankets and straps", jobId: "", state: "GA" },
                { id: "e6", date: daysAgo(4), type: "fuel", amount: 76.30, note: "Fuel — BP, Marietta", jobId: "PL-8835", state: "GA" },
                { id: "e7", date: daysAgo(5), type: "fuel", amount: 155.60, note: "Fuel — Pilot, Columbus", jobId: "PL-8834", state: "GA" },
                { id: "e8", date: daysAgo(6), type: "tolls", amount: 8.75, note: "I-20 West tolls", jobId: "PL-8833", state: "GA" },
                { id: "e9", date: daysAgo(7), type: "parking", amount: 22.00, note: "Parking — Chamblee delivery", jobId: "PL-8832", state: "GA" },
                { id: "e10", date: daysAgo(8), type: "fuel", amount: 110.25, note: "Fuel — Love's Conyers", jobId: "PL-8831", state: "GA" },
            ];
            // ── CARRIERS ──────────────────────────────────────────────────
            var demoCarriers = [
                { id: "c1", name: "Southeast Express Carriers", mcNumber: "MC-882341", dotNumber: "DOT-3394821", phone: "(404) 441-9900", email: "dispatch@secarriers.com", address: "4500 Logistics Way, Atlanta, GA", insuranceExpiry: daysAgo(-90), insuranceCarrier: "Old Republic Insurance", rating: 4, notes: "Reliable for Atlanta-Nashville lane. Net 7 payer." },
                { id: "c2", name: "Bulldog Freight Partners", mcNumber: "MC-441029", dotNumber: "DOT-2201847", phone: "(706) 229-3311", email: "ops@bulldogfreight.com", address: "800 Commerce Park Dr, Athens, GA", insuranceExpiry: daysAgo(25), insuranceCarrier: "Progressive Commercial", rating: 3, notes: "Good for Georgia intrastate. Sometimes slow on paperwork." },
                { id: "c3", name: "Southern Star Logistics", mcNumber: "MC-993847", dotNumber: "DOT-4412098", phone: "(678) 552-8877", email: "sslogistics@email.com", address: "2200 Airport Blvd, Augusta, GA", insuranceExpiry: daysAgo(-180), insuranceCarrier: "Sentry Insurance", rating: 5, notes: "Best carrier for oversized loads. Premium rate but always delivers." },
            ];
            // ── BROKERS ───────────────────────────────────────────────────
            var demoBrokers = [
                { id: "b1", name: "Peach State Brokerage", mcNumber: "MC-334421", phone: "(404) 771-2200", email: "loads@peachstatebrokerage.com", creditScore: 82, creditLimit: 15000, daysToPay: 14, notes: "Good load volume on I-85 corridor" },
                { id: "b2", name: "Highway Logistics Group", mcNumber: "MC-882039", phone: "(770) 448-9900", email: "dispatch@highwaylogistics.com", creditScore: 65, creditLimit: 8000, daysToPay: 21, notes: "Pays slow — watch credit limit closely" },
                { id: "b3", name: "Cargo Connect Southeast", mcNumber: "MC-119384", phone: "(404) 882-3341", email: "carriers@cargoconnect.com", creditScore: 91, creditLimit: 25000, daysToPay: 7, notes: "Best broker in our network. Quick pay, consistent volume." },
            ];
            // ── CRM LEADS ────────────────────────────────────────────────
            var demoLeads = [
                { id: "l1", name: "Brandon Willis", company: "Willis Moving & Storage", phone: "(770) 334-8821", email: "bwillis@willismoving.com", service_type: "Freight / Trucking", stage: "quoted", estimated_value: 8500, source: "Referral", follow_up_date: daysAgo(-1), notes: "5-truck fleet, currently on Samsara + TruckingOffice. Paying $890/mo in subscriptions.", created_at: new Date().toISOString() },
                { id: "l2", name: "Carmen Rodriguez", company: "CR Property Services", phone: "(404) 229-3318", email: "carmen@crproperty.com", service_type: "Property Services", stage: "contacted", estimated_value: 6500, source: "Google", follow_up_date: daysAgo(0), notes: "Property management company, needs recurring cleanout service", created_at: new Date().toISOString() },
                { id: "l3", name: "Malik Johnson", company: "Johnson Bros Transport", phone: "(678) 441-7729", email: "malik@johnsonbrostransport.com", service_type: "Freight / Trucking", stage: "new", estimated_value: 12500, source: "Social Media", follow_up_date: daysAgo(-2), notes: "12-truck fleet. Saw our Instagram post about the Motive API situation.", created_at: new Date().toISOString() },
                { id: "l4", name: "Sandra Lee", company: "Lee Commercial Real Estate", phone: "(770) 882-4401", email: "slee@leecommercial.com", service_type: "Multiple Services", stage: "won", estimated_value: 3500, source: "Referral", follow_up_date: daysAgo(-7), notes: "POTENT OS Starter plan sold. Onboarding scheduled.", created_at: new Date().toISOString() },
                { id: "l5", name: "Tony Guerrero", company: "Guerrero Hauling", phone: "(404) 556-1188", email: "tony@guerrerohauling.com", service_type: "Freight / Trucking", stage: "contacted", estimated_value: 6500, source: "Cold Call", follow_up_date: daysAgo(-1), notes: "8-truck fleet. Currently using Excel + QuickBooks. Ready to move.", created_at: new Date().toISOString() },
            ];
            // ── LANES ────────────────────────────────────────────────────
            var demoLanes = [
                { key: "Atlanta→Chattanooga", origin: "Atlanta, GA", destination: "Chattanooga, TN", count: 6, totalRevenue: 9000, avgRevenue: 1500, lastDate: daysAgo(1) },
                { key: "Conyers→Atlanta", origin: "Conyers, GA", destination: "Atlanta, GA", count: 18, totalRevenue: 4050, avgRevenue: 225, lastDate: daysAgo(0) },
                { key: "Atlanta→Macon", origin: "Atlanta, GA", destination: "Macon, GA", count: 4, totalRevenue: 3000, avgRevenue: 750, lastDate: daysAgo(6) },
                { key: "Gainesville→Buford", origin: "Gainesville, GA", destination: "Buford, GA", count: 3, totalRevenue: 1011, avgRevenue: 337, lastDate: daysAgo(2) },
                { key: "Atlanta→Columbus", origin: "Atlanta, GA", destination: "Columbus, GA", count: 2, totalRevenue: 5400, avgRevenue: 2700, lastDate: daysAgo(2) },
                { key: "Loganville→Macon", origin: "Loganville, GA", destination: "Macon, GA", count: 5, totalRevenue: 3750, avgRevenue: 750, lastDate: daysAgo(6) },
            ];
            // ── SAVE EVERYTHING ───────────────────────────────────────────
            try {
                // Jobs — merge with existing
                var existing = loadJobs();
                var existingIds = existing.map(function (j) { return j.id; });
                var newJobs = demoJobs.filter(function (j) { return existingIds.indexOf(j.id) === -1; });
                saveJobs(newJobs.concat(existing));
                // Expenses
                var existingExp = loadExpenses();
                var existingExpIds = existingExp.map(function (e) { return e.id; });
                var newExp = demoExpenses.filter(function (e) { return existingExpIds.indexOf(e.id) === -1; });
                saveExpenses(newExp.concat(existingExp));
                // Carriers
                var existingCarriers = loadCarriers();
                var existingCIds = existingCarriers.map(function (c) { return c.id; });
                var newCarriers = demoCarriers.filter(function (c) { return existingCIds.indexOf(c.id) === -1; });
                saveCarriers(newCarriers.concat(existingCarriers));
                // Brokers
                var existingBrokers = loadBrokers();
                var existingBIds = existingBrokers.map(function (b) { return b.id; });
                var newBrokers = demoBrokers.filter(function (b) { return existingBIds.indexOf(b.id) === -1; });
                saveBrokers(newBrokers.concat(existingBrokers));
                // Leads
                var existingLeads = [];
                try {
                    var r = localStorage.getItem("pl_leads");
                    if (r)
                        existingLeads = JSON.parse(r);
                }
                catch (e) { }
                var existingLIds = existingLeads.map(function (l) { return l.id; });
                var newLeads = demoLeads.filter(function (l) { return existingLIds.indexOf(l.id) === -1; });
                localStorage.setItem("pl_leads", JSON.stringify(newLeads.concat(existingLeads)));
                // Lanes
                var existingLanes = loadLanes();
                var existingLaneKeys = existingLanes.map(function (l) { return l.key; });
                var newLanes = demoLanes.filter(function (l) { return existingLaneKeys.indexOf(l.key) === -1; });
                saveLanes(newLanes.concat(existingLanes));
                // Settlements
                var existingSettlements = [];
                try {
                    var rs = localStorage.getItem("pl_settlements");
                    if (rs)
                        existingSettlements = JSON.parse(rs);
                }
                catch (e) { }
                var existingSIds = existingSettlements.map(function (s) { return s.id; });
                var newSettlements = demoSettlements.filter(function (s) { return existingSIds.indexOf(s.id) === -1; });
                localStorage.setItem("pl_settlements", JSON.stringify(newSettlements.concat(existingSettlements)));
                // Drivers
                var existingDrivers = [];
                try {
                    var rd = localStorage.getItem("pl_drivers");
                    if (rd)
                        existingDrivers = JSON.parse(rd);
                }
                catch (e) { }
                var existingDIds = existingDrivers.map(function (d) { return d.id; });
                var newDrivers = demoDrivers.filter(function (d) { return existingDIds.indexOf(d.id) === -1; });
                localStorage.setItem("pl_drivers", JSON.stringify(newDrivers.concat(existingDrivers)));
            }
            catch (e) {
                console.error("Demo data error:", e);
            }
            // Add jobs to React state
            demoJobs.forEach(function (j) { props.onAddJob(j); });
            setLoading(false);
            setLoaded(true);
        }, 800);
    }
    function clearDemoData() {
        ["pl_drivers", "pl_settlements", "pl_leads", "pl_lanes", "pl_carriers", "pl_brokers"].forEach(function (k) {
            try {
                localStorage.removeItem(k);
            }
            catch (e) { }
        });
        var jobs = loadJobs().filter(function (j) { return !j.id.match(/^PL-88[3-4]/); });
        saveJobs(jobs);
        var exp = loadExpenses().filter(function (e) { return !["e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9", "e10"].includes(e.id); });
        saveExpenses(exp);
        setCleared(true);
        setLoaded(false);
        setTimeout(function () { setCleared(false); }, 3000);
    }
    var revenue = 17295; // sum of all demo job prices
    return React.createElement("div", { style: { maxWidth: 600, margin: "0 auto" } },
        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 4 } }, "\uD83C\uDFAC Demo Data Loader"),
        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 20 } }, "Owner only \u00B7 Loads realistic sample data for demos. Won't overwrite real data \u2014 only adds if not already present."),
        React.createElement("div", { style: { background: "#111", border: "1px solid " + C.orange + "33", borderRadius: 12, padding: "20px", marginBottom: 16 } },
            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 12 } }, "What gets loaded:"),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 } }, [["📋 Jobs", "12 realistic jobs — 6 statuses, 5 service types, real GA addresses, $" + revenue.toLocaleString() + " total revenue"], ["👤 Drivers", "3 drivers — per load, per mile, % pay structures with sample settlements"], ["💸 Expenses", "10 fuel/toll/parking/supply entries linked to jobs with states for IFTA"], ["🤝 Carriers", "3 carriers with MC/DOT, insurance expiry dates, ratings"], ["📋 Brokers", "3 brokers with credit scores, days-to-pay, credit limits"], ["🎯 Leads", "5 CRM leads — various pipeline stages, including a won POTENT OS deal"], ["🗺 Lanes", "6 lanes with run counts and revenue data for analytics"], ["💰 Settlements", "4 driver settlements — 2 paid, 2 unpaid"],].map(function (item) {
                return React.createElement("div", { key: item[0], style: { background: C.surface, borderRadius: 8, padding: "10px 12px" } },
                    React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 2 } }, item[0]),
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, lineHeight: 1.5 } }, item[1]));
            })),
            loaded ? React.createElement("div", { style: { background: "#1DB95420", border: "1px solid #1DB95444", borderRadius: 8, padding: "12px 14px", marginBottom: 12, fontSize: 13, fontWeight: 700, color: "#1DB954", textAlign: "center" } }, "\u2705 Demo data loaded! Switch to any tab to see it.") : null,
            cleared ? React.createElement("div", { style: { background: C.red + "20", border: "1px solid " + C.red + "44", borderRadius: 8, padding: "12px 14px", marginBottom: 12, fontSize: 13, fontWeight: 700, color: C.red, textAlign: "center" } }, "\uD83D\uDDD1 Demo data cleared.") : null,
            React.createElement("div", { style: { display: "flex", gap: 10 } },
                React.createElement(Btn, { onClick: loadDemoData, disabled: loading || loaded, style: { flex: 2, padding: "12px", fontSize: 13 } }, loading ? "Loading..." : `🎬 Load Demo Data`),
                React.createElement(Btn, { onClick: clearDemoData, variant: "ghost", style: { flex: 1, padding: "12px", fontSize: 12 } }, "\uD83D\uDDD1 Clear Demo"))),
        React.createElement(Card, null,
            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 8 } }, "\uD83D\uDCCB After loading \u2014 what to demo:"),
            [["📋 Jobs tab", "12 jobs across all statuses. Filter by status, show bulk actions, clone a job, check Lanes history"], ["📈 Analytics tab", "Real RPM/CPM numbers, lane profitability, driver productivity, AR aging all populated"], ["💰 Settlements", "2 unpaid settlements ready — tap Mark Paid to show live workflow"], ["🤝 Carriers tab", "3 carriers — one with expiring insurance shows the alert"], ["🎯 Sales tab", "Shows revenue attributed to each dispatcher"], ["⛽ IFTA", "Fuel expenses in GA and TN — state breakdown shows automatically"], ["🚨 Alerts tab", "Shows active jobs needing attention, payment statuses"],].map(function (item) {
                return React.createElement("div", { key: item[0], style: { display: "flex", gap: 10, padding: "7px 0", borderBottom: "1px solid " + C.border, fontSize: 12 } },
                    React.createElement("span", { style: { fontWeight: 700, color: C.orange, flexShrink: 0, minWidth: 130 } }, item[0]),
                    React.createElement("span", { style: { color: C.dim, lineHeight: 1.5 } }, item[1]));
            })));
}
// ═══════════════════════════════════════════════════════════════════
// LEADS BOARD — pulls from shared Supabase leads table
// ═══════════════════════════════════════════════════════════════════
var CALL_OUTCOMES = [
    { key: "no_answer", label: "No Answer", color: "#666" },
    { key: "voicemail", label: "Voicemail", color: "#666" },
    { key: "not_interested", label: "Not Interested", color: C.red },
    { key: "follow_up", label: "Follow Up", color: C.orange },
    { key: "interested", label: "Interested", color: C.green },
    { key: "booked", label: "Booked!", color: "#1DB954" },
];
var STATUS_FROM_OUTCOME = { no_answer: "Not Contacted", voicemail: "Contacted", not_interested: "Closed", follow_up: "Follow-Up", interested: "Interested", booked: "Booked" };
// Your leads table also has a separate "stage" column (used elsewhere in
// your Supabase schema, e.g. lead_activities) — kept in sync with status
// so nothing relying on either field falls out of date.
var STAGE_FROM_OUTCOME = { no_answer: "contacted", voicemail: "contacted", not_interested: "lost", follow_up: "follow_up", interested: "qualified", booked: "won" };
var LEAD_STATUS_COLORS = { "Not Contacted": "#555", "Contacted": "#4299E1", "Follow-Up": C.orange, "Interested": C.green, "Booked": "#1DB954", "Closed": "#333" };
function sbLeads(method, data, filter) {
    var url = SUPABASE_URL + "/rest/v1/leads";
    if (filter)
        url += "?" + filter;
    return fetch(url, {
        method: method || "GET",
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY, "Content-Type": "application/json", Prefer: "return=representation" },
        body: data ? JSON.stringify(data) : undefined
    }).then(function (r) { return r.json(); });
}
function LeadsBoard(props) {
    var currentUser = props.currentUser;
    var [leads, setLeads] = useState([]);
    var [loading, setLoading] = useState(true);
    var [search, setSearch] = useState("");
    var [statusFilter, setStatusFilter] = useState("All");
    var [catFilter, setCatFilter] = useState("All");
    var [selected, setSelected] = useState(null);
    var [note, setNote] = useState("");
    var [followDate, setFollowDate] = useState("");
    var [saving, setSaving] = useState(false);
    var [page, setPage] = useState(0);
    var PER_PAGE = 50;
    // ── Dashboard / Queue mode — matches the old dispatch board's flow:
    // "Next Lead" auto-picks the next Not Contacted lead, "Work Follow-Ups"
    // cycles only through leads due for follow-up. "view" controls which
    // screen shows: dashboard (stat tiles + Next Lead), list (search/filter,
    // existing behavior), or detail (a specific lead, existing behavior).
    var [view, setView] = useState("dashboard");
    var [queueMode, setQueueMode] = useState(""); // "" | "followups"
    var [queueIds, setQueueIds] = useState([]);
    var [queuePos, setQueuePos] = useState(0);
    // ── Add New Lead ─────────────────────────────────────────────────
    var [showAddLead, setShowAddLead] = useState(false);
    var [newLead, setNewLead] = useState({ name: "", company: "", category: "", city: "", state: "GA", phone: "", email: "", contact_person: "", service_type: "", source: "", priority: "", notes: "" });
    var [addingLead, setAddingLead] = useState(false);
    var [addLeadErr, setAddLeadErr] = useState("");
    function setNewLeadField(k, v) { setNewLead(function (p) { var n = Object.assign({}, p); n[k] = v; return n; }); }
    function submitNewLead() {
        if (!newLead.name.trim()) {
            setAddLeadErr("Name is required.");
            return;
        }
        setAddingLead(true);
        setAddLeadErr("");
        var payload = Object.assign({}, newLead, { status: "Not Contacted", stage: "new", notes_log: [] });
        sbLeads("POST", payload).then(function (data) {
            setAddingLead(false);
            var created = Array.isArray(data) ? data[0] : data;
            if (created && created.id) {
                setLeads(function (prev) { return [created].concat(prev); });
                setShowAddLead(false);
                setNewLead({ name: "", company: "", category: "", city: "", state: "GA", phone: "", email: "", contact_person: "", service_type: "", source: "", priority: "", notes: "" });
            }
            else {
                setAddLeadErr("Couldn't save — check your connection and try again.");
            }
        }).catch(function () {
            setAddingLead(false);
            setAddLeadErr("Couldn't save — check your connection and try again.");
        });
    }
    useEffect(function () {
        setLoading(true);
        sbLeads("GET", null, "select=*&order=name&limit=1000").then(function (data) {
            setLeads(Array.isArray(data) ? data : []);
            setLoading(false);
        }).catch(function () { setLoading(false); });
    }, []);
    var callerName = currentUser ? currentUser.name : "Dispatch";
    var categories = ["All"].concat(Array.from(new Set(leads.map(function (l) { return l.category || ""; }).filter(Boolean))).sort());
    var statuses = ["All", "Not Contacted", "Contacted", "Follow-Up", "Interested", "Booked", "Closed"];
    var filtered = leads.filter(function (l) {
        if (statusFilter !== "All" && l.status !== statusFilter)
            return false;
        if (catFilter !== "All" && l.category !== catFilter)
            return false;
        if (search.trim()) {
            var q = search.toLowerCase();
            return (l.name || "").toLowerCase().indexOf(q) > -1 || (l.city || "").toLowerCase().indexOf(q) > -1 || (l.category || "").toLowerCase().indexOf(q) > -1;
        }
        return true;
    });
    var paged = filtered.slice(page * PER_PAGE, (page + 1) * PER_PAGE);
    var totalPages = Math.ceil(filtered.length / PER_PAGE);
    var stats = {
        total: leads.length,
        notContacted: leads.filter(function (l) { return l.status === "Not Contacted"; }).length,
        followUps: leads.filter(function (l) { return l.status === "Follow-Up"; }).length,
        interested: leads.filter(function (l) { return l.status === "Interested"; }).length,
        booked: leads.filter(function (l) { return l.status === "Booked"; }).length,
    };
    // ── Queue helpers ────────────────────────────────────────────────
    function startNextLeadQueue() {
        var ids = leads.filter(function (l) { return l.status === "Not Contacted"; }).map(function (l) { return l.id; });
        if (ids.length === 0) {
            alert("No uncalled leads left — every lead has been contacted at least once.");
            return;
        }
        setQueueMode("next");
        setQueueIds(ids);
        setQueuePos(0);
        setSelected(ids[0]);
        setView("detail");
    }
    function startFollowUpQueue() {
        var ids = leads.filter(function (l) { return l.status === "Follow-Up"; }).map(function (l) { return l.id; });
        if (ids.length === 0) {
            alert("No follow-ups due right now.");
            return;
        }
        setQueueMode("followups");
        setQueueIds(ids);
        setQueuePos(0);
        setSelected(ids[0]);
        setView("detail");
    }
    function advanceQueue() {
        var nextPos = queuePos + 1;
        if (nextPos < queueIds.length) {
            setQueuePos(nextPos);
            setSelected(queueIds[nextPos]);
        }
        else {
            setQueueMode("");
            setQueueIds([]);
            setQueuePos(0);
            setSelected(null);
            setView("dashboard");
        }
    }
    function exitQueue() {
        setQueueMode("");
        setQueueIds([]);
        setQueuePos(0);
        setSelected(null);
        setView("dashboard");
    }
    var [emailSending, setEmailSending] = useState(false);
    var [emailMsg, setEmailMsg] = useState("");
    function logCall(lead, outcomeKey) {
        if (saving)
            return;
        setSaving(true);
        var entry = { ts: Date.now(), author: callerName, outcome: outcomeKey, text: note.trim(), followUpDate: outcomeKey === "follow_up" ? followDate : "" };
        var newLog = Array.isArray(lead.notes_log) ? lead.notes_log.concat([entry]) : [entry];
        var updated = { status: STATUS_FROM_OUTCOME[outcomeKey] || lead.status, stage: STAGE_FROM_OUTCOME[outcomeKey] || lead.stage, notes_log: newLog, follow_up_date: outcomeKey === "follow_up" ? followDate : lead.follow_up_date };
        fetch(SUPABASE_URL + "/rest/v1/leads?id=eq." + lead.id, {
            method: "PATCH",
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY, "Content-Type": "application/json" },
            body: JSON.stringify(updated)
        }).then(function () {
            setLeads(function (prev) { return prev.map(function (l) { return l.id === lead.id ? Object.assign({}, l, updated) : l; }); });
            // Auto-send follow-up email when a lead moves to Follow-Up or Interested,
            // as long as we have an email on file. Fails silently (logged to console)
            // so a bad email address never blocks the call-log save.
            if ((outcomeKey === "follow_up" || outcomeKey === "interested") && lead.email) {
                var autoTemplate = outcomeKey === "follow_up" ? "follow_up" : "intro";
                sendLeadEmail(lead, autoTemplate, callerName).catch(function (e) { console.error("Auto lead email failed:", e); });
            }
            setNote("");
            setFollowDate("");
            setSaving(false);
            if (queueMode) {
                advanceQueue();
            }
            else {
                setSelected(null);
                setView("list");
            }
        }).catch(function () { setSaving(false); });
    }
    function sendManualEmail(lead, templateKey) {
        if (emailSending)
            return;
        if (!lead.email) {
            setEmailMsg("\u26A0 No email on file for this lead.");
            setTimeout(function () { setEmailMsg(""); }, 3000);
            return;
        }
        setEmailSending(true);
        setEmailMsg("");
        sendLeadEmail(lead, templateKey, callerName).then(function () {
            setEmailMsg("\u2705 " + LEAD_EMAIL_TEMPLATES[templateKey].label + " sent to " + lead.email);
            setEmailSending(false);
            setTimeout(function () { setEmailMsg(""); }, 4000);
        }).catch(function () {
            setEmailMsg("\u26A0 Failed to send. Check EmailJS setup.");
            setEmailSending(false);
            setTimeout(function () { setEmailMsg(""); }, 4000);
        });
    }
    if (loading)
        return React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "60px 0", fontSize: 14 } }, "Loading leads from Supabase...");
    if (selected) {
        var lead = leads.find(function (l) { return l.id === selected; });
        if (!lead) {
            // Selected lead vanished (e.g. filtered out after a status change) —
            // bail out cleanly instead of crashing on lead.notes_log below.
            if (queueMode)
                advanceQueue();
            else {
                setSelected(null);
                setView("list");
            }
            return null;
        }
        var history = Array.isArray(lead.notes_log) ? lead.notes_log.slice().reverse().slice(0, 6) : [];
        return React.createElement("div", { style: { maxWidth: 560, margin: "0 auto" } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } },
                React.createElement("button", { onClick: function () { if (queueMode) {
                            exitQueue();
                        }
                        else {
                            setSelected(null);
                            setNote("");
                            setFollowDate("");
                            setView("list");
                        } }, style: { background: "none", border: "none", color: C.dim, fontSize: 13, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 } }, queueMode ? "\u2715 Exit Queue" : "\u2190 Back to list"),
                queueMode && React.createElement("div", { style: { fontSize: 11, color: C.dim, fontWeight: 700 } },
                    (queueMode === "followups" ? "FOLLOW-UPS" : "NEXT LEAD"),
                    " \u00B7 ",
                    (queuePos + 1),
                    " of ",
                    queueIds.length)),
            React.createElement("div", { style: { background: "#F5F1E8", color: "#0B0E14", borderRadius: 12, padding: "20px", marginBottom: 16 } },
                React.createElement("div", { style: { fontSize: 10, fontWeight: 700, color: "#B5473A", textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 } }, lead.category || lead.industry || "Lead"),
                React.createElement("div", { style: { fontSize: 22, fontWeight: 800, marginBottom: 4 } }, lead.name),
                lead.company && React.createElement("div", { style: { fontSize: 13, color: "#333", fontWeight: 600, marginBottom: 2 } }, lead.company),
                React.createElement("div", { style: { fontSize: 13, color: "#555", marginBottom: 8 } },
                    [lead.city, lead.state].filter(Boolean).join(", "),
                    lead.contact_person ? " · " + lead.contact_person : ""),
                lead.phone && React.createElement("a", { href: "tel:" + lead.phone.replace(/[^\d+]/g, ""), style: { display: "flex", alignItems: "center", gap: 10, background: "#0B0E14", color: "#F5F1E8", borderRadius: 8, padding: "14px 16px", textDecoration: "none", fontWeight: 700, fontSize: 16, marginBottom: 12 } },
                    "\uD83D\uDCDE ",
                    lead.phone),
                React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 } },
                    lead.priority && React.createElement("span", { style: { background: "#0B0E1418", borderRadius: 5, padding: "3px 9px", fontSize: 10, fontWeight: 700 } }, "Priority: " + lead.priority),
                    lead.source && React.createElement("span", { style: { background: "#0B0E1418", borderRadius: 5, padding: "3px 9px", fontSize: 10, fontWeight: 700 } }, "Source: " + lead.source),
                    lead.estimated_value && React.createElement("span", { style: { background: "#0B0E1418", borderRadius: 5, padding: "3px 9px", fontSize: 10, fontWeight: 700 } }, "Est: $" + lead.estimated_value)),
                lead.service_type && React.createElement("div", { style: { fontSize: 12, color: "#555", marginBottom: 4 } },
                    React.createElement("strong", null, "Needs:"),
                    " ",
                    lead.service_type),
                lead.notes && React.createElement("div", { style: { fontSize: 12, color: "#555" } },
                    React.createElement("strong", null, "Notes:"),
                    " ",
                    lead.notes)),
            React.createElement("div", { style: { background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 16px", marginBottom: 14 } },
                React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 } }, "\uD83D\uDCE7 Send Email"),
                React.createElement("div", { style: { fontSize: 11, color: C.faint, marginBottom: 10 } }, lead.email ? lead.email : "No email on file for this lead."),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 } }, Object.keys(LEAD_EMAIL_TEMPLATES).map(function (key) {
                    return React.createElement("button", { key: key, disabled: emailSending || !lead.email, onClick: function () { sendManualEmail(lead, key); }, style: { border: "1px solid " + C.border, borderRadius: 8, padding: "9px 6px", cursor: (emailSending || !lead.email) ? "not-allowed" : "pointer", background: C.surface, color: C.white, fontSize: 11, fontWeight: 700, fontFamily: "inherit", opacity: (emailSending || !lead.email) ? 0.4 : 1 } }, LEAD_EMAIL_TEMPLATES[key].label);
                })),
                emailMsg && React.createElement("div", { style: { fontSize: 11, color: emailMsg.indexOf("\u2705") === 0 ? C.green : C.red, marginTop: 8 } }, emailMsg),
                React.createElement("div", { style: { fontSize: 9, color: C.faint, marginTop: 8, lineHeight: 1.5 } }, "Automation: moving a lead to Follow-Up or Interested during call logging below auto-sends the matching email if one is on file.")),
            history.length > 0 && React.createElement("div", { style: { background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 16px", marginBottom: 14 } },
                React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 } }, "Call History"),
                history.map(function (h, i) {
                    var oc = CALL_OUTCOMES.find(function (o) { return o.key === h.outcome; });
                    return React.createElement("div", { key: i, style: { marginBottom: 10, paddingBottom: 10, borderBottom: i < history.length - 1 ? "1px solid " + C.border : "none" } },
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 3 } },
                            React.createElement("span", { style: { background: (oc ? oc.color : "#666") + "22", color: oc ? oc.color : "#666", borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700 } }, oc ? oc.label : h.outcome),
                            React.createElement("span", { style: { fontSize: 10, color: C.faint } },
                                h.author,
                                " \u00B7 ",
                                new Date(h.ts).toLocaleDateString() + " " + new Date(h.ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }))),
                        h.text && React.createElement("div", { style: { fontSize: 12, color: C.dim, lineHeight: 1.5 } }, h.text));
                })),
            React.createElement("div", { style: { background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "14px 16px" } },
                React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 } },
                    "Log This Call \u2014 calling as ",
                    callerName),
                React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 10 } },
                    React.createElement("textarea", { value: note, onChange: function (e) { setNote(e.target.value); }, placeholder: "Notes (optional)... or tap the mic to dictate", rows: 2, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.white, padding: "10px 12px", fontSize: 13, flex: 1, outline: "none", fontFamily: "inherit", boxSizing: "border-box", resize: "vertical" } }),
                    React.createElement(VoiceMicButton, { currentValue: note, onTranscript: setNote })),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 } }, CALL_OUTCOMES.map(function (o) {
                    return React.createElement("button", { key: o.key, onClick: function () {
                            if (o.key === "follow_up" && !followDate) {
                                alert("Pick a follow-up date first");
                                return;
                            }
                            logCall(lead, o.key);
                        }, disabled: saving, style: { border: "2px solid " + o.color, borderRadius: 9, padding: "10px 8px", cursor: saving ? "not-allowed" : "pointer", background: "transparent", color: o.color, fontSize: 12, fontWeight: 700, fontFamily: "inherit" } }, o.label);
                })),
                React.createElement("div", { style: { marginTop: 10 } },
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 4 } }, "Follow-up date (required for Follow Up):"),
                    React.createElement("input", { type: "date", value: followDate, onChange: function (e) { setFollowDate(e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.white, padding: "8px 12px", fontSize: 13, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" } }))));
    }
    if (view === "dashboard") {
        return React.createElement("div", { style: { maxWidth: 480, margin: "0 auto" } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 } },
                React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: C.white } }, "\uD83D\uDCCB Leads Board"),
                React.createElement(Btn, { onClick: function () { setShowAddLead(true); }, style: { padding: "7px 12px", fontSize: 11 } }, "\u2795 Add Lead")),
            React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 20 } },
                "Calling as ",
                React.createElement("strong", { style: { color: C.orange } }, callerName)),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 } }, [["Not Called", stats.notContacted, C.white], ["Follow-Ups", stats.followUps, C.orange], ["Interested", stats.interested, C.green], ["Booked", stats.booked, "#1DB954"]].map(function (s) {
                return React.createElement(Card, { key: s[0], style: { padding: "18px 16px" } },
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 } }, s[0]),
                    React.createElement("div", { style: { fontSize: 34, fontWeight: 900, color: s[1] > 0 ? s[2] : C.faint } }, s[1]));
            })),
            React.createElement(Btn, { onClick: startNextLeadQueue, style: { width: "100%", padding: "16px", fontSize: 15, marginBottom: 10 } }, "\uD83D\uDCDE Next Lead"),
            React.createElement(Btn, { onClick: startFollowUpQueue, variant: "ghost", style: { width: "100%", padding: "13px", fontSize: 13, marginBottom: 10 } },
                "\uD83D\uDCC5 Work Follow-Ups (" + stats.followUps + ")"),
            React.createElement(Btn, { onClick: function () { setView("list"); }, variant: "ghost", style: { width: "100%", padding: "13px", fontSize: 13, marginBottom: 20 } }, "\u2261 Browse Full List"),
            React.createElement("div", { style: { fontSize: 11, color: C.faint, textAlign: "center" } }, stats.total + " total leads \u00B7 synced live with your team"));
    }
    return React.createElement("div", { style: { maxWidth: 720, margin: "0 auto" } },
        showAddLead && React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
                setShowAddLead(false); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000CC", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
            React.createElement("div", { style: { background: C.card, borderRadius: 14, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", padding: "20px" } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white } }, "\u2795 Add New Lead"),
                    React.createElement("button", { onClick: function () { setShowAddLead(false); }, style: { background: "none", border: "none", color: C.dim, fontSize: 22, cursor: "pointer" } }, "\u2715")),
                React.createElement(TxtIn, { label: "Name *", value: newLead.name, onChange: function (v) { setNewLeadField("name", v); }, placeholder: "Contact or business name" }),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "Company", value: newLead.company, onChange: function (v) { setNewLeadField("company", v); }, placeholder: "Company name" }),
                    React.createElement(TxtIn, { label: "Contact Person", value: newLead.contact_person, onChange: function (v) { setNewLeadField("contact_person", v); }, placeholder: "Who to ask for" })),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "Phone", value: newLead.phone, onChange: function (v) { setNewLeadField("phone", v); }, type: "tel", placeholder: "404-000-0000" }),
                    React.createElement(TxtIn, { label: "Email", value: newLead.email, onChange: function (v) { setNewLeadField("email", v); }, type: "email", placeholder: "contact@email.com" })),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "City", value: newLead.city, onChange: function (v) { setNewLeadField("city", v); }, placeholder: "Atlanta" }),
                    React.createElement(TxtIn, { label: "State", value: newLead.state, onChange: function (v) { setNewLeadField("state", v.toUpperCase().substring(0, 2)); }, placeholder: "GA" })),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } },
                    React.createElement(TxtIn, { label: "Category", value: newLead.category, onChange: function (v) { setNewLeadField("category", v); }, placeholder: "e.g. Property Management" }),
                    React.createElement(TxtIn, { label: "Source", value: newLead.source, onChange: function (v) { setNewLeadField("source", v); }, placeholder: "Referral, cold call, web..." })),
                React.createElement(Lbl, null, "Priority"),
                React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 14 } }, ["Low", "Medium", "High"].map(function (p) {
                    return React.createElement("div", { key: p, onClick: function () { setNewLeadField("priority", p); }, style: { flex: 1, border: "1px solid " + (newLead.priority === p ? C.orange : C.border), borderRadius: 7, padding: "8px 4px", cursor: "pointer", background: newLead.priority === p ? C.orangeSoft : "transparent", textAlign: "center", fontSize: 11, fontWeight: 700, color: newLead.priority === p ? C.orange : C.dim } }, p);
                })),
                React.createElement(TxtIn, { label: "Service / Transport Needs", value: newLead.service_type, onChange: function (v) { setNewLeadField("service_type", v); }, placeholder: "What do they need moved/hauled?", rows: 2, voice: true }),
                React.createElement(TxtIn, { label: "Notes", value: newLead.notes, onChange: function (v) { setNewLeadField("notes", v); }, placeholder: "Pain points, context, anything useful for the next call...", rows: 2, voice: true }),
                addLeadErr && React.createElement("div", { style: { color: C.red, fontSize: 12, marginBottom: 10 } }, "\u26A0 " + addLeadErr),
                React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setShowAddLead(false); }, style: { flex: 1 } }, "Cancel"),
                    React.createElement(Btn, { onClick: submitNewLead, disabled: addingLead || !newLead.name.trim(), style: { flex: 2 } }, addingLead ? "Saving..." : "\u2713 Add Lead")))),
        React.createElement("button", { onClick: function () { setView("dashboard"); }, style: { background: "none", border: "none", color: C.dim, fontSize: 13, cursor: "pointer", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 } }, "\u2190 Dashboard"),
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4, gap: 10, flexWrap: "wrap" } },
            React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: C.white } }, "\uD83D\uDCCB Leads Board"),
            React.createElement(Btn, { onClick: function () { setShowAddLead(true); }, style: { padding: "8px 14px", fontSize: 12 } }, "\u2795 Add Lead")),
        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 16 } },
            "Calling as: ",
            React.createElement("strong", { style: { color: C.orange } }, callerName),
            " \u00B7 ",
            filtered.length,
            " leads shown \u00B7 ",
            stats.total,
            " total"),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8, marginBottom: 16 } }, [["Not Called", stats.notContacted, "#888"], ["Follow-Up", stats.followUps, C.orange], ["Interested", stats.interested, C.green], ["Booked", stats.booked, "#1DB954"]].map(function (s) {
            return React.createElement(Card, { key: s[0], style: { padding: "10px 12px", cursor: "pointer", border: statusFilter === s[0] ? "1.5px solid " + s[2] : "1px solid " + C.border }, onClick: function () { setStatusFilter(statusFilter === s[0] ? "All" : s[0]); } },
                React.createElement("div", { style: { fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 } }, s[0]),
                React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: s[2] } }, s[1]));
        })),
        React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" } },
            React.createElement("input", { value: search, onChange: function (e) { setSearch(e.target.value); setPage(0); }, placeholder: "Search name, city, category...", style: { flex: 1, minWidth: 180, background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.white, padding: "9px 12px", fontSize: 13, outline: "none", fontFamily: "inherit" } }),
            React.createElement("select", { value: catFilter, onChange: function (e) { setCatFilter(e.target.value); setPage(0); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.white, padding: "9px 12px", fontSize: 12, outline: "none", fontFamily: "inherit" } }, categories.map(function (c) { return React.createElement("option", { key: c, value: c }, c === "All" ? "All Categories" : c.length > 20 ? c.substring(0, 20) + "..." : c); })),
            React.createElement("select", { value: statusFilter, onChange: function (e) { setStatusFilter(e.target.value); setPage(0); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 8, color: C.white, padding: "9px 12px", fontSize: 12, outline: "none", fontFamily: "inherit" } }, statuses.map(function (s) { return React.createElement("option", { key: s, value: s }, s); }))),
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 } }, paged.map(function (lead) {
            var lastCall = Array.isArray(lead.notes_log) && lead.notes_log.length > 0 ? lead.notes_log[lead.notes_log.length - 1] : null;
            var sc = LEAD_STATUS_COLORS[lead.status] || "#555";
            return React.createElement("div", { key: lead.id, onClick: function () { setQueueMode(""); setSelected(lead.id); setView("detail"); }, style: { background: C.card, border: "1px solid " + C.border, borderRadius: 9, padding: "12px 14px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 } },
                React.createElement("div", { style: { minWidth: 0, flex: 1 } },
                    React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, lead.name),
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } },
                        lead.category,
                        " \u00B7 ",
                        lead.city),
                    lastCall && React.createElement("div", { style: { fontSize: 10, color: C.faint, marginTop: 2 } },
                        lastCall.author,
                        " \u00B7 ",
                        new Date(lastCall.ts).toLocaleDateString())),
                React.createElement("div", { style: { flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 } },
                    React.createElement("div", { style: { background: sc + "22", color: sc, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700 } }, lead.status || "Not Contacted"),
                    lead.phone && React.createElement("div", { style: { fontSize: 10, color: C.dim } }, lead.phone)));
        })),
        totalPages > 1 && React.createElement("div", { style: { display: "flex", justifyContent: "center", gap: 8, alignItems: "center" } },
            React.createElement("button", { onClick: function () { setPage(function (p) { return Math.max(0, p - 1); }); }, disabled: page === 0, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 7, color: C.white, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit", opacity: page === 0 ? 0.3 : 1 } }, "\u2190 Prev"),
            React.createElement("span", { style: { fontSize: 12, color: C.dim } },
                page + 1,
                " / ",
                totalPages),
            React.createElement("button", { onClick: function () { setPage(function (p) { return Math.min(totalPages - 1, p + 1); }); }, disabled: page >= totalPages - 1, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 7, color: C.white, padding: "7px 14px", cursor: "pointer", fontFamily: "inherit", opacity: page >= totalPages - 1 ? 0.3 : 1 } }, "Next \u2192")));
}
// ═══════════════════════════════════════════════════════════════════
// ACTIVITY DASHBOARD — who is working, who is doing nothing
// ═══════════════════════════════════════════════════════════════════
function ActivityDashboard() {
    var [leads, setLeads] = useState([]);
    var [loading, setLoading] = useState(true);
    var [range, setRange] = useState("today");
    var [selected, setSelected] = useState(null);
    useEffect(function () {
        setLoading(true);
        sbLeads("GET", null, "select=*&limit=2000").then(function (data) {
            setLeads(Array.isArray(data) ? data : []);
            setLoading(false);
        }).catch(function () { setLoading(false); });
    }, []);
    function getRangeStart(r) {
        var now = new Date();
        if (r === "today") {
            var d = new Date(now);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        }
        if (r === "week") {
            var d2 = new Date(now);
            d2.setDate(d2.getDate() - 7);
            d2.setHours(0, 0, 0, 0);
            return d2.getTime();
        }
        if (r === "month") {
            var d3 = new Date(now.getFullYear(), now.getMonth(), 1);
            return d3.getTime();
        }
        return 0;
    }
    var rangeStart = getRangeStart(range);
    // Build per-rep stats from notes_log
    var repStats = {};
    leads.forEach(function (lead) {
        var log = Array.isArray(lead.notes_log) ? lead.notes_log : [];
        log.forEach(function (entry) {
            if (!entry.author)
                return;
            var name = entry.author;
            if (!repStats[name])
                repStats[name] = { name, calls: 0, callsToday: 0, noAnswer: 0, voicemail: 0, followUps: 0, interested: 0, booked: 0, notInterested: 0, lastActivity: 0, leadsContacted: new Set() };
            if (entry.ts >= rangeStart) {
                repStats[name].calls++;
                if (entry.outcome === "no_answer")
                    repStats[name].noAnswer++;
                if (entry.outcome === "voicemail")
                    repStats[name].voicemail++;
                if (entry.outcome === "follow_up")
                    repStats[name].followUps++;
                if (entry.outcome === "interested")
                    repStats[name].interested++;
                if (entry.outcome === "booked")
                    repStats[name].booked++;
                if (entry.outcome === "not_interested")
                    repStats[name].notInterested++;
                repStats[name].leadsContacted.add(lead.id);
            }
            if (entry.ts > repStats[name].lastActivity)
                repStats[name].lastActivity = entry.ts;
        });
    });
    var reps = Object.values(repStats).map(function (r) { return Object.assign({}, r, { leadsContacted: r.leadsContacted.size }); }).sort(function (a, b) { return b.calls - a.calls; });
    var totalCalls = reps.reduce(function (s, r) { return s + r.calls; }, 0);
    var totalBooked = reps.reduce(function (s, r) { return s + r.booked; }, 0);
    var totalInterested = reps.reduce(function (s, r) { return s + r.interested; }, 0);
    function timeAgo(ts) {
        if (!ts)
            return "Never";
        var diff = Date.now() - ts;
        var min = Math.floor(diff / 60000);
        if (min < 1)
            return "Just now";
        if (min < 60)
            return min + "m ago";
        var hr = Math.floor(min / 60);
        if (hr < 24)
            return hr + "h ago";
        return Math.floor(hr / 24) + "d ago";
    }
    // Detailed view for one rep
    if (selected) {
        var rep = reps.find(function (r) { return r.name === selected; });
        var repLeads = leads.filter(function (l) {
            return Array.isArray(l.notes_log) && l.notes_log.some(function (e) { return e.author === selected && e.ts >= rangeStart; });
        });
        return React.createElement("div", { style: { maxWidth: 680, margin: "0 auto" } },
            React.createElement("button", { onClick: function () { setSelected(null); }, style: { background: "none", border: "none", color: C.dim, fontSize: 13, cursor: "pointer", marginBottom: 14, display: "flex", alignItems: "center", gap: 6 } }, "\u2190 Back to team"),
            React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 4 } }, selected),
            React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 16 } },
                range === "today" ? "Today" : range === "week" ? "Last 7 days" : "This month",
                " \u00B7 Last activity: ",
                timeAgo(rep ? rep.lastActivity : 0)),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(110px,1fr))", gap: 8, marginBottom: 20 } }, [["Total Calls", rep ? rep.calls : 0, C.white], ["Leads Contacted", rep ? rep.leadsContacted : 0, C.blue], ["Follow-Ups", rep ? rep.followUps : 0, C.orange], ["Interested", rep ? rep.interested : 0, C.green], ["Booked", rep ? rep.booked : 0, "#1DB954"], ["No Answer", rep ? rep.noAnswer : 0, C.faint]].map(function (s) {
                return React.createElement(Card, { key: s[0], style: { padding: "10px 12px" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, marginBottom: 2, textTransform: "uppercase", letterSpacing: 0.8 } }, s[0]),
                    React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: s[2] } }, s[1]));
            })),
            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 10 } }, "Leads Worked"),
            repLeads.slice(0, 30).map(function (lead) {
                var myEntries = (lead.notes_log || []).filter(function (e) { return e.author === selected && e.ts >= rangeStart; });
                var lastEntry = myEntries[myEntries.length - 1];
                var oc = lastEntry ? CALL_OUTCOMES.find(function (o) { return o.key === lastEntry.outcome; }) : null;
                return React.createElement("div", { key: lead.id, style: { background: C.card, border: "1px solid " + C.border, borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white } }, lead.name),
                        React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                            lead.city,
                            " \u00B7 ",
                            myEntries.length,
                            " call",
                            myEntries.length !== 1 ? "s" : "")),
                    oc && React.createElement("div", { style: { background: oc.color + "22", color: oc.color, borderRadius: 4, padding: "2px 8px", fontSize: 10, fontWeight: 700 } }, oc.label));
            }));
    }
    if (loading)
        return React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: "60px 0", fontSize: 14 } }, "Loading activity data...");
    return React.createElement("div", { style: { maxWidth: 720, margin: "0 auto" } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 } },
            React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: C.white } }, "\uD83D\uDC65 Team Activity"),
            React.createElement("div", { style: { display: "flex", gap: 6 } }, [["today", "Today"], ["week", "7 Days"], ["month", "Month"]].map(function (r) {
                return React.createElement("button", { key: r[0], onClick: function () { setRange(r[0]); }, style: { border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", background: range === r[0] ? C.orange : "transparent", color: range === r[0] ? "#000" : C.dim, fontWeight: 700, fontFamily: "inherit", fontSize: 11 } }, r[1]);
            }))),
        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 16 } },
            range === "today" ? "Today" : range === "week" ? "Last 7 days" : "This month",
            " \u00B7 ",
            totalCalls,
            " total calls \u00B7 ",
            totalBooked,
            " booked"),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 } },
            React.createElement(Card, { style: { padding: "12px 14px" } },
                React.createElement("div", { style: { fontSize: 10, color: C.dim, marginBottom: 2 } }, "TOTAL CALLS"),
                React.createElement("div", { style: { fontSize: 26, fontWeight: 900, color: C.white } }, totalCalls)),
            React.createElement(Card, { style: { padding: "12px 14px" } },
                React.createElement("div", { style: { fontSize: 10, color: C.dim, marginBottom: 2 } }, "INTERESTED"),
                React.createElement("div", { style: { fontSize: 26, fontWeight: 900, color: C.green } }, totalInterested)),
            React.createElement(Card, { style: { padding: "12px 14px" } },
                React.createElement("div", { style: { fontSize: 10, color: C.dim, marginBottom: 2 } }, "BOOKED"),
                React.createElement("div", { style: { fontSize: 26, fontWeight: 900, color: "#1DB954" } }, totalBooked))),
        reps.length === 0 ? React.createElement("div", { style: { textAlign: "center", padding: "40px 0", color: C.dim, fontSize: 13 } }, "No call activity logged yet for this period. Activity is tracked automatically when dispatch logs calls in the Leads tab.")
            : React.createElement("div", null,
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr 1.2fr", gap: 8, padding: "8px 12px", marginBottom: 6 } }, ["NAME", "CALLS", "CONTACTED", "FOLLOW-UPS", "INTERESTED", "BOOKED", "LAST ACTIVE"].map(function (h) {
                    return React.createElement("div", { key: h, style: { fontSize: 9, color: C.faint, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 } }, h);
                })),
                reps.map(function (rep) {
                    var isInactive = range === "today" && rep.calls === 0;
                    var lastActiveMs = rep.lastActivity;
                    var noActivityToday = range === "today" && rep.calls === 0;
                    return React.createElement("div", { key: rep.name, onClick: function () { setSelected(rep.name); }, style: { display: "grid", gridTemplateColumns: "1.5fr 1fr 1fr 1fr 1fr 1fr 1.2fr", gap: 8, padding: "12px", background: noActivityToday ? C.red + "08" : C.card, border: "1px solid " + (noActivityToday ? C.red + "33" : C.border), borderRadius: 9, marginBottom: 6, cursor: "pointer", alignItems: "center" } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: noActivityToday ? C.red : C.white } }, rep.name),
                            noActivityToday && React.createElement("div", { style: { fontSize: 9, color: C.red, fontWeight: 700 } }, "\u26A0 NO ACTIVITY")),
                        React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: rep.calls > 0 ? C.white : C.faint } }, rep.calls),
                        React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: rep.leadsContacted > 0 ? C.blue : C.faint } }, rep.leadsContacted),
                        React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: rep.followUps > 0 ? C.orange : C.faint } }, rep.followUps),
                        React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: rep.interested > 0 ? C.green : C.faint } }, rep.interested),
                        React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: rep.booked > 0 ? "#1DB954" : C.faint } }, rep.booked),
                        React.createElement("div", { style: { fontSize: 11, color: lastActiveMs > Date.now() - 3600000 ? C.green : lastActiveMs > Date.now() - 86400000 ? C.orange : C.faint } }, timeAgo(lastActiveMs)));
                })),
        React.createElement("div", { style: { marginTop: 20 } },
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 8 } }, "\uD83D\uDCCA How Activity Is Tracked"),
                React.createElement("div", { style: { fontSize: 11, color: C.dim, lineHeight: 1.8 } }, "Every call logged in the Leads tab automatically records: who called, what the outcome was, and when. Tap any rep row to see their detailed call history. Rows highlighted in red mean no calls logged for the selected period."))));
}
// ═══════════════════════════════════════════════════════════════════
// 🏆 LEADERBOARD — Sales Competition Board
// Visible to all dispatchers. Auto-calculated from real data.
// ═══════════════════════════════════════════════════════════════════
function LeaderBoard(props) {
    var currentUser = props.currentUser;
    var [leads, setLeads] = useState([]);
    var [jobs, setJobs] = useState([]);
    var [range, setRange] = useState("month");
    var [loading, setLoading] = useState(true);
    var [prize, setPrize] = useState("$500 Cash Bonus");
    var [goal, setGoal] = useState("$100,000");
    var isOwner = currentUser && currentUser.role === "owner";
    useEffect(function () {
        setLoading(true);
        // Load leads from Supabase
        fetch(SUPABASE_URL + "/rest/v1/leads?select=*&limit=2000", {
            headers: { apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY }
        }).then(function (r) { return r.json(); }).then(function (data) {
            setLeads(Array.isArray(data) ? data : []);
        }).catch(function () { });
        // Load jobs from localStorage
        setJobs(loadJobs());
        setLoading(false);
    }, []);
    function getRangeStart(r) {
        var now = new Date();
        if (r === "today") {
            var d = new Date(now);
            d.setHours(0, 0, 0, 0);
            return d.getTime();
        }
        if (r === "week") {
            var d2 = new Date(now);
            d2.setDate(d2.getDate() - 7);
            return d2.getTime();
        }
        if (r === "month") {
            var d3 = new Date(now.getFullYear(), now.getMonth(), 1);
            return d3.getTime();
        }
        return 0;
    }
    var rangeStart = getRangeStart(range);
    // Build per-rep stats from leads
    var repStats = {};
    leads.forEach(function (lead) {
        var log = Array.isArray(lead.notes_log) ? lead.notes_log : [];
        log.forEach(function (entry) {
            if (!entry.author || entry.ts < rangeStart)
                return;
            var n = entry.author;
            if (!repStats[n])
                repStats[n] = { name: n, calls: 0, followUps: 0, interested: 0, booked: 0, noAnswer: 0, leadsContacted: new Set() };
            repStats[n].calls++;
            repStats[n].leadsContacted.add(lead.id);
            if (entry.outcome === "follow_up")
                repStats[n].followUps++;
            if (entry.outcome === "interested")
                repStats[n].interested++;
            if (entry.outcome === "booked")
                repStats[n].booked++;
            if (entry.outcome === "no_answer")
                repStats[n].noAnswer++;
        });
    });
    // Add job booking stats
    jobs.forEach(function (job) {
        if (!job.salesperson && !job.createdBy)
            return;
        var n = job.salesperson || job.createdBy;
        var jobDate = new Date(job.date || job.createdAt || Date.now()).getTime();
        if (jobDate < rangeStart)
            return;
        if (!repStats[n])
            repStats[n] = { name: n, calls: 0, followUps: 0, interested: 0, booked: 0, noAnswer: 0, leadsContacted: new Set(), jobsBooked: 0, revenue: 0 };
        repStats[n].jobsBooked = (repStats[n].jobsBooked || 0) + 1;
        repStats[n].revenue = (repStats[n].revenue || 0) + (job.finalPrice || 0);
    });
    var reps = Object.values(repStats).map(function (r) {
        var commission = ((r.revenue || 0) * 0.125);
        // Score: revenue is king, then jobs booked, then leads activity
        var revenuePoints = Math.floor((r.revenue || 0) / 10);
        var score = (r.jobsBooked || 0) * 200 + (r.booked || 0) * 50 + (r.interested || 0) * 20 + (r.followUps || 0) * 5 + (r.calls || 0) * 1 + revenuePoints;
        return Object.assign({}, r, { leadsContacted: r.leadsContacted ? r.leadsContacted.size : 0, commission, score });
    }).sort(function (a, b) { return b.score - a.score; });
    var totalRevenue = reps.reduce(function (s, r) { return s + (r.revenue || 0); }, 0);
    var totalCalls = reps.reduce(function (s, r) { return s + r.calls; }, 0);
    var totalBooked = reps.reduce(function (s, r) { return s + (r.booked || 0); }, 0);
    var medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
    var podiumColors = ["#F0E000", "#888", "#C8962A"];
    return React.createElement("div", { style: { maxWidth: 760, margin: "0 auto", fontFamily: "'DM Sans','Segoe UI',sans-serif" } },
        React.createElement("div", { style: { textAlign: "center", marginBottom: 20 } },
            React.createElement("div", { style: { fontSize: 32, marginBottom: 4 } }, "\uD83C\uDFC6"),
            React.createElement("div", { style: { fontSize: 24, fontWeight: 900, color: C.white } }, "POTENT LEADERBOARD"),
            React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 12 } }, "Real-time \u00B7 Auto-tracked \u00B7 No manual entry"),
            React.createElement("div", { style: { display: "flex", gap: 6, justifyContent: "center" } }, [["today", "Today"], ["week", "This Week"], ["month", "This Month"]].map(function (r) {
                return React.createElement("button", { key: r[0], onClick: function () { setRange(r[0]); }, style: { border: "none", borderRadius: 7, padding: "6px 14px", cursor: "pointer", background: range === r[0] ? C.orange : "transparent", color: range === r[0] ? "#000" : C.dim, fontWeight: 700, fontFamily: "inherit", fontSize: 11 } }, r[1]);
            }))),
        React.createElement("div", { style: { background: "linear-gradient(135deg,#1a1a00,#2a2400)", border: "2px solid " + C.orange, borderRadius: 14, padding: "16px 20px", marginBottom: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 } },
            React.createElement("div", null,
                React.createElement("div", { style: { fontSize: 11, color: C.orange, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.5, marginBottom: 4 } }, "\uD83C\uDFAF Current Prize"),
                React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: C.white } }, prize),
                React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2 } },
                    "Goal: ",
                    goal,
                    " revenue this period")),
            React.createElement("div", { style: { textAlign: "center" } },
                React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 4 } }, "Team Revenue"),
                React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C.green } }, "$" + totalRevenue.toLocaleString()),
                React.createElement("div", { style: { width: 200, height: 8, background: C.border, borderRadius: 4, marginTop: 6 } },
                    React.createElement("div", { style: { width: Math.min(100, Math.round(totalRevenue / Number(goal.replace(/[^0-9]/g, "")) * 100)) + "%", height: "100%", background: C.green, borderRadius: 4, transition: "width 0.5s" } })),
                React.createElement("div", { style: { fontSize: 10, color: C.dim, marginTop: 2 } },
                    Math.min(100, Math.round(totalRevenue / Number(goal.replace(/[^0-9]/g, "")) * 100)),
                    "% of goal")),
            isOwner && React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
                React.createElement("input", { value: prize, onChange: function (e) { setPrize(e.target.value); }, placeholder: "Prize name", style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 7, color: C.white, padding: "6px 10px", fontSize: 12, outline: "none", fontFamily: "inherit" } }),
                React.createElement("input", { value: goal, onChange: function (e) { setGoal(e.target.value); }, placeholder: "Revenue goal", style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 7, color: C.white, padding: "6px 10px", fontSize: 12, outline: "none", fontFamily: "inherit" } }))),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 } }, [["Total Calls", totalCalls, C.white], ["Jobs Booked", reps.reduce(function (s, r) { return s + (r.jobsBooked || 0); }, 0), "#1DB954"], ["Team Revenue", "$" + totalRevenue.toLocaleString(), C.orange]].map(function (s) {
            return React.createElement(Card, { key: s[0], style: { padding: "12px", textAlign: "center" } },
                React.createElement("div", { style: { fontSize: 10, color: C.dim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 4 } }, s[0]),
                React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: s[2] } }, s[1]));
        })),
        reps.length >= 1 && React.createElement("div", { style: { marginBottom: 20 } },
            React.createElement("div", { style: { fontSize: 11, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 10, textAlign: "center" } }, "Top Performers"),
            React.createElement("div", { style: { display: "flex", gap: 10, justifyContent: "center", alignItems: "flex-end" } },
                reps.length >= 2 && React.createElement("div", { style: { textAlign: "center", flex: 1, maxWidth: 180 } },
                    React.createElement("div", { style: { fontSize: 28, marginBottom: 4 } }, "\uD83E\uDD48"),
                    React.createElement("div", { style: { background: C.card, border: "2px solid #888", borderRadius: 12, padding: "16px 12px", borderBottom: "4px solid #888" } },
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 4 } }, reps[1].name),
                        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: "#888" } },
                            reps[1].score,
                            React.createElement("span", { style: { fontSize: 10, color: C.dim } }, " pts")),
                        React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: "#888", marginTop: 4 } },
                            reps[1].jobsBooked || 0,
                            " jobs \u00B7 $",
                            (reps[1].revenue || 0).toLocaleString()),
                        React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                            reps[1].calls,
                            " calls"))),
                React.createElement("div", { style: { textAlign: "center", flex: 1, maxWidth: 220 } },
                    React.createElement("div", { style: { fontSize: 36, marginBottom: 4 } }, "\uD83E\uDD47"),
                    React.createElement("div", { style: { background: "linear-gradient(180deg,#2a2400,#1a1a00)", border: "2px solid " + C.orange, borderRadius: 12, padding: "20px 12px", borderBottom: "4px solid " + C.orange } },
                        React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.white, marginBottom: 4 } }, reps[0].name),
                        React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C.orange } },
                            reps[0].score,
                            React.createElement("span", { style: { fontSize: 12, color: C.dim } }, " pts")),
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 900, color: C.green, marginTop: 4 } },
                            "$",
                            (reps[0].revenue || 0).toLocaleString()),
                        React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                            reps[0].jobsBooked || 0,
                            " jobs \u00B7 ",
                            reps[0].calls,
                            " calls"))),
                reps.length >= 3 && React.createElement("div", { style: { textAlign: "center", flex: 1, maxWidth: 180 } },
                    React.createElement("div", { style: { fontSize: 28, marginBottom: 4 } }, "\uD83E\uDD49"),
                    React.createElement("div", { style: { background: C.card, border: "2px solid #C8962A", borderRadius: 12, padding: "16px 12px", borderBottom: "4px solid #C8962A" } },
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 4 } }, reps[2].name),
                        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: "#C8962A" } },
                            reps[2].score,
                            React.createElement("span", { style: { fontSize: 10, color: C.dim } }, " pts")),
                        React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: "#C8962A", marginTop: 4 } },
                            reps[2].jobsBooked || 0,
                            " jobs \u00B7 $",
                            (reps[2].revenue || 0).toLocaleString()),
                        React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                            reps[2].calls,
                            " calls"))))),
        React.createElement(Card, { style: { padding: 0, overflow: "hidden" } },
            React.createElement("div", { style: { padding: "12px 16px", borderBottom: "1px solid " + C.border } },
                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, "Full Rankings"),
                React.createElement("div", { style: { fontSize: 10, color: C.dim, marginTop: 2 } }, "Score = Revenue(\u00F710) + Jobs Booked(\u00D7200) + Lead Booked(\u00D750) + Interested(\u00D720) + Follow-Up(\u00D75) + Calls(\u00D71)")),
            loading ? React.createElement("div", { style: { padding: 20, textAlign: "center", color: C.dim, fontSize: 12 } }, "Loading...")
                : reps.length === 0 ? React.createElement("div", { style: { padding: 20, textAlign: "center", color: C.dim, fontSize: 12 } }, "No activity logged yet. Start calling leads to appear on the board.")
                    : reps.map(function (rep, i) {
                        var isMe = currentUser && currentUser.name === rep.name;
                        return React.createElement("div", { key: rep.name, style: { display: "grid", gridTemplateColumns: "36px 1.4fr 70px 60px 70px 90px 80px", alignItems: "center", gap: 6, padding: "12px 16px", borderBottom: "1px solid " + C.border, background: isMe ? C.orange + "08" : "transparent" } },
                            React.createElement("div", { style: { fontSize: i < 3 ? 20 : 13, fontWeight: 700, color: i === 0 ? C.orange : i === 1 ? "#888" : i === 2 ? "#C8962A" : C.faint, textAlign: "center" } }, medals[i] || String(i + 1)),
                            React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: isMe ? C.orange : C.white } },
                                    rep.name,
                                    isMe ? " (you)" : ""),
                                React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                                    rep.leadsContacted,
                                    " leads contacted")),
                            React.createElement("div", { style: { textAlign: "center" } },
                                React.createElement("div", { style: { fontSize: 13, fontWeight: 900, color: (rep.jobsBooked || 0) > 0 ? C.orange : C.faint } }, rep.jobsBooked || 0),
                                React.createElement("div", { style: { fontSize: 9, color: C.faint } }, "jobs")),
                            React.createElement("div", { style: { textAlign: "center" } },
                                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white } }, rep.calls),
                                React.createElement("div", { style: { fontSize: 9, color: C.faint } }, "calls")),
                            React.createElement("div", { style: { textAlign: "center" } },
                                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: rep.interested > 0 ? C.green : C.faint } }, rep.interested || 0),
                                React.createElement("div", { style: { fontSize: 9, color: C.faint } }, "interested")),
                            React.createElement("div", { style: { textAlign: "center" } },
                                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: rep.booked > 0 ? "#1DB954" : C.faint } }, rep.booked || 0),
                                React.createElement("div", { style: { fontSize: 9, color: C.faint } }, "booked")),
                            React.createElement("div", { style: { textAlign: "right" } },
                                React.createElement("div", { style: { fontSize: 12, fontWeight: 900, color: (rep.revenue || 0) > 0 ? C.green : C.faint } }, (rep.revenue || 0) > 0 ? "$" + (rep.revenue || 0).toLocaleString() : "—"),
                                React.createElement("div", { style: { fontSize: 9, color: C.faint } }, "revenue")),
                            React.createElement("div", { style: { textAlign: "right" } },
                                React.createElement("div", { style: { fontSize: 14, fontWeight: 900, color: C.orange } }, rep.score),
                                React.createElement("div", { style: { fontSize: 9, color: C.faint } }, "pts")));
                    })),
        React.createElement("div", { style: { marginTop: 16, background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: "12px 16px" } },
            React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.dim, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 } }, "How Points Are Earned"),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } }, [["📞 Call logged", "1 pt"], ["📅 Follow-up set", "5 pts"], ["✅ Interested", "20 pts"], ["🎉 Lead Booked", "50 pts"], ["💼 Job Booked", "200 pts"], ["💰 Revenue", "1 pt per $10"]].map(function (item) {
                return React.createElement("div", { key: item[0], style: { display: "flex", justifyContent: "space-between", fontSize: 11, color: C.dim, padding: "4px 0", borderBottom: "1px solid " + C.border } },
                    React.createElement("span", null, item[0]),
                    React.createElement("span", { style: { fontWeight: 700, color: C.orange } }, item[1]));
            })),
            React.createElement("div", { style: { fontSize: 10, color: C.faint, marginTop: 8 } }, "All tracked automatically. No manual entry. Points update in real time as calls are logged.")));
}
// ═══════════════════════════════════════════════════════════════════
// 💰 PAYROLL DASHBOARD
// Owner sees: all reps, their rates, what they're owed, mark paid
// Employees see: only their own earnings
// Commission is auto-calculated from jobs they booked (salesperson/createdBy field)
// ═══════════════════════════════════════════════════════════════════
function PayrollDashboard(props) {
    var currentUser = props.currentUser;
    var users = props.users || [];
    var isOwner = currentUser && currentUser.role === "owner";
    var [jobs, setJobs] = useState([]);
    var [period, setPeriod] = useState("month");
    var [paid, setPaid] = useState({});
    var [editRates, setEditRates] = useState(false);
    var [editingEmp, setEditingEmp] = useState(null);
    var [payAmounts, setPayAmounts] = useState({});
    function setPayAmountFor(uid, val) {
        setPayAmounts(function (p) { var n = Object.assign({}, p); n[uid] = val; return n; });
    }
    var [showDDFor, setShowDDFor] = useState({});
    function toggleShowDD(uid) {
        setShowDDFor(function (p) { var n = Object.assign({}, p); n[uid] = !n[uid]; return n; });
    }
    // Revoked-access list — separate from "Terminate" above (which only
    // affects the payroll display locally). This is the real, synced block
    // that actually stops someone from logging back in on any device.
    var [revokedVersion, setRevokedVersion] = useState(0);
    useEffect(function () { loadRevokedFromServer().then(function () { setRevokedVersion(function (v) { return v + 1; }); }); }, []);
    function handleRevoke(u) {
        if (!confirm("Revoke " + getEmpName(u) + "'s access? They will be logged out (within 60s if already logged in) and won't be able to log back in with their password until you restore access."))
            return;
        revokeAccess(u.id, currentUser ? currentUser.name : "", "Revoked from Payroll").then(function () { setRevokedVersion(function (v) { return v + 1; }); });
    }
    function handleRestore(u) {
        restoreAccess(u.id).then(function () { setRevokedVersion(function (v) { return v + 1; }); });
    }
    // ── Payroll security code — gates any actual payout action ────────
    var [payrollUnlocked, setPayrollUnlocked] = useState(false);
    var [showUnlockPrompt, setShowUnlockPrompt] = useState(false);
    var [unlockInput, setUnlockInput] = useState("");
    var [unlockErr, setUnlockErr] = useState(false);
    var [showSetCode, setShowSetCode] = useState(false);
    var [newCodeInput, setNewCodeInput] = useState("");
    var [codeSavedMsg, setCodeSavedMsg] = useState("");
    var hasCodeSet = !!loadPayrollCode();
    function attemptUnlock() {
        var stored = loadPayrollCode();
        if (!stored) {
            // No code set yet — owner must set one first before paying anyone.
            setUnlockErr(false);
            setShowUnlockPrompt(false);
            setShowSetCode(true);
            return;
        }
        if (unlockInput === stored) {
            setPayrollUnlocked(true);
            setShowUnlockPrompt(false);
            setUnlockInput("");
            setUnlockErr(false);
        }
        else {
            setUnlockErr(true);
            setUnlockInput("");
        }
    }
    function saveNewPayrollCode() {
        if (!newCodeInput || newCodeInput.length < 4)
            return;
        savePayrollCode(newCodeInput);
        setNewCodeInput("");
        setShowSetCode(false);
        setCodeSavedMsg("\u2705 Payroll code set. You'll need it to mark any payout as paid.");
        setTimeout(function () { setCodeSavedMsg(""); }, 4000);
    }
    var [rates, setRates] = useState(function () {
        try {
            var r = localStorage.getItem("pl_commission_rates");
            return r ? JSON.parse(r) : {};
        }
        catch (e) {
            return {};
        }
    });
    var [empSettings, setEmpSettings] = useState(function () {
        try {
            var e = localStorage.getItem("pl_emp_settings");
            return e ? JSON.parse(e) : {};
        }
        catch (e) {
            return {};
        }
    });
    function saveEmpSettings(settings) {
        setEmpSettings(settings);
        try {
            localStorage.setItem("pl_emp_settings", JSON.stringify(settings));
        }
        catch (e) { }
    }
    function getEmp(uid) { return empSettings[uid] || {}; }
    function setEmpField(uid, field, val) {
        var s = Object.assign({}, empSettings);
        s[uid] = Object.assign({}, s[uid] || {});
        s[uid][field] = val;
        saveEmpSettings(s);
    }
    function getEmpName(u) { return getEmp(u.id).name || u.name; }
    function isTerminated(u) { return getEmp(u.id).status === "terminated"; }
    useEffect(function () { setJobs(loadJobs()); }, []);
    function getRangeStart(p) {
        var now = new Date();
        if (p === "week") {
            var d = new Date(now);
            d.setDate(d.getDate() - 7);
            return d.toISOString().split("T")[0];
        }
        if (p === "month") {
            return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
        }
        if (p === "quarter") {
            var m = now.getMonth() - 2;
            var q = new Date(now.getFullYear(), Math.max(0, m), 1);
            return q.toISOString().split("T")[0];
        }
        if (p === "alltime")
            return "2020-01-01";
        return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    }
    var rangeStart = getRangeStart(period);
    // Build per-rep earnings from jobs
    var repEarnings = {};
    var dispatchUsers = users.filter(function (u) { return u.id !== "potent" && !isTerminated(u); });
    var allEmpUsers = users.filter(function (u) { return u.id !== "potent"; });
    dispatchUsers.forEach(function (u) {
        var logRate = rates[u.id + "_log"] !== undefined ? rates[u.id + "_log"] : u.commLogistics || u.commission || 0.125;
        var osRate = rates[u.id + "_os"] !== undefined ? rates[u.id + "_os"] : u.commOS || 0.10;
        var lbRate = rates[u.id + "_lb"] !== undefined ? rates[u.id + "_lb"] : u.commLoadboard || 0.10;
        var empName = getEmpName(u);
        var myJobs = jobs.filter(function (j) {
            var rep = j.salesperson || j.createdBy || "";
            return (rep === u.name || rep === empName) && (j.status === "Paid" || j.status === "Completed") && (j.date || "") >= rangeStart;
        });
        var logJobs = myJobs.filter(function (j) { return !j.isOS && !j.isLoadboard; });
        var osJobs = myJobs.filter(function (j) { return j.isOS; });
        var lbJobs = myJobs.filter(function (j) { return j.isLoadboard; });
        var logRev = logJobs.reduce(function (s, j) { return s + (j.finalPrice || 0); }, 0);
        var osRev = osJobs.reduce(function (s, j) { return s + (j.finalPrice || 0); }, 0);
        var lbRev = lbJobs.reduce(function (s, j) { return s + (j.finalPrice || 0); }, 0);
        var revenue = logRev + osRev + lbRev;
        var commission = Math.round((logRev * logRate + osRev * osRate + lbRev * lbRate) * 100) / 100;
        var paidKey = u.id + "_" + period;
        var alreadyPaid = paid[paidKey] || 0;
        var outstanding = Math.max(0, commission - alreadyPaid);
        var empData = getEmp(u.id);
        var payType = empData.payType || "commission";
        var hourlyRate = Number(empData.hourlyRate || 0);
        var salaryAmount = Number(empData.salaryAmount || 0);
        var hoursWorked = Number(empData.hoursWorked || 0);
        var extraPay = payType === "hourly" ? (hourlyRate * hoursWorked) : payType === "salary" ? salaryAmount : 0;
        var totalPay = commission + extraPay;
        repEarnings[u.id] = { user: u, logRate, osRate, lbRate, jobs: myJobs.length, revenue, logRev, osRev, lbRev, commission, extraPay, totalPay, payType, hourlyRate, salaryAmount, hoursWorked, alreadyPaid, outstanding: Math.max(0, totalPay - alreadyPaid), empName: getEmpName(u) };
    });
    var totalRevenue = Object.values(repEarnings).reduce(function (s, r) { return s + r.revenue; }, 0);
    var totalOwed = Object.values(repEarnings).reduce(function (s, r) { return s + r.outstanding; }, 0);
    var totalPaid = Object.values(repEarnings).reduce(function (s, r) { return s + r.alreadyPaid; }, 0);
    function saveRate(userId, type, val) {
        var newRates = Object.assign({}, rates);
        newRates[userId + "_" + type] = Number(val);
        setRates(newRates);
        try {
            localStorage.setItem("pl_commission_rates", JSON.stringify(newRates));
        }
        catch (e) { }
    }
    function markPaid(userId, amount) {
        if (!payrollUnlocked) {
            setShowUnlockPrompt(true);
            return;
        }
        var paidKey = userId + "_" + period;
        var newPaid = Object.assign({}, paid);
        newPaid[paidKey] = (newPaid[paidKey] || 0) + Number(amount);
        setPaid(newPaid);
    }
    // If not owner, show only current user's data
    var myData = currentUser ? repEarnings[currentUser.id] : null;
    if (!isOwner && myData) {
        return React.createElement("div", { style: { maxWidth: 600, margin: "0 auto" } },
            React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 4 } }, "\uD83D\uDCB0 My Earnings"),
            React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 16 } }, "Your commission is calculated automatically from jobs you booked that have been marked Paid or Completed."),
            React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" } }, [["week", "This Week"], ["month", "This Month"], ["quarter", "This Quarter"], ["alltime", "All Time"]].map(function (p) {
                return React.createElement("button", { key: p[0], onClick: function () { setPeriod(p[0]); }, style: { border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", background: period === p[0] ? C.orange : "transparent", color: period === p[0] ? "#000" : C.dim, fontWeight: 700, fontFamily: "inherit", fontSize: 11 } }, p[1]);
            })),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 16 } },
                React.createElement(Card, { style: { padding: "14px", textAlign: "center" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, marginBottom: 2 } }, "JOBS BOOKED"),
                    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C.white } }, myData.jobs)),
                React.createElement(Card, { style: { padding: "14px", textAlign: "center" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, marginBottom: 2 } }, "REVENUE GENERATED"),
                    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C.orange } }, "$" + myData.revenue.toLocaleString())),
                React.createElement(Card, { style: { padding: "14px", textAlign: "center" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, marginBottom: 2 } }, "YOUR COMMISSION RATE"),
                    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C.green } }, Math.round(myData.rate * 100) + "%")),
                React.createElement(Card, { style: { padding: "14px", textAlign: "center" } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, marginBottom: 2 } }, "COMMISSION EARNED"),
                    React.createElement("div", { style: { fontSize: 28, fontWeight: 900, color: C.green } }, "$" + myData.commission.toLocaleString()))),
            myData.alreadyPaid > 0 && React.createElement("div", { style: { background: C.green + "18", border: "1px solid " + C.green + "44", borderRadius: 10, padding: "12px 16px", marginBottom: 12 } },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.green, marginBottom: 2 } }, "Already paid this period"),
                React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.green } }, "$" + myData.alreadyPaid.toLocaleString())),
            myData.outstanding > 0 && React.createElement("div", { style: { background: C.orange + "18", border: "2px solid " + C.orange + "44", borderRadius: 10, padding: "16px", textAlign: "center" } },
                React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 4 } }, "OUTSTANDING COMMISSION"),
                React.createElement("div", { style: { fontSize: 36, fontWeight: 900, color: C.orange } }, "$" + myData.outstanding.toLocaleString()),
                React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 4 } }, "Contact owner for payout")),
            React.createElement("div", { style: { marginTop: 16 } },
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 10 } }, "Jobs This Period"),
                myData.jobs === 0 && React.createElement("div", { style: { color: C.dim, fontSize: 12, textAlign: "center", padding: 20 } }, "No completed jobs found for this period."),
                jobs.filter(function (j) { var rep = j.salesperson || j.createdBy || ""; return rep === currentUser.name && (j.status === "Paid" || j.status === "Completed") && (j.date || "") >= rangeStart; }).slice(0, 20).map(function (job) {
                    var jComm = Math.round((job.finalPrice || 0) * myData.rate * 100) / 100;
                    return React.createElement("div", { key: job.id, style: { background: C.card, border: "1px solid " + C.border, borderRadius: 8, padding: "10px 14px", marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white } },
                                job.customer,
                                " \u2014 ",
                                job.serviceName),
                            React.createElement("div", { style: { fontSize: 10, color: C.dim } },
                                job.id,
                                " \u00B7 ",
                                job.date,
                                " \u00B7 ",
                                job.status)),
                        React.createElement("div", { style: { textAlign: "right" } },
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.orange } }, "$" + jComm.toLocaleString()),
                            React.createElement("div", { style: { fontSize: 10, color: C.dim } }, "$" + (job.finalPrice || 0).toLocaleString() + " × " + Math.round(myData.rate * 100) + "%")));
                })));
    }
    // OWNER VIEW
    return React.createElement("div", { style: { maxWidth: 760, margin: "0 auto" } },
        showUnlockPrompt && React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
                setShowUnlockPrompt(false); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000CC", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
            React.createElement("div", { style: { background: C.card, borderRadius: 14, width: "100%", maxWidth: 380, padding: "22px" } },
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 6 } }, "\uD83D\uDD10 Payroll Code Required"),
                React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 14 } }, "Enter the payroll security code to mark payouts as paid this session."),
                React.createElement("input", { type: "password", value: unlockInput, onChange: function (e) { setUnlockInput(e.target.value); }, placeholder: "Payroll code", autoFocus: true, style: { background: C.surface, border: "1px solid " + (unlockErr ? C.red : C.border), borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 15, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 10 }, onKeyDown: function (e) { if (e.key === "Enter")
                        attemptUnlock(); } }),
                unlockErr && React.createElement("div", { style: { color: C.red, fontSize: 12, marginBottom: 10 } }, "\u26A0 Wrong code."),
                React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setShowUnlockPrompt(false); setUnlockInput(""); setUnlockErr(false); }, style: { flex: 1 } }, "Cancel"),
                    React.createElement(Btn, { onClick: attemptUnlock, disabled: !unlockInput, style: { flex: 2 } }, "Unlock \u2192")))),
        showSetCode && React.createElement("div", { onClick: function (e) { if (e.target === e.currentTarget)
                setShowSetCode(false); }, style: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "#000000CC", zIndex: 600, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 } },
            React.createElement("div", { style: { background: C.card, borderRadius: 14, width: "100%", maxWidth: 380, padding: "22px" } },
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 6 } }, hasCodeSet ? "\uD83D\uDD10 Change Payroll Code" : "\uD83D\uDD10 Set Up Payroll Code"),
                React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 14 } }, "This code is separate from anyone's login password. Only you should know it. It's required before any payout can be marked paid."),
                React.createElement("input", { type: "password", value: newCodeInput, onChange: function (e) { setNewCodeInput(e.target.value); }, placeholder: "New payroll code (min 4 characters)", autoFocus: true, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 9, color: C.white, padding: "11px 14px", fontSize: 15, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", marginBottom: 12 } }),
                React.createElement("div", { style: { display: "flex", gap: 8 } },
                    React.createElement(Btn, { variant: "ghost", onClick: function () { setShowSetCode(false); setNewCodeInput(""); }, style: { flex: 1 } }, "Cancel"),
                    React.createElement(Btn, { onClick: saveNewPayrollCode, disabled: newCodeInput.length < 4, style: { flex: 2 } }, "\u2713 Save Code")))),
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 4 } },
            React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white } }, "\uD83D\uDCB0 Payroll Dashboard"),
            React.createElement("div", { style: { display: "flex", gap: 6, alignItems: "center" } },
                React.createElement("div", { style: { background: payrollUnlocked ? C.green + "22" : C.red + "22", color: payrollUnlocked ? C.green : C.red, borderRadius: 7, padding: "5px 10px", fontSize: 10, fontWeight: 700 } }, payrollUnlocked ? "\uD83D\uDD13 Unlocked" : "\uD83D\uDD12 Locked"),
                React.createElement("button", { onClick: function () { setShowSetCode(true); setNewCodeInput(""); }, style: { border: "1px solid " + C.border, borderRadius: 7, padding: "6px 12px", cursor: "pointer", background: "transparent", color: C.dim, fontWeight: 700, fontFamily: "inherit", fontSize: 11 } }, hasCodeSet ? "\uD83D\uDD10 Change Code" : "\uD83D\uDD10 Set Code"),
                React.createElement("button", { onClick: function () { setEditRates(!editRates); }, style: { border: "1px solid " + C.border, borderRadius: 7, padding: "6px 12px", cursor: "pointer", background: "transparent", color: editRates ? C.orange : C.dim, fontWeight: 700, fontFamily: "inherit", fontSize: 11 } }, editRates ? "✓ Done" : "✏ Rates"),
                React.createElement("button", { onClick: function () { setEditingEmp(editingEmp ? "" : "-"); }, style: { border: "1px solid " + C.border, borderRadius: 7, padding: "6px 12px", cursor: "pointer", background: editingEmp ? C.orange : "transparent", color: editingEmp ? "#000" : C.dim, fontWeight: 700, fontFamily: "inherit", fontSize: 11 } }, "\uD83D\uDC65 Manage"))),
        codeSavedMsg && React.createElement("div", { style: { background: C.green + "18", border: "1px solid " + C.green + "44", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: C.green, fontWeight: 700 } }, codeSavedMsg),
        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 16 } }, "Commission auto-calculated from jobs each rep booked that are marked Paid or Completed."),
        React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" } }, [["week", "This Week"], ["month", "This Month"], ["quarter", "This Quarter"], ["alltime", "All Time"]].map(function (p) {
            return React.createElement("button", { key: p[0], onClick: function () { setPeriod(p[0]); }, style: { border: "none", borderRadius: 7, padding: "6px 12px", cursor: "pointer", background: period === p[0] ? C.orange : "transparent", color: period === p[0] ? "#000" : C.dim, fontWeight: 700, fontFamily: "inherit", fontSize: 11 } }, p[1]);
        })),
        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 20 } }, [["Total Revenue", "$" + totalRevenue.toLocaleString(), C.orange], ["Commission Owed", "$" + totalOwed.toLocaleString(), C.red], ["Already Paid", "$" + totalPaid.toLocaleString(), C.green]].map(function (s) {
            return React.createElement(Card, { key: s[0], style: { padding: "12px", textAlign: "center" } },
                React.createElement("div", { style: { fontSize: 10, color: C.dim, marginBottom: 2 } }, s[0]),
                React.createElement("div", { style: { fontSize: 22, fontWeight: 900, color: s[2] } }, s[1]));
        })),
        editingEmp && React.createElement(Card, { style: { marginBottom: 16 } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } },
                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, "\uD83D\uDC65 Employee Management")),
            React.createElement("div", { style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 10, padding: "12px 14px", marginBottom: 14 } },
                React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.orange, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.8 } }, "\uD83D\uDD11 Login Credentials \u2014 Share With Staff"),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 } }, props.users && props.users.map(function (u) {
                    var empName = getEmpName(u);
                    var terminated = isTerminated(u);
                    if (terminated)
                        return null;
                    return React.createElement("div", { key: u.id, style: { background: C.card, border: "1px solid " + C.border, borderRadius: 7, padding: "8px 10px" } },
                        React.createElement("div", { style: { fontSize: 10, color: C.dim, marginBottom: 2 } },
                            u.emoji,
                            " ",
                            empName),
                        React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.white, fontFamily: "monospace", marginBottom: 1 } }, u.password),
                        React.createElement("div", { style: { fontSize: 9, color: C.faint } },
                            u.role,
                            " \u00B7 potentoperations.netlify.app"));
                })),
                React.createElement("div", { style: { fontSize: 9, color: C.faint, marginTop: 8 } }, "Tap copyright text at bottom of site to open login. Owner only sees this section.")),
            allEmpUsers.map(function (u) {
                var emp = getEmp(u.id);
                var terminated = emp.status === "terminated";
                return React.createElement("div", { key: u.id, style: { background: terminated ? C.surface + "88" : C.surface, border: "1px solid " + (terminated ? C.faint : C.border), borderRadius: 8, padding: "10px 12px", marginBottom: 8, opacity: terminated ? 0.6 : 1 } },
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 10px", marginBottom: 8 } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", marginBottom: 3 } }, "Display Name"),
                            React.createElement("input", { value: emp.name || u.name, onChange: function (e) { setEmpField(u.id, "name", e.target.value); saveNameOverride(u.id, e.target.value); }, style: { background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.white, padding: "6px 8px", fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } })),
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", marginBottom: 3 } }, "Hire Date"),
                            React.createElement("input", { type: "date", value: emp.hireDate || "", onChange: function (e) { setEmpField(u.id, "hireDate", e.target.value); }, style: { background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.white, padding: "6px 8px", fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" } }))),
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 10px", marginBottom: 8 } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", marginBottom: 3 } }, "Pay Type"),
                            React.createElement("select", { value: emp.payType || "commission", onChange: function (e) { setEmpField(u.id, "payType", e.target.value); }, style: { background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.white, padding: "6px 8px", fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit", colorScheme: "dark" } },
                                React.createElement("option", { value: "commission" }, "Commission Only"),
                                React.createElement("option", { value: "hourly" }, "Hourly + Commission"),
                                React.createElement("option", { value: "salary" }, "Salary + Commission"))),
                        (emp.payType === "hourly") && React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", marginBottom: 3 } }, "Hourly Rate ($)"),
                            React.createElement("input", { type: "number", value: emp.hourlyRate || "", onChange: function (e) { setEmpField(u.id, "hourlyRate", e.target.value); }, placeholder: "15.00", style: { background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.white, padding: "6px 8px", fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } })),
                        (emp.payType === "hourly") && React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", marginBottom: 3 } }, "Hours This Period"),
                            React.createElement("input", { type: "number", value: emp.hoursWorked || "", onChange: function (e) { setEmpField(u.id, "hoursWorked", e.target.value); }, placeholder: "40", style: { background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.white, padding: "6px 8px", fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } })),
                        (emp.payType === "salary") && React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", marginBottom: 3 } }, "Salary This Period ($)"),
                            React.createElement("input", { type: "number", value: emp.salaryAmount || "", onChange: function (e) { setEmpField(u.id, "salaryAmount", e.target.value); }, placeholder: "2000", style: { background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.white, padding: "6px 8px", fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } }))),
                    React.createElement("div", { style: { borderTop: "1px solid " + C.border, paddingTop: 8, marginTop: 4 } },
                        React.createElement("div", { style: { fontSize: 9, color: C.dim, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 6 } }, "\uD83D\uDCB3 Direct Deposit Info"),
                        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0 10px" } },
                            React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: 9, color: C.dim, marginBottom: 3 } }, "Bank Name"),
                                React.createElement("input", { value: emp.bankName || "", onChange: function (e) { setEmpField(u.id, "bankName", e.target.value); }, placeholder: "Chase, Wells Fargo...", style: { background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.white, padding: "6px 8px", fontSize: 11, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } })),
                            React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: 9, color: C.dim, marginBottom: 3 } }, "Routing Number"),
                                React.createElement("input", { value: emp.routingNum || "", onChange: function (e) { setEmpField(u.id, "routingNum", e.target.value.replace(/\D/g, "").substring(0, 9)); }, placeholder: "9 digits", maxLength: 9, style: { background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.white, padding: "6px 8px", fontSize: 11, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", fontFamily: "monospace" } })),
                            React.createElement("div", null,
                                React.createElement("div", { style: { fontSize: 9, color: C.dim, marginBottom: 3 } }, "Account Number"),
                                React.createElement("input", { value: emp.accountNum || "", onChange: function (e) { setEmpField(u.id, "accountNum", e.target.value.replace(/\D/g, "")); }, placeholder: "Account #", style: { background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.white, padding: "6px 8px", fontSize: 11, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", fontFamily: "monospace" } })))),
                    React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", marginTop: 8 } },
                        React.createElement("span", { style: { fontSize: 10, color: C.dim } },
                            u.emoji,
                            " ",
                            u.role,
                            " \u00B7 Login: ",
                            u.password),
                        emp.hireDate && React.createElement("span", { style: { fontSize: 10, color: C.dim } },
                            "Hired: ",
                            emp.hireDate),
                        React.createElement("div", { style: { marginLeft: "auto", display: "flex", gap: 6, flexWrap: "wrap" } },
                            !isUserRevoked(u.id) && React.createElement("button", { onClick: function () { handleRevoke(u); }, style: { background: C.red, border: "1px solid " + C.red, color: "#fff", borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" } }, "\uD83D\uDD12 Revoke Access"),
                            isUserRevoked(u.id) && React.createElement("button", { onClick: function () { handleRestore(u); }, style: { background: "transparent", border: "1px solid " + C.green, color: C.green, borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" } }, "\uD83D\uDD13 Restore Access"),
                            isUserRevoked(u.id) && React.createElement("span", { style: { fontSize: 10, color: C.red, fontWeight: 700, alignSelf: "center" } }, "ACCESS REVOKED"),
                            !terminated && React.createElement("button", { onClick: function () { if (confirm("Mark " + getEmpName(u) + " as No Longer With Us? (This only hides them from payroll \u2014 use Revoke Access above to actually block their login.)"))
                                    setEmpField(u.id, "status", "terminated"); }, style: { background: "transparent", border: "1px solid " + C.red, color: C.red, borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" } }, "\uD83D\uDEAB Terminate"),
                            terminated && React.createElement("button", { onClick: function () { setEmpField(u.id, "status", "active"); }, style: { background: "transparent", border: "1px solid " + C.green, color: C.green, borderRadius: 6, padding: "4px 10px", fontSize: 10, cursor: "pointer", fontWeight: 700, fontFamily: "inherit" } }, "\u2705 Reactivate"),
                            terminated && React.createElement("span", { style: { fontSize: 10, color: C.red, fontWeight: 700, alignSelf: "center" } }, "NO LONGER WITH US"))));
            })),
        Object.values(repEarnings).sort(function (a, b) { return b.revenue - a.revenue; }).map(function (rep) {
            var payAmount = payAmounts[rep.user.id] || "";
            var paidKey = rep.user.id + "_" + period;
            return React.createElement(Card, { key: rep.user.id, style: { marginBottom: 10 } },
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr auto", gap: 12, alignItems: "start" } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 800, color: C.white, marginBottom: 4 } },
                            rep.user.emoji,
                            " ",
                            rep.empName,
                            rep.empName !== rep.user.name ? React.createElement("span", { style: { fontSize: 10, color: C.faint, marginLeft: 6 } },
                                "(",
                                rep.user.name,
                                ")") : ""),
                        getEmp(rep.user.id).hireDate && React.createElement("div", { style: { fontSize: 10, color: C.dim, marginBottom: 4 } },
                            "Hired: ",
                            getEmp(rep.user.id).hireDate),
                        getEmp(rep.user.id).payType && getEmp(rep.user.id).payType !== "commission" && React.createElement("div", { style: { fontSize: 10, color: C.orange, marginBottom: 4 } }, getEmp(rep.user.id).payType === "hourly" ? "⏱ Hourly $" + getEmp(rep.user.id).hourlyRate + "/hr × " + getEmp(rep.user.id).hoursWorked + "hrs = $" + (Number(getEmp(rep.user.id).hourlyRate || 0) * Number(getEmp(rep.user.id).hoursWorked || 0)).toLocaleString() : "💼 Salary $" + Number(getEmp(rep.user.id).salaryAmount || 0).toLocaleString() + " this period"),
                        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(90px,1fr))", gap: 8, marginBottom: 10 } }, [["Jobs", rep.jobs, C.white], ["Logistics", "$" + (rep.logRev || 0).toLocaleString(), C.blue], ["POTENT OS", "$" + (rep.osRev || 0).toLocaleString(), "#9F7AEA"], ["Loadboard", "$" + (rep.lbRev || 0).toLocaleString(), C.green], ["Total Rev", "$" + rep.revenue.toLocaleString(), C.orange], ["Commission", "$" + rep.commission.toLocaleString(), C.green], ["Paid", "$" + rep.alreadyPaid.toLocaleString(), C.dim], ["Total Pay", "$" + (rep.totalPay || rep.commission).toLocaleString(), C.orange], ["Outstanding", "$" + rep.outstanding.toLocaleString(), rep.outstanding > 0 ? C.red : C.green]].map(function (s) {
                            return React.createElement("div", { key: s[0], style: { background: C.surface, borderRadius: 7, padding: "8px 10px" } },
                                React.createElement("div", { style: { fontSize: 9, color: C.faint, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 2 } }, s[0]),
                                React.createElement("div", { style: { fontSize: 15, fontWeight: 700, color: s[2] } }, s[1]));
                        })),
                        editRates && React.createElement("div", { style: { background: C.surface, borderRadius: 8, padding: "10px 12px", marginBottom: 8 } },
                            React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, marginBottom: 8, textTransform: "uppercase", letterSpacing: 0.8 } }, "Commission Rates"),
                            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 } }, [["Logistics", "log", rep.logRate], ["POTENT OS", "os", rep.osRate], ["Loadboard", "lb", rep.lbRate]].map(function (t) {
                                return React.createElement("div", { key: t[0] },
                                    React.createElement("div", { style: { fontSize: 9, color: C.dim, marginBottom: 3, textTransform: "uppercase" } }, t[0]),
                                    React.createElement("select", { value: rates[rep.user.id + "_" + t[1]] !== undefined ? rates[rep.user.id + "_" + t[1]] : t[2], onChange: function (e) { saveRate(rep.user.id, t[1], e.target.value); }, style: { background: C.card, border: "1px solid " + C.border, borderRadius: 6, color: C.white, padding: "5px 6px", fontSize: 12, outline: "none", fontFamily: "inherit", colorScheme: "dark", width: "100%" } }, [0.05, 0.08, 0.10, 0.125, 0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50].map(function (r) { return React.createElement("option", { key: r, value: r }, Math.round(r * 100) + "%"); })));
                            }))),
                        rep.outstanding > 0 && React.createElement("div", null,
                            React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 8 } },
                                React.createElement("input", { type: "number", value: payAmount, onChange: function (e) { setPayAmountFor(rep.user.id, e.target.value); }, placeholder: "Amount (max $" + rep.outstanding.toLocaleString() + ")", style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 7, color: C.white, padding: "7px 10px", fontSize: 12, outline: "none", fontFamily: "inherit", width: 180 } }),
                                React.createElement(Btn, { onClick: function () { if (!payAmount)
                                        return; markPaid(rep.user.id, payAmount); setPayAmountFor(rep.user.id, ""); }, style: { fontSize: 12, padding: "7px 14px" } }, "\u2713 Mark Paid"),
                                React.createElement(Btn, { onClick: function () { markPaid(rep.user.id, rep.outstanding); }, variant: "ghost", style: { fontSize: 12, padding: "7px 14px" } },
                                    "Pay Full $",
                                    rep.outstanding.toLocaleString())),
                            (function () {
                                var empData = getEmp(rep.user.id);
                                var hasBankInfo = empData.bankName && empData.routingNum && empData.accountNum;
                                var showDD = !!showDDFor[rep.user.id];
                                function setShowDD(v) { setShowDDFor(function (p) { var n = Object.assign({}, p); n[rep.user.id] = v; return n; }); }
                                return React.createElement("div", null,
                                    React.createElement("button", { onClick: function () { setShowDD(!showDD); }, style: { background: "transparent", border: "1px solid #4299E1", color: "#4299E1", borderRadius: 7, padding: "6px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" } },
                                        "\uD83D\uDCB3 ",
                                        hasBankInfo ? "Pay via Direct Deposit" : "Set Up Direct Deposit"),
                                    showDD && React.createElement("div", { style: { background: C.surface, border: "1px solid #4299E1", borderRadius: 9, padding: "14px", marginTop: 8 } }, hasBankInfo ? React.createElement("div", null,
                                        React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.white, marginBottom: 10 } },
                                            "Direct Deposit \u2014 ",
                                            rep.empName),
                                        React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 } },
                                            React.createElement("div", null,
                                                React.createElement("div", { style: { fontSize: 9, color: C.dim, marginBottom: 2 } }, "Bank"),
                                                React.createElement("div", { style: { fontSize: 12, color: C.white } }, empData.bankName)),
                                            React.createElement("div", null,
                                                React.createElement("div", { style: { fontSize: 9, color: C.dim, marginBottom: 2 } }, "Routing"),
                                                React.createElement("div", { style: { fontSize: 12, color: C.white, fontFamily: "monospace" } }, "•••••" + empData.routingNum.slice(-4))),
                                            React.createElement("div", null,
                                                React.createElement("div", { style: { fontSize: 9, color: C.dim, marginBottom: 2 } }, "Account"),
                                                React.createElement("div", { style: { fontSize: 12, color: C.white, fontFamily: "monospace" } }, "•••••" + empData.accountNum.slice(-4)))),
                                        React.createElement("div", { style: { background: "#4299E118", border: "1px solid #4299E144", borderRadius: 8, padding: "10px 14px", marginBottom: 10 } },
                                            React.createElement("div", { style: { fontSize: 11, color: "#4299E1", fontWeight: 700, marginBottom: 4 } }, "Payment Summary"),
                                            React.createElement("div", { style: { fontSize: 12, color: C.dim } },
                                                "Employee: ",
                                                React.createElement("strong", { style: { color: C.white } }, rep.empName)),
                                            React.createElement("div", { style: { fontSize: 12, color: C.dim } },
                                                "Amount: ",
                                                React.createElement("strong", { style: { color: C.orange } },
                                                    "$",
                                                    rep.outstanding.toLocaleString())),
                                            React.createElement("div", { style: { fontSize: 12, color: C.dim } },
                                                "Period: ",
                                                React.createElement("strong", { style: { color: C.white } }, period)),
                                            React.createElement("div", { style: { fontSize: 12, color: C.dim } },
                                                "Bank: ",
                                                React.createElement("strong", { style: { color: C.white } }, empData.bankName))),
                                        React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 10, lineHeight: 1.7 } }, "Log into your bank's online portal and initiate an ACH transfer using the routing and account numbers above. Once sent, mark it paid below."),
                                        React.createElement("div", { style: { background: "#00A97222", border: "1px solid #00A97244", borderRadius: 8, padding: "10px 14px", marginBottom: 10 } },
                                            React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: "#00A972", marginBottom: 4 } }, "\uD83D\uDFE2 Pay via Gusto (Recommended)"),
                                            React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 8, lineHeight: 1.6 } },
                                                "Gusto automates payroll, taxes, and direct deposit. Connect Gusto and pay ",
                                                rep.empName,
                                                " directly from the app with one click."),
                                            React.createElement("div", { style: { display: "flex", gap: 8, flexWrap: "wrap" } },
                                                React.createElement("a", { href: "https://gusto.com/invite", target: "_blank", rel: "noopener", style: { background: "#00A972", color: "#fff", border: "none", borderRadius: 7, padding: "7px 14px", fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block" } }, "Connect Gusto \u2192"),
                                                React.createElement("a", { href: "https://app.gusto.com", target: "_blank", rel: "noopener", style: { background: "transparent", color: "#00A972", border: "1px solid #00A972", borderRadius: 7, padding: "7px 12px", fontSize: 11, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-block" } }, "Open Gusto App")),
                                            React.createElement("div", { style: { fontSize: 9, color: C.faint, marginTop: 6 } }, "Gusto handles payroll taxes, W-2s, 1099s, and same-day direct deposit. ~$40/mo + $6/employee.")),
                                        React.createElement("div", { style: { display: "flex", gap: 8 } },
                                            React.createElement(Btn, { onClick: function () { markPaid(rep.user.id, rep.outstanding); setShowDD(false); }, style: { fontSize: 12, padding: "8px 16px" } },
                                                "\u2705 Mark as Paid \u2014 $",
                                                rep.outstanding.toLocaleString()),
                                            React.createElement(Btn, { onClick: function () { setShowDD(false); }, variant: "ghost", style: { fontSize: 12, padding: "8px 12px" } }, "Cancel"))) : React.createElement("div", null,
                                        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 8 } },
                                            "No bank info on file for ",
                                            rep.empName,
                                            ". Go to \uD83D\uDC65 Manage to add their direct deposit details."),
                                        React.createElement(Btn, { onClick: function () { setShowDD(false); setEditingEmp("-"); }, variant: "ghost", style: { fontSize: 12, padding: "7px 14px" } }, "Open Employee Manager"))));
                            })()),
                        rep.outstanding === 0 && rep.commission > 0 && React.createElement("div", { style: { fontSize: 11, color: C.green, fontWeight: 700 } }, "\u2705 Fully paid this period"))),
                rep.jobs > 0 && React.createElement("div", { style: { marginTop: 12, borderTop: "1px solid " + C.border, paddingTop: 10 } },
                    React.createElement("div", { style: { fontSize: 10, color: C.dim, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.8 } }, "Jobs This Period"),
                    jobs.filter(function (j) { var r = j.salesperson || j.createdBy || ""; return r === rep.user.name && (j.status === "Paid" || j.status === "Completed") && (j.date || "") >= rangeStart; }).map(function (job) {
                        var jComm = Math.round((job.finalPrice || 0) * rep.rate * 100) / 100;
                        return React.createElement("div", { key: job.id, style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid " + C.border, fontSize: 11 } },
                            React.createElement("span", { style: { color: C.dim } },
                                job.id,
                                " \u2014 ",
                                job.customer,
                                " \u2014 ",
                                job.serviceName,
                                " \u2014 ",
                                job.date),
                            React.createElement("div", { style: { textAlign: "right" } },
                                React.createElement("span", { style: { color: C.white, fontWeight: 600 } }, "$" + (job.finalPrice || 0).toLocaleString()),
                                React.createElement("span", { style: { color: C.green, marginLeft: 8 } },
                                    "\u2192 ",
                                    "$" + jComm.toLocaleString())));
                    })));
        }),
        React.createElement("div", { style: { marginTop: 12, fontSize: 10, color: C.faint, lineHeight: 1.6 } }, "Commission rates are saved on this device. To permanently store rates for each employee, the owner sets them here and they persist. Rates apply to all future pay periods."));
}
// ═══════════════════════════════════════════════════════════════════
// 🚗 FLEET MAINTENANCE
// ═══════════════════════════════════════════════════════════════════
var FLEET_KEY = "pl_fleet_vehicles";
var MAINT_KEY = "pl_fleet_maintenance";
function loadFleet() { try {
    return JSON.parse(localStorage.getItem(FLEET_KEY) || "[]");
}
catch (e) {
    return [];
} }
function saveFleet(v) { try {
    localStorage.setItem(FLEET_KEY, JSON.stringify(v));
}
catch (e) { } }
function loadMaint() { try {
    return JSON.parse(localStorage.getItem(MAINT_KEY) || "[]");
}
catch (e) {
    return [];
} }
function saveMaint(m) { try {
    localStorage.setItem(MAINT_KEY, JSON.stringify(m));
}
catch (e) { } }
function daysUntil(dateStr) {
    if (!dateStr)
        return null;
    var diff = new Date(dateStr).getTime() - Date.now();
    return Math.ceil(diff / 864e5);
}
function expiryColor(days) {
    if (days === null)
        return C.faint;
    if (days < 0)
        return C.red;
    if (days <= 30)
        return C.orange;
    return C.green;
}
function expiryLabel(days) {
    if (days === null)
        return "Not set";
    if (days < 0)
        return "EXPIRED " + Math.abs(days) + "d ago";
    if (days === 0)
        return "Expires TODAY";
    if (days <= 30)
        return days + "d left ⚠";
    return days + "d left";
}
// ── CMMS-AWARE DISPATCH ──────────────────────────────────────────────
// Checks a vehicle's maintenance/compliance fields for anything actually
// expired (not just "expiring soon" — that's a heads-up, this is a stop
// sign) so dispatch gets warned before assigning a job to a truck that
// shouldn't be on the road. Most dispatch software doesn't connect these
// two systems at all — assignment and maintenance stay siloed.
function getVehicleFlags(vehicle) {
    if (!vehicle)
        return { expired: [], expiringSoon: [] };
    var checks = [
        ["Registration", vehicle.regExpiry], ["Insurance", vehicle.insExpiry],
        ["Oil Change", vehicle.oilNext], ["Tire Rotation", vehicle.tireNext], ["Brake Inspection", vehicle.brakeNext],
    ];
    var expired = [];
    var expiringSoon = [];
    checks.forEach(function (c) {
        var days = daysUntil(c[1]);
        if (days === null)
            return;
        if (days < 0)
            expired.push(c[0]);
        else if (days <= 7)
            expiringSoon.push(c[0]); // tighter 7-day window here vs the 30-day fleet-tab heads-up — this is a live dispatch decision, not a maintenance calendar
    });
    return { expired: expired, expiringSoon: expiringSoon };
}
// ── HOS-AWARE JOB ASSIGNMENT — best-effort estimate, NOT an ELD ──────
// Real FMCSA rules (49 CFR 395, confirmed current for 2026): 11-hour
// driving limit after 10 consecutive hours off duty, 14-hour on-duty
// window, and 60hrs/7days or 70hrs/8days weekly caps. This app has no
// ELD or ECM connection, so it can only estimate based on job records
// already in the system (arrival/departure timestamps, or a rough
// per-job estimate when those aren't available). It's meant to catch
// obviously risky assignments before dispatch makes them — it is not a
// substitute for a real ELD and should never be treated as one during
// an actual roadside inspection.
var HOS_DAILY_DRIVE_LIMIT = 11 * 60; // minutes
var HOS_DAILY_WINDOW = 14 * 60; // minutes
var HOS_WEEKLY_LIMIT = 60 * 60; // minutes (7-day, the more conservative of 60/7 or 70/8)
function estimateJobMinutes(job) {
    // Best case: we have real arrivedAt + a later status timestamp. Since
    // this app only currently stamps arrivedAt (see Root's updateJob),
    // fall back to a flat per-job estimate for anything without richer
    // timing data — clearly better than nothing, clearly not exact.
    return 120; // 2 hours/job — conservative placeholder until per-job start/end timestamps exist on every status change
}
function getDriverHOSStatus(driverName, jobs, forDate) {
    var dateObj = forDate ? new Date(forDate) : new Date();
    var todayStr = dateObj.toISOString().split("T")[0];
    var weekAgo = new Date(dateObj);
    weekAgo.setDate(weekAgo.getDate() - 7);
    var weekAgoStr = weekAgo.toISOString().split("T")[0];
    var driverJobs = jobs.filter(function (j) {
        var assignedName = j.assignedDriverName || j.salesperson || "";
        return assignedName === driverName && j.status !== "Cancelled";
    });
    var todayJobs = driverJobs.filter(function (j) { return j.date === todayStr; });
    var weekJobs = driverJobs.filter(function (j) { return j.date >= weekAgoStr && j.date <= todayStr; });
    var todayMinutes = todayJobs.reduce(function (sum, j) { return sum + estimateJobMinutes(j); }, 0);
    var weekMinutes = weekJobs.reduce(function (sum, j) { return sum + estimateJobMinutes(j); }, 0);
    return {
        todayMinutes: todayMinutes, weekMinutes: weekMinutes,
        todayJobCount: todayJobs.length, weekJobCount: weekJobs.length,
        overDailyDrive: todayMinutes >= HOS_DAILY_DRIVE_LIMIT,
        nearDailyDrive: todayMinutes >= HOS_DAILY_DRIVE_LIMIT * 0.8,
        overWeekly: weekMinutes >= HOS_WEEKLY_LIMIT,
        nearWeekly: weekMinutes >= HOS_WEEKLY_LIMIT * 0.8,
    };
}
function FleetMaintenance() {
    var [vehicles, setVehicles] = useState(loadFleet);
    var [maintenance, setMaintenance] = useState(loadMaint);
    var [view, setView] = useState("list"); // list | add | detail | addmaint
    var [selected, setSelected] = useState(null);
    var [vForm, setVForm] = useState({ vin: "", make: "", model: "", year: "", plate: "", color: "", regExpiry: "", insExpiry: "", insPolicy: "", oilNext: "", tireNext: "", brakeNext: "" });
    var [mForm, setMForm] = useState({ type: "Oil Change", date: "", cost: "", notes: "", shop: "" });
    var [err, setErr] = useState("");
    function saveVehicle() {
        if (!vForm.make || !vForm.model || !vForm.year) {
            setErr("Make, model, and year required.");
            return;
        }
        var newV = Object.assign({}, vForm, { id: vForm.id || "VEH-" + Date.now(), createdAt: vForm.createdAt || new Date().toISOString() });
        var updated = vehicles.filter(function (v) { return v.id !== newV.id; });
        updated.push(newV);
        saveFleet(updated);
        setVehicles(updated);
        setView("list");
        setVForm({ vin: "", make: "", model: "", year: "", plate: "", color: "", regExpiry: "", insExpiry: "", insPolicy: "", oilNext: "", tireNext: "", brakeNext: "" });
        setErr("");
    }
    function deleteVehicle(id) {
        if (!confirm("Delete this vehicle?"))
            return;
        var updated = vehicles.filter(function (v) { return v.id !== id; });
        saveFleet(updated);
        setVehicles(updated);
        var updatedM = maintenance.filter(function (m) { return m.vehicleId !== id; });
        saveMaint(updatedM);
        setMaintenance(updatedM);
        setView("list");
    }
    function addMaintRecord() {
        if (!mForm.type || !mForm.date) {
            setErr("Type and date required.");
            return;
        }
        var rec = Object.assign({}, mForm, { id: "M-" + Date.now(), vehicleId: selected.id, cost: Number(mForm.cost) || 0 });
        var updated = [...maintenance, rec];
        saveMaint(updated);
        setMaintenance(updated);
        setView("detail");
        setMForm({ type: "Oil Change", date: "", cost: "", notes: "", shop: "" });
        setErr("");
    }
    var alerts = vehicles.filter(function (v) {
        return [daysUntil(v.regExpiry), daysUntil(v.insExpiry), daysUntil(v.oilNext), daysUntil(v.tireNext), daysUntil(v.brakeNext)].some(function (d) { return d !== null && d <= 30; });
    });
    if (view === "add" || view === "edit")
        return React.createElement("div", { style: { maxWidth: 600, margin: "0 auto" } },
            React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 16 } },
                React.createElement(Btn, { onClick: function () { setView("list"); setErr(""); }, variant: "ghost", style: { fontSize: 12, padding: "6px 12px" } }, "\u2190 Back"),
                React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.white } }, view === "edit" ? "Edit Vehicle" : "Add Vehicle")),
            err && React.createElement("div", { style: { background: C.red + "18", border: "1px solid " + C.red + "44", borderRadius: 8, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: C.red } }, err),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.orange, marginBottom: 10 } }, "Vehicle Info"),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } }, [["make", "Make", "Ford"], ["model", "Model", "E350"], ["year", "Year", "2022"], ["plate", "Plate", "ABC-1234"], ["color", "Color", "White"], ["vin", "VIN", "1FTNE2EW..."]].map(function (f) {
                    return React.createElement("div", { key: f[0], style: { marginBottom: 10 } },
                        React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", marginBottom: 3 } }, f[1]),
                        React.createElement("input", { value: vForm[f[0]] || "", onChange: function (e) { setVForm(function (p) { var n = Object.assign({}, p); n[f[0]] = e.target.value; return n; }); }, placeholder: f[2], style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 7, color: C.white, padding: "8px 10px", fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box" } }));
                }))),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: C.orange, marginBottom: 10 } }, "Expiry Dates"),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } }, [["regExpiry", "Registration Expiry"], ["insExpiry", "Insurance Expiry"], ["insPolicy", "Insurance Policy #"], ["oilNext", "Next Oil Change"], ["tireNext", "Next Tire Rotation"], ["brakeNext", "Next Brake Inspection"]].map(function (f) {
                    var isDate = f[0] !== "insPolicy";
                    return React.createElement("div", { key: f[0], style: { marginBottom: 10 } },
                        React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", marginBottom: 3 } }, f[1]),
                        React.createElement("input", { type: isDate ? "date" : "text", value: vForm[f[0]] || "", onChange: function (e) { setVForm(function (p) { var n = Object.assign({}, p); n[f[0]] = e.target.value; return n; }); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 7, color: C.white, padding: "8px 10px", fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" } }));
                }))),
            React.createElement(Btn, { onClick: saveVehicle, style: { width: "100%", padding: "12px", fontSize: 14 } }, "\uD83D\uDCBE Save Vehicle"));
    if (view === "addmaint" && selected)
        return React.createElement("div", { style: { maxWidth: 500, margin: "0 auto" } },
            React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 16 } },
                React.createElement(Btn, { onClick: function () { setView("detail"); setErr(""); }, variant: "ghost", style: { fontSize: 12, padding: "6px 12px" } }, "\u2190 Back"),
                React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.white } }, "Add Maintenance Record")),
            React.createElement(Card, null,
                React.createElement("div", { style: { marginBottom: 10 } },
                    React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", marginBottom: 3 } }, "Type"),
                    React.createElement("select", { value: mForm.type, onChange: function (e) { setMForm(function (p) { return Object.assign({}, p, { type: e.target.value }); }); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 7, color: C.white, padding: "8px 10px", fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit", colorScheme: "dark" } }, ["Oil Change", "Tire Rotation", "Brake Inspection", "Tire Replacement", "Battery", "Transmission", "Engine", "AC/Heat", "Electrical", "Body Repair", "DOT Inspection", "Registration", "Insurance Renewal", "Other"].map(function (t) { return React.createElement("option", { key: t }, t); }))),
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 12px" } }, [["date", "Date", "date"], ["cost", "Cost ($)", "number"], ["shop", "Shop / Provider", "text"], ["notes", "Notes", "text"]].map(function (f) {
                    return React.createElement("div", { key: f[0], style: { marginBottom: 10, gridColumn: f[0] === "notes" ? "1 / -1" : "auto" } },
                        React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", marginBottom: 3 } }, f[1]),
                        React.createElement("input", { type: f[2], value: mForm[f[0]] || "", onChange: function (e) { setMForm(function (p) { var n = Object.assign({}, p); n[f[0]] = e.target.value; return n; }); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 7, color: C.white, padding: "8px 10px", fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" } }));
                }))),
            err && React.createElement("div", { style: { color: C.red, fontSize: 12, marginBottom: 8 } }, err),
            React.createElement(Btn, { onClick: addMaintRecord, style: { width: "100%", padding: "12px" } }, "\u2713 Add Record"));
    if (view === "detail" && selected) {
        var veh = vehicles.find(function (v) { return v.id === selected.id; }) || selected;
        var vMaint = maintenance.filter(function (m) { return m.vehicleId === veh.id; }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });
        var totalCost = vMaint.reduce(function (s, m) { return s + (m.cost || 0); }, 0);
        return React.createElement("div", { style: { maxWidth: 660, margin: "0 auto" } },
            React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" } },
                React.createElement(Btn, { onClick: function () { setView("list"); }, variant: "ghost", style: { fontSize: 12, padding: "6px 12px" } }, "\u2190 Fleet"),
                React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.white, flex: 1 } },
                    veh.year,
                    " ",
                    veh.make,
                    " ",
                    veh.model,
                    " ",
                    veh.plate && "· " + veh.plate),
                React.createElement(Btn, { onClick: function () { setVForm(veh); setView("edit"); }, variant: "ghost", style: { fontSize: 12, padding: "6px 12px" } }, "\u270F Edit"),
                React.createElement(Btn, { onClick: function () { deleteVehicle(veh.id); }, variant: "danger", style: { fontSize: 12, padding: "6px 12px" } }, "Delete")),
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 10, marginBottom: 16 } },
                [["Registration", veh.regExpiry], ["Insurance", veh.insExpiry], ["Oil Change", veh.oilNext], ["Tire Rotation", veh.tireNext], ["Brake Inspection", veh.brakeNext]].map(function (item) {
                    var days = daysUntil(item[1]);
                    return React.createElement(Card, { key: item[0], style: { marginBottom: 0, borderColor: days !== null && days <= 30 ? C.orange : C.border } },
                        React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", marginBottom: 3 } }, item[0]),
                        React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: expiryColor(days) } }, item[1] || "Not set"),
                        days !== null && React.createElement("div", { style: { fontSize: 10, color: expiryColor(days), marginTop: 2 } }, expiryLabel(days)));
                }),
                React.createElement(Card, { style: { marginBottom: 0 } },
                    React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", marginBottom: 3 } }, "Total Repair Cost"),
                    React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.orange } },
                        "$",
                        totalCost.toLocaleString()))),
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 } },
                React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } },
                    "Maintenance History (",
                    vMaint.length,
                    ")"),
                React.createElement(Btn, { onClick: function () { setView("addmaint"); }, style: { fontSize: 12, padding: "7px 14px" } }, "+ Add Record")),
            vMaint.length === 0 && React.createElement("div", { style: { color: C.dim, textAlign: "center", padding: 30, fontSize: 12 } }, "No maintenance records yet."),
            vMaint.map(function (m) {
                return React.createElement(Card, { key: m.id },
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start" } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white, marginBottom: 2 } }, m.type),
                            React.createElement("div", { style: { fontSize: 11, color: C.dim } },
                                m.date,
                                m.shop ? " · " + m.shop : ""),
                            m.notes && React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2 } }, m.notes)),
                        m.cost > 0 && React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: C.orange } },
                            "$",
                            m.cost.toLocaleString())));
            }));
    }
    // LIST VIEW
    return React.createElement("div", { style: { maxWidth: 740, margin: "0 auto" } },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 } },
            React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: C.white } }, "\uD83D\uDE97 Fleet Maintenance"),
            React.createElement(Btn, { onClick: function () { setVForm({ vin: "", make: "", model: "", year: "", plate: "", color: "", regExpiry: "", insExpiry: "", insPolicy: "", oilNext: "", tireNext: "", brakeNext: "" }); setView("add"); }, style: { fontSize: 12, padding: "8px 14px" } }, "+ Add Vehicle")),
        alerts.length > 0 && React.createElement("div", { style: { background: C.orange + "12", border: "1px solid " + C.orange + "44", borderRadius: 10, padding: "12px 14px", marginBottom: 16 } },
            React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.orange, marginBottom: 6 } },
                "\u26A0 ",
                alerts.length,
                " vehicle",
                alerts.length !== 1 ? "s" : "",
                " need attention in the next 30 days"),
            alerts.map(function (v) { return React.createElement("div", { key: v.id, style: { fontSize: 11, color: C.dim, marginBottom: 2 } },
                "\u2022 ",
                v.year,
                " ",
                v.make,
                " ",
                v.model,
                " ",
                v.plate ? "(" + v.plate + ")" : ""); })),
        vehicles.length === 0 && React.createElement("div", { style: { textAlign: "center", padding: "60px 0", color: C.dim, fontSize: 13 } }, "No vehicles yet. Add your first vehicle to start tracking maintenance."),
        vehicles.map(function (veh) {
            var vMaint = maintenance.filter(function (m) { return m.vehicleId === veh.id; });
            var totalCost = vMaint.reduce(function (s, m) { return s + (m.cost || 0); }, 0);
            var expiries = [
                { label: "Reg", days: daysUntil(veh.regExpiry) },
                { label: "Ins", days: daysUntil(veh.insExpiry) },
                { label: "Oil", days: daysUntil(veh.oilNext) },
                { label: "Tires", days: daysUntil(veh.tireNext) },
                { label: "Brakes", days: daysUntil(veh.brakeNext) },
            ].filter(function (e) { return e.days !== null; });
            var worstDays = expiries.length ? Math.min.apply(null, expiries.map(function (e) { return e.days; })) : 999;
            return React.createElement("div", { key: veh.id, onClick: function () { setSelected(veh); setView("detail"); }, style: { background: C.card, border: "1px solid " + (worstDays <= 0 ? C.red : worstDays <= 30 ? C.orange : C.border), borderRadius: 10, padding: "12px 16px", marginBottom: 8, cursor: "pointer" } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 3 } },
                            veh.year,
                            " ",
                            veh.make,
                            " ",
                            veh.model,
                            " ",
                            veh.color ? "· " + veh.color : ""),
                        React.createElement("div", { style: { fontSize: 11, color: C.dim } },
                            veh.plate && veh.plate + " · ",
                            veh.vin && "VIN: " + veh.vin.slice(-6) + " · ",
                            vMaint.length + " records · $" + totalCost.toLocaleString() + " total cost"),
                        React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap" } }, expiries.map(function (e) { return React.createElement("span", { key: e.label, style: { fontSize: 10, fontWeight: 700, color: expiryColor(e.days), background: expiryColor(e.days) + "18", borderRadius: 5, padding: "2px 7px" } },
                            e.label,
                            ": ",
                            expiryLabel(e.days)); }))),
                    React.createElement("div", { style: { color: C.dim, fontSize: 16 } }, "\u203A")));
        }));
}
// ═══════════════════════════════════════════════════════════════════
// 🛡 COMPLIANCE TRACKER
// ═══════════════════════════════════════════════════════════════════
var COMP_KEY = "pl_compliance";
function loadComp() { try {
    return JSON.parse(localStorage.getItem(COMP_KEY) || "{}");
}
catch (e) {
    return {};
} }
function saveComp(c) { try {
    localStorage.setItem(COMP_KEY, JSON.stringify(c));
}
catch (e) { } }
function ComplianceTracker(props) {
    var [comp, setComp] = useState(loadComp);
    var [selected, setSelected] = useState(null);
    var [editMode, setEditMode] = useState(false);
    var [dForm, setDForm] = useState({});
    var drivers = props.users ? props.users.filter(function (u) { return u.role === "driver"; }) : [];
    function getComp(uid) { return comp[uid] || {}; }
    function setCompField(uid, field, val) {
        var c = Object.assign({}, comp);
        c[uid] = Object.assign({}, c[uid] || {});
        c[uid][field] = val;
        saveComp(c);
        setComp(c);
    }
    function setCompMulti(uid, fields) {
        var c = Object.assign({}, comp);
        c[uid] = Object.assign({}, c[uid] || {}, fields);
        saveComp(c);
        setComp(c);
    }
    var COMP_FIELDS = [
        { key: "cdlNumber", label: "CDL Number", type: "text" },
        { key: "cdlExpiry", label: "CDL Expiry", type: "date" },
        { key: "medCardExpiry", label: "Medical Card Expiry", type: "date" },
        { key: "mvrDate", label: "Last MVR Date", type: "date" },
        { key: "drugTestDate", label: "Last Drug Test", type: "date" },
        { key: "alcoholTestDate", label: "Last Alcohol Test", type: "date" },
        { key: "clearinghouse", label: "Clearinghouse Registered", type: "select", options: ["Yes", "No", "Pending"] },
        { key: "dotInspDate", label: "Last DOT Inspection", type: "date" },
        { key: "dotInspResult", label: "DOT Inspection Result", type: "select", options: ["Pass", "Pass with violations", "Fail", "Not yet"] },
        { key: "accidentCount", label: "Accidents on Record", type: "number" },
        { key: "ticketCount", label: "Tickets on Record", type: "number" },
        { key: "accidentNotes", label: "Accident / Ticket Notes", type: "text" },
    ];
    var EXPIRY_FIELDS = ["cdlExpiry", "medCardExpiry", "dotInspDate", "drugTestDate", "alcoholTestDate"];
    function driverAlerts(uid) {
        var d = getComp(uid);
        return EXPIRY_FIELDS.filter(function (f) {
            var days = daysUntil(d[f]);
            return days !== null && days <= 30;
        });
    }
    function overallStatus(uid) {
        var d = getComp(uid);
        var expired = EXPIRY_FIELDS.some(function (f) { var days = daysUntil(d[f]); return days !== null && days < 0; });
        if (expired)
            return { color: C.red, label: "ACTION REQUIRED" };
        var alerts2 = driverAlerts(uid);
        if (alerts2.length > 0)
            return { color: C.orange, label: alerts2.length + " expiring soon" };
        var filled = EXPIRY_FIELDS.filter(function (f) { return !!d[f]; }).length;
        if (filled === 0)
            return { color: C.faint, label: "Not set up" };
        return { color: C.green, label: "Compliant" };
    }
    if (selected) {
        var d = getComp(selected.id);
        var status = overallStatus(selected.id);
        return React.createElement("div", { style: { maxWidth: 660, margin: "0 auto" } },
            React.createElement("div", { style: { display: "flex", gap: 10, alignItems: "center", marginBottom: 16, flexWrap: "wrap" } },
                React.createElement(Btn, { onClick: function () { setSelected(null); setEditMode(false); }, variant: "ghost", style: { fontSize: 12, padding: "6px 12px" } }, "\u2190 Drivers"),
                React.createElement("div", { style: { fontSize: 16, fontWeight: 900, color: C.white, flex: 1 } },
                    selected.emoji,
                    " ",
                    selected.name,
                    " \u2014 Compliance"),
                React.createElement("div", { style: { background: status.color + "22", color: status.color, borderRadius: 7, padding: "4px 10px", fontSize: 10, fontWeight: 700 } }, status.label),
                React.createElement(Btn, { onClick: function () { setDForm(d); setEditMode(!editMode); }, variant: "ghost", style: { fontSize: 12, padding: "6px 12px" } }, editMode ? "✓ Done" : "✏ Edit")),
            editMode ? React.createElement("div", null, COMP_FIELDS.map(function (f) {
                return React.createElement("div", { key: f.key, style: { marginBottom: 10 } },
                    React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 3 } }, f.label),
                    f.type === "select" ?
                        React.createElement("select", { value: dForm[f.key] || "", onChange: function (e) { var nf = Object.assign({}, dForm); nf[f.key] = e.target.value; setDForm(nf); setCompField(selected.id, f.key, e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 7, color: C.white, padding: "8px 10px", fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit", colorScheme: "dark" } },
                            React.createElement("option", { value: "" }, "Select..."),
                            f.options.map(function (o) { return React.createElement("option", { key: o }, o); })) :
                        React.createElement("input", { type: f.type, value: dForm[f.key] || "", onChange: function (e) { var nf = Object.assign({}, dForm); nf[f.key] = e.target.value; setDForm(nf); setCompField(selected.id, f.key, e.target.value); }, style: { background: C.surface, border: "1px solid " + C.border, borderRadius: 7, color: C.white, padding: "8px 10px", fontSize: 12, width: "100%", outline: "none", fontFamily: "inherit", boxSizing: "border-box", colorScheme: "dark" } }));
            })) : React.createElement("div", null,
                React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 } }, [
                    { label: "CDL", value: d.cdlNumber, expiry: d.cdlExpiry },
                    { label: "Medical Card", value: d.medCardExpiry ? d.medCardExpiry : "Not set", expiry: d.medCardExpiry },
                    { label: "Drug Test", value: d.drugTestDate ? d.drugTestDate : "Not set", expiry: d.drugTestDate },
                    { label: "Alcohol Test", value: d.alcoholTestDate ? d.alcoholTestDate : "Not set", expiry: d.alcoholTestDate },
                    { label: "DOT Inspection", value: d.dotInspDate ? d.dotInspDate : "Not set", expiry: d.dotInspDate },
                    { label: "MVR Date", value: d.mvrDate ? d.mvrDate : "Not set", expiry: null },
                ].map(function (item) {
                    var days = daysUntil(item.expiry);
                    return React.createElement(Card, { key: item.label, style: { marginBottom: 0, borderColor: days !== null && days <= 30 ? expiryColor(days) : C.border } },
                        React.createElement("div", { style: { fontSize: 9, color: C.dim, textTransform: "uppercase", marginBottom: 3 } }, item.label),
                        React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: expiryColor(days) || C.white } }, item.value || "Not set"),
                        days !== null && React.createElement("div", { style: { fontSize: 10, color: expiryColor(days), marginTop: 2 } }, expiryLabel(days)));
                })),
                React.createElement(Card, null,
                    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 } },
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 9, color: C.dim, marginBottom: 3 } }, "Clearinghouse"),
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: d.clearinghouse === "Yes" ? C.green : d.clearinghouse === "No" ? C.red : C.orange } }, d.clearinghouse || "Not set")),
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 9, color: C.dim, marginBottom: 3 } }, "DOT Result"),
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: d.dotInspResult === "Pass" ? C.green : d.dotInspResult === "Fail" ? C.red : C.orange } }, d.dotInspResult || "Not set")),
                        React.createElement("div", null,
                            React.createElement("div", { style: { fontSize: 9, color: C.dim, marginBottom: 3 } }, "Incidents"),
                            React.createElement("div", { style: { fontSize: 12, fontWeight: 700, color: Number(d.accidentCount || 0) > 0 ? C.orange : C.green } },
                                Number(d.accidentCount || 0),
                                " accidents \u00B7 ",
                                Number(d.ticketCount || 0),
                                " tickets"))),
                    d.accidentNotes && React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 8, borderTop: "1px solid " + C.border, paddingTop: 8 } },
                        "Notes: ",
                        d.accidentNotes))));
    }
    var totalAlerts = drivers.filter(function (u) { return driverAlerts(u.id).length > 0 || overallStatus(u.id).color === C.red; });
    return React.createElement("div", { style: { maxWidth: 660, margin: "0 auto" } },
        React.createElement("div", { style: { fontSize: 18, fontWeight: 900, color: C.white, marginBottom: 4 } }, "\uD83D\uDEE1 Compliance Tracker"),
        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 16 } }, "CDL \u00B7 Medical Cards \u00B7 Drug Testing \u00B7 DOT Inspections \u00B7 Clearinghouse"),
        totalAlerts.length > 0 && React.createElement("div", { style: { background: C.red + "12", border: "1px solid " + C.red + "44", borderRadius: 10, padding: "12px 14px", marginBottom: 16 } },
            React.createElement("div", { style: { fontSize: 11, fontWeight: 700, color: C.red, marginBottom: 4 } },
                "\uD83D\uDEA8 ",
                totalAlerts.length,
                " driver",
                totalAlerts.length !== 1 ? "s" : "",
                " need compliance attention"),
            totalAlerts.map(function (u) { return React.createElement("div", { key: u.id, style: { fontSize: 11, color: C.dim } },
                "\u2022 ",
                u.name,
                ": ",
                overallStatus(u.id).label); })),
        drivers.length === 0 && React.createElement("div", { style: { textAlign: "center", padding: 40, color: C.dim, fontSize: 12 } }, "No driver accounts found. Add drivers via the login system."),
        drivers.map(function (u) {
            var status = overallStatus(u.id);
            var d = getComp(u.id);
            return React.createElement("div", { key: u.id, onClick: function () { setSelected(u); }, style: { background: C.card, border: "1px solid " + (status.color === C.red ? C.red : status.color === C.orange ? C.orange : C.border), borderRadius: 10, padding: "12px 16px", marginBottom: 8, cursor: "pointer" } },
                React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 } },
                    React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 14, fontWeight: 700, color: C.white, marginBottom: 4 } },
                            u.emoji,
                            " ",
                            u.name),
                        React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap" } },
                            d.cdlNumber && React.createElement("span", { style: { fontSize: 10, color: C.dim } },
                                "CDL: ",
                                d.cdlNumber),
                            d.cdlExpiry && React.createElement("span", { style: { fontSize: 10, color: expiryColor(daysUntil(d.cdlExpiry)) } },
                                "Exp: ",
                                d.cdlExpiry),
                            d.clearinghouse && React.createElement("span", { style: { fontSize: 10, color: d.clearinghouse === "Yes" ? C.green : C.orange } },
                                "Clearinghouse: ",
                                d.clearinghouse))),
                    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
                        React.createElement("div", { style: { background: status.color + "22", color: status.color, borderRadius: 7, padding: "4px 10px", fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" } }, status.label),
                        React.createElement("div", { style: { color: C.dim } }, "\u203A"))));
        }));
}
// ═══════════════════════════════════════════════════════════════════
// 📁 DOCUMENT LOG — BOLs, seal numbers, packing lists, weight tickets,
// and fuel receipts saved from the AI Extract tab
// ═══════════════════════════════════════════════════════════════════
function DocumentLogView() {
    var [docs, setDocs] = useState(loadDocuments);
    var [filter, setFilter] = useState("All");
    var [selected, setSelected] = useState(null);
    var TYPE_LABELS = { bol: "📋 Bill of Lading", packinglist: "📦 Packing List", weightticket: "⚖️ Weight Ticket", fuelreceipt: "⛽ Fuel Receipt" };
    var filterOptions = ["All"].concat(Object.keys(TYPE_LABELS));
    var filtered = filter === "All" ? docs : docs.filter(function (d) { return d.docType === filter; });
    function deleteDoc(id) {
        if (!confirm("Delete this document record? This can't be undone."))
            return;
        var updated = docs.filter(function (d) { return d.id !== id; });
        setDocs(updated);
        saveDocuments(updated);
        if (selected === id)
            setSelected(null);
    }
    if (selected) {
        var doc = docs.find(function (d) { return d.id === selected; });
        if (!doc)
            return null;
        return React.createElement("div", { style: { maxWidth: 560, margin: "0 auto" } },
            React.createElement("button", { onClick: function () { setSelected(null); }, style: { background: "none", border: "none", color: C.dim, fontSize: 13, cursor: "pointer", marginBottom: 14 } }, "\u2190 Back to Documents"),
            React.createElement(Card, null,
                React.createElement("div", { style: { fontSize: 16, fontWeight: 800, color: C.white, marginBottom: 4 } }, TYPE_LABELS[doc.docType] || doc.docType),
                React.createElement("div", { style: { fontSize: 11, color: C.dim, marginBottom: 14 } }, "Scanned: " + new Date(doc.scannedAt).toLocaleString()),
                doc.imageData && React.createElement("img", { src: doc.imageData, style: { width: "100%", maxHeight: 300, objectFit: "contain", borderRadius: 9, border: "1px solid " + C.border, background: C.surface, marginBottom: 14 } }),
                doc.docType === "fuelreceipt" ? React.createElement("div", null,
                    [["Vendor", doc.vendor], ["Receipt Date", doc.receiptDate], ["Receipt Time", doc.receiptTime || "Not captured on receipt"], ["Amount", doc.amount ? "$" + doc.amount : ""], ["Gallons", doc.gallons], ["Price/Gallon", doc.pricePerGallon ? "$" + doc.pricePerGallon : ""], ["State", doc.state]].filter(function (r) { return r[1]; }).map(function (r) {
                        return React.createElement("div", { key: r[0], style: { display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid " + C.border, fontSize: 12 } },
                            React.createElement("span", { style: { color: C.dim } }, r[0]),
                            React.createElement("span", { style: { color: C.white, fontWeight: 600 } }, r[1]));
                    })) : (doc.data ? Object.entries(doc.data).filter(function (e) { return e[1]; }).map(function (e) {
                    return React.createElement("div", { key: e[0], style: { display: "flex", justifyContent: "space-between", padding: "7px 0", borderBottom: "1px solid " + C.border, fontSize: 12 } },
                        React.createElement("span", { style: { color: C.dim, textTransform: "capitalize" } }, e[0].replace(/([A-Z])/g, " $1").trim()),
                        React.createElement("span", { style: { color: C.white, fontWeight: 600, textAlign: "right", maxWidth: "60%" } }, e[1]));
                }) : React.createElement("div", { style: { color: C.dim, fontSize: 12 } }, "No extracted data on file for this scan.")),
                React.createElement(Btn, { onClick: function () { deleteDoc(doc.id); }, variant: "danger", style: { width: "100%", marginTop: 14 } }, "\uD83D\uDDD1 Delete Record")));
    }
    return React.createElement("div", { style: { maxWidth: 700, margin: "0 auto" } },
        React.createElement("div", { style: { fontSize: 20, fontWeight: 900, color: C.white, marginBottom: 4 } }, "\uD83D\uDCC1 Document Log"),
        React.createElement("div", { style: { fontSize: 12, color: C.dim, marginBottom: 16 } }, "BOLs, seal numbers, packing lists, weight tickets, and fuel receipts saved from AI Extract."),
        React.createElement("div", { style: { display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" } }, filterOptions.map(function (f) {
            return React.createElement("button", { key: f, onClick: function () { setFilter(f); }, style: { border: "1px solid " + (filter === f ? C.orange : C.border), borderRadius: 7, padding: "6px 12px", cursor: "pointer", background: filter === f ? C.orangeSoft : "transparent", color: filter === f ? C.orange : C.dim, fontSize: 11, fontWeight: 700, fontFamily: "inherit" } }, f === "All" ? "All" : TYPE_LABELS[f]);
        })),
        filtered.length === 0 && React.createElement("div", { style: { textAlign: "center", padding: "50px 0", color: C.dim, fontSize: 13 } }, "No documents saved yet. Scan a BOL, packing list, weight ticket, or fuel receipt from the AI Extract tab and tap \"Save to Document Log.\""),
        filtered.map(function (doc) {
            return React.createElement("div", { key: doc.id, onClick: function () { setSelected(doc.id); }, style: { background: C.card, border: "1px solid " + C.border, borderRadius: 9, padding: "12px 16px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" } },
                React.createElement("div", null,
                    React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: C.white } }, TYPE_LABELS[doc.docType] || doc.docType),
                    React.createElement("div", { style: { fontSize: 11, color: C.dim, marginTop: 2 } }, new Date(doc.scannedAt).toLocaleString())),
                React.createElement("div", { style: { color: C.dim } }, "\u203A"));
        }));
}
var rootEl = document.getElementById("root");
var reactRoot = ReactDOM.createRoot(rootEl);
reactRoot.render(React.createElement(Root));
