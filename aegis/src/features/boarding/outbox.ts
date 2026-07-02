import { api } from '../../api';
import type { BoardingWrite } from '../../api/contract';

// Offline-first boarding writes: every tap lands in a localStorage outbox
// first, then flushes to the backend. If the vehicle is in a dead spot the
// tap is kept and retried when the connection returns — a PA never loses
// a boarding record. Last-write-wins per child+date (matches the upsert).

const KEY = 'aegis-boarding-outbox';

type QueueItem = BoardingWrite & { queuedAt: string };

function readQueue(): QueueItem[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as QueueItem[];
  } catch {
    return [];
  }
}

function writeQueue(q: QueueItem[]): void {
  localStorage.setItem(KEY, JSON.stringify(q));
}

const listeners = new Set<() => void>();
function notify() {
  listeners.forEach((cb) => cb());
}

/** Subscribe to outbox changes (for pending indicators). */
export function onOutboxChange(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function pendingKeys(): Set<string> {
  return new Set(readQueue().map((i) => `${i.childId}:${i.serviceDate}`));
}

/** Queue a boarding write and try to flush immediately. */
export async function enqueueBoarding(write: BoardingWrite): Promise<void> {
  const q = readQueue().filter(
    (i) => !(i.childId === write.childId && i.serviceDate === write.serviceDate),
  );
  q.push({ ...write, queuedAt: new Date().toISOString() });
  writeQueue(q);
  notify();
  await flushOutbox();
}

let flushing = false;

/** Push queued writes to the backend; leaves failures queued for retry. */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    let q = readQueue();
    for (const item of [...q]) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) break;
      try {
        await api().saveBoarding(item);
        q = readQueue().filter(
          (i) => !(i.childId === item.childId && i.serviceDate === item.serviceDate),
        );
        writeQueue(q);
        notify();
      } catch (err) {
        // Permission errors will never succeed — drop; network errors retry.
        if (err instanceof Error && /permission|policy/i.test(err.message)) {
          q = readQueue().filter(
            (i) => !(i.childId === item.childId && i.serviceDate === item.serviceDate),
          );
          writeQueue(q);
          notify();
          throw err;
        }
        break; // keep queued, retry on next flush
      }
    }
  } finally {
    flushing = false;
  }
}

// Re-flush whenever the connection comes back.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushOutbox();
  });
}
