// netlify/functions/extract-document.js
// AI Document Extraction using OpenAI Vision API
// Handles: Rate Cons, BOLs, Receipts, CDLs

exports.handler = async function(event, context) {
if(event.httpMethod !== “POST”) return { statusCode: 405, body: “Method not allowed” };

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if(!OPENAI_KEY) return { statusCode: 500, body: JSON.stringify({ error: “API key not configured” }) };

try {
const { imageBase64, docType } = JSON.parse(event.body);
if(!imageBase64 || !docType) return { statusCode: 400, body: JSON.stringify({ error: “Missing image or docType” }) };

```
const prompts = {
  ratecon: `You are extracting data from a trucking rate confirmation document. Extract these fields and return ONLY valid JSON, no other text:
```

{
“customerName”: “”,
“customerPhone”: “”,
“pickupAddress”: “”,
“deliveryAddress”: “”,
“pickupDate”: “”,
“deliveryDate”: “”,
“commodity”: “”,
“weight”: “”,
“rate”: “”,
“brokerName”: “”,
“brokerMC”: “”,
“loadNumber”: “”,
“notes”: “”
}
If a field is not found, use empty string. Return only the JSON object.`,

```
  bol: `You are extracting data from a Bill of Lading (BOL). Extract these fields and return ONLY valid JSON:
```

{
“bolNumber”: “”,
“shipperName”: “”,
“shipperAddress”: “”,
“consigneeName”: “”,
“consigneeAddress”: “”,
“commodity”: “”,
“weight”: “”,
“pieces”: “”,
“specialInstructions”: “”,
“date”: “”
}
Return only the JSON object.`,

```
  receipt: `You are extracting data from a receipt or expense document. Return ONLY valid JSON:
```

{
“vendor”: “”,
“date”: “”,
“amount”: “”,
“expenseType”: “”,
“description”: “”,
“state”: “”
}
For expenseType use one of: fuel, tolls, parking, supplies, other.
Return only the JSON object.`,

```
  cdl: `You are extracting data from a Commercial Driver's License (CDL). Return ONLY valid JSON:
```

{
“driverName”: “”,
“licenseNumber”: “”,
“state”: “”,
“dateOfBirth”: “”,
“expiryDate”: “”,
“licenseClass”: “”,
“endorsements”: “”
}
Return only the JSON object.`
};

```
const prompt = prompts[docType];
if(!prompt) return { statusCode: 400, body: JSON.stringify({ error: "Invalid docType" }) };

const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
if(!response.ok) return { statusCode: 500, body: JSON.stringify({ error: data.error?.message || "OpenAI error" }) };

const text = data.choices?.[0]?.message?.content || "";
// Clean and parse JSON
const cleaned = text.replace(/```json|```/g, "").trim();
const extracted = JSON.parse(cleaned);

return {
  statusCode: 200,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ success: true, data: extracted, docType })
};
```

} catch(e) {
return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
}
};
