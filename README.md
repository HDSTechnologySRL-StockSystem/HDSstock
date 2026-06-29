# HDS Stock v2.9 — Arquitectura Modular

## Cómo ejecutar

> **Importante:** los módulos JS usan `<script src="">` clásico (no ES Modules),
> por lo que **se puede abrir `index.html` directamente con el navegador** (`file://`).
> Para desarrollo con hot-reload: usá VS Code Live Server o `npx serve .`

```bash
# Opción 1 — VS Code Live Server (recomendado)
# Click derecho en index.html → "Open with Live Server"

# Opción 2 — npx
npx serve .

# Opción 3 — Python
python -m http.server 5500
```

---

## Estructura de carpetas

```
hdstock/
├── index.html                    ← Entry point: carga CSS + JS + HTML inline
│
└── src/
    ├── core/                     ← Núcleo (sin dependencias de módulos)
    │   ├── constants.js          ← HDS_VERSION, LS_KEYS, ROLES, SEDES, PERMS_CATALOG,
    │   │                           GRID, SHELF_MIN, STOCK_MIN_DEFAULT, PIE_PALETTE, etc.
    │   ├── storage.js            ← Todo localStorage: loadUsers/saveCells/loadMovs/etc.
    │   ├── utils.js              ← esc(), fechas, DOM.get(), naveLbl(), cssAttr(), etc.
    │   ├── auth.js               ← currentUser/Rol/Sede, canAccess(), _seedAdminIfNeeded()
    │   ├── router.js             ← go(), goInicio(), switchNave()
    │   ├── stockBus.js           ← StockBus.emit() — bus de eventos de stock
    │   └── bootstrap.js         ← Inicialización: seed → tema → datos → sesión → pantalla
    │
    ├── shared/                   ← Componentes transversales
    │   ├── styles/
    │   │   ├── tokens.css        ← Variables CSS (:root), reset, tipografía
    │   │   ├── layout.css        ← Topbar, bottomnav, pills, toast, chips, nav-badge
    │   │   ├── theme.css         ← Glassmorphism + modo oscuro (body.dark)
    │   │   └── responsive.css    ← Breakpoints: móvil / tablet / desktop / touch
    │   ├── toast.js              ← showToast({ type, title, msg, ... })
    │   ├── theme.js              ← applyTheme(), toggleTheme()
    │   ├── a11y.js               ← enhanceA11y(): role=button en SVG, tabindex
    │   └── search.js             ← Modal búsqueda global Ctrl+K
    │
    ├── welcome/                  ← Splash de bienvenida
    │   ├── welcome.html          ← #sc-welcome con imagen base64
    │   ├── welcome.css           ← Animaciones del splash
    │   └── welcome.js            ← dismissWelcome()
    │
    ├── login/                    ← Autenticación y acceso
    │   ├── login.html            ← #sc-login: form de ingreso/registro
    │   ├── reset.html            ← #reset-overlay: recuperar contraseña
    │   ├── login.css             ← Estilos: card, inputs, pending, reset
    │   └── login.js              ← loginSubmit(), loginToggleMode(), logout(),
    │                               updateUserChip(), setSede(), sendVerificationCode(),
    │                               openForgotPassword(), resetStep1/2/3Submit()
    │
    ├── home/                     ← Pantalla de inicio
    │   ├── home.html             ← #sc-home: selector de nave + búsqueda
    │   ├── home.css              ← Estilos: nave-card, logo-row
    │   └── home.js               ← (sin lógica propia — todo via go() y updateUserChip())
    │
    ├── mapa_n1/                  ← Plano Nave 1
    │   ├── mapa_n1.html          ← #sc-n1: SVG del plano N1
    │   ├── mapa.css              ← Estilos: celdas SVG, popup, paneles, FAB, shelf menus
    │   └── mapa_n1.js            ← applyNaveNames(), openRenameNave(), applyShelfName()
    │
    ├── mapa_n2/                  ← Plano Nave 2
    │   ├── mapa_n2.html          ← #sc-n2: SVG del plano N2
    │   ├── mapa.css              ← (copia de mapa_n1/mapa.css)
    │   └── mapa_n2.js            ← (sin funciones exclusivas)
    │
    ├── stock/                    ← Gestión de inventario
    │   ├── stock.html            ← #sc-stock: Stock General (listado)
    │   ├── modales.html          ← Modales: nueva estantería, nuevo producto,
    │   │                           sumar stock, sede, producto detail
    │   ├── stock.css             ← Estilos: Stock General (stk-*)
    │   ├── stockData.js          ← CELLS[], cellClick(), closePopup(), loadCellsInto()
    │   ├── shelfNames.js         ← getShelfName/setShelfName, applyShelfName/openRenameShelf
    │   ├── shelfWindow.js        ← Ventanas flotantes drag&drop de estante
    │   ├── shelfEditor.js        ← Mover/rotar/color/borrar/resize/FAB/snap-grid
    │   ├── productForms.js       ← Formularios popup: nuevo/sumar/editar, selectRep,
    │   │                           saveRepCat, inlineSaveAll, inlineDeleteItem
    │   ├── productDetail.js      ← Modal ficha de producto, pdAccion, pdGuardarPrecio,
    │   │                           np*/ss* helpers para modales de nuevo/sumar
    │   └── stock.js              ← Vista Stock General: renderStock(), stockSearch(), etc.
    │
    ├── movimientos/              ← Historial de movimientos
    │   ├── movimientos.html      ← #sc-mov: tabla + filtros de tipo
    │   ├── movimientos.css       ← Estilos: tabla, badges ing/egr/edit, modal limpiar
    │   └── movimientos.js        ← logMov/logMovConPrecio/logEdicion,
    │                               StockBus, renderMov, setMovTipo,
    │                               openDeleteMovsModal/confirmDeleteMovs
    │
    ├── peticiones/               ← Solicitudes de compra
    │   ├── peticiones.html       ← #sc-pet + modal petModal
    │   ├── peticiones.css        ← Estilos: pet-card, estado (pend/aprobada/rechazada)
    │   └── peticiones.js         ← renderPet, savePeticion, petOk/petReject/petDel,
    │                               updateNavBadges, checkStockLow, checkDeadlines
    │
    ├── balances/                 ← Estadísticas y contabilidad
    │   ├── balances.html         ← #sc-bal: KPIs + cards
    │   ├── balances.css          ← Estilos: kpi, bal-card, bar-row, pie chart
    │   └── balances.js           ← renderBal, buildBienCard, buildPieCard,
    │                               buildYearMinCard, saveYearMinSnapshot, repCatIndex
    │
    ├── usuarios/                 ← Gestión de usuarios (Admin)
    │   ├── usuarios.html         ← #sc-users + #profile-overlay
    │   ├── usuarios.css          ← Estilos: usr-card, presets, perm-groups acordeón
    │   └── usuarios.js           ← renderUsersPanel, approveUser, toggleUserPerm,
    │                               applyUserPreset, togglePermGroup(All),
    │                               surfaceAccessRequests, updateUsersBadge,
    │                               openMyProfile, saveProfileBasics/Mail/Password
    │
    ├── qr/                       ← Modal QR y ficha de producto escaneado
    │   ├── qr.html               ← #qr-modal
    │   ├── qr.css                ← Estilos: qr-box, qr-label-strip
    │   └── qr.js                 ← openQR, closeQR, getQRDataUrl,
    │                               _tryReadProductHash, showProductCard
    │
    └── search/                   ← Búsqueda global
        ├── search.html           ← #search-modal
        ├── search.css            ← Estilos: search-box, search-result, sr-*
        └── search.js             ← openSearch, doSearch, selectSearchResult,
                                    searchKeyNav (en shared/search.js)
```

