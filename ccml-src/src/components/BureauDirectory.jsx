import React from "react";

// Bureau Contact Directory: every address, fax, and portal in one place
const BUREAUS = [
  {
    name: "Equifax",
    disputes: "P.O. Box 740256, Atlanta, GA 30374",
    fax: "1-866-349-5191",
    online: "https://www.equifax.com/personal/disputes/",
    phone: "1-800-685-1111"
  },
  {
    name: "Experian",
    disputes: "P.O. Box 4500, Allen, TX 75013",
    fax: "1-972-390-3838",
    online: "https://www.experian.com/disputes/",
    phone: "1-888-397-3742"
  },
  {
    name: "TransUnion",
    disputes: "P.O. Box 2000, Chester, PA 19016",
    fax: "1-610-546-4771",
    online: "https://www.transunion.com/credit-disputes/",
    phone: "1-800-916-8800"
  }
];

const SPECIALTY = [
  { name: "ChexSystems", use: "Bank account denials", online: "https://www.chexsystems.com/" },
  { name: "LexisNexis", use: "Background checks, insurance", online: "https://optout.lexisnexis.com/" },
  { name: "Innovis", use: "4th credit bureau", online: "https://www.innovis.com/" },
  { name: "SageStream", use: "Alternative credit data", online: "https://www.sagestreamllc.com/" },
  { name: "CoreLogic Teletrack", use: "Payday/subprime lending", online: "https://www.corelogic.com/" },
  { name: "Clarity Services", use: "Subprime credit reporting", online: "https://www.clarityservices.com/" },
  { name: "FactorTrust", use: "Alternative lending data", online: "https://www.factortrust.com/" },
  { name: "MicroBilt", use: "Alternative credit/rental", online: "https://www.microbilt.com/" },
  { name: "PRBC", use: "Rent/utility payment history", online: "https://www.prbc.com/" },
  { name: "Tenant Data Services", use: "Rental screening", online: "Contact directly for disputes" },
  { name: "Certegy", use: "Check verification", online: "https://www.certegy.com/" },
  { name: "TeleCheck", use: "Check acceptance", online: "https://www.telecheck.com/" },
  { name: "Early Warning Services", use: "Bank fraud prevention", online: "https://www.earlywarning.com/" },
  { name: "ARS (Advanced Resolution)", use: "Medical collections", online: "Contact directly for disputes" },
  { name: "DataX", use: "Payday loan reporting", online: "https://www.dataxltd.com/" },
];

export default function BureauDirectory() {
  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h2>📇 Bureau Contact Directory</h2>
      <p style={{ color: "#666" }}>Every address, fax, and dispute portal. No more Googling.</p>

      <h3 style={{ marginTop: 24 }}>The Big 3</h3>
      {BUREAUS.map(b => (
        <div key={b.name} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 20, marginBottom: 16 }}>
          <h3 style={{ marginTop: 0 }}>{b.name}</h3>
          <div style={{ display: "grid", gap: 8, fontSize: 14 }}>
            <div><strong>📬 Dispute Mail:</strong> {b.disputes}</div>
            <div><strong>📠 Fax:</strong> {b.fax}</div>
            <div><strong>🌐 Online:</strong> <a href={b.online} target="_blank" rel="noopener noreferrer">{b.online}</a></div>
            <div><strong>📞 Phone:</strong> {b.phone}</div>
          </div>
        </div>
      ))}

      <h3 style={{ marginTop: 32 }}>15 Specialty Bureaus</h3>
      <p style={{ color: "#666", fontSize: 14 }}>These collect data the Big 3 don't see. Opt out or dispute directly.</p>
      <div style={{ display: "grid", gap: 12 }}>
        {SPECIALTY.map(s => (
          <div key={s.name} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <strong>{s.name}</strong>
              <div style={{ fontSize: 13, color: "#666" }}>{s.use}</div>
            </div>
            <a href={s.online.startsWith("http") ? s.online : "#"} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 13, color: "#1e40af" }}>
              {s.online.startsWith("http") ? "Visit →" : s.online}
            </a>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 24, padding: 16, background: "#fefce8", borderRadius: 8, fontSize: 14 }}>
        <strong>💡 Pro tip:</strong> Always send disputes via certified mail (tracking number = proof).
        Use the in-app certified mail feature to send directly without going to the post office.
      </div>
    </div>
  );
}
