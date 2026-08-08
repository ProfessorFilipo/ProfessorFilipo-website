/**
 * quote.js — discreet random quote in the home footer, read from a plain
 * text file (assets/quotes.txt), one quote per line. Chosen entirely
 * client-side, no backend involved — nothing here needs to be server-
 * validated or persisted, so a static file fits the "no build step"
 * frontend better than adding an API endpoint for it.
 *
 * Line format: "texto da citação — Autor" (em dash separates the
 * attribution; a line with no " — " is shown without an author). Blank
 * lines and lines starting with # are ignored, so the file can carry
 * comments/instructions at the top.
 */
(function () {
  const el = document.getElementById("footer-quote");
  if (!el) return;

  fetch("assets/quotes.txt")
    .then((res) => res.text())
    .then((text) => {
      const linhas = text
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"));
      if (!linhas.length) return;

      const escolhida = linhas[Math.floor(Math.random() * linhas.length)];
      const separador = " — ";
      const idx = escolhida.lastIndexOf(separador);
      const temAutor = idx > -1;
      const texto = temAutor ? escolhida.slice(0, idx).trim() : escolhida;
      const autor = temAutor ? escolhida.slice(idx + separador.length).trim() : null;

      el.innerHTML = autor
        ? `“${texto}” <span class="footer-quote-author">— ${autor}</span>`
        : `“${texto}”`;
    })
    .catch(() => {
      /* discreto por natureza — se falhar, a seção simplesmente não aparece */
    });
})();
