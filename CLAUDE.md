# CLAUDE.md

Outlay Admin: an admin console for corporate expense programs (tenant lifecycle, expense policies, employee onboarding, LLM receipt checks). It is a portfolio project aimed at an early-career full-stack role on an expense-management admin team (React/TS, Java/Spring, Python AI services).

**Read first:** `docs/ARCHITECTURE.md` (source of truth for design) and `docs/ROADMAP.md` (what to build next; tick boxes as items land).

## Commands
- `pnpm i` · `pnpm dev` (web, mock mode) · `pnpm test` · `pnpm lint` · `pnpm typecheck` · `pnpm build`
- `pnpm --filter contracts generate`: regenerate API types after editing `openapi.yaml`
- `cd services/ai && uv sync && uv run pytest && uv run ruff check .`
- `cd services/ai && uv run fastapi dev app/main.py`: live AI service (needs `ANTHROPIC_API_KEY`)

## Rules
- **Contract first.** Change `packages/contracts/openapi.yaml` before touching handlers or API code, then regenerate the types. Never hand-write API types in the web app.
- **Domain logic stays pure** in `packages/domain`: no React, no fetch, no Date.now() without injection. Functions return `Result`, never throw.
- **The LLM extracts, the policy engine decides.** Never let model output decide compliance.
- **Money:** integer minor units + ISO currency. Format only at the edge with `Intl.NumberFormat`.
- **State:** server data lives only in RTK Query. Slices are for session, permissions and the onboarding draft only.
- Feature-based folders under `apps/web/src/features/<feature>/`. Shared UI goes in `shared/ui`.
- Every list/page handles loading, empty and error states. Every interactive element is keyboard-accessible.
- TypeScript strict, no `any`, no `// @ts-ignore`. Python: typed, ruff-clean.
- **Tests come with the code:**
  - domain → unit tests (100% branches);
  - features → Testing Library + MSW (node);
  - Python → pytest with the fake LLM client.
  - No test calls a real LLM.
- No secrets in the repo; document env vars in `.env.example`.
- No real company brand names, logos or visual identity in UI, copy or fixtures.
- **Everything in English:** code, comments, UI copy, commits, docs.

## Workflow
- Work one roadmap milestone at a time. Propose a short plan before large changes.
- Small commits, Conventional Commits (`feat(policies): ...`, `test(domain): ...`).
- Before saying something is done: `pnpm lint && pnpm typecheck && pnpm test` (and the Python checks if `services/ai` changed) must pass.
- Record non-obvious decisions as a short ADR in `docs/adr/NNNN-title.md`.
