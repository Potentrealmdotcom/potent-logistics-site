/* The Potent Playbook — Course content
 * Block types: lead, p, h, quote, list, steps, action, callout,
 * links, gallery, templates, prompts, aidisc, flow, timeline, checklist, video
 */
const AI_DISCLAIMER = "AI doesn't come out 100% accurate \u2014 you have to edit it, mess around with it, play around with it to get what you want.";

const PB_COURSE = {
  lessons: [
    {
      id: "l1", num: "01", part: "Foundation", tier: "regular",
      title: "The Myth & The Results", est: "6 min", preview: true,
      intro: "What you've been told about starting a clothing brand is completely backwards.",
      blocks: [
        { t: "lead", html: "You do <strong>NOT</strong> need inventory first. You do not need samples first. You do not need a random manufacturer first. And you definitely do not need $5,000 to start." },
        { t: "h", text: "What actually works" },
        { t: "p", html: "The system in this course produces a first sale in under <strong>86 sessions</strong>. Some run <strong>$5K days</strong>. Some run <strong>$30K monthly sellout drops</strong> \u2014 with zero inventory and zero upfront cost." },
        { t: "quote", text: "You don't need permission. You need the system." },
        { t: "h", text: "The shift" },
        { t: "p", html: "Everything you've been told about starting a clothing brand is backwards. You don't need inventory first. You don't need $5,000. You need the <strong>right suppliers</strong> and the <strong>right system</strong> \u2014 in the right order." },
        { t: "action", html: "Write down your goal \u2014 first sale in under 86 sessions. Put it where you'll see it every day." }
      ]
    },
    {
      id: "l2", num: "02", part: "Foundation", tier: "regular",
      title: "Who I Am & The Gatekeepers", est: "7 min",
      intro: "No degree. No $5,000 to start. No fashion school. Seven years of mistakes, distilled into a system.",
      blocks: [
        { t: "lead", html: "I'm <strong>Anthony Emmanuel Figueroa</strong>, founder of POTENT\u00ae \u2014 est. 2019. No fashion degree. No rich uncle. No $5,000 starting budget." },
        { t: "p", html: "Seven years of mistakes \u2014 wrong suppliers, dead inventory, money burned on samples that never shipped \u2014 distilled into the system you're holding now." },
        { t: "h", text: "The industry is gatekept on purpose" },
        { t: "p", html: "They want you stuck ordering samples from Alibaba, waiting on shipping, then paying $10K for a mentorship to learn what a tech pack is. Confusion is the business model. <strong>This course is the gatekeeping killer.</strong>" },
        { t: "callout", title: "The shift", html: "Stop believing you need money or a degree. You need the right suppliers and the right system." },
        { t: "action", html: "Write down the one gatekeeper belief that's been stopping you \u2014 then cross it out. You're past it now." },
        { t: "h", text: "The 7-Year Lesson \u2014 where I actually started" },
        { t: "p", html: "I didn't fail because of design. I failed because I didn't have the right system. I started with a <strong>laptop, a background remover, a Cricut machine, and HTV</strong> (heat transfer vinyl). Here's what that really looked like:" },
        { t: "list", items: [
          "Peeling prints",
          "No full-size prints \u2014 a 12\u2033\u00d724\u2033 cut limit",
          "Cheap finish, no multi-color designs, no durability",
          "Bad mockups \u2014 and no way to scale"
        ]},
        { t: "p", html: "I wasted years there. And here's the part nobody believes: <strong>I used Supima cotton. It still looked cheap \u2014 because the process was wrong.</strong> The material was never the problem. The system was." }
      ]
    },
    {
      id: "l3", num: "03", part: "Foundation", tier: "regular",
      title: "Brand Identity (Not a Logo)", est: "9 min",
      intro: "A logo is not a brand. A brand makes people feel like they're part of something.",
      blocks: [
        { t: "lead", html: "When someone lands on your page, three questions fire in their head in under five seconds: <strong>Is this me? Do I fit here? Is this for people like me?</strong>" },
        { t: "p", html: "A logo doesn't answer those questions. A brand does. My brand is for the outcast \u2014 the one who always felt different. Every design, every caption, every drop speaks to that person." },
        { t: "h", text: "Build the world first" },
        { t: "list", items: [
          "<strong>Stand for something.</strong> What belief does your brand defend?",
          "<strong>Bring an energy.</strong> Outlaw? Luxury? Rebellion? Calm? Pick one and never break character.",
          "<strong>Name your person.</strong> Who feels this in their chest? Design everything for them."
        ]},
        { t: "quote", text: "People don't buy shirts. They buy belonging." },
        { t: "action", html: "Answer these three: (1) What do I stand for? (2) What energy do I bring? (3) Who feels this? One sentence each." }
      ]
    },
    {
      id: "l4", num: "04", part: "Foundation", tier: "regular",
      title: "Community Over Ads", est: "10 min",
      intro: "I built this with $0 in ad spend. Edgewood Avenue, Atlanta \u2014 that's the classroom.",
      blocks: [
        { t: "lead", html: "I asked ChatGPT where the culture was in Georgia. It said <strong>Edgewood Avenue</strong>. So I posted up there with merch \u2014 no booth, no permission, just presence." },
        { t: "p", html: "First customer: platinum artist <strong>4Eyes</strong>. Then rap cyphers, fashion shows, smoke-and-couture events. Not ads \u2014 <strong>positioning, presence, being outside</strong>." },
        { t: "h", text: "Step by step" },
        { t: "steps", items: [
          { t: "Ask AI where your audience hangs out", d: "ChatGPT: \"Where does streetwear culture live in [your city]?\" Go where it points." },
          { t: "Show up with product", d: "Presence, not a pitch. Wear it. Let people ask." },
          { t: "Document everything", d: "Content IS the marketing. Film the cyphers, the pop-ups, the reactions." },
          { t: "Throw or join one event", d: "Be the plug. One event makes you a landmark, not a link." }
        ]},
        { t: "action", html: "Name one spot your audience hangs out. Go this week \u2014 product in hand." }
      ]
    },
    {
      id: "l5", num: "05", part: "Foundation", tier: "regular", ai: true,
      title: "Design with AI (No School Needed)", est: "12 min",
      intro: "Design comes from studying references, not waiting for inspiration. No school needed.",
      blocks: [
        { t: "aidisc" },
        { t: "lead", html: "You don't need Photoshop. You don't need a degree. You need <strong>references, AI, and taste</strong> \u2014 in that order." },
        { t: "h", text: "The stack" },
        { t: "list", items: [
          "<strong>ChatGPT</strong> \u2014 concepts and creative direction. Feed it your brand world; it gives you angles.",
          "<strong>PhotoRoom</strong> (photoroom.com) \u2014 mockups and virtual models. Your garment on a model in minutes.",
          "<strong>Kittl</strong> (kittl.com) \u2014 typography and tech packs. Free to start; $15/mo pro replaces a $2,000 tech-pack designer."
        ]},
        { t: "h", text: "The workflow" },
        { t: "steps", items: [
          { t: "Collect 20 reference images", d: "Save anything that feels like your brand. Study what repeats." },
          { t: "ChatGPT: generate 5 concepts", d: "Prompt it in your brand's voice \u2014 outlaw, luxury, rebellion, whatever you chose in Lesson 3." },
          { t: "Pick one. Build it in Kittl.", d: "Typography, layout, graphic. Kittl is built for this." },
          { t: "Mockup on a model in PhotoRoom", d: "See it on a body before you spend a dollar." },
          { t: "Refine once. Ship it.", d: "One revision round. Then it goes live. Perfection is procrastination." }
        ]},
        { t: "callout", title: "Remember", html: "The campaign shots in this course? AI. The videos? AI. Nobody can tell \u2014 that's the point. But you still have to art-direct: edit it, mess with it, play with it until it's yours." },
        { t: "action", html: "Collect your 20 reference images today. Generate your first 5 concepts in ChatGPT tonight." },
        { t: "video", yt: "pQLb6oqPERk", cap: "Watch: PhotoRoom Tutorial \u2014 the exact mockup and virtual-model workflow from this lesson, step by step." }
      ]
    },
    {
      id: "l6", num: "06", part: "Legal", tier: "regular",
      title: "Legal Foundation", est: "15 min",
      intro: "Protect yourself FIRST. Everything in this course flows from the trademark filing onward.",
      blocks: [
        { t: "lead", html: "Before you sell a single shirt, you lock down the name. The workflow goes <strong>from trademark filing onward</strong> \u2014 search it, file it, then build the business on top of protected ground." },
        { t: "h", text: "Step 1 \u2014 Trademark search (free)" },
        { t: "p", html: "Go to <strong>tsdr.uspto.gov</strong> and search your brand name plus every variation and spelling you can think of. Search <strong>Class 25</strong> (clothing) specifically \u2014 that's where apparel trademarks live." },
        { t: "list", items: [
          "Search the exact name, plurals, misspellings, and abbreviations.",
          "Check live AND dead marks \u2014 a dead mark can still signal a crowded field.",
          "Name taken or too close? <strong>Pick a new name now.</strong> It's free to pivot today; it's expensive later."
        ]},
        { t: "h", text: "Step 2 \u2014 File your trademark" },
        { t: "p", html: "Once the name clears, file at the <strong>USPTO Trademark Center</strong> (uspto.gov). This is what actually protects the brand you're about to build:" },
        { t: "steps", items: [
          { t: "Choose your filing basis", d: "\u201cUse in commerce\u201d (1A) if you're already selling, or \u201cintent to use\u201d (1B) if the brand isn't live yet. Most starters file 1B." },
          { t: "Pick your class", d: "Class 25 covers clothing, footwear, and headwear. Add more classes only if you need them \u2014 each one adds to the fee." },
          { t: "File the application", d: "Submit your mark, owner info, and a clear image of the logo/wordmark. Pay the USPTO filing fee per class." },
          { t: "Examination", d: "A USPTO examining attorney reviews it (usually 6\u20138 months). Respond to any office actions fast \u2014 deadlines are real." },
          { t: "Publication & registration", d: "Your mark publishes for 30 days for opposition, then registers. \u00ae unlocked." }
        ]},
        { t: "callout", title: "Why this comes first", html: "You are about to put this name on products, ads, and SMS blasts. Filing first means nobody can take it from you once it starts working. General information, not legal advice \u2014 for complex filings, talk to a trademark attorney." },
        { t: "h", text: "Step 3 \u2014 EIN (free)" },
        { t: "p", html: "<strong>irs.gov</strong> \u2014 free Employer Identification Number. Takes minutes. You need it to open business accounts and file taxes properly." },
        { t: "h", text: "Step 4 \u2014 LLC" },
        { t: "p", html: "Register through your state's business site. Walkthrough video: <strong>EIN &amp; LLC filing video</strong> (YouTube @learnwithpotent). Separates you from the business \u2014 liability protection from day one." },
        { t: "video", yt: "JQCJLma8g1U", cap: "Watch: EIN & LLC Filing Tutorial (free to file) \u2014 the full walkthrough, start to finish." },
        { t: "h", text: "Step 5 \u2014 Reseller certificate" },
        { t: "p", html: "Via your state's Department of Revenue. Unlocks wholesale pricing as you scale. Optional at first \u2014 grab it when you're ordering blanks in volume." },
        { t: "h", text: "Fixing denials \u2014 registered agent issues" },
        { t: "p", html: "When applications get denied, hear this first: <strong>denials are normal. They are not failure.</strong> The common reasons:" },
        { t: "list", items: [
          "Incorrect registered agent",
          "Entity mismatch \u2014 the name on the filing doesn't match the business",
          "Wrong trademark class",
          "Missing documentation"
        ]},
        { t: "p", html: "The fix is a process, not a panic: <strong>read the denial carefully \u2192 correct the filing \u2192 re-submit properly \u2192 track the status.</strong> Every brand you admire has a denial letter somewhere in its past." },
        { t: "video", yt: "JJ70453NSFQ", cap: "Watch: USPTO Application Help Walkthrough \u2014 see the application done right, field by field." },
        { t: "action", html: "USPTO search + EIN this week. Both free. File the trademark before your first drop." }
      ]
    },
    {
      id: "l7", num: "07", part: "Production", tier: "regular",
      title: "Luxury Blanks & Fabric Guide", est: "10 min",
      intro: "Luxury starts at the material level \u2014 not the logo.",
      blocks: [
        { t: "lead", html: "Nobody ever picked up a shirt and said \u201cwow, nice logo.\u201d They feel the <strong>weight, the hand-feel, the drape</strong> \u2014 and decide in three seconds if it's premium." },
        { t: "h", text: "Supima cotton \u2014 the luxury standard" },
        { t: "p", html: "<strong>Supima cotton</strong>: extra-long staple, American-grown \u2014 what Gucci, Fendi, and Prada build on. My no-minimum source: <strong>OriginalFavorites.com</strong>. Tapstitch's <strong>Mulberry cotton</strong> is the premium print-on-demand alternative." },
        { t: "p", html: "The truth about luxury fabric: people think luxury comes from Italy, France, designer labels, high prices. That's not where quality starts. <strong>All Supima is Pima. Not all Pima is Supima.</strong> Real Supima is grown exclusively in the US and held to a standard most cotton never meets \u2014 that's why Ralph Lauren, Brooks Brothers, Stone Island, and Gucci build on it." },
        { t: "p", html: "<strong>Verified sourcing:</strong> Supima cotton includes fiber verification through <strong>Oritain</strong> \u2014 forensic science that confirms origin and authenticity. You're not guessing materials. You're using the same level of materials they do." },
        { t: "h", text: "Why your hoodie feels cheap \u2014 the GOTS test" },
        { t: "p", html: "Put a thin hoodie next to a <strong>GOTS hoodie \u2014 done right</strong> \u2014 and you feel it immediately: <strong>weight, structure, quality.</strong> Cheap hoodies run thin French terry that goes limp in your hands. The real one holds its shape and its drape. That difference is the whole game at the fabric level." },
        { t: "p", html: "And know the other fiber the houses build on: <strong>Merino wool</strong> \u2014 fine-gauge, temperature-regulating, no itch when it's done right. When a luxury knit feels expensive, this is the standard it's measured against." },
        { t: "h", text: "The weight specs" },
        { t: "list", items: [
          "<strong>Tees:</strong> 280 GSM and up. Anything lighter feels like a giveaway shirt.",
          "<strong>Hoodies:</strong> 400 GSM solid \u00b7 500 GSM heavyweight. Heavy = expensive in the customer's hand.",
          "<strong>Details:</strong> custom PVC patches \u2014 always sample first before committing."
        ]},
        { t: "callout", title: "The rule", html: "If the blank feels cheap, no graphic on earth saves it. Start at the fabric, then design." },
        { t: "action", html: "Order one heavyweight blank this week. Feel the difference between 280 and 500 GSM with your own hands." }
      ]
    },
    {
      id: "l8", num: "08", part: "Production", tier: "regular",
      title: "The No-Inventory Production System", est: "12 min",
      intro: "Order 1 shirt or 100 \u2014 printed, branded, shipped \u2014 without holding a single piece of inventory.",
      blocks: [
        { t: "lead", html: "This is the core of the whole playbook. Five steps, zero inventory, zero upfront cost \u2014 and the customer receives a product that looks like it came from an established brand." },
        { t: "flow", items: [
          { t: "1 \u00b7 Design", d: "Kittl \u2014 replaces the $2,000 tech pack" },
          { t: "2 \u00b7 Mockup", d: "PhotoRoom virtual model \u2014 see it on a body" },
          { t: "3 \u00b7 Upload", d: "Tapstitch \u2014 print on demand, order 1 or 100" },
          { t: "4 \u00b7 Brand it", d: "Neck labels + hang tags in the branding tab" },
          { t: "5 \u00b7 Sell", d: "Shopify. Ships on order. You never touch it." }
        ]},
        { t: "h", text: "Why it works" },
        { t: "p", html: "The order only exists <strong>after</strong> the customer pays. No boxes in your living room. No $3,000 gamble on sizes that don't sell. You collect the money first, the system fulfills second." },
        { t: "callout", title: "Deluxe upgrade", html: "Deluxe members get the <strong>Jumbo DTG + Full Branding</strong> module (PodPartner) \u2014 oversized prints, branded polymailers, and the details that erase the \u201cdropship look\u201d entirely." },
        { t: "action", html: "Open your Tapstitch account and upload one design this week. Get one product live." }
      ]
    },
    {
      id: "l9", num: "09", part: "Production", tier: "regular", ai: true,
      title: "Neck Labels & AI Visuals", est: "11 min",
      intro: "Two free moves that turn a blank into a brand \u2014 and a concept into a campaign.",
      blocks: [
        { t: "aidisc" },
        { t: "h", text: "Step 1 \u2014 Neck label (free)" },
        { t: "p", html: "Design your neck label in <strong>Kittl</strong>. Upload it in <strong>Tapstitch's branding tab</strong>. Cost: $0. Impact: the moment someone flips the collar, they know this is a real brand \u2014 not a print-on-demand experiment." },
        { t: "h", text: "Step 2 \u2014 AI visuals (free)" },
        { t: "p", html: "Take your product URL to <strong>Kive.ai</strong> and paste this prompt:" },
        { t: "callout", title: "Starter prompt", html: "\u201cCinematic luxury streetwear, 35mm, outlaw energy, soft natural light.\u201d \u2014 3 to 5 shots equals a $1,000 photoshoot, free." },
        { t: "p", html: "The campaign shots in this course? AI. The videos? AI. Nobody can tell \u2014 that's the point. But remember: <strong>edit it, mess around with it, play around with it</strong> until the lighting, the fit, and the energy match your brand exactly." },
        { t: "h", text: "Deluxe members get more" },
        { t: "p", html: "The Deluxe tier unlocks <strong>10 PhotoRoom prompts</strong>, <strong>10 Kive.ai prompts</strong>, and the full <strong>AI campaign video gallery</strong> with cinematic video prompts \u2014 the exact shots and scripts behind the campaigns." },
        { t: "action", html: "Add a neck label to one product today. Generate 3 AI visuals for it tonight." },
        { t: "h", text: "The Alibaba Trap" },
        { t: "p", html: "The factories will smile at you and then do this: big <strong>minimum order quantities</strong> before you've sold a single piece, sample fees, mold fees \u2014 money out of your pocket while your design sits unproven. That's the trap. They get paid whether your drop works or not. You carry all the risk." },
        { t: "quote", text: "MOQ = RISK. NO MOQ = CONTROL + PROFIT." },
        { t: "p", html: "The system in this course is the way around it: print-on-demand means you launch instantly, test the design on real buyers, and only spend when the market already said yes. <strong>No design risk. No inventory risk.</strong> Scale what sells \u2014 kill what doesn't." }
      ]
    },
    {
      id: "l10", num: "10", part: "Launch", tier: "regular",
      title: "Product Pages That Convert", est: "9 min",
      intro: "Look expensive without acting mainstream.",
      blocks: [
        { t: "lead", html: "Your product page has one job: make the price feel obvious. Three images, honest specs, short confident copy." },
        { t: "h", text: "The page formula" },
        { t: "list", items: [
          "<strong>One hero image</strong> \u2014 the shot that stops the scroll.",
          "<strong>One detail close-up</strong> \u2014 fabric texture, stitching, the neck label. Proof of quality.",
          "<strong>One lifestyle shot</strong> \u2014 the garment in a world your customer wants into.",
          "<strong>Clear fabric &amp; weight</strong> \u2014 \u201c500 GSM Supima cotton.\u201d Specs justify price.",
          "<strong>Simple description</strong> \u2014 short, confident. If it feels forced, it's wrong."
        ]},
        { t: "quote", text: "If it feels forced, it's wrong." },
        { t: "action", html: "Rewrite one product description today: three images, fabric spec, five confident lines." },
        { t: "h", text: "Premium details \u2014 order one sample each" },
        { t: "list", items: [
          "Branded mylar bags",
          "Hangtags",
          "PodPartner branded bags",
          "Sewn-in neck labels",
          "NinjaPrint Permastickers",
          "ULINE magnetic boxes",
          "PVC patches"
        ]},
        { t: "p", html: "These are the touches that make a $30 shirt feel like a $100 brand. Sample every one of them. Keep the ones that fit your world." }
      ]
    },
    {
      id: "l11", num: "11", part: "Launch", tier: "regular",
      title: "The Sell-Out Drop System", est: "18 min",
      intro: "The full journey \u2014 from trademark filing to selling live, online and in person. Step by step.",
      blocks: [
        { t: "lead", html: "This is the whole machine on one page. <strong>Trademark filing \u2192 brand setup \u2192 design \u2192 production \u2192 marketing \u2192 selling live</strong> \u2014 online AND in person. Follow the chart top to bottom and you cannot get lost." },
        { t: "chart" },
        { t: "p", html: "The system runs on <strong>push and pull</strong>. <strong>Push:</strong> you drive the drop at them \u2014 teasing, countdown, SMS pressure. <strong>Pull:</strong> curiosity drags them in \u2014 they ask, they guess, they watch. Push without pull is spam. Pull without push never closes. Run both. (Exact steps from the video \u2014 follow along on the channel.)" },
        { t: "h", text: "The drop countdown" },
        { t: "timeline", items: [
          { t: "T-48h", title: "Tease", d: "Fabric close-up. A sleeve. The tag. Never the full product." },
          { t: "T-24h", title: "Hype", d: "Build energy everywhere. Let them ask \u201cwhat? when?\u201d" },
          { t: "T-12h", title: "Curiosity", d: "A detail only \u2014 a corner of the design, the back print, the texture. Answer nothing. Let them guess." },
          { t: "T-1h", title: "Pressure", d: "SMS: \u201cDrop live in 1 hour. 50 pieces only.\u201d" },
          { t: "T-0", title: "Launch", d: "\u201cLIVE NOW\u201d everywhere at once \u2014 site, SMS, social, in person." },
          { t: "T+24h", title: "Sell out", d: "No restocks. Post \u201cSOLD OUT.\u201d Scarcity is the brand." }
        ]},
        { t: "action", html: "First drop: 50 pieces, 24 hours, announced 48h early. Run the countdown exactly as written." }
      ]
    },
    {
      id: "l12", num: "12", part: "Launch", tier: "regular",
      title: "SMS List Building", est: "10 min",
      intro: "You don't own Instagram or TikTok. You need direct access.",
      blocks: [
        { t: "lead", html: "Algorithms rent you an audience. <strong>SMS gives you ownership.</strong> When you text the list, 98% see it in minutes \u2014 no algorithm decides for you." },
        { t: "h", text: "The math" },
        { t: "list", items: [
          "<strong>200\u2013500 subscribers</strong> \u2192 sell out 50 pieces every drop.",
          "<strong>1,000+</strong> \u2192 $5K days on autopilot."
        ]},
        { t: "h", text: "Build it" },
        { t: "list", items: [
          "Pop-up on Shopify (<strong>Privy / Omnisend</strong> \u2014 free to start).",
          "Offer early access: \u201cGet the drop 1 hour before everyone else.\u201d",
          "Collect at every event and pop-up \u2014 the in-person list is gold.",
          "Pre-drop SMS: \u201cDrop live in 1 hour. 50 pieces only.\u201d"
        ]},
        { t: "callout", title: "Email vs SMS", html: "Email builds trust. SMS creates urgency. You need both \u2014 but SMS is what sells out the drop." },
        { t: "action", html: "Install the SMS pop-up on your store today. Get your first 25 subscribers this week." },
        { t: "h", text: "Or build it instantly \u2014 the two list suppliers I use" },
        { t: "p", html: "Organic building works \u2014 but it's slow. When I need a list <strong>today</strong>, I buy targeted subscribers: real people interested in streetwear and luxury brands, ready-made SMS + email lists. Not random numbers \u2014 people who actually buy from drops." },
        { t: "links", items: [
          { label: "Ecom Needs Jungle", url: "https://ecomneedsjungle.com/products/targeted-subscriber-lead-1", note: "Choose your country, select the number of premium leads, and get a ready-made SMS + email list." },
          { label: "Grovolyfy", url: "https://grovolyfy.com/collections/marketing-advertisement/products/united-states-email-list", note: "Pick the countries and list size you want. Delivered instantly." }
        ]},
        { t: "p", html: "How many you need: <strong>200\u2013500 subscribers</strong> sells out a 50-piece drop. <strong>1,000+</strong> is $5K-day territory. Then work the list exactly like the drop system teaches \u2014 tease, pressure, launch, sell out." }
      ]
    },
    {
      id: "l13", num: "13", part: "Launch", tier: "regular",
      title: "Pricing for Profit", est: "8 min",
      intro: "$30 shirt = volume chasing. $100 hoodie = same traffic, triple profit.",
      blocks: [
        { t: "lead", html: "Price is positioning. A $30 shirt says \u201cplease buy me.\u201d A $100 hoodie says <strong>\u201cthis is worth it.\u201d</strong> Same traffic, triple the profit." },
        { t: "h", text: "How you justify $100" },
        { t: "list", items: [
          "<strong>500 GSM Supima blank</strong> \u2014 the fabric does the talking.",
          "<strong>Sewn-in neck label</strong> \u2014 brand signal at the collar.",
          "<strong>AI luxury visuals</strong> \u2014 the page looks like a $1,000 shoot.",
          "<strong>Limited drop</strong> \u2014 50 pieces, 24 hours. Scarcity has a price."
        ]},
        { t: "quote", text: "Never apologize for the price. Justify it, then stand on it." },
        { t: "action", html: "Hoodies $80\u2013100. Tees $45\u201360. Never apologize." }
      ]
    },
    {
      id: "l14", num: "14", part: "Launch", tier: "regular",
      title: "First Drop Checklist", est: "7 min",
      intro: "Every step, in sequence. Nothing left to guess.",
      blocks: [
        { t: "lead", html: "Run this list top to bottom before your first drop goes live. If every box is checked, you're ready." },
        { t: "checklist", items: [
          "Shopify store live with one product",
          "Tapstitch connected (or OriginalFavorites for Supima)",
          "500 GSM hoodie selected",
          "Design uploaded + neck label added",
          "AI campaign visuals ready (3\u20135)",
          "SMS pop-up live",
          "Price set ($80\u2013100)",
          "Announced 48h early",
          "SMS sent 1h before launch",
          "50 pieces \u00b7 24h \u00b7 no restocks",
          "\u201cSOLD OUT\u201d post after"
        ]},
        { t: "quote", text: "Start before you're ready. Sell before you're perfect." },
        { t: "action", html: "Pick your drop date right now. Work backwards through this checklist." }
      ]
    },
    {
      id: "l15", num: "15", part: "Closing", tier: "regular",
      title: "Now Go Build", est: "4 min",
      intro: "This isn't where the story ends. It's where yours begins.",
      blocks: [
        { t: "lead", html: "For years I looked for a guide that cut through the noise \u2014 one that didn't just preach \u201cbrand building\u201d but showed the actual systems, suppliers, and steps used by brands that last. I never found it. So I built it myself." },
        { t: "p", html: "You now have everything I spent 7 years testing, failing with, and perfecting: the same blanks luxury brands use, the same print partners, the same legal frameworks, the same creative tools that make you look established on day one." },
        { t: "h", text: "No more gatekeeping" },
        { t: "p", html: "Over half a decade, I've learned the hard way that most streetwear brands and \u201cindustry insiders\u201d keep the real knowledge locked away. Gatekeepers are out \u2014 <strong>you're in.</strong>" },
        { t: "quote", text: "Knowledge without action is just entertainment. This isn't theory \u2014 it's a toolkit. Use it." },
        { t: "p", html: "Start before you're ready. Sell before you're perfect. Protect your brand before it's big. \u2014 <strong>Anthony Emmanuel Figueroa (The Griffin), Founder, POTENT\u00ae</strong>" },
        { t: "links", items: [
          { label: "Founder WhatsApp", url: "https://wa.me/message/FGSHNADCOQIYJ1", note: "Stuck? Message me \u2014 this isn't a one-way book, it's an open door." }
        ]}
      ]
    }
  ],
  modules: []
};

