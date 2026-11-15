import { Link } from 'react-router';
import { useAppSelector } from '../../../app/store';
import { homePathFor } from '../navigation';
import { selectPersona } from '../sessionSlice';

export function NotAuthorized({ reason }: { reason: string }) {
  const persona = useAppSelector(selectPersona);
  return (
    <section aria-labelledby="page-title" className="max-w-xl">
      <h1 id="page-title" className="text-2xl font-semibold tracking-tight">
        Not authorized
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        You are signed in as <strong>{persona.label}</strong>. {reason}
      </p>
      <Link
        to={homePathFor(persona)}
        className="mt-4 inline-block rounded-md text-sm font-medium text-indigo-700 underline outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        Go to your home page
      </Link>
    </section>
  );
}
