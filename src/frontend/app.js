const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const COLS = [
  ['active', 'active', '< 30 days'],
  ['idle', 'idle', '30–90 days'],
  ['stale', 'stale', '90–180 days'],
  ['cleanup', 'cleanup', '> 180 days'],
];

let prefs = { workspace: '', ignored: [] };
let projects = [];
let language = 'en';
let activeFilter = 'all';
const COLOR_OPTIONS = ['blue', 'green', 'yellow', 'orange', 'red', 'purple'];

const I18N = {
  en: {
    active: 'Active', idle: 'Idle', stale: 'Stale', cleanup: 'Cleanup',
    chooseWorkspace: 'Choose Workspace…', rescan: 'Rescan',
    repos: 'Repos', totalSize: 'Total size', dirty: 'Dirty', noRemote: 'No remote', reclaimable: 'Reclaimable',
    filters: 'Filters', all: 'All',
    remote: 'remote', localOnly: 'local only', modified: 'modified', unpushed: 'unpushed', clean: 'clean',
    lastActivity: 'Last activity', size: 'Size', safeToRemove: 'Safe to remove locally', doNotDelete: 'Do not delete',
    finder: 'Finder', terminal: 'Terminal', vsCode: 'VS Code', copyPath: 'Copy Path', copied: 'Copied',
    nothingHere: 'nothing here', finding: 'finding repositories…', noRepos: 'no git repositories found',
    scanning: 'scanning {n} repositories…', scanFailed: 'scan failed: {error}', initFailed: 'init failed: {error}',
    noRemoteReason: 'no remote', modifiedFilesReason: '{n} modified file(s)', unpushedCommitsReason: '{n} unpushed commit(s)',
    noTrackingReason: 'branch not tracking a remote', tooRecentReason: 'newer than 180 days',
    today: 'today', yesterday: 'yesterday', days: '{n} days', months: '{n} months', noCommits: 'no commits',
    changeLanguage: 'Change language',
    chooseColor: 'Choose card color', removeColor: 'No color',
    blue: 'Blue', green: 'Green', yellow: 'Yellow', orange: 'Orange', red: 'Red', purple: 'Purple',
  },
  it: {
    active: 'Attivi', idle: 'In pausa', stale: 'Invecchiati', cleanup: 'Da pulire',
    chooseWorkspace: 'Scegli workspace…', rescan: 'Scansiona',
    repos: 'Repo', totalSize: 'Dimensione totale', dirty: 'Modificati', noRemote: 'Senza remote', reclaimable: 'Recuperabile',
    filters: 'Filtri', all: 'Tutti',
    remote: 'remote', localOnly: 'solo locale', modified: 'modificati', unpushed: 'non inviati', clean: 'pulito',
    lastActivity: 'Ultima attività', size: 'Dimensione', safeToRemove: 'Sicuro da rimuovere localmente', doNotDelete: 'Non cancellare',
    finder: 'Finder', terminal: 'Terminale', vsCode: 'VS Code', copyPath: 'Copia percorso', copied: 'Copiato',
    nothingHere: 'nessun progetto', finding: 'ricerca repository…', noRepos: 'nessun repository Git trovato',
    scanning: 'scansione di {n} repository…', scanFailed: 'scansione fallita: {error}', initFailed: 'inizializzazione fallita: {error}',
    noRemoteReason: 'nessun remote', modifiedFilesReason: '{n} file modificati', unpushedCommitsReason: '{n} commit non inviati',
    noTrackingReason: 'il branch non segue un remote', tooRecentReason: 'più recente di 180 giorni',
    today: 'oggi', yesterday: 'ieri', days: '{n} giorni', months: '{n} mesi', noCommits: 'nessun commit',
    changeLanguage: 'Cambia lingua',
    chooseColor: 'Scegli colore card', removeColor: 'Nessun colore',
    blue: 'Blu', green: 'Verde', yellow: 'Giallo', orange: 'Arancione', red: 'Rosso', purple: 'Viola',
  },
};

const t = (key, vars = {}) => Object.entries(vars).reduce(
  (text, [name, value]) => text.replaceAll('{' + name + '}', value),
  I18N[language][key] || key,
);

const fmtSize = (mb) => (mb >= 1024 ? (mb / 1024).toFixed(1) + ' GB' : mb + ' MB');
const fmtAge = (d) => d == null ? t('noCommits')
  : d === 0 ? t('today') : d === 1 ? t('yesterday')
  : d < 60 ? t('days', { n: d }) : t('months', { n: Math.round(d / 30) });

