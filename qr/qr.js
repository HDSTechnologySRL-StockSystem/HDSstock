// ═══════════════════════════════════════════════════════
// src/qr/qr.js
// Modal QR + ficha de producto escaneado:
//   - openQR          (abre modal con datos y genera QR)
//   - closeQR         (cierra modal)
//   - getQRDataUrl    (genera PNG/URL del QR para impresión)
//   - _tryReadProductHash  (lee ?hash= de la URL al cargar)
//   - showProductCard (muestra ficha de lectura de QR)
// Depende de: QRCode (CDN), utils.js, constants.js,
//             auth.js (canAccess), shared/toast.js
// ═══════════════════════════════════════════════════════
'use strict';

let _qrInstance = null;
let _qrData     = null;

function openQR({ nombre, cant, unidad, spec, repisa, armario, nave, fecha, precio }) {
  if (!canAccess('verQR')) {
    showToast({ type:'danger', title:'Sin permiso', msg:'No tenés permiso para ver el QR de productos.' }); return;
  }
  _qrData = { nombre, cant, unidad, spec, repisa, armario, nave, fecha, precio };

  // qr-pname usa textContent (seguro de por sí); el resto va por innerHTML, así que sanitizamos
  DOM.get('qr-pname').textContent = nombre;
  DOM.get('qr-meta-row').innerHTML = `
    <span class="qr-tag">${esc(nave)} · ${esc(armario)} · ${esc(repisa)}</span>
    <span class="qr-tag green">${esc(cant)} ${esc(unidad)}</span>
    ${spec && spec !== '—' ? `<span class="qr-tag">${esc(spec)}</span>` : ''}`;
  DOM.get('qr-label-strip').innerHTML = `
    <div class="qr-label-row"><span>Producto</span><span>${esc(nombre)}</span></div>
    <div class="qr-label-row"><span>Nave</span><span>${esc(nave)}</span></div>
    <div class="qr-label-row"><span>Armario</span><span>${esc(armario)}</span></div>
    <div class="qr-label-row"><span>Repisa</span><span>${esc(repisa)}</span></div>
    <div class="qr-label-row"><span>Cantidad</span><span>${esc(cant)} ${esc(unidad)}</span></div>
    ${spec && spec !== '—' ? `<div class="qr-label-row"><span>Especif.</span><span>${esc(spec)}</span></div>` : ''}
    ${precio != null && precio > 0 ? `<div class="qr-label-row"><span>Precio unit.</span><span>$ ${Number(precio).toLocaleString('es-AR', {minimumFractionDigits:2})}</span></div>` : ''}
    <div class="qr-label-row"><span>Fecha ingreso</span><span>${esc(fecha)}</span></div>`;

  // Base64-encode payload — avoids ALL URL encoding issues across browsers/OS
  const payload = btoa(unescape(encodeURIComponent(JSON.stringify({
    nombre, cant, unidad,
    spec: spec || '—',
    repisa, armario, nave, fecha
  }))));
  const base  = window.location.href.split('#')[0];
  const qrUrl = base + '#hds=' + payload;
  _qrData._url = qrUrl;

  const inner = document.getElementById('qr-canvas-inner');
  inner.innerHTML = '';
  if (_qrInstance) { try { _qrInstance.clear(); } catch(e) {} _qrInstance = null; }
  DOM.get('qr-modal').classList.add('on');

  requestAnimationFrame(() => setTimeout(() => {
    try {
      _qrInstance = new QRCode(inner, {
        text: qrUrl,
        width: 180, height: 180,
        colorDark: '#000000', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M,
      });
    } catch(e) {
      inner.innerHTML = `<div style="color:#e84b4b;font-size:11px;padding:8px">Error QR: ${e.message}</div>`;
    }
  }, 80));
}

function closeQR() {
  DOM.get('qr-modal').classList.remove('on');
}

// ── Hash detection — works on cold open from celular ─────────────────────────
function _tryReadProductHash() {
  const raw = window.location.hash || '';
  if (!raw.includes('hds=')) return;
  let data = null;
  try {
    const b64  = raw.split('hds=')[1];
    if (!b64) return;
    const json = decodeURIComponent(escape(atob(b64)));
    data = JSON.parse(json);
  } catch(err) {
    console.warn('[QR] decode error:', err);
    return;
  }
  if (!data || !data.nombre) return;
  showProductCard(data);
}

// Run early — no DOMContentLoaded needed since data is self-contained
setTimeout(_tryReadProductHash, 50);
window.addEventListener('hashchange', _tryReadProductHash);

