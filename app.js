/* ─── Progress Tracker ─── */
const GOAL = 500000;

const CRAFTERS = [
  { id:'crp', name:'Carpenter',      short:'CRP', color:'#E9A84C', bg:'rgba(233,168,76,0.15)' },
  { id:'bsm', name:'Blacksmith',     short:'BSM', color:'#aaaaaa', bg:'rgba(180,180,180,0.12)' },
  { id:'arm', name:'Armorer',        short:'ARM', color:'#5B9BD5', bg:'rgba(91,155,213,0.14)' },
  { id:'gsm', name:'Goldsmith',      short:'GSM', color:'#C97CB0', bg:'rgba(201,124,176,0.14)' },
  { id:'ltw', name:'Leatherworker',  short:'LTW', color:'#B08060', bg:'rgba(176,128,96,0.15)' },
  { id:'wvr', name:'Weaver',         short:'WVR', color:'#9A88D8', bg:'rgba(154,136,216,0.14)' },
  { id:'alc', name:'Alchemist',      short:'ALC', color:'#5DB880', bg:'rgba(93,184,128,0.14)' },
  { id:'cul', name:'Culinarian',     short:'CUL', color:'#D0604A', bg:'rgba(208,96,74,0.14)' },
];

const GATHERERS = [
  { id:'min', name:'Miner',    short:'MIN', color:'#B08060', bg:'rgba(176,128,96,0.15)' },
  { id:'btn', name:'Botanist', short:'BTN', color:'#5DB880', bg:'rgba(93,184,128,0.14)' },
  { id:'fsh', name:'Fisher',   short:'FSH', color:'#5B9BD5', bg:'rgba(91,155,213,0.14)' },
];

const STORAGE_KEY = 'pteranodon-tracker-v1';

const values = {};
[...CRAFTERS, ...GATHERERS].forEach(j => values[j.id] = 0);

function loadSaved() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      Object.keys(parsed).forEach(id => { if (id in values) values[id] = parsed[id]; });
    }
  } catch(e) {}
}

function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(values)); } catch(e) {}
}

