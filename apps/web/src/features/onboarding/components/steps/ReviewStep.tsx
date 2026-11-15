import { SUPPORTED_COUNTRIES } from '@outlay/domain';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAppSelector } from '../../../../app/store';
import { selectOnboarding, type StepId } from '../../onboardingSlice';
import { StepActions } from '../StepActions';
import { TEMPLATE_COPY } from './LocaleStep';

function Row({ label, step, children }: { label: string; step: StepId; children: ReactNode }) {
  return (
    <div className="grid gap-1 py-3 sm:grid-cols-[10rem_1fr_auto] sm:items-center">
      <dt className="text-sm text-slate-600">{label}</dt>
      <dd className="text-sm font-medium">{children}</dd>
      <dd>
        <Link
          to={`/tenants/new/${step}`}
          className="rounded text-sm text-indigo-700 underline outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          Edit<span className="sr-only"> {label.toLowerCase()}</span>
        </Link>
      </dd>
    </div>
  );
}

export function ReviewStep() {
  const { company, locale, employees } = useAppSelector(selectOnboarding);
  const navigate = useNavigate();
  const valid = employees.preview?.valid.length ?? 0;
  const skipped = employees.preview?.invalid.length ?? 0;
  const country = SUPPORTED_COUNTRIES.find((c) => c.code === company?.country)?.name;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void navigate('/tenants/new/provision');
      }}
      className="space-y-5"
    >
      <dl className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white px-4">
        <Row label="Company" step="company">
          {company?.name}
        </Row>
        <Row label="Country" step="company">
          {country}
        </Row>
        <Row label="Currency" step="locale">
          {locale?.currency}
        </Row>
        <Row label="Template" step="locale">
          {locale ? TEMPLATE_COPY[locale.templateId].title : ''}
        </Row>
        <Row label="Employees" step="employees">
          {valid === 0 ? 'None for now' : `${valid} to import`}
          {skipped > 0 && (
            <span className="font-normal text-slate-600"> ({skipped} rows skipped)</span>
          )}
        </Row>
      </dl>
      <p className="text-sm text-slate-600">
        Provisioning creates the tenant, sets up its program, imports the employees and activates
        it. If a step fails you can retry it without starting over.
      </p>
      <StepActions back="employees" nextLabel="Continue to provisioning" />
    </form>
  );
}
