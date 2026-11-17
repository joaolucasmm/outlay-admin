# Architecture decision records

Short records of decisions that are hard to reverse, surprising without context, and the result of a real trade-off.

| # | Decision |
|---|---|
| [0001](0001-domain-types-come-from-the-contract.md) | Domain types come from the OpenAPI contract |
| [0002](0002-demo-personas-instead-of-a-role-switcher.md) | Demo personas instead of a role switcher (tenant scoping enforced by the backend) |
| [0003](0003-policy-engine-judges-a-reviewed-expense.md) | The policy engine judges a reviewed Expense, never model output |
| [0004](0004-client-orchestrated-resumable-provisioning.md) | Provisioning is a sequence of real, resumable client calls |
| [0005](0005-receipt-extraction-degrades-instead-of-failing.md) | Receipt extraction degrades to low confidence instead of failing |
| [0006](0006-demo-persona-header-is-a-spring-security-filter.md) | The demo persona header is a Spring Security filter; real auth replaces only that filter |
| [0007](0007-the-java-demo-seed-is-generated-from-the-mock.md) | The Java demo seed is generated from the mock fixtures |
| [0008](0008-the-live-demo-is-one-small-vm-behind-caddy.md) | The live demo is one small VM behind Caddy, with the web app on the same origin |