const checkSVG = `<svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="2,6.5 5,9.5 10,3" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function fmt(n) { return Math.round(n).toLocaleString(); }
function pct(val) { return Math.min(100, (val / GOAL) * 100); }

function buildCard(job) {
  const savedVal = values[job.id] || '';
  return `<div class="job-card" id="card-${job.id}">
    <div class="job-header">
      <div class="job-icon" style="background:${job.bg};color:${job.color}">${job.short}</div>
      <div class="job-name">${job.name}</div>
    </div>
    <div class="input-row">
      <input type="number" min="0" max="500000" step="1000" placeholder="0"
        value="${savedVal}"
        oninput="update('${job.id}', this.value)"
        aria-label="${job.name} firmament points" />
      <span class="job-pct" id="pct-${job.id}">0%</span>
    </div>
    <div class="prog-wrap"><div class="prog-bar" id="bar-${job.id}" style="width:0%;background:${job.color}"></div></div>
    <span class="done-badge" id="done-${job.id}" style="display:none">${checkSVG} Complete</span>
  </div>`;
}

function refreshCard(id) {
  const job = [...CRAFTERS, ...GATHERERS].find(j => j.id === id);
  const v = values[id];
  const p = pct(v);
  const done = v >= GOAL;
  const barColor = done ? '#1D9E75' : job.color;
  document.getElementById('pct-' + id).textContent = Math.round(p) + '%';
  document.getElementById('pct-' + id).style.color = done ? '#5DCAA5' : job.color;
  document.getElementById('bar-' + id).style.width = p + '%';
  document.getElementById('bar-' + id).style.background = barColor;
  document.getElementById('done-' + id).style.display = done ? 'inline-flex' : 'none';
}

function update(id, rawVal) {
  values[id] = Math.max(0, parseInt(rawVal) || 0);
  refreshCard(id);
  persist();
  recalc();
}

function recalc() {
  const all = [...CRAFTERS, ...GATHERERS];
  const total = all.reduce((s, j) => s + Math.min(values[j.id], GOAL), 0);
  const totalMax = all.length * GOAL;
  const done = all.filter(j => values[j.id] >= GOAL).length;
  const remaining = Math.max(0, totalMax - total);
  const op = (total / totalMax) * 100;

  document.getElementById('jobs-done').textContent = `${done} / ${all.length}`;
  document.getElementById('total-pts').textContent = fmt(total);
  document.getElementById('total-rem').textContent = fmt(remaining);
  document.getElementById('overall-fill').style.width = op.toFixed(2) + '%';
  document.getElementById('overall-pct').textContent = op.toFixed(1) + '%';
}

/* ─── Gatherables ─── */
const GATHER_KEY = 'pteranodon-gatherables-v1';

let gatherables = [];
let pendingIcon = null;
let dropdownItems = [];
let dropdownIndex = -1;
let searchTimer = null;

function loadGatherables() {
  try {
    const saved = localStorage.getItem(GATHER_KEY);
    if (saved) gatherables = JSON.parse(saved);
  } catch(e) {}
}

function persistGatherables() {
  try { localStorage.setItem(GATHER_KEY, JSON.stringify(gatherables)); } catch(e) {}
}


const JOB_STYLE = {
  MIN: { color: '#B08060', bg: 'rgba(176,128,96,0.15)' },
  BTN: { color: '#5DB880', bg: 'rgba(93,184,128,0.14)' },
  FSH: { color: '#5B9BD5', bg: 'rgba(91,155,213,0.14)' },
};

function onGatherSearch(val) {
  console.log('onGatherSearch fired:', val);
  pendingIcon = null;
  clearTimeout(searchTimer);
  const q = val.trim();
  if (q.length < 2) { hideDropdown(); return; }

  const dd = document.getElementById('gather-dropdown');
  dd.innerHTML = `<div class="gather-dropdown-loading">Searching…</div>`;
  dd.style.display = 'block';
  dropdownItems = [];
  dropdownIndex = -1;

  searchTimer = setTimeout(() => fetchDiademItems(q), 400);
}

async function fetchDiademItems(query) {
  try {
    const res = await fetch(
      `https://www.garlandtools.org/api/search.php?text=${encodeURIComponent(query)}&lang=en`
    );
    if (!res.ok) { showDropdown(); return; }
    const data = await res.json();
    console.log('Garland Tools raw response:', data);

    const filtered = (data || []).filter(r => r.name && r.name.includes('Skybuilders'));
    console.log('Garland Tools raw response:', data);
    console.log('Filtered Skybuilders items:', filtered);

    dropdownItems = filtered.map(r => {
      const iconId = r.obj?.i;
      let iconUrl = null;
      if (iconId) {
        const folder = String(Math.floor(iconId / 1000) * 1000).padStart(6, '0');
        iconUrl = `https://xivapi.com/i/${folder}/${String(iconId).padStart(6, '0')}.png`;
      }
      return { name: r.name, iconUrl, job: null };
    });

    showDropdown();
  } catch(e) {
    console.error('fetchDiademItems error:', e);
    const dd = document.getElementById('gather-dropdown');
    dd.innerHTML = `<div class="gather-dropdown-empty">Search unavailable — check your connection</div>`;
    dd.style.display = 'block';
  }
}

function jobBadge(job, size) {
  const s = JOB_STYLE[job] || JOB_STYLE.MIN;
  return `<span style="display:inline-flex;align-items:center;justify-content:center;width:${size}px;height:${size}px;border-radius:5px;background:${s.bg};color:${s.color};font-family:'Cinzel',serif;font-size:${Math.round(size*0.37)}px;flex-shrink:0">${job}</span>`;
}

function showDropdown() {
  const dd = document.getElementById('gather-dropdown');
  dropdownIndex = -1;
  if (dropdownItems.length === 0) {
    dd.innerHTML = `<div class="gather-dropdown-empty">No items matched</div>`;
    dd.style.display = 'block';
    return;
  }
  dd.innerHTML = dropdownItems.map((item, i) =>
    `<div class="gather-dropdown-item" data-i="${i}" onmousedown="selectDiademItem(${i})">
      ${item.iconUrl
        ? `<img class="gather-dropdown-icon" src="${item.iconUrl}" alt="" />`
        : item.job ? jobBadge(item.job, 30) : `<div style="width:30px;height:30px;border-radius:5px;background:rgba(255,255,255,0.04);flex-shrink:0"></div>`}
      <span>${escHtml(item.name)}</span>
    </div>`
  ).join('');
  dd.style.display = 'block';
}

function hideDropdown() {
  const dd = document.getElementById('gather-dropdown');
  dd.style.display = 'none';
  dropdownItems = [];
  dropdownIndex = -1;
}

let pendingJob = null;

function selectDiademItem(i) {
  const item = dropdownItems[i];
  if (!item) return;
  document.getElementById('gather-name-input').value = item.name;
  pendingIcon = item.iconUrl;
  pendingJob = item.job || null;
  hideDropdown();
  document.getElementById('gather-target-input').focus();
}

