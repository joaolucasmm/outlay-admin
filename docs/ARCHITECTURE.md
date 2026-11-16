# Outlay Admin — Architecture

Outlay Admin is an **admin console for corporate expense programs**: support operators provision and manage customer tenants, and each tenant's program admins configure expense categories, spending policies and approval rules, onboard employees, and check receipts against policy with an LLM-powered extraction service.

It is a portfolio project. The goal is to show production-style engineering on a small surface: typed contracts, a real state model, tests at every layer, CI/CD, and an AI feature that is **measured**, not just demoed.

> "Outlay" is a fictional product. No real brand names, logos or visual identity are used.

---

## 1. System overview

```mermaid
flowchart LR
  subgraph Browser
    WEB["apps/web<br/>React + Redux Toolkit + RTK Query"]
    MSW["MSW mock backend<br/>(in-memory DB, persisted to localStorage)"]
  end

  subgraph Shared
    CONTRACT["packages/contracts<br/>openapi.yaml → generated TS types"]
    DOMAIN["packages/domain<br/>lifecycle state machine,<br/>policy engine (pure TS)"]
  end

  AI["services/ai<br/>Python · FastAPI<br/>receipt extraction (LLM)"]
  EVALS["services/ai/evals<br/>dataset + metrics + reports"]
  TENANT["services/tenant-api<br/>Java · Spring Boot · MySQL<br/>(phase 2)"]

  WEB -- "REST (/api/v1)" --> MSW
  WEB -. "REST, later" .-> TENANT
  WEB -- "POST /v1/receipts/extract<br/>(live mode)" --> AI
  WEB --> DOMAIN
  MSW --> DOMAIN
  WEB --> CONTRACT
  MSW --> CONTRACT
  TENANT -. implements .-> CONTRACT
  EVALS --> AI
```

### Key design decisions

| Decision | Why |
|---|---|
| **Contract-first API** (`openapi.yaml` is the source of truth) | The MSW mock and the future Spring Boot service implement the same contract, so the frontend never changes when the real backend arrives. |
| **Domain logic in a pure TS package** | The tenant lifecycle and the policy engine are deterministic, so they are unit-tested in isolation and reused by both the UI and the mock backend. |
| **The LLM extracts, the rules decide** | The model only turns a receipt image into structured fields. Compliance is decided by the deterministic policy engine, which keeps decisions explainable, testable and cheap. |
| **Mock mode by default** | The GitHub Pages demo runs fully in the browser (MSW + fixture extractions). No API key is ever shipped to the client. Live mode talks to the local Python service. |
| **Redux Toolkit for client state, RTK Query for server state** | Session, permissions and the onboarding draft are real client state; everything else is cached server state with tag-based invalidation. |
| **Feature-based folders** | Each feature owns its API endpoints, components, state and tests. |

---

## 2. Repository layout

pnpm workspaces monorepo (Node 22, pnpm 9). Python uses `uv`.

```
outlay-admin/
├── CLAUDE.md
├── README.md                   # pitch, GIF, live demo link, decisions
├── docs/
│   ├── ARCHITECTURE.md
│   ├── ROADMAP.md
│   └── adr/                    # short ADRs: 0001-contract-first.md, ...
├── apps/
│   └── web/                    # Vite + React + TS
├── packages/
│   ├── contracts/              # openapi.yaml + generated types
│   └── domain/                 # pure TS: types, lifecycle, policy engine
├── services/
│   ├── ai/                     # FastAPI receipt extraction + evals
│   └── tenant-api/             # Spring Boot (phase 2, empty at start)
├── .github/workflows/
│   ├── ci.yml                  # lint, typecheck, test, build (TS + Python)
│   └── deploy.yml              # web → GitHub Pages (mock mode)
├── pnpm-workspace.yaml
└── package.json
```

---

## 3. Domain model

All money is stored as **integer minor units** (cents) plus an ISO 4217 currency code. Dates are ISO 8601 strings.

