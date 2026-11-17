package io.github.joaolucasmm.outlay.tenantapi.web;

import io.github.joaolucasmm.outlay.tenantapi.domain.FieldError;
import java.util.List;
import org.springframework.lang.Nullable;

/** Problems shared by a controller and the exception handler. */
public final class Problems {

  private Problems() {}

  public static ApiProblem invalidLifecycleCommand() {
    return new ApiProblem(
        422,
        "Invalid command",
        "Body must be a LifecycleCommand.",
        List.of(new FieldError("action", "Unknown or missing action.")));
  }

  public static ApiProblem invalidTenantCreate() {
    return ApiProblem.invalidInput(List.of(new FieldError("name", "Body must be a TenantCreate.")));
  }

  public static ApiProblem duplicateName(@Nullable String name) {
    String message =
        name == null
            ? "A tenant with this name already exists."
            : "A tenant named " + name + " already exists.";
    return new ApiProblem(409, "Duplicate name", message, List.of(new FieldError("name", message)));
  }
}
