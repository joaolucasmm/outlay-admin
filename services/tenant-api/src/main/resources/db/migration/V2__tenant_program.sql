-- A tenant's expense program: categories, the category x role policy grid, and employees.

CREATE TABLE categories (
  id          VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  tenant_id   VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  code        VARCHAR(20) COLLATE utf8mb4_bin NOT NULL,
  name        VARCHAR(60)  NOT NULL,
  gl_account  VARCHAR(20)  NULL,
  active      BOOLEAN      NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_categories_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id),
  -- The code is stable and unique per tenant (receipt extraction refers to it).
  CONSTRAINT uq_categories_tenant_code UNIQUE (tenant_id, code)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE policy_rules (
  id                            VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  tenant_id                     VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  category_id                   VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  role                          VARCHAR(16)  NOT NULL,
  -- Money in integer minor units of the tenant currency.
  limit_minor                   BIGINT       NOT NULL,
  receipt_required_above_minor  BIGINT       NOT NULL,
  approval_levels               INT          NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_policy_rules_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id),
  CONSTRAINT fk_policy_rules_category FOREIGN KEY (category_id) REFERENCES categories (id),
  CONSTRAINT uq_policy_rules_cell UNIQUE (tenant_id, category_id, role),
  CONSTRAINT ck_policy_rules_role CHECK (role IN ('employee', 'manager', 'director')),
  CONSTRAINT ck_policy_rules_amounts
    CHECK (limit_minor >= 0 AND receipt_required_above_minor BETWEEN 0 AND limit_minor),
  CONSTRAINT ck_policy_rules_approvals CHECK (approval_levels BETWEEN 0 AND 2)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;

CREATE TABLE employees (
  id           VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  tenant_id    VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  name         VARCHAR(100) NOT NULL,
  -- Stored lower-cased; unique per tenant.
  email        VARCHAR(254) COLLATE utf8mb4_bin NOT NULL,
  role         VARCHAR(16)  NOT NULL,
  cost_center  VARCHAR(40)  NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_employees_tenant FOREIGN KEY (tenant_id) REFERENCES tenants (id),
  CONSTRAINT uq_employees_tenant_email UNIQUE (tenant_id, email),
  CONSTRAINT ck_employees_role CHECK (role IN ('employee', 'manager', 'director')),
  -- Keyset pagination: ORDER BY name, id within a tenant.
  INDEX ix_employees_tenant_name_id (tenant_id, name, id)
) DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
