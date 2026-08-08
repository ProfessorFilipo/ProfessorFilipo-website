/**
 * counter.js — retro 90s-style visit counter, rendered as real 7-segment
 * LED digits (CSS-drawn, not an image or font). Also shows the date
 * counting started, read from the same API response.
 *
 * Behavior: increments once per browser session (POST /counter/hit) —
 * but on every subsequent page load in that same session, it re-reads the
 * current total (GET /counter/count, which never increments) so the
 * displayed number always reflects the true current count, not a stale
 * cached one from earlier in the session.
 */
(function () {
  const COUNTED_FLAG = "filipomor_counted";
  const container = document.getElementById("visit-counter-digits");
  if (!container) return;

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

  function renderStartedAt(startedAt) {
    const el = document.getElementById("counter-since");
    if (!el || !startedAt) return;
    const [ano, mes, dia] = startedAt.split("-");
    if (!ano || !mes || !dia) return;
    el.textContent = `DESDE ${dia}/${mes}/${ano}`;
  }

  const alreadyCounted = sessionStorage.getItem(COUNTED_FLAG) === "1";
  const endpoint = alreadyCounted ? "/counter/count" : "/counter/hit";
  const method = alreadyCounted ? "GET" : "POST";

  fetch(`${API_BASE_URL}${endpoint}`, { method })
    .then((res) => res.json())
    .then((data) => {
      if (!alreadyCounted) sessionStorage.setItem(COUNTED_FLAG, "1");
      renderDigits(data.count);
      renderStartedAt(data.started_at);
    })
    .catch(() => {
      renderDigits(0);
    });
})();
