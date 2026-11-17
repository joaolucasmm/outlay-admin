package io.github.joaolucasmm.outlay.tenantapi.web;

import io.github.joaolucasmm.outlay.tenantapi.api.model.Actor;
import io.github.joaolucasmm.outlay.tenantapi.api.model.ApprovalLevels;
import io.github.joaolucasmm.outlay.tenantapi.api.model.AuditEvent;
import io.github.joaolucasmm.outlay.tenantapi.api.model.Employee;
import io.github.joaolucasmm.outlay.tenantapi.api.model.EmployeeRole;
import io.github.joaolucasmm.outlay.tenantapi.api.model.ExpenseCategory;
import io.github.joaolucasmm.outlay.tenantapi.api.model.PolicyRule;
import io.github.joaolucasmm.outlay.tenantapi.api.model.Tenant;
import io.github.joaolucasmm.outlay.tenantapi.persistence.AuditEventEntity;
import io.github.joaolucasmm.outlay.tenantapi.persistence.CategoryEntity;
import io.github.joaolucasmm.outlay.tenantapi.persistence.EmployeeEntity;
import io.github.joaolucasmm.outlay.tenantapi.persistence.PolicyRuleEntity;
import io.github.joaolucasmm.outlay.tenantapi.persistence.TenantEntity;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/** Entities to contract DTOs. The DTOs are generated from openapi.yaml. */
public final class Mappers {

  private Mappers() {}

  public static OffsetDateTime utc(Instant instant) {
    return instant.atOffset(ZoneOffset.UTC);
  }

  public static Tenant tenant(TenantEntity t) {
    return new Tenant(
        t.getId(),
        t.getName(),
        t.getCountry(),
        t.getCurrency(),
        t.getStatus(),
        utc(t.getCreatedAt()),
        utc(t.getUpdatedAt()));
  }

  public static AuditEvent auditEvent(AuditEventEntity e) {
    return new AuditEvent(
            e.getId(),
            e.getTenantId(),
            new Actor(e.getActorId(), e.getActorRole()),
            e.getAction(),
            e.getEntity(),
            e.getEntityId(),
            utc(e.getAt()))
        .before(e.getBeforeState())
        .after(e.getAfterState());
  }

  public static ExpenseCategory category(CategoryEntity c) {
    return new ExpenseCategory(
        c.getId(), c.getTenantId(), c.getCode(), c.getName(), c.getGlAccount(), c.isActive());
  }

  public static PolicyRule policyRule(PolicyRuleEntity r) {
    var fields = r.fields();
    return new PolicyRule(
        r.getCategoryId(),
        EmployeeRole.fromValue(r.getRole()),
        Math.toIntExact(fields.limitMinor()),
        Math.toIntExact(fields.receiptRequiredAboveMinor()),
        ApprovalLevels.fromValue(fields.approvalLevels()),
        r.getId(),
        r.getTenantId());
  }

  public static Employee employee(EmployeeEntity e) {
    return new Employee(
        e.getName(),
        e.getEmail(),
        EmployeeRole.fromValue(e.getRole()),
        e.getCostCenter(),
        e.getId(),
        e.getTenantId());
  }
}