function formatReasons(p) {
  return (p.reasonKeys || []).map((key) => {
    if (key === 'noRemote') return t('noRemoteReason');
    if (key === 'modifiedFiles') return t('modifiedFilesReason', { n: p.dirtyFiles });
    if (key === 'unpushedCommits') return t('unpushedCommitsReason', { n: p.unpushed });
    if (key === 'noTracking') return t('noTrackingReason');
    if (key === 'tooRecent') return t('tooRecentReason');
    return '';
  }).filter(Boolean).join(', ');
}

function projectColor(path) {
  const color = prefs.projectColors && prefs.projectColors[path];
  return COLOR_OPTIONS.includes(color) ? color : '';
}

function colorPicker(p) {
  const selected = projectColor(p.path);
  const swatches = [null, ...COLOR_OPTIONS].map((color) => {
    const label = color ? t(color) : t('removeColor');
    const active = (color || '') === selected;
    return `<button class="color-swatch ${color || 'none'} ${active ? 'selected' : ''}"
      data-color="${color || ''}" data-color-path="${esc(p.path)}"
      aria-label="${esc(label)}" aria-pressed="${active}" title="${esc(label)}"></button>`;
  }).join('');
  return `<details class="color-picker">
    <summary class="color-trigger ${selected || 'none'}" aria-label="${esc(t('chooseColor'))}" title="${esc(t('chooseColor'))}"></summary>
    <div class="color-palette">${swatches}</div>
  </details>`;
}

function card(p) {
  const tags = [];
  const color = projectColor(p.path);
  if (p.dirty) tags.push(`<span class="tag dirty">● ${p.dirtyFiles} ${esc(t('modified'))}</span>`);
  if (!p.remote) tags.push(`<span class="tag noremote">⚠ ${esc(t('noRemote'))}</span>`);
  if (p.unpushed) tags.push(`<span class="tag unpushed">↑ ${p.unpushed} ${esc(t('unpushed'))}</span>`);
  if (!tags.length) tags.push(`<span class="tag">${esc(t('clean'))}</span>`);

  const safety = p.safeToRemove
    ? `<div class="safety safe">✅ ${esc(t('safeToRemove'))}</div>`
    : `<div class="safety keep">⚠ ${esc(t('doNotDelete'))} — ${esc(formatReasons(p))}</div>`;

  return `<div class="card${color ? ` project-color-${color}` : ''}">
    <div class="card-head"><h3>${esc(p.name)}</h3>${colorPicker(p)}</div>
    <div class="meta">${esc(p.stack)} • ${esc(p.remote ? t('remote') : t('localOnly'))} • ${esc(p.branch)}</div>
    <div class="tags">${tags.join('')}</div>
    <div class="row"><span>${esc(t('lastActivity'))}</span><b>${fmtAge(p.lastCommitDays)}</b></div>
    <div class="row"><span>${esc(t('size'))}</span><b>${fmtSize(p.sizeMB)}</b></div>
    ${safety}
    <div class="acts" data-path="${esc(p.path)}">
      <button data-k="finder">${esc(t('finder'))}</button>
      <button data-k="terminal">${esc(t('terminal'))}</button>
      <button data-k="code">${esc(t('vsCode'))}</button>
      <button data-k="copy">${esc(t('copyPath'))}</button>
    </div>
  </div>`;
}