PB_COURSE.modules = [
  {
    id: "m-suppliers", num: "D1", part: "Deluxe Exclusive", tier: "deluxe",
    title: "Secret Supplier Directory", est: "14 min",
    intro: "My personal, tested suppliers. I could charge $297 for this list alone.",
    blocks: [
      { t: "lead", html: "Every contact below is <strong>tested and trusted</strong> \u2014 the same level of blanks and materials used by luxury houses, with no minimums." },
        { t: "p", html: "<strong>LUXURY / HIGH-GRADE BLANKS \u2014 USED BY MONCLER \u00b7 PRADA \u00b7 YSL \u00b7 FENDI \u00b7 LV.</strong>" },
      { t: "h", text: "Luxury blanks" },
      { t: "links", items: [
        { label: "Original Favorites", url: "https://originalfavorites.com", note: "USA Supima blanks, zero minimums \u2014 used by high-fashion & streetwear brands." },
        { label: "Sports Gear Swag", url: "https://sportsgearswag.com", note: "Sports jerseys, no MOQ." },
        { label: "Flex Racing", url: "https://flexracing.com", note: "Racing / track jackets, no MOQ." }
      ]},
      { t: "h", text: "Custom branding" },
      { t: "links", items: [
        { label: "Boody Babies (Etsy)", url: "https://etsy.com/shop/boodybabies", note: "Removable / iron-on neck labels. Pair with Original Favorites blanks." },
        { label: "Personalize Your Stamp (Etsy)", url: "https://etsy.com/shop/PersonalizeYourStamp", note: "Custom leather embossers & stamps." },
        { label: "Return To Sender Co (Etsy)", url: "https://etsy.com/shop/ReturnToSenderCo", note: "Custom black-light logo stamper \u2014 brand verification." }
      ]},
      { t: "h", text: "Hardware & details" },
      { t: "links", items: [
        { label: "Snap Button Jewelry (Etsy)", url: "https://etsy.com/shop/SnapButtonJewelry", note: "Aglets, pulley tabs, custom letters." },
        { label: "Xpress Patches (Etsy)", url: "https://etsy.com/shop/XpressPatches", note: "Custom PVC patches." },
        { label: "MyPersonalize (Etsy)", url: "https://etsy.com/shop/MyPersonalize", note: "Custom belts." },
        { label: "AllCustomCN (Etsy)", url: "https://etsy.com/shop/AllcustomCN", note: "Custom belts & poly mailers." }
      ]},
      { t: "h", text: "Stickers & accessories" },
      { t: "links", items: [
        { label: "StickerWave LLC (Etsy)", url: "https://etsy.com/shop/StickerWaveLLC", note: "Custom stickers, bulk savings." },
        { label: "StickerMule", url: "https://stickermule.com", note: "Keychains, hot sauce labels, zipper pulls, hat pins." }
      ]},
      { t: "h", text: "No-upfront accessories (dropship)" },
      { t: "links", items: [
        { label: "Printify", url: "https://printify.com", note: "Accessories only \u2014 use Tapstitch for apparel." },
        { label: "Gelato", url: "https://gelato.com", note: "Accessories only \u2014 use Tapstitch for apparel." },
        { label: "Printful", url: "https://printful.com", note: "Accessories only \u2014 use Tapstitch for apparel." }
      ]},
      { t: "h", text: "China / Alibaba" },
      { t: "links", items: [
        { label: "VASHAP SPR 8769 (Alibaba)", url: "https://www.alibaba.com/product-detail/VASHAP-SPR-8769-Original-LOGO-Designer_1601430456152.html", note: "Original logo designer hoodie \u2014 direct product link." }
      ]},
      { t: "callout", title: "Rules", html: "Always order samples first. Combine US + Chinese suppliers for speed and quality control. Keep every invoice for taxes." }
    ]
  },
  {
    id: "m-hiddengem", num: "D2", part: "Deluxe Exclusive", tier: "deluxe",
    title: "Hidden Gem Supplier", est: "5 min",
    intro: "The supplier your competitors don't know about. That's why it's in the Deluxe.",
    blocks: [
      { t: "lead", html: "<strong>PodPluser.com</strong> \u2014 unique print placement, jumbo all-over print, up to 5X+ resale price." },
      { t: "list", items: [
        "Unique pieces, rhinestones and more",
        "Full branding kit \u2014 no inventory needed",
        "Print placements other POD platforms can't do"
      ]},
      { t: "links", items: [
        { label: "PodPluser", url: "https://podpluser.com", note: "Hidden gem \u2014 all-over print, full branding, no inventory." }
      ]},
      { t: "quote", text: "This is the supplier your competitors don't know about." }
    ]
  },
  {
    id: "m-jumbodtg", num: "D3", part: "Deluxe Exclusive", tier: "deluxe",
    title: "Jumbo DTG + Full Branding", est: "8 min",
    intro: "Most people fail at POD because their prints look small, cheap, and obvious.",
    blocks: [
      { t: "lead", html: "<strong>PodPartner</strong> is one of the strongest POD platforms in the game \u2014 but only if you use it right." },
      { t: "list", items: [
        "<strong>Jumbo DTG prints</strong> \u2014 oversized, edge-to-edge visuals",
        "<strong>Custom neck labels</strong> \u2014 Tapstitch-level quality",
        "<strong>Branded hang tags</strong> \u2014 optional but powerful",
        "<strong>Branded polymailers</strong> \u2014 black or plain"
      ]},
      { t: "p", html: "This instantly removes the \u201cdropship look.\u201d Your customer doesn't feel like they bought merch \u2014 they feel like they bought a real brand product." },
      { t: "callout", title: "Why it works", html: "Customers don't buy products. They buy certainty. In seconds, their brain decides: \u201cIs this legit?\u201d Jumbo print + full branding silently says: this brand invested in itself." },
      { t: "p", html: "You do NOT need inventory. You do NOT need a warehouse. <strong>You need better execution.</strong>" },
      { t: "links", items: [
        { label: "PodPartner", url: "https://podpartner.com", note: "Jumbo DTG + full branding \u2014 use it right." }
      ]}
    ]
  },
  {
    id: "m-kittl", num: "D4", part: "Deluxe Exclusive", tier: "deluxe", ai: true,
    title: "Kittl: The All-In-One Design System", est: "7 min",
    intro: "How big brands move fast without hiring teams.",
    blocks: [
      { t: "aidisc" },
      { t: "lead", html: "<strong>Kittl</strong> replaces Photoshop, Illustrator, mockup generators, and basic tech-pack tools. Free to start \u2014 <strong>$15/mo</strong> unlocks the pro features." },
      { t: "p", html: "Use it for: high-end product mockups \u00b7 website visuals \u00b7 lookbook pages \u00b7 tech-pack-style PDFs \u00b7 design variations in minutes." },
      { t: "p", html: "Think of it as PhotoRoom on steroids \u2014 built for brands, not beginners." },
      { t: "h", text: "How big brands actually use it" },
      { t: "list", items: [
        "<strong>Asset creation</strong> \u2014 multiple mockups per product; show scale, texture, fit, details.",
        "<strong>Consistency creates confidence</strong> \u2014 same fonts, same layout, same brand language."
      ]},
      { t: "quote", text: "This is why brands look \u201cexpensive\u201d even when they're not. It's not money. It's discipline." },
      { t: "links", items: [
        { label: "Kittl", url: "https://kittl.com", note: "Free to start \u2014 $15/mo pro unlocks full export on pro assets." }
      ]}
    ]
  },
  {
    id: "m-vault", num: "D5", part: "Deluxe Exclusive", tier: "deluxe",
    title: "Kittl Template Vault", est: "12 min",
    intro: "My hand-picked Kittl templates \u2014 graphics, campaign layouts, and accessories.",
    blocks: [
      { t: "lead", html: "Click any link to open it in Kittl and make it yours. <strong>How to use:</strong> open the link \u2192 duplicate the template in your Kittl account \u2192 swap the text, colors, and graphics for your brand \u2192 export." },
      { t: "p", html: "Most templates carry the Kittl Pro crown \u2014 <strong>Kittl Pro ($15/mo)</strong> unlocks full export on pro assets." },
      { t: "h", text: "Streetwear graphics" },
      { t: "templates", items: [
        { name: "1 \u00b7 Fashion Streetwear \u2014 Dirtyline Studio", desc: "Bold STREET / Parental Advisory style graphic. Loud, raw, ready for a black tee.", url: "https://www.kittl.com/design/Fashion-Streetwear-oknNKQP5" },
        { name: "2 \u00b7 Streetwear Typography \u2014 Matsero", desc: "\u201cFEEL YOUTH POWER\u201d typography set. A proven performer \u2014 1,000+ uses.", url: "https://www.kittl.com/design/Streetwear-Typography-XOqkbq3j" },
        { name: "3 \u00b7 Art Illustration Urban Street \u2014 David Orellana", desc: "Red sneaker illustration. 911 likes \u2014 illustration-style graphics convert.", url: "https://www.kittl.com/design/Art-Illustration-Urban-Street--JJi18WeA" },
        { name: "4 \u00b7 Minimal Design 1 (T-Shirt) \u2014 Graham Wilson", desc: "\u201cCOLLECTIVE / Summer Trends Collection\u201d bold typography. 32,000+ uses \u2014 one of Kittl's most-used tee templates.", url: "https://www.kittl.com/design/Minimal-Design-1-T-Shirt-IgrgSpax" },
        { name: "5 \u00b7 Streetwear Quote Typography \u2014 Colore", desc: "Colorful graffiti quote tee (\u201cComfort Is Killing\u201d). Quote tees are easy sellers.", url: "https://www.kittl.com/design/Streetwear-Quote-Typography-T-Shirt-PxUMv64N" },
        { name: "6 \u00b7 Tokyo Streetwear Logo (Y2K) \u2014 thatsky moon", desc: "Y2K graphic. The Y2K wave is still selling \u2014 ride it.", url: "https://www.kittl.com/design/Tokyo-Streetwear-logo-y2k-Logo-KS4JC2wC" },
        { name: "7 \u00b7 6 Streetwear Graphic (T-Shirt) \u2014 Yoga Perdana", desc: "6 dark grunge graphics on black. One template, half a collection.", url: "https://www.kittl.com/design/6-Streetwear-Graphic-T-Shirt-mBRQZwtw" },
        { name: "8 \u00b7 Streetwear Techpack \u2014 Matsero", desc: "Apparel tech pack template. 54,000+ uses. This is the $2,000 tech pack, free.", url: "https://www.kittl.com/design/Streetwear-Techpack-VeyjIqPH" }
      ]},
      { t: "h", text: "Campaign layouts" },
      { t: "templates", items: [
        { name: "9 \u00b7 New Collection Grunge \u2014 Aji Gusnawan", desc: "New-collection drop promo flyer. Use it for every drop announcement.", url: "https://www.kittl.com/design/New-Collection-Grunge-T-Shirt-IQrmeGrb" },
        { name: "10 \u00b7 Streetwear Collection Drop \u2014 Matsero", desc: "\u201cNEW ITEMS COLLECTION\u201d drop promo. 2,000+ likes.", url: "https://www.kittl.com/design/Streetwear-Collection-Drop-OUhG1o25" },
        { name: "11 \u00b7 Streetwear Collection IG Story \u2014 Matsero", desc: "\u201cESSENTIALS COLLECTION\u201d IG story campaign. 3,000+ likes. Post this the night before every drop.", url: "https://www.kittl.com/design/Streetwear-Collection-IG-Story-gev9GVNI" }
      ]},
      { t: "h", text: "Accessories" },
      { t: "templates", items: [
        { name: "12 \u00b7 Streetwear Apparel Neck Tag \u2014 Luiza Bola", desc: "\u201cURBAN THREADS\u201d neck label template. $0 upgrade that makes your brand look established.", url: "https://www.kittl.com/design/Streetwear-Apparel-Neck-Tag-BRwk2eX3" }
      ]}
    ]
  },
  {
    id: "m-aivideos", num: "D6", part: "Deluxe Exclusive", tier: "deluxe", ai: true,
    title: "AI Campaign Videos", est: "10 min",
    intro: "Shot on AI. Worn like couture.",
    blocks: [
      { t: "aidisc" },
      { t: "lead", html: "Every image in this gallery is <strong>AI-generated</strong>. No studio. No photographer. No $10,000 shoot. This is what your brand can look like from a laptop." },
      { t: "p", html: "These are the actual AI visuals from my campaigns \u2014 the proof that a $1,000 photoshoot is now free. Study the lighting, the styling, the energy. Then make your own with the prompts in the next modules." },
      { t: "h", text: "The campaign gallery" },
      { t: "gallery", items: [
        { src: "assets/campaign-gallery.jpg", cap: "\u201cShot on AI. Worn like couture.\u201d \u2014 the gallery series. Your brand belongs in the museum." },
        { src: "assets/campaign-risktakers-studio.jpg", cap: "\u201cRisk Takers\u201d \u2014 the mesh jersey series. Studio lighting, street energy, zero production cost." },
        { src: "assets/campaign-risktakers-shades.jpg", cap: "\u201cRisk Takers\u201d series \u2014 attitude is a styling choice." },
        { src: "assets/campaign-risktakers-closeup.jpg", cap: "Detail close-ups sell the fabric. Shoot the texture like it matters \u2014 because it does." },
        { src: "assets/campaign-demon-hoodie.jpg", cap: "Back prints that tell a story. The split demon \u2014 graphics with weight." },
        { src: "assets/campaign-desert-atv.jpg", cap: "Location is a prompt. Desert at golden hour \u2014 anywhere you can imagine." },
        { src: "assets/campaign-skyjump.jpg", cap: "Mid-air at dusk. If you can describe it, you can shoot it." },
        { src: "assets/campaign-rooftop.jpg", cap: "The rooftop set. Elevation reads as luxury." },
        { src: "assets/campaign-cap-gorilla.jpg", cap: "Headwear, graphics, attitude. The full uniform." },
        { src: "assets/campaign-geisha.jpg", cap: "Editorial worlds \u2014 designed, shot, and styled by AI." },
        { src: "assets/campaign-goldteeth.jpg", cap: "Character-driven stills. Give the campaign a face." }
      ]},
      { t: "h", text: "Video tools I use" },
      { t: "list", items: [
        "<strong>Dreamina (CapCut)</strong> \u2014 cinematic ads",
        "<strong>CreativeFabrica Studio</strong> \u2014 iPhone-style TikTok shots",
        "<strong>catwalk.ai</strong> (app) \u2014 AI model videos"
      ]},
      { t: "callout", title: "Deluxe visual collection", html: "Your Deluxe edition includes the <strong>AI campaign visual collection</strong> \u2014 11 campaign stills plus the cinematic video prompts, so you can generate your own versions. Study a frame, then make it yours." },
        
      ]
  }
];

