import { auditHandlers } from './audit';
import { demoHandlers } from './demo';
import { onboardingHandlers } from './onboarding';
import { programHandlers } from './program';
import { receiptHandlers } from './receipts';
import { systemHandlers } from './system';
import { tenantHandlers } from './tenants';

export const handlers = [
  ...systemHandlers,
  ...demoHandlers,
  ...onboardingHandlers,
  ...tenantHandlers,
  ...programHandlers,
  ...auditHandlers,
  ...receiptHandlers,
];
