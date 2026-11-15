# Demo personas instead of a role switcher

The demo has no real login, so it signs in as a **Persona**: the Support Operator, or the Program Admin of one Tenant. The persona id travels in an `X-Demo-Persona` header, and the backend (the MSW mock today, Spring Boot later) resolves it to an actor and applies the scoping. A Program Admin's `GET /tenants` only returns their own Tenant.

## Considered options

- **Separate role and tenant switchers (M0).** Rejected: to let a Program Admin pick a tenant, the API would have to list every customer's tenant to them, which is a data leak and the wrong model.
- **Hardcoded demo identities in the client.** Rejected: tenants created in the onboarding wizard (M3) would not appear.

## Consequences

`GET /demo/personas` and `POST /demo/reset` are in the contract under the `demo` tag and are only implemented by the mock. Switching persona resets the RTK Query cache, because each persona sees different data. In M8 the header is replaced by real authentication, and the client code stays the same.
