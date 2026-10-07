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
let knowledgePath = '';
let knowledgeProvider = 'notion';
let todos = [];
let todoOpen = true;
let todoEditingId = '';
let gitPath = '';
let activeTag = '';
const COLOR_OPTIONS = ['blue', 'green', 'yellow', 'orange', 'red', 'purple'];

const I18N = {
  en: {
    active: 'Active', idle: 'Idle', stale: 'Stale', cleanup: 'Cleanup',
    chooseWorkspace: 'Choose Workspace…', rescan: 'Rescan',
    repos: 'Repos', totalSize: 'Total size', dirty: 'Dirty', noRemote: 'No remote', reclaimable: 'Reclaimable',
    filters: 'Filters', all: 'All',
    tag: 'Tag', addTag: '+ Tag', tagPlaceholder: 'Add tag…', removeTag: 'Remove tag',
    todo: 'Todo', addTodo: 'Add todo', editTodo: 'Edit todo', task: 'Task', linkedProjects: 'Projects',
    noTodos: 'No todos yet', noProjects: 'No projects found', deleteTodo: 'Delete', todoRequired: 'Enter a task first', openTodos: '{n} open',
    remote: 'remote', localOnly: 'local only', modified: 'modified', unpushed: 'unpushed', clean: 'clean',
    lastActivity: 'Last activity', size: 'Size', safeToRemove: 'Safe to remove locally', doNotDelete: 'Do not delete',
    finder: 'Finder', terminal: 'Terminal', vsCode: 'VS Code', copyPath: 'Copy Path', copied: 'Copied',
    nothingHere: 'nothing here', finding: 'finding repositories…', noRepos: 'no git repositories found',
    scanning: 'scanning {n} repositories…', scanFailed: 'scan failed: {error}', initFailed: 'init failed: {error}',
    noRemoteReason: 'no remote', modifiedFilesReason: '{n} modified file(s)', unpushedCommitsReason: '{n} unpushed commit(s)',
    noTrackingReason: 'branch not tracking a remote', tooRecentReason: 'newer than 180 days',
    today: 'today', yesterday: 'yesterday', days: '{n} days', months: '{n} months', noCommits: 'no commits',
    changeLanguage: 'Change language',
    notion: 'Notion', addNotion: 'Add Notion', editNotion: 'Edit Notion', notionTitle: 'Notion page',
    obsidian: 'Obsidian', addObsidian: 'Add Obsidian', editObsidian: 'Edit Obsidian', obsidianTitle: 'Obsidian note',
    notionLabel: 'Notion page URL', notionPlaceholder: 'https://www.notion.so/…', obsidianLabel: 'Obsidian URI', obsidianPlaceholder: 'obsidian://open?vault=…&file=…',
    save: 'Save', cancel: 'Cancel', remove: 'Remove', invalidNotionUrl: 'Enter a valid http:// or https:// URL.', invalidObsidianUrl: 'Enter a valid obsidian:// URI.',
    chooseColor: 'Choose card color', removeColor: 'No color',
    blue: 'Blue', green: 'Green', yellow: 'Yellow', orange: 'Orange', red: 'Red', purple: 'Purple',
    priority: 'Priority', stars: '{n} stars', atLeastStars: '{n}+ stars', ratingAction: 'Set rating to {n} stars', clearRating: 'Clear rating', ratingFilter: 'Show projects with at least {n} stars',
    gitStatus: 'Git status', branch: 'Branch', latestCommit: 'Latest commit', noCommit: 'No commits', openTerminal: 'Open Terminal', close: 'Close', diff: 'Diff', noDiff: 'No diff available', loading: 'Loading…', gitError: 'Unable to read Git status',
    statusModified: 'modified', statusAdded: 'added', statusDeleted: 'deleted', statusRenamed: 'renamed', statusUntracked: 'untracked',
  },
  it: {
    active: 'Attivi', idle: 'In pausa', stale: 'Invecchiati', cleanup: 'Da pulire',
    chooseWorkspace: 'Scegli workspace…', rescan: 'Scansiona',
    repos: 'Repo', totalSize: 'Dimensione totale', dirty: 'Modificati', noRemote: 'Senza remote', reclaimable: 'Recuperabile',
    filters: 'Filtri', all: 'Tutti',
    tag: 'Tag', addTag: '+ Tag', tagPlaceholder: 'Aggiungi tag…', removeTag: 'Rimuovi tag',
    todo: 'Todo', addTodo: 'Aggiungi todo', editTodo: 'Modifica todo', task: 'Attività', linkedProjects: 'Progetti',
    noTodos: 'Nessun todo', noProjects: 'Nessun progetto trovato', deleteTodo: 'Elimina', todoRequired: 'Inserisci prima un’attività', openTodos: '{n} aperti',
    remote: 'remote', localOnly: 'solo locale', modified: 'modificati', unpushed: 'non inviati', clean: 'pulito',
    lastActivity: 'Ultima attività', size: 'Dimensione', safeToRemove: 'Sicuro da rimuovere localmente', doNotDelete: 'Non cancellare',
    finder: 'Finder', terminal: 'Terminale', vsCode: 'VS Code', copyPath: 'Copia percorso', copied: 'Copiato',
    nothingHere: 'nessun progetto', finding: 'ricerca repository…', noRepos: 'nessun repository Git trovato',
    scanning: 'scansione di {n} repository…', scanFailed: 'scansione fallita: {error}', initFailed: 'inizializzazione fallita: {error}',
    noRemoteReason: 'nessun remote', modifiedFilesReason: '{n} file modificati', unpushedCommitsReason: '{n} commit non inviati',
    noTrackingReason: 'il branch non segue un remote', tooRecentReason: 'più recente di 180 giorni',
    today: 'oggi', yesterday: 'ieri', days: '{n} giorni', months: '{n} mesi', noCommits: 'nessun commit',
    changeLanguage: 'Cambia lingua',
    notion: 'Notion', addNotion: 'Aggiungi Notion', editNotion: 'Modifica Notion', notionTitle: 'Pagina Notion',
    obsidian: 'Obsidian', addObsidian: 'Aggiungi Obsidian', editObsidian: 'Modifica Obsidian', obsidianTitle: 'Nota Obsidian',
    notionLabel: 'URL della pagina Notion', notionPlaceholder: 'https://www.notion.so/…', obsidianLabel: 'URI Obsidian', obsidianPlaceholder: 'obsidian://open?vault=…&file=…',
    save: 'Salva', cancel: 'Annulla', remove: 'Rimuovi', invalidNotionUrl: 'Inserisci un URL valido che inizi con http:// o https://.', invalidObsidianUrl: 'Inserisci un URI valido che inizi con obsidian://.',
    chooseColor: 'Scegli colore card', removeColor: 'Nessun colore',
    blue: 'Blu', green: 'Verde', yellow: 'Giallo', orange: 'Arancione', red: 'Rosso', purple: 'Viola',
    priority: 'Priorità', stars: '{n} stelle', atLeastStars: '{n}+ stelle', ratingAction: 'Imposta valutazione a {n} stelle', clearRating: 'Azzera valutazione', ratingFilter: 'Mostra progetti con almeno {n} stelle',
    gitStatus: 'Stato Git', branch: 'Branch', latestCommit: 'Ultimo commit', noCommit: 'Nessun commit', openTerminal: 'Apri Terminale', close: 'Chiudi', diff: 'Diff', noDiff: 'Nessun diff disponibile', loading: 'Caricamento…', gitError: 'Impossibile leggere lo stato Git',
    statusModified: 'modificato', statusAdded: 'aggiunto', statusDeleted: 'eliminato', statusRenamed: 'rinominato', statusUntracked: 'non tracciato',
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

function projectRating(path) {
  const rating = prefs.projectRatings && prefs.projectRatings[path];
  return Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : 0;
}

function projectTags(path) {
  return Array.isArray(prefs.projectTags && prefs.projectTags[path]) ? prefs.projectTags[path] : [];
}

async function saveProjectTags(path, tags) {
  const clean = [];
  const seen = new Set();
  for (const value of tags) {
    const tag = String(value).trim().slice(0, 50);
    const key = tag.toLocaleLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    clean.push(tag);
    if (clean.length === 12) break;
  }
  const projectTagsMap = { ...(prefs.projectTags || {}) };
  if (clean.length) projectTagsMap[path] = clean;
  else delete projectTagsMap[path];
  prefs.projectTags = projectTagsMap;
  await tiny.api.call('savePrefs', { projectTags: projectTagsMap });
  render();
}

function projectKnowledgeLink(path, provider) {
  const link = prefs.projectKnowledgeLinks && prefs.projectKnowledgeLinks[path]?.[provider];
  try {
    const protocol = new URL(link).protocol;
    return provider === 'obsidian'
      ? (protocol === 'obsidian:' ? link : '')
      : (protocol === 'http:' || protocol === 'https:' ? link : '');
  } catch {
    return '';
  }
}

function providerText(provider, key) {
  const labels = {
    notion: { add: 'addNotion', edit: 'editNotion', title: 'notionTitle' },
    obsidian: { add: 'addObsidian', edit: 'editObsidian', title: 'obsidianTitle' },
  };
  return t(labels[provider][key]);
}

function ratingControl(p) {
  const rating = projectRating(p.path);
  return `<div class="rating" aria-label="${esc(t('priority'))}: ${rating ? esc(t('stars', { n: rating })) : '0'}">
    ${[1, 2, 3, 4, 5].map((value) => {
      const active = value <= rating;
      const label = active && value === rating ? t('clearRating') : t('ratingAction', { n: value });
      return `<button class="star ${active ? 'active' : ''}" data-rating="${value}" data-rating-path="${esc(p.path)}"
        aria-label="${esc(label)}" aria-pressed="${active}">★</button>`;
    }).join('')}
  </div>`;
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
  if (p.dirty) tags.push(`<button class="tag dirty status-trigger" data-repo-status="${esc(p.path)}" aria-label="${esc(t('gitStatus'))}">● ${p.dirtyFiles} ${esc(t('modified'))}</button>`);
  if (!p.remote) tags.push(`<span class="tag noremote">⚠ ${esc(t('noRemote'))}</span>`);
  if (p.unpushed) tags.push(`<span class="tag unpushed">↑ ${p.unpushed} ${esc(t('unpushed'))}</span>`);
  if (!tags.length) tags.push(`<span class="tag">${esc(t('clean'))}</span>`);
  const customTags = projectTags(p.path).map((tag) => `<span class="tag project-tag">${esc(tag)}<button data-tag-remove="${esc(tag)}" data-tag-path="${esc(p.path)}" aria-label="${esc(t('removeTag'))}">×</button></span>`);

  const safety = p.safeToRemove
    ? `<div class="safety safe">✅ ${esc(t('safeToRemove'))}</div>`
    : `<div class="safety keep">⚠ ${esc(t('doNotDelete'))} — ${esc(formatReasons(p))}</div>`;

  return `<div class="card${color ? ` project-color-${color}` : ''}">
    <div class="card-head"><h3>${esc(p.name)}</h3><div class="card-tools">${ratingControl(p)}${colorPicker(p)}</div></div>
    <div class="meta">${esc(p.stack)} • ${esc(p.remote ? t('remote') : t('localOnly'))} • ${esc(p.branch)}</div>
    <div class="tags">${tags.join('')}${customTags.join('')}<input class="tag-input" data-tag-path="${esc(p.path)}" maxlength="50" placeholder="${esc(t('tagPlaceholder'))}" aria-label="${esc(t('addTag'))}"></div>
    <div class="row"><span>${esc(t('lastActivity'))}</span><b>${fmtAge(p.lastCommitDays)}</b></div>
    <div class="row"><span>${esc(t('size'))}</span><b>${fmtSize(p.sizeMB)}</b></div>
    ${safety}
    <div class="acts" data-path="${esc(p.path)}">
      ${['notion', 'obsidian'].map((provider) => {
        const link = projectKnowledgeLink(p.path, provider);
        return `<button class="${provider}-action" data-k="${provider}">${esc(link ? t(provider) : providerText(provider, 'add'))}</button>
          ${link ? `<button data-k="${provider}-edit">${esc(providerText(provider, 'edit'))}</button>` : ''}`;
      }).join('')}
      <button data-k="finder">${esc(t('finder'))}</button>
      <button data-k="terminal">${esc(t('terminal'))}</button>
      <button data-k="code">${esc(t('vsCode'))}</button>
      <button data-k="copy">${esc(t('copyPath'))}</button>
    </div>
  </div>`;
}

function projectName(path) {
  const project = projects.find((item) => item.path === path);
  return project ? project.name : '';
}

function renderTodos() {
  const openCount = todos.filter((todo) => !todo.done).length;
  $('todoTitle').textContent = t('todo');
  $('todoCount').textContent = t('openTodos', { n: openCount });
  $('todoAdd').textContent = t('addTodo');
  $('todoAdd').setAttribute('aria-label', t('addTodo'));
  $('todoToggle').setAttribute('aria-expanded', todoOpen);
  $('todoChevron').textContent = todoOpen ? '⌄' : '›';
  $('todoList').hidden = !todoOpen;
  $('todoList').innerHTML = todos.length ? todos.map((todo) => {
    const chips = todo.projectPaths.map(projectName).filter(Boolean)
      .map((name) => `<span class="todo-project-chip">${esc(name)}</span>`).join('');
    return `<div class="todo-row ${todo.done ? 'done' : ''}">
      <label class="todo-check"><input type="checkbox" data-todo-toggle="${esc(todo.id)}" ${todo.done ? 'checked' : ''}><span></span></label>
      <span class="todo-text">${esc(todo.text)}</span>
      <span class="todo-project-chips">${chips}</span>
      <button class="todo-action" data-todo-edit="${esc(todo.id)}">${esc(t('editTodo'))}</button>
      <button class="todo-action danger" data-todo-delete="${esc(todo.id)}">${esc(t('deleteTodo'))}</button>
    </div>`;
  }).join('') : `<div class="todo-empty">${esc(t('noTodos'))}</div>`;
}

function openTodoDialog(id = '') {
  todoEditingId = id;
  const todo = todos.find((item) => item.id === id);
  $('todoDialogTitle').textContent = todo ? t('editTodo') : t('addTodo');
  $('todoTextLabel').textContent = t('task');
  $('todoProjectsLabel').textContent = t('linkedProjects');
  $('todoText').value = todo ? todo.text : '';
  $('todoError').textContent = '';
  $('todoProjects').innerHTML = projects.length ? projects.map((project) =>
    `<label class="todo-project-option"><input type="checkbox" value="${esc(project.path)}" ${todo?.projectPaths.includes(project.path) ? 'checked' : ''}><span>${esc(project.name)}</span></label>`,
  ).join('') : `<div class="todo-empty">${esc(t('noProjects'))}</div>`;
  $('todoCancel').textContent = t('cancel');
  $('todoSave').textContent = t('save');
  $('todoDialog').showModal();
  $('todoText').focus();
}

function gitStatusLabel(status) {
  return t('status' + status[0].toUpperCase() + status.slice(1));
}

function renderGitStatus(status) {
  $('gitTitle').textContent = t('gitStatus');
  $('gitSummary').innerHTML = `<div><span>${esc(t('branch'))}</span><b>${esc(status.branch)}</b></div>
    <div><span>${esc(t('remote'))}</span><b>${status.remote ? esc(status.remote) : esc(t('localOnly'))}</b></div>
    <div><span>${esc(t('latestCommit'))}</span><b>${status.commit ? esc(status.commit.hash + ' · ' + status.commit.subject) : esc(t('noCommit'))}</b></div>`;
  $('gitFiles').innerHTML = status.files.length ? status.files.map((file) =>
    `<div class="git-file-row"><span class="git-file-status ${esc(file.status)}">${esc(gitStatusLabel(file.status))}</span><code>${esc(file.path)}</code><button data-git-file="${esc(file.path)}">${esc(t('diff'))}</button></div>`,
  ).join('') : `<div class="todo-empty">${esc(t('noDiff'))}</div>`;
  $('gitDiffPanel').open = false;
  $('gitDiff').textContent = '';
  $('gitTerminal').textContent = t('openTerminal');
  $('gitClose').setAttribute('aria-label', t('close'));
}

async function openGitDialog(path) {
  gitPath = path;
  $('gitSummary').textContent = t('loading');
  $('gitFiles').textContent = '';
  $('gitDiff').textContent = '';
  $('gitDiffPanel').open = false;
  $('gitDialog').showModal();
  const status = await tiny.api.call('repoStatus', { path });
  if (status.error) {
    $('gitSummary').textContent = t('gitError') + ': ' + status.error;
    return;
  }
  renderGitStatus(status);
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
  const ratingThreshold = activeFilter.startsWith('rating-') ? Number(activeFilter.slice(7)) : 0;
  const ratingFilter = `<div class="priority-filter" aria-label="${esc(t('priority'))}">
    <span class="filter-label">${esc(t('priority'))}</span>
    ${[1, 2, 3, 4, 5].map((value) => `<button class="filter-star ${value <= ratingThreshold ? 'active' : ''}"
      data-filter="rating-${value}" aria-label="${esc(t('ratingFilter', { n: value }))}"
      aria-pressed="${value === ratingThreshold}" title="${esc(t('atLeastStars', { n: value }))}">★</button>`).join('')}
  </div>`;
  const tagMap = new Map();
  projects.forEach((project) => projectTags(project.path).forEach((tag) => {
    const key = tag.toLocaleLowerCase();
    if (!tagMap.has(key)) tagMap.set(key, tag);
  }));
  const tagFilters = [...tagMap.entries()].map(([key, tag]) => {
    const filterKey = 'tag:' + key;
    const count = projects.filter((project) => projectTags(project.path).some((value) => value.toLocaleLowerCase() === key)).length;
    return `<button class="filter ${activeFilter === filterKey ? 'active' : ''}" data-filter="${esc(filterKey)}">${esc(tag)} <b>${count}</b></button>`;
  }).join('');
  $('filters').innerHTML = `<span class="filter-label">${esc(t('filters'))}</span>` + filters.map(([key, label, count]) =>
    `<button class="filter ${activeFilter === key ? 'active' : ''}" data-filter="${key}">${esc(label)} <b>${count}</b></button>`,
  ).join('') + ratingFilter + (tagFilters ? `<span class="filter-label tag-filter-label">${esc(t('tag'))}</span>${tagFilters}` : '');
  renderTodos();

  const visibleProjects = projects.filter((p) => {
    if (activeFilter === 'dirty') return p.dirty;
    if (activeFilter === 'noRemote') return !p.remote;
    if (activeFilter === 'reclaimable') return p.safeToRemove;
    if (activeFilter.startsWith('rating-')) return projectRating(p.path) >= Number(activeFilter.slice(7));
    if (activeFilter.startsWith('tag:')) return projectTags(p.path).some((tag) => tag.toLocaleLowerCase() === activeFilter.slice(4));
    return true;
  });

  $('board').innerHTML = COLS.map(([key, label, hint]) => {
    const list = visibleProjects.filter((p) => p.status === key)
      .sort((a, b) => projectRating(b.path) - projectRating(a.path)
        || (a.lastCommitDays ?? 1e9) - (b.lastCommitDays ?? 1e9));
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
$('board').addEventListener('keydown', async (ev) => {
  const input = ev.target.closest('[data-tag-path]');
  if (!input || ev.key !== 'Enter') return;
  ev.preventDefault();
  const tag = input.value.trim();
  if (!tag) return;
  await saveProjectTags(input.dataset.tagPath, [...projectTags(input.dataset.tagPath), tag]);
});
$('board').addEventListener('click', async (ev) => {
  const remove = ev.target.closest('[data-tag-remove]');
  if (!remove) return;
  ev.stopPropagation();
  const path = remove.dataset.tagPath;
  const target = remove.dataset.tagRemove.toLocaleLowerCase();
  await saveProjectTags(path, projectTags(path).filter((tag) => tag.toLocaleLowerCase() !== target));
});
$('todoToggle').addEventListener('click', () => {
  todoOpen = !todoOpen;
  renderTodos();
});
$('todoAdd').addEventListener('click', () => openTodoDialog());
$('todoList').addEventListener('change', async (ev) => {
  const checkbox = ev.target.closest('[data-todo-toggle]');
  if (!checkbox) return;
  const todo = todos.find((item) => item.id === checkbox.dataset.todoToggle);
  if (!todo) return;
  todo.done = checkbox.checked;
  await tiny.api.call('savePrefs', { todos });
  renderTodos();
});
$('todoList').addEventListener('click', (ev) => {
  const edit = ev.target.closest('[data-todo-edit]');
  if (edit) { openTodoDialog(edit.dataset.todoEdit); return; }
  const remove = ev.target.closest('[data-todo-delete]');
  if (remove) {
    todos = todos.filter((todo) => todo.id !== remove.dataset.todoDelete);
    tiny.api.call('savePrefs', { todos }).then(renderTodos);
  }
});
$('todoForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const text = $('todoText').value.trim();
  if (!text) {
    $('todoError').textContent = t('todoRequired');
    $('todoText').focus();
    return;
  }
  const projectPaths = [...$('todoProjects').querySelectorAll('input:checked')].map((input) => input.value);
  const existing = todos.find((todo) => todo.id === todoEditingId);
  const next = { id: todoEditingId || 'todo-' + Date.now(), text, projectPaths, done: existing?.done === true };
  todos = existing ? todos.map((todo) => todo.id === todoEditingId ? next : todo) : [next, ...todos];
  await tiny.api.call('savePrefs', { todos });
  $('todoDialog').close();
  renderTodos();
});
$('todoCancel').addEventListener('click', () => $('todoDialog').close());
$('gitClose').addEventListener('click', () => $('gitDialog').close());
$('gitTerminal').addEventListener('click', () => {
  if (gitPath) tiny.api.call('openIn', { path: gitPath, kind: 'terminal' });
});
$('gitFiles').addEventListener('click', async (ev) => {
  const button = ev.target.closest('[data-git-file]');
  if (!button) return;
  const result = await tiny.api.call('repoDiff', { path: gitPath, file: button.dataset.gitFile });
  $('gitDiffTitle').textContent = t('diff') + ': ' + button.dataset.gitFile;
  $('gitDiff').textContent = result.available ? result.diff : t('noDiff');
  $('gitDiffPanel').open = true;
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
  $('notionLabel').textContent = t(knowledgeProvider === 'obsidian' ? 'obsidianLabel' : 'notionLabel');
  $('notionUrl').placeholder = t(knowledgeProvider === 'obsidian' ? 'obsidianPlaceholder' : 'notionPlaceholder');
  $('notionCancel').textContent = t('cancel');
  $('notionRemove').textContent = t('remove');
  $('notionSave').textContent = t('save');
}

function openKnowledgeDialog(path, provider) {
  knowledgePath = path;
  knowledgeProvider = provider;
  const link = projectKnowledgeLink(path, provider);
  $('notionTitle').textContent = link ? providerText(provider, 'edit') : providerText(provider, 'title');
  $('notionLabel').textContent = t(provider === 'obsidian' ? 'obsidianLabel' : 'notionLabel');
  $('notionUrl').placeholder = t(provider === 'obsidian' ? 'obsidianPlaceholder' : 'notionPlaceholder');
  $('notionUrl').value = link;
  $('notionError').textContent = '';
  $('notionRemove').hidden = !link;
  $('notionDialog').showModal();
  $('notionUrl').focus();
}

function validKnowledgeLink(value, provider) {
  try {
    const protocol = new URL(value).protocol;
    return provider === 'obsidian'
      ? protocol === 'obsidian:'
      : protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

$('notionForm').addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const url = $('notionUrl').value.trim();
  if (!validKnowledgeLink(url, knowledgeProvider)) {
    $('notionError').textContent = t(knowledgeProvider === 'obsidian' ? 'invalidObsidianUrl' : 'invalidNotionUrl');
    $('notionUrl').focus();
    return;
  }
  const projectKnowledgeLinks = { ...(prefs.projectKnowledgeLinks || {}) };
  projectKnowledgeLinks[knowledgePath] = { ...(projectKnowledgeLinks[knowledgePath] || {}), [knowledgeProvider]: url };
  prefs.projectKnowledgeLinks = projectKnowledgeLinks;
  await tiny.api.call('savePrefs', { projectKnowledgeLinks });
  $('notionDialog').close();
  render();
});
$('notionCancel').addEventListener('click', () => $('notionDialog').close());
$('notionRemove').addEventListener('click', async () => {
  const projectKnowledgeLinks = { ...(prefs.projectKnowledgeLinks || {}) };
  const links = { ...(projectKnowledgeLinks[knowledgePath] || {}) };
  delete links[knowledgeProvider];
  if (Object.keys(links).length) projectKnowledgeLinks[knowledgePath] = links;
  else delete projectKnowledgeLinks[knowledgePath];
  prefs.projectKnowledgeLinks = projectKnowledgeLinks;
  await tiny.api.call('savePrefs', { projectKnowledgeLinks });
  $('notionDialog').close();
  render();
});

$('board').addEventListener('click', async (ev) => {
  const statusTag = ev.target.closest('[data-repo-status]');
  if (statusTag) {
    ev.stopPropagation();
    await openGitDialog(statusTag.dataset.repoStatus);
    return;
  }
  const ratingButton = ev.target.closest('[data-rating-path]');
  if (ratingButton) {
    ev.stopPropagation();
    const path = ratingButton.dataset.ratingPath;
    const value = Number(ratingButton.dataset.rating);
    const current = projectRating(path);
    const projectRatings = { ...(prefs.projectRatings || {}) };
    if (value === current) delete projectRatings[path];
    else if (Number.isInteger(value) && value >= 1 && value <= 5) projectRatings[path] = value;
    prefs.projectRatings = projectRatings;
    await tiny.api.call('savePrefs', { projectRatings });
    render();
    return;
  }
  const btn = ev.target.closest('.acts button');
  if (!btn) return;
  const path = btn.parentElement.dataset.path;
  const kind = btn.dataset.k;
  if (kind === 'notion-edit' || kind === 'obsidian-edit') {
    openKnowledgeDialog(path, kind === 'obsidian-edit' ? 'obsidian' : 'notion');
    return;
  }
  if (kind === 'notion' || kind === 'obsidian') {
    const url = projectKnowledgeLink(path, kind);
    if (url) await tiny.api.call('openUrl', { url });
    else openKnowledgeDialog(path, kind);
    return;
  }
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
  prefs.projectRatings = prefs.projectRatings || {};
  prefs.projectKnowledgeLinks = prefs.projectKnowledgeLinks || {};
  prefs.projectTags = prefs.projectTags || {};
  todos = Array.isArray(prefs.todos) ? prefs.todos : [];
  language = prefs.language || ((navigator.language || '').toLowerCase().startsWith('it') ? 'it' : 'en');
  applyLanguage();
  $('ws').textContent = prefs.workspace;
  await scan();
})().catch((e) => { $('board').innerHTML = esc(t('initFailed', { error: e })); });
