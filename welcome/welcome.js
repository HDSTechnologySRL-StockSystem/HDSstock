// ═══════════════════════════════════════════════════════
// src/welcome/welcome.js
// Pantalla splash de bienvenida.
// ═══════════════════════════════════════════════════════
'use strict';

let welcomeGone = false;

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
