const $ = (id) => document.getElementById(id);
const esc = (s) => String(s).replace(/[&<>"']/g,
  (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const COLS = [
  ['active', 'active', 'ageActive'],
  ['idle', 'idle', 'ageIdle'],
  ['stale', 'stale', 'ageStale'],
  ['cleanup', 'cleanup', 'ageCleanup'],
  ['unknown', 'unknown', 'unknownCommitReason'],
];

let prefs = { workspace: '', ignored: [] };
let projects = [];
let language = 'en';
let activeFilter = 'all';
let locationFilter = 'all';
let viewMode = 'continue';
let contextPath = '';
let pendingSave = {};
let saveTail = Promise.resolve();
let knowledgePath = '';
let knowledgeProvider = 'notion';
let todos = [];
let todoOpen = true;
let todoEditingId = '';
let todoProjectSelection = new Set();
let gitPath = '';
let activeTag = '';
let mcpState = { state: 'stopped', endpoint: '', token: '' };
let remoteWorkspaces = [];
let remoteWorkspaceStates = [];
let workspaceEditingId = '';
const COLOR_OPTIONS = ['blue', 'green', 'yellow', 'orange', 'red', 'purple'];

const I18N = {
  en: {
    active: 'Active', idle: 'Idle', stale: 'Stale', cleanup: 'Cleanup',
    chooseWorkspace: 'Choose Workspace…', rescan: 'Rescan',
    workspace: 'Workspace', remoteWorkspaces: 'Remote workspaces', addWorkspace: 'Add workspace', editWorkspace: 'Edit workspace', sshAlias: 'SSH alias / host', sshUser: 'SSH user', sshKey: 'SSH private key', remotePath: 'Remote path', displayName: 'Display name', testConnection: 'Test connection', online: 'Online', timeout: 'Timeout', connectionError: 'Connection error', pathOrHost: 'Host or path unavailable', authentication: 'Authentication failed', malformedOutput: 'Invalid remote response', local: 'Local', ssh: 'SSH', allLocations: 'All locations', workspaceRequired: 'Enter a host/IP and an absolute path.', workspaceTestOk: 'Connection successful', workspaceTestFailed: 'Connection failed', enabled: 'Enabled', disabled: 'Disabled',
    repos: 'Repos', totalSize: 'Total size', dirty: 'Dirty', noRemote: 'No remote', reclaimable: 'Reclaimable',
    filters: 'Filters', all: 'All',
    tag: 'Tag', addTag: '+ Tag', tagPlaceholder: 'Add tag…', removeTag: 'Remove tag',
    todo: 'Todo', addTodo: 'Add todo', editTodo: 'Edit todo', task: 'Task', linkedProjects: 'Projects', searchProjects: 'Search projects…', projectSearchHint: 'Type to find projects to link', selectedProjects: '{n} selected', noMatchingProjects: 'No matching projects', clearSelection: 'Clear',
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
    mcp: 'MCP', mcpTitle: 'Local MCP', mcpDescription: 'Connect Codex to ProjectShelf locally. Only project metadata and Todo items are available.', mcpEndpoint: 'Endpoint', mcpToken: 'Token', mcpConfig: 'Codex configuration', mcpPrompt: 'Installation prompt', mcpStart: 'Start', mcpStop: 'Stop', mcpRetry: 'Retry', mcpShow: 'Show', mcpHide: 'Hide', mcpRotate: 'Regenerate token', mcpCopyConfig: 'Copy configuration', mcpCopyPrompt: 'Copy prompt', mcpRunning: 'Running', mcpStopped: 'Stopped', mcpError: 'Error', mcpCopied: 'Copied',
  },
  it: {
    active: 'Attivi', idle: 'In pausa', stale: 'Invecchiati', cleanup: 'Da pulire',
    chooseWorkspace: 'Scegli workspace…', rescan: 'Scansiona',
    workspace: 'Workspace', remoteWorkspaces: 'Workspace remoti', addWorkspace: 'Aggiungi workspace', editWorkspace: 'Modifica workspace', sshAlias: 'Alias SSH / host', sshUser: 'Utente SSH', sshKey: 'Chiave privata SSH', remotePath: 'Percorso remoto', displayName: 'Nome visualizzato', testConnection: 'Test connessione', online: 'Online', timeout: 'Timeout', connectionError: 'Errore di connessione', pathOrHost: 'Host o percorso non disponibile', authentication: 'Autenticazione fallita', malformedOutput: 'Risposta remota non valida', local: 'Locale', ssh: 'SSH', allLocations: 'Tutte le posizioni', workspaceRequired: 'Inserisci host/IP e un percorso assoluto.', workspaceTestOk: 'Connessione riuscita', workspaceTestFailed: 'Connessione fallita', enabled: 'Attivo', disabled: 'Disattivato',
    repos: 'Repo', totalSize: 'Dimensione totale', dirty: 'Modificati', noRemote: 'Senza remote', reclaimable: 'Recuperabile',
    filters: 'Filtri', all: 'Tutti',
    tag: 'Tag', addTag: '+ Tag', tagPlaceholder: 'Aggiungi tag…', removeTag: 'Rimuovi tag',
    todo: 'Todo', addTodo: 'Aggiungi todo', editTodo: 'Modifica todo', task: 'Attività', linkedProjects: 'Progetti', searchProjects: 'Cerca progetti…', projectSearchHint: 'Scrivi per cercare i progetti da collegare', selectedProjects: '{n} selezionati', noMatchingProjects: 'Nessun progetto corrispondente', clearSelection: 'Azzera',
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
    mcp: 'MCP', mcpTitle: 'MCP locale', mcpDescription: 'Collega Codex a ProjectShelf in locale. Sono disponibili solo metadati dei progetti e Todo.', mcpEndpoint: 'Endpoint', mcpToken: 'Token', mcpConfig: 'Configurazione Codex', mcpPrompt: 'Prompt di installazione', mcpStart: 'Avvia', mcpStop: 'Ferma', mcpRetry: 'Riprova', mcpShow: 'Mostra', mcpHide: 'Nascondi', mcpRotate: 'Rigenera token', mcpCopyConfig: 'Copia configurazione', mcpCopyPrompt: 'Copia prompt', mcpRunning: 'Attivo', mcpStopped: 'Fermo', mcpError: 'Errore', mcpCopied: 'Copiato',
  },
};

Object.assign(I18N.en, {
  continue: 'To resume', recent: 'Recent', favorites: 'Favorites', resume: 'Resume', context: 'Context',
  goal: 'Goal', checkpoint: 'Where I left off', nextAction: 'Next step', blocker: 'Blocker', environment: 'Open with',
  openTerminalLabel: 'Also open Terminal', openReferencesLabel: 'Also open linked notes',
  search: 'Search name, path, tag, stack…', lastOpened: 'Last session', neverOpened: 'Not opened here yet',
  favorite: 'Add to favorites', unfavorite: 'Remove from favorites', more: 'More',
  globalTodo: 'Todo · all workspaces', scope: '{visible} of {total} projects · counters and filters cover all workspaces',
  limits: 'Local scan: depth 3, up to 400 repositories', saved: 'Saved', saving: 'Saving…', saveError: 'Not saved. Retry before closing the app.', retry: 'Retry', operationError: 'Operation failed',
  exportBackup: 'Export metadata…', importBackup: 'Import metadata…', backup: 'Backup', exported: 'Metadata exported', imported: 'Missing metadata restored; existing entries preserved',
  importConfirm: 'Restore missing metadata from this backup?', importDetail: 'Existing entries and workspace settings stay unchanged. A pre-import snapshot is saved locally. This does not import repository files or MCP tokens.',
  unknown: 'Unknown', unknownCommitReason: 'commit date unavailable', ageActive: '< 30 days', ageIdle: '30–89 days', ageStale: '90–179 days', ageCleanup: '≥ 180 days',
  safeToRemove: 'No issues detected on the current branch', doNotDelete: 'Checks to review', reclaimable: 'Review candidates',
  safetyNote: 'Not a backup guarantee: check all branches, tags, stashes, ignored files and remote availability before deleting anything.',
  emptyView: 'No matching projects. Try another view or clear the search and filters.',
  remoteResumeHint: 'SSH projects resume in Terminal with the configured key.',
  gitUnavailableReason: 'Git checks failed',
});
Object.assign(I18N.it, {
  continue: 'Da continuare', recent: 'Recenti', favorites: 'Preferiti', resume: 'Riprendi', context: 'Contesto',
  goal: 'Obiettivo', checkpoint: 'Dove ero rimasto', nextAction: 'Prossimo passo', blocker: 'Blocco', environment: 'Apri con',
  openTerminalLabel: 'Apri anche il Terminale', openReferencesLabel: 'Apri anche le note collegate',
  search: 'Cerca nome, percorso, tag, stack…', lastOpened: 'Ultima sessione', neverOpened: 'Non ancora aperto da qui',
  favorite: 'Aggiungi ai preferiti', unfavorite: 'Rimuovi dai preferiti', more: 'Altro',
  globalTodo: 'Todo · tutti i workspace', scope: '{visible} di {total} progetti · contatori e filtri su tutti i workspace',
  limits: 'Scansione locale: profondità 3, massimo 400 repository', saved: 'Salvato', saving: 'Salvataggio…', saveError: 'Non salvato. Riprova prima di chiudere l’app.', retry: 'Riprova', operationError: 'Operazione non riuscita',
  exportBackup: 'Esporta metadati…', importBackup: 'Importa metadati…', backup: 'Backup', exported: 'Metadati esportati', imported: 'Metadati mancanti ripristinati; dati esistenti preservati',
  importConfirm: 'Ripristinare i metadati mancanti da questo backup?', importDetail: 'I dati esistenti e le impostazioni dei workspace restano invariati. Viene salvata una copia locale pre-importazione. Non importa file dei repository o token MCP.',
  unknown: 'Sconosciuti', unknownCommitReason: 'data commit non disponibile', ageActive: '< 30 giorni', ageIdle: '30–89 giorni', ageStale: '90–179 giorni', ageCleanup: '≥ 180 giorni',
  safeToRemove: 'Nessun problema rilevato sul branch corrente', doNotDelete: 'Controlli da rivedere', reclaimable: 'Da verificare',
  safetyNote: 'Non garantisce un backup: verifica tutti i branch, tag, stash, file ignorati e disponibilità del remote prima di cancellare.',
  emptyView: 'Nessun progetto corrispondente. Cambia vista oppure azzera ricerca e filtri.',
  remoteResumeHint: 'I progetti SSH si riprendono nel Terminale con la chiave configurata.',
  gitUnavailableReason: 'controlli Git non riusciti',
});

function feedback(message, retry = false) {
  $('feedback').hidden = false;
  $('feedbackText').textContent = message;
  $('saveRetry').hidden = !retry;
  document.querySelectorAll('.dialog-feedback').forEach((element) => {
    element.innerHTML = retry ? `${esc(message)} <button type="button" data-save-retry>${esc(t('retry'))}</button>` : '';
  });
}

function savePrefs(payload) {
  Object.assign(pendingSave, payload);
  feedback(t('saving'));
  const task = saveTail.catch(() => {}).then(async () => {
    const snapshot = { ...pendingSave };
    try {
      if (await tiny.api.call('savePrefs', snapshot) === false) throw new Error('Save rejected');
      for (const [key, value] of Object.entries(snapshot)) if (pendingSave[key] === value) delete pendingSave[key];
      feedback(t('saved'));
    } catch (error) { feedback(t('saveError'), true); throw error; }
  });
  saveTail = task;
  return task;
}

function projectContext(path) { return prefs.projectContexts?.[path] || {}; }

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
    if (key === 'unknownCommit') return t('unknownCommitReason');
    if (key === 'gitUnavailable') return t('gitUnavailableReason');
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
  await savePrefs({ projectTags: projectTagsMap });
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
  const isRemoteProject = p.location === 'remote';
  const tags = [];
  const color = projectColor(p.path);
  if (isRemoteProject) tags.push(`<span class="tag ssh-location">SSH · ${esc(p.sshAlias)}</span>`);
  if (p.dirty) tags.push(`<button class="tag dirty status-trigger" data-repo-status="${esc(p.path)}" aria-label="${esc(t('gitStatus'))}">● ${p.dirtyFiles} ${esc(t('modified'))}</button>`);
  if (!p.remote) tags.push(`<span class="tag noremote">⚠ ${esc(t('noRemote'))}</span>`);
  if (p.unpushed) tags.push(`<span class="tag unpushed">↑ ${p.unpushed} ${esc(t('unpushed'))}</span>`);
  if (!tags.length) tags.push(`<span class="tag">${esc(t('clean'))}</span>`);
  const customTags = projectTags(p.path).map((tag) => `<span class="tag project-tag">${esc(tag)}<button data-tag-remove="${esc(tag)}" data-tag-path="${esc(p.path)}" aria-label="${esc(t('removeTag'))}">×</button></span>`);

  const safety = p.safeToRemove
    ? `<div class="safety">${esc(t('safeToRemove'))}</div>`
    : `<div class="safety">${esc(t('doNotDelete'))} — ${esc(formatReasons(p))}</div>`;
  const context = projectContext(p.path);
  const linked = todos.filter((todo) => !todo.done && todo.projectPaths.includes(p.path));
  const favoriteLabel = t(context.favorite ? 'unfavorite' : 'favorite');

  return `<article class="card${color ? ` project-color-${color}` : ''}">
    <div class="card-head"><h3>${esc(p.name)}</h3><button class="favorite ${context.favorite ? 'active' : ''}" data-favorite="${esc(p.path)}" aria-label="${esc(favoriteLabel)}" aria-pressed="${!!context.favorite}" title="${esc(favoriteLabel)}">${context.favorite ? '♥' : '♡'}</button></div>
    <div class="project-path" title="${esc(p.path)}">${esc(p.path)}</div>
    <div class="meta">${esc(p.stack)} · ${esc(p.branch)}${isRemoteProject ? ` · SSH ${esc(p.sshAlias)}` : ''}</div>
    <div class="card-tools">${ratingControl(p)}${colorPicker(p)}</div>
    <div class="tags">${tags.join('')}${customTags.join('')}</div>
    ${['goal', 'checkpoint', 'nextAction', 'blocker'].filter((key) => context[key]).map((key) => `<div class="context-line ${key}"><span>${esc(t(key))}</span><p>${esc(context[key])}</p></div>`).join('')}
    ${linked.length ? `<div class="card-todos">${linked.map((todo) => `<button data-card-todo="${esc(todo.id)}">○ ${esc(todo.text)}</button>`).join('')}</div>` : ''}
    <div class="row"><span>${esc(t('lastOpened'))}</span><b>${context.lastOpened ? esc(new Date(context.lastOpened).toLocaleDateString(language)) : esc(t('neverOpened'))}</b></div>
    <div class="row"><span>${esc(t('latestCommit'))}</span><b>${esc(fmtAge(p.lastCommitDays))}</b></div>
    ${viewMode === 'cleanup' ? safety + `<div class="row"><span>${esc(t('size'))}</span><b>${fmtSize(p.sizeMB)}</b></div>` : ''}
    <div class="card-primary">
      <button class="primary" data-resume="${esc(p.path)}">${esc(t('resume'))}</button>
      <button data-context="${esc(p.path)}">${esc(t('context'))}</button>
      <details class="card-menu"><summary>${esc(t('more'))}</summary><div class="acts" data-path="${esc(p.path)}">
      <button data-k="todo">${esc(t('addTodo'))}</button>
      <button data-k="status">${esc(t('gitStatus'))}</button>
      ${['notion', 'obsidian'].map((provider) => {
        const link = projectKnowledgeLink(p.path, provider);
        return `<button class="${provider}-action" data-k="${provider}">${esc(link ? t(provider) : providerText(provider, 'add'))}</button>
          ${link ? `<button data-k="${provider}-edit">${esc(providerText(provider, 'edit'))}</button>` : ''}`;
      }).join('')}
      ${isRemoteProject ? '' : `<button data-k="finder">${esc(t('finder'))}</button>`}
      <button data-k="terminal">${esc(t('terminal'))}</button>
      ${isRemoteProject ? '' : `<button data-k="code">${esc(t('vsCode'))}</button>`}
      <button data-k="copy">${esc(t('copyPath'))}</button>
      <input class="tag-input" data-tag-path="${esc(p.path)}" maxlength="50" placeholder="${esc(t('tagPlaceholder'))}" aria-label="${esc(t('addTag'))}">
      </div></details>
    </div>
  </article>`;
}

function projectName(path) {
  const project = projects.find((item) => item.path === path);
  return project ? project.name : '';
}

function renderTodos() {
  const openCount = todos.filter((todo) => !todo.done).length;
  $('todoTitle').textContent = t('globalTodo');
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
      <label class="todo-check"><input type="checkbox" aria-label="${esc(todo.text)}" data-todo-toggle="${esc(todo.id)}" ${todo.done ? 'checked' : ''}><span></span></label>
      <span class="todo-text">${esc(todo.text)}</span>
      <span class="todo-project-chips">${chips}</span>
      <button class="todo-action" data-todo-edit="${esc(todo.id)}">${esc(t('editTodo'))}</button>
      <button class="todo-action danger" data-todo-delete="${esc(todo.id)}">${esc(t('deleteTodo'))}</button>
    </div>`;
  }).join('') : `<div class="todo-empty">${esc(t('noTodos'))}</div>`;
}

function renderTodoProjectPicker(query = '') {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const selected = [...todoProjectSelection];
  const matches = normalizedQuery ? projects.filter((project) => (project.name + ' ' + project.path).toLocaleLowerCase().includes(normalizedQuery)) : [];
  $('todoSelected').innerHTML = selected.length
    ? `<div class="todo-selected-head"><span>${esc(t('selectedProjects', { n: selected.length }))}</span><button type="button" class="todo-clear" id="todoClearSelection">${esc(t('clearSelection'))}</button></div><div class="todo-selected-chips">${selected.map((path) => `<button type="button" class="todo-selected-chip" data-todo-project-remove="${esc(path)}">${esc(projectName(path))} ×</button>`).join('')}</div>`
    : `<span class="todo-selection-empty">${esc(t('linkedProjects'))}</span>`;
  $('todoProjectOptions').innerHTML = normalizedQuery && matches.length
    ? matches.map((project) => {
      const isSelected = todoProjectSelection.has(project.path);
      return `<button type="button" class="todo-project-option ${isSelected ? 'selected' : ''}" aria-pressed="${isSelected}" data-todo-project="${esc(project.path)}"><span class="todo-project-mark">${isSelected ? '✓' : '+'}</span><span>${esc(project.name)}<small>${esc(project.path)}</small></span></button>`;
    }).join('')
    : `<div class="todo-empty">${esc(normalizedQuery ? t('noMatchingProjects') : t('projectSearchHint'))}</div>`;
}

function openTodoDialog(id = '', path = '') {
  todoEditingId = id;
  const todo = todos.find((item) => item.id === id);
  todoProjectSelection = new Set(todo?.projectPaths || (path ? [path] : []));
  $('todoDialogTitle').textContent = todo ? t('editTodo') : t('addTodo');
  $('todoTextLabel').textContent = t('task');
  $('todoProjectsLabel').textContent = t('linkedProjects');
  $('todoText').value = todo ? todo.text : '';
  $('todoError').textContent = '';
  $('todoProjects').innerHTML = `<input id="todoProjectSearch" class="todo-project-search" type="search" autocomplete="off" aria-label="${esc(t('searchProjects'))}" placeholder="${esc(t('searchProjects'))}"><div id="todoSelected" class="todo-selected"></div><div id="todoProjectOptions" class="todo-project-options"></div>`;
  renderTodoProjectPicker();
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
  $('views').innerHTML = ['continue', 'recent', 'favorites', 'cleanup'].map((view) => `<button data-view="${view}" class="${viewMode === view ? 'active' : ''}" aria-pressed="${viewMode === view}">${esc(t(view))}</button>`).join('');
  const total = projects.length;
  const bytes = projects.reduce((n, p) => n + p.sizeMB, 0);
  const reclaim = projects.filter((p) => p.safeToRemove).reduce((n, p) => n + p.sizeMB, 0);
  $('stats').innerHTML = (viewMode === 'cleanup' ? [
    [t('repos'), total],
    [t('totalSize'), fmtSize(bytes)],
    [t('dirty'), projects.filter((p) => p.dirty).length],
    [t('noRemote'), projects.filter((p) => !p.remote).length],
    [t('reclaimable'), fmtSize(reclaim)],
  ] : []).map(([k, v]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join('');

  const filters = [
    ['all', t('all'), total],
    ['dirty', t('dirty'), projects.filter((p) => p.dirty).length],
    ['noRemote', t('noRemote'), projects.filter((p) => !p.remote).length],
    ['reclaimable', t('reclaimable'), projects.filter((p) => p.safeToRemove).length],
  ];
  const locationFilters = [
    ['all', t('allLocations'), projects.length],
    ['local', t('local'), projects.filter((p) => p.location !== 'remote').length],
    ['remote', t('ssh'), projects.filter((p) => p.location === 'remote').length],
  ];
  const locationFilterHtml = `<span class="filter-label location-filter-label">${esc(t('workspace'))}</span>` + locationFilters.map(([key, label, count]) =>
    `<button class="filter ${locationFilter === key ? 'active' : ''}" data-location="${key}">${esc(label)} <b>${count}</b></button>`,
  ).join('');
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
  $('filters').innerHTML = locationFilterHtml + `<span class="filter-label">${esc(t('filters'))}</span>` + filters.map(([key, label, count]) =>
    `<button class="filter ${activeFilter === key ? 'active' : ''}" data-filter="${key}">${esc(label)} <b>${count}</b></button>`,
  ).join('') + ratingFilter + (tagFilters ? `<span class="filter-label tag-filter-label">${esc(t('tag'))}</span>${tagFilters}` : '');
  renderTodos();

  const visibleProjects = projects.filter((p) => {
    const query = $('search').value.trim().toLocaleLowerCase();
    if (query && ![p.name, p.path, p.stack, ...projectTags(p.path)].join(' ').toLocaleLowerCase().includes(query)) return false;
    if (viewMode === 'favorites' && !projectContext(p.path).favorite) return false;
    if (viewMode === 'recent' && !projectContext(p.path).lastOpened) return false;
    if (locationFilter === 'local' && p.location === 'remote') return false;
    if (locationFilter === 'remote' && p.location !== 'remote') return false;
    if (activeFilter === 'dirty') return p.dirty;
    if (activeFilter === 'noRemote') return !p.remote;
    if (activeFilter === 'reclaimable') return p.safeToRemove;
    if (activeFilter.startsWith('rating-')) return projectRating(p.path) >= Number(activeFilter.slice(7));
    if (activeFilter.startsWith('tag:')) return projectTags(p.path).some((tag) => tag.toLocaleLowerCase() === activeFilter.slice(4));
    return true;
  });

  $('board').classList.toggle('work-board', viewMode !== 'cleanup');
  const scope = `<div class="board-scope">${esc(t('scope', { visible: visibleProjects.length, total }))}<br>${esc(t('limits'))}</div>`;
  if (viewMode !== 'cleanup') {
    visibleProjects.sort((a, b) => viewMode === 'recent'
      ? (projectContext(b.path).lastOpened || 0) - (projectContext(a.path).lastOpened || 0)
      : Number(!!projectContext(b.path).favorite) - Number(!!projectContext(a.path).favorite)
        || projectRating(b.path) - projectRating(a.path)
        || Number(!!projectContext(b.path).nextAction) - Number(!!projectContext(a.path).nextAction)
        || (projectContext(b.path).lastOpened || 0) - (projectContext(a.path).lastOpened || 0)
        || (a.lastCommitDays ?? 1e9) - (b.lastCommitDays ?? 1e9));
    $('board').innerHTML = scope + (visibleProjects.length ? visibleProjects.map(card).join('') : `<div class="empty">${esc(t('emptyView'))}</div>`);
    return;
  }
  $('board').innerHTML = scope + `<p class="cleanup-note">${esc(t('safetyNote'))}</p>` + COLS.map(([key, label, hint]) => {
    const list = visibleProjects.filter((p) => p.status === key)
      .sort((a, b) => projectRating(b.path) - projectRating(a.path)
        || (a.lastCommitDays ?? 1e9) - (b.lastCommitDays ?? 1e9));
    return `<div class="col ${key}">
      <h2><i></i>${esc(t(label))} <em>${esc(t(hint))} · ${list.length}</em></h2>
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
    remoteWorkspaceStates = res.remoteWorkspaces || [];
    render();
    if ($('todoDialog').open) renderTodoProjectPicker($('todoProjectSearch')?.value || '');
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
tiny.api.on('scan-remote-progress', ({ done, total, state }) => {
  $('fill').style.width = (total ? (done / total) * 200 : 0) + 'px';
  $('barText').textContent = `${done} / ${total} SSH · ${state}`;
});

function workspaceStateLabel(state) {
  if (state === 'online') return t('online');
  if (state === 'timeout') return t('timeout');
  return t('connectionError');
}

function renderWorkspaceList() {
  $('workspaceList').innerHTML = remoteWorkspaces.length ? remoteWorkspaces.map((workspace) => {
    const status = remoteWorkspaceStates.find((item) => item.id === workspace.id);
    return `<div class="workspace-row ${workspace.enabled ? '' : 'disabled'}">
      <div class="workspace-row-main"><b>${esc(workspace.name)}</b><span>${esc(workspace.user ? `${workspace.user}@${workspace.alias}` : workspace.alias)} · ${esc(workspace.path)} · ${esc(workspace.identityFile || '~/.ssh/id_rsa')}</span>${status ? `<em class="workspace-state ${status.connectionState}">${esc(workspaceStateLabel(status.connectionState))}</em>` : ''}</div>
      <button type="button" data-workspace-toggle="${esc(workspace.id)}">${esc(workspace.enabled ? t('enabled') : t('disabled'))}</button>
      <button type="button" data-workspace-edit="${esc(workspace.id)}">${esc(t('editWorkspace'))}</button>
    </div>`;
  }).join('') : `<div class="todo-empty">${esc(t('noProjects'))}</div>`;
}

function resetWorkspaceForm() {
  workspaceEditingId = '';
  $('workspaceFormTitle').textContent = t('addWorkspace');
  $('workspaceAlias').value = '';
  $('workspaceUser').value = '';
  $('workspaceKey').value = '~/.ssh/id_rsa';
  $('workspacePath').value = '';
  $('workspaceName').value = '';
  $('workspaceError').textContent = '';
  $('workspaceRemove').hidden = true;
}

function openWorkspaceDialog(id = '') {
  workspaceEditingId = id;
  const workspace = remoteWorkspaces.find((item) => item.id === id);
  $('workspaceFormTitle').textContent = workspace ? t('editWorkspace') : t('addWorkspace');
  $('workspaceAlias').value = workspace?.alias || '';
  $('workspaceUser').value = workspace?.user || '';
  $('workspaceKey').value = workspace?.identityFile || '~/.ssh/id_rsa';
  $('workspacePath').value = workspace?.path || '';
  $('workspaceName').value = workspace?.name || '';
  $('workspaceError').textContent = '';
  $('workspaceRemove').hidden = !workspace;
  $('workspaceDialog').showModal();
  $('workspaceAlias').focus();
}

function workspaceFormValue() {
  const alias = $('workspaceAlias').value.trim();
  const user = $('workspaceUser').value.trim();
  const identityFile = $('workspaceKey').value.trim() || '~/.ssh/id_rsa';
  const path = $('workspacePath').value.trim();
  if (!alias || !path.startsWith('/')) throw new Error(t('workspaceRequired'));
  return { alias, host: alias, user, identityFile, path, name: $('workspaceName').value.trim(), enabled: true };
}

function workspaceId(value) {
  const target = value.user ? `${value.user}@${value.alias}` : value.alias;
  return `remote-${target}-${value.path.replace(/^\/+|\/+$/g, '').replace(/[^A-Za-z0-9._-]+/g, '-') || 'root'}`;
}

async function saveWorkspaceForm() {
  try {
    const value = workspaceFormValue();
    if (workspaceEditingId) {
      const old = remoteWorkspaces.find((item) => item.id === workspaceEditingId);
      remoteWorkspaces = remoteWorkspaces.map((item) => item.id === workspaceEditingId ? { ...value, id: workspaceId(value), enabled: old?.enabled !== false } : item);
    } else remoteWorkspaces = [...remoteWorkspaces, { ...value, id: workspaceId(value) }];
    await savePrefs({ remoteWorkspaces });
    prefs.remoteWorkspaces = remoteWorkspaces;
    $('workspaceDialog').close();
    renderWorkspaceList();
    await scan();
  } catch (error) { $('workspaceError').textContent = error.message || t('workspaceRequired'); }
}

async function pick() {
  const path = await tiny.dialog.pickFolder();
  if (!path) return;
  prefs.workspace = path;
  await savePrefs({ workspace: path });
  await scan();
}

function mcpStatusText(state) {
  if (state === 'running') return t('mcpRunning');
  if (state === 'error') return t('mcpError');
  return t('mcpStopped');
}

async function refreshMcpDialog() {
  const info = await tiny.api.call('mcpConfig');
  mcpState = info;
  $('mcpStatus').textContent = `${mcpStatusText(info.state)}${info.error ? ': ' + info.error : ''}`;
  $('mcpStatus').className = `mcp-status ${info.state}`;
  $('mcpEndpoint').value = info.url || '';
  $('mcpToken').value = info.token || '';
  $('mcpConfig').value = info.config || '';
  $('mcpPrompt').value = info.prompt || '';
  $('mcpStart').textContent = info.state === 'error' ? t('mcpRetry') : t('mcpStart');
  $('mcpStop').disabled = info.state !== 'running';
  $('mcpStart').disabled = info.state === 'running';
  $('mcpRotate').disabled = info.state !== 'running';
}

async function copyMcpField(id, buttonId) {
  tiny.clipboard.write({ text: $(id).value });
  const button = $(buttonId);
  const old = button.textContent;
  button.textContent = t('mcpCopied');
  setTimeout(() => { button.textContent = old; }, 1000);
}

$('pick').addEventListener('click', pick);
$('rescan').addEventListener('click', scan);
$('workspaceOpen').addEventListener('click', () => {
  renderWorkspaceList();
  resetWorkspaceForm();
  $('workspaceDialog').showModal();
});
$('workspaceClose').addEventListener('click', () => $('workspaceDialog').close());
$('workspaceCancel').addEventListener('click', () => $('workspaceDialog').close());
$('workspaceNew').addEventListener('click', resetWorkspaceForm);
$('workspaceForm').addEventListener('submit', async (ev) => { ev.preventDefault(); await saveWorkspaceForm(); });
$('workspaceList').addEventListener('click', async (ev) => {
  const edit = ev.target.closest('[data-workspace-edit]');
  if (edit) { openWorkspaceDialog(edit.dataset.workspaceEdit); return; }
  const toggle = ev.target.closest('[data-workspace-toggle]');
  if (!toggle) return;
  remoteWorkspaces = remoteWorkspaces.map((item) => item.id === toggle.dataset.workspaceToggle ? { ...item, enabled: !item.enabled } : item);
  prefs.remoteWorkspaces = remoteWorkspaces;
  await savePrefs({ remoteWorkspaces });
  renderWorkspaceList();
});
$('workspaceRemove').addEventListener('click', async () => {
  if (!workspaceEditingId) return;
  remoteWorkspaces = remoteWorkspaces.filter((item) => item.id !== workspaceEditingId);
  prefs.remoteWorkspaces = remoteWorkspaces;
  await savePrefs({ remoteWorkspaces });
  renderWorkspaceList();
  resetWorkspaceForm();
});
$('workspaceTest').addEventListener('click', async () => {
  try {
    const result = await tiny.api.call('testRemoteWorkspace', { workspace: workspaceFormValue() });
    $('workspaceError').textContent = result.connectionState === 'online' ? t('workspaceTestOk') : `${t('workspaceTestFailed')}: ${result.errorMessage || result.connectionState}`;
  } catch (error) { $('workspaceError').textContent = error.message || t('workspaceTestFailed'); }
});
$('mcpOpen').addEventListener('click', async () => {
  $('mcpDialog').showModal();
  await refreshMcpDialog();
});
$('mcpClose').addEventListener('click', () => $('mcpDialog').close());
$('mcpStart').addEventListener('click', async () => {
  await tiny.api.call('mcpStart');
  await refreshMcpDialog();
});
$('mcpStop').addEventListener('click', async () => {
  await tiny.api.call('mcpStop');
  await refreshMcpDialog();
});
$('mcpRotate').addEventListener('click', async () => {
  await tiny.api.call('mcpRotateToken');
  await refreshMcpDialog();
});
$('mcpReveal').addEventListener('click', () => {
  const input = $('mcpToken');
  input.type = input.type === 'password' ? 'text' : 'password';
  $('mcpReveal').textContent = input.type === 'password' ? t('mcpShow') : t('mcpHide');
});
$('mcpCopyConfig').addEventListener('click', () => copyMcpField('mcpConfig', 'mcpCopyConfig'));
$('mcpCopyPrompt').addEventListener('click', () => copyMcpField('mcpPrompt', 'mcpCopyPrompt'));
$('filters').addEventListener('click', (ev) => {
  const location = ev.target.closest('[data-location]');
  if (location) {
    locationFilter = location.dataset.location;
    render();
    return;
  }
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
$('todoProjects').addEventListener('input', (ev) => {
  if (ev.target.id === 'todoProjectSearch') renderTodoProjectPicker(ev.target.value);
});
$('todoProjects').addEventListener('click', (ev) => {
  const project = ev.target.closest('[data-todo-project]');
  const remove = ev.target.closest('[data-todo-project-remove]');
  if (project) {
    const path = project.dataset.todoProject;
    if (todoProjectSelection.has(path)) todoProjectSelection.delete(path);
    else todoProjectSelection.add(path);
    const search = $('todoProjectSearch').value;
    renderTodoProjectPicker(search);
    $('todoProjectSearch').focus();
    return;
  }
  if (remove) {
    todoProjectSelection.delete(remove.dataset.todoProjectRemove);
    renderTodoProjectPicker($('todoProjectSearch').value);
    $('todoProjectSearch').focus();
    return;
  }
  if (ev.target.id === 'todoClearSelection') {
    todoProjectSelection.clear();
    renderTodoProjectPicker($('todoProjectSearch').value);
    $('todoProjectSearch').focus();
  }
});
$('todoList').addEventListener('change', async (ev) => {
  const checkbox = ev.target.closest('[data-todo-toggle]');
  if (!checkbox) return;
  const todo = todos.find((item) => item.id === checkbox.dataset.todoToggle);
  if (!todo) return;
  todo.done = checkbox.checked;
  await savePrefs({ todos });
  renderTodos();
});
$('todoList').addEventListener('click', (ev) => {
  const edit = ev.target.closest('[data-todo-edit]');
  if (edit) { openTodoDialog(edit.dataset.todoEdit); return; }
  const remove = ev.target.closest('[data-todo-delete]');
  if (remove) {
    todos = todos.filter((todo) => todo.id !== remove.dataset.todoDelete);
    savePrefs({ todos }).then(renderTodos);
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
  const projectPaths = [...todoProjectSelection];
  const existing = todos.find((todo) => todo.id === todoEditingId);
  const next = { id: todoEditingId || 'todo-' + Date.now(), text, projectPaths, done: existing?.done === true };
  todos = existing ? todos.map((todo) => todo.id === todoEditingId ? next : todo) : [next, ...todos];
  await savePrefs({ todos });
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
  await savePrefs({ projectColors });
  render();
});
$('language').addEventListener('click', async () => {
  language = language === 'it' ? 'en' : 'it';
  prefs.language = language;
  await savePrefs({ language });
  applyLanguage();
  render();
});
tiny.api.on('menu', (id) => { if (id === 'pick') pick(); if (id === 'rescan') scan(); });

function applyLanguage() {
  document.documentElement.lang = language;
  $('search').placeholder = t('search');
  $('search').setAttribute('aria-label', t('search'));
  $('views').setAttribute('aria-label', t('continue'));
  $('exportBackup').textContent = t('exportBackup');
  $('importBackup').textContent = t('importBackup');
  $('backupLabel').textContent = t('backup');
  $('saveRetry').textContent = t('retry');
  for (const id of ['gitClose', 'mcpClose', 'workspaceClose']) $(id).setAttribute('aria-label', t('close'));
  $('filters').setAttribute('aria-label', t('filters'));
  $('language').textContent = language === 'it' ? 'EN' : 'IT';
  $('language').title = t('changeLanguage');
  $('language').setAttribute('aria-label', t('changeLanguage'));
  $('pick').textContent = t('chooseWorkspace');
  $('rescan').textContent = t('rescan');
  $('workspaceOpen').textContent = t('workspace');
  $('workspaceTitle').textContent = t('remoteWorkspaces');
  $('workspaceFormTitle').textContent = workspaceEditingId ? t('editWorkspace') : t('addWorkspace');
  $('workspaceAliasLabel').textContent = t('sshAlias');
  $('workspaceUserLabel').textContent = t('sshUser');
  $('workspaceKeyLabel').textContent = t('sshKey');
  $('workspacePathLabel').textContent = t('remotePath');
  $('workspaceNameLabel').textContent = t('displayName');
  $('workspaceTest').textContent = t('testConnection');
  $('workspaceCancel').textContent = t('cancel');
  $('workspaceRemove').textContent = t('remove');
  $('workspaceSave').textContent = t('save');
  $('mcpOpen').textContent = t('mcp');
  $('mcpTitle').textContent = t('mcpTitle');
  $('mcpDescription').textContent = t('mcpDescription');
  $('mcpEndpointLabel').textContent = t('mcpEndpoint');
  $('mcpTokenLabel').textContent = t('mcpToken');
  $('mcpConfigLabel').textContent = t('mcpConfig');
  $('mcpPromptLabel').textContent = t('mcpPrompt');
  $('mcpReveal').textContent = t('mcpShow');
  $('mcpRotate').textContent = t('mcpRotate');
  $('mcpCopyConfig').textContent = t('mcpCopyConfig');
  $('mcpCopyPrompt').textContent = t('mcpCopyPrompt');
  $('mcpStop').textContent = t('mcpStop');
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
  await savePrefs({ projectKnowledgeLinks });
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
  await savePrefs({ projectKnowledgeLinks });
  $('notionDialog').close();
  render();
});

$('board').addEventListener('click', async (ev) => {
  const contextButton = ev.target.closest('[data-context]');
  if (contextButton) { openContextDialog(contextButton.dataset.context); return; }
  const favoriteButton = ev.target.closest('[data-favorite]');
  if (favoriteButton) {
    const path = favoriteButton.dataset.favorite;
    prefs.projectContexts = { ...prefs.projectContexts, [path]: { ...projectContext(path), favorite: !projectContext(path).favorite } };
    await savePrefs({ projectContexts: prefs.projectContexts });
    render(); return;
  }
  const todoButton = ev.target.closest('[data-card-todo]');
  if (todoButton) { openTodoDialog(todoButton.dataset.cardTodo); return; }
  const resumeButton = ev.target.closest('[data-resume]');
  if (resumeButton) {
    resumeButton.disabled = true;
    try {
      await saveTail;
      const context = await tiny.api.call('resumeProject', { path: resumeButton.dataset.resume });
      prefs.projectContexts = { ...prefs.projectContexts, [resumeButton.dataset.resume]: context };
      render();
    } catch (error) { feedback(t('operationError') + ': ' + error, Object.keys(pendingSave).length > 0); }
    finally { resumeButton.disabled = false; }
    return;
  }
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
    await savePrefs({ projectRatings });
    render();
    return;
  }
  const btn = ev.target.closest('.acts button');
  if (!btn) return;
  const path = btn.parentElement.dataset.path;
  const kind = btn.dataset.k;
  btn.closest('.card-menu')?.removeAttribute('open');
  if (kind === 'todo') { openTodoDialog('', path); return; }
  if (kind === 'status') { await openGitDialog(path); return; }
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
  const project = projects.find((item) => item.path === path);
  if (kind === 'terminal' && project?.location === 'remote') {
    await tiny.api.call('openRemoteTerminal', { alias: project.sshAlias, user: project.sshUser, identityFile: project.sshIdentityFile, path: project.remotePath });
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
  prefs.projectContexts = prefs.projectContexts || {};
  prefs.remoteWorkspaces = Array.isArray(prefs.remoteWorkspaces) ? prefs.remoteWorkspaces : [];
  remoteWorkspaces = prefs.remoteWorkspaces;
  todos = Array.isArray(prefs.todos) ? prefs.todos : [];
  language = prefs.language || ((navigator.language || '').toLowerCase().startsWith('it') ? 'it' : 'en');
  applyLanguage();
  render();
  $('board').innerHTML = `<div class="empty">${esc(t('finding'))}</div>`;
  $('ws').textContent = prefs.workspace;
  await scan();
})().catch((e) => { $('board').innerHTML = esc(t('initFailed', { error: e })); });

function openContextDialog(path) {
  contextPath = path;
  const context = projectContext(path);
  $('contextTitle').textContent = projectName(path) + ' · ' + t('context');
  $('contextPath').textContent = path;
  for (const key of ['goal', 'checkpoint', 'nextAction', 'blocker']) {
    $(key + 'Label').textContent = t(key);
    $(key).value = context[key] || '';
  }
  const remote = projects.find((project) => project.path === path)?.location === 'remote';
  $('environmentLabel').textContent = t('environment');
  $('environment').value = remote ? 'terminal' : context.environment || 'code';
  $('environment').disabled = remote;
  $('remoteResumeHint').hidden = !remote;
  $('remoteResumeHint').textContent = t('remoteResumeHint');
  for (const key of ['openTerminal', 'openReferences']) {
    $(key).checked = !!context[key];
    $(key + 'Label').textContent = t(key + 'Label');
  }
  $('openTerminal').disabled = remote;
  $('contextClose').setAttribute('aria-label', t('close'));
  $('contextCancel').textContent = t('cancel');
  $('contextSave').textContent = t('save');
  $('contextDialog').showModal();
  $('nextAction').focus();
}

$('contextClose').onclick = $('contextCancel').onclick = () => $('contextDialog').close();
$('contextForm').onsubmit = async (event) => {
  event.preventDefault();
  const context = { ...projectContext(contextPath), environment: $('environment').value };
  for (const key of ['goal', 'checkpoint', 'nextAction', 'blocker']) context[key] = $(key).value.trim();
  for (const key of ['openTerminal', 'openReferences']) context[key] = $(key).checked;
  prefs.projectContexts = { ...prefs.projectContexts, [contextPath]: context };
  await savePrefs({ projectContexts: prefs.projectContexts });
  $('contextDialog').close();
  render();
};
$('views').onclick = (event) => {
  const button = event.target.closest('[data-view]');
  if (button) { viewMode = button.dataset.view; render(); }
};
$('search').oninput = render;
document.addEventListener('keydown', (event) => {
  if (document.querySelector('dialog[open]')) return;
  if (((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') || (event.key === '/' && !event.target.matches('input,textarea,select'))) {
    event.preventDefault(); $('search').focus(); $('search').select();
  }
});
$('saveRetry').onclick = async () => { await savePrefs({}); render(); };
document.addEventListener('click', async (event) => {
  if (event.target.closest('[data-save-retry]')) { await savePrefs({}); render(); }
});
window.addEventListener('unhandledrejection', (event) => {
  event.preventDefault();
  feedback(Object.keys(pendingSave).length ? t('saveError') : t('operationError') + ': ' + event.reason, Object.keys(pendingSave).length > 0);
});
$('exportBackup').onclick = async () => {
  await saveTail;
  const path = await tiny.dialog.saveFile({ types: ['json'] });
  if (path) { await tiny.api.call('exportBackup', { path }); feedback(t('exported')); }
};
$('importBackup').onclick = async () => {
  await saveTail;
  const path = await tiny.dialog.openFile({ types: ['json'] });
  if (!path || !await tiny.dialog.confirm(t('importConfirm'), { detail: t('importDetail'), ok: t('importBackup'), cancel: t('cancel') })) return;
  prefs = await tiny.api.call('importBackup', { path });
  todos = prefs.todos; remoteWorkspaces = prefs.remoteWorkspaces;
  render(); feedback(t('imported'));
};
let syncing = false;
async function syncMcpMetadata() {
  if (syncing || mcpState.state !== 'running' || Object.keys(pendingSave).length || document.querySelector('dialog[open]')) return;
  syncing = true;
  const task = saveTail.catch(() => {}).then(async () => {
    if (Object.keys(pendingSave).length) return;
    await tiny.api.call('mcpSync');
    const updated = await tiny.api.call('loadPrefs');
    if (!Object.keys(pendingSave).length && JSON.stringify(updated) !== JSON.stringify(prefs)) {
      prefs = updated; todos = prefs.todos; remoteWorkspaces = prefs.remoteWorkspaces; render();
    }
  });
  saveTail = task;
  try { await task; }
  catch (error) { feedback(t('operationError') + ': ' + error); }
  finally { syncing = false; }
}
window.addEventListener('focus', syncMcpMetadata);
setInterval(syncMcpMetadata, 15000);
