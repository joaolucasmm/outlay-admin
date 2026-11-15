import { loadJson, saveJson } from '../../shared/lib/storage';
import type { OnboardingState } from './onboardingSlice';

/** Bump when the draft shape changes: an older draft is then dropped. */
const KEY = 'outlay-admin:onboarding:v1';

const isDraft = (value: unknown): value is OnboardingState =>
  typeof value === 'object' &&
  value !== null &&
  'company' in value &&
  'locale' in value &&
  'employees' in value &&
  typeof value.employees === 'object' &&
  value.employees !== null &&
  'provisioning' in value &&
  typeof value.provisioning === 'object' &&
  value.provisioning !== null &&
  'done' in value.provisioning &&
  Array.isArray(value.provisioning.done);

/** The onboarding draft survives a reload, so a long CSV review isn't lost. */
export const loadOnboardingDraft = (storage: Storage) => loadJson(storage, KEY, isDraft);
export const saveOnboardingDraft = (storage: Storage, draft: OnboardingState) => {
  saveJson(storage, KEY, draft);
};