---

## Flujo de dependencias (orden de carga en index.html)

```
constants.js          (sin deps)
storage.js            (constants.js)
utils.js              (sin deps)
auth.js               (constants.js, storage.js)
router.js             (auth.js, toast.js, módulos de render)
─────────────────────────────────────────────────
toast.js              (sin deps)
theme.js              (storage.js)
a11y.js               (sin deps)
search.js             (CELLS, go(), selectRep())
─────────────────────────────────────────────────
login.js              (auth.js, storage.js, utils.js, toast.js, router.js)
─────────────────────────────────────────────────
stockData.js          (CELLS, constants.js, storage.js, auth.js)
shelfNames.js         (storage.js)
shelfWindow.js        (CELLS, stockData.js, stockBus.js, auth.js)
stockBus.js           (movimientos.js, storage.js)   ← después de shelfWindow
shelfEditor.js        (CELLS, constants.js, auth.js, shelfNames.js, stockData.js)
productForms.js       (CELLS, stockBus.js, auth.js, movimientos.js)
productDetail.js      (CELLS, stockBus.js, qr.js, auth.js)
stock.js              (CELLS, constants.js, storage.js)
─────────────────────────────────────────────────
movimientos.js        (storage.js, utils.js, auth.js, toast.js, constants.js)
peticiones.js         (storage.js, auth.js, utils.js, toast.js, movimientos.js)
balances.js           (CELLS, movs, storage.js, utils.js, constants.js)
usuarios.js           (auth.js, storage.js, utils.js, constants.js, toast.js)
qr.js                 (utils.js, constants.js, auth.js, toast.js)
─────────────────────────────────────────────────
mapa_n1.js            (storage.js, shelfNames.js)
mapa_n2.js            (ninguna exclusiva)
welcome.js            (sin deps)
─────────────────────────────────────────────────
bootstrap.js          (todos los anteriores)
```

---

## Credenciales por defecto

| Usuario | Contraseña | Rol |
|---|---|---|
| `ADMIN` | `admin1234` | Administrador |

Cambiar desde **Mi Perfil** tras el primer ingreso.

---

## Configuración de email (recuperar contraseña)

Editar `src/core/constants.js`:

```js
const HDS_EMAIL_CONFIG = {
  provider:         'emailjs',          // 'console' | 'emailjs' | 'custom'
  emailjsServiceId:  'TU_SERVICE_ID',
  emailjsTemplateId: 'TU_TEMPLATE_ID',
  emailjsPublicKey:  'TU_PUBLIC_KEY',
  // Para provider:'custom':
  customEndpoint:   'https://tu-api.com/send-code',
};
```

Con `provider: 'console'` (por defecto) el código se muestra en la consola del navegador (F12).
