import { zodResolver } from '@hookform/resolvers/zod';
import { validateCategoryFields } from '@outlay/domain';
import type { ExpenseCategory } from 'contracts';
import { useId } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { z } from 'zod';
import { problemFieldErrors, problemMessage } from '../../../shared/lib/problem';
import { Button } from '../../../shared/ui/Button';
import { Dialog, DialogClose } from '../../../shared/ui/Dialog';
import { useCreateCategoryMutation, useUpdateCategoryMutation } from '../api';

interface FormValues {
  code: string;
  name: string;
  glAccount: string;
}

const FIELDS: readonly FieldPath<FormValues>[] = ['code', 'name', 'glAccount'];

/** The form reuses the domain's validation, so it rejects exactly what the backend rejects. */
const schemaFor = (mode: 'create' | 'edit') =>
  z.object({ code: z.string(), name: z.string(), glAccount: z.string() }).superRefine((v, ctx) => {
    const result = validateCategoryFields(
      mode === 'create' ? v : { name: v.name, glAccount: v.glAccount },
    );
    if (result.ok) return;
    for (const error of result.error) {
      ctx.addIssue({ code: 'custom', path: [error.field], message: error.message });
    }
  });

interface CategoryDialogProps {
  tenantId: string;
  /** Omit to create a new category. */
  category?: ExpenseCategory;
  onClose: () => void;
  onDone: (message: string) => void;
}

export function CategoryDialog({ tenantId, category, onClose, onDone }: CategoryDialogProps) {
  const mode = category ? 'edit' : 'create';
  const [createCategory, createState] = useCreateCategoryMutation();
  const [updateCategory, updateState] = useUpdateCategoryMutation();
  const { isLoading, error } = mode === 'create' ? createState : updateState;
  const ids = { code: useId(), name: useId(), glAccount: useId() };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: {
      code: category?.code ?? '',
      name: category?.name ?? '',
      glAccount: category?.glAccount ?? '',
    },
    resolver: zodResolver(schemaFor(mode)),
  });

  const onSubmit = handleSubmit(async (values) => {
    const glAccount = values.glAccount.trim() === '' ? null : values.glAccount.trim();
    const result = category
      ? await updateCategory({
          tenantId,
          categoryId: category.id,
          body: { name: values.name.trim(), glAccount },
        })
      : await createCategory({
          tenantId,
          body: { code: values.code.trim(), name: values.name.trim(), glAccount },
        });

    if (result.data) {
      onDone(`${result.data.name} ${mode === 'create' ? 'created' : 'saved'}.`);
      return;
    }
    // Put server-side field errors (e.g. a duplicate code) next to their inputs.
    for (const fieldError of problemFieldErrors(result.error)) {
      const field = FIELDS.find((f) => f === fieldError.field);
      if (field) setError(field, { message: fieldError.message });
    }
  });

  const fieldClass =
    'mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 disabled:bg-slate-100';

  const fieldError = (field: keyof FormValues) =>
    errors[field] && (
      <p id={`${ids[field]}-error`} className="mt-1 text-sm text-red-700">
        {errors[field].message}
      </p>
    );

  const described = (field: keyof FormValues) => ({
    'aria-invalid': errors[field] ? true : undefined,
    'aria-describedby': errors[field] ? `${ids[field]}-error` : undefined,
  });

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={category ? `Edit ${category.name}` : 'New category'}
      description={
        category
          ? 'The code cannot change: receipts and exports refer to it.'
          : 'Categories cannot be deleted later, only deactivated.'
      }
    >
      <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-4">
        <div>
          <label htmlFor={ids.code} className="block text-sm font-medium">
            Code
          </label>
          <input
            id={ids.code}
            autoComplete="off"
            disabled={mode === 'edit'}
            className={`${fieldClass} font-mono uppercase`}
            {...described('code')}
            {...register('code')}
          />
          {fieldError('code')}
        </div>
        <div>
          <label htmlFor={ids.name} className="block text-sm font-medium">
            Name
          </label>
          <input
            id={ids.name}
            className={fieldClass}
            {...described('name')}
            {...register('name')}
          />
          {fieldError('name')}
        </div>
        <div>
          <label htmlFor={ids.glAccount} className="block text-sm font-medium">
            GL account <span className="font-normal text-slate-500">(optional)</span>
          </label>
          <input
            id={ids.glAccount}
            className={fieldClass}
            {...described('glAccount')}
            {...register('glAccount')}
          />
          {fieldError('glAccount')}
        </div>

        {error && problemFieldErrors(error).length === 0 && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            {problemMessage(error)}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button>Cancel</Button>
          </DialogClose>
          <Button type="submit" variant="primary" disabled={isLoading}>
            {isLoading ? 'Saving…' : mode === 'create' ? 'Create category' : 'Save'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
