import { auditHandlers } from './audit';
import { demoHandlers } from './demo';
import { systemHandlers } from './system';
import { tenantHandlers } from './tenants';

export const handlers = [...systemHandlers, ...demoHandlers, ...tenantHandlers, ...auditHandlers];
