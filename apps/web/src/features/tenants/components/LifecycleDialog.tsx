import { zodResolver } from '@hookform/resolvers/zod';
import type { LifecycleAction, Tenant } from 'contracts';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { problemMessage } from '../../../shared/lib/problem';
import { Button } from '../../../shared/ui/Button';
import { Dialog, DialogClose } from '../../../shared/ui/Dialog';
import { useTransitionTenantMutation } from '../api';

export const ACTION_LABELS: Record<LifecycleAction, string> = {
  activate: 'Activate',
  suspend: 'Suspend',
  reactivate: 'Reactivate',
  deprovision: 'Deprovision',
};

const PAST_TENSE: Record<LifecycleAction, string> = {
  activate: 'activated',
  suspend: 'suspended',
  reactivate: 'reactivated',
  deprovision: 'deprovisioned',
};

const COPY: Record<LifecycleAction, { description: string; danger: boolean }> = {
  activate: {
    description: 'Onboarding is complete. Program admins get full access to the tenant.',
    danger: false,
  },
  suspend: {
    description:
      'Program admins lose write access until the tenant is reactivated. The reason is recorded in the audit log.',
    danger: true,
  },
  reactivate: {
    description: 'Program admins get full access to the tenant again.',
    danger: false,
  },
  deprovision: {
    description:
      'This closes the tenant for good: it cannot be reactivated. Its data and audit history are kept.',
    danger: true,
  },
};

interface FormValues {
  reason: string;
  confirmationName: string;
}

const schemaFor = (action: LifecycleAction, tenantName: string) =>
  z.object({ reason: z.string(), confirmationName: z.string() }).superRefine((values, ctx) => {
    if (action === 'suspend' && values.reason.trim() === '') {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Enter a reason.' });
    }
    if (action === 'suspend' && values.reason.length > 500) {
      ctx.addIssue({ code: 'custom', path: ['reason'], message: 'Keep it under 500 characters.' });
    }
    if (action === 'deprovision' && values.confirmationName.trim() !== tenantName) {
      ctx.addIssue({
        code: 'custom',
        path: ['confirmationName'],
        message: 'Type the exact tenant name.',
      });
    }
  });

interface LifecycleDialogProps {
  tenant: Tenant;
  action: LifecycleAction;
  onClose: () => void;
  onDone: (message: string) => void;
}

/** Confirms one Lifecycle Action. The domain re-checks everything on the server side. */
export function LifecycleDialog({ tenant, action, onClose, onDone }: LifecycleDialogProps) {
  const [transitionTenant, { isLoading, error, reset }] = useTransitionTenantMutation();
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { reason: '', confirmationName: '' },
    resolver: zodResolver(schemaFor(action, tenant.name)),
  });
  const reasonId = useId();
  const nameId = useId();
  const { description, danger } = COPY[action];
  const nameMatches = watch('confirmationName').trim() === tenant.name;

  const onSubmit = handleSubmit(async (values) => {
    const result = await transitionTenant({
      tenantId: tenant.id,
      command: {
        action,
        ...(action === 'suspend' ? { reason: values.reason.trim() } : {}),
        ...(action === 'deprovision' ? { confirmationName: values.confirmationName } : {}),
      },
    });
    if ('data' in result) onDone(`${tenant.name} ${PAST_TENSE[action]}.`);
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) {
          reset();
          onClose();
        }
      }}
      title={`${ACTION_LABELS[action]} ${tenant.name}?`}
      description={description}
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
        {action === 'suspend' && (
          <div>
            <label htmlFor={reasonId} className="block text-sm font-medium">
              Reason
            </label>
            <textarea
              id={reasonId}
              rows={3}
              aria-invalid={errors.reason ? true : undefined}
              aria-describedby={errors.reason ? `${reasonId}-error` : undefined}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              {...register('reason')}
            />
            {errors.reason && (
              <p id={`${reasonId}-error`} className="mt-1 text-sm text-red-700">
                {errors.reason.message}
              </p>
            )}
          </div>
        )}

        {action === 'deprovision' && (
          <div>
            <label htmlFor={nameId} className="block text-sm font-medium">
              Type <strong>{tenant.name}</strong> to confirm
            </label>
            <input
              id={nameId}
              autoComplete="off"
              aria-invalid={errors.confirmationName ? true : undefined}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              {...register('confirmationName')}
            />
            {errors.confirmationName && (
              <p className="mt-1 text-sm text-red-700">{errors.confirmationName.message}</p>
            )}
          </div>
        )}

        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {problemMessage(error)}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button>Cancel</Button>
          </DialogClose>
          <Button
            type="submit"
            variant={danger ? 'danger' : 'primary'}
            disabled={isLoading || (action === 'deprovision' && !nameMatches)}
          >
            {isLoading ? 'Working…' : ACTION_LABELS[action]}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
