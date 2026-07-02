import { api } from '../../api';
import type { BoardingWrite } from '../../api/contract';
import { PermissionError } from '../../lib/errors';

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

function dequeue(childId: string, serviceDate: string): void {
  writeQueue(readQueue().filter((i) => !(i.childId === childId && i.serviceDate === serviceDate)));
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

/**
 * The queued writes themselves — the register overlays these on server state
 * so an offline PA still sees taps take effect (and can go on → dropped).
 */
export function pendingWrites(): BoardingWrite[] {
  return readQueue();
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

/**
 * Push queued writes to the backend. Transient failures stay queued for
 * retry but never block the rest of the queue; a PermissionError will never
 * succeed, so that item is dropped and the error surfaced to the caller.
 */
export async function flushOutbox(): Promise<void> {
  if (flushing) return;
  flushing = true;
  let changed = false;
  let denied: PermissionError | null = null;
  try {
    for (const item of readQueue()) {
      if (typeof navigator !== 'undefined' && !navigator.onLine) break;
      try {
        await api().saveBoarding(item);
        dequeue(item.childId, item.serviceDate);
        changed = true;
      } catch (err) {
        if (err instanceof PermissionError) {
          dequeue(item.childId, item.serviceDate);
          changed = true;
          denied = err;
        }
        // transient failure: keep the item queued, carry on with the others
      }
    }
  } finally {
    flushing = false;
    if (changed) notify();
  }
  if (denied) throw denied;
}

// Re-flush whenever the connection comes back.
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    void flushOutbox().catch(() => {
      /* surfaced on the next user action */
    });
  });
}
