package io.github.joaolucasmm.outlay.tenantapi.security;

import io.github.joaolucasmm.outlay.tenantapi.api.model.Actor;
import io.github.joaolucasmm.outlay.tenantapi.api.model.AdminRole;
import org.springframework.lang.Nullable;

/**
 * Who is calling: the authenticated principal. Today it comes from a demo persona; with real
 * authentication only the filter that builds it changes (ADR 0006).
 *
 * @param tenantId the Program Admin's tenant; null for the Support Operator
 */
public record Caller(String actorId, AdminRole role, @Nullable String tenantId) {

  public boolean isOperator() {
    return role == AdminRole.SUPPORT_OPERATOR;
  }

  /** Whether this caller may see {@code tenantId} at all (a Program Admin only sees theirs). */
  public boolean canSee(String otherTenantId) {
    return isOperator() || otherTenantId.equals(tenantId);
  }

  public Actor actor() {
    return new Actor(actorId, role);
  }
}
