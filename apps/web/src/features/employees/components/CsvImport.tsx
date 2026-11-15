import { useId, useState } from 'react';
import { downloadText, readFileText } from '../../../shared/lib/files';
import { Button } from '../../../shared/ui/Button';
import { ROLE_LABELS } from '../../policies/grid';
import {
  errorReportCsv,
  MAX_BYTES,
  MAX_ROWS,
  parseEmployeeCsv,
  TEMPLATE_CSV,
  type EmployeeImportPreview,
} from '../csv';

interface CsvImportProps {
  /** Controlled: the onboarding wizard keeps it in its persisted draft. */
  preview: EmployeeImportPreview | null;
  onPreview: (preview: EmployeeImportPreview | null) => void;
  existingEmails?: Iterable<string>;
  disabled?: boolean;
}

const PREVIEW_ROWS = 10;

/** Upload an employee CSV, see valid rows and row-level errors, download an error report. */
export function CsvImport({
  preview,
  onPreview,
  existingEmails,
  disabled = false,
}: CsvImportProps) {
  const inputId = useId();
  const helpId = useId();
  const [fileError, setFileError] = useState('');

  const onFile = async (file: File | undefined) => {
    setFileError('');
    if (!file) return;
    if (file.size > MAX_BYTES) {
      setFileError('The file is larger than 1 MB.');
      return;
    }
    const result = parseEmployeeCsv(await readFileText(file), file.name, existingEmails);
    if (result.ok) onPreview(result.value);
    else {
      setFileError(result.error);
      onPreview(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label htmlFor={inputId} className="block text-sm font-medium">
          Employee CSV file
        </label>
        <p id={helpId} className="mt-1 text-sm text-slate-600">
          Columns <code>name, email, role, costCenter</code>; role is employee, manager or director.
          Comma or semicolon separated, up to {MAX_ROWS} rows and 1 MB.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            id={inputId}
            type="file"
            accept=".csv,text/csv"
            disabled={disabled}
            aria-describedby={helpId}
            onChange={(event) => {
              void onFile(event.target.files?.[0]);
              event.target.value = '';
            }}
            className="text-sm file:mr-3 file:rounded-md file:border file:border-slate-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium hover:file:bg-slate-50"
          />
          <Button
            size="sm"
            onClick={() => {
              downloadText('employees-template.csv', TEMPLATE_CSV);
            }}
          >
            Download template
          </Button>
        </div>
      </div>

      {fileError && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
          {fileError}
        </p>
      )}

      {preview && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-slate-100 px-3 py-2 text-sm">
            <p role="status">
              <strong>{preview.fileName}</strong>: {preview.valid.length} valid,{' '}
              {preview.invalid.length} with errors.
            </p>
            <Button
              size="sm"
              disabled={disabled}
              onClick={() => {
                onPreview(null);
              }}
            >
              Remove file
            </Button>
          </div>

          {preview.invalid.length > 0 && (
            <section aria-labelledby={`${inputId}-errors`} className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 id={`${inputId}-errors`} className="text-sm font-semibold text-red-800">
                  Rows with errors ({preview.invalid.length})
                </h3>
                <Button
                  size="sm"
                  onClick={() => {
                    downloadText(
                      preview.fileName.replace(/\.csv$/i, '') + '-errors.csv',
                      errorReportCsv(preview.invalid),
                    );
                  }}
                >
                  Download error report
                </Button>
              </div>
              <div className="max-h-56 overflow-auto rounded-md border border-red-200">
                <table className="min-w-full text-sm">
                  <caption className="sr-only">Rows with errors</caption>
                  <thead className="bg-red-50 text-left text-xs uppercase text-red-900">
                    <tr>
                      <th scope="col" className="px-3 py-2">
                        Line
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Email
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Problems
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-red-100">
                    {preview.invalid.map((row) => (
                      <tr key={row.line}>
                        <td className="px-3 py-2 tabular-nums">{row.line}</td>
                        <td className="px-3 py-2">{row.row.email || '—'}</td>
                        <td className="px-3 py-2">{row.errors.join(' ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {preview.valid.length > 0 && (
            <section aria-labelledby={`${inputId}-valid`} className="space-y-2">
              <h3 id={`${inputId}-valid`} className="text-sm font-semibold">
                Valid rows ({preview.valid.length})
              </h3>
              <div className="overflow-auto rounded-md border border-slate-200">
                <table className="min-w-full text-sm">
                  <caption className="sr-only">Valid rows</caption>
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-600">
                    <tr>
                      <th scope="col" className="px-3 py-2">
                        Name
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Email
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Role
                      </th>
                      <th scope="col" className="px-3 py-2">
                        Cost center
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.valid.slice(0, PREVIEW_ROWS).map(({ line, employee }) => (
                      <tr key={line}>
                        <td className="px-3 py-2">{employee.name}</td>
                        <td className="px-3 py-2">{employee.email}</td>
                        <td className="px-3 py-2">{ROLE_LABELS[employee.role]}</td>
                        <td className="px-3 py-2">{employee.costCenter}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {preview.valid.length > PREVIEW_ROWS && (
                <p className="text-sm text-slate-600">
                  …and {preview.valid.length - PREVIEW_ROWS} more.
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
