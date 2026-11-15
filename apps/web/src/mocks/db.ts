import type { AuditEvent, Employee, ExpenseCategory, PolicyRule, Tenant } from 'contracts';
import { seedEmployees } from './fixtures/employees';
import { seedCategories, seedPolicyRules } from './fixtures/program';
import { seedAuditEvents, seedTenants } from './fixtures/seed';

/** Bump when the stored shape changes: older saved data is then discarded. */
const SCHEMA_VERSION = 3;
export const STORAGE_KEY = `outlay-admin:db:v${SCHEMA_VERSION}`;

interface DbState {
  version: number;
  tenants: Tenant[];
  auditEvents: AuditEvent[];
  categories: ExpenseCategory[];
  policyRules: PolicyRule[];
  employees: Employee[];
}

const seed = (): DbState =>
  structuredClone({
    version: SCHEMA_VERSION,
    tenants: seedTenants,
    auditEvents: seedAuditEvents,
    categories: seedCategories,
    policyRules: seedPolicyRules,
    employees: seedEmployees,
  });

const isDbState = (value: unknown): value is DbState =>
  typeof value === 'object' &&
  value !== null &&
  'version' in value &&
  value.version === SCHEMA_VERSION &&
  'tenants' in value &&
  Array.isArray(value.tenants) &&
  'auditEvents' in value &&
  Array.isArray(value.auditEvents) &&
  'categories' in value &&
  Array.isArray(value.categories) &&
  'policyRules' in value &&
  Array.isArray(value.policyRules) &&
  'employees' in value &&
  Array.isArray(value.employees);

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
    addTenant(tenant: Tenant) {
      state.tenants = [...state.tenants, tenant];
      save();
    },
    updateTenant(tenant: Tenant) {
      state.tenants = state.tenants.map((t) => (t.id === tenant.id ? tenant : t));
      save();
    },
    addAuditEvent(event: AuditEvent) {
      state.auditEvents = [event, ...state.auditEvents];
      save();
    },

    categories: (tenantId: string) => state.categories.filter((c) => c.tenantId === tenantId),
    saveCategory(category: ExpenseCategory) {
      const exists = state.categories.some((c) => c.id === category.id);
      state.categories = exists
        ? state.categories.map((c) => (c.id === category.id ? category : c))
        : [...state.categories, category];
      save();
    },

    policyRules: (tenantId: string) => state.policyRules.filter((r) => r.tenantId === tenantId),
    replacePolicyRules(tenantId: string, rules: PolicyRule[]) {
      state.policyRules = [...state.policyRules.filter((r) => r.tenantId !== tenantId), ...rules];
      save();
    },

    addProgram(categories: ExpenseCategory[], rules: PolicyRule[]) {
      state.categories = [...state.categories, ...categories];
      state.policyRules = [...state.policyRules, ...rules];
      save();
    },

    employees: (tenantId: string) => state.employees.filter((e) => e.tenantId === tenantId),
    addEmployees(employees: Employee[]) {
      state.employees = [...state.employees, ...employees];
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
