// ─── HYPR Geocodify — V360 Color Picker (Fase 10) ─────────────────────────
// Color picker custom pra escolher cor da marca.
// - Canvas saturation/value (140x140)
// - Hue bar horizontal
// - Hex input editável
// - 12 presets HYPR
// Persiste via window.V360Comp.updateBrandColor(brand, hex).
// ───────────────────────────────────────────────────────────────────────────

(function() {
  'use strict';

  // ─── Presets HYPR ─────────────────────────────────────────────────────────
  const PRESETS = [
    '#018376', // win HYPR
    '#4CB050', // win bright
    '#3397B9', // accent teal
    '#5DD6E6', // accent cyan
    '#5F25FF', // purple HYPR
    '#E89A28', // warm orange
    '#FFB347', // warm yellow
    '#FFD24A', // yellow
    '#F5272B', // lose
    '#FF5528', // lose bright
    '#B11C1F', // dark red
    '#78909C', // absent gray
  ];

  // ─── HSV ↔ HEX ────────────────────────────────────────────────────────────
  function hsvToRgb(h, s, v) {
    const c = v * s;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60)      { r = c; g = x; }
    else if (h < 120){ r = x; g = c; }
    else if (h < 180){ g = c; b = x; }
    else if (h < 240){ g = x; b = c; }
    else if (h < 300){ r = x; b = c; }
    else             { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  }

  function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    const s = max === 0 ? 0 : d / max;
    return [h, s, max];
  }

  function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('').toUpperCase();
  }

  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
    if (!m) return null;
    return [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  }

  function isValidHex(hex) { return !!hexToRgb(hex); }

  // ─── Open picker ──────────────────────────────────────────────────────────
  // anchor: elemento DOM ancora (chip da perspBar)
  // currentColor: hex atual
  // onApply: callback(newHex) ao confirmar
  function open(anchor, currentColor, onApply) {
    closeExisting();

    const startColor = isValidHex(currentColor) ? currentColor : '#3397B9';
    const [r0, g0, b0] = hexToRgb(startColor);
    let [hue, sat, val] = rgbToHsv(r0, g0, b0);

    // Popover container
    const pop = document.createElement('div');
    pop.className = 'v360-color-popover';
    pop.id = 'v360-color-popover';
    pop.innerHTML = `
      <div class="v360-color-popover-title">Cor da marca</div>
      <div class="v360-color-sv" id="vcp-sv"><div class="v360-color-sv-cursor" id="vcp-sv-cursor"></div></div>
      <div class="v360-color-hue" id="vcp-hue"><div class="v360-color-hue-cursor" id="vcp-hue-cursor"></div></div>
      <div class="v360-color-preview">
        <div class="v360-color-preview-swatch" id="vcp-swatch"></div>
        <input class="v360-color-preview-hex" id="vcp-hex" type="text" maxlength="7" />
      </div>
      <div class="v360-color-presets">
        ${PRESETS.map(c => `<button class="v360-color-preset" data-color="${c}" style="background:${c};" title="${c}"></button>`).join('')}
      </div>
      <div class="v360-color-actions">
        <button class="v360-color-btn" id="vcp-cancel">Cancelar</button>
        <button class="v360-color-btn v360-color-btn-primary" id="vcp-apply">Aplicar</button>
      </div>
    `;
    document.body.appendChild(pop);

    // Posicionar ancorado ao chip
    const rect = anchor.getBoundingClientRect();
    pop.style.top = (rect.bottom + 8) + 'px';
    pop.style.left = Math.max(8, Math.min(window.innerWidth - 260, rect.left)) + 'px';

    const sv = pop.querySelector('#vcp-sv');
    const svCursor = pop.querySelector('#vcp-sv-cursor');
    const hueBar = pop.querySelector('#vcp-hue');
    const hueCursor = pop.querySelector('#vcp-hue-cursor');
    const swatch = pop.querySelector('#vcp-swatch');
    const hexInput = pop.querySelector('#vcp-hex');

    function paintSV() {
      // Background: hue base, gradient white→hue horizontal e transparent→black vertical
      const [r, g, b] = hsvToRgb(hue, 1, 1);
      sv.style.background = `
        linear-gradient(to top, #000, transparent),
        linear-gradient(to right, #fff, rgb(${r},${g},${b}))
      `;
    }

    function updateAll() {
      const [r, g, b] = hsvToRgb(hue, sat, val);
      const hex = rgbToHex(r, g, b);
      swatch.style.background = hex;
      hexInput.value = hex;
      // Posiciona cursores
      svCursor.style.left = (sat * 100) + '%';
      svCursor.style.top = ((1 - val) * 100) + '%';
      hueCursor.style.left = (hue / 360 * 100) + '%';
    }

    paintSV();
    updateAll();

    // ─── SV (saturation × value) drag ───────────────────────────────────────
    function pickSV(e) {
      const r = sv.getBoundingClientRect();
      const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
      const y = Math.max(0, Math.min(r.height, e.clientY - r.top));
      sat = x / r.width;
      val = 1 - y / r.height;
      updateAll();
    }
    sv.addEventListener('mousedown', (e) => {
      pickSV(e);
      const onMove = (e) => pickSV(e);
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // ─── Hue drag ───────────────────────────────────────────────────────────
    function pickHue(e) {
      const r = hueBar.getBoundingClientRect();
      const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
      hue = (x / r.width) * 360;
      paintSV();
      updateAll();
    }
    hueBar.addEventListener('mousedown', (e) => {
      pickHue(e);
      const onMove = (e) => pickHue(e);
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    // ─── Hex input ──────────────────────────────────────────────────────────
    hexInput.addEventListener('input', () => {
      let val = hexInput.value.trim();
      if (!val.startsWith('#')) val = '#' + val;
      if (isValidHex(val)) {
        const [r, g, b] = hexToRgb(val);
        const [h, s, v] = rgbToHsv(r, g, b);
        hue = h; sat = s; val < 0.001 ? val = 1 : null;
        paintSV();
        updateAll();
      }
    });

    // ─── Presets ────────────────────────────────────────────────────────────
    pop.querySelectorAll('.v360-color-preset').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = btn.dataset.color;
        const [r, g, b] = hexToRgb(c);
        const [h, s, v] = rgbToHsv(r, g, b);
        hue = h; sat = s; val = v;
        paintSV();
        updateAll();
      });
    });

    // ─── Actions ────────────────────────────────────────────────────────────
    pop.querySelector('#vcp-cancel').addEventListener('click', closeExisting);
    pop.querySelector('#vcp-apply').addEventListener('click', () => {
      const finalHex = hexInput.value.trim();
      if (isValidHex(finalHex)) {
        try { onApply && onApply(finalHex); } catch(e) { console.warn('[vcp] apply:', e); }
      }
      closeExisting();
    });

    // ─── Close on outside click ─────────────────────────────────────────────
    setTimeout(() => {
      document.addEventListener('mousedown', onOutsideClick, true);
    }, 0);
    function onOutsideClick(e) {
      if (!pop.contains(e.target) && e.target !== anchor && !anchor.contains(e.target)) {
        closeExisting();
      }
    }
    pop._outsideHandler = onOutsideClick;

    // ESC fecha
    function onKey(e) {
      if (e.key === 'Escape') closeExisting();
    }
    document.addEventListener('keydown', onKey);
    pop._keyHandler = onKey;
  }

  function closeExisting() {
    const old = document.getElementById('v360-color-popover');
    if (!old) return;
    if (old._outsideHandler) {
      document.removeEventListener('mousedown', old._outsideHandler, true);
    }
    if (old._keyHandler) {
      document.removeEventListener('keydown', old._keyHandler);
    }
    old.remove();
  }

  // ─── API pública ──────────────────────────────────────────────────────────
  window.V360ColorPicker = {
    open,
    close: closeExisting,
    PRESETS,
    isValidHex,
  };

})();
