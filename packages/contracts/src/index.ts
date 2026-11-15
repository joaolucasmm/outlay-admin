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

export type ListTenantsQuery = NonNullable<paths['/tenants']['get']['parameters']['query']>;
export type ListAuditEventsQuery = NonNullable<
  paths['/audit-events']['get']['parameters']['query']
>;
