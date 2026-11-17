package io.github.joaolucasmm.outlay.tenantapi.persistence;

import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantStatus;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.time.Instant;

@Entity
@Table(name = "tenants")
public class TenantEntity {

  @Id private String id;
  private String name;

  /** Lower-cased, space-collapsed name; a unique index keeps names unique. */
  private String nameKey;

  private String country;
  private String currency;
  private String status;
  private Instant createdAt;
  private Instant updatedAt;

  /** Optimistic lock: two concurrent lifecycle actions cannot both win. */
  @Version private long version;

  protected TenantEntity() {}

  public TenantEntity(
      String id,
      String name,
      String nameKey,
      String country,
      String currency,
      TenantStatus status,
      Instant now) {
    this.id = id;
    this.name = name;
    this.nameKey = nameKey;
    this.country = country;
    this.currency = currency;
    this.status = status.getValue();
    this.createdAt = now;
    this.updatedAt = now;
  }

  public void moveTo(TenantStatus to, Instant now) {
    this.status = to.getValue();
    this.updatedAt = now;
  }

  public String getId() {
    return id;
  }

  public String getName() {
    return name;
  }

  public String getCountry() {
    return country;
  }

  public String getCurrency() {
    return currency;
  }

  public TenantStatus getStatus() {
    return TenantStatus.fromValue(status);
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }
}
