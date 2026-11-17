package io.github.joaolucasmm.outlay.tenantapi.domain;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Pattern;

/** Employee rows and all-or-nothing imports. Mirrors packages/domain/src/employee.ts. */
public final class EmployeeImport {

  /** One row as sent: raw, untrimmed strings. */
  public record Row(String name, String email, String role, String costCenter) {}

  /** A valid, normalized employee: trimmed, email and role lower-cased. */
  public record Employee(String name, String email, String role, String costCenter) {}

  public record ValidRow(int index, Employee employee) {}

  public record InvalidRow(int index, List<FieldError> errors) {}

  public record Validation(List<ValidRow> valid, List<InvalidRow> invalid) {}

  public static final List<String> ROLES = List.of("employee", "manager", "director");

  private static final Pattern EMAIL =
      Pattern.compile("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$", Pattern.UNICODE_CHARACTER_CLASS);

  private EmployeeImport() {}

  public static String normalizeEmail(String email) {
    return Text.lower(Text.trim(email));
  }

  public static Result<Employee, List<FieldError>> validateRow(Row row) {
    List<FieldError> errors = new ArrayList<>();
    String name = Text.trim(row.name());
    String email = normalizeEmail(row.email());
    String role = Text.lower(Text.trim(row.role()));
    String costCenter = Text.trim(row.costCenter());

    if (name.isEmpty() || name.length() > 100) {
      errors.add(new FieldError("name", "Name is required (up to 100 characters)."));
    }
    if (!EMAIL.matcher(email).matches() || email.length() > 254) {
      errors.add(new FieldError("email", "Enter a valid email address."));
    }
    if (!ROLES.contains(role)) {
      errors.add(new FieldError("role", "Role must be employee, manager or director."));
    }
    if (costCenter.isEmpty() || costCenter.length() > 40) {
      errors.add(new FieldError("costCenter", "Cost center is required (up to 40 characters)."));
    }
    return errors.isEmpty()
        ? Result.ok(new Employee(name, email, role, costCenter))
        : Result.err(List.copyOf(errors));
  }

  /**
   * Splits rows into valid and invalid. Besides the per-row rules, an email is invalid if the
   * tenant already has it or if it appears more than once in the file (then every copy is flagged).
   */
  public static Validation validate(List<Row> rows, Collection<String> existingEmails) {
    Set<String> existing = new HashSet<>();
    existingEmails.forEach(e -> existing.add(normalizeEmail(e)));
    Set<String> seen = new HashSet<>();
    Set<String> repeated = new HashSet<>();
    for (Row row : rows) {
      String email = normalizeEmail(row.email());
      if (!seen.add(email)) repeated.add(email);
    }

    List<ValidRow> valid = new ArrayList<>();
    List<InvalidRow> invalid = new ArrayList<>();
    for (int index = 0; index < rows.size(); index++) {
      Row row = rows.get(index);
      String email = normalizeEmail(row.email());
      switch (validateRow(row)) {
        case Result.Err<Employee, List<FieldError>>(var errors) ->
            invalid.add(new InvalidRow(index, errors));
        case Result.Ok<Employee, List<FieldError>>(var employee) -> {
          List<FieldError> errors = new ArrayList<>();
          if (existing.contains(email)) {
            errors.add(new FieldError("email", "An employee with this email already exists."));
          }
          if (repeated.contains(email)) {
            errors.add(new FieldError("email", "This email appears more than once in the file."));
          }
          if (errors.isEmpty()) {
            valid.add(new ValidRow(index, employee));
          } else {
            invalid.add(new InvalidRow(index, List.copyOf(errors)));
          }
        }
      }
    }
    return new Validation(List.copyOf(valid), List.copyOf(invalid));
  }
}
