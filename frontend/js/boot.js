/**
 * boot.js — plays the one-time "boot" animation on first visit, then
 * reveals the real page. Respects prefers-reduced-motion. Uses
 * sessionStorage so it only plays once per browser session (not on
 * every single page load within the same visit).
 */
(function () {
  var STORAGE_KEY = "filipomor_boot_played";
  var bootLayer = document.getElementById("boot-layer");
  if (!bootLayer) return;

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var alreadyPlayed = sessionStorage.getItem(STORAGE_KEY) === "1";

  if (reduced || alreadyPlayed) {
    bootLayer.classList.add("hidden");
    return;
  }

  var lines = [
    "FILIPOMOR.SYS  128K",
    "(C) 2026 F. NOVO MOR",
    "",
    "CARREGANDO PESQUISA.....OK",
    "CARREGANDO ENSINO.......OK",
    "CARREGANDO FERRAMENTAS..OK",
    "",
  ];
  var lineElements = Array.from(bootLayer.querySelectorAll(".boot-line"));

  function typeLine(index, done) {
    var el = lineElements[index];
    var text = lines[index];
    if (text === "") {
      el.innerHTML = "&nbsp;";
      setTimeout(done, 90);
      return;
    }
    var i = 0;
    (function step() {
      el.textContent = text.slice(0, i);
      i++;
      if (i <= text.length) setTimeout(step, 18);
      else setTimeout(done, 160);
    })();
  }

  function runNext(i) {
    if (i < lines.length) {
      typeLine(i, function () {
        runNext(i + 1);
      });
    } else {
      var lastLine = lineElements[lineElements.length - 1];
      lastLine.innerHTML = 'OK<span class="boot-cursor"></span>';
      setTimeout(function () {
        bootLayer.classList.add("hidden");
        sessionStorage.setItem(STORAGE_KEY, "1");
      }, 900);
    }
  }

  runNext(0);
})();