// ── Product card — full screen ───────────────────────────────────────────────
function showProductCard(data) {
  DOM.get('qr-product-card')?.remove();

  // Destructure with safe defaults
  const nombre  = data.nombre  || '';
  const cant    = data.cant    != null ? data.cant : '?';
  const unidad  = data.unidad  || 'UN';
  const spec    = data.spec    || '—';
  const repisa  = data.repisa  || '';
  const armario = data.armario || '';
  const nave    = data.nave    || '';
  const fecha   = data.fecha   || '';

  // Try live stock from CELLS (works if app was already running)
  let liveCant   = parseInt(cant) || 0;
  let liveSpec   = spec;
  let otherItems = [];
  try {
    const nk  = nave === 'N-1' ? 'n1' : nave === 'N-2' ? 'n2' : String(nave).toLowerCase();
    const rep = (typeof CELLS !== 'undefined') && CELLS[nk]?.[armario]?.repisas?.[repisa];
    if (rep) {
      const found = rep.items.find(i => i.n === nombre);
      if (found) { liveCant = found.q; liveSpec = found.s || spec; }
      otherItems = rep.items.filter(i => i.n !== nombre);
    }
  } catch(e) { /* use hash data */ }

  const cls   = liveCant <= 2 ? 'critico' : liveCant <= 5 ? 'bajo' : 'ok';
  const col   = { ok:'#16A35A', bajo:'#E8902A', critico:'#E5484D' }[cls];
  const lbl   = { ok:'STOCK OK', bajo:'STOCK BAJO', critico:'STOCK CRÍTICO' }[cls];

  const othersHTML = otherItems.length ? `
    <div class="pc-section-title">TAMBIÉN EN ${repisa}</div>
    <div class="pc-other-list">
      ${otherItems.map(i => {
        const ic = i.q<=2?'#e84b4b':i.q<=5?'#e8a23a':'#3dbf7e';
        return `<div class="pc-other-row">
          <span class="pc-other-name">${i.n}${i.s&&i.s!=='—'?` <span class="pc-other-spec">· ${i.s}</span>`:''}</span>
          <span class="pc-other-qty" style="color:${ic}">${i.q} ${i.u}</span>
        </div>`;
      }).join('')}
    </div>` : '';

  const dismiss = `DOM.get('qr-product-card').remove();history.replaceState(null,'',location.pathname+location.search)`;

  const el = document.createElement('div');
  el.id = 'qr-product-card';
  el.innerHTML = `
<style>
#qr-product-card{position:fixed;inset:0;z-index:2000;background:#E8EAEE;display:flex;flex-direction:column;font-family:'Inter',sans-serif;overflow-y:auto;-webkit-overflow-scrolling:touch}
#qr-product-card *{box-sizing:border-box;margin:0;padding:0}
.pc-topbar{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;background:#fff;border-bottom:1px solid rgba(11,28,63,.08)}
.pc-logo{font-size:10px;letter-spacing:3px;text-transform:uppercase;color:rgba(11,28,63,.4)}
.pc-x{width:34px;height:34px;border-radius:50%;border:1.5px solid rgba(11,28,63,.14);background:none;color:rgba(11,28,63,.5);font-size:16px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.pc-hero{padding:22px 18px 14px}
.pc-status{display:inline-flex;align-items:center;gap:7px;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;padding:5px 14px;border-radius:20px;margin-bottom:14px}
.pc-status.ok{background:rgba(22,163,90,.1);color:#16A35A;border:1.5px solid rgba(22,163,90,.28)}
.pc-status.bajo{background:rgba(232,144,42,.1);color:#E8902A;border:1.5px solid rgba(232,144,42,.3)}
.pc-status.critico{background:rgba(229,72,77,.1);color:#E5484D;border:1.5px solid rgba(229,72,77,.3)}
.pc-name{font-family:'Sora',sans-serif;font-size:32px;font-weight:700;letter-spacing:-.3px;color:#000E2B;line-height:1.1;margin-bottom:6px}
.pc-spec-txt{font-size:15px;color:rgba(11,28,63,.5);letter-spacing:.3px}
.pc-stock{margin:0 18px 14px;border-radius:16px;padding:18px 20px;display:flex;align-items:center;justify-content:space-between;background:#fff}
.pc-stock.ok{border:1.5px solid rgba(22,163,90,.3)}
.pc-stock.bajo{border:1.5px solid rgba(232,144,42,.35)}
.pc-stock.critico{border:1.5px solid rgba(229,72,77,.38)}
.pc-stock-lbl{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(11,28,63,.4);margin-bottom:6px}
.pc-stock-num{font-family:'Sora',sans-serif;font-size:52px;font-weight:700;line-height:1;letter-spacing:-1px}
.pc-stock-u{font-size:18px;font-weight:400;opacity:.5;margin-left:6px}
.pc-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:0 18px 14px}
.pc-tile{background:#fff;border:1.5px solid rgba(11,28,63,.08);border-radius:14px;padding:14px}
.pc-tile.full{grid-column:1/-1}
.pc-tile.muted{background:#F3F5F9;border-color:rgba(11,28,63,.06)}
.pc-tile-lbl{font-size:9px;letter-spacing:2px;text-transform:uppercase;color:rgba(11,28,63,.4);margin-bottom:6px}
.pc-tile-val{font-family:'Sora',sans-serif;font-size:21px;font-weight:700;color:#000E2B}
.pc-section-title{font-size:9px;letter-spacing:2.5px;text-transform:uppercase;color:rgba(11,28,63,.35);padding:6px 18px 6px}
.pc-other-list{padding:0 18px;display:flex;flex-direction:column;gap:4px;margin-bottom:10px}
.pc-other-row{display:flex;justify-content:space-between;align-items:center;padding:11px 14px;background:#fff;border:1px solid rgba(11,28,63,.07);border-radius:11px}
.pc-other-name{font-size:14px;font-weight:700;color:#0B1C3F}
.pc-other-spec{font-weight:400;color:rgba(11,28,63,.4)}
.pc-other-qty{font-size:14px;font-weight:700}
.pc-footer{padding:14px 18px 36px;margin-top:auto}
.pc-back{width:100%;font-family:'Inter',sans-serif;font-size:12px;font-weight:700;letter-spacing:1px;text-transform:uppercase;padding:15px;border-radius:14px;cursor:pointer;border:none;background:#0D63EA;color:#fff;box-shadow:0 6px 16px rgba(13,99,234,.3)}
</style>

<div class="pc-topbar">
  <div class="pc-logo">HDS · Sistema de Stock</div>
  <button class="pc-x" onclick="${dismiss}">✕</button>
</div>

<div class="pc-hero">
  <div class="pc-status ${cls}">● ${lbl}</div>
  <div class="pc-name">${nombre}</div>
  ${liveSpec && liveSpec !== '—' ? `<div class="pc-spec-txt">${liveSpec}</div>` : ''}
</div>

<div class="pc-stock ${cls}">
  <div>
    <div class="pc-stock-lbl">Stock disponible</div>
    <div class="pc-stock-num" style="color:${col}">${liveCant}<span class="pc-stock-u">${unidad}</span></div>
  </div>
  <svg viewBox="0 0 24 24" style="width:54px;height:54px;stroke:${col};fill:none;stroke-width:1.2;opacity:.28;flex-shrink:0">
    <path stroke-linecap="round" stroke-linejoin="round" d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/>
    <polyline stroke-linecap="round" stroke-linejoin="round" points="3.27 6.96 12 12.01 20.73 6.96"/>
    <line stroke-linecap="round" x1="12" y1="22.08" x2="12" y2="12"/>
  </svg>
</div>

<div class="pc-grid">
  <div class="pc-tile"><div class="pc-tile-lbl">Nave</div><div class="pc-tile-val">${nave}</div></div>
  <div class="pc-tile"><div class="pc-tile-lbl">Armario</div><div class="pc-tile-val">${armario}</div></div>
  <div class="pc-tile full"><div class="pc-tile-lbl">Repisa</div><div class="pc-tile-val">${repisa}</div></div>
  ${fecha ? `<div class="pc-tile muted full"><div class="pc-tile-lbl">Fecha de ingreso</div><div class="pc-tile-val" style="font-size:17px">${fecha}</div></div>` : ''}
</div>

${othersHTML}

<div class="pc-footer">
  <button class="pc-back" onclick="${dismiss}">← Volver al sistema</button>
</div>
  `;
  document.body.appendChild(el);
}
function getQRDataUrl() {
  return new Promise((resolve) => {
    // Retry up to 10 times with 80ms gap to wait for QRCode.js to render
    let attempts = 0;
    const try_ = () => {
      const el = getQRCanvas();
      if (el) {
        let dataUrl;
        if (el.tagName === 'CANVAS') {
          dataUrl = el.toDataURL('image/png');
        } else {
          const c = document.createElement('canvas');
          c.width  = el.naturalWidth  || 180;
          c.height = el.naturalHeight || 180;
          const ctx = c.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(el, 0, 0);
          dataUrl = c.toDataURL('image/png');
        }
        resolve(dataUrl);
      } else if (attempts++ < 10) {
        setTimeout(try_, 100);
      } else {
        resolve(null);
      }
    };
    try_();
  });
}

