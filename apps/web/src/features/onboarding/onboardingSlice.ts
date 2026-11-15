import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { defaultCurrencyFor } from '@outlay/domain';
import type { CategoryTemplateId } from 'contracts';
import type { EmployeeImportPreview } from '../employees/csv';

export const STEPS = ['company', 'locale', 'employees', 'review', 'provision'] as const;
export type StepId = (typeof STEPS)[number];

/** The real calls provisioning makes, in order. Done ones are skipped on retry. */
export const PROVISION_TASKS = ['create', 'template', 'employees', 'activate'] as const;
export type ProvisionTaskId = (typeof PROVISION_TASKS)[number];

export interface OnboardingState {
  company: { name: string; country: string } | null;
  locale: { currency: string; templateId: CategoryTemplateId } | null;
  employees: {
    preview: EmployeeImportPreview | null;
    /** Rows with errors will be skipped, and the user said so. */
    skipInvalid: boolean;
    /** The user moved past the step (it is optional). */
    reviewed: boolean;
  };
  provisioning: {
    /** Set once the tenant exists: from then on the draft can only finish provisioning. */
    tenantId: string | null;
    done: ProvisionTaskId[];
  };
}

export const initialOnboardingState: OnboardingState = {
  company: null,
  locale: null,
  employees: { preview: null, skipInvalid: false, reviewed: false },
  provisioning: { tenantId: null, done: [] },
};

export const onboardingSlice = createSlice({
  name: 'onboarding',
  initialState: initialOnboardingState,
  reducers: {
    saveCompany(state, action: PayloadAction<{ name: string; country: string }>) {
      const countryChanged = state.company?.country !== action.payload.country;
      state.company = action.payload;
      // A new country brings its own default currency.
      const currency = defaultCurrencyFor(action.payload.country);
      if (countryChanged && state.locale && currency) state.locale.currency = currency;
    },
    saveLocale(state, action: PayloadAction<{ currency: string; templateId: CategoryTemplateId }>) {
      state.locale = action.payload;
    },
    saveEmployees(state, action: PayloadAction<EmployeeImportPreview | null>) {
      state.employees = { preview: action.payload, skipInvalid: false, reviewed: false };
    },
    setSkipInvalid(state, action: PayloadAction<boolean>) {
      state.employees.skipInvalid = action.payload;
    },
    markEmployeesReviewed(state) {
      state.employees.reviewed = true;
    },
    provisionTaskDone(state, action: PayloadAction<{ task: ProvisionTaskId; tenantId?: string }>) {
      if (action.payload.tenantId) state.provisioning.tenantId = action.payload.tenantId;
      if (!state.provisioning.done.includes(action.payload.task)) {
        state.provisioning.done.push(action.payload.task);
      }
    },
    discardDraft: () => initialOnboardingState,
  },
  selectors: {
    selectOnboarding: (state) => state,
  },
});

export const {
  saveCompany,
  saveLocale,
  saveEmployees,
  setSkipInvalid,
  markEmployeesReviewed,
  provisionTaskDone,
  discardDraft,
} = onboardingSlice.actions;
export const { selectOnboarding } = onboardingSlice.selectors;

/** Whether a step's data is complete, so the steps after it can be opened. */
export const isStepComplete = (draft: OnboardingState, step: StepId): boolean => {
  switch (step) {
    case 'company':
      return draft.company !== null;
    case 'locale':
      return draft.locale !== null;
    case 'employees':
      return draft.employees.reviewed;
    case 'review':
      return isStepComplete(draft, 'employees');
    case 'provision':
      return draft.provisioning.done.length === PROVISION_TASKS.length;
  }
};

/** The step the wizard should show when `requested` can't be opened yet. */
export function allowedStep(draft: OnboardingState, requested: string | undefined): StepId {
  // Once the tenant exists, only provisioning can continue.
  if (draft.provisioning.tenantId) return 'provision';
  const firstIncomplete = STEPS.find((step) => !isStepComplete(draft, step)) ?? 'provision';
  const wanted = STEPS.find((step) => step === requested);
  if (!wanted) return firstIncomplete;
  return STEPS.indexOf(wanted) <= STEPS.indexOf(firstIncomplete) ? wanted : firstIncomplete;
}
