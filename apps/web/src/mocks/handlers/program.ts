import { EMPLOYEE_ROLES, validateCategoryFields, validatePolicyRule } from '@outlay/domain';
import type {
  CategoryCreate,
  CategoryPage,
  CategoryUpdate,
  EmployeeRole,
  ExpenseCategory,
  PolicyRule,
  PolicyRuleInput,
  PolicyRuleSet,
  Problem,
} from 'contracts';
import { delay, http, HttpResponse, type DefaultBodyType } from 'msw';
import { db } from '../db';
import { fieldErrors, paginate, problem, programAccess, type ProgramAccess } from '../http';

type TenantParams = { tenantId: string };

const record = (
  access: ProgramAccess,
  event: { action: string; entity: string; entityId: string; before?: unknown; after?: unknown },
) => {
  db.addAuditEvent({
    id: `aud_${crypto.randomUUID()}`,
    tenantId: access.tenant.id,
    actor: access.caller.actor,
    at: new Date().toISOString(),
    ...event,
  });
};

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const optionalString = (value: unknown) => value === undefined || typeof value === 'string';
const optionalNullableString = (value: unknown) => value === null || optionalString(value);

const ruleKey = (r: Pick<PolicyRuleInput, 'categoryId' | 'role'>) => `${r.categoryId}:${r.role}`;

const isRuleInput = (value: unknown): value is PolicyRuleInput =>
  isObject(value) &&
  typeof value.categoryId === 'string' &&
  typeof value.role === 'string' &&
  EMPLOYEE_ROLES.includes(value.role as EmployeeRole) &&
  typeof value.limitMinor === 'number' &&
  typeof value.receiptRequiredAboveMinor === 'number' &&
  typeof value.approvalLevels === 'number';

