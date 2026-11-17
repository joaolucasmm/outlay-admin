package io.github.joaolucasmm.outlay.tenantapi.domain;

import io.github.joaolucasmm.outlay.tenantapi.api.model.AdminRole;
import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantStatus;

/** Who may change a tenant's program, and when. Mirrors packages/domain/src/tenantAccess.ts. */
public final class ProgramAccess {

  /** Why a program write was refused: 403 or 409. */
  public enum Denial {
    FORBIDDEN("forbidden"),
    TENANT_NOT_ACTIVE("tenant_not_active");

    private final String code;

    Denial(String code) {
      this.code = code;
    }

    public String code() {
      return code;
    }
  }

  private ProgramAccess() {}

  /** Onboarding (seeding the program, importing employees) only happens while provisioning. */
  public static boolean canOnboard(TenantStatus status) {
    return status == TenantStatus.PROVISIONING;
  }

  /**
   * A Program Admin while their tenant is active; the Support Operator only while onboarding it.
   * Scope (a Program Admin's own tenant) is checked by the caller.
   */
  public static Result<Boolean, Denial> write(AdminRole role, TenantStatus status) {
    if (role == AdminRole.SUPPORT_OPERATOR) {
      return canOnboard(status) ? Result.ok(true) : Result.err(Denial.FORBIDDEN);
    }
    return status == TenantStatus.ACTIVE ? Result.ok(true) : Result.err(Denial.TENANT_NOT_ACTIVE);
  }
}
