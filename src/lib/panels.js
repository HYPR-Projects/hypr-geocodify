// ─── Painéis ────────────────────────────────────────────────────────────────
// Resize, collapse, fullmap, tab system. Persistência em localStorage.

let _map = null;

function getMap() { return _map || window.map; }

export function setPanelsMap(mapRef) { _map = mapRef; }

export function setTab(name) {
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.panel-tab-content').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + name)?.classList.add('active');
  document.getElementById('tc-' + name)?.classList.add('active');
}

export function initResizablePanels() {
  try {
    const sw = localStorage.getItem('hypr_sidebar_w');
    const pw = localStorage.getItem('hypr_panel_w');
    if (sw) document.getElementById('sidebar').style.width = sw;
    if (pw) document.getElementById('right-panel').style.width = pw;
  } catch {}

  setupResizer('sidebar-resizer', 'sidebar', 'right', 160, 420, 'hypr_sidebar_w');
  setupResizer('panel-resizer', 'right-panel', 'left', 200, 520, 'hypr_panel_w');
}

export function toggleFullMap() {
  const app = document.getElementById('app');
  const btn = document.getElementById('btn-fullmap');
  const isFullMap = app.classList.toggle('map-only');
  if (btn) {
    btn.classList.toggle('active', isFullMap);
    btn.innerHTML = isFullMap
      ? '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg> Recolher'
      : '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg> Expandir';
  }
  try { localStorage.setItem('hypr_fullmap', isFullMap); } catch {}
  setTimeout(() => getMap()?.resize(), 250);
}

export function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  const btn = document.getElementById('sidebar-collapse');
  const collapsed = sidebar.classList.toggle('collapsed');
  if (btn) btn.textContent = collapsed ? '›' : '‹';
  try { localStorage.setItem('hypr_sidebar_collapsed', collapsed); } catch {}
  setTimeout(() => getMap()?.resize(), 220);
}

export function togglePanel() {
  const panel = document.getElementById('right-panel');
  const btn = document.getElementById('panel-collapse');
  const collapsed = panel.classList.toggle('collapsed');
  if (btn) btn.textContent = collapsed ? '‹' : '›';
  try { localStorage.setItem('hypr_panel_collapsed', collapsed); } catch {}
  setTimeout(() => getMap()?.resize(), 220);
}

function setupResizer(handleId, panelId, direction, minW, maxW, storageKey) {
  const handle = document.getElementById(handleId);
  const panel = document.getElementById(panelId);
  if (!handle || !panel) return;

  handle.addEventListener('mousedown', e => {
    const startX = e.clientX;
    const startW = panel.getBoundingClientRect().width;
    handle.classList.add('dragging');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const onMove = ev => {
      const delta = direction === 'right' ? ev.clientX - startX : startX - ev.clientX;
      panel.style.width = Math.min(maxW, Math.max(minW, startW + delta)) + 'px';
      getMap()?.resize();
    };

    const onUp = () => {
      handle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try { localStorage.setItem(storageKey, panel.style.width); } catch {}
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      getMap()?.resize();
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });

  handle.addEventListener('touchstart', e => {
    const startX = e.touches[0].clientX;
    const startW = panel.getBoundingClientRect().width;
    const onMove = ev => {
      const delta = direction === 'right' ? ev.touches[0].clientX - startX : startX - ev.touches[0].clientX;
      panel.style.width = Math.min(maxW, Math.max(minW, startW + delta)) + 'px';
    };
    const onEnd = () => {
      try { localStorage.setItem(storageKey, panel.style.width); } catch {}
      handle.removeEventListener('touchmove', onMove);
      handle.removeEventListener('touchend', onEnd);
      getMap()?.resize();
    };
    handle.addEventListener('touchmove', onMove);
    handle.addEventListener('touchend', onEnd);
  }, { passive: true });
}
