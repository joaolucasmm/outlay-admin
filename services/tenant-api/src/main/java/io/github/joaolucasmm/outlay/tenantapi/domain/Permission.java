package io.github.joaolucasmm.outlay.tenantapi.domain;

import io.github.joaolucasmm.outlay.tenantapi.api.model.AdminRole;
import java.util.Arrays;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

/** What each Admin Role may do. Mirrors packages/domain/src/permissions.ts. */
public enum Permission {
  TENANTS_LIST("tenants:list"),
  TENANTS_CREATE("tenants:create"),
  TENANTS_TRANSITION("tenants:transition"),
  TENANT_CONFIGURE("tenant:configure"),
  AUDIT_READ("audit:read");

  private static final Map<AdminRole, Set<Permission>> GRANTS =
      Map.of(
          AdminRole.SUPPORT_OPERATOR,
          EnumSet.of(TENANTS_LIST, TENANTS_CREATE, TENANTS_TRANSITION, AUDIT_READ),
          AdminRole.PROGRAM_ADMIN,
          EnumSet.of(TENANT_CONFIGURE, AUDIT_READ));

  private final String value;

  Permission(String value) {
    this.value = value;
  }

  /** The wire name, e.g. {@code tenants:transition}; also the Spring Security authority. */
  public String value() {
    return value;
  }

  public static Permission fromValue(String value) {
    return Arrays.stream(values())
        .filter(p -> p.value.equals(value))
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException("Unknown permission: " + value));
  }

  public static Set<Permission> grantedTo(AdminRole role) {
    return GRANTS.get(role);
  }

  public static boolean can(AdminRole role, Permission permission) {
    return grantedTo(role).contains(permission);
  }
}
