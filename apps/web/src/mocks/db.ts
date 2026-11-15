import type { AuditEvent, Tenant } from 'contracts';
import { seedAuditEvents, seedTenants } from './fixtures/seed';

/** Bump when the stored shape changes: older saved data is then discarded. */
const SCHEMA_VERSION = 1;
export const STORAGE_KEY = `outlay-admin:db:v${SCHEMA_VERSION}`;

interface DbState {
  version: number;
  tenants: Tenant[];
  auditEvents: AuditEvent[];
}

const seed = (): DbState =>
  structuredClone({ version: SCHEMA_VERSION, tenants: seedTenants, auditEvents: seedAuditEvents });

const isDbState = (value: unknown): value is DbState =>
  typeof value === 'object' &&
  value !== null &&
  'version' in value &&
  value.version === SCHEMA_VERSION &&
  'tenants' in value &&
  Array.isArray(value.tenants) &&
  'auditEvents' in value &&
  Array.isArray(value.auditEvents);

/**
 * In-memory mock database, persisted to `storage` (localStorage in the browser)
 * so the demo survives a refresh. Unreadable or outdated data falls back to the seed.
 */
export function createDb(storage: Storage | null) {
  const load = (): DbState => {
    try {
      const raw = storage?.getItem(STORAGE_KEY);
      const parsed: unknown = raw ? JSON.parse(raw) : null;
      return isDbState(parsed) ? parsed : seed();
    } catch {
      return seed();
    }
  };

  let state = load();

  const save = () => {
    try {
      storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked: keep working in memory.
    }
  };

  return {
    tenants: () => state.tenants,
    auditEvents: () => state.auditEvents,
    findTenant: (id: string) => state.tenants.find((tenant) => tenant.id === id),
    updateTenant(tenant: Tenant) {
      state.tenants = state.tenants.map((t) => (t.id === tenant.id ? tenant : t));
      save();
    },
    addAuditEvent(event: AuditEvent) {
      state.auditEvents = [event, ...state.auditEvents];
      save();
    },
    reset() {
      state = seed();
      save();
    },
  };
}

export type Db = ReturnType<typeof createDb>;

const browserStorage = (): Storage | null => {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
};

export const db = createDb(browserStorage());
