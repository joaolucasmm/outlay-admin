package io.github.joaolucasmm.outlay.tenantapi.service;

import io.github.joaolucasmm.outlay.tenantapi.api.model.PolicyRule;
import io.github.joaolucasmm.outlay.tenantapi.api.model.PolicyRuleInput;
import io.github.joaolucasmm.outlay.tenantapi.api.model.PolicyRuleSet;
import io.github.joaolucasmm.outlay.tenantapi.api.model.PolicyRulesReplace;
import io.github.joaolucasmm.outlay.tenantapi.domain.FieldError;
import io.github.joaolucasmm.outlay.tenantapi.domain.PolicyRuleFields;
import io.github.joaolucasmm.outlay.tenantapi.domain.Result;
import io.github.joaolucasmm.outlay.tenantapi.persistence.CategoryEntity;
import io.github.joaolucasmm.outlay.tenantapi.persistence.CategoryRepository;
import io.github.joaolucasmm.outlay.tenantapi.persistence.PolicyRuleEntity;
import io.github.joaolucasmm.outlay.tenantapi.persistence.PolicyRuleRepository;
import io.github.joaolucasmm.outlay.tenantapi.persistence.TenantEntity;
import io.github.joaolucasmm.outlay.tenantapi.security.Caller;
import io.github.joaolucasmm.outlay.tenantapi.web.ApiProblem;
import io.github.joaolucasmm.outlay.tenantapi.web.Mappers;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * The category x role policy grid, replaced as a whole. The contract has no ETag, so the last save
 * wins; the tenant row lock in ProgramGuard keeps each replace atomic.
 */
@Service
@Transactional(readOnly = true)
public class PolicyRuleService {

  private final PolicyRuleRepository rules;
  private final CategoryRepository categories;
  private final ProgramGuard guard;
  private final AuditLog audit;
  private final Clocks clocks;

  public PolicyRuleService(
      PolicyRuleRepository rules,
      CategoryRepository categories,
      ProgramGuard guard,
      AuditLog audit,
      Clocks clocks) {
    this.rules = rules;
    this.categories = categories;
    this.guard = guard;
    this.audit = audit;
    this.clocks = clocks;
  }

  public PolicyRuleSet get(Caller caller, String tenantId) {
    TenantEntity tenant = guard.read(caller, tenantId);
    return new PolicyRuleSet(
        rules.findByTenantIdOrderByCategoryIdAscRoleAsc(tenant.getId()).stream()
            .map(Mappers::policyRule)
            .toList());
  }

  @Transactional
  public PolicyRuleSet replace(Caller caller, String tenantId, @Nullable PolicyRulesReplace body) {
    TenantEntity tenant = guard.write(caller, tenantId);
    if (body == null || body.getRules() == null) {
      throw ApiProblem.invalidInput(
          List.of(new FieldError("rules", "Body must be a PolicyRulesReplace.")));
    }
    List<PolicyRuleInput> inputs = body.getRules();
    Set<String> categoryIds =
        categories.findByTenantId(tenant.getId()).stream()
            .map(CategoryEntity::getId)
            .collect(Collectors.toSet());

    // Validate everything first, stopping at the first bad rule, as the mock does.
    List<PolicyRuleFields> fields = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    for (int index = 0; index < inputs.size(); index++) {
      PolicyRuleInput input = inputs.get(index);
      String prefix = "rules[" + index + "].";
      if (!categoryIds.contains(input.getCategoryId())) {
        throw invalid(prefix, List.of(new FieldError("categoryId", "Unknown category.")));
      }
      if (!seen.add(cell(input))) {
        throw invalid(
            prefix, List.of(new FieldError("role", "Duplicate rule for this category and role.")));
      }
      var rule =
          new PolicyRuleFields(
              input.getLimitMinor(),
              input.getReceiptRequiredAboveMinor(),
              input.getApprovalLevels().getValue());
      switch (rule.validate()) {
        case Result.Ok<PolicyRuleFields, List<FieldError>>(var valid) -> fields.add(valid);
        case Result.Err<PolicyRuleFields, List<FieldError>>(var errors) ->
            throw invalid(prefix, errors);
      }
    }

    Map<String, PolicyRuleEntity> previous = new LinkedHashMap<>();
    rules.findByTenantIdOrderByCategoryIdAscRoleAsc(tenant.getId())
        .forEach(r -> previous.put(r.cell(), r));
    Map<String, PolicyRuleFields> beforeFields = new LinkedHashMap<>();
    previous.forEach((cell, r) -> beforeFields.put(cell, r.fields()));

    // Update cells that stay, insert new ones, delete the rest. Ids of kept cells survive.
    List<PolicyRuleEntity> next = new ArrayList<>();
    for (int index = 0; index < inputs.size(); index++) {
      PolicyRuleInput input = inputs.get(index);
      PolicyRuleEntity existing = previous.remove(cell(input));
      if (existing != null) {
        existing.apply(fields.get(index));
        next.add(existing);
      } else {
        next.add(
            rules.save(
                new PolicyRuleEntity(
                    "pol_" + UUID.randomUUID(),
                    tenant.getId(),
                    input.getCategoryId(),
                    input.getRole().getValue(),
                    fields.get(index))));
      }
    }
    rules.deleteAll(previous.values());

    recordChanges(caller, tenant, beforeFields, next);
    return new PolicyRuleSet(next.stream().map(Mappers::policyRule).toList());
  }

  /** Audits only the cells that were added, removed or edited, as the mock does. */
  private void recordChanges(
      Caller caller, TenantEntity tenant, Map<String, PolicyRuleFields> before,
      List<PolicyRuleEntity> next) {
    Map<String, PolicyRuleFields> after = new LinkedHashMap<>();
    next.forEach(r -> after.put(r.cell(), r.fields()));
    Set<String> cells = new LinkedHashSet<>(before.keySet());
    cells.addAll(after.keySet());

    Map<String, Object> beforeLog = new LinkedHashMap<>();
    Map<String, Object> afterLog = new LinkedHashMap<>();
    for (String cell : cells) {
      PolicyRuleFields was = before.get(cell);
      PolicyRuleFields now = after.get(cell);
      if (was != null && was.equals(now)) continue;
      beforeLog.put(cell, was);
      afterLog.put(cell, now);
    }
    if (!afterLog.isEmpty()) {
      audit.record(
          tenant.getId(), caller, "policy.updated", "policy", tenant.getId(),
          audit.asMap(beforeLog), audit.asMap(afterLog), clocks.now());
    }
  }

  private static String cell(PolicyRuleInput input) {
    return input.getCategoryId() + ":" + input.getRole().getValue();
  }

  private static ApiProblem invalid(String prefix, List<FieldError> errors) {
    return ApiProblem.invalidInput(
        errors.stream().map(e -> new FieldError(prefix + e.field(), e.message())).toList());
  }
}
