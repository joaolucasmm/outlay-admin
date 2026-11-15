import type { SessionState } from './sessionSlice';

const KEY = 'outlay-admin:session:v1';

const isSession = (value: unknown): value is SessionState =>
  typeof value === 'object' &&
  value !== null &&
  'persona' in value &&
  typeof value.persona === 'object' &&
  value.persona !== null &&
  'id' in value.persona &&
  'role' in value.persona &&
  'currentTenantId' in value;

/** The signed-in persona survives a reload. Storage errors fall back to the default session. */
export function loadSession(storage: Storage): SessionState | undefined {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(KEY) ?? 'null');
    return isSession(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function saveSession(storage: Storage, session: SessionState) {
  try {
    storage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Storage blocked: the session just won't survive a reload.
  }
}
