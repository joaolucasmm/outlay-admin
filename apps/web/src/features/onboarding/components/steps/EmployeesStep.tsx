import { useId, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { CsvImport } from '../../../employees/components/CsvImport';
import {
  markEmployeesReviewed,
  saveEmployees,
  selectOnboarding,
  setSkipInvalid,
} from '../../onboardingSlice';
import { StepActions } from '../StepActions';

export function EmployeesStep() {
  const { employees } = useAppSelector(selectOnboarding);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const skipId = useId();
  const { preview, skipInvalid } = employees;
  const invalid = preview?.invalid.length ?? 0;

  const onNext = () => {
    if (invalid > 0 && !skipInvalid) {
      setError('Fix the file, or confirm that the rows with errors will be skipped.');
      return;
    }
    dispatch(markEmployeesReviewed());
    void navigate('/tenants/new/review');
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onNext();
      }}
      noValidate
      className="space-y-5"
    >
      <p className="text-sm text-slate-600">
        Optional: you can also import employees later from the Employees page.
      </p>
      <CsvImport
        preview={preview}
        onPreview={(next) => {
          setError('');
          dispatch(saveEmployees(next));
        }}
      />

      {invalid > 0 && (
        <div className="flex items-start gap-2 text-sm">
          <input
            id={skipId}
            type="checkbox"
            checked={skipInvalid}
            onChange={(event) => {
              setError('');
              dispatch(setSkipInvalid(event.target.checked));
            }}
            className="mt-0.5"
          />
          <label htmlFor={skipId}>
            Skip the {invalid} row{invalid === 1 ? '' : 's'} with errors and import only the valid
            ones.
          </label>
        </div>
      )}

      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      )}

      <StepActions back="locale" nextLabel={preview ? 'Next' : 'Skip for now'} />
    </form>
  );
}
