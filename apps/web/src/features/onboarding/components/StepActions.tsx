import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Button } from '../../../shared/ui/Button';
import type { StepId } from '../onboardingSlice';

interface StepActionsProps {
  back?: StepId;
  nextLabel?: string;
  busy?: boolean;
  children?: ReactNode;
}

/** Back link + submit button at the bottom of a step form. */
export function StepActions({
  back,
  nextLabel = 'Next',
  busy = false,
  children,
}: StepActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
      {back ? (
        <Link
          to={`/tenants/new/${back}`}
          className="rounded-md px-1 text-sm font-medium text-slate-700 underline outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Back
        </Link>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        {children}
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Checking…' : nextLabel}
        </Button>
      </div>
    </div>
  );
}
