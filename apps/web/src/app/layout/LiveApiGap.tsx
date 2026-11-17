import type { ReactNode } from 'react';
import { apiMode } from '../config';

interface LiveApiGapProps {
  /** Page name, used as the heading of the notice. */
  feature: string;
  /**
   * When set, the page still works in live mode and this text is shown above it; when absent,
   * the page is replaced by a notice.
   */
  partial?: string;
  /** Injected in tests; defaults to `VITE_API_MODE=live`. */
  live?: boolean;
  children: ReactNode;
}

/**
 * Marks pages whose endpoints the Spring Boot tenant API (services/tenant-api) does not serve
 * yet. It covers tenants, lifecycle and audit (M8); the tenant program arrives in M8b. In mock
 * mode it renders the page untouched.
 */
export function LiveApiGap({
  feature,
  partial,
  live = apiMode === 'live',
  children,
}: LiveApiGapProps) {
  if (!live) return children;

  if (partial) {
    return (
      <div className="space-y-4">
        <p
          role="note"
          className="max-w-4xl rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {partial}
        </p>
        {children}
      </div>
    );
  }

  return (
    <section aria-labelledby="page-title" className="max-w-xl space-y-3">
      <h1 id="page-title" className="text-2xl font-semibold tracking-tight">
        {feature}
      </h1>
      <p role="note" className="text-sm text-slate-600">
        Not implemented in the live API yet. The tenant API serves tenants, lifecycle actions and
        the audit log; the tenant program (categories, policies, employees) arrives in milestone
        M8b. Run the app in mock mode to use this page.
      </p>
    </section>
  );
}
