package io.github.joaolucasmm.outlay.tenantapi.web;

import com.fasterxml.jackson.databind.JsonMappingException;
import com.fasterxml.jackson.databind.exc.UnrecognizedPropertyException;
import io.github.joaolucasmm.outlay.tenantapi.domain.FieldError;
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
    if (e.getRequiredType() != null && e.getRequiredType().isEnum()) {
      return ProblemWriter.entity(
          ApiProblem.badRequest("Unknown " + name + " \"" + e.getValue() + "\"."));
    }
    return ProblemWriter.entity(ApiProblem.badRequest("Invalid value for \"" + name + "\"."));
  }

  /**
   * A body that is not JSON or does not fit the schema. When Jackson knows where (an unknown
   * field, a value outside an enum), the error points there, e.g. {@code employees[3].role}.
   */
  @ExceptionHandler(HttpMessageNotReadableException.class)
  ResponseEntity<Object> unreadable(HttpMessageNotReadableException e, HttpServletRequest request) {
    if (request.getRequestURI().endsWith("/transitions")) {
      return ProblemWriter.entity(Problems.invalidLifecycleCommand());
    }
    if (e.getCause() instanceof JsonMappingException mapping && !mapping.getPath().isEmpty()) {
      String message =
          mapping instanceof UnrecognizedPropertyException
              ? "This field is not part of the contract."
              : "Not a valid value for this field.";
      return ProblemWriter.entity(
          ApiProblem.invalidInput(List.of(new FieldError(path(mapping), message))));
    }
    return ProblemWriter.entity(
        request.getRequestURI().endsWith("/tenants")
            ? Problems.invalidTenantCreate()
            : ApiProblem.invalidInput(List.of(new FieldError("body", "Body is not valid JSON."))));
  }

  /** Jackson's location as the contract's field notation: {@code rules[2].approvalLevels}. */
  private static String path(JsonMappingException e) {
    StringBuilder out = new StringBuilder();
    for (JsonMappingException.Reference ref : e.getPath()) {
      if (ref.getFieldName() != null) {
        if (!out.isEmpty()) out.append('.');
        out.append(ref.getFieldName());
      } else {
        out.append('[').append(ref.getIndex()).append(']');
      }
    }
    return out.toString();
  }

  @ExceptionHandler(OptimisticLockingFailureException.class)
  ResponseEntity<Object> concurrentChange() {
    return ProblemWriter.entity(
        new ApiProblem(
            409, "Conflict", "The tenant changed while you were acting on it. Reload it and retry."));
  }

  /**
   * A unique index caught a duplicate that a service check raced past. Program writes lock the
   * tenant row, so this is rare; the constraint name says which duplicate it was.
   */
  @ExceptionHandler(DataIntegrityViolationException.class)
  ResponseEntity<Object> integrity(DataIntegrityViolationException e) {
    LOG.warn("Integrity violation", e);
    String detail = String.valueOf(e.getMostSpecificCause().getMessage());
    if (detail.contains("uq_tenants_name_key")) {
      return ProblemWriter.entity(Problems.duplicateName(null));
    }
    if (detail.contains("uq_categories_tenant_code")) {
      return ProblemWriter.entity(
          conflict("Duplicate code", "code", "This code is already used."));
    }
    if (detail.contains("uq_employees_tenant_email")) {
      return ProblemWriter.entity(
          conflict("Duplicate email", "email", "An employee with this email already exists."));
    }
    return ProblemWriter.entity(
        new ApiProblem(409, "Conflict", "The change conflicts with existing data."));
  }

  private static ApiProblem conflict(String title, String field, String message) {
    return new ApiProblem(409, title, message, List.of(new FieldError(field, message)));
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
