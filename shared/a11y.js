// ═══════════════════════════════════════════════════════
// src/shared/a11y.js
// Accesibilidad: role=button en elementos SVG, tabindex.
// ═══════════════════════════════════════════════════════
'use strict';

function enhanceA11y(root) {
  const scope = root || document;
  // Celdas del plano SVG (estantes)
  scope.querySelectorAll('.cell[onclick]:not([role])').forEach(function(el) {
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    const id = el.dataset.id || '';
    el.setAttribute('aria-label', 'Armario ' + id + ', ver contenido');
  });
  // Tarjetas de selección de nave / accesos rápidos en Inicio
  scope.querySelectorAll('.nave-card[onclick]:not([role])').forEach(function(el) {
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
  });
}

// Delegación de eventos: un único listener en document maneja Enter/Espacio
// para CUALQUIER elemento con role="button" (incluye los agregados arriba
// y los que se agreguen después dinámicamente), sin tener que registrar
// un listener de teclado por cada celda individual.
document.addEventListener('keydown', function(e) {
  if (e.key !== 'Enter' && e.key !== ' ') return;
  const target = e.target.closest('[role="button"][tabindex]');
  if (!target) return;
  // Evitar que Espacio scrollee la página al activar el botón virtual
  e.preventDefault();
  target.click();
});

// ════════════════════════════════════════════════
// SEED — cuenta Administrador por defecto
// Se ejecuta UNA sola vez al primer arranque.
// Credenciales: usuario ADMIN / contraseña admin1234
// Cambiálas desde "Mi Perfil" después del primer ingreso.
