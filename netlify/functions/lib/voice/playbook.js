// The POTENT Dispatch Booking Playbook, distilled for the phone assistant. Source: dispatch-playbook/index.html (Master Sales Book, Closer's Playbook,
// Booking Agent Playbook, Master Calling & Booking Playbook, Live Rebuttal Cards). Scripts are kept in the books' own words.
// NO PRICES live here: every price comes from the tools (calculate_quote, quote_special_service), because the books disagree with each other
// (older vs newer junk price lists; mileage formula vs zone rates; inside-the-home or not). Those conflicts are listed in Open Items OI-1, OI-2, OI-5, OI-6 of the playbook.
const TOPICS = {
  rules: [
    "Three rules that never change: (1) Never make the customer feel sold; they should feel understood. (2) Never defend. Never argue. Discover. (3) After you ask for the business, stop talking and let them answer.",
    "Listen first. Let them explain completely before you ask for details. The customer is not an interruption.",
    "Real urgency only. Never say 'sign today or the offer disappears.' Urgency comes from consequences: 'What happens if this comes up again and you don't have another option?'",
    "Every conversation ends with a next step. Never end with 'let me know.' Ask: 'When would be a good time for us to reconnect?'"
  ].join("\n"),
  three_a: [
    "THE 3 A's for any objection: ACKNOWLEDGE ('That makes sense.' 'I understand.' 'I appreciate you sharing that.'), ASSOCIATE ('I hear that from a lot of customers...'), ASK (return control with a question: 'What specifically makes you feel that way?' 'What would need to happen for this to make sense?' 'What is the biggest concern preventing you from moving forward?'). Then listen.",
    "Discovery: use 'Out of curiosity' questions. 1-10 question: 'On a scale of 1 to 10, how satisfied are you with how you handle that today?' If 10: 'What makes it a 10?' If 7: 'Why isn't it a 10?' Importance: if they say 6, ask 'Why isn't it lower?' (never 'why isn't it higher'). Then: 'Where are you now? Where would you like to be instead? What's keeping you from getting there?'",
    "Agreement stacking before any close, one at a time, each ending in 'correct?': the problem, the impact, the goal. Then connect the solution to their problem in two sentences. Never list features. Never sell the truck: the value is no delays, protected deadlines, less stress, more options, saved time."
  ].join("\n"),
  price_pushback: [
    "PRICE PUSHBACK. Never discount, never invent a lower number (you cannot change a price; a person handles that). Price is a symptom: find the real concern.",
    "'Your price is too high': 'I understand. When you say the price is high, is the concern the budget itself, or are you comparing it to another option?' Then: 'Besides price, what is most important when choosing a transportation partner?' Or: 'Is it higher than what you're currently paying, or higher than what you expected this shipment to cost?' Then: 'How important is the delivery timeline?' Then: 'What happens to your operation if it doesn't arrive when you need it?'",
    "'Compared to what?' / 'What were you expecting to pay?' Let them answer first. Never drop price without asking what they expected.",
    "'I can get it cheaper': 'Absolutely. What are they offering?' Then: 'Do they have GPS tracking and same-day availability?' Sell the difference.",
    "'Can you come down?' / 'What's your lowest?': say honestly that a person on the team handles price changes; offer request_human_handoff or create_callback_task, and ask 'What number would get this covered today?' so the person has it.",
    "'I'll just do it myself' (junk): 'Totally fair. Just so you know, a dump run costs you the landfill fees plus your truck, gas and about three hours. We do it and you're done. Worth it?' Do not quote numbers from memory; use the tool price.",
    "Payment and policy you may say out loud: payment is collected before we leave the job site, cards or cash, never checks. Time starts when the truck arrives. Stairs beyond one flight, long carries or unusual access can change the final price, so it is confirmed before work begins."
  ].join("\n"),
  hesitation: [
    "'I need to think about it': 'Of course. Usually when someone says that, there is something specific they are thinking about. What part do you want to think through?' Then: 'Is there anything that would prevent this from moving forward?' Then: 'What would it take for you to feel comfortable saying yes?' No arguing, no pressure, questions only.",
    "'I need to talk to my partner / boss': 'That makes sense. What do you think they will want to know before making a decision?'",
    "'Send me a quote by email': 'Absolutely. Before I put that together, what are the most important things you want it to solve? And if the price works, are you ready to move forward today?'",
    "'Call me later' / 'not a good time': 'I completely understand. When would be a better time to revisit this?' Then: 'What are you waiting on? If that resolves, are you ready to book?' Use create_callback_task with the time they gave.",
    "A flat 'no': 'I appreciate your honesty. Before I let you go, what would need to be different for a company like ours to become useful to you?' Their answer teaches you. Then stop; never push past a clear no."
  ].join("\n"),
  competitor: [
    "'We already have a carrier / someone else': 'That makes sense. I'm not looking to replace what's working. What happens when they're booked, or something needs to move right now?' If they have a backup: 'How confident are you in that backup on a scale of 1 to 10? Why isn't it a 10?' The goal is to become their backup, not the replacement.",
    "'We'll call you if we need you': 'I understand. The only reason I ask is that urgent situations usually happen when companies don't have time to search. Would it make sense to have us as a backup contact before that happens?'",
    "'We don't need anything right now': 'No problem. Can I get your info in our system so if a truck falls through or you get overflow, you have our number? What's the best email to send our info to?' Log it as follow-up, not a dead end.",
    "'Why should I use you?': be honest and specific: we only commit to freight our truck can actually do, and we don't promise equipment we don't have."
  ].join("\n"),
  junk_removal: [
    "JUNK REMOVAL CALL. Listen first, then ask one at a time: 'What are you getting rid of?' (the real item list). 'Is it a single item or more like a room's worth?' (sizes the load). 'Where is it: curbside, garage, or inside the home?' (access). 'Any mattresses, tires, appliances or electronics?' (these carry real disposal fees). 'When works for you?' (same-day may be possible; confirm real timing). 'Any stairs beyond one flight?'",
    "Price ONLY from quote_special_service (junk removal), by load size. Read the number confidently; do not apologize for it. Heavy or special items (mattress, tires, fridge, TV) carry a disposal surcharge that must be confirmed before the final price.",
    "Hazardous materials, paint and chemicals: we do not take them. Household moving and inside-the-house removal are not what we chase; if the request is inside the home or unclear, say a person will confirm access (the books disagree on this, so do not promise it).",
    "Then close: 'Want me to get that booked for you?' Payment is before we leave the site, cards or cash, no checks. After booking, offer the secure payment link.",
    "Turn a cleanout into a repeat account: one cleanout today can become a property-management relationship or a recurring removal account. Ask: 'Do you manage other properties or have more cleanouts coming up?'"
  ].join("\n"),
  cleanout: [
    "PROPERTY / COMMERCIAL CLEANOUT. Get: business or property address, what the materials are, estimated volume, access (dock, stairs, elevator), preferred completion date, and photos if they can send them. Price only from quote_special_service; the final price is confirmed after a walkthrough, which a person arranges (create_callback_task).",
    "We focus on commercial cleanouts, warehouse and store fixture removal, large furniture and appliance removal and commercial debris. We do not chase small pickups, household moving, hazardous materials, paint or chemicals.",
    "For approved jobs, same-day payment is preferred (cash or approved methods); the goal is: complete the job, document it, collect payment."
  ].join("\n"),
  freight: [
    "FREIGHT / DELIVERY CALL. Our truck: 16-foot dock-height box truck, about 4,500 pounds, ramp and E-tracks, NO liftgate (ground-level or dock loading only). Do not promise equipment we do not have.",
    "Key questions, one at a time: 'What are you moving?' 'From where to where?' 'When do you need it done?' 'How soon can you be ready?' Then follow the BOOKING FLOW with the tools. Price ONLY from calculate_quote; read it plainly: 'Based on what you need, your price today is X.'",
    "A good load: full truckload one-way, dock-height pickup, reasonable distance, a direct shipper. Services are priced separately; never quote one service's price for another.",
    "The Big Rule: no verified parties, no agreement, no load. Never invent availability, delivery times or insurance."
  ].join("\n"),
  popup_events: [
    "ONE-TIME / POP-UP EVENT. Ask: what is being moved (tents, tables, product, displays, equipment), the event date and times, where it is loaded and where it goes, whether it is pickup and drop-off only or needs setup, and whether the venue has a dock or ramp. Price ONLY from quote_special_service (pop-up events); it is pickup and drop-off only unless the tool says otherwise.",
    "Event, trade show and pop-up companies are repeat buyers: after the quote, ask whether they have more events coming up and mention a recurring account."
  ].join("\n"),
  recurring: [
    "RECURRING ROUTE / CONTRACT ACCOUNT. This is the highest-value call: one emergency shipment is good, a recurring customer changes the company. Ask: what do you need moved, how often (daily, weekly, which days), pickup and delivery locations, what a missed or late delivery costs them.",
    "Recurring rates come only from the quote tool (quote_special_service, recurring); never state a discount from memory. Overtime always costs more than the block rate.",
    "Qualify before accepting ongoing business: legal company name, business address, billing address, primary contact, decision maker, accounts payable contact. Do not collect payment details by voice.",
    "Payment terms: say 'We offer net accounts. I'll get you set up so you can pay on terms instead of at the door.' Never quote a number of days; the owner sets terms.",
    "Then set up the account and the prepaid wallet: get name, email, company and route (create_or_update_lead) and create_callback_task so a person finishes the account and wallet setup. Never say it is already set up."
  ].join("\n"),
  closing: [
    "CLOSING. Do not ask 'Are you interested?' Ask: 'Based on what we discussed, does it make sense for POTENT to be a transportation resource for your team?' Or the direct close: 'Is there any reason we shouldn't get this scheduled?' Then be quiet.",
    "Assumptive (clearly interested): 'Based on what we discussed, the next step is getting you set up. Does that make sense?' Choice: 'Would it make more sense to start with one job, or set up a regular route?' Next step: 'What would be the best next step from your side?'",
    "The customer commitment question: 'What would make you confident choosing POTENT?' The answer tells you what matters.",
    "After the booking: confirm the details, give the Job ID and booking reference from the tool, offer the secure payment link, and tell them how to track the driver (see accounts_tracking).",
    "Follow-up rule: stay available, do not chase. After a completed job, a person follows up in 24 hours: how did it go, anything to improve, anything coming up. Referral ask once the customer is happy: 'Is there anyone you know who could benefit from a transportation resource like us?'"
  ].join("\n"),
  accounts_tracking: [
    "TRACKING: tell every booked customer they can follow their job and driver any time in the POTENT app (the Track tab) with their Job ID; by phone you can also read the status with look_up_booking_status (needs the booking reference and the last 4 digits of the phone on the booking).",
    "ACCOUNT: invite them to make their POTENT account so their jobs, tracking, receipts and their prepaid wallet live in one place and rebooking takes seconds. Recommend it to every repeat or business customer. You cannot create the account yourself on the phone: take name, email and company (create_or_update_lead) and create_callback_task, or point them to the app. Never say the account exists until a person confirms.",
    "DRIVERS WHO WANT TO JOIN: if the caller wants to drive or work with POTENT, thank them, ask what vehicle they run, their name, phone and email, then create_callback_task (reason 'driver wants to join POTENT; send onboarding link') so a person sends the driver onboarding. Never promise pay, jobs or approval."
  ].join("\n"),
  trucking_os: [
    "TRUCKING COMPANIES: if the caller runs trucks, ask how many trucks, what they pay per truck per month for dispatch and billing today, and how much detention goes unbilled. Position POTENT OS as the system; offer a short demo (book_demo) rather than listing features. Prices only from get_approved_service_information."
  ].join("\n")
};
const NAMES = Object.keys(TOPICS);
function get(topic) {
  const t = String(topic || "").toLowerCase().trim();
  if (TOPICS[t]) return { ok: true, topic: t, script: TOPICS[t], note: "Say these in your own natural voice, short turns. Prices only from tools." };
  return { ok: false, error: "unknown_topic", topics: NAMES };
}
module.exports = { TOPICS, NAMES, get };
