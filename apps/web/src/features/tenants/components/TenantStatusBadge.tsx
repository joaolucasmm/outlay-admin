import type { TenantStatus } from 'contracts';
import { Badge, type BadgeTone } from '../../../shared/ui/Badge';

export const STATUS_LABELS: Record<TenantStatus, string> = {
  provisioning: 'Provisioning',
  active: 'Active',
  suspended: 'Suspended',
  deprovisioned: 'Deprovisioned',
};

const TONES: Record<TenantStatus, BadgeTone> = {
  provisioning: 'info',
  active: 'success',
  suspended: 'warning',
  deprovisioned: 'neutral',
};

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return <Badge tone={TONES[status]}>{STATUS_LABELS[status]}</Badge>;
}
