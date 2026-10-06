/**
 * materials.js — progressive enhancement for the pre-rendered teaching catalog.
 *
 * SEO/content rule: all public material cards are generated into the HTML by
 * scripts/generate-seo.py. This script only adds tab/filter interaction; it does
 * not fetch the catalog at runtime. The source of truth remains
 * frontend/data/materials.json.
 */
(function () {
  "use strict";

  const roots = document.querySelectorAll("[data-materials-root][data-prerendered='true']");
  if (!roots.length) return;

  roots.forEach((root) => {
    let activeFilter = "all";

    function activePanel() {
      return root.querySelector(".material-semester-panel:not([hidden])");
    }

    function applyFilter() {
      const permanent = root.querySelector("[data-permanent-section]");
      const panel = activePanel();
      const containers = [permanent, panel].filter(Boolean);

      containers.forEach((container) => {
        container.querySelectorAll(".material-card").forEach((card) => {
          card.hidden = activeFilter !== "all" && card.dataset.type !== activeFilter;
        });
        container.querySelectorAll("[data-material-section]").forEach((section) => {
          const hasVisibleCard = Array.from(section.querySelectorAll(".material-card"))
            .some((card) => !card.hidden);
          section.hidden = !hasVisibleCard;
        });

        if (container.matches("[data-permanent-section]")) {
          const hasVisiblePermanent = Array.from(container.querySelectorAll(".material-card"))
            .some((card) => !card.hidden);
          container.hidden = !hasVisiblePermanent;
        }
      });
    }

    root.querySelectorAll(".material-semester-btn").forEach((button) => {
      button.addEventListener("click", () => {
        const semesterId = button.dataset.semester;

        root.querySelectorAll(".material-semester-btn").forEach((candidate) => {
          const selected = candidate === button;
          candidate.classList.toggle("active", selected);
          candidate.setAttribute("aria-selected", selected ? "true" : "false");
        });

        root.querySelectorAll(".material-semester-panel").forEach((panel) => {
          panel.hidden = panel.dataset.semesterPanel !== semesterId;
        });

        applyFilter();
      });
    });

    root.querySelectorAll(".material-filter").forEach((button) => {
      button.addEventListener("click", () => {
        activeFilter = button.dataset.filter || "all";
        root.querySelectorAll(".material-filter").forEach((candidate) => {
          candidate.classList.toggle("active", candidate === button);
        });
        applyFilter();
      });
    });

    applyFilter();
  });
})();
