# Outlay Admin

An admin console for corporate expense programs: support operators onboard and run customer tenants, and each tenant's program admins set expense categories and spending policies, import employees, and check receipts against policy with an LLM that **extracts** fields while a deterministic policy engine **decides**.

**Live demo (mock mode, runs entirely in the browser):** https://joaolucasmm.github.io/outlay-admin/

> This README is a stub; the full write-up (pitch, GIF, decisions, next steps) lands in M7.

## Receipt extraction evals

The extraction service is measured, not just demoed: 30 seeded synthetic receipts (10 dev, 20 test) covering ambiguous dates, `$` in Mexico, thousands separators, tips and discounts, cash/change lines and unreadable receipts, graded per field with no LLM judge.

- **Latest report:** [`services/ai/evals/reports/2026-11-15-v1-vs-v2.md`](services/ai/evals/reports/2026-11-15-v1-vs-v2.md)
- How the eval works and how to rerun it: [`services/ai/evals/README.md`](services/ai/evals/README.md)

Headline (test split, 20 cases x 3 reps): field accuracy **94.7%** (`claude-opus-5-5`, prompt v1), **97.7%** (Opus, prompt v2), **99.0%** (`claude-haiku-5-5`, prompt v2, ~36x cheaper per receipt). Neither difference clears the 95% noise band on 20 cases, and the report says so.

## Running it

```bash
pnpm i && pnpm dev                     # web app in mock mode
pnpm lint && pnpm typecheck && pnpm test
cd services/ai && uv sync && uv run pytest
```

Design: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) · decisions: [`docs/adr/`](docs/adr/) · plan: [`docs/ROADMAP.md`](docs/ROADMAP.md) · glossary: [`CONTEXT.md`](CONTEXT.md)
