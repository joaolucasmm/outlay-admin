package io.github.joaolucasmm.outlay.tenantapi.persistence;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "employees")
public class EmployeeEntity extends NewAwareEntity {

  @Id private String id;
  private String tenantId;
  private String name;

  /** Lower-cased; unique per tenant. */
  private String email;

  private String role;
  private String costCenter;

  protected EmployeeEntity() {}

  public EmployeeEntity(
      String id, String tenantId, String name, String email, String role, String costCenter) {
    this.id = id;
    this.tenantId = tenantId;
    this.name = name;
    this.email = email;
    this.role = role;
    this.costCenter = costCenter;
  }

  @Override
  public String getId() {
    return id;
  }

  public String getTenantId() {
    return tenantId;
  }

  public String getName() {
    return name;
  }

  public String getEmail() {
    return email;
  }

  public String getRole() {
    return role;
  }

  public String getCostCenter() {
    return costCenter;
  }
}
