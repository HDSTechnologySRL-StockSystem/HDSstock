// ═══════════════════════════════════════════════════════
// src/shared/toast.js
// Sistema de notificaciones toast. Sin dependencias.
// ═══════════════════════════════════════════════════════
'use strict';


  function legendItem(label, display, i) {
    return '<div style="display:flex;align-items:center;gap:7px;margin-bottom:5px">'
      + '<span style="width:11px;height:11px;border-radius:3px;flex-shrink:0;background:'+PIE_PALETTE[i%PIE_PALETTE.length]+'"></span>'
      + '<span style="font-size:11px;font-weight:600;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)">'+esc(label)+'</span>'
      + '<span style="font-size:11px;font-weight:700;color:var(--muted)">'+esc(String(display))+'</span>'
      + '</div>';
  }

  const legU = cats.map(function([k,v],i){ return legendItem(k, v.u.toLocaleString('es-AR')+' u', i); }).join('');
  const legV = catsV.length ? catsV.map(function([k,v],i){ return legendItem(k, fmtM(v.v), i); }).join('') : '';

  const btnStyle = 'font-family:inherit;font-size:10px;font-weight:700;padding:3px 10px;border-radius:20px;cursor:pointer;';
  const btnOn    = btnStyle+'border:none;background:var(--accent);color:#fff';
  const btnOff   = btnStyle+'border:1px solid var(--border2);background:var(--surface2);color:var(--muted)';

  return '<div class="bal-card">'
    + '<div class="bal-card-head">'
    +   '<div class="bal-card-title">Distribución por categoría</div>'
    +   '<div style="display:flex;gap:6px">'
    +     '<button id="pie-btn-u" style="'+btnOn+'" onclick="setPieMode(&apos;u&apos;)">Unidades</button>'
    +     (svgV ? '<button id="pie-btn-v" style="'+btnOff+'" onclick="setPieMode(&apos;v&apos;)">Valor $</button>' : '')
    +   '</div>'
    + '</div>'
    + '<div class="pie-body">'
    +   '<div class="pie-media">'
    +     '<svg id="pie-svg-u" viewBox="0 0 180 180" width="180" height="180">'+svgU+'</svg>'
    +     (svgV ? '<svg id="pie-svg-v" viewBox="0 0 180 180" width="180" height="180" style="display:none">'+svgV+'</svg>' : '')
    +   '</div>'
    +   '<div class="pie-legend">'
    +     '<div id="pie-leg-u">'+legU+'</div>'
    +     (legV ? '<div id="pie-leg-v" style="display:none">'+legV+'</div>' : '')
    +     '<div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">'
    +       '<span id="pie-total" style="font-size:11px;font-weight:700;color:var(--muted)">Total: '+totalU.toLocaleString('es-AR')+' u</span>'
    +     '</div>'
    +   '</div>'
