# Receipt extraction degrades instead of failing

`POST /v1/receipts/extract` treats bad model output as a normal result, not an error. The model answers through structured output (`messages.parse` with the `ModelReceipt` Pydantic model). An answer that fails validation, is refused or hits `max_tokens` gets **one** retry. If the retry fails too, the response is `200` with `confidence: "low"`, null fields and a `notes` explanation. Fields that parse but don't validate (an impossible date, a total with too many decimals, a category the tenant doesn't have) become null individually, and `high` confidence drops to `medium`. Only provider outages (rate limits, credentials, connectivity) are errors: 502/503 Problem Details.

The reviewer always ends up at the same screen, editable fields that may be blank, so a flaky model costs a few keystrokes, never a dead end. The model returns the total as printed text and the service converts it to minor units using the currency's ISO 4217 digits, so the model never does arithmetic. Legibility is confirmed by the reviewer, pre-filled from confidence; the policy engine only sees the reviewed Expense (ADR 0003).

## Considered options

- **Return 422/500 on invalid output.** Rejected: the UI would need a second "manual" path, and a provider-side quirk would look like a client mistake.
- **Retry until valid.** Rejected: unbounded latency and cost on a receipt that is genuinely unreadable.

## Consequences

The default model is `claude-opus-5-5` at `effort: low`, configurable with `MODEL_ID` and `EFFORT`; M6 measures whether a cheaper model (e.g. `claude-haiku-5-5`) holds the same accuracy. Requests opt into server-side refusal fallbacks (`fallbacks: "default"`), so a safety-classifier refusal is retried on another model inside the same call; the `model` field reports which model actually answered.