function onGatherSearchKey(e) {
  const dd = document.getElementById('gather-dropdown');
  const visible = dd.style.display !== 'none';
  const rows = dd.querySelectorAll('.gather-dropdown-item');

  if (e.key === 'ArrowDown') {
    if (!visible) return;
    e.preventDefault();
    dropdownIndex = Math.min(dropdownIndex + 1, rows.length - 1);
    rows.forEach((el, i) => el.classList.toggle('focused', i === dropdownIndex));
  } else if (e.key === 'ArrowUp') {
    if (!visible) return;
    e.preventDefault();
    dropdownIndex = Math.max(dropdownIndex - 1, 0);
    rows.forEach((el, i) => el.classList.toggle('focused', i === dropdownIndex));
  } else if (e.key === 'Enter') {
    e.preventDefault();
    if (visible && rows.length > 0) {
      selectDiademItem(dropdownIndex >= 0 ? dropdownIndex : 0);
    } else {
      addGatherable();
    }
  } else if (e.key === 'Escape') {
    hideDropdown();
  }
}

function addGatherable() {
  const nameEl = document.getElementById('gather-name-input');
  const targetEl = document.getElementById('gather-target-input');
  const name = nameEl.value.trim();
  if (!name) { nameEl.focus(); return; }
  const target = parseInt(targetEl.value) || null;
  const item = { id: Date.now(), name, count: 0, target, iconUrl: pendingIcon, job: pendingJob };
  gatherables.push(item);
  persistGatherables();
  nameEl.value = '';
  targetEl.value = '';
  pendingIcon = null;
  pendingJob = null;
  hideDropdown();
  nameEl.focus();
  renderGatherables();
}

function removeGatherable(id) {
  gatherables = gatherables.filter(g => g.id !== id);
  persistGatherables();
  renderGatherables();
}

function stepGatherable(id, delta) {
  const g = gatherables.find(g => g.id === id);
  if (!g) return;
  g.count = Math.max(0, g.count + delta);
  persistGatherables();
  renderGatherCard(id);
}

function setGatherableCount(id, val) {
  const g = gatherables.find(g => g.id === id);
  if (!g) return;
  g.count = Math.max(0, parseInt(val) || 0);
  persistGatherables();
  renderGatherCard(id);
}

function addToGatherable(id) {
  const g = gatherables.find(g => g.id === id);
  if (!g) return;
  const input = document.getElementById('gadd-' + id);
  const amount = parseInt(input.value) || 0;
  if (amount === 0) { input.focus(); return; }
  g.count = Math.max(0, g.count + amount);
  persistGatherables();
  input.value = '';
  input.focus();
  renderGatherCard(id);
}

const trashSVG = `<svg viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg"><polyline points="2,3.5 11,3.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><path d="M4.5 3.5V2.5h4v1" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/><rect x="3" y="4.5" width="7" height="6.5" rx="1.2" stroke="currentColor" stroke-width="1.2"/><line x1="5.5" y1="6.5" x2="5.5" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/><line x1="7.5" y1="6.5" x2="7.5" y2="9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
const itemSVG = `<svg viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="10" height="10" rx="2" stroke="currentColor" stroke-width="1.2"/><path d="M5 7h4M7 5v4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/></svg>`;
const gripSVG = `<svg viewBox="0 0 10 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg"><circle cx="3" cy="3" r="1.4"/><circle cx="7" cy="3" r="1.4"/><circle cx="3" cy="8" r="1.4"/><circle cx="7" cy="8" r="1.4"/><circle cx="3" cy="13" r="1.4"/><circle cx="7" cy="13" r="1.4"/></svg>`;

