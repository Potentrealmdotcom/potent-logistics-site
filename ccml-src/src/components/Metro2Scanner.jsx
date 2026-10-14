import React, { useState } from "react";

// Metro 2 Violation Scanner: flags common compliance violations that are disputable
const VIOLATIONS = [
  { id: "v1", code: "Account Status ≠ Payment History", desc: "Account shows 'Current' but payment history shows late payments (or vice versa). Metro 2 requires these to match.", severity: "High" },
  { id: "v2", code: "Incorrect Date of First Delinquency", desc: "The DOFD determines when the 7-year clock starts. If wrong, the item may be reporting past the legal limit.", severity: "High" },
  { id: "v3", code: "Balance ≠ $0 on Closed/Paid Account", desc: "A paid or closed account still showing a balance. Must report $0 with 'Paid' status.", severity: "High" },
  { id: "v4", code: "Duplicate Collection Entry", desc: "Same debt reported by both original creditor and collector without 'transferred' notation.", severity: "Medium" },
  { id: "v5", code: "Missing 'Date Reported'", desc: "Every tradeline must have a current Date Reported. Stale dates = stale data.", severity: "Medium" },
  { id: "v6", code: "Wrong Account Type Code", desc: "Revolving reported as installment (or vice versa) affects utilization calculations.", severity: "Medium" },
  { id: "v7", code: "No 'Compliance Condition Code'", desc: "Accounts under dispute must show XB/XC/XD codes. Missing codes during active dispute = violation.", severity: "High" },
  { id: "v8", code: "Re-aged Account", desc: "DOFD was changed to a newer date, illegally extending the 7-year reporting period.", severity: "Critical" },
  { id: "v9", code: "Incorrect Creditor Name", desc: "Creditor name doesn't match the actual furnisher. Identity must be accurate.", severity: "Low" },
  { id: "v10", code: "Missing Payment History Profile", desc: "No 24-month payment grid on an account old enough to have one.", severity: "Low" },
];

export default function Metro2Scanner() {
  const [checked, setChecked] = useState({});
  const [showResults, setShowResults] = useState(false);

  const toggle = id => setChecked(c => ({ ...c, [id]: !c[id] }));
  const found = VIOLATIONS.filter(v => checked[v.id]);
  const critical = found.filter(v => v.severity === "Critical" || v.severity === "High");

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: "0 auto" }}>
      <h2>🔍 Metro 2 Violation Scanner</h2>
      <p style={{ color: "#666" }}>
        Creditors must follow Metro 2 formatting rules. When they don't, you have a legal basis to dispute.
        Check every violation you spot on your report:
      </p>

      {VIOLATIONS.map(v => (
        <div key={v.id} onClick={() => toggle(v.id)}
          style={{ border: checked[v.id] ? "2px solid #ef4444" : "1px solid #ddd", borderRadius: 8, padding: 16, marginBottom: 12, cursor: "pointer", background: checked[v.id] ? "#fef2f2" : "#fff" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <strong>{v.code}</strong>
            <span style={{ fontSize: 12, padding: "4px 8px", borderRadius: 4, background: v.severity === "Critical" ? "#dc2626" : v.severity === "High" ? "#f97316" : v.severity === "Medium" ? "#eab308" : "#6b7280", color: "#fff" }}>
              {v.severity}
            </span>
          </div>
          <p style={{ fontSize: 14, color: "#555", marginTop: 8 }}>{v.desc}</p>
          {checked[v.id] && <div style={{ color: "#dc2626", fontWeight: "bold", fontSize: 14 }}>✓ Flagged for dispute</div>}
        </div>
      ))}

      <button onClick={() => setShowResults(true)}
        style={{ width: "100%", padding: 16, background: "#1e40af", color: "#fff", border: "none", borderRadius: 8, fontSize: 16, fontWeight: "bold", cursor: "pointer", marginTop: 16 }}>
        Generate Dispute List ({found.length} violations)
      </button>

      {showResults && found.length > 0 && (
        <div style={{ marginTop: 24, padding: 20, background: "#f8fafc", borderRadius: 12 }}>
          <h3>Your Dispute Targets</h3>
          <p>You found <strong>{found.length}</strong> potential violations ({critical.length} high/critical).</p>
          <ul>
            {found.map(v => <li key={v.id} style={{ marginBottom: 8 }}><strong>{v.code}</strong> — dispute under FCRA §611</li>)}
          </ul>
          <p style={{ fontSize: 14, color: "#555", marginTop: 16 }}>
            Use the AI Letter Generator to create Metro 2 dispute letters for each violation above.
            Each one is a separate dispute with its own 30-day investigation clock.
          </p>
        </div>
      )}
    </div>
  );
}
