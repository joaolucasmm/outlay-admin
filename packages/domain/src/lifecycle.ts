import type {
  Actor,
  AuditEvent,
  LifecycleAction,
  LifecycleCommand,
  Tenant,
  TenantStatus,
} from 'contracts';
import { can } from './permissions';
import { err, ok, type Result } from './result';

interface TransitionRule {
  from: TenantStatus;
  to: TenantStatus;
  /** Audit action name, e.g. `tenant.suspended`. */
  event: string;
}

/** The whole tenant lifecycle. See the state diagram in docs/ARCHITECTURE.md. */
export const LIFECYCLE: Readonly<Record<LifecycleAction, TransitionRule>> = {
  activate: { from: 'provisioning', to: 'active', event: 'tenant.activated' },
  suspend: { from: 'active', to: 'suspended', event: 'tenant.suspended' },
  reactivate: { from: 'suspended', to: 'active', event: 'tenant.reactivated' },
  deprovision: { from: 'suspended', to: 'deprovisioned', event: 'tenant.deprovisioned' },
};

const ACTIONS = Object.keys(LIFECYCLE) as LifecycleAction[];

/** Lifecycle Actions that can run from `status`, in a stable order. */
export const availableActions = (status: TenantStatus): LifecycleAction[] =>
  ACTIONS.filter((action) => LIFECYCLE[action].from === status);

export type TransitionError =
  | { code: 'forbidden'; message: string }
  | { code: 'invalid_transition'; message: string; from: TenantStatus; action: LifecycleAction }
  | { code: 'reason_required'; message: string; field: 'reason' }
  | { code: 'name_mismatch'; message: string; field: 'confirmationName' };

export type AuditEventDraft = Omit<AuditEvent, 'id'>;

export interface TransitionOutcome {
  tenant: Tenant;
  auditEvent: AuditEventDraft;
}

export interface TransitionContext {
  actor: Actor;
  /** ISO 8601 timestamp, injected so the domain never reads the clock. */
  now: string;
}

/**
 * Runs a Lifecycle Action. Checks, in order: permission, allowed transition,
 * then the command's own requirements (suspend reason, deprovision confirmation).
 */
export function transition(
  tenant: Tenant,
  command: LifecycleCommand,
  { actor, now }: TransitionContext,
): Result<TransitionOutcome, TransitionError> {
  if (!can(actor.role, 'tenants:transition')) {
    return err({
      code: 'forbidden',
      message: 'Only a Support Operator may run lifecycle actions.',
    });
  }

  const rule = LIFECYCLE[command.action];
  if (tenant.status !== rule.from) {
    return err({
      code: 'invalid_transition',
      message: `Cannot ${command.action} a tenant that is ${tenant.status}.`,
      from: tenant.status,
      action: command.action,
    });
  }

  const reason = command.reason?.trim() ?? '';
  if (command.action === 'suspend' && reason === '') {
    return err({
      code: 'reason_required',
      message: 'A reason is required to suspend a tenant.',
      field: 'reason',
    });
  }

  if (command.action === 'deprovision' && command.confirmationName?.trim() !== tenant.name) {
    return err({
      code: 'name_mismatch',
      message: 'Type the exact tenant name to confirm deprovisioning.',
      field: 'confirmationName',
    });
  }

  const updated: Tenant = { ...tenant, status: rule.to, updatedAt: now };
  return ok({
    tenant: updated,
    auditEvent: {
      tenantId: tenant.id,
      actor,
      action: rule.event,
      entity: 'tenant',
      entityId: tenant.id,
      before: { status: tenant.status },
      after: reason === '' ? { status: rule.to } : { status: rule.to, reason },
      at: now,
    },
  });
}
