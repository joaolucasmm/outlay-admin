package io.github.joaolucasmm.outlay.tenantapi.service;

import io.github.joaolucasmm.outlay.tenantapi.api.model.EmployeeInput;
import io.github.joaolucasmm.outlay.tenantapi.api.model.EmployeePage;
import io.github.joaolucasmm.outlay.tenantapi.api.model.EmployeeRole;
import io.github.joaolucasmm.outlay.tenantapi.api.model.ImportResult;
import io.github.joaolucasmm.outlay.tenantapi.domain.EmployeeImport;
import io.github.joaolucasmm.outlay.tenantapi.domain.FieldError;
import io.github.joaolucasmm.outlay.tenantapi.domain.Text;
import io.github.joaolucasmm.outlay.tenantapi.persistence.EmployeeEntity;
import io.github.joaolucasmm.outlay.tenantapi.persistence.EmployeeRepository;
import io.github.joaolucasmm.outlay.tenantapi.persistence.TenantEntity;
import io.github.joaolucasmm.outlay.tenantapi.security.Caller;
import io.github.joaolucasmm.outlay.tenantapi.web.ApiProblem;
import io.github.joaolucasmm.outlay.tenantapi.web.Cursor;
import io.github.joaolucasmm.outlay.tenantapi.web.Mappers;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A tenant's employees: search, and all-or-nothing imports from CSV. */
@Service
@Transactional(readOnly = true)
public class EmployeeService {

  public static final int MAX_IMPORT = 1000;
  private static final Sort BY_NAME = Sort.by("name", "id");

  private final EmployeeRepository employees;
  private final ProgramGuard guard;
  private final AuditLog audit;
  private final Clocks clocks;

  public EmployeeService(
      EmployeeRepository employees, ProgramGuard guard, AuditLog audit, Clocks clocks) {
    this.employees = employees;
    this.guard = guard;
    this.audit = audit;
    this.clocks = clocks;
  }

  public EmployeePage list(
      Caller caller,
      String tenantId,
      @Nullable String q,
      @Nullable EmployeeRole role,
      @Nullable String cursor,
      @Nullable Integer limit) {
    TenantEntity tenant = guard.read(caller, tenantId);
    Cursor.NameKey after = Cursor.decode(cursor, Cursor.NameKey.class);
    int size = Cursor.limit(limit);
    String search = q == null ? "" : Text.lower(Text.trim(q));

    Specification<EmployeeEntity> spec =
        (root, query, cb) -> {
          List<Predicate> where = new ArrayList<>();
          where.add(cb.equal(root.get("tenantId"), tenant.getId()));
          if (!search.isEmpty()) {
            String like = "%" + Cursor.escapeLike(search) + "%";
            where.add(
                cb.or(
                    cb.like(cb.lower(root.get("name")), like, '\\'),
                    cb.like(root.get("email"), like, '\\')));
          }
          if (role != null) where.add(cb.equal(root.get("role"), role.getValue()));
          if (after != null) {
            Path<String> name = root.get("name");
            where.add(
                cb.or(
                    cb.greaterThan(name, after.name()),
                    cb.and(cb.equal(name, after.name()), cb.greaterThan(root.get("id"), after.id()))));
          }
          return cb.and(where.toArray(Predicate[]::new));
        };
    List<EmployeeEntity> rows = employees.findBy(spec, f -> f.sortBy(BY_NAME).limit(size + 1).all());
    String next = null;
    if (rows.size() > size) {
      EmployeeEntity last = rows.get(size - 1);
      next = Cursor.encode(new Cursor.NameKey(last.getName(), last.getId()));
    }
    return new EmployeePage(rows.stream().limit(size).map(Mappers::employee).toList(), next);
  }

  /** All or nothing: one invalid row and nothing is imported, with every bad row pointed at. */
  @Transactional
  public ImportResult importAll(Caller caller, String tenantId, @Nullable List<EmployeeInput> input) {
    TenantEntity tenant = guard.write(caller, tenantId);
    if (input == null || input.isEmpty() || input.size() > MAX_IMPORT) {
      throw ApiProblem.invalidInput(
          List.of(
              new FieldError("employees", "Send 1 to 1000 employees as EmployeeInput objects.")));
    }
    List<EmployeeImport.Row> rows =
        input.stream()
            .map(
                e ->
                    new EmployeeImport.Row(
                        Objects.requireNonNullElse(e.getName(), ""),
                        Objects.requireNonNullElse(e.getEmail(), ""),
                        e.getRole() == null ? "" : e.getRole().getValue(),
                        Objects.requireNonNullElse(e.getCostCenter(), "")))
            .toList();

    var result = EmployeeImport.validate(rows, employees.findEmailsByTenantId(tenant.getId()));
    if (!result.invalid().isEmpty()) {
      throw new ApiProblem(
          422,
          "Invalid employees",
          result.invalid().size()
              + " of "
              + rows.size()
              + " employees are invalid. Nothing was imported.",
          result.invalid().stream()
              .flatMap(
                  row ->
                      row.errors().stream()
                          .map(
                              e ->
                                  new FieldError(
                                      "employees[" + row.index() + "]." + e.field(), e.message())))
              .toList());
    }

    String slug = tenant.getId().replaceFirst("^tnt_", "");
    List<EmployeeEntity> created =
        result.valid().stream()
            .map(
                v ->
                    new EmployeeEntity(
                        "emp_" + slug + "_" + UUID.randomUUID().toString().substring(0, 8),
                        tenant.getId(),
                        v.employee().name(),
                        v.employee().email(),
                        v.employee().role(),
                        v.employee().costCenter()))
            .toList();
    employees.saveAll(created);
    audit.record(
        tenant.getId(), caller, "employees.imported", "employee", tenant.getId(), null,
        Map.of("imported", created.size()), clocks.now());
    return new ImportResult(created.size());
  }
}
