package io.github.joaolucasmm.outlay.tenantapi.persistence;

import jakarta.annotation.Nullable;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "categories")
public class CategoryEntity extends NewAwareEntity {

  @Id private String id;
  private String tenantId;

  /** Stable and unique per tenant; never changes after creation. */
  private String code;

  private String name;
  private @Nullable String glAccount;
  private boolean active;

  protected CategoryEntity() {}

  public CategoryEntity(
      String id,
      String tenantId,
      String code,
      String name,
      @Nullable String glAccount,
      boolean active) {
    this.id = id;
    this.tenantId = tenantId;
    this.code = code;
    this.name = name;
    this.glAccount = glAccount;
    this.active = active;
  }

  @Override
  public String getId() {
    return id;
  }

  public String getTenantId() {
    return tenantId;
  }

  public String getCode() {
    return code;
  }

  public String getName() {
    return name;
  }

  public void setName(String name) {
    this.name = name;
  }

  public @Nullable String getGlAccount() {
    return glAccount;
  }

  public void setGlAccount(@Nullable String glAccount) {
    this.glAccount = glAccount;
  }

  public boolean isActive() {
    return active;
  }

  public void setActive(boolean active) {
    this.active = active;
  }
}
