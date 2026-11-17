package io.github.joaolucasmm.outlay.tenantapi.service;

import io.github.joaolucasmm.outlay.tenantapi.domain.Permission;
import io.github.joaolucasmm.outlay.tenantapi.domain.ProgramAccess;
import io.github.joaolucasmm.outlay.tenantapi.domain.Result;
import io.github.joaolucasmm.outlay.tenantapi.persistence.TenantEntity;
import io.github.joaolucasmm.outlay.tenantapi.persistence.TenantRepository;
import io.github.joaolucasmm.outlay.tenantapi.security.Caller;
import io.github.joaolucasmm.outlay.tenantapi.web.ApiProblem;
import java.util.Optional;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Access to a tenant's program (categories, policy rules, employees), in the mock's order: 404 for
 * an unknown tenant or another tenant's (no leaking), then 403 or 409. Mirrors programAccess in
 * apps/web/src/mocks/http.ts.
 */
@Component
public class ProgramGuard {

  private final TenantRepository tenants;

  public ProgramGuard(TenantRepository tenants) {
    this.tenants = tenants;
  }

  /** Reads: a Program Admin of this tenant. */
  @Transactional(propagation = Propagation.MANDATORY, readOnly = true)
  public TenantEntity read(Caller caller, String tenantId) {
    TenantEntity tenant = visible(caller, tenants.findById(tenantId));
    if (!Permission.can(caller.role(), Permission.TENANT_CONFIGURE)) {
      throw ApiProblem.forbidden("Only a Program Admin manages a tenant program.");
    }
    return tenant;
  }

  /**
   * Writes: {@link ProgramAccess#write}. Locks the tenant row for the rest of the transaction, so
   * the status it checked cannot change before the write commits.
   */
  @Transactional(propagation = Propagation.MANDATORY)
  public TenantEntity write(Caller caller, String tenantId) {
    TenantEntity tenant = visible(caller, tenants.findForUpdate(tenantId));
    return switch (ProgramAccess.write(caller.role(), tenant.getStatus())) {
      case Result.Ok<Boolean, ProgramAccess.Denial> ok -> tenant;
      case Result.Err<Boolean, ProgramAccess.Denial>(var denial) ->
          throw switch (denial) {
            case FORBIDDEN ->
                ApiProblem.forbidden(
                    "Only a Program Admin manages a tenant program (the Support Operator only"
                        + " during onboarding).");
            case TENANT_NOT_ACTIVE ->
                new ApiProblem(
                    409,
                    "Tenant not active",
                    tenant.getName()
                        + " is "
                        + tenant.getStatus().getValue()
                        + ": its program is read-only.");
          };
    };
  }

  private static TenantEntity visible(Caller caller, Optional<TenantEntity> tenant) {
    return tenant
        .filter(t -> caller.canSee(t.getId()))
        .orElseThrow(() -> ApiProblem.notFound("Tenant not found."));
  }
}