PB_COURSE.modules.push(
  {
    id: "m-photoroom", num: "D7", part: "Deluxe Exclusive", tier: "deluxe", ai: true,
    title: "10 PhotoRoom Prompts", est: "9 min",
    intro: "Copy, paste, generate. Upload product (PNG preferred) \u2192 virtual model \u2192 paste prompt.",
    blocks: [
      { t: "aidisc" },
      { t: "lead", html: "<strong>How to use:</strong> upload product \u2192 select AI model/background \u2192 paste prompt \u2192 generate \u2192 refine \u2192 reuse the <strong>SAME model</strong> for consistency across your campaign." },
      { t: "prompts", items: [
        { title: "1 \u00b7 Clean studio product shot", text: "Clean premium studio image of this garment on a realistic model, sharp garment detail, true-to-product color, minimal background, soft professional lighting, luxury streetwear campaign feel, realistic proportions, no distortion." },
        { title: "2 \u00b7 Virtual model basic", text: "Realistic virtual model wearing this exact garment, natural pose, full body, clean styling, premium streetwear brand aesthetic, true garment placement, realistic fabric folds, simple background, no distortion." },
        { title: "3 \u00b7 Add boots (KEY METHOD)", text: "Realistic virtual model wearing this exact garment, confident pose, premium urban styling, then add tan Timberland boots, keep proportions realistic, true garment color, no distortion, luxury streetwear look." },
        { title: "4 \u00b7 Add duffle bag", text: "Realistic male model wearing this exact garment, seated pose, premium streetwear styling, add a black duffle bag beside him, natural lighting, realistic shadows, true-to-product garment details, no distortion." },
        { title: "5 \u00b7 Editorial wall shot", text: "Realistic editorial fashion image of this garment on a model standing against a textured wall, luxury streetwear campaign, clean composition, realistic body proportions, garment details preserved, no distortion." },
        { title: "6 \u00b7 Full outfit look", text: "Realistic full outfit image using this garment as the centerpiece, premium styling, balanced pose, clean footwear, realistic fabric detail, brand campaign aesthetic, no distortion, no extra logos." },
        { title: "7 \u00b7 Female virtual model", text: "Realistic female virtual model wearing this exact garment, clean pose, premium fashion styling, realistic proportions, garment fits naturally, true colors, minimal background, no distortion." },
        { title: "8 \u00b7 Seated campaign image", text: "Realistic seated model image wearing this exact garment, relaxed luxury streetwear vibe, realistic lighting, true garment placement, clean styling, high detail, no distortion." },
        { title: "9 \u00b7 Streetwear product focus", text: "Realistic streetwear campaign shot focused on the garment, preserving exact print placement, fit, and color, subtle luxury background, realistic shadows, premium brand quality, no distortion." },
        { title: "10 \u00b7 Consistent custom model (IMPORTANT)", text: "Realistic virtual model for this brand campaign, keep the face, hairstyle, skin tone, and body type consistent for future generations, wearing this exact garment, premium streetwear styling, true-to-product details, no distortion." }
      ]},
      { t: "links", items: [
        { label: "PhotoRoom", url: "https://photoroom.com", note: "Mockups + virtual models \u2014 upload product, paste prompt." }
      ]}
    ]
  },
  {
    id: "m-kive", num: "D8", part: "Deluxe Exclusive", tier: "deluxe", ai: true,
    title: "10 Kive.ai Prompts", est: "9 min",
    intro: "Upload product or paste product URL \u2192 paste prompt \u2192 generate variations.",
    blocks: [
      { t: "aidisc" },
      { t: "prompts", items: [
        { title: "1 \u00b7 Cinematic campaign shot", text: "Cinematic luxury streetwear campaign image featuring this exact garment, dramatic lighting, premium editorial composition, realistic textures, high-end fashion photography feel, true garment color and print placement, no distortion." },
        { title: "2 \u00b7 Blue flower editorial", text: "High-fashion editorial shot of this exact garment, surrounded by rich blue flowers, moody luxury lighting, cinematic composition, premium streetwear campaign, realistic fabric texture, true product details, no distortion." },
        { title: "3 \u00b7 Museum scale visual", text: "Luxury campaign image of this exact garment in a dramatic museum-like environment with oversized art or statues, cinematic lighting, realistic fashion photography, preserve exact garment details, no distortion." },
        { title: "4 \u00b7 Green wall campaign", text: "Streetwear editorial shot using this exact garment, model against a textured green wall, premium composition, soft cinematic lighting, realistic fit and folds, preserve print placement, no distortion." },
        { title: "5 \u00b7 Multi-product scene", text: "Premium campaign image using this garment with multiple matching products from the brand, cohesive styling, editorial layout, luxury streetwear aesthetic, realistic lighting, no distortion." },
        { title: "6 \u00b7 Night city luxury", text: "Cinematic nighttime city campaign image using this exact garment, luxury streetwear energy, realistic reflections and shadows, premium fashion ad look, preserve garment color and design, no distortion." },
        { title: "7 \u00b7 Seated power pose", text: "Luxury streetwear campaign image with a model seated confidently wearing this exact garment, dramatic but realistic lighting, premium styling, preserve all product details, no distortion." },
        { title: "8 \u00b7 Minimal luxury studio", text: "Premium studio campaign image of this exact garment, minimal background, strong fashion lighting, editorial magazine quality, high detail fabric texture, realistic proportions, no distortion." },
        { title: "9 \u00b7 Duffle bag campaign", text: "Luxury streetwear campaign visual with model wearing this exact garment and styled with a duffle bag, realistic proportions, premium fashion composition, preserve garment details, no distortion." },
        { title: "10 \u00b7 Hero image for launch", text: "Hero campaign image for a streetwear launch using this exact garment, cinematic and premium, highly polished but realistic, preserve exact design placement and color, no distortion, brand-ready visual." }
      ]},
      { t: "callout", title: "Free mockup first", html: "Kive gives a free mockup \u2014 upgrade only when you're ready to go full campaign." },
      { t: "links", items: [
        { label: "Kive.ai", url: "https://kive.ai", note: "Paste product URL \u2192 paste prompt \u2192 generate." }
      ]},
        { t: "p", html: "<strong>The Kive rule:</strong> Kive = Presentation. Campaign visuals. Brand elevation. Luxury perception. The flow never changes: <strong>start with PhotoRoom, then enhance with Kive.</strong>" },
        { t: "h", text: "Quality control \u2014 check every image" },
        { t: "checklist", items: [
          "Hands \u2014 fingers right, nothing extra",
          "Garment shape \u2014 fit and drape hold up",
          "Shoes \u2014 correct, no warping",
          "Print placement \u2014 exactly where the design file puts it",
          "Logos \u2014 spelled right, not mirrored",
          "Product color \u2014 true to the real piece",
          "Text \u2014 no gibberish letters",
          "Face \u2014 no distortion",
          "Accessories \u2014 belong in the scene",
          "Background \u2014 no errors hiding in it"
        ]}
      ]
  },
  {
    id: "m-videoprompts", num: "D9", part: "Deluxe Exclusive", tier: "deluxe", ai: true,
    title: "Cinematic AI Video Prompts", est: "8 min",
    intro: "For Dreamina/CapCut and video generators. These make the TikTok-style ads that sell drops.",
    blocks: [
      { t: "aidisc" },
      { t: "prompts", items: [
        { title: "Subway UGC + fabric focus", text: "Vertical handheld iPhone-style video, raw TikTok UGC aesthetic, subway station platform. Young man wearing the garment \u2014 must match the design file realistically. Train moves behind him with motion blur. Quick cuts: hoodie fabric texture close-up, sleeve detail, full body fit as train passes. Natural fluorescent lighting, slightly shaky, imperfect focus. Focus on fabric realism: weight, folds, movement in wind." },
        { title: "Parking garage unisex reveal", text: "Vertical iPhone-style video, authentic TikTok UGC aesthetic, modern city parking garage, daytime. Black G-Wagon visible in background. Two models (unisex) wearing the same outfit. Cuts: front full-body reveal side-by-side, waistband close-ups, side angle fit, back view silhouette, candid interaction. Natural garage daylight, soft shadows, realistic reflections." }
      ]},
      { t: "callout", title: "Why UGC-style wins", html: "Raw beats polished on TikTok. Slightly shaky, imperfect focus, real environments \u2014 the video should feel found, not filmed. That's what stops the scroll." }
    ]
  },
  {
    id: "m-sms", num: "D10", part: "Deluxe Exclusive", tier: "deluxe",
    title: "SMS & Outreach Templates", est: "7 min",
    intro: "Copy-paste scripts. Fill the brackets, send.",
    blocks: [
      { t: "lead", html: "Don't write from scratch. These are the exact scripts \u2014 fill the brackets and send." },
      { t: "prompts", items: [
        { title: "Pre-drop SMS (T-1 hour)", text: "[BRAND] drop live in 1 hour. 50 pieces only \u2014 no restock. [LINK]" },
        { title: "Launch SMS (T-0)", text: "LIVE NOW. [BRAND] \u2014 [PIECE NAME]. 50 pieces. When it's gone, it's gone. [LINK]" },
        { title: "Sold-out SMS (T+24h)", text: "SOLD OUT in [X] hours. Missed it? Join the list for next drop early access. [LINK]" },
        { title: "Supplier outreach email", text: "Subject: Blank inquiry \u2014 [BRAND]\n\nHi, I'm launching a streetwear brand and need [Supima 500 GSM hoodies / blanks]. Starting with samples, scaling to regular orders. Can you share pricing for 1, 25, and 100 units, plus lead times? Thanks \u2014 [NAME], [BRAND]" }
      ]}
    ]
  },
  {
    id: "m-techpack", num: "D11", part: "Deluxe Exclusive", tier: "deluxe",
    title: "Tech Pack Checklist", est: "6 min",
    intro: "Build this in Kittl (free) \u2014 it replaces the $2,000 tech pack.",
    blocks: [
      { t: "checklist", items: [
        "Front flat sketch with measurements",
        "Back flat sketch with measurements",
        "Print placement map (chest, back, sleeve \u2014 exact inches)",
        "Artwork files attached (300 DPI minimum, transparent PNG)",
        "Fabric spec (cotton type, GSM, color codes)",
        "Neck label design + placement",
        "Hang tag design (front/back)",
        "Size run (S\u20132XL grading notes)",
        "Packaging spec (polymailer, stickers, inserts)"
      ]},
      { t: "h", text: "Free tech-pack tools" },
      { t: "links", items: [
        { label: "Techpacker", url: "https://techpacker.com", note: "Dedicated tech-pack builder." },
        { label: "Seamly2D", url: "https://seamly.io", note: "Open-source pattern tool." },
        { label: "Kittl tech-pack template", url: "https://www.kittl.com/design/Streetwear-Techpack-VeyjIqPH", note: "54,000+ uses \u2014 the $2,000 tech pack, free." }
      ]},
      { t: "p", html: "No budget? <strong>Google Sheets + ChatGPT</strong> gets you a working tech pack today." }
    ]
  },
  {
    id: "m-resources", num: "D12", part: "Deluxe Exclusive", tier: "deluxe",
    title: "Complete Resource Directory", est: "5 min",
    intro: "Every link. Tap and go.",
    blocks: [
      { t: "h", text: "Production" },
      { t: "links", items: [
        { label: "Tapstitch", url: "https://tapstitch.com", note: "POD \u2014 order 1 or 100." },
        { label: "PodPartner", url: "https://podpartner.com", note: "Jumbo DTG + full branding." },
        { label: "PodPluser", url: "https://podpluser.com", note: "Hidden gem \u2014 all-over print." },
        { label: "OriginalFavorites", url: "https://originalfavorites.com", note: "Supima blanks, no MOQ." },
        { label: "Shopify", url: "https://shopify.com", note: "Your store." }
      ]},
      { t: "h", text: "Design & AI" },
      { t: "links", items: [
        { label: "Kittl", url: "https://kittl.com", note: "Typography, mockups, tech packs." },
        { label: "PhotoRoom", url: "https://photoroom.com", note: "Mockups + virtual models." },
        { label: "Kive.ai", url: "https://kive.ai", note: "AI campaign visuals." },
        { label: "Placeit", url: "https://placeit.net", note: "Quick mockups." },
        { label: "Dreamina", url: "https://dreamina.capcut.com", note: "Cinematic AI video." },
        { label: "CreativeFabrica Studio", url: "https://creativefabrica.com", note: "TikTok-style shots." },
        { label: "Leonardo.ai", url: "https://leonardo.ai", note: "AI design." },
        { label: "Ideogram", url: "https://ideogram.ai", note: "AI design + typography." },
        { label: "Krea.ai", url: "https://krea.ai", note: "AI design." }
      ]},
      { t: "h", text: "Legal" },
      { t: "links", items: [
        { label: "USPTO", url: "https://tsdr.uspto.gov", note: "Trademark search (free)." },
        { label: "IRS", url: "https://irs.gov", note: "EIN (free)." }
      ]},
      { t: "h", text: "Selling & SMS" },
      { t: "links", items: [
        { label: "Privy", url: "https://privy.com", note: "Pop-ups + SMS." },
        { label: "Omnisend", url: "https://omnisend.com", note: "Pop-ups + SMS." },
        { label: "Ecom Needs Jungle", url: "https://ecomneedsjungle.com/products/targeted-subscriber-lead-1", note: "Targeted subscriber leads \u2014 ready-made SMS + email lists." },
        { label: "Postscript", url: "https://postscript.io", note: "SMS for Shopify." },
        { label: "Mailchimp", url: "https://mailchimp.com", note: "Email." }
      ]},
      { t: "h", text: "Suppliers (Etsy)" },
      { t: "links", items: [
        { label: "Boody Babies", url: "https://etsy.com/shop/boodybabies", note: "Neck labels." },
        { label: "Personalize Your Stamp", url: "https://etsy.com/shop/PersonalizeYourStamp", note: "Leather embossers." },
        { label: "ReturnToSenderCo", url: "https://etsy.com/shop/ReturnToSenderCo", note: "Black-light logo stamper." },
        { label: "SnapButtonJewelry", url: "https://etsy.com/shop/SnapButtonJewelry", note: "Hardware & details." },
        { label: "XpressPatches", url: "https://etsy.com/shop/XpressPatches", note: "PVC patches." },
        { label: "MyPersonalize", url: "https://etsy.com/shop/MyPersonalize", note: "Custom belts." },
        { label: "AllcustomCN", url: "https://etsy.com/shop/AllcustomCN", note: "Belts & poly mailers." },
        { label: "StickerWaveLLC", url: "https://etsy.com/shop/StickerWaveLLC", note: "Custom stickers." },
        { label: "StickerMule", url: "https://stickermule.com", note: "Keychains, pins, labels." }
      ]},
      { t: "h", text: "Support" },
      { t: "p", html: "<strong>Founder WhatsApp</strong> \u2014 24/7 direct line (Deluxe members). <strong>YouTube @learnwithpotent</strong> \u2014 follow-along videos." },
        { t: "h", text: "Follow along \u2014 video" },
        { t: "links", items: [
          { label: "YouTube \u2014 @learnwithpotent", url: "https://youtube.com/@Potentgriffin", note: "Follow-along videos: 'How I Built A Clothing Brand With No Money' \u00b7 'How to Start a Clothing Brand With $0 (No Inventory)'." },
          { label: "PhotoRoom Tutorial", url: "https://youtu.be/pQLb6oqPERk", note: "The mockup workflow, on video." },
          { label: "EIN & LLC Filing Tutorial", url: "https://youtu.be/JQCJLma8g1U", note: "Free to file \u2014 full walkthrough." },
          { label: "USPTO Application Help Walkthrough", url: "https://youtu.be/JJ70453NSFQ", note: "The trademark application, field by field." }
        ]},
        { t: "h", text: "Support" },
        { t: "links", items: [
          { label: "Founder WhatsApp", url: "https://wa.me/message/FGSHNADCOQIYJ1", note: "24/7 direct line \u2014 message me. This isn't a one-way book, it's an open door." }
        ]}
      ]
  },
    {
      id: "m-business", num: "D13", part: "Deluxe Exclusive", tier: "deluxe",
      title: "Run The Business", est: "6 min",
      intro: "The tool stack behind the brand \u2014 operations, finance, and distribution.",
      blocks: [
        { t: "lead", html: "A brand is a business. These are the tools that run mine \u2014 most of them free to start." },
        { t: "h", text: "Operations" },
        { t: "list", items: [
          "<strong>Trello / Asana</strong> \u2014 track every task and drop",
          "<strong>Slack + WhatsApp</strong> \u2014 team and community comms",
          "<strong>Google Drive</strong> \u2014 every file, design, and invoice",
          "<strong>Todoist</strong> \u2014 time tracking and daily priorities",
          "<strong>LastPass</strong> \u2014 every password, one vault"
        ]},
        { t: "h", text: "Finance" },
        { t: "list", items: [
          "<strong>QuickBooks Online</strong> \u2014 the books, done right",
          "<strong>HelloSign</strong> \u2014 contracts and agreements signed",
          "<strong>Stripe + Square</strong> \u2014 get paid anywhere",
          "<strong>Experian Business Credit</strong> \u2014 build the business credit file from day one"
        ]},
        { t: "h", text: "Content \u2014 community & distribution" },
        { t: "p", html: "Attention is a system. I don't chase algorithms \u2014 <strong>I build pipelines.</strong>" },
        { t: "list", items: [
          "<strong>Vista Social</strong> \u2014 schedule everything from one place",
          "<strong>Discord</strong> \u2014 artists & creators",
          "<strong>WhatsApp</strong> \u2014 VIP buyers, direct line",
          "<strong>Mailchimp</strong> \u2014 email. Email builds trust.",
          "<strong>SimpleTexting</strong> \u2014 SMS drops. SMS creates urgency."
        ]}
      ]
    }
);

PB_COURSE.tools = [
  { id: "t-calendar", title: "Drop Calendar", desc: "Plan every drop date, tease, and SMS blast.", file: "tools/calendar.html", addon: "calendar" },
  { id: "t-calculator", title: "Pricing Calculator", desc: "Price every piece for real profit.", file: "tools/calculator.html", addon: "calculator" },
  { id: "t-techpack", title: "Tech Pack Builder", desc: "Build production-ready tech packs.", file: "tools/techpack.html", addon: "techpack" },
  { id: "t-vault", title: "Asset Vault", desc: "Your private library of templates & prompts.", file: "tools/vault.html", addon: "vault" }
];
