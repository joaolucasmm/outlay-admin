package io.github.joaolucasmm.outlay.tenantapi.service;

import io.github.joaolucasmm.outlay.tenantapi.api.model.AuditEvent;
import io.github.joaolucasmm.outlay.tenantapi.api.model.AuditEventPage;
import io.github.joaolucasmm.outlay.tenantapi.domain.NewTenant.FieldError;
import io.github.joaolucasmm.outlay.tenantapi.persistence.AuditEventEntity;
import io.github.joaolucasmm.outlay.tenantapi.persistence.AuditEventRepository;
import io.github.joaolucasmm.outlay.tenantapi.security.Caller;
import io.github.joaolucasmm.outlay.tenantapi.web.ApiProblem;
import io.github.joaolucasmm.outlay.tenantapi.web.Cursor;
import io.github.joaolucasmm.outlay.tenantapi.web.Mappers;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Writes and reads the audit log. Every change in the service records exactly one event. */
@Service
@Transactional(readOnly = true)
public class AuditLog {

  /** Filters of GET /audit-events; null means "any". */
  public record Filter(
      @Nullable String tenantId,
      @Nullable String actorId,
      @Nullable String action,
      @Nullable String entity,
      @Nullable OffsetDateTime from,
      @Nullable OffsetDateTime to) {}

  private static final Sort NEWEST_FIRST = Sort.by(Sort.Order.desc("at"), Sort.Order.desc("id"));

  private final AuditEventRepository events;

  public AuditLog(AuditEventRepository events) {
    this.events = events;
  }

  @Transactional
  public void record(
      String tenantId,
      Caller caller,
      String action,
      String entity,
      String entityId,
      @Nullable Map<String, Object> before,
      @Nullable Map<String, Object> after,
      Instant at) {
    events.save(
        new AuditEventEntity(
            "aud_" + UUID.randomUUID(),
            tenantId,
            caller.actorId(),
            caller.role(),
            action,
            entity,
            entityId,
            before,
            after,
            at));
  }

  public AuditEventPage list(
      Caller caller, Filter filter, @Nullable String cursor, @Nullable Integer limit) {
    String tenantId = filter.tenantId();
    if (!caller.isOperator()) {
      if (tenantId != null && !tenantId.equals(caller.tenantId())) {
        throw ApiProblem.forbidden("You can only read your own tenant's audit log.");
      }
      tenantId = caller.tenantId();
    }
    if (filter.from() != null && filter.to() != null && filter.from().isAfter(filter.to())) {
      throw new ApiProblem(
          422,
          "Invalid input",
          "The start of the range is after its end.",
          List.of(new FieldError("from", "Must be before \"to\".")));
    }

    Cursor.AuditKey after = Cursor.decode(cursor, Cursor.AuditKey.class);
    int size = Cursor.limit(limit);
    Specification<AuditEventEntity> spec = matching(tenantId, filter, after);
    List<AuditEventEntity> rows =
        events.findBy(spec, q -> q.sortBy(NEWEST_FIRST).limit(size + 1).all());

    boolean more = rows.size() > size;
    List<AuditEvent> items = rows.stream().limit(size).map(Mappers::auditEvent).toList();
    String next = null;
    if (more) {
      AuditEventEntity last = rows.get(size - 1);
      next = Cursor.encode(new Cursor.AuditKey(last.getAt().toEpochMilli(), last.getId()));
    }
    return new AuditEventPage(items, next);
  }

  private static Specification<AuditEventEntity> matching(
      @Nullable String tenantId, Filter f, @Nullable Cursor.AuditKey after) {
    return (root, query, cb) -> {
      List<Predicate> where = new ArrayList<>();
      if (tenantId != null) where.add(cb.equal(root.get("tenantId"), tenantId));
      if (f.actorId() != null) where.add(cb.equal(root.get("actorId"), f.actorId()));
      if (f.action() != null) where.add(cb.equal(root.get("action"), f.action()));
      if (f.entity() != null) where.add(cb.equal(root.get("entity"), f.entity()));
      Path<Instant> at = root.get("at");
      if (f.from() != null) where.add(cb.greaterThanOrEqualTo(at, f.from().toInstant()));
      if (f.to() != null) where.add(cb.lessThanOrEqualTo(at, f.to().toInstant()));
      if (after != null) {
        Instant afterAt = Instant.ofEpochMilli(after.atMillis());
        where.add(
            cb.or(
                cb.lessThan(at, afterAt),
                cb.and(cb.equal(at, afterAt), cb.lessThan(root.get("id"), after.id()))));
      }
      return cb.and(where.toArray(Predicate[]::new));
    };
  }
}