function renderGatherCard(id) {
  const g = gatherables.find(g => g.id === id);
  const el = document.getElementById('gcard-' + id);
  if (!g || !el) return;
  const hasTgt = g.target !== null && g.target > 0;
  const p = hasTgt ? Math.min(100, (g.count / g.target) * 100) : null;
  const done = hasTgt && g.count >= g.target;

  const iconHtml = g.iconUrl
    ? `<img class="gather-item-icon" src="${g.iconUrl}" alt="" onerror="this.style.display='none'" />`
    : (g.job ? jobBadge(g.job, 32) : `<div class="gather-item-icon-placeholder">${itemSVG}</div>`);

  const barHtml = hasTgt ? `
    <div class="prog-wrap" style="margin-top:10px">
      <div class="prog-bar" style="width:${p.toFixed(1)}%;background:${done ? '#1D9E75' : 'var(--gold)'}"></div>
    </div>` : '';

  const bottomHtml = hasTgt ? `
    <div class="gather-target-label">
      <span>${g.count.toLocaleString()} / ${g.target.toLocaleString()}</span>
      ${done ? `<span class="gather-done-badge">${checkSVG} Done</span>` : `<span>${p.toFixed(0)}%</span>`}
    </div>` : '';

  el.innerHTML = `
    <div class="gather-card-header">
      <span class="drag-handle" draggable="true" title="Drag to reorder">${gripSVG}</span>
      <div class="gather-name-group">
        ${iconHtml}
        <div class="gather-item-name">${escHtml(g.name)}</div>
      </div>
      <button class="btn-remove" onclick="removeGatherable(${g.id})" title="Remove">${trashSVG}</button>
    </div>
    <div class="gather-counter-row">
      <button class="btn-step" onclick="stepGatherable(${g.id}, -1)">−</button>
      <input class="gather-count-input" type="number" min="0" value="${g.count}"
        oninput="setGatherableCount(${g.id}, this.value)"
        aria-label="${escHtml(g.name)} count" />
      <button class="btn-step" onclick="stepGatherable(${g.id}, 1)">+</button>
    </div>
    ${barHtml}${bottomHtml}
    <div class="gather-add-amount-row">
      <input id="gadd-${g.id}" type="number" min="1" placeholder="Add amount…"
        onkeydown="if(event.key==='Enter') addToGatherable(${g.id})"
        aria-label="Add to ${escHtml(g.name)} total" />
      <button class="btn-add-amount" onclick="addToGatherable(${g.id})">Add</button>
    </div>`;
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function renderGatherables() {
  const grid = document.getElementById('gather-grid');
  const empty = document.getElementById('gather-empty');

  if (gatherables.length === 0) {
    grid.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  grid.innerHTML = gatherables.map(g => `<div class="gather-card" id="gcard-${g.id}" data-id="${g.id}"></div>`).join('');
  gatherables.forEach(g => renderGatherCard(g.id));
}

/* ─── Nav ─── */
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('view-' + name).classList.add('active');
  event.currentTarget.classList.add('active');
}

document.addEventListener('click', e => {
  if (!e.target.closest('.gather-search-wrap')) hideDropdown();
});

function initGatherDrag() {
  const grid = document.getElementById('gather-grid');
  let activeDragId = null;
  let activeOverId = null;

  grid.addEventListener('dragstart', e => {
    const handle = e.target.closest('.drag-handle');
    if (!handle) return;
    const card = handle.closest('[data-id]');
    if (!card) return;
    activeDragId = +card.dataset.id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setDragImage(card, 24, 24);
    requestAnimationFrame(() => card.classList.add('dragging'));
  });

  grid.addEventListener('dragover', e => {
    if (activeDragId === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const card = e.target.closest('[data-id]');
    if (!card || +card.dataset.id === activeDragId) return;
    const overId = +card.dataset.id;
    if (overId === activeOverId) return;
    grid.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    card.classList.add('drag-over');
    activeOverId = overId;
  });

  grid.addEventListener('dragleave', e => {
    if (!grid.contains(e.relatedTarget)) {
      grid.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
      activeOverId = null;
    }
  });

  grid.addEventListener('drop', e => {
    e.preventDefault();
    cleanup();
    if (activeDragId !== null && activeOverId !== null && activeDragId !== activeOverId) {
      const fi = gatherables.findIndex(g => g.id === activeDragId);
      const ti = gatherables.findIndex(g => g.id === activeOverId);
      if (fi !== -1 && ti !== -1) {
        const [moved] = gatherables.splice(fi, 1);
        gatherables.splice(ti, 0, moved);
        persistGatherables();
        renderGatherables();
      }
    }
    activeDragId = activeOverId = null;
  });

  grid.addEventListener('dragend', () => { cleanup(); activeDragId = activeOverId = null; });

  function cleanup() {
    grid.querySelectorAll('.dragging, .drag-over').forEach(el => {
      el.classList.remove('dragging', 'drag-over');
    });
  }
}

/* ─── Init ─── */
loadSaved();
document.getElementById('crafters-grid').innerHTML = CRAFTERS.map(buildCard).join('');
document.getElementById('gatherers-grid').innerHTML = GATHERERS.map(buildCard).join('');
[...CRAFTERS, ...GATHERERS].forEach(j => { if (values[j.id]) refreshCard(j.id); });
recalc();

loadGatherables();
renderGatherables();
initGatherDrag();