export const programHandlers = [
  http.get<TenantParams, DefaultBodyType, CategoryPage | Problem>(
    '*/api/v1/tenants/:tenantId/categories',
    async ({ request, params }) => {
      await delay();
      const access = programAccess(request, db, params.tenantId, { write: false });
      if (access instanceof Response) return access;
      const sorted = [...db.categories(access.tenant.id)].sort((a, b) =>
        a.code.localeCompare(b.code),
      );
      const page = paginate(sorted, new URL(request.url));
      if (!page) return problem(400, 'Bad request', 'Invalid cursor.');
      return HttpResponse.json<CategoryPage>(page);
    },
  ),

  http.post<TenantParams, DefaultBodyType, ExpenseCategory | Problem>(
    '*/api/v1/tenants/:tenantId/categories',
    async ({ request, params }) => {
      await delay();
      const access = programAccess(request, db, params.tenantId, { write: true });
      if (access instanceof Response) return access;

      const body: unknown = await request.json().catch(() => null);
      if (
        !isObject(body) ||
        typeof body.code !== 'string' ||
        typeof body.name !== 'string' ||
        !optionalNullableString(body.glAccount)
      ) {
        return fieldErrors([{ field: 'code', message: 'Body must be a CategoryCreate.' }]);
      }
      const input = body as unknown as CategoryCreate;
      const valid = validateCategoryFields({ ...input, glAccount: input.glAccount ?? null });
      if (!valid.ok) return fieldErrors(valid.error);

      const { code = '', name = '', glAccount = null } = valid.value;
      if (db.categories(access.tenant.id).some((c) => c.code === code)) {
        return problem(409, 'Duplicate code', `The code ${code} is already used.`, [
          { field: 'code', message: `The code ${code} is already used.` },
        ]);
      }

      const category: ExpenseCategory = {
        id: `cat_${crypto.randomUUID()}`,
        tenantId: access.tenant.id,
        code,
        name,
        glAccount,
        active: true,
      };
      db.saveCategory(category);
      record(access, {
        action: 'category.created',
        entity: 'category',
        entityId: category.id,
        after: category,
      });
      return HttpResponse.json<ExpenseCategory>(category, { status: 201 });
    },
  ),

  http.patch<TenantParams & { categoryId: string }, DefaultBodyType, ExpenseCategory | Problem>(
    '*/api/v1/tenants/:tenantId/categories/:categoryId',
    async ({ request, params }) => {
      await delay();
      const access = programAccess(request, db, params.tenantId, { write: true });
      if (access instanceof Response) return access;
      const current = db.categories(access.tenant.id).find((c) => c.id === params.categoryId);
      if (!current) return problem(404, 'Not found', 'Category not found.');

      const body: unknown = await request.json().catch(() => null);
      if (
        !isObject(body) ||
        'code' in body ||
        !optionalString(body.name) ||
        !optionalNullableString(body.glAccount) ||
        !(body.active === undefined || typeof body.active === 'boolean')
      ) {
        return fieldErrors([
          { field: 'body', message: 'Body must be a CategoryUpdate; the code cannot change.' },
        ]);
      }
      const input = body as CategoryUpdate;
      const valid = validateCategoryFields({ name: input.name, glAccount: input.glAccount });
      if (!valid.ok) return fieldErrors(valid.error);

      const changes = {
        ...valid.value,
        ...(input.active === undefined ? {} : { active: input.active }),
      };
      const updated: ExpenseCategory = { ...current, ...changes };
      const keys = (Object.keys(changes) as (keyof typeof changes)[]).filter(
        (key) => current[key] !== updated[key],
      );
      db.saveCategory(updated);
      if (keys.length > 0) {
        record(access, {
          action: 'category.updated',
          entity: 'category',
          entityId: current.id,
          before: Object.fromEntries(keys.map((k) => [k, current[k]])),
          after: Object.fromEntries(keys.map((k) => [k, updated[k]])),
        });
      }
      return HttpResponse.json<ExpenseCategory>(updated);
    },
  ),

  http.get<TenantParams, DefaultBodyType, PolicyRuleSet | Problem>(
    '*/api/v1/tenants/:tenantId/policy-rules',
    async ({ request, params }) => {
      await delay();
      const access = programAccess(request, db, params.tenantId, { write: false });
      if (access instanceof Response) return access;
      return HttpResponse.json<PolicyRuleSet>({ items: db.policyRules(access.tenant.id) });
    },
  ),

  http.put<TenantParams, DefaultBodyType, PolicyRuleSet | Problem>(
    '*/api/v1/tenants/:tenantId/policy-rules',
    async ({ request, params }) => {
      await delay();
      const access = programAccess(request, db, params.tenantId, { write: true });
      if (access instanceof Response) return access;

      const body: unknown = await request.json().catch(() => null);
      if (!isObject(body) || !Array.isArray(body.rules) || !body.rules.every(isRuleInput)) {
        return fieldErrors([{ field: 'rules', message: 'Body must be a PolicyRulesReplace.' }]);
      }
      const inputs = body.rules;
      const categoryIds = new Set(db.categories(access.tenant.id).map((c) => c.id));
      const seen = new Set<string>();

      for (const [index, input] of inputs.entries()) {
        const prefix = `rules[${index}].`;
        if (!categoryIds.has(input.categoryId)) {
          return fieldErrors([{ field: 'categoryId', message: 'Unknown category.' }], prefix);
        }
        if (seen.has(ruleKey(input))) {
          return fieldErrors(
            [{ field: 'role', message: 'Duplicate rule for this category and role.' }],
            prefix,
          );
        }
        seen.add(ruleKey(input));
        const valid = validatePolicyRule(input);
        if (!valid.ok) return fieldErrors(valid.error, prefix);
      }

      const previous = new Map(db.policyRules(access.tenant.id).map((r) => [ruleKey(r), r]));
      const next: PolicyRule[] = inputs.map((input) => ({
        id: previous.get(ruleKey(input))?.id ?? `pol_${crypto.randomUUID()}`,
        tenantId: access.tenant.id,
        categoryId: input.categoryId,
        role: input.role,
        limitMinor: input.limitMinor,
        receiptRequiredAboveMinor: input.receiptRequiredAboveMinor,
        approvalLevels: input.approvalLevels,
      }));

      // Audit only what changed: added, removed or edited (category, role) pairs.
      const nextByKey = new Map(next.map((r) => [ruleKey(r), r]));
      const same = (a: PolicyRule, b: PolicyRule) =>
        a.limitMinor === b.limitMinor &&
        a.receiptRequiredAboveMinor === b.receiptRequiredAboveMinor &&
        a.approvalLevels === b.approvalLevels;
      const changedKeys = [...new Set([...previous.keys(), ...nextByKey.keys()])].filter((key) => {
        const before = previous.get(key);
        const after = nextByKey.get(key);
        return !before || !after || !same(before, after);
      });

      db.replacePolicyRules(access.tenant.id, next);
      if (changedKeys.length > 0) {
        const pick = (rule: PolicyRule | undefined) =>
          rule
            ? {
                limitMinor: rule.limitMinor,
                receiptRequiredAboveMinor: rule.receiptRequiredAboveMinor,
                approvalLevels: rule.approvalLevels,
              }
            : null;
        record(access, {
          action: 'policy.updated',
          entity: 'policy',
          entityId: access.tenant.id,
          before: Object.fromEntries(changedKeys.map((k) => [k, pick(previous.get(k))])),
          after: Object.fromEntries(changedKeys.map((k) => [k, pick(nextByKey.get(k))])),
        });
      }
      return HttpResponse.json<PolicyRuleSet>({ items: next });
    },
  ),
];
