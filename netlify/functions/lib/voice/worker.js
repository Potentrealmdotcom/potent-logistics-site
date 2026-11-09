"use strict";
// WORKER v1 — GRIFFIN, the legworker (master list §2I.2 / §2I.4, Nov 8, 2026).
//
// THE SPLIT: Elevate is the TALKER — she captures conversationally and never waits on a check.
// Griffin is the WORKER behind her: when she hands over a confirmed job (confirm_job_packet),
// the bridge fires ONE worker_run and the pipeline below finishes the booking server-side —
// verification, availability, the single booking save — while she keeps talking. The outcome
// returns INTO the same live call as a system note (event-driven: the bridge holds the request
// open; there is NO polling anywhere in this design — Supabase egress lesson, Nov 8, 2026).
// If the call ends first, the ordinary finish() path (safety net + post-call verify + the
// owner's full-design report) still completes the record, and this outcome is in it.
//
// The worker's hands are the EXISTING tool implementations in tools.js, called internally
// (ctx.workerInternal, never ctx.modelFacing): nothing is duplicated, and every state-layer
// guarantee those tools carry (confirmed-field locks, idempotent booking insert, the
// transcript-evidence confirmation gate) applies unchanged.
//
// STRUCTURAL GUARANTEES:
//  - Exactly-once completion: the run is claimed once per session (S.firstTime). A second
//    worker_run returns the stored outcome instead of running again.
//  - Exactly-one booking save: create_pending_booking's insert is idempotent on
//    session+quote (resolution=ignore-duplicates) AND the completion claim means the pipeline
//    itself can only execute once. The Nov 8 r3 failure — the same details saved 8 times on
//    one call — cannot recur through this path.
//  - Verification failures FLAG for owner review (callback task + outcome in the owner
//    report); they never stall the caller, who is already off the clock.
//  - Every step logs name + duration + outcome ("worker step <name> <ms>ms <outcome>").
const B = require("../beats"), S = require("./store"), T = require("./tools"), I = require("./intake");
const rows = function (r) { return (r && r.data) || []; };
function wlog() { console.log.apply(console, ["worker"].concat([].slice.call(arguments))); }

