import { api } from '../../../app/api';
import { useAppDispatch } from '../../../app/store';
import { useResetDemoMutation } from '../api';

/** Restores the seeded demo data: the mock's, or the Java API's in its `demo` profile. */
export function ResetDemoButton() {
  const [resetDemo, { isLoading }] = useResetDemoMutation();
  const dispatch = useAppDispatch();

  return (
    <button
      type="button"
      disabled={isLoading}
      onClick={() => {
        void resetDemo(undefined)
          .unwrap()
          .then(() => dispatch(api.util.resetApiState()));
      }}
      className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-600 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:opacity-50"
    >
      {isLoading ? 'Resetting…' : 'Reset demo data'}
    </button>
  );
}
