// Which cards a filter keeps. Shared by the study page and the progress page, so both always
// show the same cards for the same filter. A filter is { tags: [...], content: "", required: "any"|"true"|"false" },
// all lower case: a card matches when it has every tag, its front or back contains the content text,
// and its "absolutely required" flag matches.
(function (root) {
  "use strict";

  function normalize(filter) {
    const f = filter || {};
    const required = f.required === "true" || f.required === "false" ? f.required : "any";
    return {
      tags: (f.tags || []).map(t => String(t).trim().toLowerCase()).filter(t => t !== ""),
      content: String(f.content || "").trim().toLowerCase(),
      required,
    };
  }

  // From the study page's inputs: the tag box holds comma-separated tags.
  function fromInputs(tagText, content, required) {
    return normalize({ tags: String(tagText || "").split(","), content, required });
  }

  function matches(card, filter) {
    if (filter.tags.length) {
      const cardTags = (card.tags || []).map(t => t.toLowerCase());
      if (!filter.tags.every(t => cardTags.includes(t))) return false;
    }
    if (filter.content &&
        !(card.front || "").toLowerCase().includes(filter.content) &&
        !(card.back || "").toLowerCase().includes(filter.content)) return false;
    if (filter.required !== "any" && card.absolutelyRequired !== (filter.required === "true")) return false;
    return true;
  }

  function apply(cards, filter) {
    return cards.filter(card => matches(card, filter));
  }

  // URL form, e.g. "tags=phd,phd-01-foundations&q=logic&required=true" (empty parts left out).
  function toQuery(filter) {
    const params = new URLSearchParams();
    if (filter.tags.length) params.set("tags", filter.tags.join(","));
    if (filter.content) params.set("q", filter.content);
    if (filter.required !== "any") params.set("required", filter.required);
    return params.toString();
  }

  function fromQuery(search) {
    const params = new URLSearchParams(search);
    return fromInputs(params.get("tags") || "", params.get("q") || "", params.get("required") || "any");
  }

  function isEmpty(filter) {
    return !filter.tags.length && !filter.content && filter.required === "any";
  }

  const api = { normalize, fromInputs, matches, apply, toQuery, fromQuery, isEmpty };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DeckFilter = api;
})(this);
