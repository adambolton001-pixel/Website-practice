import { buildSeed, DEMO_VERSION, type DemoData } from './seed';

const DATA_KEY = 'aegis-demo-data';
const SESSION_KEY = 'aegis-demo-session';
const FILE_PREFIX = 'aegis-demo-file:';

let cache: DemoData | null = null;

export function getData(): DemoData {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoData;
      if (parsed.version === DEMO_VERSION) {
        parsed.files = {}; // uploads live under their own keys — see saveFile()
        cache = parsed;
        return parsed;
      }
    }
  } catch {
    // corrupted store — fall through to reseed
  }
  cache = buildSeed();
  persist();
  return cache;
}

export function persist(): void {
  if (!cache) return;
  try {
    // Uploaded files (base64 photos) are persisted under separate keys so the
    // hot path — audit appends, boarding taps — only serialises small data.
    localStorage.setItem(DATA_KEY, JSON.stringify({ ...cache, files: {} }));
  } catch {
    // quota exceeded — keep working in memory
  }
}

/**
 * Run a batch of changes with a single persist at the end. Nested mutate()
 * calls are absorbed into the outer batch (one serialisation per user action).
 */
let batchDepth = 0;
export function mutate<T>(fn: (data: DemoData) => T): T {
  batchDepth++;
  try {
    return fn(getData());
  } finally {
    batchDepth--;
    if (batchDepth === 0) persist();
  }
}

export function saveFile(path: string, dataUrl: string): void {
  try {
    localStorage.setItem(FILE_PREFIX + path, dataUrl);
  } catch {
    // photo too large for the demo store — the incident still saves
  }
}

export function getFile(path: string): string | null {
  return localStorage.getItem(FILE_PREFIX + path);
}

export function resetDemoData(): void {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const key = localStorage.key(i);
    if (key?.startsWith(FILE_PREFIX)) localStorage.removeItem(key);
  }
  cache = buildSeed();
  persist();
}

export function getSessionUserId(): string | null {
  return localStorage.getItem(SESSION_KEY);
}

export function setSessionUserId(id: string | null): void {
  if (id) localStorage.setItem(SESSION_KEY, id);
  else localStorage.removeItem(SESSION_KEY);
}

export const uid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
