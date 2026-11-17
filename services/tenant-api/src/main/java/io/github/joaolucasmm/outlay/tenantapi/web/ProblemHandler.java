package io.github.joaolucasmm.outlay.tenantapi.web;

import io.github.joaolucasmm.outlay.tenantapi.domain.NewTenant.FieldError;
import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

/** Every error leaves as Problem Details, with the statuses and titles the mock uses. */
@RestControllerAdvice
public class ProblemHandler {

  private static final Logger LOG = LoggerFactory.getLogger(ProblemHandler.class);
  private static final Set<String> DATE_PARAMS = Set.of("from", "to");

  @ExceptionHandler(ApiProblem.class)
  ResponseEntity<Object> problem(ApiProblem problem) {
    return ProblemWriter.entity(problem);
  }

  @ExceptionHandler(AccessDeniedException.class)
  ResponseEntity<Object> accessDenied() {
    return ProblemWriter.entity(ApiProblem.forbidden("Your role does not allow this action."));
  }

  @ExceptionHandler(MethodArgumentTypeMismatchException.class)
  ResponseEntity<Object> badParameter(MethodArgumentTypeMismatchException e) {
    String name = e.getName();
    if (DATE_PARAMS.contains(name)) {
      return ProblemWriter.entity(
          new ApiProblem(
              422,
              "Invalid input",
              "Dates must be ISO 8601 date-times.",
              List.of(new FieldError(name, "Not a valid date-time."))));
    }
    if (name.equals("status")) {
      return ProblemWriter.entity(
          ApiProblem.badRequest("Unknown status \"" + e.getValue() + "\"."));
    }
    return ProblemWriter.entity(ApiProblem.badRequest("Invalid value for \"" + name + "\"."));
  }

  /** A body that is not JSON or does not fit the schema (e.g. an unknown lifecycle action). */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  ResponseEntity<Object> unreadable(HttpServletRequest request) {
    return ProblemWriter.entity(
        request.getRequestURI().endsWith("/transitions")
            ? Problems.invalidLifecycleCommand()
            : Problems.invalidTenantCreate());
  }

  @ExceptionHandler(OptimisticLockingFailureException.class)
  ResponseEntity<Object> concurrentChange() {
    return ProblemWriter.entity(
        new ApiProblem(
            409, "Conflict", "The tenant changed while you were acting on it. Reload it and retry."));
  }

  /** The unique name index caught a duplicate that the service's own check raced past. */
  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<Object> integrity(DataIntegrityViolationException e) {
    LOG.warn("Integrity violation", e);
    return ProblemWriter.entity(Problems.duplicateName(null));
  }

  @ExceptionHandler(NoResourceFoundException.class)
  ResponseEntity<Object> noResource() {
    return ProblemWriter.entity(ApiProblem.notFound("No such endpoint."));
  }

  @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
  ResponseEntity<Object> method(HttpRequestMethodNotSupportedException e) {
    return ProblemWriter.entity(new ApiProblem(405, "Method not allowed", e.getMessage()));
  }

  @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
  ResponseEntity<Object> mediaType(HttpMediaTypeNotSupportedException e) {
    return ProblemWriter.entity(new ApiProblem(415, "Unsupported media type", e.getMessage()));
  }
}