async function runCompletion(ctxIn, opts) {
  const t0 = Date.now();
  const orgId = ctxIn.orgId, sid = ctxIn.session.id;
  const ctx = { orgId: orgId, session: ctxIn.session, cfg: ctxIn.cfg, workerInternal: true };
  const freshIntake = async function () {
    const s = rows(await B.sb("voice_sessions?id=eq." + sid + "&select=intake&limit=1"))[0];
    if (s && s.intake) ctx.session.intake = s.intake;
    return ctx.session.intake || {};
  };
  let intake = await freshIntake();
  // No packet, no run — and crucially NO claim consumed: a stray confirm before any packet
  // must not burn the session's one completion.
  if (!intake._worker_submit) return { ok: false, error: "no_packet", status: "no_packet", ms: Date.now() - t0, say_for_agent: "No job packet was submitted for this call. Capture the details conversationally, do the read-back, and submit the packet first — then confirm." };
  // COMPLETENESS GATE BEFORE THE CLAIM (Jarvis step 1, Nov 9, 2026): since step 1 the packet is
  // accepted with pieces still missing, so a confirm can reach the worker holding a shortfall.
  // That is NOT a failed completion: no claim is consumed and no owner flag is raised — the
  // answer is conversational (she asks for the named pieces out loud, submits again carrying
  // them, and a later worker_run completes for real). Date problems land here too: the date is
  // checked HERE, in the back office, never as a step she waits on, and a wrong date comes back
  // into the same live call as a question, while the conversation continues.
  const vGate = I.validate(intake);
  if (!vGate.ok) {
    const pn = I.plainNeeds(vGate.missing, vGate.problems);
    wlog("gate", sid, "needs_details", (Date.now() - t0) + "ms");
    return { ok: true, status: "needs_details", missing: vGate.missing, problems: vGate.problems, ms: Date.now() - t0, say_for_agent: "The job is in, but it still needs: " + pn.list + ". Nothing is booked yet and nothing is lost. Ask the caller for the next piece OUT LOUD, in plain words — " + (pn.firstAsk || "the next missing piece") + " — one thing at a time, keep the conversation going, then submit the packet again carrying everything and confirm again. Do NOT say it is booked and do not invent a price." };
  }
  const first = await S.firstTime(orgId, sid, "worker_complete:" + sid, "worker_complete");
  if (!first) {
    const w = intake._worker;
    if (w) return Object.assign({ ok: true, already: true, ms: Date.now() - t0 }, w);
    return { ok: false, error: "worker_already_running", status: "running", ms: Date.now() - t0, say_for_agent: "The back office is already finishing this booking. Keep talking; the outcome will be announced to you." };
  }
  const finish = async function (outcome) {
    try {
      const cur = await freshIntake();
      cur._worker = { status: outcome.status, booking_id: outcome.booking_id || null, reference: outcome.reference || null, total: outcome.total || null, reason: outcome.reason || null, at: new Date().toISOString() };
      ctx.session.intake = cur;
      await S.patchSession(orgId, sid, { intake: cur });
    } catch (e) { /* the outcome still returns to the call; the finish() path re-derives the record */ }
    outcome.ms = Date.now() - t0;
    wlog("complete", sid, outcome.status, outcome.ms + "ms");
    return outcome;
  };
  const flag = async function (status, reason, sayForAgent) {
    try { await T.execute(ctx, "create_callback_task", { reason: ("Worker flag (" + reason + "): finish booking from call " + sid).slice(0, 300) }, "worker-flag-" + sid); } catch (e) { /* flagging must not mask the outcome */ }
    return finish({ ok: true, status: status, reason: reason, say_for_agent: sayForAgent });
  };
  const run = async function (name, args) {
    const s0 = Date.now();
    const r = await T.execute(ctx, name, args || {}, "worker:" + name + ":" + sid);
    wlog("step", name, (Date.now() - s0) + "ms", r && r.ok ? "ok" : (r && r.error) || "error");
    await freshIntake(); intake = ctx.session.intake || {};
    return r;
  };
  try {
    // 1) A late email (given after the packet went in) merges through the same state layer —
    //    spelled-email ground truth and the locks apply exactly as on the old talk path.
    const lateEmail = opts && opts.email;
    if (lateEmail && !intake.email) { await run("collect_shipment_details", { email: lateEmail }); }
    // 2) The caller's yes is transcript evidence. In the split flow it is spoken BEFORE this
    //    pipeline creates anything, and later small talk can push it out of the booking gate's
    //    last-6 window — so scan the wider transcript and stamp the verified timestamp
    //    (intake._packet_yes_at; not model-settable — see callerConfirmed in tools.js).
    if (intake._quote && !intake._packet_yes_at) {
      const lines = rows(await B.sb("voice_transcripts?session_id=eq." + sid + "&role=eq.caller&select=text,created_at,seq&order=seq.desc&limit=25"));
      const yes = lines.find(function (x) { return String(x.created_at) >= String(intake._quote.created_at) && T.AFFIRM.test(x.text) && !T.NEG.test(x.text); });
      if (yes) { intake._packet_yes_at = yes.created_at; ctx.session.intake = intake; await S.patchSession(orgId, sid, { intake: intake }); }
    }
    // 3) Price. Book tenants already carry _quote from submit_job_packet (their semantics are
    //    preserved exactly — no pre-booking eligibility run). Everyone else: the ONE server-side
    //    verification pass (addresses/route/fit), then the quote it unlocks.
    if (!intake._quote) {
      const vr = await run("validate_shipment_eligibility", {});
      if (vr && vr.ok === false && vr.error === "blocked") return flag("flagged", "shipment_blocked", "The job needs a person's review before it can be booked — it is saved and flagged for the owner, nothing is lost. Tell the caller a person will confirm with them shortly, and offer a callback if they want one sooner.");
      let qr = await run("calculate_quote", {});
      if (!qr || !qr.ok) return flag("flagged", "no_price", "The total could not be finished automatically — it is flagged for the owner and will be confirmed in the written confirmation. Do NOT invent a price. Tell the caller the job is in and a person will confirm the total shortly.");
    }
    // 4) Availability (a stored-records check), then the ONE booking save, then confirmation.
    await run("check_live_availability", {});
    const pb = await run("create_pending_booking", {});
    if (!pb || !pb.ok) {
      if (pb && pb.error === "caller_has_not_confirmed") return flag("flagged", "no_confirmation_on_record", "The booking is saved but the confirmation from the caller is not on record, so a person will confirm it. Tell the caller their request is in and a person will confirm shortly — do not say it is booked.");
      if (pb && pb.error === "need_email") return flag("flagged", "need_email", "The booking is saved but still needs an email for the written confirmation — a person will follow up. Tell the caller their request is in; do not say it is booked.");
      return flag("flagged", (pb && pb.error) || "booking_failed", "The booking could not be finished automatically — it is saved and flagged for the owner. Tell the caller their request is in and a person will confirm shortly; do not say it is booked.");
    }
    const bookingId = pb.booking_id;
    const cf = await run("confirm_eligible_booking", { booking_id: bookingId });
    // Re-read the booking AFTER the confirm step: confirmation assigns the FINAL reference
    // (the pending row carries a different one) — the reference she speaks must be the final
    // one, the same one the owner report prints. (Caught by tests/voice-split.test.js.)
    const bk = rows(await B.sb("voice_bookings?org_id=eq." + orgId + "&id=eq." + bookingId + "&select=*&limit=1"))[0];
    const total = intake._quote ? "$" + (intake._quote.total_cents / 100).toFixed(2) : (bk && bk.snapshot && bk.snapshot.quote ? "$" + (bk.snapshot.quote.total_cents / 100).toFixed(2) : null);
    if (cf && cf.confirmed) {
      // Payment-status check (worker job 3): read the job's own record — "paid" is only ever
      // what Stripe's confirmation already wrote there, never a guess.
      let payment = null;
      if (bk && bk.job_id) { const job = rows(await B.sb("jobs?id=eq." + encodeURIComponent(bk.job_id) + "&select=payment_status&limit=1"))[0]; payment = job ? job.payment_status : null; }
      return finish({ ok: true, status: "confirmed", booking_id: bookingId, reference: bk ? bk.reference : null, total: total, payment_status: payment,
        say_for_agent: "The booking is CONFIRMED" + (bk && bk.reference ? ", reference " + bk.reference : "") + (total ? ", total " + total : "") + ". Say it once, warmly, with the reference in its spoken form. " + (payment === "paid" ? "It is already paid — thank them, do not offer payment again." : "Then offer to take the card right now over the phone keypad (take_card_payment — no booking_id needed, the system finds this booking).") });
    }
    // Saved but not auto-confirmed (a check still wants a person's eyes): an honest request.
    return finish({ ok: true, status: "request", booking_id: bookingId, reference: bk ? bk.reference : null, total: total, reason: (cf && cf.reason) || "review",
      say_for_agent: "The booking is saved as a REQUEST" + (bk && bk.reference ? ", reference " + bk.reference : "") + " — a person will confirm it. Say exactly that, plainly and warmly; do NOT say it is confirmed and do not take payment yet. Offer the written confirmation (send_approved_confirmation)." });
  } catch (e) {
    wlog("exception", sid, String((e && e.message) || e).slice(0, 160));
    return flag("flagged", "worker_exception", "Something in the back office needs a person's eyes — the job is saved and flagged for the owner. Tell the caller their request is in and a person will confirm shortly; do not say it is booked.");
  }
}

module.exports = { runCompletion };
