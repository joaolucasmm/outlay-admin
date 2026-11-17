package io.github.joaolucasmm.outlay.tenantapi.persistence;

import io.github.joaolucasmm.outlay.tenantapi.domain.PolicyRuleFields;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** One cell of the category x role grid. Money in integer minor units of the tenant currency. */
@Entity
@Table(name = "policy_rules")
public class PolicyRuleEntity extends NewAwareEntity {

  @Id private String id;
  private String tenantId;
  private String categoryId;
  private String role;
  private long limitMinor;
  private long receiptRequiredAboveMinor;
  private int approvalLevels;

  protected PolicyRuleEntity() {}

  public PolicyRuleEntity(
      String id, String tenantId, String categoryId, String role, PolicyRuleFields fields) {
    this.id = id;
    this.tenantId = tenantId;
    this.categoryId = categoryId;
    this.role = role;
    apply(fields);
  }

  public final void apply(PolicyRuleFields fields) {
    this.limitMinor = fields.limitMinor();
    this.receiptRequiredAboveMinor = fields.receiptRequiredAboveMinor();
    this.approvalLevels = fields.approvalLevels();
  }

  public PolicyRuleFields fields() {
    return new PolicyRuleFields(limitMinor, receiptRequiredAboveMinor, approvalLevels);
  }

  /** The grid cell, e.g. {@code cat_bluefin_meals:manager}: the audit log's key. */
  public String cell() {
    return categoryId + ":" + role;
  }

  @Override
  public String getId() {
    return id;
  }

  public String getTenantId() {
    return tenantId;
  }

  public String getCategoryId() {
    return categoryId;
  }

  public String getRole() {
    return role;
  }
}