```ts
type TenantStatus = 'provisioning' | 'active' | 'suspended' | 'deprovisioned';

interface Tenant {
  id: string; name: string; country: string;      // ISO 3166-1 alpha-2
  currency: string; status: TenantStatus;
  createdAt: string; updatedAt: string;
}

type EmployeeRole = 'employee' | 'manager' | 'director';

interface ExpenseCategory {
  id: string; tenantId: string; code: string;     // e.g. "MEALS"
  name: string; glAccount?: string; active: boolean;
}

interface PolicyRule {
  id: string; tenantId: string; categoryId: string;
  role: EmployeeRole;
  limitMinor: number;                 // max per expense
  receiptRequiredAboveMinor: number;  // receipt mandatory above this
  approvalLevels: 0 | 1 | 2;          // 0 = auto-approve
}

interface Employee {
  id: string; tenantId: string; name: string; email: string;
  role: EmployeeRole; costCenter: string;
}

interface AuditEvent {
  id: string; tenantId: string | null;
  actor: { id: string; role: AdminRole };
  action: string;                     // "tenant.suspended", "policy.updated", ...
  entity: string; entityId: string;
  before?: unknown; after?: unknown; at: string;
}

interface ReceiptExtraction {
  merchant: string | null; date: string | null;
  totalMinor: number | null; currency: string | null;
  suggestedCategoryCode: string | null;
  confidence: 'high' | 'medium' | 'low';
  model: string; promptVersion: string; latencyMs: number;
}

interface PolicyCheckResult {
  status: 'compliant' | 'needs_approval' | 'violation';
  findings: { code: string; message: string; severity: 'info' | 'warn' | 'error' }[];
  requiredApprovalLevels: number;
}
```

### Tenant lifecycle (state machine in `packages/domain`)

```mermaid
stateDiagram-v2
  [*] --> provisioning: create (onboarding wizard)
  provisioning --> active: complete onboarding
  active --> suspended: suspend (reason required)
  suspended --> active: reactivate
  suspended --> deprovisioned: deprovision (type tenant name to confirm)
  deprovisioned --> [*]
```

- `transition(tenant, action, actor)` returns `Result<Tenant, TransitionError>` and never throws.
- Only the `support_operator` role may run lifecycle actions.
- Every successful transition emits an `AuditEvent`.
- A tenant that is not `active` is read-only for program admins.

### Policy engine (`checkExpense`)

Input: `{ expense, categoryCode, employeeRole, tenantCurrency, categories, rules }`, where `expense` is a reviewed **Expense** (`amountMinor`, `currency`, `receipt: readable | unreadable | missing`), never the raw extraction ([ADR 0003](adr/0003-policy-engine-judges-a-reviewed-expense.md)). Output: `PolicyCheckResult`. Money in messages is formatted by an injected `formatMoney`.

Checks, in order (all applicable checks run; the worst severity decides the status):
1. The expense currency differs from the tenant currency → `violation` (amount checks are skipped).
2. The category is unknown (stop) or inactive → `violation`.
3. There is no rule for the category × Employee Role → `violation` (`no_policy`, stop).
4. The amount is above the role limit → `violation`.
5. The amount is above the receipt threshold and the receipt is missing or unreadable → `violation`.
6. `approvalLevels > 0` → `needs_approval`.
7. Otherwise → `compliant`.

Each rule produces an explainable finding. The engine has 100% branch coverage.

---

## 4. Roles & permissions

| Role | Scope | Can |
|---|---|---|
| `support_operator` (vendor side) | all tenants | list, create and onboard tenants, run lifecycle actions, view all audit logs |
| `program_admin` (customer side) | one tenant | manage categories, policies and employees, check receipts, view their own audit log |

There is no real login in the demo: a "Signed in as" **persona** picker in the header (the Support Operator, or the Program Admin of one tenant) sets the Redux `session` slice, and the persona id travels to the backend in an `X-Demo-Persona` header (see [ADR 0002](adr/0002-demo-personas-instead-of-a-role-switcher.md)). The permission table lives in `packages/domain` (`can(role, permission)`): route guards use it in the UI, and the mock backend enforces the same table (403) and scopes data to the persona's tenant.

---

## 5. Frontend (`apps/web`)

**Stack:** Vite · React 19 · TypeScript (strict) · Redux Toolkit + RTK Query · React Router · react-hook-form + zod · Tailwind CSS · Radix primitives (shadcn/ui style) · TanStack Table · Papaparse (CSV) · MSW · Vitest + Testing Library · Playwright.

```
apps/web/src/
├── app/
│   ├── store.ts              # configureStore, typed hooks
│   ├── api.ts                # RTK Query base api (createApi, tagTypes)
│   ├── router.tsx            # routes + guards
│   └── providers.tsx
├── features/
│   ├── session/              # slice: persona, currentTenantId; useCan(), guards
│   ├── tenants/              # list, detail, lifecycle actions
│   ├── onboarding/           # wizard + draft slice (persisted)
│   ├── categories/
│   ├── policies/             # rules grid by category × role
│   ├── employees/
│   ├── receipts/             # upload → extract → policy check
│   └── audit/
│       └── (each: api.ts · components/ · pages/ · *.test.tsx)
├── shared/
│   ├── ui/                   # Button, Dialog, DataTable, StatusBadge, EmptyState...
│   ├── lib/                  # money formatting (Intl), dates, ids
│   └── hooks/
└── mocks/
    ├── browser.ts / node.ts  # MSW setup (browser for the demo, node for tests)
    ├── db.ts                 # in-memory store, seeded, localStorage persistence
    ├── handlers/             # one file per resource, typed with contract types
    └── fixtures/             # seed tenants + receipt extraction fixtures
```

