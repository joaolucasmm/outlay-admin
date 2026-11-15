/**
 * M0 placeholder for the tenant switcher. The tenant list is server data, so in M1 it
 * moves to RTK Query (`GET /tenants`) and this file is deleted.
 */
export const DEFAULT_TENANT_ID = 'tnt_bluefin';

export const PLACEHOLDER_TENANTS: readonly { value: string; label: string }[] = [
  { value: DEFAULT_TENANT_ID, label: 'Bluefin Logistics' },
  { value: 'tnt_cedarpine', label: 'Cedar & Pine Studio' },
  { value: 'tnt_harbor', label: 'Harbor Health Group' },
];
