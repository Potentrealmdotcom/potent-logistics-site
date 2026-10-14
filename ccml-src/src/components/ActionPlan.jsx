import React, { useState } from "react";

// 90-Day Action Plan: week-by-week personalized game plan
const PLAN = [
  { week: "Week 1-2", title: "Pull & Analyze", tasks: ["Pull all 3 bureau reports (AnnualCreditReport.com)", "Run the Metro 2 Violation Scanner on each report", "Run the AI Credit Report Analyzer", "Document every negative item in the Dispute Tracker", "Take 'before' screenshots of all scores"] },
  { week: "Week 3-4", title: "First Dispute Round", tasks: ["Generate dispute letters for top 5 violations", "Send via certified mail (tracking numbers in app)", "Start 30-day countdown timers", "Opt out of 15 specialty bureaus", "Freeze LexisNexis and SageStream"] },
  { week: "Week 5-6", title: "Build While You Wait", tasks: ["Open secured credit card ($200-$500)", "Set up Self/Lendo credit builder loan", "Add rent reporting (LevelCredit or similar)", "Pay down revolving balances below 30% utilization", "Set all accounts to autopay minimum"] },
  { week: "Week 7-8", title: "Follow Up & Escalate", tasks: ["Check dispute results (30-day mark)", "For non-responses: file CFPB complaints", "For verified items: send Method of Verification letters", "Dispute remaining violations (Round 2)", "Update Dispute Tracker with all outcomes"] },
  { week: "Week 9-10", title: "Second Dispute Round", tasks: ["Attack remaining negatives with new angles", "Send 609 letters for stubborn items", "Dispute with furnishers directly (not just bureaus)", "Continue paydown strategy", "Monitor score changes in dashboard"] },
  { week: "Week 11-12", title: "Fund & Scale", tasks: ["Check Funding Readiness Score", "Apply for unsecured cards if score > 650", "Request credit limit increases (soft pull only)", "Review 24-step funding checklist", "Take 'after' screenshots — compare to Week 1"] },
];

export default function ActionPlan() {
  const [done, setDone] = useState({});
  const toggle = (w, t) => setDone(d => ({ ...d, [`${w}-${t}`]: !d[`${w}-${t}`] }));
  const total = PLAN.reduce((n, w) => n + w.tasks.length, 0);
  const completed = Object.values(done).filter(Boolean).length;
  const pct = Math.round((completed / total) * 100);

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: "0 auto" }}>
      <h2>🗺️ Your 90-Day Action Plan</h2>
      <p style={{ color: "#666" }}>Week by week. Check things off as you go.</p>

      <div style={{ background: "#f3f4f6", borderRadius: 12, padding: 16, marginBottom: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
          <strong>Progress</strong>
          <span>{completed}/{total} tasks ({pct}%)</span>
        </div>
        <div style={{ height: 12, background: "#e5e7eb", borderRadius: 6 }}>
          <div style={{ width: `${pct}%`, height: "100%", background: "#22c55e", borderRadius: 6, transition: "width 0.3s" }} />
        </div>
      </div>

      {PLAN.map(w => (
        <div key={w.week} style={{ marginBottom: 24 }}>
          <h3 style={{ color: "#1e40af", marginBottom: 12 }}>{w.week}: {w.title}</h3>
          {w.tasks.map(t => {
            const key = `${w.week}-${t}`;
            return (
              <div key={key} onClick={() => toggle(w.week, t)}
                style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 12, border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 8, cursor: "pointer", background: done[key] ? "#f0fdf4" : "#fff" }}>
                <div style={{ width: 20, height: 20, borderRadius: 4, border: "2px solid", borderColor: done[key] ? "#22c55e" : "#d1d5db", background: done[key] ? "#22c55e" : "#fff", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, flexShrink: 0, marginTop: 2 }}>
                  {done[key] ? "✓" : ""}
                </div>
                <span style={{ textDecoration: done[key] ? "line-through" : "none", color: done[key] ? "#888" : "#333", fontSize: 14 }}>{t}</span>
              </div>
            );
          })}
        </div>
      ))}

      {pct === 100 && (
        <div style={{ textAlign: "center", padding: 32, background: "#f0fdf4", borderRadius: 12 }}>
          <div style={{ fontSize: 48 }}>🎉</div>
          <h3>90 Days Complete!</h3>
          <p>Compare your scores to Week 1. If you're not where you want to be, run another round — you now know the system.</p>
        </div>
      )}
    </div>
  );
}
