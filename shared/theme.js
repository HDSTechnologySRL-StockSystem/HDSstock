// ═══════════════════════════════════════════════════════
// src/shared/theme.js
// Toggle modo oscuro/claro + persistencia localStorage.
// ═══════════════════════════════════════════════════════
'use strict';

let welcomeGone = false;
function dismissWelcome() {
  if (welcomeGone) return;
  welcomeGone = true;
  const w = document.getElementById('sc-welcome');
  if (!w) return;
  w.classList.add('lift');
  setTimeout(() => {
    w.style.display = 'none';
    const u = DOM.get('li-usr');
    if (u && !currentUser) u.focus();
  }, 950);
}
// ── Modo oscuro ──────────────────────────────────────────────────────────────
function applyTheme(isDark) {
  document.body.classList.toggle('dark', !!isDark);
  const btn = DOM.get('theme-toggle');
  if (btn) btn.textContent = isDark ? '☀️' : '🌙';
}
function toggleTheme() {
  const isDark = !document.body.classList.contains('dark');
  applyTheme(isDark);
  try { localStorage.setItem('hds_theme', isDark ? 'dark' : 'light'); } catch {}
}

// ════════════════════════════════════════════════
// BOOTSTRAP — restaura datos, sesión, estanterías y tema al abrir
// ════════════════════════════════════════════════
// ════════════════════════════════════════════════
// ACCESIBILIDAD (a11y) — celdas SVG y elementos custom
// ════════════════════════════════════════════════
// enhanceA11y(): recorre los elementos interactivos custom (celdas <g
// class="cell">, nave-card, etc.) que tienen onclick pero no son <button>
// nativos, y les agrega role="button" + tabindex="0" para que lectores
// de pantalla los anuncien como botones y se puedan navegar con Tab.
// Se ejecuta una vez al bootstrap (cubre los 37 estantes del plano SVG
// más las tarjetas de selección de nave) y de nuevo cada vez que se
// dibuja un estante nuevo dinámicamente (ver drawShelfNode).
