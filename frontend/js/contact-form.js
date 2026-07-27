/**
 * contact-form.js — submits the contact form to the backend via fetch
 * (rather than a normal HTML form POST), so we can show a success/error
 * message inline without leaving the page.
 */
(function () {
  const form = document.getElementById("contact-form");
  if (!form) return;

  const statusEl = document.getElementById("form-status");
  const submitBtn = document.getElementById("submit-btn");

  function showStatus(kind, message) {
    statusEl.className = "form-status " + kind;
    statusEl.textContent = message;
  }

  function getTurnstileToken() {
    const input = form.querySelector('[name="cf-turnstile-response"]');
    return input ? input.value : "";
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    const turnstileToken = getTurnstileToken();
    if (!turnstileToken) {
      showStatus("error", "Confirme que você não é um robô antes de enviar.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "ENVIANDO...";
    statusEl.className = "form-status";

    const payload = {
      name: form.name.value,
      email: form.email.value,
      message: form.message.value,
      turnstile_token: turnstileToken,
    };

    try {
      const res = await fetch(`${API_BASE_URL}/contact/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("request failed");

      showStatus("success", "Mensagem enviada! Retorno em breve.");
      form.reset();
      if (window.turnstile) window.turnstile.reset();
    } catch (err) {
      showStatus("error", "Não foi possível enviar agora. Tenta de novo em instantes, ou usa o LinkedIn.");
      if (window.turnstile) window.turnstile.reset();
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = "ENVIAR MENSAGEM";
    }
  });
})();
