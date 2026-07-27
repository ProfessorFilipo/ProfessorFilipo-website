/**
 * boot.js — plays the one-time "boot" animation on first visit, then
 * reveals the real page. Respects prefers-reduced-motion. Uses
 * sessionStorage so it only auto-plays once per browser session — but
 * exposes window.replayBootAnimation() so a button can trigger it again
 * on demand, regardless of session state.
 */
(function () {
  const STORAGE_KEY = "filipomor_boot_played";
  const bootLayer = document.getElementById("boot-layer");
  if (!bootLayer) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const lines = [
    "FILIPOMOR.SYS  128K",
    "(C) 2026 F. NOVO MOR",
    "",
    "CARREGANDO PESQUISA.....OK",
    "CARREGANDO ENSINO.......OK",
    "CARREGANDO FERRAMENTAS..OK",
    "",
  ];
  const lineElements = Array.from(bootLayer.querySelectorAll(".boot-line"));

  function typeLine(index, done) {
    const el = lineElements[index];
    const text = lines[index];
    if (text === "") {
      el.innerHTML = "&nbsp;";
      setTimeout(done, 90);
      return;
    }
    let i = 0;
    (function step() {
      el.textContent = text.slice(0, i);
      i++;
      if (i <= text.length) setTimeout(step, 18);
      else setTimeout(done, 160);
    })();
  }

  function resetLines() {
    lineElements.forEach((el) => { el.textContent = ""; });
  }

  function runNext(i) {
    if (i < lines.length) {
      typeLine(i, function () {
        runNext(i + 1);
      });
    } else {
      const lastLine = lineElements[lineElements.length - 1];
      lastLine.innerHTML = 'OK<span class="boot-cursor"></span>';
      setTimeout(function () {
        bootLayer.classList.add("hidden");
        sessionStorage.setItem(STORAGE_KEY, "1");
      }, 900);
    }
  }

  window.replayBootAnimation = function () {
    resetLines();
    bootLayer.classList.remove("hidden");
    runNext(0);
  };

  const replayBtn = document.getElementById("replay-boot-btn");
  if (replayBtn) {
    replayBtn.addEventListener("click", window.replayBootAnimation);
  }

  // Auto-play on first visit this session only.
  const alreadyPlayed = sessionStorage.getItem(STORAGE_KEY) === "1";
  if (reduced || alreadyPlayed) {
    bootLayer.classList.add("hidden");
    return;
  }
  runNext(0);
})();
