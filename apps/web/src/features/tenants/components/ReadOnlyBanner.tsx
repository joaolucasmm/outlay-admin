import { canEditProgram } from '@outlay/domain';
import type { Tenant } from 'contracts';

/** Explains why a tenant's program can't be edited (it is not active). */
export function ReadOnlyBanner({ tenant }: { tenant: Tenant }) {
  if (canEditProgram(tenant)) return null;
  return (
    <p
      role="note"
      className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
    >
      <strong>{tenant.name}</strong> is {tenant.status}. Its expense program is read-only until the
      tenant is active.
    </p>
  );
}
