# Domain types come from the contract

`packages/domain` imports `Tenant`, `AuditEvent` and the other entity types from `packages/contracts` (type-only) instead of declaring its own. `openapi.yaml` is the single source of truth, so the UI, the MSW mock, the domain and later the Spring Boot service can't drift apart. The cost is that the domain is shaped by the wire format. We accept that because the entities are flat and the domain only adds behaviour (the lifecycle table, permissions and the policy engine), not a different model.
