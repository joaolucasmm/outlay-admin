import { zodResolver } from '@hookform/resolvers/zod';
import {
  defaultCurrencyFor,
  sameTenantName,
  SUPPORTED_COUNTRIES,
  validateNewTenant,
} from '@outlay/domain';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { useLazySearchTenantsQuery } from '../../../tenants/api';
import { saveCompany, selectOnboarding } from '../../onboardingSlice';
import { StepActions } from '../StepActions';

interface CompanyValues {
  name: string;
  country: string;
}

const schema = z.object({ name: z.string(), country: z.string() }).superRefine((v, ctx) => {
  const result = validateNewTenant({
    name: v.name,
    country: v.country,
    currency: defaultCurrencyFor(v.country) ?? '',
  });
  if (result.ok) return;
  for (const error of result.error) {
    if (error.field === 'currency') continue;
    ctx.addIssue({ code: 'custom', path: [error.field], message: error.message });
  }
});

const fieldClass =
  'mt-1 w-full max-w-md rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500';

export function CompanyStep() {
  const { company } = useAppSelector(selectOnboarding);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchTenants, { isFetching }] = useLazySearchTenantsQuery();
  const ids = { name: useId(), country: useId() };

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CompanyValues>({
    defaultValues: company ?? { name: '', country: '' },
    resolver: zodResolver(schema),
  });

  const onSubmit = handleSubmit(async ({ name, country }) => {
    const cleanName = name.trim().replace(/\s+/g, ' ');
    // Early, friendly check. The server is still the one that enforces uniqueness.
    const found = await searchTenants({ q: cleanName, limit: 100 });
    if (found.data?.items.some((t) => sameTenantName(t.name, cleanName))) {
      setError('name', { message: 'A tenant with this name already exists.' });
      return;
    }
    dispatch(saveCompany({ name: cleanName, country }));
    void navigate('/tenants/new/locale');
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-5">
      <div>
        <label htmlFor={ids.name} className="block text-sm font-medium">
          Company name
        </label>
        <input
          id={ids.name}
          autoComplete="organization"
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? `${ids.name}-error` : undefined}
          className={fieldClass}
          {...register('name')}
        />
        {errors.name && (
          <p id={`${ids.name}-error`} className="mt-1 text-sm text-red-700">
            {errors.name.message}
          </p>
        )}
      </div>
      <div>
        <label htmlFor={ids.country} className="block text-sm font-medium">
          Country
        </label>
        <select
          id={ids.country}
          aria-invalid={errors.country ? true : undefined}
          aria-describedby={errors.country ? `${ids.country}-error` : undefined}
          className={fieldClass}
          {...register('country')}
        >
          <option value="" disabled>
            Choose a country
          </option>
          {SUPPORTED_COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        {errors.country && (
          <p id={`${ids.country}-error`} className="mt-1 text-sm text-red-700">
            {errors.country.message}
          </p>
        )}
      </div>
      <StepActions busy={isFetching} />
    </form>
  );
}
