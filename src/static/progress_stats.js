// Learning-progress metrics over cards and their attempts. Pure functions (no DOM), so the
// progress page and the tests share them. An attempt is { timestamp (ms), correct (bool), reason }.
//
// Each card is in one state:
//   new      - never answered
//   missed   - the last answer was wrong
//   learning - right last time, but not yet recalled correctly after a gap of knownGapDays
//   known    - since the last miss, recalled correctly after a gap of at least knownGapDays
//   solid    - since the last miss, recalled correctly after a gap of at least solidGapDays
// The gap of an answer is the time since the card's previous answer. Getting a card right just
// after seeing its back shows little; getting it right after a gap is what shows it was learned.
(function (root) {
  "use strict";

  const DAY_MS = 24 * 60 * 60 * 1000;
  const STATES = ["new", "missed", "learning", "known", "solid"];
  const DEFAULTS = { knownGapDays: 1, solidGapDays: 7 };

  function attemptsOf(card) {
    return (card.attempts || []).slice().sort((a, b) => a.timestamp - b.timestamp);
  }

  function cardState(card, opts = DEFAULTS) {
    const a = attemptsOf(card);
    if (a.length === 0) return "new";
    if (!a[a.length - 1].correct) return "missed";
    let lastMiss = -1;
    a.forEach((x, i) => { if (!x.correct) lastMiss = i; });
    let bestGap = 0;
    for (let i = Math.max(1, lastMiss + 1); i < a.length; i++) {
      bestGap = Math.max(bestGap, a[i].timestamp - a[i - 1].timestamp);
    }
    if (bestGap >= opts.solidGapDays * DAY_MS) return "solid";
    if (bestGap >= opts.knownGapDays * DAY_MS) return "known";
    return "learning";
  }

  function firstTriedAt(card) {
    const a = attemptsOf(card);
    return a.length ? a[0].timestamp : null;
  }

  function lastStudiedAt(card) {
    const a = attemptsOf(card);
    return a.length ? a[a.length - 1].timestamp : null;
  }

  // When the card first became "known": its first correct answer after a gap of knownGapDays
  // (later misses do not undo this date).
  function firstKnownAt(card, opts = DEFAULTS) {
    const a = attemptsOf(card);
    for (let i = 1; i < a.length; i++) {
      if (a[i].correct && a[i].timestamp - a[i - 1].timestamp >= opts.knownGapDays * DAY_MS) return a[i].timestamp;
    }
    return null;
  }

  function countStates(cards, opts = DEFAULTS) {
    const counts = Object.fromEntries(STATES.map(s => [s, 0]));
    cards.forEach(card => { counts[cardState(card, opts)]++; });
    return counts;
  }

  function summary(cards, opts = DEFAULTS) {
    const counts = countStates(cards, opts);
    const total = cards.length;
    const tried = total - counts.new;
    return {
      total,
      tried,
      lastCorrect: counts.learning + counts.known + counts.solid,
      lastIncorrect: counts.missed,
      knownOrSolid: counts.known + counts.solid,
      counts,
    };
  }

  // ----- time buckets (local time; weeks start on Monday) -----

  function periodStart(ts, unit) {
    const d = new Date(ts);
    d.setHours(0, 0, 0, 0);
    if (unit === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    if (unit === "month") d.setDate(1);
    return d.getTime();
  }

  function nextPeriod(start, unit) {
    const d = new Date(start);
    if (unit === "day") d.setDate(d.getDate() + 1);
    if (unit === "week") d.setDate(d.getDate() + 7);
    if (unit === "month") d.setMonth(d.getMonth() + 1);
    return d.getTime();
  }

  function addPeriods(start, unit, n) {
    const d = new Date(start);
    if (unit === "day") d.setDate(d.getDate() + n);
    if (unit === "week") d.setDate(d.getDate() + 7 * n);
    if (unit === "month") d.setMonth(d.getMonth() + n);
    return d.getTime();
  }

  // Per period: answers given (and how many right), cards tried for the first time, cards that
  // became known for the first time. `periods` = how many periods back from `now`; null = from the
  // first answer on (at least one period).
  function activity(cards, unit, { now = Date.now(), periods = null, opts = DEFAULTS } = {}) {
    const last = periodStart(now, unit);
    let first;
    if (periods != null) {
      first = addPeriods(last, unit, -(periods - 1));
    } else {
      const firsts = cards.map(firstTriedAt).filter(t => t != null);
      first = firsts.length ? periodStart(Math.min(...firsts), unit) : last;
    }
    const rows = [];
    const index = new Map();
    for (let s = first; s <= last; s = nextPeriod(s, unit)) {
      index.set(s, rows.length);
      rows.push({ start: s, end: nextPeriod(s, unit), answers: 0, correct: 0, firstTried: 0, firstKnown: 0 });
    }
    const rowAt = ts => index.get(periodStart(ts, unit));
    cards.forEach(card => {
      attemptsOf(card).forEach(x => {
        const i = rowAt(x.timestamp);
        if (i === undefined) return;
        rows[i].answers++;
        if (x.correct) rows[i].correct++;
      });
      const tried = firstTriedAt(card);
      if (tried != null && rowAt(tried) !== undefined) rows[rowAt(tried)].firstTried++;
      const known = firstKnownAt(card, opts);
      if (known != null && rowAt(known) !== undefined) rows[rowAt(known)].firstKnown++;
    });
    return rows;
  }

  // One row per tag among the cards, except the tags the filter already requires (every card has
  // those). Sorted by tag name, so zero-padded section tags (phd-00 .. phd-10) come out in order.
  function bySection(cards, filterTags = [], opts = DEFAULTS) {
    const skip = new Set(filterTags.map(t => t.toLowerCase()));
    const groups = new Map();
    cards.forEach(card => {
      (card.tags || []).forEach(tag => {
        if (skip.has(tag.toLowerCase())) return;
        if (!groups.has(tag)) groups.set(tag, []);
        groups.get(tag).push(card);
      });
    });
    return [...groups.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([tag, group]) => {
        const s = summary(group, opts);
        const studied = group.map(lastStudiedAt).filter(t => t != null);
        return { tag, ...s, lastStudied: studied.length ? Math.max(...studied) : null };
      });
  }

  const api = {
    DAY_MS, STATES, DEFAULTS,
    cardState, firstTriedAt, lastStudiedAt, firstKnownAt, countStates, summary,
    periodStart, activity, bySection,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ProgressStats = api;
})(this);
