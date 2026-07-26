/**
 * semester-tabs.js — toggles visibility between pre-rendered semester
 * panels. All content already exists in the page's HTML (good for SEO,
 * no fetch involved) — this only shows/hides which block is visible.
 */
(function () {
  const tabs = document.querySelectorAll(".semester-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.getAttribute("data-target");

      document.querySelectorAll(".semester-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".semester-panel").forEach((p) => p.classList.remove("active"));

      tab.classList.add("active");
      document.getElementById(target).classList.add("active");
    });
  });
})();
