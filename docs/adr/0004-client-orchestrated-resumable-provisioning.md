# Provisioning is a sequence of real, resumable client calls

The onboarding wizard provisions a tenant with four separate API calls: create the tenant (as `provisioning`), apply the category template, import the employees, then activate it. The alternative was a single `POST /tenants` that did everything on the server: atomic, but then the step-by-step progress in the UI would be invented.

We chose real calls so the progress and failures shown are true, and so a half-provisioned tenant is an ordinary lifecycle state (`provisioning`, with the Activate action) rather than a hidden one. Completed steps are recorded in the persisted onboarding draft, so Retry, even after a reload, continues from the failed step and never creates the tenant twice. Applying the template is idempotent (existing codes are skipped) for the same reason.

## Consequences

The Support Operator may write to a tenant's program (template, employee import) **only while it is `provisioning`** (`programWriteAccess` in the domain). Once the tenant is created, the earlier wizard steps are locked, because the tenant already exists with that name and currency.
