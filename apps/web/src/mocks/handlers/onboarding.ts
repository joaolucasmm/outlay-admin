import {
  can,
  canOnboard,
  EMPLOYEE_ROLES,
  normalizeEmail,
  sameTenantName,
  validateEmployeeImport,
  validateNewTenant,
} from '@outlay/domain';
import type {
  Employee,
  EmployeePage,
  EmployeeRole,
  ImportResult,
  Problem,
  Tenant,
  TemplateResult,
} from 'contracts';
import { delay, http, HttpResponse, type DefaultBodyType } from 'msw';
import { db } from '../db';
import { programFor } from '../fixtures/program';
import {
  callerFrom,
  fieldErrors,
  paginate,
  problem,
  programAccess,
  unauthenticated,
  type ProgramAccess,
} from '../http';

type TenantParams = { tenantId: string };

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const audit = (
  tenantId: string,
  actor: ProgramAccess['caller']['actor'],
  event: { action: string; entity: string; entityId: string; before?: unknown; after?: unknown },
) => {
  db.addAuditEvent({
    id: `aud_${crypto.randomUUID()}`,
    tenantId,
    actor,
    at: new Date().toISOString(),
    ...event,
  });
};

const slugFrom = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFD') // "ã" → "a" + combining mark, which the next line drops
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 16) || 'tenant';

