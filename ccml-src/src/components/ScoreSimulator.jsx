import React, { useState } from "react";

// Score Simulator: interactive "what-if" calculator for credit score impact
export default function ScoreSimulator() {
  const [utilization, setUtilization] = useState(75);
  const [paydown, setPaydown] = useState(2000);
  const [totalLimits, setTotalLimits] = useState(10000);
  const [latePayments, setLatePayments] = useState(2);
  const [collections, setCollections] = useState(1);
  const [currentScore, setCurrentScore] = useState(580);

  // Simplified FICO impact model
  const currentUtil = Math.max(0, (utilization / 100) * totalLimits - paydown) / totalLimits * 100;
  const utilGain = utilization > 30 ? Math.min(60, (utilization - Math.max(currentUtil, 1)) * 1.2) : 0;
  const lateGain = latePayments > 0 ? Math.min(25, latePayments * 8) : 0;
  const collGain = collections > 0 ? Math.min(30, collections * 15) : 0;
  const projected = Math.min(850, Math.round(currentScore + utilGain + lateGain + collGain));

  return (
    <div style={{ padding: 24, maxWidth: 700, margin: "0 auto" }}>
      <h2>📊 Score Simulator</h2>
      <p style={{ color: "#666" }}>See what happens to your score before you make a move.</p>

      <div style={{ marginBottom: 20 }}>
        <label>Current Score: {currentScore}</label>
        <input type="range" min={400} max={800} value={currentScore} onChange={e => setCurrentScore(+e.target.value)} style={{ width: "100%" }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>Current Utilization: {utilization}%</label>
        <input type="range" min={0} max={100} value={utilization} onChange={e => setUtilization(+e.target.value)} style={{ width: "100%" }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>Total Credit Limits: ${totalLimits.toLocaleString()}</label>
        <input type="range" min={1000} max={50000} step={1000} value={totalLimits} onChange={e => setTotalLimits(+e.target.value)} style={{ width: "100%" }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>Pay Down Amount: ${paydown.toLocaleString()}</label>
        <input type="range" min={0} max={20000} step={100} value={paydown} onChange={e => setPaydown(+e.target.value)} style={{ width: "100%" }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>Late Payments to Dispute: {latePayments}</label>
        <input type="range" min={0} max={10} value={latePayments} onChange={e => setLatePayments(+e.target.value)} style={{ width: "100%" }} />
      </div>

      <div style={{ marginBottom: 20 }}>
        <label>Collections to Dispute: {collections}</label>
        <input type="range" min={0} max={10} value={collections} onChange={e => setCollections(+e.target.value)} style={{ width: "100%" }} />
      </div>

      <div style={{ background: "#f0fdf4", border: "2px solid #22c55e", borderRadius: 12, padding: 24, textAlign: "center", marginTop: 24 }}>
        <div style={{ fontSize: 14, color: "#666" }}>Projected Score</div>
        <div style={{ fontSize: 56, fontWeight: "bold", color: "#16a34a" }}>{projected}</div>
        <div style={{ fontSize: 18, color: "#16a34a" }}>+{projected - currentScore} points</div>
        <div style={{ fontSize: 12, color: "#888", marginTop: 8 }}>New utilization: {currentUtil.toFixed(1)}%</div>
      </div>

      <p style={{ fontSize: 12, color: "#999", marginTop: 16 }}>
        Estimates based on FICO scoring models. Actual results vary by bureau and individual report factors.
      </p>
    </div>
  );
}
