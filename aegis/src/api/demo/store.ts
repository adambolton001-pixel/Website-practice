import { buildSeed, DEMO_VERSION, type DemoData } from './seed';

const DATA_KEY = 'aegis-demo-data';
const SESSION_KEY = 'aegis-demo-session';

let cache: DemoData | null = null;

export function getData(): DemoData {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(DATA_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as DemoData;
      if (parsed.version === DEMO_VERSION) {
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
    localStorage.setItem(DATA_KEY, JSON.stringify(cache));
  } catch {
    // quota exceeded (e.g. large photo) — keep working in memory
  }
}

export function mutate<T>(fn: (data: DemoData) => T): T {
  const result = fn(getData());
  persist();
  return result;
}

export function resetDemoData(): void {
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
