# The demo persona header is a Spring Security filter

The Spring Boot tenant API (M8) keeps the demo's `X-Demo-Persona` header ([ADR 0002](0002-demo-personas-instead-of-a-role-switcher.md)), but only as authentication. `DemoPersonaFilter`, registered only in the `demo` profile, resolves the header to a `Caller` (actor id, role, tenant) and grants the role's permissions (`tenants:create`, `audit:read`, …) as Spring Security authorities. Everything after it is ordinary Spring Security: `@PreAuthorize("hasAuthority('tenants:create')")` on controllers, `CurrentCaller` in services, a 401/403 Problem Details entry point. Real authentication replaces one class: a JWT or session filter that builds the same `Caller` and authorities.

## Considered options

- **Read the header in each controller, as the MSW mock does.** Rejected: authentication would leak into every endpoint, and swapping it would touch all of them.
- **Real login now (OAuth2 resource server with a local issuer).** Rejected for M8: the demo would need an identity provider and test users, and the web app a login flow, for no gain in what the project shows. The seam above is the part worth showing.
- **Permission checks only in the domain.** Kept where the domain owns the rule and its message: a lifecycle action runs `Lifecycle.transition`, which refuses a Program Admin with the same text as the TypeScript domain. `@PreAuthorize` guards endpoints whose permission is not a domain rule (creating a tenant, reading the audit log).

## Consequences

- Without the `demo` profile no filter authenticates anyone, so every protected endpoint answers 401. The demo is opt-in, never a default that could reach production.
- `/demo/personas` and `/demo/reset` exist only in the `demo` profile, and the seed data loads only there (Flyway location `db/demo`).
- Tenant scoping (a Program Admin only sees their tenant) stays in the services, keyed on `Caller.tenantId`, so it does not depend on how the caller was authenticated.
- CSRF protection is off: the API is stateless and uses no cookies. Real cookie-based sessions would turn it back on.
