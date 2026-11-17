package io.github.joaolucasmm.outlay.tenantapi.web;

import io.github.joaolucasmm.outlay.tenantapi.api.model.Actor;
import io.github.joaolucasmm.outlay.tenantapi.api.model.AuditEvent;
import io.github.joaolucasmm.outlay.tenantapi.api.model.Tenant;
import io.github.joaolucasmm.outlay.tenantapi.persistence.AuditEventEntity;
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
}
