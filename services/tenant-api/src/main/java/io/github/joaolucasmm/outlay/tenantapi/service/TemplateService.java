package io.github.joaolucasmm.outlay.tenantapi.service;

import io.github.joaolucasmm.outlay.tenantapi.api.model.ApplyTemplate;
import io.github.joaolucasmm.outlay.tenantapi.api.model.CategoryTemplateId;
import io.github.joaolucasmm.outlay.tenantapi.api.model.TemplateResult;
import io.github.joaolucasmm.outlay.tenantapi.domain.CategoryTemplate;
import io.github.joaolucasmm.outlay.tenantapi.domain.FieldError;
import io.github.joaolucasmm.outlay.tenantapi.domain.Permission;
import io.github.joaolucasmm.outlay.tenantapi.domain.PolicyRuleFields;
import io.github.joaolucasmm.outlay.tenantapi.domain.ProgramAccess;
import io.github.joaolucasmm.outlay.tenantapi.persistence.CategoryEntity;
import io.github.joaolucasmm.outlay.tenantapi.persistence.CategoryRepository;
import io.github.joaolucasmm.outlay.tenantapi.persistence.PolicyRuleEntity;
import io.github.joaolucasmm.outlay.tenantapi.persistence.PolicyRuleRepository;
import io.github.joaolucasmm.outlay.tenantapi.persistence.TenantEntity;
import io.github.joaolucasmm.outlay.tenantapi.persistence.TenantRepository;
import io.github.joaolucasmm.outlay.tenantapi.security.Caller;
import io.github.joaolucasmm.outlay.tenantapi.web.ApiProblem;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Seeds a tenant's program from the standard template while it is being onboarded. */
@Service
public class TemplateService {

  private final TenantRepository tenants;
  private final CategoryRepository categories;
  private final PolicyRuleRepository rules;
  private final CategoryTemplate template;
  private final AuditLog audit;
  private final Clocks clocks;

  public TemplateService(
      TenantRepository tenants,
      CategoryRepository categories,
      PolicyRuleRepository rules,
      CategoryTemplate template,
      AuditLog audit,
      Clocks clocks) {
    this.tenants = tenants;
    this.categories = categories;
    this.rules = rules;
    this.template = template;
    this.audit = audit;
    this.clocks = clocks;
  }

  /**
   * Idempotent: categories whose code the tenant already has are skipped. Checks in the mock's
   * order: 403 (not the operator), 404, 409 (not provisioning), 422.
   */
  @Transactional
  public TemplateResult apply(Caller caller, String tenantId, @Nullable ApplyTemplate body) {
    if (!Permission.can(caller.role(), Permission.TENANTS_CREATE)) {
      throw ApiProblem.forbidden("Templates are applied during onboarding only.");
    }
    TenantEntity tenant =
        tenants.findForUpdate(tenantId).orElseThrow(() -> ApiProblem.notFound("Tenant not found."));
    if (!ProgramAccess.canOnboard(tenant.getStatus())) {
      throw new ApiProblem(
          409,
          "Not onboarding",
          tenant.getName() + " is " + tenant.getStatus().getValue() + ", not provisioning.");
    }
    if (body == null || body.getTemplateId() == null) {
      throw ApiProblem.invalidInput(
          List.of(new FieldError("templateId", "Use \"standard\" or \"empty\".")));
    }

    CategoryTemplate.Program program;
    if (body.getTemplateId() == CategoryTemplateId.STANDARD) {
      Set<String> existing =
          categories.findByTenantId(tenant.getId()).stream()
              .map(CategoryEntity::getCode)
              .collect(Collectors.toSet());
      program = template.programFor(tenant.getId(), tenant.getCurrency(), existing);
    } else {
      program = new CategoryTemplate.Program(List.of(), List.of());
    }

    categories.saveAll(
        program.categories().stream()
            .map(
                c ->
                    new CategoryEntity(
                        c.id(), c.tenantId(), c.code(), c.name(), c.glAccount(), c.active()))
            .toList());
    // Categories first: the rules reference them.
    categories.flush();
    rules.saveAll(
        program.rules().stream()
            .map(
                r ->
                    new PolicyRuleEntity(
                        r.id(),
                        r.tenantId(),
                        r.categoryId(),
                        r.role(),
                        new PolicyRuleFields(
                            r.limitMinor(), r.receiptRequiredAboveMinor(), r.approvalLevels())))
            .toList());

    var result = new TemplateResult(program.categories().size(), program.rules().size());
    audit.record(
        tenant.getId(), caller, "program.template_applied", "program", tenant.getId(), null,
        Map.of(
            "templateId", body.getTemplateId().getValue(),
            "categoriesCreated", result.getCategoriesCreated(),
            "rulesCreated", result.getRulesCreated()),
        clocks.now());
    return result;
  }

}
