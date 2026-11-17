package io.github.joaolucasmm.outlay.tenantapi.domain;

import io.github.joaolucasmm.outlay.tenantapi.api.model.AdminRole;
import io.github.joaolucasmm.outlay.tenantapi.api.model.LifecycleAction;
import io.github.joaolucasmm.outlay.tenantapi.api.model.LifecycleCommand;
import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantStatus;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;

/**
 * The tenant lifecycle, a port of packages/domain/src/lifecycle.ts. Pure: no clock, no
 * persistence, no Spring. Both implementations run packages/domain/fixtures/lifecycle-cases.json.
 */
public final class Lifecycle {

  /** One allowed transition and the audit action it records. */
  public record Rule(TenantStatus from, TenantStatus to, String event) {}

  /** What a successful Lifecycle Action changes, ready to persist and audit. */
  public record Outcome(
      TenantStatus to, String event, Map<String, Object> before, Map<String, Object> after) {}

  private static final Map<LifecycleAction, Rule> RULES = new EnumMap<>(LifecycleAction.class);

  static {
    RULES.put(
        LifecycleAction.ACTIVATE,
        new Rule(TenantStatus.PROVISIONING, TenantStatus.ACTIVE, "tenant.activated"));
    RULES.put(
        LifecycleAction.SUSPEND,
        new Rule(TenantStatus.ACTIVE, TenantStatus.SUSPENDED, "tenant.suspended"));
    RULES.put(
        LifecycleAction.REACTIVATE,
        new Rule(TenantStatus.SUSPENDED, TenantStatus.ACTIVE, "tenant.reactivated"));
    RULES.put(
        LifecycleAction.DEPROVISION,
        new Rule(TenantStatus.SUSPENDED, TenantStatus.DEPROVISIONED, "tenant.deprovisioned"));
  }

  private Lifecycle() {}

  /** Lifecycle Actions that can run from {@code status}, in a stable order. */
  public static List<LifecycleAction> availableActions(TenantStatus status) {
    return Arrays.stream(LifecycleAction.values())
        .filter(action -> RULES.get(action).from() == status)
        .toList();
  }

  /**
   * Runs a Lifecycle Action. Checks, in order: permission, allowed transition, then the command's
   * own requirements (suspend reason, deprovision confirmation).
   */
  public static Result<Outcome, TransitionError> transition(
      String tenantName, TenantStatus status, LifecycleCommand command, AdminRole role) {
    if (!Permission.can(role, Permission.TENANTS_TRANSITION)) {
      return Result.err(new TransitionError.Forbidden());
    }

    LifecycleAction action = command.getAction();
    Rule rule = RULES.get(action);
    if (status != rule.from()) {
      return Result.err(new TransitionError.InvalidTransition(status, action));
    }

    String reason = command.getReason() == null ? "" : command.getReason().strip();
    if (action == LifecycleAction.SUSPEND && reason.isEmpty()) {
      return Result.err(new TransitionError.ReasonRequired());
    }

    String confirmation = command.getConfirmationName();
    if (action == LifecycleAction.DEPROVISION
        && (confirmation == null || !confirmation.strip().equals(tenantName))) {
      return Result.err(new TransitionError.NameMismatch());
    }

    Map<String, Object> after =
        reason.isEmpty()
            ? Map.of("status", rule.to().getValue())
            : Map.of("status", rule.to().getValue(), "reason", reason);
    return Result.ok(
        new Outcome(rule.to(), rule.event(), Map.of("status", status.getValue()), after));
  }
}
