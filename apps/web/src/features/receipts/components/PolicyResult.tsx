import type { PolicyCheckResult, PolicyFinding } from 'contracts';
import { Badge, type BadgeTone } from '../../../shared/ui/Badge';

const STATUS: Record<PolicyCheckResult['status'], { label: string; tone: BadgeTone }> = {
  compliant: { label: 'Compliant', tone: 'success' },
  needs_approval: { label: 'Needs approval', tone: 'warning' },
  violation: { label: 'Violation', tone: 'danger' },
};

const SEVERITY: Record<PolicyFinding['severity'], { icon: string; label: string; style: string }> =
  {
    info: { icon: '✓', label: 'OK', style: 'text-emerald-700' },
    warn: { icon: '!', label: 'Warning', style: 'text-amber-700' },
    error: { icon: '✕', label: 'Problem', style: 'text-red-700' },
  };

/** The engine's verdict, with one line per check so the decision explains itself. */
export function PolicyResult({ result }: { result: PolicyCheckResult | null }) {
  return (
    <section
      aria-labelledby="policy-result"
      aria-live="polite"
      className="rounded-lg border border-slate-200 bg-white p-4"
    >
      <h2 id="policy-result" className="text-sm font-semibold">
        Policy check
      </h2>
      {!result ? (
        <p className="mt-2 text-sm text-slate-600">
          Fill in the total, category and who spent it to see the result.
        </p>
      ) : (
        <>
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <Badge tone={STATUS[result.status].tone}>{STATUS[result.status].label}</Badge>
            {result.status === 'needs_approval' && (
              <span className="text-slate-600">
                {result.requiredApprovalLevels} approval level
                {result.requiredApprovalLevels === 1 ? '' : 's'}
              </span>
            )}
          </p>
          <ul className="mt-3 space-y-1.5 text-sm">
            {result.findings.map((finding) => {
              const severity = SEVERITY[finding.severity];
              return (
                <li key={finding.code} className="flex gap-2">
                  <span aria-hidden="true" className={`w-4 font-bold ${severity.style}`}>
                    {severity.icon}
                  </span>
                  <span>
                    <span className="sr-only">{severity.label}: </span>
                    {finding.message}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            Decided by the policy rules, not by the AI: it only read the receipt.
          </p>
        </>
      )}
    </section>
  );
}
