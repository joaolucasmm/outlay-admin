import { Link } from 'react-router';
import { useAppSelector } from '../store';
import { homePathFor } from '../../features/session/navigation';
import { selectPersona } from '../../features/session/sessionSlice';

export function NotFoundPage() {
  const persona = useAppSelector(selectPersona);
  return (
    <section aria-labelledby="page-title" className="max-w-xl space-y-3">
      <h1 id="page-title" className="text-2xl font-semibold tracking-tight">
        Page not found
      </h1>
      <p className="text-sm text-slate-600">This address does not match any page.</p>
      <Link
        to={homePathFor(persona)}
        className="inline-block rounded-md text-sm font-medium text-indigo-700 underline outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        Go to your home page
      </Link>
    </section>
  );
}
