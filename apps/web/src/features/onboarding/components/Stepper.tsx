import { Link } from 'react-router';
import { STEPS, type StepId } from '../onboardingSlice';

export const STEP_LABELS: Record<StepId, string> = {
  company: 'Company',
  locale: 'Locale',
  employees: 'Employees',
  review: 'Review',
  provision: 'Provision',
};

interface StepperProps {
  current: StepId;
  /** Steps the user may jump back to. */
  reachable: (step: StepId) => boolean;
  complete: (step: StepId) => boolean;
}

export function Stepper({ current, reachable, complete }: StepperProps) {
  return (
    <nav aria-label="Onboarding steps">
      <ol className="flex flex-wrap gap-2 text-sm">
        {STEPS.map((step, index) => {
          const isCurrent = step === current;
          const done = complete(step) && !isCurrent;
          const label = (
            <>
              <span
                aria-hidden="true"
                className={`inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isCurrent
                    ? 'bg-indigo-600 text-white'
                    : done
                      ? 'bg-emerald-100 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                }`}
              >
                {done ? '✓' : index + 1}
              </span>
              {STEP_LABELS[step]}
              {done && <span className="sr-only"> (completed)</span>}
            </>
          );
          const base = 'flex items-center gap-2 rounded-full px-3 py-1.5';
          return (
            <li key={step}>
              {isCurrent ? (
                <span
                  aria-current="step"
                  className={`${base} bg-indigo-50 font-medium text-indigo-800`}
                >
                  {label}
                </span>
              ) : reachable(step) ? (
                <Link
                  to={`/tenants/new/${step}`}
                  className={`${base} text-slate-700 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500`}
                >
                  {label}
                </Link>
              ) : (
                <span className={`${base} text-slate-400`}>{label}</span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
