import { useState, useEffect } from "react";
import {
  supabase, signOut, onAuthChange,
  getProfile, getProgress, markLessonComplete, unmarkLessonComplete,
  getChecklist, toggleChecklistItem,
  getDisputes, addDispute, updateDispute, deleteDispute,
  getVendors, upsertVendor, submitDFYIntake, getDFYClient, getMailRequests
} from "./supabase.js";
import { startCheckout, verifyAndUnlock, sendMailRequest, askAI, getCheckoutParams } from "./checkout.js";
import { LESSONS, MODULES } from "./lessons.js";
import Auth from "./components/Auth.jsx";
import LessonPage from "./components/LessonPage.jsx";
import ScoreSimulator from "./components/ScoreSimulator.jsx";
import Metro2Scanner from "./components/Metro2Scanner.jsx";
import BureauDirectory from "./components/BureauDirectory.jsx";
import ActionPlan from "./components/ActionPlan.jsx";

// ─── TOKENS ──────────────────────────────────────────────────────────────────
const C = {
  bg:"#08080F", surface:"#0F0F1A", card:"#13131F", border:"#1E1E32", borderLight:"#2A2A42",
  gold:"#F5C518", green:"#00D68F", red:"#FF4560", blue:"#4D9FFF",
  purple:"#9B6BFF", orange:"#FF8C42", teal:"#00C9B1",
  text:"#EEEEFF", muted:"#7070A0", mutedLight:"#9090B8",
};
const F = "'Inter',-apple-system,sans-serif";

// ─── SHARED UI ────────────────────────────────────────────────────────────────
const Tag = ({label,color})=>(
  <span style={{background:color+"22",color,border:`1px solid ${color}44`,borderRadius:4,fontSize:10,fontWeight:700,padding:"2px 7px",letterSpacing:.5,textTransform:"uppercase"}}>{label}</span>
);
const PBar = ({pct,color=C.gold,thin=false})=>(
  <div style={{background:C.border,borderRadius:99,height:thin?4:7,overflow:"hidden"}}>
    <div style={{width:`${Math.min(pct,100)}%`,height:"100%",background:`linear-gradient(90deg,${color},${color}88)`,borderRadius:99,transition:"width .5s"}}/>
  </div>
);
const CountBadge = ({days})=>{
  const c=days<=0?C.red:days<=3?C.red:days<=7?C.orange:C.green;
  return <span style={{background:c+"22",color:c,border:`1px solid ${c}44`,borderRadius:6,fontSize:11,fontWeight:700,padding:"3px 8px"}}>{days<=0?"⚠️ OVERDUE":`⏱ ${days}d left`}</span>;
};
function Btn({children,onClick,color=C.gold,outline=false,full=false,small=false,disabled=false,style={}}){
  return(
    <button disabled={disabled} onClick={onClick} style={{background:outline?"transparent":color,color:outline?color:"#08080F",border:`1.5px solid ${color}`,borderRadius:8,padding:small?"7px 14px":"11px 20px",fontSize:small?12:14,fontWeight:700,cursor:disabled?"default":"pointer",width:full?"100%":undefined,opacity:disabled?.5:1,transition:"opacity .15s",...style}}
      onMouseEnter={e=>{if(!disabled)e.currentTarget.style.opacity=".82";}}
      onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
      {children}
    </button>
  );
}
function Inp({label,value,onChange,placeholder,type="text",multi=false,rows=3}){
  const base={width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"9px 11px",color:C.text,fontSize:13,fontFamily:F,boxSizing:"border-box"};
  return(
    <div style={{marginBottom:11}}>
      {label&&<label style={{display:"block",fontSize:10,color:C.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:.5}}>{label}</label>}
      {multi
        ?<textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{...base,resize:"vertical"}}/>
        :<input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={base}/>}
    </div>
  );
}

// ─── MOTION TEMPLATES ─────────────────────────────────────────────────────────
const FL_MAP = {
  yourName:"Your Full Legal Name", yourAddress:"Your Mailing Address",
  bureauName:"Credit Bureau Name", accountNumber:"Account Number", date:"Today's Date",
  yourSSNLast4:"Last 4 of SSN (for ID only)", inaccuracyDescription:"Describe the Inaccuracy",
  collectorName:"Collection Agency Name", collectorAddress:"Collector's Address",
  creditorName:"Creditor Name", creditorAddress:"Creditor Address",
  offerAmount:"Settlement Offer ($)", originalBalance:"Original Balance ($)",
  latePaymentDate:"Date of Late Payment", medicalProvider:"Medical Provider Name",
  theftDescription:"How Identity Theft Occurred", fraudAccounts:"List Fraudulent Accounts",
  trademarkName:"Trademark Name", trademarkRegNo:"USPTO Reg. Number",
  certifiedMailDate:"Date of First Letter", issueDescription:"Describe Issue",
  originalDelinquencyDate:"Original Delinquency Date", debtState:"State",
  inquiryDate:"Date of Inquiry", servicerName:"Loan Servicer",
  loanAccountNumber:"Loan Account Number", businessName:"Business Legal Name",
  businessAddress:"Business Address", ein:"EIN Number", dunsNumber:"DUNS Number",
  contactName:"Your Name (Authorized Rep)", bureauAddress:"Bureau Address",
  claimDescription:"FCRA Violation Description", damagesAmount:"Damages ($)",
  breachName:"Name of the Data Breach", breachYear:"Year of the Breach", recordDescription:"Describe the Record You Are Disputing",
  institutionName:"Bank / Institution Name", ssn4:"Last 4 of SSN (for ID only)", dob:"Date of Birth",
};

