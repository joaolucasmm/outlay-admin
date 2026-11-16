# Receipt extraction evals

Measures how well the extraction service reads receipts, per field, for a model and prompt version. The model only extracts; the policy engine decides, so field accuracy is what matters.

| File | What it is |
|---|---|
| `dataset/labels.jsonl` | 30 cases (10 `dev`, 20 `test`): image, ground truth, difficulty tag |
| `dataset/INDEX.md` | Every case with its image and label, for review |
| `synthetic.py`, `render.py`, `generate_receipts.py` | Seeded generator of the synthetic receipts (and the 4 web demo samples) |
| `grading.py` | Programmatic per-field grading (no LLM judge) |
| `run.py` | Runs one variant through the real `Extractor`; resumable |
| `report.py` | Compares variants and writes `reports/*.md` |
| `runs/<variant>/` | `results.jsonl` + `errors.jsonl` (committed); `traces/` (ignored) |

## Running it

Paid runs call the Anthropic API: put `ANTHROPIC_API_KEY` in `services/ai/.env` (gitignored). Tests never call the API.

```bash
uv run python -m evals.generate_receipts --dataset          # regenerate (deterministic)
uv run python -m evals.run --approve-harness ...            # once, after reviewing harness changes
uv run python -m evals.run --variant opus55-v1 --model claude-opus-5-5 --prompt v1 --split test --reps 3
uv run python -m evals.report --baseline opus55-v1 --variants opus55-v2 --out reports/<date>-v1-vs-v2.md
```

`--limit 4` runs a pilot. Reruns resume: finished (case, rep) pairs are skipped.

## Rules this harness keeps

- **Ground truth comes from the generator**, never from a model. Real photos will be labelled by a human.
- **Dev vs test.** Prompt changes are written by looking at `dev` failures only; claims are made on `test`.
- **Errors are not zeros.** Provider errors, timeouts and answers served by a different model than requested go to `errors.jsonl`, with their usage, and are excluded from scores. Truncated answers are counted and excluded from means.
- **Measured, not estimated.** Tokens come from the API's `usage`; cost is derived from each row's served model (`prices.py`). Latency is the final model call only.
- **Harness gate.** `run.py` refuses to run if the runner, grader or extraction code changed since the last `--approve-harness`. Approving is the human's call.
