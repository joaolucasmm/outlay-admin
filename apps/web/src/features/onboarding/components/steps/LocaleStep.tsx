import { defaultCurrencyFor, SUPPORTED_CURRENCIES } from '@outlay/domain';
import type { CategoryTemplateId } from 'contracts';
import { useId } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router';
import { useAppDispatch, useAppSelector } from '../../../../app/store';
import { saveLocale, selectOnboarding } from '../../onboardingSlice';
import { StepActions } from '../StepActions';

interface LocaleValues {
  currency: string;
  templateId: CategoryTemplateId;
}

export const TEMPLATE_COPY: Record<CategoryTemplateId, { title: string; description: string }> = {
  standard: {
    title: 'Standard',
    description:
      '6 categories (meals, travel, lodging…) with policy rules per role, scaled to the currency.',
  },
  empty: {
    title: 'Empty',
    description: 'No categories. The Program Admin builds the program from scratch.',
  },
};

export function LocaleStep() {
  const { company, locale } = useAppSelector(selectOnboarding);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const currencyId = useId();

  const { register, handleSubmit } = useForm<LocaleValues>({
    defaultValues: locale ?? {
      currency: defaultCurrencyFor(company?.country ?? '') ?? 'USD',
      templateId: 'standard',
    },
  });

  const onSubmit = handleSubmit((values) => {
    dispatch(saveLocale(values));
    void navigate('/tenants/new/employees');
  });

  return (
    <form onSubmit={(event) => void onSubmit(event)} noValidate className="space-y-5">
      <div>
        <label htmlFor={currencyId} className="block text-sm font-medium">
          Currency
        </label>
        <p className="mt-1 text-sm text-slate-600">
          Policy limits and expenses use this currency. It cannot change after provisioning.
        </p>
        <select
          id={currencyId}
          className="mt-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          {...register('currency')}
        >
          {SUPPORTED_CURRENCIES.map((currency) => (
            <option key={currency} value={currency}>
              {currency}
            </option>
          ))}
        </select>
      </div>

      <fieldset>
        <legend className="text-sm font-medium">Category template</legend>
        <div className="mt-2 grid max-w-2xl gap-3 sm:grid-cols-2">
          {(Object.keys(TEMPLATE_COPY) as CategoryTemplateId[]).map((id) => (
            <label
              key={id}
              className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 bg-white p-4 text-sm has-[:checked]:border-indigo-500 has-[:checked]:ring-1 has-[:checked]:ring-indigo-500 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-indigo-500"
            >
              <input type="radio" value={id} className="mt-1" {...register('templateId')} />
              <span>
                <span className="block font-medium">{TEMPLATE_COPY[id].title}</span>
                <span className="block text-slate-600">{TEMPLATE_COPY[id].description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <StepActions back="company" />
    </form>
  );
}