const MOTIONS = [
  { id:"M01", cat:"FCRA", color:C.blue, icon:"⚖️", title:"FCRA § 609 — Right to Source Documents",
    desc:"Demand original documents used to verify any disputed account.",
    fields:["yourName","yourAddress","bureauName","accountNumber","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\nOffice of General Counsel\n${f.bureauName||"[Bureau]"}\n\nRE: REQUEST FOR METHOD OF VERIFICATION UNDER FCRA § 609\n\nTo the General Counsel,\n\nUnder FCRA § 609 (15 U.S.C. § 1681g), I request all source documentation used to verify account ${f.accountNumber||"[Acct#]"} including: the original signed application, payment history records, furnisher name and contact, and all documents reviewed during investigation.\n\nIf you cannot provide these documents within 30 days, this account must be deleted immediately. Failure to respond constitutes willful non-compliance under § 1681n, subject to $100–$1,000 in statutory damages per violation plus punitive damages.\n\nSent via USPS Certified Mail, Return Receipt Requested.\n\n${f.yourName||"[Name]"}`},

  { id:"M02", cat:"FCRA", color:C.blue, icon:"⚖️", title:"FCRA § 611 — Reinvestigation Demand",
    desc:"Force a real investigation when they claim an item is already 'verified.'",
    fields:["yourName","yourAddress","bureauName","accountNumber","inaccuracyDescription","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\nOffice of General Counsel\n${f.bureauName||"[Bureau]"}\n\nRE: DEMAND FOR PROPER REINVESTIGATION — FCRA § 611\n\nTo the General Counsel,\n\nI dispute account ${f.accountNumber||"[Acct#]"} on the grounds that:\n${f.inaccuracyDescription||"[Describe inaccuracy]"}\n\nYour previous response failed to constitute a reasonable reinvestigation under FCRA § 611(a)(1). You are required to conduct a genuine investigation within 30 days.\n\nIf you cannot verify accuracy with competent evidence, this item must be deleted immediately. Failure will result in federal litigation under § 1681n.\n\n${f.yourName||"[Name]"}`},

  { id:"M03", cat:"FCRA", color:C.blue, icon:"⚖️", title:"Identity Theft — § 605B Block Request",
    desc:"Mandatory 4-day block for accounts opened through identity theft.",
    fields:["yourName","yourAddress","bureauName","accountNumber","creditorName","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\nOffice of General Counsel\n${f.bureauName||"[Bureau]"}\n\nRE: IDENTITY THEFT — MANDATORY BLOCK REQUEST UNDER FCRA § 605B\n\nTo the General Counsel,\n\nAccount ${f.accountNumber||"[Acct#]"} with ${f.creditorName||"[Creditor]"} was opened fraudulently without my knowledge or authorization. I am a victim of identity theft.\n\nUnder FCRA § 605B (15 U.S.C. § 1681c-2), you must BLOCK this information within 4 business days of receiving this notice. This is a statutory block request — not a standard dispute.\n\nAn FTC Identity Theft Report has been filed at IdentityTheft.gov. You may not continue to report this fraudulent account under any circumstances.\n\nFailing to block within 4 business days is a willful violation under § 1681n.\n\n${f.yourName||"[Name]"}`},

  { id:"M04", cat:"FDCPA", color:C.orange, icon:"📬", title:"Debt Validation Letter — FDCPA § 809",
    desc:"Force collectors to prove the debt is valid before paying a single dollar.",
    fields:["yourName","yourAddress","collectorName","collectorAddress","accountNumber","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\n${f.collectorName||"[Collector]"}\n${f.collectorAddress||"[Address]"}\n\nRE: FORMAL DEBT VALIDATION REQUEST — FDCPA § 809(b)\n\nTo Whom It May Concern,\n\nI dispute the alleged debt regarding account ${f.accountNumber||"[Acct#]"}. Under FDCPA § 809(b) I request:\n\n1. Proof your agency is licensed to collect in my state\n2. Proof you own or are authorized to collect this debt\n3. Name and address of the original creditor\n4. Copy of the original signed agreement\n5. Complete payment history showing how the balance was calculated\n6. Proof the Statute of Limitations has not expired\n\nCease all collection activity including credit reporting until validation is provided. Reporting an unvalidated debt is an FDCPA § 1692e(8) violation carrying $1,000 statutory damages per violation.\n\n${f.yourName||"[Name]"}`},

  { id:"M05", cat:"FDCPA", color:C.orange, icon:"📬", title:"Cease & Desist — Stop All Contact",
    desc:"Legally force collectors to stop all calls, texts, and written contact.",
    fields:["yourName","yourAddress","collectorName","collectorAddress","accountNumber","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\n${f.collectorName||"[Collector]"}\n${f.collectorAddress||"[Address]"}\n\nRE: CEASE AND DESIST ALL COMMUNICATIONS — FDCPA § 805(c)\n\nYou are formally notified to CEASE ALL COMMUNICATION regarding account ${f.accountNumber||"[Acct#]"}. This means:\n\n• No telephone calls to any number\n• No text messages or emails\n• No written correspondence (except as permitted by law)\n• No contact through third parties\n• No in-person visits\n\nPermitted communications only: (1) confirm cessation of collection, or (2) notify of specific legal action intended.\n\nAny contact beyond these constitutes a willful FDCPA violation subject to $1,000 per violation in statutory damages.\n\n${f.yourName||"[Name]"}`},

  { id:"M06", cat:"Settlement", color:C.green, icon:"🤝", title:"Pay-for-Delete Agreement",
    desc:"Settle the debt in exchange for complete deletion from all 3 bureaus.",
    fields:["yourName","yourAddress","creditorName","creditorAddress","accountNumber","offerAmount","originalBalance","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\n${f.creditorName||"[Creditor]"}\n${f.creditorAddress||"[Address]"}\n\nRE: SETTLEMENT OFFER AND PAY-FOR-DELETE AGREEMENT\nAccount: ${f.accountNumber||"[Acct#]"}\n\nI propose a one-time settlement of $${f.offerAmount||"[Amount]"} on the alleged balance of $${f.originalBalance||"[Balance]"}, contingent on the following terms:\n\n1. Upon receipt of payment you will DELETE this account entirely from Experian, Equifax, and TransUnion\n2. You will NOT sell or transfer any remaining balance\n3. Written confirmation of deletion provided within 30 days\n4. This constitutes payment in full — no further collection action\n\nIMPORTANT: A "Paid/Settled" notation is NOT acceptable. Complete deletion is required.\n\nPlease respond in writing within 14 days.\n\n${f.yourName||"[Name]"}`},

  { id:"M07", cat:"Settlement", color:C.green, icon:"🤝", title:"Goodwill Deletion Request",
    desc:"Request removal of a legitimate late payment based on your otherwise good history.",
    fields:["yourName","yourAddress","creditorName","creditorAddress","accountNumber","latePaymentDate","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\nCustomer Relations\n${f.creditorName||"[Creditor]"}\n${f.creditorAddress||"[Address]"}\n\nRE: GOODWILL ADJUSTMENT REQUEST — Account ${f.accountNumber||"[Acct#]"}\n\nI am writing to respectfully request removal of the late payment notation from ${f.latePaymentDate||"[Date]"} on my account.\n\nI take full responsibility for this payment. However, my overall history with your organization demonstrates my commitment to honoring my obligations. Since that date I have made all payments on time.\n\nThis single notation is significantly impacting my credit score and financial goals. I humbly ask that you exercise your discretion to remove it as a gesture of goodwill toward a loyal customer.\n\nThank you sincerely for your consideration.\n\n${f.yourName||"[Name]"}`},

  { id:"M08", cat:"Medical & HIPAA", color:C.purple, icon:"🏥", title:"HIPAA Violation — Medical Debt",
    desc:"Medical collectors who reported without HIPAA authorization are liable.",
    fields:["yourName","yourAddress","collectorName","bureauName","accountNumber","medicalProvider","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\nOffice of General Counsel\n${f.collectorName||"[Collector/Bureau]"}\n\nRE: HIPAA VIOLATION — UNAUTHORIZED DISCLOSURE OF PROTECTED HEALTH INFORMATION\nAccount: ${f.accountNumber||"[Acct#]"}\n\n${f.collectorName||"[Collector]"} has violated HIPAA by disclosing my protected health information (PHI) to credit reporting agencies without my written authorization. The medical account from ${f.medicalProvider||"[Provider]"} constitutes PHI under 45 CFR § 164.502.\n\nNo Business Associate Agreement or written HIPAA authorization was obtained prior to disclosure to ${f.bureauName||"[Bureau]"}.\n\nHIPAA penalties include $100–$50,000 per violation and criminal penalties up to $250,000.\n\nDEMANDS:\n1. Retract this medical debt from all credit bureaus immediately\n2. Provide written confirmation of deletion within 14 days\n3. Cease all further PHI disclosure\n\nA complaint has been filed with the HHS Office for Civil Rights.\n\n${f.yourName||"[Name]"}`},

  { id:"M09", cat:"Medical & HIPAA", color:C.purple, icon:"🏥", title:"Dual FDCPA + HIPAA Attack",
    desc:"Hit medical collectors with both FDCPA validation AND HIPAA authorization demands simultaneously.",
    fields:["yourName","yourAddress","collectorName","collectorAddress","accountNumber","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\n${f.collectorName||"[Collector]"}\n${f.collectorAddress||"[Address]"}\n\nRE: DUAL NOTICE — DEBT VALIDATION (FDCPA § 809) + HIPAA AUTHORIZATION DEMAND\nAccount: ${f.accountNumber||"[Acct#]"}\n\nNOTICE 1 — FDCPA VALIDATION:\nUnder § 809(b) I dispute this debt and demand full validation including the original signed agreement, complete payment history, and proof you are licensed to collect in my state. Cease all collection and credit reporting until provided.\n\nNOTICE 2 — HIPAA AUTHORIZATION:\nAs this is a medical debt, provide:\n1. My signed HIPAA authorization permitting PHI disclosure\n2. A valid Business Associate Agreement with the original provider\n3. Proof this disclosure complied with 45 CFR § 164.502\n\nFailure to produce both within 30 days requires immediate cessation of all collection activity and retraction from all credit bureaus.\n\n${f.yourName||"[Name]"}`},

  { id:"M10", cat:"Government", color:C.teal, icon:"🏛️", title:"CFPB Complaint — Step-by-Step Guide",
    desc:"Bureaus get fined for CFPB complaints. This guide walks you through filing.",
    fields:["yourName","bureauName","accountNumber","issueDescription","date"],
    body:(f)=>`CFPB COMPLAINT FILING GUIDE\nFor: ${f.yourName||"[Name]"} | Date: ${f.date||"[Date]"}\n${"─".repeat(50)}\n\nSTEP 1: Go to consumerfinance.gov/complaint\nSTEP 2: Click "Submit a Complaint"\nSTEP 3: Select "Credit reporting, credit repair services, or other personal consumer reports"\nSTEP 4: Select "${f.bureauName||"[Bureau]"}" as the company\n\nUSE THIS EXACT DESCRIPTION:\n${"─".repeat(50)}\nI am filing a formal complaint against ${f.bureauName||"[Bureau]"} for FCRA violations regarding account ${f.accountNumber||"[Acct#]"}.\n\n${f.issueDescription||"[Describe the issue: what was inaccurate, how you disputed it, how they responded, how it harmed you]"}\n\nDespite written disputes sent via USPS Certified Mail to the Office of General Counsel, ${f.bureauName||"[Bureau]"} failed to properly investigate in violation of FCRA § 611. My desired resolution: immediate deletion and written confirmation.\n${"─".repeat(50)}\n\nWHY THIS WORKS:\n• Bureaus are fined per unresolved CFPB complaint\n• CFPB forwards directly to the bureau — they must respond in 15 days\n• Creates an official federal paper trail\n• Much more pressure than a standard dispute`},

  { id:"M11", cat:"Government", color:C.teal, icon:"🏛️", title:"FTC Identity Theft Report Guide",
    desc:"Required to activate your strongest FCRA rights. File before sending 605B letters.",
    fields:["yourName","yourAddress","theftDescription","fraudAccounts","date"],
    body:(f)=>`FTC IDENTITY THEFT REPORT GUIDE\nFor: ${f.yourName||"[Name]"} | Date: ${f.date||"[Date]"}\n${"─".repeat(50)}\n\nSTEP 1: Go to IdentityTheft.gov\nSTEP 2: Click "Get Started" and select your situation\nSTEP 3: Complete the online report using the info below\nSTEP 4: Download your official FTC Identity Theft Report PDF\nSTEP 5: Send this report WITH your § 605B Block Request letters\n\nYOUR INFORMATION FOR THE FORM:\n${"─".repeat(50)}\nName: ${f.yourName||"[Name]"}\nAddress: ${f.yourAddress||"[Address]"}\n\nHow the theft occurred:\n${f.theftDescription||"[When you discovered it, what happened, any details about how it occurred]"}\n\nFraudulent accounts:\n${f.fraudAccounts||"[List each: Creditor name, account number, approx. opening date, amount]"}\n\nAFTER FILING:\n${"─".repeat(50)}\n• Bureaus MUST block fraudulent accounts within 4 business days of receiving this report + a 605B letter\n• File a police report at your local precinct\n• Place a FREE Credit Freeze at all 3 bureaus\n• This creates an official federal record — bureaus cannot ignore it`},

  { id:"M12", cat:"Trademark", color:C.gold, icon:"™️", title:"Lanham Act — Full Infringement Notice",
    desc:"USPTO trademark registered. This is the letter that forces bureau attorneys to respond.",
    fields:["yourName","yourAddress","trademarkName","trademarkRegNo","bureauName","accountNumber","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\nOffice of General Counsel\n${f.bureauName||"[Bureau]"}\n\nRE: FORMAL NOTICE OF TRADEMARK INFRINGEMENT & DEMAND FOR DAMAGES\n    Lanham Act 15 U.S.C. § 1125 | USPTO Reg. No. ${f.trademarkRegNo||"[Reg#]"}\n\nTo the General Counsel,\n\nI am the owner of federally registered trademark "${f.trademarkName||"[TM Name]"}" (USPTO Reg. No. ${f.trademarkRegNo||"[Reg#]"}).\n\n${f.bureauName||"[Bureau]"} is utilizing my registered trademark in connection with false and unauthorized financial reporting, specifically account ${f.accountNumber||"[Acct#]"}. This constitutes:\n\n1. Trademark Infringement — 15 U.S.C. § 1114\n2. False Designation of Origin — 15 U.S.C. § 1125(a)\n3. Trademark Dilution by Tarnishment — 15 U.S.C. § 1125(c)\n\nDEMAND — within 14 days:\n1. Remove account ${f.accountNumber||"[Acct#]"} entirely from my credit file\n2. Cease all commercial use of my trademark in credit reporting\n3. Remit $10,000 in compensatory damages for trademark dilution\n\nFailure to comply will result in immediate federal complaint seeking up to $2,000,000 in statutory damages under 15 U.S.C. § 1117.\n\nGovern yourself accordingly.\n\n${f.yourName||"[Name]"}`},

  { id:"M13", cat:"Trademark", color:C.gold, icon:"™️", title:"Lanham Act — 72-Hour Final Escalation",
    desc:"14 days passed. No action. This is your final notice before federal filing.",
    fields:["yourName","yourAddress","trademarkName","trademarkRegNo","bureauName","accountNumber","certifiedMailDate","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\nOffice of General Counsel\n${f.bureauName||"[Bureau]"}\n\nRE: SECOND AND FINAL NOTICE — TRADEMARK INFRINGEMENT\n    NOTICE OF WILLFUL NON-COMPLIANCE — IMMINENT FEDERAL FILING\n\nOn ${f.certifiedMailDate||"[First Letter Date]"} you received via Certified Mail a formal Trademark Infringement Notice regarding "${f.trademarkName||"[TM]"}" (Reg. No. ${f.trademarkRegNo||"[Reg#]"}) and account ${f.accountNumber||"[Acct#]"}.\n\nYou have failed to comply within 14 days.\n\nThis constitutes WILLFUL NON-COMPLIANCE, which elevates damages under 15 U.S.C. § 1117(b) to:\n• Trebled actual damages\n• Up to $2,000,000 statutory damages per mark infringed\n• Mandatory attorney's fees\n\nFINAL DEMAND — 72 HOURS:\n1. Remove account ${f.accountNumber||"[Acct#]"} entirely from my credit file\n2. Provide written confirmation via certified mail\n\nAfter 72 hours I will file in United States District Court without further notice. This letter has been copied to the CFPB, FTC, and USPTO.\n\nGovern yourself accordingly.\n\n${f.yourName||"[Name]"}`},

  { id:"M14", cat:"Re-Aging", color:C.red, icon:"📅", title:"Re-Aged Debt Dispute",
    desc:"Collectors who reset the clock on old debt are violating FCRA § 605.",
    fields:["yourName","yourAddress","bureauName","accountNumber","originalDelinquencyDate","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\nOffice of General Counsel\n${f.bureauName||"[Bureau]"}\n\nRE: DISPUTE OF RE-AGED ACCOUNT — FCRA § 605 VIOLATION\nAccount: ${f.accountNumber||"[Acct#]"}\n\nThe original date of first delinquency on account ${f.accountNumber||"[Acct#]"} was ${f.originalDelinquencyDate||"[Date]"}. Under FCRA § 605(a)(4), negative items may only appear for SEVEN YEARS from the date of first delinquency.\n\nThe date currently reported has been illegally re-aged, extending the reporting period beyond what federal law permits. Re-aging is prohibited under FCRA § 623(a)(5).\n\nDEMAND:\n1. Immediately delete this account — it has exceeded or is improperly reporting its lawful period\n2. Provide the original date of first delinquency with documentation within 14 days\n\nContinued reporting of a re-aged account constitutes willful non-compliance under § 1681n.\n\n${f.yourName||"[Name]"}`},

  { id:"M15", cat:"Re-Aging", color:C.red, icon:"📅", title:"Statute of Limitations Defense",
    desc:"Stop collectors from trying to sue on time-barred debt.",
    fields:["yourName","yourAddress","collectorName","collectorAddress","accountNumber","debtState","originalDelinquencyDate","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\n${f.collectorName||"[Collector]"}\n${f.collectorAddress||"[Address]"}\n\nRE: STATUTE OF LIMITATIONS EXPIRED — CEASE ALL COLLECTION\nAccount: ${f.accountNumber||"[Acct#]"}\n\nThe debt you are attempting to collect is TIME-BARRED under the statute of limitations in ${f.debtState||"[State]"}. The original delinquency date was ${f.originalDelinquencyDate||"[Date]"}, which exceeds the applicable statute.\n\nAttempting to collect a time-barred debt without disclosing it cannot be legally enforced is a deceptive practice under FDCPA § 807. Attempting to sue on it is unfair under § 808.\n\nDEMAND:\n1. Cease all collection activity immediately\n2. Remove this account from my credit report\n3. Confirm in writing that collection has ceased\n\nAny lawsuit attempt will be defended and countered with FDCPA violation claims.\n\n${f.yourName||"[Name]"}`},

  { id:"M16", cat:"Inquiries", color:C.blue, icon:"🔍", title:"Unauthorized Hard Inquiry Removal",
    desc:"Hard inquiries you never authorized must be removed — each one drops your score.",
    fields:["yourName","yourAddress","bureauName","creditorName","inquiryDate","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\nOffice of General Counsel\n${f.bureauName||"[Bureau]"}\n\nRE: DEMAND FOR REMOVAL OF UNAUTHORIZED HARD INQUIRY\nCreditor: ${f.creditorName||"[Creditor]"} | Date: ${f.inquiryDate||"[Date]"}\n\nI am disputing an unauthorized hard inquiry by ${f.creditorName||"[Creditor]"} on ${f.inquiryDate||"[Date]"}. I did not authorize this inquiry. Under FCRA § 604 (15 U.S.C. § 1681b), credit reports may only be pulled with a permissible purpose connected to a consumer-initiated transaction.\n\nThis unauthorized inquiry:\n• Violates FCRA § 604\n• Constitutes an invasion of my financial privacy\n• Unlawfully damages my credit score\n\nDEMAND:\n1. Remove this inquiry immediately\n2. Provide documentation of the permissible purpose claimed\n3. Confirm removal in writing within 30 days\n\nIf permissible purpose cannot be verified, deletion is required under FCRA § 611.\n\n${f.yourName||"[Name]"}`},

  { id:"M17", cat:"Student Loans", color:C.purple, icon:"🎓", title:"Student Loan Servicer Error Dispute",
    desc:"Challenge wrong payment history, balances, or status on student loans.",
    fields:["yourName","yourAddress","bureauName","servicerName","loanAccountNumber","inaccuracyDescription","date"],
    body:(f)=>`${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\nOffice of General Counsel\n${f.bureauName||"[Bureau]"}\n\nRE: DISPUTE OF INACCURATE STUDENT LOAN REPORTING\nServicer: ${f.servicerName||"[Servicer]"} | Account: ${f.loanAccountNumber||"[Acct#]"}\n\nI formally dispute inaccurate information regarding my student loan with ${f.servicerName||"[Servicer]"}:\n\n${f.inaccuracyDescription||"[Describe the specific error: incorrect payment history, wrong balance, wrong status, duplicate reporting, etc.]"}\n\nStudent loan servicers frequently report errors following servicer transfers, forbearance periods, and payment pause adjustments. This violates FCRA § 611 and § 623(a)(1) which requires furnishers to report accurate information.\n\nDEMAND:\n1. Investigate with ${f.servicerName||"[Servicer]"} directly\n2. Correct reporting to accurately reflect my loan status\n3. Provide written confirmation within 30 days\n\n${f.yourName||"[Name]"}`},

  { id:"M18", cat:"Business Credit", color:C.teal, icon:"🏦", title:"D&B Business File Dispute",
    desc:"Correct inaccurate information on your Dun & Bradstreet business credit file.",
    fields:["businessName","businessAddress","ein","dunsNumber","inaccuracyDescription","contactName","date"],
    body:(f)=>`${f.businessName||"[Business]"}\n${f.businessAddress||"[Address]"}\nEIN: ${f.ein||"[EIN]"} | DUNS: ${f.dunsNumber||"[DUNS]"}\n\n${f.date||"[Date]"}\n\nOffice of General Counsel\nDun & Bradstreet\n103 JFK Parkway, Short Hills, NJ 07078\n\nRE: FORMAL DISPUTE OF INACCURATE BUSINESS CREDIT INFORMATION\n\nI am the authorized representative of ${f.businessName||"[Business]"}. I formally dispute the following inaccuracy on our D&B file:\n\n${f.inaccuracyDescription||"[Describe: incorrect payment history, wrong address, wrong business info, duplicate accounts, etc.]"}\n\nThis inaccuracy damages our creditworthiness and prevents access to business credit we would otherwise qualify for.\n\nDEMAND within 30 days:\n1. Investigate and correct or delete the inaccurate information\n2. Provide written confirmation\n3. Update all subscribers who received this inaccurate data\n\n${f.contactName||"[Your Name]"}\nAuthorized Representative, ${f.businessName||"[Business]"}`},

  { id:"M19", cat:"Business Credit", color:C.teal, icon:"🏦", title:"Experian Business File Dispute",
    desc:"Dispute inaccurate items on your Experian Business credit report.",
    fields:["businessName","businessAddress","ein","inaccuracyDescription","contactName","date"],
    body:(f)=>`${f.businessName||"[Business]"}\n${f.businessAddress||"[Address]"}\nEIN: ${f.ein||"[EIN]"}\n\n${f.date||"[Date]"}\n\nOffice of General Counsel\nExperian Business Information Services\n475 Anton Blvd, Costa Mesa, CA 92626\n\nRE: FORMAL DISPUTE OF INACCURATE BUSINESS CREDIT INFORMATION\n\nI am the authorized representative of ${f.businessName||"[Business]"}. I formally dispute the following on our Experian Business file:\n\n${f.inaccuracyDescription||"[Describe the inaccuracy]"}\n\nThis materially harms our ability to obtain business credit and financing.\n\nDEMAND:\n1. Conduct a proper investigation within 30 days\n2. Correct or delete the inaccurate information\n3. Provide written confirmation\n\nFailure will result in formal CFPB and FTC complaints, plus legal action for damages from inaccurate business credit reporting.\n\n${f.contactName||"[Your Name]"}\n${f.businessName||"[Business]"}`},

  { id:"M20", cat:"Federal Court", color:C.red, icon:"💥", title:"Federal Court Complaint Template",
    desc:"FCRA allows you to sue in federal court. This is the template. The ultimate escalation.",
    fields:["yourName","yourAddress","bureauName","bureauAddress","claimDescription","damagesAmount","date"],
    body:(f)=>`UNITED STATES DISTRICT COURT — [YOUR DISTRICT]\n${"─".repeat(60)}\n${f.yourName||"[YOUR NAME]"},\n                              Plaintiff,\n         v.                          Case No.: ___________\n\n${f.bureauName||"[BUREAU NAME]"},\n                              Defendant.\n${"─".repeat(60)}\n\nCOMPLAINT FOR VIOLATIONS OF THE FAIR CREDIT REPORTING ACT\n(15 U.S.C. §§ 1681 et seq.)\n\nJURISDICTION: 28 U.S.C. § 1331 and 15 U.S.C. § 1681p\n\nPLAINTIFF: ${f.yourName||"[Name]"}, ${f.yourAddress||"[Address]"}\nDEFENDANT: ${f.bureauName||"[Bureau]"}, ${f.bureauAddress||"[Address]"}\n\nFACTUAL ALLEGATIONS:\n${f.claimDescription||"[Describe FCRA violations: what was inaccurate, when you disputed, what bureau did, how you were harmed]"}\n\nPlaintiff sent written disputes via USPS Certified Mail, Return Receipt Requested. Defendant failed to conduct a proper reinvestigation under FCRA § 611 and continues to report inaccurate information willfully.\n\nCOUNT I — WILLFUL NON-COMPLIANCE (15 U.S.C. § 1681n)\nStatutory damages $100–$1,000 per violation + punitive damages + attorney's fees\n\nCOUNT II — NEGLIGENT NON-COMPLIANCE (15 U.S.C. § 1681o)\nActual damages + attorney's fees\n\nPRAYER FOR RELIEF:\n1. Order deletion of the disputed item\n2. Statutory damages of $${f.damagesAmount||"[Amount]"}\n3. Punitive damages as the Court deems just\n4. Attorney's fees and costs\n\n${f.yourName||"[Name]"}, Pro Se Plaintiff\n${f.date||"[Date]"}\n\n─ NOTE: Consult an attorney before filing. Federal filing fee ~$405. ─`},

  // ─── BREACH STRATEGY TEMPLATES (M21–M22) ───────────────────────────────
  { id:"M21", cat:"Data Breach", color:C.red, icon:"🔓", title:"Data Breach Integrity Dispute — All Bureaus",
    desc:"Challenge any bureau's ability to verify accounts using data exposed in a known breach.",
    fields:["bureauName","bureauAddress","accountNumber","breachName","breachYear","yourName","yourAddress","date"],
    body:(f)=>`${f.yourName||"[Your Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\nOffice of General Counsel\n${f.bureauName||"[Bureau Name]"}\n${f.bureauAddress||"[Bureau Address]"}\n\nRE: FORMAL NOTICE OF DATA INTEGRITY DISPUTE — FCRA 15 U.S.C. § 1681e(b)\n    DATA BREACH: ${f.breachName||"[Breach Name]"} (${f.breachYear||"[Year]"})\n    ACCOUNT: ${f.accountNumber||"[Account Number]"}\n\nTo the General Counsel,\n\nI am writing to formally dispute the accuracy and integrity of account ${f.accountNumber||"[Account #]"} currently appearing on my credit file.\n\nMy personal identifying information — including my Social Security Number, date of birth, address history, and financial account data — was confirmed to have been exposed in the ${f.breachName||"[Breach Name]"} data breach of ${f.breachYear||"[Year]"}.\n\nAs a direct result of this breach, you cannot meet the FCRA § 1681e(b) standard of "maximum possible accuracy" when verifying any account tied to my compromised data. The chain of custody of my personal information has been irreparably broken, rendering automated verification of this account legally insufficient under the Act.\n\nDEMAND:\n1. Conduct a thorough, manual investigation that does not rely on the compromised data points exposed in the ${f.breachName||"[Breach]"} breach\n2. Provide your full Method of Verification for account ${f.accountNumber||"[Acct#]"} within 14 days\n3. Delete this account if you cannot verify it using uncompromised data sources\n\nFailure to respond within 14 days will be treated as willful non-compliance, triggering federal litigation for statutory damages under 15 U.S.C. § 1681n.\n\nGovern yourself accordingly.\n\nRespectfully,\n${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}`},

  { id:"M22", cat:"Data Breach", color:C.red, icon:"⚖️", title:"Equifax Breach Victim Dispute — Equifax Only",
    desc:"Special version for Equifax — uses their own breach settlement as leverage against them.",
    fields:["accountNumber","yourName","yourAddress","date"],
    body:(f)=>`${f.yourName||"[Your Name]"}\n${f.yourAddress||"[Address]"}\n\n${f.date||"[Date]"}\n\nOffice of General Counsel\nEquifax Information Services LLC\n1550 Peachtree Street NW\nAtlanta, GA 30309\n\nRE: FORMAL DISPUTE — EQUIFAX BREACH VICTIM — FCRA 15 U.S.C. § 1681e(b)\n    ACCOUNT: ${f.accountNumber||"[Account Number]"}\n\nTo the General Counsel,\n\nI formally dispute account ${f.accountNumber||"[Account #]"} appearing on my Equifax credit file.\n\nI am a confirmed victim of the Equifax data breach (Federal Trade Commission v. Equifax Inc., 2019 FTC Settlement). My Social Security Number, date of birth, address, and credit account information were among the 147 million consumer records exposed through Equifax's own security failures.\n\nThis creates a unique legal problem for Equifax: you are the consumer reporting agency attempting to "verify" account information using my personal data — the same data your organization failed to protect. Equifax cannot credibly claim to meet the FCRA § 1681e(b) standard of "maximum possible accuracy" when verifying accounts using credentials that your own systems allowed criminals to steal.\n\nVerifying negative information using compromised data is not verification. It is a compounding of the original harm.\n\nDEMAND:\n1. Immediately suspend automated verification of this account\n2. Conduct a manual investigation using original source documents from the furnisher only\n3. Provide a full Method of Verification within 14 days showing you did NOT rely on my previously-compromised personal identifiers\n4. Delete this account if you cannot verify it through uncompromised methods\n\nEquifax's status as the breaching party does not reduce its FCRA obligations — it heightens them. Continued reporting of this account after this notice will be treated as willful non-compliance under 15 U.S.C. § 1681n.\n\nGovern yourself accordingly.\n\n${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}`},

  // ─── SPECIALTY BUREAU TEMPLATES (M23–M26) ───────────────────────────────
  { id:"M23", cat:"Specialty Bureaus", color:C.purple, icon:"🏦", title:"ChexSystems Dispute Letter",
    desc:"Dispute inaccurate records in your ChexSystems consumer file.",
    fields:["recordDescription","institutionName","yourName","yourAddress","ssn4","date"],
    body:(f)=>`${f.yourName||"[Your Name]"}\n${f.yourAddress||"[Address]"}\nSSN (last 4): ${f.ssn4||"XXXX"}\n\n${f.date||"[Date]"}\n\nChexSystems, Inc.\nAttn: Consumer Relations\n7805 Hudson Road, Suite 100\nWoodbury, MN 55125\n\nRE: FORMAL DISPUTE OF INACCURATE CONSUMER BANKING RECORD\n    FCRA 15 U.S.C. § 1681 et seq.\n\nTo the Consumer Relations Department,\n\nI am writing to formally dispute the following inaccurate record in my ChexSystems consumer file:\n\nReported Institution: ${f.institutionName||"[Bank/Institution Name]"}\nDescription of Error: ${f.recordDescription||"[Describe what is inaccurate: wrong amount, wrong dates, not my account, account was resolved, etc.]"}\n\nThis record is inaccurate and its continued reporting violates the FCRA's requirement that consumer reporting agencies maintain "maximum possible accuracy" under 15 U.S.C. § 1681e(b).\n\nDEMAND:\n1. Conduct a full investigation of this disputed record within 30 days as required by FCRA § 611\n2. Contact ${f.institutionName||"[Institution]"} and verify the accuracy of this record\n3. Correct or delete this record if it cannot be verified as accurate\n4. Provide written confirmation of your investigation results\n\nFailure to investigate and respond will result in a formal complaint to the Consumer Financial Protection Bureau and the Federal Trade Commission.\n\nRespectfully,\n${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}`},

  { id:"M24", cat:"Specialty Bureaus", color:C.purple, icon:"🏦", title:"Early Warning Services Dispute Letter",
    desc:"Dispute records in your Early Warning Services (EWS) file — controls Zelle and major bank access.",
    fields:["recordDescription","institutionName","yourName","yourAddress","ssn4","date"],
    body:(f)=>`${f.yourName||"[Your Name]"}\n${f.yourAddress||"[Address]"}\nSSN (last 4): ${f.ssn4||"XXXX"}\n\n${f.date||"[Date]"}\n\nEarly Warning Services, LLC\nAttn: Consumer Services\n16552 N. 90th Street\nScottsdale, AZ 85260\n\nRE: FORMAL DISPUTE — EARLY WARNING SERVICES CONSUMER FILE\n    FCRA 15 U.S.C. § 1681 et seq.\n\nTo the Consumer Services Department,\n\nI am writing to formally dispute the following inaccurate record in my Early Warning Services consumer file:\n\nReporting Institution: ${f.institutionName||"[Bank Name]"}\nDescription of Disputed Record: ${f.recordDescription||"[Describe the inaccuracy]"}\n\nThis record is inaccurate. Its continued reporting is causing me direct harm by restricting my access to banking services and the Zelle payment network in violation of my rights under the FCRA.\n\nUnder FCRA § 611, EWS is required to investigate this dispute within 30 days and correct or delete any information that cannot be verified as accurate.\n\nDEMAND:\n1. Conduct a full investigation within 30 days\n2. Verify the accuracy of this record with ${f.institutionName||"[Institution]"}\n3. Correct or delete if verification fails\n4. Provide written results of your investigation\n5. Immediately restore my full access to the EWS network pending investigation\n\nCFPB complaint will follow if this is not resolved within 30 days.\n\n${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}`},

  { id:"M25", cat:"Specialty Bureaus", color:C.purple, icon:"🔍", title:"LexisNexis Dispute Letter",
    desc:"Dispute inaccurate information in your LexisNexis Risk Solutions full file disclosure.",
    fields:["inaccuracyDescription","yourName","yourAddress","dob","ssn4","date"],
    body:(f)=>`${f.yourName||"[Your Name]"}\n${f.yourAddress||"[Address]"}\nDate of Birth: ${f.dob||"[DOB]"}\nSSN (last 4): ${f.ssn4||"XXXX"}\n\n${f.date||"[Date]"}\n\nLexisNexis Risk Solutions\nAttn: Consumer Center\nP.O. Box 105108\nAtlanta, GA 30348-5108\n\nRE: FORMAL DISPUTE OF INACCURATE CONSUMER REPORT INFORMATION\n    FCRA 15 U.S.C. § 1681 et seq.\n\nTo the Consumer Relations Department,\n\nI recently obtained my Full File Disclosure from LexisNexis Risk Solutions and have identified the following inaccurate information:\n\n${f.inaccuracyDescription||"[Describe each inaccuracy: wrong address, incorrect court record, wrong dates, information that is not yours, outdated information past FCRA retention limits, etc.]"}\n\nAs a consumer reporting agency subject to the FCRA, LexisNexis is required to maintain maximum possible accuracy in consumer files and to investigate and correct disputed information within 30 days.\n\nDEMAND:\n1. Conduct a full and proper investigation of each disputed item within 30 days per FCRA § 611\n2. Delete or correct all information that cannot be verified as accurate\n3. Provide written notice of the results of your investigation\n4. Provide the name and contact information of each source you contact during the investigation\n\nFailure to comply will result in a formal complaint to the CFPB, FTC, and consideration of legal action under 15 U.S.C. § 1681n.\n\nRespectfully,\n${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}`},

  { id:"M26", cat:"Specialty Bureaus", color:C.purple, icon:"📋", title:"Generic Specialty Bureau Dispute",
    desc:"Universal dispute letter for Teletrack, DataX, Clarity, Sagestream, MicroBilt, Innovis, or any specialty bureau.",
    fields:["bureauName","bureauAddress","inaccuracyDescription","yourName","yourAddress","ssn4","date"],
    body:(f)=>`${f.yourName||"[Your Name]"}\n${f.yourAddress||"[Address]"}\nSSN (last 4): ${f.ssn4||"XXXX"}\n\n${f.date||"[Date]"}\n\n${f.bureauName||"[Bureau Name]"}\n${f.bureauAddress||"[Bureau Address]"}\n\nRE: FORMAL CONSUMER DISPUTE — FCRA 15 U.S.C. § 1681 et seq.\n\nTo the Consumer Relations Department,\n\nI am writing to formally dispute inaccurate information in my consumer file maintained by ${f.bureauName||"[Bureau]"}.\n\nDisputed Information:\n${f.inaccuracyDescription||"[Describe the inaccuracy in detail: account number, creditor name, reported amount, reported dates, and specifically what is wrong]"}\n\nAs a consumer reporting agency subject to the Fair Credit Reporting Act, ${f.bureauName||"[Bureau]"} is required to:\n• Maintain maximum possible accuracy in consumer files (FCRA § 1681e(b))\n• Investigate consumer disputes within 30 days (FCRA § 1681i)\n• Delete or correct any information that cannot be verified\n• Notify me of the results of the investigation\n\nDEMAND:\n1. Investigate this dispute within 30 days\n2. Provide the method and sources used to verify this information\n3. Correct or delete all information that cannot be verified as completely accurate\n4. Send written confirmation of all changes made to my file\n\nNote: This dispute is being sent via USPS Certified Mail, Return Receipt Requested, and constitutes formal legal notice under the FCRA.\n\nFailure to comply will result in CFPB and FTC complaints, and consideration of federal litigation for statutory damages under 15 U.S.C. § 1681n.\n\nGovern yourself accordingly.\n\n${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}`},
];

const MOTION_CATS = [...new Set(MOTIONS.map(m=>m.cat))];
const CAT_COLOR = {"FCRA":C.blue,"FDCPA":C.orange,"Settlement":C.green,"Medical & HIPAA":C.purple,"Government":C.teal,"Trademark":C.gold,"Re-Aging":C.red,"Inquiries":C.blue,"Student Loans":C.purple,"Business Credit":C.teal,"Federal Court":C.red,"Data Breach":C.red,"Specialty Bureaus":C.purple};

// ─── DATA ─────────────────────────────────────────────────────────────────────
const LETTERS=[
  {id:"L1",tag:"FCRA § 1681i",color:C.blue,title:"Demand Removal — Fraudulent Account",desc:"Account is fraudulent or identity theft.",fields:["bureauName","accountNumber","yourName","yourAddress","date"],template:f=>`TO: Office of General Counsel, ${f.bureauName||"[Bureau]"}\nRE: FORMAL NOTICE OF FRAUDULENT ACCOUNT — FCRA 15 U.S.C. § 1681i\nDate: ${f.date||"[Date]"}\n\nTo the General Counsel,\n\nI, ${f.yourName||"[Name]"}, of ${f.yourAddress||"[Address]"}, formally demand deletion of account ${f.accountNumber||"[Acct#]"} from my credit file. Continued reporting violates FCRA § 1681e(b). You are now on formal notice.\n\nDEMAND: Remove within 14 days or face federal litigation under 15 U.S.C. § 1681n.\n\nGovern yourself accordingly.\n\n${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}`},
  {id:"L2",tag:"FCRA § 1681e",color:C.green,title:"Correction of False Payment History",desc:"Inaccurate late payments or wrong dates.",fields:["bureauName","accountNumber","yourName","yourAddress","date"],template:f=>`TO: Office of General Counsel, ${f.bureauName||"[Bureau]"}\nRE: DEMAND FOR CORRECTION — FCRA 15 U.S.C. § 1681e(b)\nDate: ${f.date||"[Date]"}\n\nTo the General Counsel,\n\nI, ${f.yourName||"[Name]"}, write regarding account ${f.accountNumber||"[Acct#]"}. My records confirm this account was paid as agreed. Your reporting reflects inaccurate late payments — a systemic verification failure.\n\nDEMAND: Update to "Paid as Agreed" within 14 days.\n\n${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}`},
  {id:"L3",tag:"Lanham Act § 1125",color:C.gold,title:"Trademark Infringement & $10K Damages",desc:"Your name is a registered USPTO trademark.",fields:["bureauName","trademarkName","trademarkRegNo","yourName","yourAddress","date"],template:f=>`TO: Office of General Counsel, ${f.bureauName||"[Bureau]"}\nRE: NOTICE OF TRADEMARK INFRINGEMENT — Lanham Act 15 U.S.C. § 1125\nDate: ${f.date||"[Date]"}\n\nTo the General Counsel,\n\nYou are utilizing my registered trademark "${f.trademarkName||"[TM]"}" (Reg. No. ${f.trademarkRegNo||"[#]"}) in unauthorized financial reporting — trademark dilution and a commercial tort.\n\nDEMAND:\n1. Cease all use of my trademark in these reports\n2. Remit $10,000 for willful trademark dilution\n\nFederal complaint within 14 days of non-compliance.\n\nGovern yourself accordingly.\n\n${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}`},
  {id:"L4",tag:"FCRA § 1681",color:C.purple,title:"Method of Verification Demand",desc:"They sent a generic verified letter with no proof.",fields:["bureauName","accountNumber","yourName","yourAddress","date"],template:f=>`TO: Office of General Counsel, ${f.bureauName||"[Bureau]"}\nRE: NOTICE OF WILLFUL NON-COMPLIANCE — METHOD OF VERIFICATION DEMAND\nDate: ${f.date||"[Date]"}\n\nTo the General Counsel,\n\nYou stated investigation of account ${f.accountNumber||"[Acct#]"} is "complete" but failed to provide the Method of Verification (MOV) required under FCRA. This proves non-compliance.\n\nDEMAND: Delete this entry within 14 days or face federal court action.\n\n${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}`},
  {id:"L5",tag:"Secondary Notice",color:C.orange,title:"Secondary Notice After Refusal",desc:"They verified the item despite your evidence.",fields:["bureauName","accountNumber","yourName","yourAddress","date"],template:f=>`TO: Office of General Counsel, ${f.bureauName||"[Bureau]"}\nRE: SECONDARY NOTICE OF INACCURACY AND DEMAND FOR CORRECTION\nDate: ${f.date||"[Date]"}\n\nTo the General Counsel,\n\nYour "verification" of account ${f.accountNumber||"[Acct#]"} ignored my verified evidence — a direct violation of 15 U.S.C. § 1681e(b).\n\nDEMAND: Update to "Paid as Agreed" within 14 days. Failure results in action for actual and punitive damages.\n\n${f.yourName||"[Name]"}\n${f.yourAddress||"[Address]"}`},
];
const FL_LETTER={bureauName:"Credit Bureau Name",accountNumber:"Account Number",yourName:"Full Legal Name",yourAddress:"Mailing Address",date:"Today's Date",trademarkName:"Trademark Name",trademarkRegNo:"USPTO Reg. Number"};
const CHECKLIST_ITEMS=[
  {id:"c1",cat:"🏢 Entity Setup",label:"Form LLC or Corporation (not sole prop)",link:"https://irs.gov"},
  {id:"c2",cat:"🏢 Entity Setup",label:"Get free EIN at irs.gov",link:"https://www.irs.gov/businesses/small-businesses-self-employed/apply-for-an-employer-identification-number-ein-online"},
  {id:"c3",cat:"🏢 Entity Setup",label:"File Articles of Incorporation with Secretary of State"},
  {id:"c4",cat:"🏢 Entity Setup",label:"Open dedicated business bank account"},
  {id:"c5",cat:"📍 Credibility",label:"Get virtual business address (Regus, etc.)",link:"https://regus.com"},
  {id:"c6",cat:"📍 Credibility",label:"Set up toll-free number (RingCentral ~$15/mo)",link:"https://ringcentral.com"},
  {id:"c7",cat:"📍 Credibility",label:"Build professional website (Wix + Upwork = $150–300)",link:"https://wix.com"},
  {id:"c8",cat:"📍 Credibility",label:"Create pro email — name@yourbiz.com (no Gmail)"},
  {id:"c9",cat:"📍 Credibility",label:"List business on 411 (ListYourself ~$30/mo)"},
  {id:"c10",cat:"📊 D&B Setup",label:"Apply for free DUNS at dnb.com",link:"https://dnb.com"},
  {id:"c11",cat:"📊 D&B Setup",label:"Pull D&B, Experian & Equifax business reports"},
  {id:"c12",cat:"📊 D&B Setup",label:"Dispute any inaccurate items on business reports"},
  {id:"c13",cat:"💳 Vendors",label:"Apply: Quill.com (D&B)",link:"https://quill.com"},
  {id:"c14",cat:"💳 Vendors",label:"Apply: Grainger — order $50+ (D&B)",link:"https://grainger.com"},
  {id:"c15",cat:"💳 Vendors",label:"Apply: Uline Shipping (D&B)",link:"https://uline.com"},
  {id:"c16",cat:"💳 Vendors",label:"Apply: Reliable/Office Depot (D&B + EXP + EQ)"},
  {id:"c17",cat:"💳 Vendors",label:"Apply: Monopolize Your Marketplace (Experian)"},
  {id:"c18",cat:"🔄 Revolving",label:"Wait for 5 vendor accounts to report (60–90 days)"},
  {id:"c19",cat:"🔄 Revolving",label:"Apply: Dell Business — call 800-999-3355"},
  {id:"c20",cat:"🔄 Revolving",label:"Apply: Amazon Business (EIN only)"},
  {id:"c21",cat:"🔄 Revolving",label:"Apply: Staples, Lowe's, Home Depot business accounts"},
  {id:"c22",cat:"™️ Trademark",label:"Search name at USPTO TESS",link:"https://tmsearch.uspto.gov"},
  {id:"c23",cat:"™️ Trademark",label:"File trademark at USPTO TEAS ($250–350)",link:"https://www.uspto.gov/trademarks"},
  {id:"c24",cat:"™️ Trademark",label:"Send Trademark Infringement letter (Letter 3) for stubborn items"},
];
const VENDORS_DEFAULT=[
  {name:"Quill",reports:"D&B",req:"Place 1 order → request credit",limit:"Net 30"},
  {name:"Grainger",reports:"D&B",req:"Order $50+, select Invoice Me",limit:"Net 30"},
  {name:"Uline",reports:"D&B",req:"2–3 prepaid orders then apply",limit:"Net 30"},
  {name:"Reliable/ODP",reports:"D&B + EXP + EQ",req:"Request invoice at checkout",limit:"Net 30"},
  {name:"Monopolize MKT",reports:"Experian",req:"4 payments of $59.99",limit:"Net 30"},
  {name:"Dell Business",reports:"D&B",req:"75+ Paydex · call 800-999-3355",limit:"Revolving"},
  {name:"Amazon Business",reports:"D&B + EXP + EQ",req:"EIN only · 3+ trade lines",limit:"Revolving"},
  {name:"Staples",reports:"D&B + Experian",req:"5 accounts reporting",limit:"Revolving"},
  {name:"Home Depot",reports:"D&B",req:"3 yrs biz or 8+ tradelines",limit:"Revolving"},
];
const TIERS=[
  {id:"diy",name:"DIY Course",price:"$79",color:C.blue,icon:"🎓",badge:null,
   includes:["Full 9-module course (30 lessons)","26 pre-filled legal motion templates","Data breach dispute strategy","Specialty bureaus opt-out guide (15 bureaus)","AI dispute letter generator (5 types)","Exclusive trademark strategy","Dispute tracker + 14-day countdowns","Vendor approval tracker","24-step checklist","Funding readiness score","Score Simulator","Metro 2 Violation Scanner","Bureau Contact Directory","90-Day Action Plan","Downloadable PDF guide","Lifetime access + updates"],
   notIncluded:["Certified mail is extra ($20 per letter, credit packs available)","No personalized funding plan","No funding partner referral"]},
  {id:"dfy",name:"Done-For-You",price:"$2,999",color:C.gold,icon:"👑",badge:"MOST POPULAR",
   includes:["Everything in DIY Course","Full intake & case review","AI personalized funding plan","All letters drafted by us","Letters sent via certified mail ($20/letter included)","Trademark filing guidance","Funding partner referral","2.5% referral fee on funded amount (disclosed upfront)","Ongoing support throughout"],
   notIncluded:[]},
];
const MAIL_PACKS=[
  {id:"m1",qty:1,price:20,label:"1 Letter",per:20},
  {id:"m2",qty:5,price:90,label:"5 Letters",per:18,badge:"Save $10"},
  {id:"m3",qty:10,price:170,label:"10 Letters",per:17,badge:"Most Popular"},
  {id:"m4",qty:25,price:400,label:"25 Letters",per:16,badge:"Best Value"},
];
const REVIEWS=[
  {name:"Mansa Wealth Group",text:"Built $750,000 in business credit for our trucking company in 7 months. First $250K in 4 months."},
  {name:"James U.",text:"Got approved for 4 auto loans at $250K each from the same bank for my LLC. Still wild to me."},
  {name:"Mamba Mentality",text:"First business card ever — $15,000 limit in 3 weeks."},
  {name:"Meg — Logistics",text:"Paid $5,000 for a coaching program last month. Should've bought this instead."},
];
const FAQS=[
  {q:"Do I need good personal credit?",a:"No. This builds credit tied to your EIN, not your SSN. No personal guarantee. Even with bad credit, recent bankruptcy, or prior denials — this works."},
  {q:"What is the trademark strategy?",a:"When your legal name is a USPTO-registered trademark, bureaus attaching false data to it can constitute trademark dilution under the Lanham Act (15 U.S.C. § 1125) — forcing their Legal department to respond. No other course teaches this."},
  {q:"What does Done-For-You include?",a:"We handle your full intake, generate an AI personalized funding plan, draft and send all dispute letters via certified mail ($20/letter, included), provide trademark guidance, and refer you to our funding partner. We are not attorneys — this is a document preparation service."},
  {q:"What is the 2.5% funding fee?",a:"After DFY, we connect you with our funding partner. If you receive funding, we collect 2.5% of the funded amount — disclosed and agreed to at intake, never collected upfront."},
  {q:"How does online certified mail work?",a:"You compose your letter in the app, click Send, and we mail it via USPS Certified Mail with Return Receipt. $20 per letter. We handle everything — printing, folding, stamping, mailing. You get a tracking number and your green card receipt is uploaded to your vault."},
];

// ─── PAYWALL ──────────────────────────────────────────────────────────────────
function PaywallModal({onClose,onBuy}){
  const [sel,setSel]=useState("dfy");
  const t=TIERS.find(x=>x.id===sel);
  return(
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"#000000E0",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:16,overflowY:"auto"}}>
      <div onClick={e=>e.stopPropagation()} style={{background:C.card,border:`1px solid ${C.gold}55`,borderRadius:20,padding:24,maxWidth:480,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:18}}>
          <div style={{fontSize:32,marginBottom:6}}>🔓</div>
          <h2 style={{margin:"0 0 4px",color:C.gold,fontSize:19,fontWeight:900}}>Choose Your Path</h2>
          <p style={{color:C.muted,fontSize:12,margin:0}}>Both include the full course + 26 legal motion templates. DFY = we do everything.</p>
        </div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
          {TIERS.map(x=>(
            <div key={x.id} onClick={()=>setSel(x.id)} style={{background:sel===x.id?x.color+"18":C.surface,border:`2px solid ${sel===x.id?x.color:C.border}`,borderRadius:12,padding:14,cursor:"pointer",position:"relative"}}>
              {x.badge&&<div style={{position:"absolute",top:-10,left:"50%",transform:"translateX(-50%)",background:C.gold,color:C.bg,borderRadius:99,fontSize:9,fontWeight:800,padding:"3px 10px",whiteSpace:"nowrap"}}>{x.badge}</div>}
              <div style={{fontSize:22,marginBottom:4}}>{x.icon}</div>
              <div style={{fontWeight:800,fontSize:13,color:x.color}}>{x.name}</div>
              <div style={{fontSize:20,fontWeight:900,color:C.text,margin:"6px 0 2px"}}>{x.price}</div>
              <div style={{fontSize:10,color:C.muted}}>one-time</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:16}}>
          {t.includes.map(i=>(
            <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:7}}>
              <span style={{color:C.green,fontSize:12,flexShrink:0,marginTop:1}}>✓</span>
              <span style={{fontSize:12,color:C.text}}>{i}</span>
            </div>
          ))}
          {t.notIncluded.length>0&&<div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10}}>
            {t.notIncluded.map(i=>(
              <div key={i} style={{display:"flex",gap:8,alignItems:"flex-start",marginBottom:6}}>
                <span style={{color:C.muted,fontSize:12,flexShrink:0}}>–</span>
                <span style={{fontSize:12,color:C.muted}}>{i}</span>
              </div>
            ))}
          </div>}
          {sel==="dfy"&&<div style={{background:C.orange+"14",border:`1px solid ${C.orange}33`,borderRadius:8,padding:10,marginTop:10,fontSize:11,color:C.mutedLight,lineHeight:1.6}}>
            <strong style={{color:C.orange}}>⚠️ Disclosure:</strong> Not a law firm. Document preparation service only. The 2.5% funding fee is disclosed and agreed to in writing at intake.
          </div>}
        </div>
        <Btn full onClick={()=>onBuy(sel)} style={{padding:"14px 0",fontSize:15,color:C.bg}}>
          {sel==="dfy"?"👑 Start Done-For-You — $2,999":"🎓 Get DIY Course — $79"}
        </Btn>
        <p style={{color:C.muted,fontSize:11,textAlign:"center",marginTop:8}}>Payment plans via Klarna & Afterpay at checkout · SSL secured</p>
        <button onClick={onClose} style={{background:"none",border:"none",color:C.muted,cursor:"pointer",fontSize:12,width:"100%",marginTop:4}}>Maybe later</button>
      </div>
    </div>
  );
}

// ─── LANDING ──────────────────────────────────────────────────────────────────
function LandingPage({onEnter,onPreview}){
  const [showPay,setShowPay]=useState(false);
  const [openFaq,setOpenFaq]=useState(null);
  return(
    <div style={{background:C.bg,color:C.text,fontFamily:F,minHeight:"100vh"}}>
      <nav style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"13px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
        <div><span style={{fontWeight:900,fontSize:15,color:C.gold}}>Credit Changed My Life</span><span style={{color:C.muted,fontSize:12}}> by POTENT</span></div>
        <div style={{display:"flex",gap:8}}>
          <Btn outline color={C.muted} small onClick={onPreview}>Preview</Btn>
          <Btn small onClick={()=>setShowPay(true)}>Get Access</Btn>
        </div>
      </nav>
      <div style={{background:`radial-gradient(ellipse 90% 70% at 50% -10%,#1C1430 0%,${C.bg} 65%)`,padding:"60px 20px 48px",textAlign:"center"}}>
        <div style={{display:"inline-block",background:C.gold+"18",border:`1px solid ${C.gold}44`,borderRadius:99,padding:"5px 16px",fontSize:11,fontWeight:700,color:C.gold,letterSpacing:2,marginBottom:20,textTransform:"uppercase"}}>The #1 Business Credit System</div>
        <h1 style={{fontSize:"clamp(28px,6vw,54px)",fontWeight:900,lineHeight:1.07,margin:"0 0 18px",letterSpacing:-1.5,maxWidth:680,marginLeft:"auto",marginRight:"auto"}}>
          Build Business Credit.<br/><span style={{color:C.gold}}>Clear Your Record.</span><br/>Fund Your Future.
        </h1>
        <p style={{color:C.mutedLight,fontSize:15,maxWidth:480,margin:"0 auto 28px",lineHeight:1.7}}>EIN only — no SSN, no personal guarantee. 26 pre-filled legal motions. Send certified mail online. The exclusive trademark strategy no one else teaches.</p>
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginBottom:12}}>
          <Btn onClick={()=>setShowPay(true)} style={{padding:"14px 36px",fontSize:15,color:C.bg}}>Get Access Now</Btn>
          <Btn outline color={C.text} onClick={onPreview} style={{padding:"14px 24px",fontSize:15}}>Free Preview →</Btn>
        </div>
        <p style={{color:C.muted,fontSize:11}}>DIY $79 · Done-For-You $2,999 · Certified mail $20/letter · Payment plans available</p>
      </div>
      <div style={{background:C.surface,borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,padding:"22px 20px",display:"flex",justifyContent:"center",gap:"clamp(18px,5vw,56px)",flexWrap:"wrap"}}>
        {[["20,000+","Students"],["$750K","Top Result"],["20","Legal Motions"],["$20","Certified Mail"],["0","SSN Needed"]].map(([n,l])=>(
          <div key={l} style={{textAlign:"center"}}>
            <div style={{fontSize:"clamp(18px,3.5vw,26px)",fontWeight:900,color:C.gold}}>{n}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>
      {/* Features */}
      <div style={{padding:"40px 20px",maxWidth:820,margin:"0 auto"}}>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12}}>
          {[["🎓","30 Video Lessons","9 modules from zero to $500K+."],["📄","26 Legal Motions","Court-ready PDFs — FCRA, FDCPA, Lanham Act, HIPAA, data breach & specialty bureaus."],["✉️","Online Certified Mail","Send letters directly from the app. $20/letter. USPS tracked."],["🤖","AI Letter Generator","5 dispute letter types, auto-filled with your info."],["™️","Trademark Strategy","USPTO guide + Lanham Act letters nobody else teaches."],["💰","Funding Readiness Score","See exactly what's holding you back from funding."],["⏱️","14-Day Dispute Tracker","Countdown timers for every letter with status tracking."],["✅","24-Step Checklist","Entity to $50K+ cards with direct resource links."],["📊","Score Simulator","See your score impact before you make a move."],["🔍","Metro 2 Scanner","Find legal violations to dispute — the insider trick."],["📇","Bureau Directory","Every address, fax & portal for all 18 bureaus."],["🗺️","90-Day Action Plan","Week-by-week personalized game plan with progress tracking."],["👑","Done-For-You $2,999","We draft, sign, send, and track everything for you."]].map(f=>(
            <div key={f[0]} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
              <div style={{fontSize:24,marginBottom:6}}>{f[0]}</div>
              <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:4}}>{f[1]}</div>
              <div style={{color:C.muted,fontSize:12,lineHeight:1.5}}>{f[2]}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Reviews */}
      <div style={{background:C.surface,borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,padding:"36px 20px"}}>
        <h2 style={{textAlign:"center",fontWeight:800,fontSize:"clamp(18px,4vw,24px)",margin:"0 0 20px"}}>⭐ Student Results</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(230px,1fr))",gap:12,maxWidth:860,margin:"0 auto"}}>
          {REVIEWS.map(r=>(
            <div key={r.name} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:16}}>
              <span style={{color:C.gold}}>★★★★★</span>
              <p style={{color:C.text,fontSize:12,lineHeight:1.6,margin:"8px 0"}}>"{r.text}"</p>
              <div style={{color:C.muted,fontSize:11,fontWeight:600}}>— {r.name}</div>
            </div>
          ))}
        </div>
      </div>
      {/* FAQ */}
      <div style={{padding:"36px 20px",maxWidth:660,margin:"0 auto"}}>
        <h2 style={{textAlign:"center",fontWeight:800,fontSize:"clamp(18px,4vw,22px)",margin:"0 0 16px"}}>FAQ</h2>
        {FAQS.map((f,i)=>(
          <div key={i} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,marginBottom:8,overflow:"hidden"}}>
            <button onClick={()=>setOpenFaq(openFaq===i?null:i)} style={{width:"100%",background:"none",border:"none",padding:"13px 15px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",color:C.text,textAlign:"left"}}>
              <span style={{fontWeight:600,fontSize:13}}>{f.q}</span>
              <span style={{color:C.muted,fontSize:15,flexShrink:0,marginLeft:8}}>{openFaq===i?"▴":"▾"}</span>
            </button>
            {openFaq===i&&<div style={{padding:"0 15px 13px",color:C.mutedLight,fontSize:13,lineHeight:1.7}}>{f.a}</div>}
          </div>
        ))}
      </div>
      <div style={{background:C.surface,borderTop:`1px solid ${C.border}`,padding:"36px 20px",textAlign:"center"}}>
        <h2 style={{fontSize:"clamp(20px,5vw,30px)",fontWeight:900,margin:"0 0 10px"}}>Ready to <span style={{color:C.gold}}>Change Your Life?</span></h2>
        <p style={{color:C.muted,marginBottom:20,fontSize:14}}>DIY $79 or let us handle everything for $2,999.</p>
        <Btn onClick={()=>setShowPay(true)} style={{padding:"14px 36px",fontSize:15,color:C.bg}}>Choose Your Plan</Btn>
      </div>
      <div style={{background:C.bg,borderTop:`1px solid ${C.border}`,padding:"14px 20px",textAlign:"center"}}>
        <div style={{color:C.muted,fontSize:11}}>© 2026 Credit Changed My Life by POTENT · Document preparation service · Not a law firm</div>
      </div>
      {showPay&&<PaywallModal onClose={()=>setShowPay(false)} onBuy={plan=>{setShowPay(false);onEnter(plan);}}/>}
    </div>
  );
}

// ─── COURSE SCREEN ────────────────────────────────────────────────────────────
function CourseScreen({unlocked,completedIds,onToggle,onShowPaywall}){
  const [openLesson,setOpenLesson]=useState(null);
  const [openMod,setOpenMod]=useState(1);
  const total=LESSONS.length; const done=completedIds.length;
  if(openLesson){
    const lesson=LESSONS.find(l=>l.id===openLesson);
    const idx=LESSONS.findIndex(l=>l.id===openLesson);
    return <LessonPage lesson={lesson} isCompleted={completedIds.includes(openLesson)}
      onComplete={id=>onToggle(id,true)} onBack={()=>setOpenLesson(null)}
      onNext={idx<LESSONS.length-1?()=>{onToggle(openLesson,true);setOpenLesson(LESSONS[idx+1].id);}:null}
      onPrev={idx>0?()=>setOpenLesson(LESSONS[idx-1].id):null}/>;
  }
  return(
    <div style={{padding:16}}>
      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:800}}>Video Course</h2>
      <p style={{color:C.muted,fontSize:13,margin:"0 0 10px"}}>{done}/{total} · {Math.round((done/total)*100)}% complete</p>
      <PBar pct={Math.round((done/total)*100)}/>
      <div style={{marginTop:16}}>
        {MODULES.map(mod=>{
          const ml=LESSONS.filter(l=>l.moduleId===mod.id);
          const md=ml.filter(l=>completedIds.includes(l.id)).length;
          const locked=!unlocked&&!mod.free;
          const open=openMod===mod.id;
          return(
            <div key={mod.id} style={{background:C.card,border:`1px solid ${locked?C.border:C.borderLight}`,borderRadius:12,marginBottom:8,overflow:"hidden",opacity:locked?.65:1}}>
              <button onClick={()=>{if(locked){onShowPaywall();return;}setOpenMod(open?null:mod.id);}} style={{width:"100%",background:"none",border:"none",padding:"13px 14px",display:"flex",alignItems:"center",gap:10,cursor:"pointer",color:C.text}}>
                <span style={{fontSize:20}}>{mod.icon}</span>
                <div style={{flex:1,textAlign:"left"}}>
                  <div style={{fontWeight:700,fontSize:13}}>{mod.title}</div>
                  <div style={{color:C.muted,fontSize:11}}>{ml.length} lessons{mod.free&&<span style={{color:C.green,marginLeft:5}}>• Free</span>}</div>
                </div>
                {locked?<span>🔒</span>:<><span style={{color:C.gold,fontSize:11,marginRight:4}}>{md}/{ml.length}</span><span style={{color:C.muted}}>{open?"▴":"▾"}</span></>}
              </button>
              {open&&!locked&&(
                <div style={{borderTop:`1px solid ${C.border}`}}>
                  {ml.map(l=>{
                    const comp=completedIds.includes(l.id);
                    return(
                      <div key={l.id} onClick={()=>setOpenLesson(l.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",borderBottom:`1px solid ${C.border}22`,cursor:"pointer"}} onMouseEnter={e=>e.currentTarget.style.background=C.surface} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                        <div style={{width:20,height:20,borderRadius:5,flexShrink:0,background:comp?C.gold:"transparent",border:`2px solid ${comp?C.gold:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:C.bg,fontWeight:900,fontSize:10}}>{comp?"✓":""}</div>
                        <div style={{flex:1,fontSize:12,fontWeight:comp?400:600,color:comp?C.muted:C.text,textDecoration:comp?"line-through":"none"}}>{l.title}</div>
                        <span style={{color:C.muted,fontSize:11,flexShrink:0}}>{l.duration}</span>
                        <span style={{color:C.muted,fontSize:11}}>→</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!unlocked&&<div style={{background:C.gold+"14",border:`1px solid ${C.gold}33`,borderRadius:12,padding:14,marginTop:8,textAlign:"center"}}>
        <div style={{fontWeight:700,marginBottom:6}}>🔓 Unlock All 30 Lessons</div>
        <div style={{color:C.muted,fontSize:12,marginBottom:12}}>Module 1 is free. Full access from $79.</div>
        <Btn onClick={onShowPaywall} style={{color:C.bg}}>Unlock Full Course</Btn>
      </div>}
    </div>
  );
}

// ─── MOTIONS SCREEN ────────────────────────────────────────────────────────────
function MotionsScreen({unlocked,onShowPaywall}){
  const [selCat,setSelCat]=useState("All");
  const [search,setSearch]=useState("");
  const [selMotion,setSelMotion]=useState(null);
  const [fields,setFields]=useState({});
  const [copied,setCopied]=useState(false);
  const [downloaded,setDownloaded]=useState(false);
  const [showPreview,setShowPreview]=useState(false);

  if(!unlocked) return(
    <div style={{padding:32,textAlign:"center"}}>
      <div style={{fontSize:44,marginBottom:10}}>📄</div>
      <h3 style={{margin:"0 0 8px"}}>26 Pre-Filled Legal Motions</h3>
      <p style={{color:C.muted,fontSize:13,marginBottom:8}}>Court-ready PDFs for every situation: FCRA, FDCPA, HIPAA, Lanham Act, federal court template, and more.</p>
      <Btn onClick={onShowPaywall} style={{color:C.bg}}>Unlock Access</Btn>
    </div>
  );

  const filtered=MOTIONS.filter(m=>{
    const mc=selCat==="All"||m.cat===selCat;
    const ms=!search||m.title.toLowerCase().includes(search.toLowerCase())||m.desc.toLowerCase().includes(search.toLowerCase());
    return mc&&ms;
  });

  if(selMotion){
    const out=selMotion.body(fields);
    const downloadPDF=()=>{
      const html=`<!DOCTYPE html><html><head><style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.6;margin:1in;color:#000}pre{white-space:pre-wrap;font-family:'Courier New',monospace;font-size:11pt;line-height:1.8}.hdr{text-align:center;border-bottom:2px solid #000;padding-bottom:12px;margin-bottom:24px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;font-size:11pt}.ftr{margin-top:40px;border-top:1px solid #000;padding-top:10px;font-size:9pt;color:#666;text-align:center}</style></head><body><div class="hdr">Credit Changed My Life by POTENT · ${selMotion.title}</div><pre>${out.replace(/</g,'&lt;').replace(/>/g,'&gt;')}</pre><div class="ftr">Send via USPS Certified Mail, Return Receipt Requested · Office of General Counsel · Not legal advice · Credit Changed My Life by POTENT</div></body></html>`;
      const b=new Blob([html],{type:"text/html"});
      const a=document.createElement("a");a.href=URL.createObjectURL(b);
      a.download=`${selMotion.id}-motion.html`;a.click();
      setDownloaded(true);setTimeout(()=>setDownloaded(false),2500);
    };
    return(
      <div style={{padding:16}}>
        <button onClick={()=>{setSelMotion(null);setFields({});setShowPreview(false);}} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,padding:"5px 10px",color:C.muted,fontSize:11,cursor:"pointer",marginBottom:14}}>← All Motions</button>
        <div style={{background:`linear-gradient(135deg,${selMotion.color}18,${C.purple}0A)`,border:`1px solid ${selMotion.color}44`,borderRadius:14,padding:18,marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
            <span style={{fontSize:22}}>{selMotion.icon}</span>
            <Tag label={selMotion.cat} color={selMotion.color}/>
          </div>
          <h2 style={{margin:0,fontSize:17,fontWeight:800,color:C.text}}>{selMotion.title}</h2>
          <p style={{margin:"6px 0 0",color:C.muted,fontSize:12}}>{selMotion.desc}</p>
        </div>
        <div style={{background:C.card,border:`1px solid ${C.borderLight}`,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:12,color:C.gold,marginBottom:10}}>📝 Fill In Your Information</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:2}}>
            {selMotion.fields.map(f=>(
              <Inp key={f} label={FL_MAP[f]||f} value={fields[f]||""} onChange={v=>setFields(p=>({...p,[f]:v}))} placeholder={FL_MAP[f]||f}
                multi={["inaccuracyDescription","theftDescription","fraudAccounts","claimDescription","issueDescription","recordDescription"].includes(f)}/>
            ))}
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:14,flexWrap:"wrap"}}>
          <Btn onClick={()=>{navigator.clipboard.writeText(out);setCopied(true);setTimeout(()=>setCopied(false),2500);}} color={copied?C.green:C.gold} style={{flex:1,padding:"11px 0",fontSize:13,color:C.bg}}>{copied?"✓ Copied":"📋 Copy Letter"}</Btn>
          <Btn onClick={downloadPDF} color={downloaded?C.green:C.purple} style={{flex:1,padding:"11px 0",fontSize:13}}>{downloaded?"✓ Downloaded!":"📄 Download PDF"}</Btn>
          <Btn outline color={C.blue} onClick={()=>setShowPreview(!showPreview)} style={{flex:1,padding:"11px 0",fontSize:13}}>{showPreview?"Hide":"👁 Preview"}</Btn>
        </div>
        <div style={{background:`linear-gradient(135deg,${C.gold}14,${C.green}0A)`,border:`1px solid ${C.gold}44`,borderRadius:12,padding:12,marginBottom:14,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
          <div>
            <div style={{fontWeight:700,fontSize:13,color:C.gold}}>✉️ Send Via Certified Mail</div>
            <div style={{color:C.mutedLight,fontSize:11,marginTop:2}}>We print, stamp & mail it for you. USPS tracked. Green card receipt uploaded to your vault.</div>
          </div>
          <Btn small style={{color:C.bg,whiteSpace:"nowrap"}}>Send — $20</Btn>
        </div>
        {showPreview&&(
          <div style={{background:"#fff",borderRadius:12,padding:"20px 24px",boxShadow:"0 4px 24px #00000066"}}>
            <div style={{borderBottom:"2px solid #000",paddingBottom:8,marginBottom:16,textAlign:"center",fontWeight:700,fontSize:10,textTransform:"uppercase",letterSpacing:1,color:"#000"}}>
              {selMotion.title} · Credit Changed My Life by POTENT
            </div>
            <pre style={{margin:0,whiteSpace:"pre-wrap",fontFamily:"'Courier New',monospace",fontSize:11,color:"#000",lineHeight:1.8}}>{out}</pre>
            <div style={{borderTop:"1px solid #ccc",paddingTop:8,marginTop:16,fontSize:9,color:"#888",textAlign:"center"}}>
              Send via USPS Certified Mail, Return Receipt Requested · Not legal advice
            </div>
          </div>
        )}
      </div>
    );
  }

  return(
    <div style={{padding:16}}>
      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:800}}>26 Legal Motion Templates</h2>
      <p style={{color:C.muted,fontSize:13,margin:"0 0 12px"}}>Fill in your info → download court-ready PDF → copy or send online via certified mail.</p>
      <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search motions..."
        style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"9px 13px",color:C.text,fontSize:13,boxSizing:"border-box",marginBottom:10}}/>
      <div style={{display:"flex",gap:6,overflowX:"auto",paddingBottom:6,marginBottom:14}}>
        {["All",...MOTION_CATS].map(cat=>(
          <button key={cat} onClick={()=>setSelCat(cat)} style={{background:selCat===cat?(CAT_COLOR[cat]||C.gold)+"22":"transparent",color:selCat===cat?(CAT_COLOR[cat]||C.gold):C.muted,border:`1px solid ${selCat===cat?(CAT_COLOR[cat]||C.gold)+"66":C.border}`,borderRadius:20,padding:"5px 12px",fontSize:11,fontWeight:selCat===cat?700:400,cursor:"pointer",whiteSpace:"nowrap"}}>
            {cat}
          </button>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:10}}>
        {filtered.map(m=>(
          <div key={m.id} onClick={()=>{setSelMotion(m);setFields({date:new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})});}}
            style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:12,padding:14,cursor:"pointer"}}
            onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${m.color}66`;e.currentTarget.style.background=m.color+"0A";}}
            onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${C.border}`;e.currentTarget.style.background=C.card;}}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
              <span style={{fontSize:18}}>{m.icon}</span>
              <Tag label={m.cat} color={m.color}/>
              <span style={{color:C.muted,fontSize:10,marginLeft:"auto"}}>{m.id}</span>
            </div>
            <div style={{fontWeight:700,fontSize:13,color:C.text,marginBottom:4,lineHeight:1.3}}>{m.title}</div>
            <div style={{color:C.muted,fontSize:11,lineHeight:1.5,marginBottom:10}}>{m.desc}</div>
            <div style={{display:"flex",gap:5}}>
              {["📋 Copy","📄 PDF","✉️ $20 Mail"].map(s=>(
                <span key={s} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,fontSize:10,color:C.muted,padding:"2px 7px"}}>{s}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── LETTERS SCREEN ────────────────────────────────────────────────────────────
function LettersScreen({unlocked,onShowPaywall}){
  const [sel,setSel]=useState(null);
  const [fields,setFields]=useState({});
  const [copied,setCopied]=useState(false);
  const [rpt,setRpt]=useState("");
  const [aiLoad,setAiLoad]=useState(false);
  const [aiRes,setAiRes]=useState(null);
  if(!unlocked) return(<div style={{padding:32,textAlign:"center"}}><div style={{fontSize:44,marginBottom:10}}>🔒</div><h3 style={{margin:"0 0 8px"}}>Dispute Letter Generator</h3><p style={{color:C.muted,fontSize:13,marginBottom:18}}>5 FCRA & Lanham Act letter templates. Unlock to access.</p><Btn onClick={onShowPaywall} style={{color:C.bg}}>Unlock Access</Btn></div>);
  const pick=l=>{setSel(l);setFields({date:new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})});setCopied(false);};
  const out=sel?sel.template(fields):"";
  const analyze=async()=>{
    if(!rpt.trim())return;
    setAiLoad(true);setAiRes(null);
    try{
      const r=await askAI(rpt);
      setAiRes(r.ok?r.text:(r.error||"Analysis failed."));
    }catch{setAiRes("Analysis failed.");}
    setAiLoad(false);
  };
  return(
    <div style={{padding:16}}>
      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:800}}>Dispute Letter Generator</h2>
      <p style={{color:C.muted,fontSize:13,margin:"0 0 12px"}}>Select a letter → fill details → copy → send via Certified Mail only.</p>
      <div style={{background:C.card,border:`1px solid ${C.purple}44`,borderRadius:12,padding:13,marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:7}}><span>🤖</span><span style={{fontWeight:700,fontSize:13}}>AI Report Analyzer</span><Tag label="AI" color={C.purple}/></div>
        <textarea value={rpt} onChange={e=>setRpt(e.target.value)} placeholder="Paste your credit report text — AI recommends which letters to send and why..." style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:9,color:C.text,fontSize:12,minHeight:72,boxSizing:"border-box",resize:"vertical",fontFamily:F}}/>
        <Btn small onClick={analyze} color={C.purple} style={{marginTop:8}}>{aiLoad?"🔄 Analyzing...":"🤖 Analyze Report"}</Btn>
        {aiRes&&<div style={{background:C.surface,borderRadius:8,padding:11,marginTop:10,fontSize:12,color:C.text,lineHeight:1.7,whiteSpace:"pre-wrap"}}><div style={{color:C.purple,fontWeight:700,fontSize:10,marginBottom:5,textTransform:"uppercase",letterSpacing:1}}>✦ AI Analysis</div>{aiRes}</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10,marginBottom:14}}>
        {LETTERS.map(l=>(
          <button key={l.id} onClick={()=>pick(l)} style={{background:sel?.id===l.id?l.color+"1A":C.card,border:`1px solid ${sel?.id===l.id?l.color:C.border}`,borderRadius:10,padding:12,textAlign:"left",cursor:"pointer",color:C.text}}>
            <div style={{marginBottom:6}}><Tag label={l.tag} color={l.color}/></div>
            <div style={{fontWeight:700,fontSize:12,marginBottom:4}}>{l.title}</div>
            <div style={{color:C.muted,fontSize:11,lineHeight:1.4}}>{l.desc}</div>
          </button>
        ))}
      </div>
      {sel&&(
        <div style={{background:C.card,border:`1px solid ${C.borderLight}`,borderRadius:12,padding:14}}>
          <div style={{fontWeight:700,marginBottom:12,color:C.gold,fontSize:13}}>{sel.title}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(180px,1fr))",gap:8,marginBottom:12}}>
            {sel.fields.map(f=>(
              <Inp key={f} label={FL_LETTER[f]||f} value={fields[f]||""} onChange={v=>setFields(p=>({...p,[f]:v}))} placeholder={FL_LETTER[f]||f}/>
            ))}
          </div>
          <div style={{background:C.surface,borderRadius:8,padding:12,marginBottom:12,maxHeight:240,overflowY:"auto"}}>
            <pre style={{margin:0,whiteSpace:"pre-wrap",fontFamily:"'Courier New',monospace",fontSize:11,color:C.text,lineHeight:1.7}}>{out}</pre>
          </div>
          <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
            <Btn onClick={()=>{navigator.clipboard.writeText(out);setCopied(true);setTimeout(()=>setCopied(false),2500);}} color={copied?C.green:C.gold} style={{padding:"9px 18px",fontSize:13,color:C.bg}}>{copied?"✓ Copied":"📋 Copy Letter"}</Btn>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 11px",fontSize:11,color:C.muted}}>✉️ <strong style={{color:C.text}}>Certified Mail, Return Receipt Only</strong></div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CERTIFIED MAIL SCREEN ───────────────────────────
// Real flow: Done-For-You members are covered; Course members buy letter credits (Stripe). A request is saved on the server
// and our team prints and mails it by USPS Certified Mail, then enters the tracking number, which shows here.
function MailScreen({unlocked,user,profile,onShowPaywall,onProfile}){
  const [step,setStep]=useState("packs");
  const [selPkg,setSelPkg]=useState("m3");
  const [letter,setLetter]=useState("");
  const [toName,setToName]=useState("");
  const [toAddr,setToAddr]=useState("");
  const [fromName,setFromName]=useState("");
  const [fromAddr,setFromAddr]=useState("");
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const [reqs,setReqs]=useState([]);
  useEffect(()=>{ if(user) getMailRequests(user.id).then(setReqs); },[user,step]);
  if(!unlocked) return(<div style={{padding:32,textAlign:"center"}}><div style={{fontSize:44,marginBottom:10}}>✉️</div><h3 style={{margin:"0 0 8px"}}>Certified Mail Requests</h3><p style={{color:C.muted,fontSize:13,marginBottom:18}}>Have our team mail your letters by USPS Certified Mail, Return Receipt Requested. Included with the Course and Done-For-You.</p><Btn onClick={onShowPaywall} style={{color:C.bg}}>Unlock to Send</Btn></div>);
  if(!user) return(<div style={{padding:32,textAlign:"center",color:C.muted,fontSize:13}}>Sign in to send a certified mail request.</div>);
  const isDfy=profile?.plan==="dfy";
  const credits=Number(profile?.mail_credits||0);
  const canSend=isDfy||credits>0;
  const pkg=MAIL_PACKS.find(p=>p.id===selPkg);
  const submit=async()=>{
    setBusy(true);setErr("");
    const r=await sendMailRequest({toName,toAddr,fromName,fromAddr,letter});
    setBusy(false);
    if(!r.ok){setErr(r.error||"Could not send");return;}
    if(onProfile) onProfile({mail_credits:r.mail_credits});
    setStep("sent");
  };
  return(
    <div style={{padding:16}}>
      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:800}}>Certified Mail Requests</h2>
      <p style={{color:C.muted,fontSize:13,margin:"0 0 16px"}}>Write your letter here. Our team prints it and mails it by USPS Certified Mail, Return Receipt Requested, then posts the tracking number below.</p>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:12,marginBottom:14,fontSize:12,color:C.mutedLight}}>
        {isDfy?"Done-For-You: mailing is included. Your requests are handled by our team.":`Letter credits: ${credits}`}
      </div>

      {step==="packs"&&(
        <>
          {!isDfy&&(
            <>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(150px,1fr))",gap:12,marginBottom:14}}>
                {MAIL_PACKS.map(p=>(
                  <div key={p.id} onClick={()=>setSelPkg(p.id)} style={{background:selPkg===p.id?C.gold+"18":C.card,border:`2px solid ${selPkg===p.id?C.gold:C.border}`,borderRadius:12,padding:14,cursor:"pointer",textAlign:"center"}}>
                    <div style={{fontSize:18,fontWeight:900,color:selPkg===p.id?C.gold:C.text}}>{p.label}</div>
                    <div style={{fontSize:22,fontWeight:900,color:C.text,margin:"4px 0 2px"}}>${p.price}</div>
                    <div style={{fontSize:11,color:C.muted}}>${p.per}/letter</div>
                  </div>
                ))}
              </div>
              <Btn full outline onClick={()=>startCheckout("mail",selPkg)} style={{marginBottom:10}}>Buy {pkg.label} — ${pkg.price}</Btn>
            </>
          )}
          <Btn full onClick={()=>setStep("compose")} disabled={!canSend} style={{color:C.bg}}>{canSend?"Write a letter to mail →":"Buy letter credits first"}</Btn>
        </>
      )}

      {step==="compose"&&(
        <>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div>
              <div style={{fontWeight:700,fontSize:12,color:C.gold,marginBottom:8}}>FROM (Your Info)</div>
              <Inp label="Your Name" value={fromName} onChange={setFromName} placeholder="Legal name"/>
              <Inp label="Return Address" value={fromAddr} onChange={setFromAddr} placeholder="Street, City, State ZIP" multi/>
            </div>
            <div>
              <div style={{fontWeight:700,fontSize:12,color:C.gold,marginBottom:8}}>TO (Bureau / Collector)</div>
              <Inp label="Recipient / Department" value={toName} onChange={setToName} placeholder="Office of General Counsel, Experian"/>
              <Inp label="Recipient Address" value={toAddr} onChange={setToAddr} placeholder="P.O. Box 4500, Allen, TX 75013" multi/>
            </div>
          </div>
          <div style={{marginBottom:12}}>
            <div style={{fontWeight:700,fontSize:12,color:C.gold,marginBottom:8}}>YOUR LETTER</div>
            <textarea value={letter} onChange={e=>setLetter(e.target.value)} placeholder="Paste your letter here, or generate one from Motion Templates or the Letter Generator..."
              style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:12,color:C.text,fontSize:12,minHeight:200,boxSizing:"border-box",resize:"vertical",fontFamily:"'Courier New',monospace",lineHeight:1.6}}/>
          </div>
          <div style={{display:"flex",gap:8}}>
            <Btn outline color={C.muted} onClick={()=>setStep("packs")} style={{flex:1}}>← Back</Btn>
            <Btn full onClick={()=>setStep("confirm")} style={{flex:2,color:C.bg}} disabled={!letter||!toAddr||!fromAddr}>Review →</Btn>
          </div>
        </>
      )}

      {step==="confirm"&&(
        <>
          <div style={{background:C.card,border:`1px solid ${C.borderLight}`,borderRadius:12,padding:16,marginBottom:14}}>
            <div style={{fontWeight:700,fontSize:13,color:C.gold,marginBottom:12}}>📋 Request Summary</div>
            {[["From",fromName+"\n"+fromAddr],["To",toName+"\n"+toAddr],["Service","USPS Certified Mail, Return Receipt Requested"],["Cost",isDfy?"Included with Done-For-You":"1 letter credit"]].map(([l,v])=>(
              <div key={l} style={{display:"flex",gap:12,marginBottom:10,paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>
                <div style={{color:C.muted,fontSize:11,width:65,flexShrink:0,textTransform:"uppercase",letterSpacing:.5,paddingTop:2}}>{l}</div>
                <div style={{color:C.text,fontSize:12,whiteSpace:"pre-wrap"}}>{v}</div>
              </div>
            ))}
          </div>
          <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:11,marginBottom:12,fontSize:11,color:C.muted,lineHeight:1.7}}>
            By sending this request you authorize Credit Changed My Life by POTENT to print and mail this letter on your behalf. We are a document preparation service, not a law firm, and we do not review your letter for legal sufficiency. We mail requests within 2 business days; the tracking number appears on this page once it is mailed.
          </div>
          {err&&<div style={{color:C.red,fontSize:12,marginBottom:8}}>{err}</div>}
          <div style={{display:"flex",gap:8}}>
            <Btn outline color={C.muted} onClick={()=>setStep("compose")} style={{flex:1}}>← Edit</Btn>
            <Btn full onClick={submit} disabled={busy} style={{flex:2,color:C.bg}}>{busy?"Sending...":"✓ Send Request"}</Btn>
          </div>
        </>
      )}

      {step==="sent"&&(
        <div style={{textAlign:"center",padding:"20px 16px"}}>
          <div style={{fontSize:48,marginBottom:12}}>📬</div>
          <h2 style={{color:C.green,margin:"0 0 8px",fontSize:20}}>Request Received</h2>
          <p style={{color:C.mutedLight,fontSize:13,maxWidth:380,margin:"0 auto 18px",lineHeight:1.7}}>Your request is saved. Our team mails it by USPS Certified Mail within 2 business days. Check the list below for the tracking number.</p>
          <Btn onClick={()=>{setLetter("");setStep("packs");}} style={{color:C.bg}}>Send Another</Btn>
        </div>
      )}

      {reqs.length>0&&(
        <div style={{marginTop:20}}>
          <div style={{fontWeight:700,fontSize:12,color:C.gold,marginBottom:8}}>YOUR REQUESTS</div>
          {reqs.map(r=>(
            <div key={r.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:"9px 12px",marginBottom:6,fontSize:12,display:"flex",justifyContent:"space-between",gap:8}}>
              <span style={{color:C.text}}>{r.to_name||"Recipient"} · {new Date(r.created_at).toLocaleDateString()}</span>
              <span style={{color:r.status==="mailed"?C.green:C.muted}}>{r.status==="mailed"?("Mailed"+(r.tracking_number?" · "+r.tracking_number:"")):"Queued"}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── TRACKER SCREEN ───────────────────────────────────────────────────────────
function TrackerScreen({unlocked,user,onShowPaywall}){
  const [disputes,setDisputes]=useState([
    {id:"demo1",bureau:"Experian",account:"Capital One #4521",letter_type:"FCRA Removal",sent_date:"2024-06-02",status:"pending"},
    {id:"demo2",bureau:"Equifax",account:"Portfolio Recovery #3312",letter_type:"MOV Demand",sent_date:"2024-05-25",status:"won"},
  ]);
  const [showAdd,setShowAdd]=useState(false);
  const [nd,setNd]=useState({bureau:"Experian",account:"",letter_type:"FCRA Removal",sent_date:new Date().toISOString().split("T")[0],status:"pending"});
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(user&&unlocked){
      setLoading(true);
      getDisputes(user.id).then(d=>{if(d.length)setDisputes(d);setLoading(false);});
    }
  },[user,unlocked]);

  if(!unlocked) return(<div style={{padding:32,textAlign:"center"}}><div style={{fontSize:44,marginBottom:10}}>🔒</div><h3 style={{margin:"0 0 8px"}}>Dispute Tracker</h3><p style={{color:C.muted,fontSize:13,marginBottom:18}}>14-day countdown timers. Track every letter and bureau response.</p><Btn onClick={onShowPaywall} style={{color:C.bg}}>Unlock Access</Btn></div>);

  const dl=sent=>Math.ceil((new Date(sent).getTime()+14*86400000-Date.now())/86400000);
  const sc={pending:C.orange,won:C.green,lost:C.red,responded:C.blue};
  const sl={pending:"⏳ Pending",won:"✅ Won",lost:"❌ Lost",responded:"📩 Responded"};

  const handleAdd=async()=>{
    if(!nd.account)return;
    if(user){
      const added=await addDispute(user.id,nd);
      if(added)setDisputes(p=>[added,...p]);
    } else {
      setDisputes(p=>[{...nd,id:Date.now().toString()},...p]);
    }
    setNd({bureau:"Experian",account:"",letter_type:"FCRA Removal",sent_date:new Date().toISOString().split("T")[0],status:"pending"});
    setShowAdd(false);
  };

  const handleStatus=async(id,status)=>{
    setDisputes(p=>p.map(d=>d.id===id?{...d,status}:d));
    if(user) await updateDispute(id,{status});
  };

  const handleDelete=async(id)=>{
    setDisputes(p=>p.filter(d=>d.id!==id));
    if(user) await deleteDispute(id);
  };

  return(
    <div style={{padding:16}}>
      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:800}}>Dispute Tracker</h2>
      <p style={{color:C.muted,fontSize:13,margin:"0 0 12px"}}>Track every letter + 14-day bureau deadlines.{user&&<span style={{color:C.green}}> ✓ Saved to your account</span>}</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
        {[["Total",disputes.length,C.gold],["Pending",disputes.filter(d=>d.status==="pending").length,C.orange],["Won",disputes.filter(d=>d.status==="won").length,C.green]].map(([l,v,c])=>(
          <div key={l} style={{background:C.card,border:`1px solid ${c}33`,borderRadius:10,padding:"11px 8px",textAlign:"center"}}>
            <div style={{fontSize:22,fontWeight:900,color:c}}>{v}</div>
            <div style={{fontSize:11,color:C.muted,marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>
      <Btn outline color={C.text} full onClick={()=>setShowAdd(s=>!s)} style={{marginBottom:12}}>{showAdd?"✕ Cancel":"+ Log New Dispute"}</Btn>
      {showAdd&&(
        <div style={{background:C.card,border:`1px solid ${C.gold}44`,borderRadius:12,padding:14,marginBottom:14}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:8}}>
            {[["bureau","Bureau",["Experian","Equifax","TransUnion"]],["letter_type","Letter Type",["FCRA Removal","Payment History","Trademark Infringement","MOV Demand","Secondary Notice","Debt Validation","Cease & Desist","Pay-for-Delete","HIPAA Violation","CFPB Complaint"]]].map(([k,l,opts])=>(
              <div key={k}>
                <label style={{display:"block",fontSize:10,color:C.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:.5}}>{l}</label>
                <select value={nd[k]} onChange={e=>setNd(p=>({...p,[k]:e.target.value}))} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 9px",color:C.text,fontSize:12}}>
                  {opts.map(o=><option key={o}>{o}</option>)}
                </select>
              </div>
            ))}
            <Inp label="Account / Description" value={nd.account} onChange={v=>setNd(p=>({...p,account:v}))} placeholder="e.g. Capital One #4521"/>
            <div>
              <label style={{display:"block",fontSize:10,color:C.muted,marginBottom:3,textTransform:"uppercase",letterSpacing:.5}}>Date Sent</label>
              <input type="date" value={nd.sent_date} onChange={e=>setNd(p=>({...p,sent_date:e.target.value}))} style={{width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"7px 9px",color:C.text,fontSize:12,boxSizing:"border-box"}}/>
            </div>
          </div>
          <Btn full onClick={handleAdd} style={{color:C.bg}}>Log Dispute</Btn>
        </div>
      )}
      {loading&&<div style={{textAlign:"center",padding:20,color:C.muted,fontSize:13}}>Loading your disputes...</div>}
      {disputes.map(d=>{
        const days=d.status==="pending"?dl(d.sent_date):null;
        return(
          <div key={d.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:13,marginBottom:8}}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:8,marginBottom:8}}>
              <div><div style={{fontWeight:700,fontSize:13}}>{d.account}</div><div style={{color:C.muted,fontSize:11,marginTop:2}}>{d.bureau} · {d.letter_type}</div></div>
              <span style={{background:sc[d.status]+"22",color:sc[d.status],border:`1px solid ${sc[d.status]}44`,borderRadius:6,fontSize:10,fontWeight:700,padding:"3px 7px",flexShrink:0}}>{sl[d.status]}</span>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
              <span style={{color:C.muted,fontSize:11}}>Sent: {new Date(d.sent_date).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}</span>
              <div style={{display:"flex",gap:8,alignItems:"center"}}>
                {days!==null&&<CountBadge days={days}/>}
                <select value={d.status} onChange={e=>handleStatus(d.id,e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 7px",color:C.text,fontSize:11,cursor:"pointer"}}>
                  {["pending","responded","won","lost"].map(s=><option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
                </select>
                <button onClick={()=>handleDelete(d.id)} style={{background:"none",border:"none",color:C.red,cursor:"pointer",fontSize:14}}>✕</button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── VENDOR SCREEN ─────────────────────────────────────────────────────────────
function VendorScreen({unlocked,user,onShowPaywall}){
  const [vendors,setVendors]=useState(VENDORS_DEFAULT.map(v=>({...v,approved:false,amount:"",date:""})));
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(user&&unlocked){
      setLoading(true);
      getVendors(user.id).then(saved=>{
        if(saved.length){
          setVendors(VENDORS_DEFAULT.map(v=>{
            const s=saved.find(x=>x.vendor_name===v.name);
            return s?{...v,approved:s.approved,amount:s.amount||"",date:s.approved_date||""}:v;
          }));
        }
        setLoading(false);
      });
    }
  },[user,unlocked]);

  if(!unlocked) return(<div style={{padding:32,textAlign:"center"}}><div style={{fontSize:44,marginBottom:10}}>🔒</div><h3 style={{margin:"0 0 8px"}}>Vendor Tracker</h3><p style={{color:C.muted,fontSize:13,marginBottom:18}}>Track all 9 starter vendors and approval status.</p><Btn onClick={onShowPaywall} style={{color:C.bg}}>Unlock Access</Btn></div>);

  const approved=vendors.filter(v=>v.approved).length;
  const total=vendors.filter(v=>v.approved&&v.amount).reduce((a,v)=>a+parseFloat(v.amount||0),0);

  const upd=async(i,k,val)=>{
    const updated=vendors.map((v,idx)=>idx===i?{...v,[k]:val}:v);
    setVendors(updated);
    if(user){
      const v=updated[i];
      await upsertVendor(user.id,v.name,{approved:v.approved,amount:v.amount,approved_date:v.date||null});
    }
  };

  return(
    <div style={{padding:16}}>
      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:800}}>Vendor Tracker</h2>
      <p style={{color:C.muted,fontSize:13,margin:"0 0 12px"}}>Need 5 accounts reporting before applying for revolving cards.{user&&<span style={{color:C.green}}> ✓ Auto-saved</span>}</p>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:14}}>
        {[["Approved",`${approved}/9`,C.gold],["Status",approved>=5?"✅ Ready":`Need ${5-approved}`,approved>=5?C.green:C.orange],["Total",`$${total.toLocaleString()}`,C.green]].map(([l,v,c])=>(
          <div key={l} style={{background:C.card,border:`1px solid ${c}33`,borderRadius:10,padding:"11px 8px",textAlign:"center"}}>
            <div style={{fontSize:approved>=5&&l==="Status"?12:20,fontWeight:900,color:c}}>{v}</div>
            <div style={{fontSize:10,color:C.muted,marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>
      {approved>=5&&<div style={{background:C.green+"14",border:`1px solid ${C.green}44`,borderRadius:10,padding:10,marginBottom:14,textAlign:"center",fontSize:13,color:C.green,fontWeight:700}}>🎉 Ready for revolving credit cards!</div>}
      {loading&&<div style={{textAlign:"center",padding:20,color:C.muted,fontSize:13}}>Loading your vendor data...</div>}
      {vendors.map((v,i)=>(
        <div key={v.name} style={{background:v.approved?C.green+"0A":C.card,border:`1px solid ${v.approved?C.green+"44":C.border}`,borderRadius:10,padding:12,marginBottom:8}}>
          <div style={{display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
            <button onClick={()=>upd(i,"approved",!v.approved)} style={{width:22,height:22,borderRadius:5,flexShrink:0,background:v.approved?C.green:"transparent",border:`2px solid ${v.approved?C.green:C.border}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",color:C.bg,fontWeight:900,fontSize:11}}>{v.approved?"✓":""}</button>
            <div style={{flex:1,minWidth:120}}>
              <div style={{fontWeight:700,fontSize:13}}>{v.name}</div>
              <div style={{color:C.muted,fontSize:11}}>{v.reports} · {v.limit}</div>
              <div style={{color:C.mutedLight,fontSize:10,marginTop:1}}>{v.req}</div>
            </div>
            {v.approved&&(
              <div style={{display:"flex",gap:8}}>
                <div><div style={{fontSize:9,color:C.muted,marginBottom:2}}>Amount</div><input value={v.amount} onChange={e=>upd(i,"amount",e.target.value)} onBlur={()=>user&&upsertVendor(user.id,v.name,{approved:v.approved,amount:v.amount,approved_date:v.date||null})} placeholder="$" style={{width:72,background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,padding:"4px 7px",color:C.text,fontSize:11}}/></div>
                <div><div style={{fontSize:9,color:C.muted,marginBottom:2}}>Date</div><input type="date" value={v.date} onChange={e=>upd(i,"date",e.target.value)} style={{width:108,background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,padding:"4px 7px",color:C.text,fontSize:11}}/></div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── CHECKLIST SCREEN ─────────────────────────────────────────────────────────
function ChecklistScreen({unlocked,user,onShowPaywall}){
  const [checked,setChecked]=useState({});
  const [loading,setLoading]=useState(false);

  useEffect(()=>{
    if(user&&unlocked){
      setLoading(true);
      getChecklist(user.id).then(ids=>{
        const obj={}; ids.forEach(id=>obj[id]=true);
        setChecked(obj); setLoading(false);
      });
    }
  },[user,unlocked]);

  if(!unlocked) return(<div style={{padding:32,textAlign:"center"}}><div style={{fontSize:44,marginBottom:10}}>🔒</div><h3 style={{margin:"0 0 8px"}}>24-Step Checklist</h3><p style={{color:C.muted,fontSize:13,marginBottom:18}}>Complete roadmap from entity to $50K+ cards.</p><Btn onClick={onShowPaywall} style={{color:C.bg}}>Unlock Access</Btn></div>);

  const cats=[...new Set(CHECKLIST_ITEMS.map(i=>i.cat))];
  const done=CHECKLIST_ITEMS.filter(i=>checked[i.id]).length;

  const toggle=async(id)=>{
    const next=!checked[id];
    setChecked(p=>({...p,[id]:next}));
    if(user) await toggleChecklistItem(user.id,id,next);
  };

  return(
    <div style={{padding:16}}>
      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:800}}>24-Step Checklist</h2>
      <p style={{color:C.muted,fontSize:13,margin:"0 0 10px"}}>{done}/{CHECKLIST_ITEMS.length} complete{user&&<span style={{color:C.green}}> · ✓ Auto-saved</span>}</p>
      <PBar pct={Math.round((done/CHECKLIST_ITEMS.length)*100)} color={C.green}/>
      {loading&&<div style={{textAlign:"center",padding:20,color:C.muted,fontSize:13}}>Loading your progress...</div>}
      <div style={{marginTop:16}}>
        {cats.map(cat=>(
          <div key={cat} style={{marginBottom:18}}>
            <div style={{fontSize:10,fontWeight:800,color:C.gold,textTransform:"uppercase",letterSpacing:1.5,marginBottom:8}}>{cat}</div>
            {CHECKLIST_ITEMS.filter(i=>i.cat===cat).map(item=>(
              <div key={item.id} onClick={()=>toggle(item.id)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 11px",background:checked[item.id]?C.green+"0F":C.card,border:`1px solid ${checked[item.id]?C.green+"44":C.border}`,borderRadius:8,marginBottom:6,cursor:"pointer"}}>
                <div style={{width:18,height:18,borderRadius:4,flexShrink:0,background:checked[item.id]?C.green:"transparent",border:`2px solid ${checked[item.id]?C.green:C.border}`,display:"flex",alignItems:"center",justifyContent:"center",color:C.bg,fontWeight:900,fontSize:10}}>{checked[item.id]?"✓":""}</div>
                <div style={{flex:1,fontSize:12,color:checked[item.id]?C.muted:C.text,textDecoration:checked[item.id]?"line-through":"none"}}>{item.label}</div>
                {item.link&&<a href={item.link} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()} style={{color:C.blue,fontSize:11,textDecoration:"none",flexShrink:0}}>↗</a>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FUNDING READINESS ────────────────────────────────────────────────────────
function FundingScreen({unlocked,onShowPaywall}){
  const [f,setF]=useState({paydex:"",tradeLines:"",months:"",bankBal:"",website:"no",phone:"no",duns:"no",trademark:"no",negItems:"",goal:""});
  const [score,setScore]=useState(null);
  if(!unlocked) return(<div style={{padding:32,textAlign:"center"}}><div style={{fontSize:44,marginBottom:10}}>💰</div><h3 style={{margin:"0 0 8px"}}>Funding Readiness Score</h3><p style={{color:C.muted,fontSize:13,marginBottom:18}}>See exactly how close you are to funding — and what to fix first.</p><Btn onClick={onShowPaywall} style={{color:C.bg}}>Unlock Access</Btn></div>);
  const set=(k,v)=>setF(p=>({...p,[k]:v}));
  const calc=()=>{
    let pts=0;
    const p=parseInt(f.paydex)||0,tl=parseInt(f.tradeLines)||0,mo=parseInt(f.months)||0,bal=parseInt(f.bankBal)||0,neg=parseInt(f.negItems)||0;
    if(p>=80)pts+=20;else if(p>=70)pts+=12;else if(p>=50)pts+=5;
    if(tl>=10)pts+=20;else if(tl>=5)pts+=14;else if(tl>=3)pts+=8;else if(tl>=1)pts+=3;
    if(mo>=24)pts+=15;else if(mo>=12)pts+=10;else if(mo>=6)pts+=6;else if(mo>=3)pts+=2;
    if(bal>=50000)pts+=15;else if(bal>=10000)pts+=10;else if(bal>=5000)pts+=5;
    if(f.website==="yes")pts+=5;if(f.phone==="yes")pts+=5;if(f.duns==="yes")pts+=10;if(f.trademark==="yes")pts+=5;
    if(neg===0)pts+=5;else if(neg<=2)pts+=2;
    setScore(Math.min(pts,100));
  };
  const label=score===null?"—":score>=85?"🚀 Funding Ready":score>=65?"⚡ Almost There":score>=40?"🔨 Building":score>=20?"🌱 Early Stage":"⚠️ Start Here";
  const sc=score===null?C.muted:score>=85?C.green:score>=65?C.gold:score>=40?C.orange:score>=20?C.blue:C.red;
  return(
    <div style={{padding:16}}>
      <h2 style={{margin:"0 0 4px",fontSize:20,fontWeight:800}}>Funding Readiness Score</h2>
      <p style={{color:C.muted,fontSize:13,margin:"0 0 16px"}}>See exactly how close you are to funding — and what's holding you back.</p>
      {score!==null&&(
        <div style={{background:sc+"14",border:`2px solid ${sc}44`,borderRadius:16,padding:22,textAlign:"center",marginBottom:20}}>
          <div style={{fontSize:60,fontWeight:900,color:sc,lineHeight:1}}>{score}</div>
          <div style={{fontSize:14,color:sc,fontWeight:700,marginTop:4}}>/ 100 — {label}</div>
          {f.goal&&<div style={{color:C.muted,fontSize:12,marginTop:6}}>For goal: {f.goal}</div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8,marginTop:16}}>
            {[["Paydex",(parseInt(f.paydex)||0)>=80],["Trade Lines",(parseInt(f.tradeLines)||0)>=5],["6+ Months",(parseInt(f.months)||0)>=6],["$10K+ Bank",(parseInt(f.bankBal)||0)>=10000],["DUNS",f.duns==="yes"],["Website",f.website==="yes"]].map(([l,ok])=>(
              <div key={l} style={{background:C.card,borderRadius:8,padding:"8px 6px",textAlign:"center"}}>
                <div style={{fontSize:16}}>{ok?"✅":"❌"}</div>
                <div style={{fontSize:10,color:C.muted,marginTop:2}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:4,marginBottom:12}}>
        {[["paydex","Paydex Score (0–100)","e.g. 80"],["tradeLines","Number of Trade Lines","e.g. 5"],["months","Months in Business","e.g. 12"],["bankBal","Bank Balance ($)","e.g. 10000"],["negItems","Personal Negative Items","e.g. 3"],["goal","Funding Goal","e.g. $250,000"]].map(([k,l,ph])=>(
          <Inp key={k} label={l} value={f[k]} onChange={v=>set(k,v)} placeholder={ph}/>
        ))}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8,marginBottom:16}}>
        {[["website","Professional Website?"],["phone","Toll-Free Phone?"],["duns","DUNS Number?"],["trademark","USPTO Trademark?"]].map(([k,l])=>(
          <div key={k}>
            <label style={{display:"block",fontSize:10,color:C.muted,marginBottom:4,textTransform:"uppercase",letterSpacing:.5}}>{l}</label>
            <div style={{display:"flex",gap:6}}>
              {["yes","no"].map(o=><button key={o} onClick={()=>set(k,o)} style={{flex:1,background:f[k]===o?C.gold+"22":"transparent",border:`1px solid ${f[k]===o?C.gold:C.border}`,borderRadius:6,padding:"8px 0",color:f[k]===o?C.gold:C.muted,cursor:"pointer",fontSize:12,fontWeight:f[k]===o?700:400,textTransform:"capitalize"}}>{o}</button>)}
            </div>
          </div>
        ))}
      </div>
      <Btn full onClick={calc} style={{padding:"13px 0",fontSize:15,color:C.bg}}>Calculate My Funding Score</Btn>
    </div>
  );
}

// Admin screen removed: the office manages Credit Changed My Life clients from inside POTENT OS (More > Money > Offerings), behind the staff login.

// ─── AUTH GATE ────────────────────────────────────────────────────────────────
function AuthScreen({onAuth}){
  const [mode,setMode]=useState("signin");
  const [email,setEmail]=useState("");const [pw,setPw]=useState("");const [name,setName]=useState("");
  const [loading,setLoading]=useState(false);const [err,setErr]=useState("");const [ok,setOk]=useState("");
  const handle=async()=>{
    setErr("");setLoading(true);
    try{
      if(mode==="signup"){
        const{error:e}=await supabase.auth.signUp({email,password:pw,options:{data:{full_name:name}}});
        if(e)throw e;
        setOk("Account created! Check your email to confirm, then sign in.");setMode("signin");
      }else{
        const{data,error:e}=await supabase.auth.signInWithPassword({email,password:pw});
        if(e)throw e;
        onAuth(data.user);
      }
    }catch(e){setErr(e.message||"Something went wrong.");}
    setLoading(false);
  };
  const inp={width:"100%",background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:"11px 14px",color:C.text,fontSize:14,fontFamily:F,boxSizing:"border-box",marginBottom:11};
  return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",padding:16,fontFamily:F}}>
      <div style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:16,padding:28,maxWidth:380,width:"100%"}}>
        <div style={{textAlign:"center",marginBottom:22}}>
          <div style={{fontSize:32,marginBottom:8}}>💳</div>
          <h2 style={{margin:"0 0 4px",color:C.gold,fontSize:18,fontWeight:900}}>Credit Changed My Life</h2>
          <p style={{color:C.muted,fontSize:12,margin:0}}>by POTENT</p>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:18}}>
          {["signin","signup"].map(m=><button key={m} onClick={()=>setMode(m)} style={{flex:1,background:mode===m?C.gold:"transparent",color:mode===m?C.bg:C.muted,border:`1px solid ${mode===m?C.gold:C.border}`,borderRadius:8,padding:"8px 0",fontSize:13,fontWeight:mode===m?700:400,cursor:"pointer"}}>{m==="signin"?"Sign In":"Create Account"}</button>)}
        </div>
        {mode==="signup"&&<input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" style={inp}/>}
        <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" style={inp}/>
        <input type="password" value={pw} onChange={e=>setPw(e.target.value)} placeholder="Password" style={inp} onKeyDown={e=>e.key==="Enter"&&handle()}/>
        {err&&<div style={{background:C.red+"14",border:`1px solid ${C.red}33`,borderRadius:8,padding:"9px 12px",fontSize:12,color:C.red,marginBottom:11}}>{err}</div>}
        {ok&&<div style={{background:C.green+"14",border:`1px solid ${C.green}33`,borderRadius:8,padding:"9px 12px",fontSize:12,color:C.green,marginBottom:11}}>{ok}</div>}
        <Btn full disabled={loading||!email||!pw} onClick={handle} style={{padding:"13px 0",fontSize:14,color:C.bg}}>
          {loading?"Loading...":(mode==="signin"?"Sign In":"Create Account")}
        </Btn>
        <p style={{color:C.muted,fontSize:12,textAlign:"center",marginTop:14}}>
          {mode==="signin"?"Don't have an account? ":"Already have an account? "}
          <button onClick={()=>setMode(mode==="signin"?"signup":"signin")} style={{background:"none",border:"none",color:C.gold,cursor:"pointer",fontSize:12,fontWeight:700,padding:0}}>
            {mode==="signin"?"Sign Up":"Sign In"}
          </button>
        </p>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

// Wrapper that shows paywall for locked tools
function PaywallWrap({ unlocked, onShowPaywall, title, icon, children }) {
  if (!unlocked) return (<div style={{padding:32,textAlign:"center"}}><div style={{fontSize:44,marginBottom:10}}>{icon}</div><h3 style={{margin:"0 0 8px"}}>{title}</h3><p style={{color:"#666",fontSize:13,marginBottom:18}}>This tool is part of the DIY Course.</p><button onClick={onShowPaywall} style={{background:"#1e40af",color:"#fff",border:"none",borderRadius:8,padding:"12px 24px",fontSize:14,fontWeight:"bold",cursor:"pointer"}}>Unlock Access — $79</button></div>);
  return children;
}

const TABS=[
  {id:"course",  icon:"🎓", label:"Course"},
  {id:"motions", icon:"📄", label:"Motions"},
  {id:"letters", icon:"⚖️",  label:"Letters"},
  {id:"mail",    icon:"✉️",  label:"Mail"},
  {id:"tracker", icon:"⏱️",  label:"Tracker"},
  {id:"vendors", icon:"💳",  label:"Vendors"},
  {id:"checklist",icon:"✅", label:"Steps"},
  {id:"funding", icon:"💰",  label:"Readiness"},
  {id:"simulator", icon:"📊", label:"Simulator"},
  {id:"metro2", icon:"🔍", label:"Metro 2"},
  {id:"bureaus", icon:"📇", label:"Bureaus"},
  {id:"plan", icon:"🗺️", label:"90-Day"},
];

export default function App(){
  const [screen,setScreen]=useState("landing");
  const [user,setUser]=useState(null);
  const [profile,setProfile]=useState(null);
  const [completedIds,setCompletedIds]=useState([]);
  const [tab,setTab]=useState("course");
  const [showPaywall,setShowPaywall]=useState(false);
  const [authChecked,setAuthChecked]=useState(false);

  const unlocked=profile?.plan==="diy"||profile?.plan==="dfy";

  useEffect(()=>{
    const{data:{subscription}}=onAuthChange(async(_,session)=>{
      const u=session?.user||null;
      setUser(u);
      if(u){
        const p=await getProfile(u.id);
        setProfile(p);
        if(p?.plan&&p.plan!=="free") setScreen("app");
        const ids=await getProgress(u.id);
        setCompletedIds(ids);
      }else{setProfile(null);setCompletedIds([]);}
      setAuthChecked(true);
    });
    return()=>subscription.unsubscribe();
  },[]);

  const handleToggleLesson=async(lessonId,done)=>{
    if(done)setCompletedIds(p=>[...new Set([...p,lessonId])]);
    else setCompletedIds(p=>p.filter(x=>x!==lessonId));
    if(user){
      if(done)await markLessonComplete(user.id,lessonId);
      else await unmarkLessonComplete(user.id,lessonId);
    }
  };

  // ── Handle Stripe redirect back to site (the server confirms the payment; nothing is unlocked from the browser) ──
  const [payNote,setPayNote]=useState("");
  useEffect(()=>{
    const { success, sessionId, canceled } = getCheckoutParams();
    if(canceled){ setScreen("landing"); window.history.replaceState({}, "", import.meta.env.BASE_URL); return; }
    if(success && sessionId){
      setScreen("app");
      verifyAndUnlock(sessionId).then(async(res)=>{
        window.history.replaceState({}, "", import.meta.env.BASE_URL);
        if(!res){ setPayNote("We could not confirm that payment yet. If you were charged, it will unlock within a minute; refresh this page."); return; }
        if(res.pending){ setPayNote("Payment received. Create your account with the same email you paid with and your purchase will unlock automatically."); return; }
        const { data } = await supabase.auth.getUser();
        if(data?.user){ const p=await getProfile(data.user.id); setProfile(p); }
        setPayNote("Payment confirmed. Thank you!");
      });
    }
  },[]);

  const handleBuy=async(plan)=>{
    setShowPaywall(false);
    await startCheckout(plan);
  };

  if(!authChecked) return(
    <div style={{minHeight:"100vh",background:C.bg,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:F}}>
      <div style={{color:C.muted,fontSize:14}}>Loading...</div>
    </div>
  );

  if(screen==="landing") return <LandingPage onEnter={handleBuy} onPreview={()=>setScreen("app")}/>;
  if(screen==="auth") return <AuthScreen onAuth={(u)=>{setUser(u);setScreen("app");}}/>;

  return(
    <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:F,display:"flex",flexDirection:"column",maxWidth:720,margin:"0 auto"}}>
      {/* Header */}
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:"10px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:50}}>
        <div style={{display:"flex",alignItems:"center",gap:6}}>
          <span style={{fontWeight:900,fontSize:14,color:C.gold}}>Credit Changed My Life</span>
          <span style={{color:C.muted,fontSize:10}}> by POTENT</span>
          {unlocked&&<Tag label={profile?.plan==="dfy"?"DFY":"DIY"} color={profile?.plan==="dfy"?C.gold:C.blue}/>}
        </div>
        <div style={{display:"flex",gap:6,alignItems:"center"}}>
          {!unlocked&&<Btn small onClick={()=>setShowPaywall(true)} style={{color:C.bg}}>Unlock</Btn>}
          {!user&&<Btn small outline color={C.muted} onClick={()=>setScreen("auth")}>Sign In</Btn>}
          {user&&<Btn small outline color={C.muted} onClick={()=>{signOut();setUser(null);setProfile(null);}}>Sign Out</Btn>}
          <a href="/" style={{border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 8px",color:C.muted,fontSize:10,textDecoration:"none"}}>POTENT OS</a>
          <button onClick={()=>setScreen("landing")} style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,padding:"4px 8px",color:C.muted,fontSize:10,cursor:"pointer"}}>← Home</button>
        </div>
      </div>

      {/* User sync banner */}
      {!user&&unlocked&&(
        <div style={{background:C.blue+"14",border:`1px solid ${C.blue}33`,padding:"9px 14px",fontSize:12,color:C.mutedLight,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>💾 Create an account to save your progress</span>
          <button onClick={()=>setScreen("auth")} style={{background:C.blue,color:"#fff",border:"none",borderRadius:6,padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:700}}>Sign Up Free</button>
        </div>
      )}
      {payNote&&<div style={{background:C.gold+"14",borderBottom:`1px solid ${C.gold}33`,padding:"8px 14px",fontSize:12,color:C.mutedLight}}>{payNote}</div>}
      {user&&<div style={{background:C.green+"0A",borderBottom:`1px solid ${C.green}22`,padding:"6px 14px",fontSize:11,color:C.green}}>✓ Signed in as {user.email} — progress auto-saves</div>}

      {/* Content */}
      <div style={{flex:1,overflowY:"auto",paddingBottom:90}}>
        {tab==="course"   &&<CourseScreen   unlocked={unlocked} completedIds={completedIds} onToggle={handleToggleLesson} onShowPaywall={()=>setShowPaywall(true)}/>}
        {tab==="motions"  &&<MotionsScreen  unlocked={unlocked} onShowPaywall={()=>setShowPaywall(true)}/>}
        {tab==="letters"  &&<LettersScreen  unlocked={unlocked} onShowPaywall={()=>setShowPaywall(true)}/>}
        {tab==="mail"     &&<MailScreen     unlocked={unlocked} user={user} profile={profile} onShowPaywall={()=>setShowPaywall(true)} onProfile={(p)=>setProfile(x=>({...(x||{}),...p}))}/>}
        {tab==="tracker"  &&<TrackerScreen  unlocked={unlocked} user={user} onShowPaywall={()=>setShowPaywall(true)}/>}
        {tab==="vendors"  &&<VendorScreen   unlocked={unlocked} user={user} onShowPaywall={()=>setShowPaywall(true)}/>}
        {tab==="checklist"&&<ChecklistScreen unlocked={unlocked} user={user} onShowPaywall={()=>setShowPaywall(true)}/>}
        {tab==="funding"  &&<FundingScreen  unlocked={unlocked} onShowPaywall={()=>setShowPaywall(true)}/>}
        {tab==="simulator"&&<PaywallWrap unlocked={unlocked} onShowPaywall={()=>setShowPaywall(true)} title="Score Simulator" icon="📊"><ScoreSimulator/></PaywallWrap>}
        {tab==="metro2"   &&<PaywallWrap unlocked={unlocked} onShowPaywall={()=>setShowPaywall(true)} title="Metro 2 Scanner" icon="🔍"><Metro2Scanner/></PaywallWrap>}
        {tab==="bureaus"  &&<PaywallWrap unlocked={unlocked} onShowPaywall={()=>setShowPaywall(true)} title="Bureau Directory" icon="📇"><BureauDirectory/></PaywallWrap>}
        {tab==="plan"     &&<PaywallWrap unlocked={unlocked} onShowPaywall={()=>setShowPaywall(true)} title="90-Day Plan" icon="🗺️"><ActionPlan/></PaywallWrap>}
      </div>

      {/* Scrollable bottom nav */}
      <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:720,background:C.surface,borderTop:`1px solid ${C.border}`,display:"flex",overflowX:"auto",zIndex:50,WebkitOverflowScrolling:"touch"}}>
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)} style={{minWidth:68,background:"none",border:"none",padding:"8px 4px 10px",display:"flex",flexDirection:"column",alignItems:"center",gap:2,cursor:"pointer",color:tab===t.id?C.gold:C.muted,borderTop:`2px solid ${tab===t.id?C.gold:"transparent"}`,flexShrink:0,transition:"color .15s"}}>
            <span style={{fontSize:17}}>{t.icon}</span>
            <span style={{fontSize:9,fontWeight:tab===t.id?700:400,whiteSpace:"nowrap"}}>{t.label}</span>
          </button>
        ))}
      </div>

      {showPaywall&&<PaywallModal onClose={()=>setShowPaywall(false)} onBuy={handleBuy}/>}
    </div>
  );
}
