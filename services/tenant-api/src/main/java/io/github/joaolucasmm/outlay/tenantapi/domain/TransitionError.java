package io.github.joaolucasmm.outlay.tenantapi.domain;

import io.github.joaolucasmm.outlay.tenantapi.api.model.LifecycleAction;
import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantStatus;
import java.util.Optional;

/** Why a Lifecycle Action was refused. Codes and messages match packages/domain exactly. */
public sealed interface TransitionError {

  String code();

  String message();

  /** The command field to blame, for 422 {@code errors[].field}. */
  default Optional<String> field() {
    return Optional.empty();
  }

  record Forbidden() implements TransitionError {
    @Override
    public String code() {
      return "forbidden";
    }

    @Override
    public String message() {
      return "Only a Support Operator may run lifecycle actions.";
    }
  }

  record InvalidTransition(TenantStatus from, LifecycleAction action) implements TransitionError {
    @Override
    public String code() {
      return "invalid_transition";
    }

    @Override
    public String message() {
      return "Cannot " + action.getValue() + " a tenant that is " + from.getValue() + ".";
    }
  }

  record ReasonRequired() implements TransitionError {
    @Override
    public String code() {
      return "reason_required";
    }

    @Override
    public String message() {
      return "A reason is required to suspend a tenant.";
    }

    @Override
    public Optional<String> field() {
      return Optional.of("reason");
    }
  }

  record NameMismatch() implements TransitionError {
    @Override
    public String code() {
      return "name_mismatch";
    }

    @Override
    public String message() {
      return "Type the exact tenant name to confirm deprovisioning.";
    }

    @Override
    public Optional<String> field() {
      return Optional.of("confirmationName");
    }
  }
}
