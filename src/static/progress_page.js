// Progress page: renders the metrics from progress_stats.js for the cards the URL's filter keeps
// (same filter as the study page, via deck_filter.js). Card names and tags are inserted as text, never HTML.
(function () {
  "use strict";
  const P = window.ProgressStats;
  const F = window.DeckFilter;

  const STATE_LABEL = { new: "New", missed: "Missed", learning: "Learning", known: "Known", solid: "Solid" };
  const STATE_HELP = {
    new: "never answered",
    missed: "wrong last time",
    learning: "right last time, not yet after a day's gap",
    known: "right after a gap of 1+ day",
    solid: "right after a gap of 7+ days",
  };
  const PERIODS = { day: 30, week: 26, month: null };

  const params = new URLSearchParams(location.search);
  const filter = F.fromQuery(location.search);
  const unit = PERIODS.hasOwnProperty(params.get("by")) ? params.get("by") : "week";
  const cards = F.apply(window.PERDISCO_CARDS || [], filter);

  // ----- small DOM helpers -----
  function el(tag, attrs = {}, ...children) {
    const node = document.createElement(tag);
    Object.entries(attrs).forEach(([k, v]) => {
      if (k === "class") node.className = v; else if (k === "text") node.textContent = v; else node.setAttribute(k, v);
    });
    children.forEach(c => node.append(c));
    return node;
  }
  const SVG_NS = "http://www.w3.org/2000/svg";
  function svgEl(tag, attrs = {}) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
    return node;
  }
  const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);
  const fmt = n => n.toLocaleString();

  function timeAgo(ts) {
    if (ts == null) return "never";
    const days = Math.floor((Date.now() - ts) / P.DAY_MS);
    if (days <= 0) return "today";
    if (days === 1) return "yesterday";
    if (days < 30) return `${days} days ago`;
    if (days < 365) return `${Math.round(days / 30)} months ago`;
    return `${(days / 365).toFixed(1)} years ago`;
  }

  function periodLabel(start, short) {
    const d = new Date(start);
    if (unit === "month") return d.toLocaleDateString(undefined, short ? { month: "short" } : { month: "long", year: "numeric" });
    const day = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (short) return day;
    return unit === "week" ? `Week of ${day}, ${d.getFullYear()}` : d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }

  // ----- tooltip (hover and keyboard focus) -----
  const tooltip = document.getElementById("tooltip");
  // rows: [{ value, label, color? }]
  function attachTip(node, title, rows) {
    const show = e => {
      tooltip.replaceChildren(el("div", { class: "tt-title", text: title }));
      rows.forEach(r => {
        const row = el("div", { class: "tt-row" });
        if (r.color) { const key = el("span", { class: "tt-key" }); key.style.background = r.color; row.append(key); }
        row.append(el("span", { class: "tt-value", text: r.value }), el("span", { text: r.label }));
        tooltip.append(row);
      });
      tooltip.hidden = false;
      const box = (e && e.clientX != null) ? { x: e.clientX, y: e.clientY } : (() => {
        const b = node.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top };
      })();
      const w = tooltip.offsetWidth, h = tooltip.offsetHeight;
      tooltip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, box.x + 12)) + "px";
      tooltip.style.top = Math.max(8, box.y - h - 12) + "px";
    };
    node.addEventListener("pointermove", show);
    node.addEventListener("focus", () => show(null));
    node.addEventListener("pointerleave", () => { tooltip.hidden = true; });
    node.addEventListener("blur", () => { tooltip.hidden = true; });
    node.setAttribute("tabindex", "0");
  }

  function cssVar(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

  // ----- header: scope and controls -----
  function renderScope() {
    const scope = document.getElementById("scope");
    scope.replaceChildren();
    if (F.isEmpty(filter)) {
      scope.append(`All ${fmt(cards.length)} cards (no filter).`);
    } else {
      scope.append(`${fmt(cards.length)} cards matching `);
      filter.tags.forEach(t => scope.append(el("span", { class: "tag", text: "#" + t })));
      if (filter.content) scope.append(` containing “${filter.content}”`);
      if (filter.required !== "any") scope.append(filter.required === "true" ? " (required only)" : " (not required)");
      scope.append(".");
    }
    const select = document.getElementById("group-by");
    select.value = unit;
    select.addEventListener("change", () => {
      params.set("by", select.value);
      location.search = params.toString();
    });
  }

  // ----- stat tiles -----
  function renderTiles(s) {
    const tile = (label, value, sub) => el("div", { class: "pg-tile" },
      el("div", { class: "label", text: label }), el("div", { class: "value", text: value }), el("div", { class: "sub", text: sub }));
    document.getElementById("tiles").replaceChildren(
      tile("Cards", fmt(s.total), "in this view"),
      tile("Tried", fmt(s.tried), `${pct(s.tried, s.total)}% of the cards`),
      tile("Right last time", fmt(s.lastCorrect), `${pct(s.lastCorrect, s.tried)}% of tried`),
      tile("Wrong last time", fmt(s.lastIncorrect), `${pct(s.lastIncorrect, s.tried)}% of tried`),
      tile("Known or solid", fmt(s.knownOrSolid), `${pct(s.knownOrSolid, s.total)}% of the cards`),
    );
  }

  // ----- segmented bar of card states -----
  function segBar(container, counts, total, tall) {
    container.replaceChildren();
    container.classList.toggle("empty", total === 0);
    if (total === 0) return;
    P.STATES.forEach(state => {
      const n = counts[state];
      if (!n) return;
      const seg = el("div", { class: `seg ${state}` });
      seg.style.flex = `${n} 1 0`;
      if (tall) seg.append(el("span", { text: `${pct(n, total)}%` }));
      attachTip(seg, STATE_LABEL[state], [{ value: fmt(n), label: `cards · ${pct(n, total)}%` }, { value: "", label: STATE_HELP[state] }]);
      seg.setAttribute("aria-label", `${STATE_LABEL[state]}: ${n} cards, ${pct(n, total)}%`);
      container.append(seg);
    });
    if (tall) {
      // A part too narrow for its label prints none (the tooltip and the table keep the number).
      requestAnimationFrame(() => container.querySelectorAll(".seg").forEach(seg => {
        const label = seg.querySelector("span");
        if (label && label.offsetWidth + 10 > seg.clientWidth) label.remove();
      }));
    }
  }

  function renderMastery(s) {
    const bar = document.getElementById("mastery-bar");
    bar.setAttribute("aria-label", P.STATES.map(st => `${STATE_LABEL[st]} ${s.counts[st]}`).join(", "));
    segBar(bar, s.counts, s.total, true);
    const legend = document.getElementById("mastery-legend");
    legend.replaceChildren(...P.STATES.map(st => {
      const sw = el("span", { class: "swatch" }); sw.style.background = `var(--viz-${st})`;
      return el("li", { title: STATE_HELP[st] }, sw, `${STATE_LABEL[st]} · ${fmt(s.counts[st])}`);
    }));
    const table = document.getElementById("mastery-table");
    table.replaceChildren(el("tr", {}, el("th", { text: "State" }), el("th", { text: "Cards" }), el("th", { text: "Share" }), el("th", { text: "Meaning" })),
      ...P.STATES.map(st => el("tr", {}, el("td", { text: STATE_LABEL[st] }), el("td", { text: fmt(s.counts[st]) }),
        el("td", { text: `${pct(s.counts[st], s.total)}%` }), el("td", { text: STATE_HELP[st] }))));
  }

  // ----- column charts -----
  // series: [{ key, label, cls, colorVar }]; one column per series per period, grouped.
  function columnChart(container, rows, series, tipRows) {
    const W = 900, H = 220, M = { top: 12, right: 8, bottom: 26, left: 34 };
    const iw = W - M.left - M.right, ih = H - M.top - M.bottom;
    const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}`, role: "img" });
    const max = Math.max(0, ...rows.flatMap(r => series.map(s => r[s.key])));
    // Clean ticks: 1, 2 or 5 times a power of ten, about 4 of them.
    const rough = Math.max(1, max) / 4;
    const mag = Math.pow(10, Math.floor(Math.log10(rough)));
    const step = Math.max(1, [1, 2, 5, 10].map(f => f * mag).find(v => v >= rough));
    const top = Math.max(step, Math.ceil(max / step) * step);
    const y = v => M.top + ih - (v / top) * ih;
    for (let v = 0; v <= top; v += step) {
      svg.append(svgEl("line", { class: v === 0 ? "baseline" : "grid", x1: M.left, x2: W - M.right, y1: y(v), y2: y(v) }));
      const t = svgEl("text", { x: M.left - 6, y: y(v) + 4, "text-anchor": "end" }); t.textContent = fmt(v); svg.append(t);
    }
    const band = iw / rows.length;
    const barW = Math.min(24, Math.max(2, (band * 0.7) / series.length - 2));
    const groupW = series.length * barW + (series.length - 1) * 2;
    const labelEvery = Math.ceil(rows.length / Math.floor(iw / 60));
    rows.forEach((r, i) => {
      const x0 = M.left + i * band;
      const hit = svgEl("rect", { class: "hit", x: x0, y: M.top, width: band, height: ih });
      svg.append(hit);
      attachTip(hit, periodLabel(r.start, false), tipRows(r));
      series.forEach((s, j) => {
        const v = r[s.key];
        if (!v) return;
        const x = x0 + (band - groupW) / 2 + j * (barW + 2);
        const h = y(0) - y(v), rad = Math.min(4, barW / 2, h);
        // Rounded data end, square at the baseline.
        const d = `M${x},${y(0)} V${y(v) + rad} Q${x},${y(v)} ${x + rad},${y(v)} H${x + barW - rad} Q${x + barW},${y(v)} ${x + barW},${y(v) + rad} V${y(0)} Z`;
        const bar = svgEl("path", { d, class: s.cls });
        bar.style.pointerEvents = "none";
        svg.append(bar);
      });
      if (i % labelEvery === 0) {
        const t = svgEl("text", { x: x0 + band / 2, y: H - 8, "text-anchor": "middle" });
        t.textContent = periodLabel(r.start, true); svg.append(t);
      }
    });
    if (max === 0) {
      const t = svgEl("text", { class: "empty-note", x: M.left + iw / 2, y: M.top + ih / 2, "text-anchor": "middle" });
      t.textContent = "No answers in this time range"; svg.append(t);
    }
    container.replaceChildren(svg);
  }

  function renderActivity() {
    const rows = P.activity(cards, unit, { periods: PERIODS[unit] });
    const s1 = cssVar("--viz-series-1"), s2 = cssVar("--viz-series-2");
    columnChart(document.getElementById("answers-chart"), rows,
      [{ key: "answers", cls: "s1" }],
      r => [{ value: fmt(r.answers), label: "answers", color: s1 }, { value: fmt(r.correct), label: `right (${pct(r.correct, r.answers)}%)` }]);
    const series = [
      { key: "firstTried", label: "Tried for the first time", cls: "s1", color: s1 },
      { key: "firstKnown", label: "Became known", cls: "s2", color: s2 },
    ];
    document.getElementById("cards-legend").replaceChildren(...series.map(s => {
      const sw = el("span", { class: "swatch" }); sw.style.background = s.color;
      return el("li", {}, sw, s.label);
    }));
    columnChart(document.getElementById("cards-chart"), rows, series,
      r => series.map(s => ({ value: fmt(r[s.key]), label: s.label.toLowerCase(), color: s.color })));
    const table = document.getElementById("activity-table");
    table.replaceChildren(el("tr", {}, ...["Period", "Answers", "Right", "Tried first time", "Became known"].map(h => el("th", { text: h }))),
      ...rows.filter(r => r.answers).reverse().map(r => el("tr", {},
        el("td", { text: periodLabel(r.start, false) }), el("td", { text: fmt(r.answers) }), el("td", { text: fmt(r.correct) }),
        el("td", { text: fmt(r.firstTried) }), el("td", { text: fmt(r.firstKnown) }))));
    if (!rows.some(r => r.answers)) table.append(el("tr", {}, el("td", { colspan: "5", text: "No answers in this time range." })));
  }

  // ----- per-tag table -----
  function renderSections() {
    const rows = P.bySection(cards, filter.tags);
    const table = document.getElementById("sections-table");
    table.replaceChildren(el("tr", {}, ...["Tag", "Cards", "Tried", "Known or solid", "", "Last studied"].map(h => el("th", { text: h }))));
    if (!rows.length) {
      table.append(el("tr", {}, el("td", { colspan: "6", text: "These cards have no other tags." })));
      return;
    }
    rows.forEach(r => {
      const link = el("a", { href: "/progress?" + F.toQuery(F.normalize({ ...filter, tags: [...filter.tags, r.tag] })) + `&by=${unit}`, text: r.tag });
      const bar = el("div", { class: "pg-segbar thin", role: "img",
        "aria-label": P.STATES.map(st => `${STATE_LABEL[st]} ${r.counts[st]}`).join(", ") });
      segBar(bar, r.counts, r.total, false);
      table.append(el("tr", {},
        el("td", {}, link), el("td", { text: fmt(r.total) }), el("td", { text: `${pct(r.tried, r.total)}%` }),
        el("td", { text: `${pct(r.knownOrSolid, r.total)}%` }), el("td", { class: "bar" }, bar), el("td", { text: timeAgo(r.lastStudied) })));
    });
  }

  renderScope();
  const s = P.summary(cards);
  renderTiles(s);
  renderMastery(s);
  renderActivity();
  renderSections();
})();