export const onboardingHandlers = [
  http.post<never, DefaultBodyType, Tenant | Problem>('*/api/v1/tenants', async ({ request }) => {
    await delay();
    const caller = callerFrom(request, db);
    if (!caller) return unauthenticated();
    if (!can(caller.actor.role, 'tenants:create')) {
      return problem(403, 'Forbidden', 'Only a Support Operator creates tenants.');
    }
    const body: unknown = await request.json().catch(() => null);
    if (
      !isObject(body) ||
      typeof body.name !== 'string' ||
      typeof body.country !== 'string' ||
      typeof body.currency !== 'string'
    ) {
      return fieldErrors([{ field: 'name', message: 'Body must be a TenantCreate.' }]);
    }
    const valid = validateNewTenant({
      name: body.name,
      country: body.country,
      currency: body.currency,
    });
    if (!valid.ok) return fieldErrors(valid.error);
    if (db.tenants().some((t) => sameTenantName(t.name, valid.value.name))) {
      return problem(409, 'Duplicate name', `A tenant named ${valid.value.name} already exists.`, [
        { field: 'name', message: `A tenant named ${valid.value.name} already exists.` },
      ]);
    }

    const now = new Date().toISOString();
    const tenant: Tenant = {
      id: `tnt_${slugFrom(valid.value.name)}${crypto.randomUUID().slice(0, 4)}`,
      ...valid.value,
      status: 'provisioning',
      createdAt: now,
      updatedAt: now,
    };
    db.addTenant(tenant);
    audit(tenant.id, caller.actor, {
      action: 'tenant.created',
      entity: 'tenant',
      entityId: tenant.id,
      after: tenant,
    });
    return HttpResponse.json<Tenant>(tenant, { status: 201 });
  }),

  http.post<TenantParams, DefaultBodyType, TemplateResult | Problem>(
    '*/api/v1/tenants/:tenantId/program\\:apply-template',
    async ({ request, params }) => {
      await delay();
      const caller = callerFrom(request, db);
      if (!caller) return unauthenticated();
      if (!can(caller.actor.role, 'tenants:create')) {
        return problem(403, 'Forbidden', 'Templates are applied during onboarding only.');
      }
      const tenant = db.findTenant(params.tenantId);
      if (!tenant) return problem(404, 'Not found', 'Tenant not found.');
      if (!canOnboard(tenant)) {
        return problem(
          409,
          'Not onboarding',
          `${tenant.name} is ${tenant.status}, not provisioning.`,
        );
      }
      const body: unknown = await request.json().catch(() => null);
      if (!isObject(body) || (body.templateId !== 'standard' && body.templateId !== 'empty')) {
        return fieldErrors([{ field: 'templateId', message: 'Use "standard" or "empty".' }]);
      }

      const existing = new Set(db.categories(tenant.id).map((c) => c.code));
      const { categories, rules } =
        body.templateId === 'standard'
          ? programFor(tenant, existing)
          : { categories: [], rules: [] };
      db.addProgram(categories, rules);
      const result: TemplateResult = {
        categoriesCreated: categories.length,
        rulesCreated: rules.length,
      };
      audit(tenant.id, caller.actor, {
        action: 'program.template_applied',
        entity: 'program',
        entityId: tenant.id,
        after: { templateId: body.templateId, ...result },
      });
      return HttpResponse.json<TemplateResult>(result);
    },
  ),

  http.get<TenantParams, DefaultBodyType, EmployeePage | Problem>(
    '*/api/v1/tenants/:tenantId/employees',
    async ({ request, params }) => {
      await delay();
      const access = programAccess(request, db, params.tenantId, { write: false });
      if (access instanceof Response) return access;

      const url = new URL(request.url);
      const q = url.searchParams.get('q')?.trim().toLowerCase() ?? '';
      const role = url.searchParams.get('role');
      if (role && !EMPLOYEE_ROLES.includes(role as EmployeeRole)) {
        return problem(400, 'Bad request', `Unknown role "${role}".`);
      }
      const employees = db
        .employees(access.tenant.id)
        .filter((e) => !q || e.name.toLowerCase().includes(q) || e.email.includes(q))
        .filter((e) => !role || e.role === role)
        .sort((a, b) => a.name.localeCompare(b.name));
      const page = paginate(employees, url);
      if (!page) return problem(400, 'Bad request', 'Invalid cursor.');
      return HttpResponse.json<EmployeePage>(page);
    },
  ),

  http.post<TenantParams, DefaultBodyType, ImportResult | Problem>(
    '*/api/v1/tenants/:tenantId/employees\\:import',
    async ({ request, params }) => {
      await delay();
      const access = programAccess(request, db, params.tenantId, { write: true });
      if (access instanceof Response) return access;

      const body: unknown = await request.json().catch(() => null);
      const rows =
        isObject(body) && Array.isArray(body.employees) ? (body.employees as unknown[]) : null;
      const wellFormed =
        rows?.every(
          (r) =>
            isObject(r) &&
            typeof r.name === 'string' &&
            typeof r.email === 'string' &&
            typeof r.role === 'string' &&
            typeof r.costCenter === 'string',
        ) ?? false;
      if (!rows || !wellFormed || rows.length === 0 || rows.length > 1000) {
        return fieldErrors([
          { field: 'employees', message: 'Send 1 to 1000 employees as EmployeeInput objects.' },
        ]);
      }

      const existing = db.employees(access.tenant.id).map((e) => e.email);
      const result = validateEmployeeImport(
        rows as { name: string; email: string; role: string; costCenter: string }[],
        existing,
      );
      if (result.invalid.length > 0) {
        return problem(
          422,
          'Invalid employees',
          `${result.invalid.length} of ${rows.length} employees are invalid. Nothing was imported.`,
          result.invalid.flatMap((row) =>
            row.errors.map((e) => ({
              field: `employees[${row.index}].${e.field}`,
              message: e.message,
            })),
          ),
        );
      }

      const slug = access.tenant.id.replace(/^tnt_/, '');
      const created: Employee[] = result.valid.map(({ employee }) => ({
        id: `emp_${slug}_${crypto.randomUUID().slice(0, 8)}`,
        tenantId: access.tenant.id,
        ...employee,
        email: normalizeEmail(employee.email),
      }));
      db.addEmployees(created);
      audit(access.tenant.id, access.caller.actor, {
        action: 'employees.imported',
        entity: 'employee',
        entityId: access.tenant.id,
        after: { imported: created.length },
      });
      return HttpResponse.json<ImportResult>({ imported: created.length });
    },
  ),
];
