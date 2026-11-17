package io.github.joaolucasmm.outlay.tenantapi.web;

import io.github.joaolucasmm.outlay.tenantapi.api.ProgramApi;
import io.github.joaolucasmm.outlay.tenantapi.api.model.ApplyTemplate;
import io.github.joaolucasmm.outlay.tenantapi.api.model.CategoryCreate;
import io.github.joaolucasmm.outlay.tenantapi.api.model.CategoryPage;
import io.github.joaolucasmm.outlay.tenantapi.api.model.CategoryUpdate;
import io.github.joaolucasmm.outlay.tenantapi.api.model.EmployeeImport;
import io.github.joaolucasmm.outlay.tenantapi.api.model.EmployeePage;
import io.github.joaolucasmm.outlay.tenantapi.api.model.EmployeeRole;
import io.github.joaolucasmm.outlay.tenantapi.api.model.ExpenseCategory;
import io.github.joaolucasmm.outlay.tenantapi.api.model.ImportResult;
import io.github.joaolucasmm.outlay.tenantapi.api.model.PolicyRuleSet;
import io.github.joaolucasmm.outlay.tenantapi.api.model.PolicyRulesReplace;
import io.github.joaolucasmm.outlay.tenantapi.api.model.TemplateResult;
import io.github.joaolucasmm.outlay.tenantapi.security.CurrentCaller;
import io.github.joaolucasmm.outlay.tenantapi.service.CategoryService;
import io.github.joaolucasmm.outlay.tenantapi.service.EmployeeService;
import io.github.joaolucasmm.outlay.tenantapi.service.PolicyRuleService;
import io.github.joaolucasmm.outlay.tenantapi.service.TemplateService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

/**
 * Implements the generated {@link ProgramApi}: a tenant's categories, policy grid, employees and
 * template. Access rules (who, which tenant, which status) live in ProgramGuard.
 */
@RestController
public class ProgramController implements ProgramApi {

  private final CategoryService categories;
  private final PolicyRuleService rules;
  private final EmployeeService employees;
  private final TemplateService templates;

  public ProgramController(
      CategoryService categories,
      PolicyRuleService rules,
      EmployeeService employees,
      TemplateService templates) {
    this.categories = categories;
    this.rules = rules;
    this.employees = employees;
    this.templates = templates;
  }

  @Override
  public ResponseEntity<CategoryPage> listCategories(
      String tenantId, String cursor, Integer limit) {
    return ResponseEntity.ok(categories.list(CurrentCaller.get(), tenantId, cursor, limit));
  }

  @Override
  public ResponseEntity<ExpenseCategory> createCategory(String tenantId, CategoryCreate body) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(categories.create(CurrentCaller.get(), tenantId, body));
  }

  @Override
  public ResponseEntity<ExpenseCategory> updateCategory(
      String tenantId, String categoryId, CategoryUpdate body) {
    return ResponseEntity.ok(categories.update(CurrentCaller.get(), tenantId, categoryId, body));
  }

  @Override
  public ResponseEntity<PolicyRuleSet> getPolicyRules(String tenantId) {
    return ResponseEntity.ok(rules.get(CurrentCaller.get(), tenantId));
  }

  @Override
  public ResponseEntity<PolicyRuleSet> replacePolicyRules(
      String tenantId, PolicyRulesReplace body) {
    return ResponseEntity.ok(rules.replace(CurrentCaller.get(), tenantId, body));
  }

  @Override
  public ResponseEntity<EmployeePage> listEmployees(
      String tenantId, String q, EmployeeRole role, String cursor, Integer limit) {
    return ResponseEntity.ok(
        employees.list(CurrentCaller.get(), tenantId, q, role, cursor, limit));
  }

  @Override
  public ResponseEntity<ImportResult> importEmployees(String tenantId, EmployeeImport body) {
    return ResponseEntity.ok(
        employees.importAll(
            CurrentCaller.get(), tenantId, body == null ? null : body.getEmployees()));
  }

  @Override
  public ResponseEntity<TemplateResult> applyCategoryTemplate(
      String tenantId, ApplyTemplate body) {
    return ResponseEntity.ok(templates.apply(CurrentCaller.get(), tenantId, body));
  }
}
