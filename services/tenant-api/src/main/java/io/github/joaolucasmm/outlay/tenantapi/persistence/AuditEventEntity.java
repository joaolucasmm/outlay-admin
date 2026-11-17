package io.github.joaolucasmm.outlay.tenantapi.persistence;

import io.github.joaolucasmm.outlay.tenantapi.api.model.AdminRole;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.Map;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

/** An append-only audit record. {@code before}/{@code after} are free-form JSON columns. */
@Entity
@Table(name = "audit_events")
public class AuditEventEntity {

  @Id private String id;
  private String tenantId;
  private String actorId;
  private String actorRole;
  private String action;
  private String entity;
  private String entityId;

  @JdbcTypeCode(SqlTypes.JSON)
  private Map<String, Object> beforeState;

  @JdbcTypeCode(SqlTypes.JSON)
  private Map<String, Object> afterState;

  private Instant at;

  protected AuditEventEntity() {}

  public AuditEventEntity(
      String id,
      String tenantId,
      String actorId,
      AdminRole actorRole,
      String action,
      String entity,
      String entityId,
      Map<String, Object> beforeState,
      Map<String, Object> afterState,
      Instant at) {
    this.id = id;
    this.tenantId = tenantId;
    this.actorId = actorId;
    this.actorRole = actorRole.getValue();
    this.action = action;
    this.entity = entity;
    this.entityId = entityId;
    this.beforeState = beforeState;
    this.afterState = afterState;
    this.at = at;
  }

  public String getId() {
    return id;
  }

  public String getTenantId() {
    return tenantId;
  }

  public String getActorId() {
    return actorId;
  }

  public AdminRole getActorRole() {
    return AdminRole.fromValue(actorRole);
  }

  public String getAction() {
    return action;
  }

  public String getEntity() {
    return entity;
  }

  public String getEntityId() {
    return entityId;
  }

  public Map<String, Object> getBeforeState() {
    return beforeState;
  }

  public Map<String, Object> getAfterState() {
    return afterState;
  }

  public Instant getAt() {
    return at;
  }
}
