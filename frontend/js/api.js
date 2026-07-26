/**
 * api.js — talks to the FastAPI backend.
 *
 * API_BASE_URL points at the Cloud Run service URL for now. Once the
 * custom domain is mapped in Phase 6 (e.g. api.filipomor.com), update
 * this single constant — nothing else in the codebase needs to change.
 */
const API_BASE_URL = "https://filipomor-backend-1081051154518.southamerica-east1.run.app";

async function checkApiHealth() {
  const statusEl = document.getElementById("api-status-text");
  if (!statusEl) return;
  try {
    const res = await fetch(`${API_BASE_URL}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    statusEl.innerHTML = `<span class="ok">API conectada — banco: ${data.database}</span>`;
  } catch (err) {
    statusEl.innerHTML = `<span class="fail">API indisponível (${err.message})</span>`;
  }
}

document.addEventListener("DOMContentLoaded", checkApiHealth);
