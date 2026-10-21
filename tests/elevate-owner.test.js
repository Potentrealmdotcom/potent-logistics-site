// Owner brief: only the owner's Əlevate carries the BHAG; everyone else's does not.
const assert = require("assert");
process.env.ELEVATE_OWNER_EMAILS = "boss@example.com";
const E = require("../netlify/functions/lib/elevate.js");
assert.ok(E.isOwnerKey("Boss@Example.com"), "owner key recognised");
assert.ok(!E.isOwnerKey("someone@else.com"), "others are not owner");
const o = E.systemPrompt({ owner: true }), n = E.systemPrompt({ owner: false });
assert.ok(/BHAG/.test(o) && /1,000 trucking/.test(o) && /\$34,995/.test(o), "owner prompt has the goal and prices");
assert.ok(!/BHAG|Conyers|1,000 trucking/.test(n), "non-owner prompt has none of it");
assert.ok(!/data hostage.*Motive|POTENT0421/i.test(o), "no passwords or other-company angles");
console.log("elevate-owner ok");
