import { useState } from 'react';
import { problemFieldErrors, problemMessage } from '../../../shared/lib/problem';
import { Button } from '../../../shared/ui/Button';
import { Dialog, DialogClose } from '../../../shared/ui/Dialog';
import { useImportEmployeesMutation } from '../api';
import type { EmployeeImportPreview } from '../csv';
import { CsvImport } from './CsvImport';

const ROW_ERROR = /^employees\[(\d+)\]\./;

/**
 * Moves rows the server rejected (e.g. an email that already exists) from `valid` to
 * `invalid`, using the `employees[i].field` paths of the Problem Details.
 */
export function applyServerErrors(
  preview: EmployeeImportPreview,
  error: unknown,
): EmployeeImportPreview {
  const byIndex = new Map<number, string[]>();
  for (const { field, message } of problemFieldErrors(error)) {
    const index = Number(ROW_ERROR.exec(field)?.[1] ?? NaN);
    if (Number.isInteger(index)) byIndex.set(index, [...(byIndex.get(index) ?? []), message]);
  }
  if (byIndex.size === 0) return preview;
  return {
    ...preview,
    valid: preview.valid.filter((_, i) => !byIndex.has(i)),
    invalid: [
      ...preview.invalid,
      ...preview.valid.flatMap(({ line, employee }, i) => {
        const errors = byIndex.get(i);
        return errors ? [{ line, row: employee, errors }] : [];
      }),
    ].sort((a, b) => a.line - b.line),
  };
}

interface ImportEmployeesDialogProps {
  tenantId: string;
  onClose: () => void;
  onDone: (message: string) => void;
}

export function ImportEmployeesDialog({ tenantId, onClose, onDone }: ImportEmployeesDialogProps) {
  const [preview, setPreview] = useState<EmployeeImportPreview | null>(null);
  const [importEmployees, { isLoading, error, reset }] = useImportEmployeesMutation();
  const count = preview?.valid.length ?? 0;

  const submit = async () => {
    if (!preview || count === 0) return;
    const result = await importEmployees({
      tenantId,
      employees: preview.valid.map((v) => v.employee),
    });
    if (result.data) {
      const n = result.data.imported;
      onDone(`${n} employee${n === 1 ? '' : 's'} imported.`);
      return;
    }
    setPreview(applyServerErrors(preview, result.error));
  };

  return (
    <Dialog
      open
      size="lg"
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title="Import employees"
      description="Only valid rows are imported. Rows with errors are skipped; download the error report to fix them."
    >
      <div className="space-y-4">
        <CsvImport
          preview={preview}
          onPreview={(next) => {
            reset();
            setPreview(next);
          }}
          disabled={isLoading}
        />
        {error && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {problemMessage(error)}
            {problemFieldErrors(error).length > 0 && ' The affected rows moved to the error list.'}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button>Cancel</Button>
          </DialogClose>
          <Button
            variant="primary"
            disabled={count === 0 || isLoading}
            onClick={() => void submit()}
          >
            {isLoading ? 'Importing…' : `Import ${count} employee${count === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
