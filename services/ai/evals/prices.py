"""First-party Anthropic prices, USD per million tokens (input, output).

Cost is derived from each row's *served* model and recorded `usage`, never assumed.
Cache writes cost 1.25x input and cache reads 0.1x input.
"""

PRICES: dict[str, tuple[float, float]] = {
    "claude-opus-5-5": (4.00, 20.00),
    "claude-sonnet-5-5": (2.00, 10.00),
    "claude-haiku-5-5": (0.10, 0.50),  # prompts up to 100K tokens
}


def cost_usd(model: str | None, usage: dict[str, int]) -> float | None:
    """None when the model has no known price, so a missing rate is visible, not $0."""
    if model is None or model not in PRICES:
        return None
    price_in, price_out = PRICES[model]
    tokens_in = (
        usage.get("input_tokens", 0)
        + usage.get("cache_read_input_tokens", 0) * 0.1
        + usage.get("cache_creation_input_tokens", 0) * 1.25
    )
    return (tokens_in * price_in + usage.get("output_tokens", 0) * price_out) / 1_000_000