### Routes

| Path | Role | Screen |
|---|---|---|
| `/tenants` | operator | tenant table: status badges, search, status filter, lifecycle actions |
| `/tenants/new` | operator | onboarding wizard |
| `/t/:tenantId/categories` | admin | CRUD categories, toggle active |
| `/t/:tenantId/policies` | admin | grid of category × role with limits, receipt threshold and approval levels; inline edit with dirty-state warning |
| `/t/:tenantId/employees` | admin | table + CSV import |
| `/t/:tenantId/receipts` | admin | upload receipt → extracted fields (editable) → policy check result |
| `/t/:tenantId/audit` | both | audit log filtered by actor, action, entity and date range (filters live in the URL); a side drawer shows the before/after diff with readable labels and money in the tenant currency |

### Onboarding wizard

Steps, each at its own URL (`/tenants/new/:step`): **Company** (name, country) → **Locale** (currency, Standard or Empty category template) → **Employees** (optional CSV upload with row-level validation errors, a downloadable error report and a valid-rows preview) → **Review** → **Provision**. A deep link to a step whose earlier steps are incomplete redirects to the first incomplete one.

Provisioning makes four real API calls, each shown with its status: create the tenant (`provisioning`) → apply the template → import employees → activate ([ADR 0004](adr/0004-client-orchestrated-resumable-provisioning.md)). Completed calls are recorded in the draft, so Retry resumes where it failed and never creates the tenant twice. The Support Operator may write to a tenant's program only while it is `provisioning`.

The draft lives in the `onboarding` slice and is persisted to localStorage, so a refresh doesn't lose work. CSV parsing (Papaparse, auto-detected `,`/`;`, BOM-safe) happens in the browser; row rules come from the domain (`validateEmployeeImport`) and the server re-checks them.

### State rules

- Server data only lives in RTK Query, never copied into slices.
- Mutations invalidate tags (`Tenant`, `Category`, `Policy`, `Employee`, `Audit`).
- Optimistic update only for the category active toggle, with rollback on error.
- Every list has loading, empty and error states.

### Modes

`VITE_API_MODE=mock` (default; enables MSW in the browser) and `VITE_AI_MODE=mock|live`.
- `mock`: MSW answers `/v1/receipts/extract` on the same origin with fixtures for the sample receipts in `public/sample-receipts/` (drawn by `services/ai/evals/generate_receipts.py`), with simulated latency. Any other file gets an honest low-confidence answer.
- `live`: `POST {VITE_AI_URL}/v1/receipts/extract`. Same calling code; MSW lets the request through.

The `/t/:tenantId/receipts` screen: upload or pick a sample, then review editable fields (marked where the AI filled them, with the confidence). The reviewer picks the employee role and confirms the receipt is legible, and `checkExpense` runs in the browser on the reviewed Expense, updating as the fields change.

---

## 6. Contracts (`packages/contracts`)

- `openapi.yaml` (OpenAPI 3.1) under `/api/v1`: tenants (+ `POST /tenants/{id}/transitions`), demo personas and reset (mock only), categories, policies, onboarding (`POST /tenants`, `POST /tenants/{id}/program:apply-template`), employees (+ `POST /tenants/{id}/employees:import`), audit-events (filters: `actorId`, `action`, `entity`, `from`, `to`). Plus the AI service: `POST /v1/receipts/extract`.
- Errors use RFC 9457 Problem Details (`type`, `title`, `status`, `detail`, `errors[]`).
- List endpoints use cursor pagination (`?cursor=&limit=`) and return `{ items, nextCursor }`.
- `pnpm --filter contracts generate` runs `openapi-typescript`, and the output is committed. CI fails if the generated file is stale.

---

## 7. AI service (`services/ai`)

**Stack:** Python 3.12 · FastAPI · Pydantic v2 · Anthropic Python SDK · uv · ruff · pytest.