function render() {
  const total = projects.length;
  const bytes = projects.reduce((n, p) => n + p.sizeMB, 0);
  const reclaim = projects.filter((p) => p.safeToRemove).reduce((n, p) => n + p.sizeMB, 0);
  $('stats').innerHTML = [
    [t('repos'), total],
    [t('totalSize'), fmtSize(bytes)],
    [t('dirty'), projects.filter((p) => p.dirty).length],
    [t('noRemote'), projects.filter((p) => !p.remote).length],
    [t('reclaimable'), fmtSize(reclaim)],
  ].map(([k, v]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('');

  const filters = [
    ['all', t('all'), total],
    ['dirty', t('dirty'), projects.filter((p) => p.dirty).length],
    ['noRemote', t('noRemote'), projects.filter((p) => !p.remote).length],
    ['reclaimable', t('reclaimable'), projects.filter((p) => p.safeToRemove).length],
  ];
  $('filters').innerHTML = `<span class="filter-label">${esc(t('filters'))}</span>` + filters.map(([key, label, count]) =>
    `<button class="filter ${activeFilter === key ? 'active' : ''}" data-filter="${key}">${esc(label)} <b>${count}</b></button>`,
  ).join('');

  const visibleProjects = projects.filter((p) => {
    if (activeFilter === 'dirty') return p.dirty;
    if (activeFilter === 'noRemote') return !p.remote;
    if (activeFilter === 'reclaimable') return p.safeToRemove;
    return true;
  });

  $('board').innerHTML = COLS.map(([key, label, hint]) => {
    const list = visibleProjects.filter((p) => p.status === key)
      .sort((a, b) => (a.lastCommitDays ?? 1e9) - (b.lastCommitDays ?? 1e9));
    return `<div class="col ${key}">
      <h2><i></i>${esc(t(label))} <em>${esc(hint)} · ${list.length}</em></h2>
      ${list.length ? list.map(card).join('') : `<div class="empty">${esc(t('nothingHere'))}</div>`}
    </div>`;
  }).join('');
}

async function scan() {
  if (!prefs.workspace) return;
  $('ws').textContent = prefs.workspace;
  $('bar').classList.add('on');
  $('barText').textContent = t('finding');
  $('fill').style.width = '0';
  try {
    const res = await tiny.api.call('scan', { root: prefs.workspace, ignored: prefs.ignored });
    projects = res.projects;
    render();
  } catch (e) {
    $('board').innerHTML = `<div class="empty">${esc(t('scanFailed', { error: e }))}</div>`;
  }
  $('bar').classList.remove('on');
}

tiny.api.on('scan-start', ({ total }) => {
  $('barText').textContent = total ? t('scanning', { n: total }) : t('noRepos');
});
tiny.api.on('scan-progress', ({ done, total }) => {
  $('fill').style.width = (total ? (done / total) * 200 : 0) + 'px';
  $('barText').textContent = `${done} / ${total}`;
});

async function pick() {
  const path = await tiny.dialog.pickFolder();
  if (!path) return;
  prefs.workspace = path;
  await tiny.api.call('savePrefs', { workspace: path });
  await scan();
}

$('pick').addEventListener('click', pick);
$('rescan').addEventListener('click', scan);
$('filters').addEventListener('click', (ev) => {
  const btn = ev.target.closest('[data-filter]');
  if (!btn) return;
  activeFilter = btn.dataset.filter;
  render();
});
$('board').addEventListener('click', async (ev) => {
  const swatch = ev.target.closest('[data-color-path]');
  if (!swatch) return;
  ev.stopPropagation();
  const path = swatch.dataset.colorPath;
  const color = swatch.dataset.color;
  const projectColors = { ...(prefs.projectColors || {}) };
  if (COLOR_OPTIONS.includes(color)) projectColors[path] = color;
  else delete projectColors[path];
  prefs.projectColors = projectColors;
  await tiny.api.call('savePrefs', { projectColors });
  render();
});
$('language').addEventListener('click', async () => {
  language = language === 'it' ? 'en' : 'it';
  prefs.language = language;
  await tiny.api.call('savePrefs', { language });
  applyLanguage();
  render();
});
tiny.api.on('menu', (id) => { if (id === 'pick') pick(); if (id === 'rescan') scan(); });

function applyLanguage() {
  document.documentElement.lang = language;
  $('filters').setAttribute('aria-label', t('filters'));
  $('language').textContent = language === 'it' ? 'EN' : 'IT';
  $('language').title = t('changeLanguage');
  $('language').setAttribute('aria-label', t('changeLanguage'));
  $('pick').textContent = t('chooseWorkspace');
  $('rescan').textContent = t('rescan');
}

$('board').addEventListener('click', async (ev) => {
  const btn = ev.target.closest('.acts button');
  if (!btn) return;
  const path = btn.parentElement.dataset.path;
  const kind = btn.dataset.k;
  if (kind === 'copy') {
    tiny.clipboard.write({ text: path });
    const old = btn.textContent;
    btn.textContent = t('copied');
    setTimeout(() => { btn.textContent = old; }, 900);
    return;
  }
  await tiny.api.call('openIn', { path, kind });
});

(async function init() {
  prefs = await tiny.api.call('loadPrefs');
  prefs.projectColors = prefs.projectColors || {};
  language = prefs.language || ((navigator.language || '').toLowerCase().startsWith('it') ? 'it' : 'en');
  applyLanguage();
  $('ws').textContent = prefs.workspace;
  await scan();
})().catch((e) => { $('board').innerHTML = esc(t('initFailed', { error: e })); });