async function exportQR() {
  const { nombre, armario, repisa, nave } = _qrData;
  const dataUrl = await getQRDataUrl();
  if (!dataUrl) { showToast({ type:'danger', title:'Error', msg:'No se pudo generar el QR. Intentá de nuevo.' }); return; }
  const a = document.createElement('a');
  a.href     = dataUrl;
  a.download = `QR_${nave}_${armario}_${repisa}_${nombre.replace(/\s+/g,'_')}.png`;
  a.click();
}

async function printQR() {
  const { nombre, cant, unidad, spec, repisa, armario, nave, fecha } = _qrData;
  const imgSrc = await getQRDataUrl();
  if (!imgSrc) { showToast({ type:'danger', title:'Error', msg:'No se pudo generar el QR para imprimir.' }); return; }

  const rows = [
    ['Producto', nombre],
    ['Ubicación', `${nave} / ${armario} / ${repisa}`],
    ['Cantidad', `${cant} ${unidad}`],
    ...(spec !== '—' ? [['Especif.', spec]] : []),
    ['Fecha', fecha],
  ].map(([k,v]) => `
    <tr>
      <td style="color:#888;font-size:11px;letter-spacing:1px;text-transform:uppercase;padding:3px 8px 3px 0;white-space:nowrap">${k}</td>
      <td style="font-weight:700;font-size:13px;letter-spacing:.5px;padding:3px 0">${v}</td>
    </tr>`).join('');

  const win = window.open('', '_blank', 'width=420,height=560');
  win.document.write(`<!DOCTYPE html>
<html><head><meta charset="UTF-8"/>
<title>QR — ${nombre}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Barlow Condensed',Arial,sans-serif;background:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
  .card{border:2px solid #1a1a2e;border-radius:12px;padding:20px 24px;width:320px;display:flex;flex-direction:column;align-items:center;gap:14px}
  .hds-logo{font-size:11px;letter-spacing:4px;color:#555;text-transform:uppercase;font-weight:700;align-self:flex-start}
  .prod-name{font-size:22px;font-weight:700;letter-spacing:2px;color:#0a0a1a;align-self:flex-start;line-height:1.2;word-break:break-word}
  .qr-img{border:1px solid #eee;border-radius:6px;padding:8px}
  table{align-self:stretch;border-collapse:collapse}
  .footer{font-size:9px;letter-spacing:1.5px;color:#bbb;text-transform:uppercase;align-self:flex-start}
  @media print{body{padding:0}@page{margin:8mm}}
</style>
</head><body>
<div class="card">
  <div class="hds-logo">HDS · Sistema de Stock</div>
  <div class="prod-name">${nombre}</div>
  <img class="qr-img" src="${imgSrc}" width="180" height="180" alt="QR"/>
  <table>${rows}</table>
  <div class="footer">Generado ${new Date().toLocaleString('es-AR')}</div>
</div>
<script>window.onload=function(){window.print();}<\/script>
</body></html>`);
  win.document.close();
}

