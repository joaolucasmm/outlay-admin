import { isRouteErrorResponse, Link, useRouteError } from 'react-router';

/**
 * Shown when a page throws while rendering or loading: a readable message and a way
 * out, instead of a blank screen. The error details go to the console for debugging.
 */
export function RouteErrorPage() {
  const error = useRouteError();
  const status = isRouteErrorResponse(error) ? error.status : null;
  console.error(error);

  return (
    <main className="mx-auto max-w-xl p-8">
      <section role="alert" aria-labelledby="error-title" className="space-y-3">
        <h1 id="error-title" className="text-2xl font-semibold tracking-tight">
          {status === 404 ? 'Page not found' : 'Something went wrong'}
        </h1>
        <p className="text-sm text-slate-600">
          {status === 404
            ? 'This address does not match any page.'
            : 'This page hit an unexpected error. Your data is safe: reloading usually fixes it.'}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => {
              window.location.reload();
            }}
            className="rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white outline-none hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-1"
          >
            Reload
          </button>
          <Link
            to="/"
            className="rounded-md border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-800 outline-none hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Go to your home page
          </Link>
        </div>
      </section>
    </main>
  );
}
