-- Tenants and their audit log. Times are UTC with millisecond precision, like the mock.

CREATE TABLE tenants (
  id          VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  name        VARCHAR(80)  NOT NULL,
  name_key    VARCHAR(80)  NOT NULL,
  country     VARCHAR(2)   NOT NULL,
  currency    VARCHAR(3)   NOT NULL,
  status      VARCHAR(16)  NOT NULL,
  created_at  DATETIME(3)  NOT NULL,
  updated_at  DATETIME(3)  NOT NULL,
  version     BIGINT       NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  CONSTRAINT uq_tenants_name_key UNIQUE (name_key),
  CONSTRAINT ck_tenants_status
    CHECK (status IN ('provisioning', 'active', 'suspended', 'deprovisioned')),
  -- Keyset pagination: ORDER BY name, id.
  INDEX ix_tenants_name_id (name, id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

-- Append-only. No foreign key to tenants: the log outlives what it describes.
CREATE TABLE audit_events (
  id            VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  tenant_id     VARCHAR(64) COLLATE utf8mb4_bin NULL,
  actor_id      VARCHAR(64)  NOT NULL,
  actor_role    VARCHAR(32)  NOT NULL,
  action        VARCHAR(64)  NOT NULL,
  entity        VARCHAR(32)  NOT NULL,
  entity_id     VARCHAR(64)  NOT NULL,
  before_state  JSON         NULL,
  after_state   JSON         NULL,
  at            DATETIME(3)  NOT NULL,
  PRIMARY KEY (id),
  -- Keyset pagination: ORDER BY at DESC, id DESC, usually within one tenant.
  INDEX ix_audit_tenant_at_id (tenant_id, at, id),
  INDEX ix_audit_at_id (at, id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