// ── SAVE: SUMAR ──────────────────────────────────────────────────────────────
function saveSumar() {
  const usr   = currentSignature();
  const val   = document.getElementById('fs-prod')?.value || '';
  const cant  = parseInt(document.getElementById('fs-cant')?.value) || 0;
  const fecha = document.getElementById('fs-fecha')?.value || localToday();
  const errEl = document.getElementById('fs-err');

  if (!val || cant < 1) {
    if (errEl) { errEl.textContent = 'Completá producto y cantidad'; errEl.style.display = 'block'; }
    return;
  }
  if (errEl) errEl.style.display = 'none';

  const [repisa, idxStr] = val.split('|');
  const idx  = parseInt(idxStr);
  const cell = CELLS[POP.nave][POP.cellId];
  const item = cell.repisas[repisa]?.items[idx];

  if (!item) {
    if (errEl) { errEl.textContent = 'Producto no encontrado'; errEl.style.display = 'block'; }
    return;
  }

  item.q += cant;
  saveCells();
  StockBus.emit('ingreso', { item, cantidad: cant, cid: POP.cellId, rid: repisa, nave: POP.nave, precio: item.precio || null });

  closeFloatForm();
  selectRep(repisa, POP.nave, POP.cellId, POP.el);
}

// ── CLOSE POPUP ──────────────────────────────────────────────────────────────
