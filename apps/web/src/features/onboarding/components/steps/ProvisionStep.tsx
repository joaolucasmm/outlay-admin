import { useState } from 'react';
import { Link } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { problemMessage } from '../../../../shared/lib/problem';
import { Button } from '../../../../shared/ui/Button';
import { useImportEmployeesMutation } from '../../../employees/api';
import {
  useApplyCategoryTemplateMutation,
  useCreateTenantMutation,
  useTransitionTenantMutation,
} from '../../../tenants/api';
import {
  discardDraft,
  PROVISION_TASKS,
  provisionTaskDone,
  selectOnboarding,
  type ProvisionTaskId,
} from '../../onboardingSlice';

type TaskStatus = 'pending' | 'running' | 'done' | 'skipped' | 'failed';

const STATUS_TEXT: Record<TaskStatus, string> = {
  pending: 'Pending',
  running: 'In progress',
  done: 'Done',
  skipped: 'Skipped',
  failed: 'Failed',
};

const STATUS_STYLE: Record<TaskStatus, string> = {
  pending: 'bg-slate-100 text-slate-600',
  running: 'bg-indigo-100 text-indigo-800',
  done: 'bg-emerald-100 text-emerald-800',
  skipped: 'bg-slate-100 text-slate-600',
  failed: 'bg-red-100 text-red-800',
};

/**
 * Runs the real provisioning calls in order. Completed tasks are recorded in the
 * persisted draft, so Retry (even after a reload) continues where it stopped and never
 * creates the tenant twice.
 */
export function ProvisionStep() {
  const draft = useAppSelector(selectOnboarding);
  const dispatch = useAppDispatch();
  const [createTenant] = useCreateTenantMutation();
  const [applyTemplate] = useApplyCategoryTemplateMutation();
  const [importEmployees] = useImportEmployeesMutation();
  const [transitionTenant] = useTransitionTenantMutation();
  const [running, setRunning] = useState<ProvisionTaskId | null>(null);
  const [failure, setFailure] = useState<{ task: ProvisionTaskId; message: string } | null>(null);

  const { company, locale, employees, provisioning } = draft;
  const toImport = employees.preview?.valid.map((v) => v.employee) ?? [];
  const skips = (task: ProvisionTaskId) =>
    (task === 'template' && locale?.templateId === 'empty') ||
    (task === 'employees' && toImport.length === 0);

  const labels: Record<ProvisionTaskId, string> = {
    create: `Create ${company?.name ?? 'the tenant'}`,
    template:
      locale?.templateId === 'empty'
        ? 'Set up the program (empty template)'
        : 'Apply the standard category template',
    employees:
      toImport.length === 0
        ? 'Import employees (none in the file)'
        : `Import ${toImport.length} employee${toImport.length === 1 ? '' : 's'}`,
    activate: 'Activate the tenant',
  };

  const statusOf = (task: ProvisionTaskId): TaskStatus => {
    if (provisioning.done.includes(task)) return skips(task) ? 'skipped' : 'done';
    if (running === task) return 'running';
    if (failure?.task === task) return 'failed';
    return 'pending';
  };

  const run = async () => {
    if (!company || !locale) return;
    setFailure(null);
    let tenantId = provisioning.tenantId;
    let current: ProvisionTaskId = 'create';
    try {
      for (const task of PROVISION_TASKS) {
        if (provisioning.done.includes(task)) continue;
        current = task;
        setRunning(task);
        if (task === 'create') {
          const tenant = await createTenant({
            name: company.name,
            country: company.country,
            currency: locale.currency,
          }).unwrap();
          tenantId = tenant.id;
          dispatch(provisionTaskDone({ task, tenantId }));
          continue;
        }
        if (!tenantId) throw new Error('The tenant was not created.');
        if (task === 'template' && !skips(task)) {
          await applyTemplate({ tenantId, templateId: locale.templateId }).unwrap();
        }
        if (task === 'employees' && !skips(task)) {
          await importEmployees({ tenantId, employees: toImport }).unwrap();
        }
        if (task === 'activate') {
          await transitionTenant({ tenantId, command: { action: 'activate' } }).unwrap();
        }
        dispatch(provisionTaskDone({ task }));
      }
      setRunning(null);
    } catch (error) {
      setRunning(null);
      setFailure({ task: current, message: problemMessage(error) });
    }
  };

  const started = provisioning.done.length > 0;
  const finished = provisioning.done.length === PROVISION_TASKS.length;
  const nameTaken = failure?.task === 'create';

  return (
    <div className="space-y-5">
      <ol className="space-y-2" aria-label="Provisioning progress">
        {PROVISION_TASKS.map((task, index) => {
          const status = statusOf(task);
          return (
            <li
              key={task}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm"
            >
              <span>
                <span className="mr-2 text-slate-500">{index + 1}.</span>
                {labels[task]}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status]}`}
              >
                {STATUS_TEXT[status]}
              </span>
            </li>
          );
        })}
      </ol>

      <p role="status" className="sr-only">
        {running ? `${labels[running]}…` : ''}
      </p>

      {failure && (
        <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          <p>
            “{labels[failure.task]}” failed: {failure.message}
          </p>
          {nameTaken && (
            <p className="mt-1">
              Nothing was created.{' '}
              <Link to="/tenants/new/company" className="font-medium underline">
                Change the company details
              </Link>
              .
            </p>
          )}
        </div>
      )}

      {finished ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
          <p role="status" className="text-sm font-medium text-emerald-900">
            {company?.name} is provisioned and active.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                // The wizard then shows a fresh Company step.
                dispatch(discardDraft());
              }}
            >
              Onboard another tenant
            </Button>
            <Link
              to="/tenants"
              className="inline-flex items-center rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white outline-none hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
            >
              Go to tenants
            </Link>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          {started ? (
            <span className="text-sm text-slate-600">
              The tenant exists and stays in provisioning until every step is done.
            </span>
          ) : (
            <Link
              to="/tenants/new/review"
              className="rounded-md px-1 text-sm font-medium text-slate-700 underline outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Back
            </Link>
          )}
          <Button variant="primary" disabled={running !== null} onClick={() => void run()}>
            {running ? 'Provisioning…' : failure || started ? 'Retry' : 'Provision tenant'}
          </Button>
        </div>
      )}
    </div>
  );
}
