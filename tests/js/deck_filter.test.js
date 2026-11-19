const test = require("node:test");
const assert = require("node:assert/strict");
const F = require("../../src/static/deck_filter.js");

const cards = [
  { front: "Propositional logic", back: "atoms", tags: ["phd", "phd-01-foundations"], absolutelyRequired: false },
  { front: "Kripke structure", back: "states", tags: ["PhD"], absolutelyRequired: true },
  { front: "Other", back: "x", tags: [], absolutelyRequired: false },
];

test("tags: every tag, case-insensitive", () => {
  assert.equal(F.apply(cards, F.fromInputs(" phd ,", "", "any")).length, 2);
  assert.equal(F.apply(cards, F.fromInputs("phd, phd-01-foundations", "", "any")).length, 1);
});

test("content and required", () => {
  assert.equal(F.apply(cards, F.fromInputs("", "STATES", "any"))[0].front, "Kripke structure");
  assert.equal(F.apply(cards, F.fromInputs("", "", "true")).length, 1);
  assert.equal(F.apply(cards, F.fromInputs("", "", "false")).length, 2);
});

test("query round trip", () => {
  const f = F.fromInputs("phd, phd-01-foundations", "Logic", "true");
  assert.equal(F.toQuery(f), "tags=phd%2Cphd-01-foundations&q=logic&required=true");
  assert.deepEqual(F.fromQuery("?" + F.toQuery(f)), f);
  assert.ok(F.isEmpty(F.fromQuery("")));
});
