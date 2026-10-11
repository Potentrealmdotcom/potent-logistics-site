// netlify/functions/extract-document.mjs
// AI Document Extraction using OpenAI Vision API
// Handles: Rate Cons, BOLs, Receipts, CDLs

export default async function(req) {
if(req.method !== "POST") return new Response("Method not allowed", { status: 405 });

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
if(!OPENAI_KEY || !OPENAI_BASE_URL) return Response.json({ error: "AI Gateway not configured" }, { status: 500 });

try {
const { imageBase64, docType } = await req.json();
if(!imageBase64 || !docType) return Response.json({ error: "Missing image or docType" }, { status: 400 });

const prompts = {
  ratecon: `You are extracting data from a trucking rate confirmation document. Extract these fields and return ONLY valid JSON, no other text:

{
"customerName": "",
"customerPhone": "",
"pickupAddress": "",
"deliveryAddress": "",
"pickupDate": "",
"deliveryDate": "",
"commodity": "",
"weight": "",
"rate": "",
"brokerName": "",
"brokerMC": "",
"loadNumber": "",
"notes": ""
}
If a field is not found, use empty string. Return only the JSON object.`,

  bol: `You are extracting data from a Bill of Lading (BOL). Extract these fields and return ONLY valid JSON:

{
"bolNumber": "",
"shipperName": "",
"shipperAddress": "",
"consigneeName": "",
"consigneeAddress": "",
"commodity": "",
"weight": "",
"pieces": "",
"specialInstructions": "",
"date": ""
}
Return only the JSON object.`,

  receipt: `You are extracting data from a receipt or expense document. Return ONLY valid JSON:

{
"vendor": "",
"date": "",
"amount": "",
"expenseType": "",
"description": "",
"state": ""
}
For expenseType use one of: fuel, tolls, parking, supplies, other.
Return only the JSON object.`,

  cdl: `You are extracting data from a Commercial Driver's License (CDL). Return ONLY valid JSON:

{
"driverName": "",
"licenseNumber": "",
"state": "",
"dateOfBirth": "",
"expiryDate": "",
"licenseClass": "",
"endorsements": ""
}
Return only the JSON object.`
};

const prompt = prompts[docType];
if(!prompt) return Response.json({ error: "Invalid docType" }, { status: 400 });

const baseUrl = OPENAI_BASE_URL.replace(/\/+$/, "").replace(/\/v1$/, "");
const response = await fetch(baseUrl + "/v1/chat/completions", {
  method: "POST",
  headers: {
    "Authorization": "Bearer " + OPENAI_KEY,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "gpt-4o-mini",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: imageBase64, detail: "low" } }
      ]
    }]
  })
});

const data = await response.json();
if(!response.ok) return Response.json({ error: data.error?.message || "OpenAI error" }, { status: 500 });

const text = data.choices?.[0]?.message?.content || "";
// Clean and parse JSON
const cleaned = text.replace(/```json|```/g, "").trim();
const extracted = JSON.parse(cleaned);

return Response.json({ success: true, data: extracted, docType });

} catch(error) {
return Response.json({ error: error.message }, { status: 500 });
}
}
