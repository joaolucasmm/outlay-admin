import type { components, paths } from './generated/schema';

export type { components, paths };

export type Schemas = components['schemas'];
export type Health = Schemas['Health'];
export type AdminRole = Schemas['AdminRole'];
export type TenantStatus = Schemas['TenantStatus'];
export type Tenant = Schemas['Tenant'];
export type TenantPage = Schemas['TenantPage'];
export type LifecycleAction = Schemas['LifecycleAction'];
export type LifecycleCommand = Schemas['LifecycleCommand'];
export type Actor = Schemas['Actor'];
export type AuditEvent = Schemas['AuditEvent'];
export type AuditEventPage = Schemas['AuditEventPage'];
export type Persona = Schemas['Persona'];
export type Problem = Schemas['Problem'];
export type EmployeeRole = Schemas['EmployeeRole'];
export type ExpenseCategory = Schemas['ExpenseCategory'];
export type CategoryPage = Schemas['CategoryPage'];
export type CategoryCreate = Schemas['CategoryCreate'];
export type CategoryUpdate = Schemas['CategoryUpdate'];
export type ApprovalLevels = Schemas['ApprovalLevels'];
export type PolicyRuleInput = Schemas['PolicyRuleInput'];
export type PolicyRule = Schemas['PolicyRule'];
export type PolicyRuleSet = Schemas['PolicyRuleSet'];
export type PolicyRulesReplace = Schemas['PolicyRulesReplace'];
export type FindingSeverity = Schemas['FindingSeverity'];
export type PolicyFinding = Schemas['PolicyFinding'];
export type PolicyCheckResult = Schemas['PolicyCheckResult'];
export type TenantCreate = Schemas['TenantCreate'];
export type CategoryTemplateId = Schemas['CategoryTemplateId'];
export type ApplyTemplate = Schemas['ApplyTemplate'];
export type TemplateResult = Schemas['TemplateResult'];
export type EmployeeInput = Schemas['EmployeeInput'];
export type Employee = Schemas['Employee'];
export type EmployeePage = Schemas['EmployeePage'];
export type EmployeeImport = Schemas['EmployeeImport'];
export type ImportResult = Schemas['ImportResult'];
export type ListEmployeesQuery = NonNullable<
  paths['/tenants/{tenantId}/employees']['get']['parameters']['query']
>;

export type ListTenantsQuery = NonNullable<paths['/tenants']['get']['parameters']['query']>;
export type ListAuditEventsQuery = NonNullable<
  paths['/audit-events']['get']['parameters']['query']
>;
export type ReceiptCategoryHint = Schemas['ReceiptCategoryHint'];
export type ReceiptConfidence = Schemas['ReceiptConfidence'];
export type ReceiptExtraction = Schemas['ReceiptExtraction'];
