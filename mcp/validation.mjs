export const PROJECT_COLORS = ['blue', 'green', 'yellow', 'orange', 'red', 'purple'];
export const MAX_RATING = 5;
export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 50;
export const MAX_TODO_LENGTH = 500;

export class McpValidationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'McpValidationError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new McpValidationError(code, message);
}

export function isAllowedLink(value, provider) {
  if (typeof value !== 'string' || !value.trim()) return false;
  let protocol;
  try { protocol = new URL(value).protocol; } catch { return false; }
  return provider === 'obsidian'
    ? protocol === 'obsidian:'
    : protocol === 'http:' || protocol === 'https:';
}

function normalizeLink(value, provider, field) {
  if (value === null || value === undefined || value === '') return undefined;
  if (!isAllowedLink(value, provider)) fail('INVALID_LINK', `${field} must be a valid ${provider} link.`);
  return value.trim();
}

export function normalizeTags(tags) {
  if (tags === undefined) return undefined;
  if (!Array.isArray(tags)) fail('INVALID_TAGS', 'tags must be an array.');
  const seen = new Set();
  const result = [];
  for (const value of tags) {
    if (typeof value !== 'string') fail('INVALID_TAG', 'Each tag must be a string.');
    const tag = value.trim();
    if (!tag) continue;
    if (tag.length > MAX_TAG_LENGTH) fail('INVALID_TAG', `Tags cannot exceed ${MAX_TAG_LENGTH} characters.`);
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(tag);
    if (result.length === MAX_TAGS) break;
  }
  return result;
}

export function validateProjectPath(path, knownProjectPaths) {
  if (typeof path !== 'string' || !path || !Array.isArray(knownProjectPaths) || !knownProjectPaths.includes(path)) {
    fail('UNKNOWN_PROJECT', 'The project path is not present in the current ProjectShelf scan.');
  }
  return path;
}

export function normalizeProjectMetadata(input = {}) {
  const result = {};
  if (Object.prototype.hasOwnProperty.call(input, 'color')) {
    if (input.color !== null && !PROJECT_COLORS.includes(input.color)) fail('INVALID_COLOR', 'Unsupported project color.');
    result.color = input.color;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'rating')) {
    if (!Number.isInteger(input.rating) || input.rating < 0 || input.rating > MAX_RATING) {
      fail('INVALID_RATING', 'Project rating must be an integer from 0 to 5.');
    }
    result.rating = input.rating;
  }
  if (Object.prototype.hasOwnProperty.call(input, 'tags')) result.tags = normalizeTags(input.tags);
  if (Object.prototype.hasOwnProperty.call(input, 'notion')) result.notion = normalizeLink(input.notion, 'notion', 'Notion link');
  if (Object.prototype.hasOwnProperty.call(input, 'obsidian')) result.obsidian = normalizeLink(input.obsidian, 'obsidian', 'Obsidian link');
  return result;
}

export function normalizeTodo(input = {}, knownProjectPaths = [], existingId) {
  const text = typeof input.text === 'string' ? input.text.trim() : '';
  if (!text || text.length > MAX_TODO_LENGTH) fail('INVALID_TODO', `Todo text is required and cannot exceed ${MAX_TODO_LENGTH} characters.`);
  const rawPaths = input.projectPaths === undefined ? [] : input.projectPaths;
  if (!Array.isArray(rawPaths)) fail('INVALID_PROJECT_LINKS', 'projectPaths must be an array.');
  const projectPaths = [...new Set(rawPaths.map((path) => validateProjectPath(path, knownProjectPaths)))];
  const id = existingId || (typeof input.id === 'string' && input.id ? input.id : `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  return { id, text, done: input.done === true, projectPaths };
}

export function normalizeMetadataDocument(input = {}) {
  const clean = {
    version: 1,
    projectColors: {},
    projectRatings: {},
    projectKnowledgeLinks: {},
    projectTags: {},
    todos: [],
    token: typeof input.token === 'string' && input.token ? input.token : undefined,
  };
  for (const [path, value] of Object.entries(input.projectColors || {})) {
    const metadata = normalizeProjectMetadata({ color: value });
    if (metadata.color) clean.projectColors[path] = metadata.color;
  }
  for (const [path, value] of Object.entries(input.projectRatings || {})) {
    const metadata = normalizeProjectMetadata({ rating: value });
    if (metadata.rating > 0) clean.projectRatings[path] = metadata.rating;
  }
  for (const [path, links] of Object.entries(input.projectKnowledgeLinks || {})) {
    const normalized = normalizeProjectMetadata(links);
    const result = {};
    if (normalized.notion) result.notion = normalized.notion;
    if (normalized.obsidian) result.obsidian = normalized.obsidian;
    if (Object.keys(result).length) clean.projectKnowledgeLinks[path] = result;
  }
  for (const [path, tags] of Object.entries(input.projectTags || {})) {
    const normalized = normalizeTags(tags);
    if (normalized?.length) clean.projectTags[path] = normalized;
  }
  clean.todos = Array.isArray(input.todos) ? input.todos.filter(Boolean).map((todo) => ({
    id: typeof todo.id === 'string' && todo.id ? todo.id : `todo-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text: typeof todo.text === 'string' ? todo.text.trim().slice(0, MAX_TODO_LENGTH) : '',
    done: todo.done === true,
    projectPaths: Array.isArray(todo.projectPaths) ? [...new Set(todo.projectPaths.filter((path) => typeof path === 'string' && path))] : [],
  })).filter((todo) => todo.text) : [];
  return clean;
}
