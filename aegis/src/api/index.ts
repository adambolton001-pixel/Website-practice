import { backendMode } from '../lib/config';
import type { AegisApi } from './contract';
import { demoApi } from './demo/demoApi';

// The live adapter pulls in supabase-js; only load it when configured.
async function loadLive(): Promise<AegisApi> {
  const mod = await import('./live/liveApi');
  return mod.liveApi;
}

let apiInstance: AegisApi = demoApi;
export let apiReady: Promise<void> = Promise.resolve();

if (backendMode === 'live') {
  apiReady = loadLive().then((live) => {
    apiInstance = live;
  });
}

/** The active backend. Await `apiReady` once at boot (AuthProvider does). */
export function api(): AegisApi {
  return apiInstance;
}
