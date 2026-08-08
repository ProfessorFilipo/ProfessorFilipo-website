/**
 * quote.js — discreet random quote in the home footer, read from a plain
 * text file (assets/quotes.txt), one quote per line. Chosen entirely
 * client-side, no backend involved — nothing here needs to be server-
 * validated or persisted, so a static file fits the "no build step"
 * frontend better than adding an API endpoint for it.
 *
 * Line format: "texto da citação — Autor" (em dash is the documented,
 * preferred separator). Also accepts a plain hyphen (" - Autor") as a
 * fallback, since that's what most keyboards type by default and the
 * file is meant to be hand-edited — a line typed with "-" instead of
 * "—" still gets its author recognized and styled separately, rather
 * than swallowing "- Autor" into the quote text itself. A line with
 * neither separator is shown without an author. Blank lines and lines
 * starting with # are ignored, so the file can carry comments/
 * instructions at the top.
 */
(function () {
  const el = document.getElementById("footer-quote");
  if (!el) return;

  function splitAutor(linha) {
    for (const separador of [" — ", " - "]) {
      const idx = linha.lastIndexOf(separador);
      if (idx > -1) {
        return {
          texto: linha.slice(0, idx).trim(),
          autor: linha.slice(idx + separador.length).trim(),
        };
      }
    }
    return { texto: linha, autor: null };
  }

  fetch("assets/quotes.txt")
    .then((res) => res.text())
    .then((text) => {
      const linhas = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
      if (!linhas.length) return;

      const escolhida = linhas[Math.floor(Math.random() * linhas.length)];
      const { texto, autor } = splitAutor(escolhida);

      el.innerHTML = autor
        ? `“${texto}” <span class="footer-quote-author">— ${autor}</span>`
        : `“${texto}”`;
    })
    .catch(() => {
      /* discreto por natureza — se falhar, a seção simplesmente não aparece */
    });
})();
