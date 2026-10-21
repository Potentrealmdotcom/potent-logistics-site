// The phone assistant's playbook. SOURCES: only the two October 2026 books:
//   (1) THE POTENT MASTER SALES BOOK (chapters 5-11 conversation system, 16, 18, 34-38 for the OS, VOICE and Əlevate, calls and bookings, price list, wallets)
//   (2) the POTENT OS Master Closer's Playbook (chapters 7, 9-11, 16-19).
// Scripts are in the books' own words. Operations prices (freight, junk, pop-up, recurring, routes) are NOT stored here: the quote tools carry the book's Chapter 37 / 19 price list,
// and a price only ever comes from a tool. OS, VOICE and Əlevate plan prices below are the books' Chapter 34/35 (Sales Book) and 16/17 (Closer's Playbook) numbers.
const TOPICS = {
  rules: [
    "Three rules that never change: (1) Never make the customer feel sold; they should feel understood. (2) Never defend. Never argue. Discover. (3) After you ask for the business, stop talking and let them answer.",
    "Never begin with what we do. Begin with understanding the customer's problem. The person asking thoughtful questions controls the conversation. Listen to understand, not to respond. Never offer a solution until you understand the situation.",
    "Every conversation ends with a next step: a quote, a booking, a demo, a follow-up. Never end with 'let me know.' Ask: 'When would be a good time for us to reconnect?'",
    "Never create fake urgency. Real urgency comes from consequences: 'What happens if this situation occurs again and you don't have another option?'",
    "Never say never-ending 'how else can I help' endings. After you answer, move to the next step."
  ].join("\n"),
  three_a: [
    "THE 3 A's for any objection. ACKNOWLEDGE: 'That makes sense.' 'I understand.' 'I appreciate you sharing that.' ASSOCIATE: connect it to a bigger conversation ('I hear that from many companies we speak with...'). ASK: return control with a question: 'What specifically makes you feel that way?' 'What would need to happen for this to make sense?' 'What is the biggest concern preventing you from moving forward?' Then listen.",
    "Discovery uses 'Out of curiosity' questions: 'Out of curiosity, how often does that happen?' 'What normally happens when that occurs?' 'What's the biggest headache with that process?'",
    "The 1-10 question: 'Just so I understand where you're at, on a scale of 1 to 10, how satisfied are you with the way you're handling that today?' If 10: 'That's great. What makes it a 10?' If 7: 'Got you. Why isn't it a 10?' Importance: if they say 6, ask 'Why isn't it lower?' (never 'why isn't it higher'). Then: 'Where are you now? Where would you like to be instead? What's keeping you from getting there?'",
    "Agreement stacking before any close, each ending in 'correct?': the problem ('From what you've shared, the biggest challenge is ___, correct?'), the impact ('And when that happens, it creates ___ for your team, correct?'), the goal ('So ideally, you would want ___, correct?'). Then connect the solution to their problem in two sentences. Never list features. Never sell the truck: the value is preventing delays, protecting deadlines, reducing stress, giving options, saving time."
  ].join("\n"),
  price_pushback: [
    "PRICE PUSHBACK. Never immediately discount. You cannot change a price; a person handles that. Price is a symptom: find the real concern.",
    "'Your price is too high': 'I understand. When you say the price is high, is the concern the budget itself, or are you comparing it to another option?' Then: 'Besides price, what is most important when choosing a transportation partner?'",
    "Or: 'Is it higher than what you're currently paying, or higher than what you expected this particular shipment to cost?' Then: 'How important is the delivery timeline?' Then: 'What happens to your operation if it doesn't arrive when you need it?' You're not defending yourself. You're understanding the value.",
    "Or: 'When you say high, compared to what?' (wait) 'Is the concern the price itself, or making sure the value matches the investment?'",
    "If they push for a lower number, say honestly that a person on the team handles price changes, offer request_human_handoff or create_callback_task, and ask what number they were expecting so the person has it. Never invent a discount.",
    "Say the quote with confidence. Do not apologize for it. A quote is good for 30 minutes."
  ].join("\n"),
  hesitation: [
    "'I need to think about it': 'Of course. Usually when someone says that, there is something specific they are thinking about. What would you say is the biggest thing you need to consider?' Or: 'Of course. Before you do, is there anything specific you're unsure about?' Then: 'What would make this a no?' Then: 'What would it take for you to feel comfortable saying yes?' No arguing. No pressure. Questions.",
    "'I need to talk to my partner / boss': 'That makes sense. What do you think they will want to know before making a decision?'",
    "'Send me a proposal / a quote by email': 'Absolutely. Before I put that together, what are the most important things you would like the proposal to solve?'",
    "'Now is not a good time / call me later': 'I completely understand. When would be a better time to revisit this?' Then: 'Before we reconnect, is there anything about your current process you would like to improve?' Log the time with create_callback_task.",
    "A flat 'no': 'I appreciate your honesty. Before I let you go, can I ask what would need to be different for a company like ours to become useful to you?' Their answer teaches you. Then stop; never push past a clear no."
  ].join("\n"),
  competitor: [
    "'We already have a carrier / provider': 'That makes sense. Most companies we work with already have transportation providers. I'm not looking to replace what is working. I'm curious, what happens when your current carriers are unavailable or something urgent comes up?' If they have a backup: 'How confident are you in that backup on a scale of 1 to 10? Why isn't it a 10?' The goal is to become the backup solution, not the replacement.",
    "'We don't need anything right now': 'I understand. Most companies don't need emergency transportation every day. The reason I reached out is because these situations usually happen unexpectedly. Do you currently have a backup option in place if something urgent happens?'",
    "'Send me information': 'Absolutely, I can send that over. So I make sure I send something useful, can I ask what type of situations you normally need support with?' Then: 'And when would be a good time for me to follow back up?'",
    "'We only use contracted carriers': 'That makes sense. Many companies have established carrier relationships. We are not trying to disrupt that. We provide another option when capacity is tight, deadlines change, or something unexpected happens.'",
    "'We'll call you if we need you': 'I understand. The only reason I ask is because urgent situations usually happen when companies don't have time to search. Would it make sense to have us as a backup contact before that happens?'"
  ].join("\n"),
  junk_removal: [
    "JUNK REMOVAL is its own service with its own price list; quote it whenever a caller wants it, even though other chapters focus on larger commercial work. Listen first. Get what they are getting rid of and how much of the truck it fills (single item, quarter, half, three-quarter or full load), the address, and when they want it.",
    "Price ONLY from quote_special_service (junk removal). It carries the book's list; a big job with more than one truckload adds a fee per extra truckload, which the tool applies. Hazardous or restricted materials are never quoted.",
    "Then close: 'Want me to get that booked for you?' After a confirmed booking offer the secure payment link (send_payment_link).",
    "Turn a cleanout into a repeat account: a single cleanout can become a property-management relationship or a recurring removal account. Ask: 'Do you manage other properties, or have more cleanouts coming up?'"
  ].join("\n"),
  cleanout: [
    "COMMERCIAL CLEANOUT / REMOVAL. Commercial cleanouts, business removals, warehouse cleanouts, store fixture removal, large furniture and appliance removal, commercial debris. Get: business or property address, photos when available, a description of the materials, estimated volume, access information, and the preferred completion date.",
    "We do not chase small pickups, household moving, hazardous materials, paint, chemicals or unsafe materials. If the job is that, say so kindly and offer a person.",
    "Price only through quote_special_service or a person; anything outside the approved price list: say someone will follow up. For approved jobs, the goal is: complete the job, document it, collect payment."
  ].join("\n"),
  freight: [
    "BOOKING A LOAD. Collect: name, phone and email; pickup address and delivery address; what it is (description, number of pieces, approximate weight); when (scheduled, same-day or rush); anything special (stairs, inside delivery, extra stops, heavy items). Then quote from the tools, check live availability, and create the pending booking. The booking is confirmed once the job passes the eligibility check or dispatch approves it.",
    "A quote is good for 30 minutes. The truck carries up to 4,500 lbs: anything over that goes to a person. Never quote hazardous or restricted materials, or anything outside the approved price list; say you will have someone follow up.",
    "Price ONLY from calculate_quote; read it plainly: 'Based on what you need, your price today is X.' Never invent availability, delivery times or promises."
  ].join("\n"),
  popup_events: [
    "POP-UP EVENTS are a truck, a crew and the set-up at a location. Ask where the event is, the date, and the pickup and drop-off addresses. Quote the flat price through quote_special_service (popup_event), which adds a per-mile amount for each round-trip mile beyond the included distance. Anything unusual goes to management (request_human_handoff or create_callback_task).",
    "Event companies are repeat buyers: after the quote ask whether more events are coming up, then mention a recurring account (get_playbook recurring)."
  ].join("\n"),
  recurring: [
    "RECURRING ACCOUNTS. A recurring account is a customer with a repeat schedule: a few days a week, or a dedicated route. One emergency shipment is good; a recurring customer changes the company. Ask what they move, how often, which days, and the pickup and delivery locations.",
    "Price it only through quote_special_service (recurring load or dedicated route). Recurring is priced by how much of the truck the load fills and discounted by days per week; a dedicated route runs five days a week with no weekends. Never state a discount from memory.",
    "Then set it up: get name, email, company and the route (create_or_update_lead) and create_callback_task so a person sets up the route in the app and finishes the account and wallet. Never say it is already set up.",
    "Ask qualification questions for ongoing business: the legal company name, the main contact, the person who decides, and the accounting contact."
  ].join("\n"),
  wallet_referrals: [
    "CUSTOMER WALLET (say it in plain words). A customer wallet is prepaid: the customer adds money once and jobs are paid from it. One coin equals one dollar. There is no credit: if the balance does not cover a job, it is not charged. With autopay on, a finished job is paid from the wallet automatically when the balance covers it. Every top-up and charge is recorded and the customer can see recent activity in the portal.",
    "Recommend it to every repeat or business customer: no card or invoice to chase each time. You cannot set up the wallet on the phone; take name, email and company and create_callback_task. Never take a card number on the call.",
    "REFERRALS: each referral code pays 25 dollars into the code owner's wallet when a new customer using the code finishes a first job; when that customer signs a contract, 250 dollars total is paid, and the 25 counts toward it. Nobody is paid twice. Offer it to happy customers: 'Is there anyone you know who could benefit from a transportation resource like us?'"
  ].join("\n"),
  closing: [
    "THE CLOSE. Do not ask 'Are you interested?' Ask: 'Based on what we discussed, does it make sense for POTENT to be a transportation resource for your team?' Direct close: 'Based on everything we've discussed, is there any reason we shouldn't move forward?' Then be quiet. Silence is a skill: never keep explaining after you ask.",
    "After you've listened and confirmed the problem: 'Based on what you've told me, it sounds like [problem] is really the biggest issue. Did I get that right?' If yes: 'And what you're really looking for is [result], correct?' If yes: 'Then I think we can help you with that. Let's get you set up.'",
    "Assumptive (clearly interested): 'Based on what we discussed, the next step is getting you set up. Does that make sense?' Choice: give two options, such as 'Would it make more sense to start with one job, or set up a regular route?' Next step: 'What would be the best next step from your side?' Commitment question: 'What would make you confident choosing POTENT?'",
    "Onboarding close: confirm company information, billing contact, service expectations, how they want to be contacted, an emergency contact, and payment terms. Do not celebrate too early; the relationship is just beginning.",
    "After the booking: give the booking reference from the tool, offer the secure payment link, and tell them how to track the driver (get_playbook accounts_tracking).",
    "Follow-up rule: follow-up is service before the sale. Stay available, do not chase. After a completed job a person follows up within 24 hours: 'How did everything go? Was there anything we could improve? Is there anything coming up where we could help again?'"
  ].join("\n"),
  accounts_tracking: [
    "TRACKING: drivers share live GPS every 10 seconds with a customer tracking link, so the customer can watch the load move. Tell every booked customer they can follow their job and driver in the POTENT app (the customer portal and Track tab) with their Job ID. By phone you can read a booking's status with look_up_booking_status (needs the booking reference and the last 4 digits of the phone on the booking).",
    "ACCOUNT: invite them to make their POTENT customer account so their jobs, tracking, receipts, recurring routes and prepaid wallet live in one place. You cannot create the account on the call: take name, email and company (create_or_update_lead) and create_callback_task, or point them to the app. Never say the account exists until a person confirms.",
    "DRIVERS WHO WANT TO JOIN: a driver applies from a phone (documents and photos, a reference number, an email to the driver and POTENT). If the caller wants to drive, take their name, phone, email and vehicle and create_callback_task so a person sends the driver onboarding. Never promise pay, jobs or approval."
  ].join("\n"),
  os_sales: [
    "POTENT OS is the operating system a trucking or hauling company runs on: quoting, booking, dispatch, drivers, fleet, customers, money and sales in one app. A company pays once for a license. No per-truck software fees. The plan is set by how many trucks the company runs.",
    "Plans (October 2026): Starter 1-10 trucks, 4,995 dollars once. Growth 11-50 trucks, 9,995 once. Fleet 51-150 trucks, 19,995 once, or Flex Pay: 3,999 down plus 12 payments of 1,333. Enterprise 151-300 trucks, 34,995 once, or Flex Pay: 6,999 down plus 12 payments of 2,333. Optional support is 149, 249, 399 or 599 a month by plan and is never required. Over 300 trucks is a custom quote. Starter and Growth are paid once; if they ask for payments on those, send it to management.",
    "The money conversation: ask how many trucks and what they pay per truck per month for software today. Use their real numbers: trucks times monthly fee times 12 times years, compared with the license. Never quote a savings figure you did not calculate on the call.",
    "What it does, in plain words: works with no signal and installs like an app; live price calculator and voice quoting; every quote shows miles, gas and profit; driver login with live GPS and a customer tracking link; fleet and compliance warnings; driver onboarding; carrier vetting; customer portal, recurring routes and prepaid customer wallets; invoices; team commission wallets; leads board; 14 languages including right-to-left; Əlevate the AI assistant; POTENT VOICE the AI phone agent. Every company's data is completely separate and exportable.",
    "Booking a demo: gather in this order: name and company; role (owner or the person who decides); number of trucks; what they use today and what they pay per truck per month; biggest problem right now (quoting, dispatch, compliance, driver tracking or paperwork); best phone and email, and a day and time. Use book_demo. Say: 'I'll book you with our team. You'll get a confirmation and a reminder.' A team member confirms the time."
  ].join("\n"),
  voice_elevate: [
    "POTENT VOICE is the AI phone agent: it answers calls for a company, quotes from the approved price list, collects job details, checks availability, books, takes callbacks and hands off to a person. It never invents a price. Plans per month: Starter 199 dollars (300 minutes, 2 calls at once), Growth 499 (1,000 minutes, 5 at once), Fleet 999 (3,000 minutes, 15 at once), Enterprise 1,999 and up (10,000 minutes, 50 at once). Outbound calling and campaigns are on Fleet and Enterprise voice plans only, with consent and Do Not Call rules.",
    "Əlevate is the voice and chat assistant add-on: 50 dollars a month, includes 120 voice minutes. She keeps notes, tasks, reminders, places and memory, translates, and can answer a phone line. Extra minutes are prepaid credit packs at 25 cents a minute: 10 dollars for 40 minutes, 25 for 100, 50 for 200. How to say it: 'Əlevate is the assistant that does the follow-up so your team can do the work. She answers calls, books jobs, and keeps your notes. Fifty dollars a month.'",
    "Never claim a capability that is not built. Today she can quote, book, take payment by secure link, hand off, take callbacks, and speak the caller's language."
  ].join("\n")
};
const NAMES = Object.keys(TOPICS);
function get(topic) {
  const t = String(topic || "").toLowerCase().trim();
  if (TOPICS[t]) return { ok: true, topic: t, script: TOPICS[t], note: "Say these in your own natural voice, short turns. Operations prices only from the quote tools." };
  return { ok: false, error: "unknown_topic", topics: NAMES };
}
module.exports = { TOPICS, NAMES, get };
