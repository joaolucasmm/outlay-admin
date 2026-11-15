import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../../app/store';
import { Button } from '../../../shared/ui/Button';
import { Dialog } from '../../../shared/ui/Dialog';
import { STEP_LABELS, Stepper } from '../components/Stepper';
import { CompanyStep } from '../components/steps/CompanyStep';
import { EmployeesStep } from '../components/steps/EmployeesStep';
import { LocaleStep } from '../components/steps/LocaleStep';
import { ProvisionStep } from '../components/steps/ProvisionStep';
import { ReviewStep } from '../components/steps/ReviewStep';
import {
  allowedStep,
  discardDraft,
  initialOnboardingState,
  isStepComplete,
  selectOnboarding,
  STEPS,
  type StepId,
} from '../onboardingSlice';

const STEP_COMPONENTS: Record<StepId, () => React.JSX.Element> = {
  company: CompanyStep,
  locale: LocaleStep,
  employees: EmployeesStep,
  review: ReviewStep,
  provision: ProvisionStep,
};

const STEP_INTROS: Record<StepId, string> = {
  company: 'Who is the customer?',
  locale: 'Currency and the starting expense program.',
  employees: 'Upload the people covered by the program.',
  review: 'Check everything before provisioning.',
  provision: 'Create and activate the tenant.',
};

/** The onboarding wizard. The step lives in the URL; the data in the persisted draft. */
export function OnboardingPage() {
  const { step } = useParams();
  const draft = useAppSelector(selectOnboarding);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // A draft that was already fully provisioned when the wizard opened is cleared, so
  // "New tenant" starts fresh. One that finishes while open shows its success panel.
  const [finishedOnOpen] = useState(() => isStepComplete(draft, 'provision'));
  useEffect(() => {
    if (finishedOnOpen) dispatch(discardDraft());
  }, [finishedOnOpen, dispatch]);
  if (finishedOnOpen && isStepComplete(draft, 'provision')) return null;

  const current = allowedStep(draft, step);
  if (current !== step) return <Navigate to={`/tenants/new/${current}`} replace />;

  const Step = STEP_COMPONENTS[current];
  const tenantCreated = draft.provisioning.tenantId !== null;
  const hasDraft = draft !== initialOnboardingState && !isStepComplete(draft, 'provision');
  const reachable = (s: StepId) =>
    !tenantCreated && STEPS.indexOf(s) <= STEPS.indexOf(allowedStep(draft, 'provision'));

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">New tenant</h1>
          <p className="mt-1 text-sm text-slate-600">
            Your progress is saved in this browser, so you can leave and come back.
          </p>
        </div>
        {hasDraft && (
          <Button
            onClick={() => {
              setConfirmDiscard(true);
            }}
          >
            Discard draft
          </Button>
        )}
      </div>

      <Stepper current={current} reachable={reachable} complete={(s) => isStepComplete(draft, s)} />

      <section
        aria-labelledby="step-title"
        className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/50 p-6"
      >
        <div>
          <h2 id="step-title" className="text-lg font-semibold">
            {STEP_LABELS[current]}
          </h2>
          <p className="text-sm text-slate-600">{STEP_INTROS[current]}</p>
        </div>
        <Step />
      </section>

      {confirmDiscard && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setConfirmDiscard(false);
          }}
          title="Discard this draft?"
          description={
            tenantCreated
              ? 'The tenant was already created. It stays in provisioning, and you can activate it from the tenants list.'
              : 'Everything you entered in this wizard is lost.'
          }
        >
          <div className="flex justify-end gap-2">
            <Button
              onClick={() => {
                setConfirmDiscard(false);
              }}
            >
              Keep the draft
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirmDiscard(false);
                dispatch(discardDraft());
                void navigate('/tenants/new/company');
              }}
            >
              Discard draft
            </Button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
