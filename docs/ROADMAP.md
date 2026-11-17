# Roadmap

Each milestone ends green in CI and is demoable. Tick items as they land. Estimates assume pairing with Claude Code.

## M0 — Foundation (~1–1.5h)
- [x] pnpm workspace: `apps/web`, `packages/domain`, `packages/contracts`, `services/ai` (skeleton)
- [x] Vite + React + TS strict + Tailwind + ESLint/Prettier + Vitest
- [x] Redux store, RTK Query base api, router with layout (sidebar, header with role/tenant switcher)
- [x] MSW wired for browser (dev and demo) and node (tests)
- [x] `ci.yml` + `deploy.yml`; a hello-world page live on GitHub Pages (https://joaolucasmm.github.io/outlay-admin/)

## M1 — Contracts, domain, tenants (~2–3h)
- [x] `openapi.yaml` for tenants + transitions + audit; type generation; CI staleness check
- [x] `packages/domain`: lifecycle state machine + tests (100% branches)
- [x] Mock DB with seed data (5–8 tenants in mixed states) and localStorage persistence
- [x] `/tenants`: table, search, status filter, status badges, lifecycle action dialogs (deprovision asks you to type the tenant name)
- [x] Session slice + `can()` + route guards; the mock returns 403 for a wrong role
- [x] Audit events emitted on transitions

## M2 — Categories & policies (~3–4h)
- [x] Contract + handlers for categories and policies
- [x] `/categories`: CRUD, optimistic active toggle with rollback
- [x] `/policies`: category × role grid, inline edit, zod validation, unsaved-changes guard
- [x] `packages/domain`: `checkExpense` policy engine + tests
- [x] Money formatting through `Intl.NumberFormat` using the tenant currency

## M3 — Onboarding wizard & employees (~3–4h)
- [x] Wizard with 5 steps; draft in a persisted slice; per-step validation
- [x] CSV import with Papaparse: row-level errors, downloadable error CSV, valid rows preview
- [x] Provision flow: create → seed → activate, showing step progress
- [x] `/employees` table

## M4 — Audit log (~1h)
- [x] `/audit`: filters (actor, action, entity, date), before/after JSON diff panel

## M5 — AI receipt extraction (~3–4h)
- [x] FastAPI `POST /v1/receipts/extract`, Pydantic schema, LLM client interface + Anthropic implementation
- [x] Structured output, one retry, graceful low-confidence fallback
- [x] pytest with a fake client; ruff; added to CI
- [x] `/receipts`: upload → editable extracted fields → policy check result with findings
- [x] Mock mode with fixtures for the Pages demo; live mode via `VITE_AI_URL`

## M6 — Evals (~2–3h)
- [ ] Synthetic receipt generator + `labels.jsonl` (~20 items) + a few real anonymized photos — *synthetic part done (30 cases); real photos pending*
- [x] `evals/run.py`: metrics per prompt version, markdown report
- [ ] Prompt v2 that measurably beats v1; report committed and linked in the README — *report committed and linked; v2 is +3.0 pts on test, inside the noise, so not "measurably" yet*

## M7 — Polish & ship (~2h)
- [x] Playwright smoke: onboard tenant → edit policy → check receipt
- [x] Empty/loading/error states everywhere; keyboard a11y pass
- [x] README: pitch, GIF, live link, diagram, run instructions, decisions, "next steps"
- [x] 3–4 short ADRs in `docs/adr/`
- [x] Pin the repo on GitHub; add it as the first project on the portfolio

**Total for submission: ~18–24h**

---

## Phase 2 (after submitting)

## M8 — Spring Boot tenant API (~12–18h)
- [x] Spring Boot 3 / Java 21, Flyway migrations, MySQL via Docker Compose
- [x] Tenants + transitions + audit, mirroring the domain tests in JUnit
- [x] Testcontainers integration tests; contract test against `openapi.yaml`
- [x] `./mvnw verify` in CI; web `VITE_API_MODE=live` runs against it

## M8b — Tenant program in the Java API (~8–12h)
- [x] Categories (list, create, update, active toggle) and the category templates
- [x] Policy rules (get, replace) with the same validation as `packages/domain`
- [x] Employees (list with filters, all-or-nothing CSV import)
- [x] Program write access (`programWriteAccess`) as a shared fixture, like the lifecycle; remove the live-mode notices
- [x] Demo seed generated from the mock fixtures; the Playwright main flow runs against the Java API in CI

## M9 — Ops (optional, ~6–8h)
- [x] Live demo on one VM: `compose.prod.yaml` with Caddy (HTTPS, same-origin web app), hourly reset ([DEPLOY.md](DEPLOY.md))
- [ ] Kubernetes manifests (kind), readiness/liveness probes, Actuator metrics
