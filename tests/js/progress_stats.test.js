// Run: node --test tests/js/*.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const P = require("../../src/static/progress_stats.js");

const at = (y, m, d, h = 12) => new Date(y, m - 1, d, h).getTime();
const card = (attempts, tags = []) => ({ tags, attempts: attempts.map(([timestamp, correct]) => ({ timestamp, correct })) });

test("states", () => {
  assert.equal(P.cardState(card([])), "new");
  assert.equal(P.cardState(card([[at(2026, 11, 1), true], [at(2026, 11, 3), false]])), "missed");
  assert.equal(P.cardState(card([[at(2026, 11, 1), true]])), "learning", "a first answer has no gap");
  assert.equal(P.cardState(card([[at(2026, 11, 1, 9), false], [at(2026, 11, 1, 10), true]])), "learning", "right an hour later");
  assert.equal(P.cardState(card([[at(2026, 11, 1), true], [at(2026, 11, 3), true]])), "known");
  assert.equal(P.cardState(card([[at(2026, 11, 1), true], [at(2026, 11, 9), true]])), "solid");
  assert.equal(P.cardState(card([[at(2026, 11, 1), false], [at(2026, 11, 9), true]])), "solid", "right 8 days after a miss");
});

test("a miss resets the gap that counts", () => {
  const c = card([[at(2026, 10, 1), true], [at(2026, 10, 20), true], [at(2026, 11, 1, 9), false], [at(2026, 11, 1, 10), true]]);
  assert.equal(P.cardState(c), "learning");
  assert.equal(P.firstKnownAt(c), at(2026, 10, 20), "first known stays");
});

test("attempt order in storage does not matter", () => {
  assert.equal(P.cardState(card([[at(2026, 11, 3), true], [at(2026, 11, 1), true]])), "known");
});

test("summary", () => {
  const s = P.summary([card([]), card([[at(2026, 11, 1), false]]), card([[at(2026, 11, 1), true], [at(2026, 11, 3), true]])]);
  assert.deepEqual(s, { total: 3, tried: 2, lastCorrect: 1, lastIncorrect: 1, knownOrSolid: 1,
    counts: { new: 1, missed: 1, learning: 0, known: 1, solid: 0 } });
});

test("weekly activity", () => {
  const cards = [card([[at(2026, 11, 2), true], [at(2026, 11, 4), true], [at(2026, 11, 10), false]]), card([])];
  const rows = P.activity(cards, "week", { now: at(2026, 11, 18), periods: 3 });
  assert.equal(rows.length, 3);
  assert.equal(rows[0].start, new Date(2026, 10, 2).getTime(), "weeks start on Monday");
  assert.deepEqual(rows.map(r => [r.answers, r.correct, r.firstTried, r.firstKnown]), [[2, 2, 1, 1], [1, 0, 0, 0], [0, 0, 0, 0]]);
});

test("monthly activity runs from the first answer", () => {
  const rows = P.activity([card([[at(2026, 8, 15), true]])], "month", { now: at(2026, 11, 18) });
  assert.equal(rows.length, 4);
  assert.equal(rows[0].start, new Date(2026, 7, 1).getTime());
});

test("by section skips the filter's tags and sorts", () => {
  const rows = P.bySection([
    card([[at(2026, 11, 1), true]], ["phd", "phd-01-foundations"]),
    card([], ["phd", "phd-00-meta"]),
  ], ["phd"]);
  assert.deepEqual(rows.map(r => [r.tag, r.total, r.tried]), [["phd-00-meta", 1, 0], ["phd-01-foundations", 1, 1]]);
  assert.equal(rows[1].lastStudied, at(2026, 11, 1));
});
