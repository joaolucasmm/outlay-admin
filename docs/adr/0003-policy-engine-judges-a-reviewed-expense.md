# The policy engine judges a reviewed Expense, not model output

`checkExpense` takes a plain **Expense** (`amountMinor`, `currency`, `receipt: readable | unreadable | missing`) plus the category code and Employee Role. It never takes the LLM's `ReceiptExtraction`. The receipt flow maps the extraction to an Expense only after the user has reviewed and corrected it. "The LLM extracts, the policy engine decides" is therefore enforced by the types: no confidence score or model field can reach a compliance decision. A category with no rule for the role is a `violation` (`no_policy`), not a default. The engine runs every applicable check and reports the worst status, so each decision comes with a full explanation.

Money in findings is formatted by a `formatMoney` function the caller injects, so the domain stays pure and formatting happens at the edge (`Intl.NumberFormat`).
