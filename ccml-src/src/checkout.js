// Stripe checkout for Credit Changed My Life. Runs on POTENT's Stripe account through POTENT's Netlify functions.
import { supabase } from "./supabase.js";

const FN = "/.netlify/functions/";

async function authHeader() {
  try {
    const { data } = await supabase.auth.getSession();
    const t = data && data.session && data.session.access_token;
    return t ? { Authorization: "Bearer " + t } : {};
  } catch (e) { return {}; }
}

/** plan: "diy" | "dfy" | "mail" (mail needs pack: "m1".."m4"). Redirects to Stripe. */
export async function startCheckout(plan, pack) {
  try {
    const res = await fetch(FN + "ccml-checkout", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, await authHeader()),
      body: JSON.stringify({ plan, pack: pack || null }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.url) throw new Error(data.error || "Checkout failed");
    window.location.href = data.url;
  } catch (err) {
    console.error("Checkout error:", err.message);
    alert("Something went wrong starting checkout: " + err.message);
  }
}

/** After Stripe sends the buyer back with ?session_id=..., ask the server to confirm the payment. */
export async function verifyAndUnlock(sessionId) {
  try {
    const res = await fetch(FN + "ccml-verify", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, await authHeader()),
      body: JSON.stringify({ sessionId }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.success ? data : null;
  } catch (err) {
    console.error("Verify error:", err.message);
    return null;
  }
}

/** Send a certified-mail request (server checks plan or mail credits). */
export async function sendMailRequest(payload) {
  try {
    const res = await fetch(FN + "ccml-mail", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, await authHeader()),
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok ? data : { ok: false, error: data.error || "Could not send the request" };
  } catch (err) { return { ok: false, error: "No connection" }; }
}

/** AI report analyzer: runs on the server (the key is never in the browser) and only for paid members. */
export async function askAI(report) {
  try {
    const res = await fetch(FN + "ccml-ai", {
      method: "POST",
      headers: Object.assign({ "Content-Type": "application/json" }, await authHeader()),
      body: JSON.stringify({ report }),
    });
    const data = await res.json().catch(() => ({}));
    return res.ok && data.ok ? data : { ok: false, error: data.error || "Analysis is not available right now." };
  } catch (err) { return { ok: false, error: "No connection" }; }
}

export function getCheckoutParams() {
  const params = new URLSearchParams(window.location.search);
  return { sessionId: params.get("session_id"), success: params.has("session_id"), canceled: params.has("canceled") };
}
