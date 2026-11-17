package io.github.joaolucasmm.outlay.tenantapi.web;

import io.github.joaolucasmm.outlay.tenantapi.api.model.Problem;
import io.github.joaolucasmm.outlay.tenantapi.api.model.ProblemErrorsInner;
import io.github.joaolucasmm.outlay.tenantapi.domain.NewTenant.FieldError;
import io.github.joaolucasmm.outlay.tenantapi.domain.TransitionError;
import java.util.List;
import java.util.Locale;
import org.springframework.lang.Nullable;

/**
 * An HTTP error as RFC 9457 Problem Details. Titles, types and statuses match the web mock
 * (apps/web/src/mocks/http.ts), so the UI handles both backends the same way.
 */
public class ApiProblem extends RuntimeException {

  private final int status;
  private final String title;
  private final @Nullable String detail;
  private final List<FieldError> errors;

  public ApiProblem(int status, String title, @Nullable String detail, List<FieldError> errors) {
    super(title + (detail == null ? "" : ": " + detail));
    this.status = status;
    this.title = title;
    this.detail = detail;
    this.errors = List.copyOf(errors);
  }

  public ApiProblem(int status, String title, @Nullable String detail) {
    this(status, title, detail, List.of());
  }

  public int status() {
    return status;
  }

  public Problem body() {
    return new Problem(
            "https://outlay.example/problems/" + title.toLowerCase(Locale.ROOT).replace(' ', '-'),
            title,
            status)
        .detail(detail)
        .errors(errors.stream().map(e -> new ProblemErrorsInner(e.field(), e.message())).toList());
  }

  public static ApiProblem unauthenticated() {
    return new ApiProblem(
        401, "Unauthenticated", "Send a valid " + "X-Demo-Persona" + " header.");
  }

  public static ApiProblem forbidden(@Nullable String detail) {
    return new ApiProblem(403, "Forbidden", detail);
  }

  public static ApiProblem notFound(String detail) {
    return new ApiProblem(404, "Not found", detail);
  }

  public static ApiProblem badRequest(String detail) {
    return new ApiProblem(400, "Bad request", detail);
  }

  public static ApiProblem invalidInput(List<FieldError> errors) {
    return new ApiProblem(422, "Invalid input", errors.getFirst().message(), errors);
  }

  /** The domain's refusal of a Lifecycle Action, with the status the contract gives it. */
  public static ApiProblem of(TransitionError error) {
    return switch (error) {
      case TransitionError.Forbidden e -> forbidden(e.message());
      case TransitionError.InvalidTransition e ->
          new ApiProblem(409, "Invalid transition", e.message());
      case TransitionError.ReasonRequired e -> invalidCommand(e);
      case TransitionError.NameMismatch e -> invalidCommand(e);
    };
  }

  private static ApiProblem invalidCommand(TransitionError e) {
    return new ApiProblem(
        422,
        "Invalid command",
        e.message(),
        List.of(new FieldError(e.field().orElseThrow(), e.message())));
  }
}
