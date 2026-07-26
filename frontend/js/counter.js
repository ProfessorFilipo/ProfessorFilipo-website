/**
 * counter.js — retro 90s-style visit counter. Increments once per browser
 * session (via sessionStorage) by calling the backend, which itself
 * enforces a server-side rate limit — so the count can't be inflated by a
 * script bypassing the frontend entirely.
 */
(function () {
  const COUNT_KEY = "filipomor_visit_count";
  const container = document.getElementById("visit-counter-digits");
  if (!container) return;

  function renderDigits(count) {
    const digits = String(count).padStart(6, "0").split("");
    container.innerHTML = digits
      .map((d) => `<span class="counter-digit">${d}</span>`)
      .join("");
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