```
services/ai/
├── app/
│   ├── main.py               # FastAPI app, CORS for local web
│   ├── api/receipts.py       # POST /v1/receipts/extract (multipart image)
│   ├── extraction/
│   │   ├── extractor.py      # calls the LLM, validates with Pydantic
│   │   ├── prompts/v1.md     # baseline prompt
│   │   ├── prompts/v2.md     # improved prompt (date/currency normalization rules)
│   │   └── schema.py         # ReceiptExtraction model = tool/JSON schema
│   └── settings.py           # MODEL_ID, PROMPT_VERSION, ANTHROPIC_API_KEY (env)
├── evals/
│   ├── generate_receipts.py  # synthetic receipts (Pillow) from random ground truth
│   ├── dataset/              # images + labels.jsonl
│   ├── run.py                # runs prompt versions, computes metrics
│   └── reports/              # committed markdown reports
└── tests/                    # unit tests with a fake LLM client (no network)
```

- **Structured output:** `client.beta.messages.parse` with the `ModelReceipt` Pydantic model as `output_format`, so the JSON matches the schema by construction. Pydantic and `normalize.py` then validate meaning: an ISO date, an ISO 4217 currency, a total converted to minor units by the service (the model returns it as printed text), and a category from the hinted list. Invalid output, a refusal or `max_tokens` gets one retry, then the service returns `confidence: "low"` with null fields and `notes`. It never returns a 500 for bad model output; provider outages are 502/503 ([ADR 0005](adr/0005-receipt-extraction-degrades-instead-of-failing.md)).
- **The model is configurable** through `MODEL_ID` (default `claude-opus-5-5`) and `EFFORT` (default `low`). M6 compares models on the eval set. Requests opt into server-side refusal fallbacks, and the response's `model` field reports which model answered.
- **Input:** multipart `image` (JPEG/PNG/WebP, checked by magic bytes, up to 5 MB, downscaled to 1568 px on the long side) plus `categories`, the tenant's active categories, so the model can suggest one of them.
- **No secrets in the repo.** `.env.example` documents the variables.
- **The LLM client sits behind an interface,** so tests use a fake client and CI never calls the API.

### Evals

The dataset has about 20 synthetic receipts plus a few real, anonymized photos. They vary on purpose: PT/EN, BRL/USD/EUR, `dd/mm/yyyy` vs `mm/dd/yyyy`, tips, taxes, discounts, low contrast.

Metrics per prompt version:
- field accuracy (merchant fuzzy ≥ 0.9, date exact after normalization, total exact to the cent, currency exact, category exact);
- JSON-valid rate;
- p50/p95 latency;
- estimated cost per receipt.

`uv run python -m evals.run --prompts v1 v2` writes `evals/reports/<date>-v1-vs-v2.md` with a comparison table and the worst failures. The README links the latest report.

---

## 8. Tenant API (`services/tenant-api`) — phase 2

Spring Boot 3 · Java 21 · Spring Web · Spring Data JPA · Flyway · MySQL 8 · springdoc-openapi · JUnit 5 + Testcontainers · Docker Compose.

It implements the tenant, category, policy, audit and employee parts of `openapi.yaml`, with the lifecycle mirrored from `packages/domain` (same transition table and the same test cases ported to JUnit). A contract test validates responses against `openapi.yaml`. The web app switches to it with `VITE_API_MODE=live`.

Optional after that: Kubernetes manifests (kind) with health probes and Actuator metrics.

---

## 9. Quality bar

- TypeScript `strict`, no `any`, ESLint + Prettier. Python: ruff (lint + format), and mypy on `app/`.
- **Tests:**
  - domain: unit tests, 100% branch coverage;
  - web: component and integration tests with MSW (node);
  - one Playwright smoke test of the main flow (onboard tenant → set policy → check receipt);
  - Python: pytest with a fake LLM.
- **Accessibility:** keyboard-navigable dialogs and tables, labelled inputs, visible focus.
- **CI** (`ci.yml`, on PRs and main):
  - pnpm install;
  - contract types up to date;
  - lint, typecheck and test for all TS packages;
  - web build;
  - ruff + pytest for `services/ai`;
  - later, `./mvnw verify` for `tenant-api`.
- **Deploy** (`deploy.yml`, on main): build web with `VITE_API_MODE=mock` and `VITE_AI_MODE=mock`, base `/outlay-admin/`, copy `index.html` to `404.html` for SPA routing, and register the MSW worker with the base path. Publishes to GitHub Pages.
- **Docs:** README in English with a one-paragraph pitch, demo link + GIF, an architecture diagram, how to run it, links to the decisions/ADRs and to the eval report, and a "what I'd do next" section.
