/**
 * counter.js — retro 90s-style visit counter, rendered as real 7-segment
 * LED digits (CSS-drawn, not an image or font). Increments once per
 * browser session (via sessionStorage) by calling the backend, which
 * itself enforces a server-side rate limit — so the count can't be
 * inflated by a script bypassing the frontend entirely.
 */
(function () {
  const COUNT_KEY = "filipomor_visit_count";
  const container = document.getElementById("visit-counter-digits");
  if (!container) return;

  // Segment order: a (top), b (top-right), c (bottom-right), d (bottom),
  // e (bottom-left), f (top-left), g (middle). 1 = lit, 0 = unlit.
  const SEGMENTS = {
    "0": "1111110",
    "1": "0110000",
    "2": "1101101",
    "3": "1111001",
    "4": "0110011",
    "5": "1011011",
    "6": "1011111",
    "7": "1110000",
    "8": "1111111",
    "9": "1111011",
  };
  const SEG_NAMES = ["a", "b", "c", "d", "e", "f", "g"];

  function digitToHTML(digit) {
    const bits = SEGMENTS[digit] || "0000000";
    const spans = SEG_NAMES.map(
      (name, i) => `<span class="seg-${name}${bits[i] === "1" ? " on" : ""}"></span>`
    ).join("");
    return `<span class="led-digit">${spans}</span>`;
  }

  function renderDigits(count) {
    const digits = String(count).padStart(6, "0").split("");
    container.innerHTML = digits.map(digitToHTML).join("");
  }

  const cachedCount = sessionStorage.getItem(COUNT_KEY);
  if (cachedCount !== null) {
    renderDigits(cachedCount);
    return;
  }

  fetch(`${API_BASE_URL}/counter/hit`, { method: "POST" })
    .then((res) => res.json())
    .then((data) => {
      sessionStorage.setItem(COUNT_KEY, data.count);
      renderDigits(data.count);
    })
    .catch(() => {
      // Fails quietly — a broken counter shouldn't break the rest of the page.
      renderDigits(0);
    });
})();
