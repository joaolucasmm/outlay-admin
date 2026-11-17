# The Java demo seed is generated from the mock

The web mock and the Java tenant API must serve the same demo data: the same tenants, categories, policy grid and employees, with the same ids, so links, tests and the end-to-end flow work against either backend. The mock builds that data in TypeScript (`programFromTemplate` for each tenant, generated employees). `scripts/export-demo-seed.ts` (`pnpm seed:export`) imports those fixtures and writes `services/tenant-api/src/main/resources/db/demo/R__demo_seed.sql`. CI runs it and fails if the committed SQL differs.

## Considered options

- **Hand-written SQL (M8 did this for 8 tenants and 8 audit events).** Rejected for M8b: about 40 categories, 110 rules and 50 employees, computed with per-currency scaling. Copying them by hand is where the two backends would quietly drift apart.
- **The Java service seeds itself at startup from the same rules.** Rejected: it would duplicate the employee generator in Java just for demo data, and a SQL seed is what Flyway and `POST /demo/reset` already run.
- **A shared JSON seed that both backends load.** Rejected: the mock's seed is typed TypeScript that the web tests import directly; moving it to JSON loses that and gains nothing over generating SQL.

## Consequences

- The TypeScript fixtures are the single source of the demo data. To change it, edit them and run `pnpm seed:export`.
- The SQL is a generated file in the repository, so a reviewer can read exactly what the Java demo loads.
- The standard template, which the running Java service also needs (`POST …/program:apply-template`), is not generated: it is shared as data in `packages/domain/fixtures/category-template.json`, read by both domains.
