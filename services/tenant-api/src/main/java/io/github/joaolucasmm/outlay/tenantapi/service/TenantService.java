package io.github.joaolucasmm.outlay.tenantapi.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.github.joaolucasmm.outlay.tenantapi.api.model.LifecycleCommand;
import io.github.joaolucasmm.outlay.tenantapi.api.model.Tenant;
import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantCreate;
import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantPage;
import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantStatus;
import io.github.joaolucasmm.outlay.tenantapi.domain.FieldError;
import io.github.joaolucasmm.outlay.tenantapi.domain.Lifecycle;
import io.github.joaolucasmm.outlay.tenantapi.domain.NewTenant;
import io.github.joaolucasmm.outlay.tenantapi.domain.Result;
import io.github.joaolucasmm.outlay.tenantapi.domain.TransitionError;
import io.github.joaolucasmm.outlay.tenantapi.persistence.TenantEntity;
import io.github.joaolucasmm.outlay.tenantapi.persistence.TenantRepository;
import io.github.joaolucasmm.outlay.tenantapi.security.Caller;
import io.github.joaolucasmm.outlay.tenantapi.web.ApiProblem;
import io.github.joaolucasmm.outlay.tenantapi.web.Cursor;
import io.github.joaolucasmm.outlay.tenantapi.web.Mappers;
import io.github.joaolucasmm.outlay.tenantapi.web.Problems;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Tenants: list, read, onboard and run Lifecycle Actions. Rules live in the domain package. */
@Service
@Transactional(readOnly = true)
public class TenantService {

  private static final Sort BY_NAME = Sort.by("name", "id");
  private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};

  private final TenantRepository tenants;
  private final AuditLog audit;
  private final Clock clock;
  private final ObjectMapper json;

  public TenantService(TenantRepository tenants, AuditLog audit, Clock clock, ObjectMapper json) {
    this.tenants = tenants;
    this.audit = audit;
    this.clock = clock;
    this.json = json;
  }

  public TenantPage list(
      Caller caller,
      @Nullable String q,
      @Nullable TenantStatus status,
      @Nullable String cursor,
      @Nullable Integer limit) {
    Cursor.TenantKey after = Cursor.decode(cursor, Cursor.TenantKey.class);
    int size = Cursor.limit(limit);
    String search = q == null ? "" : q.strip().toLowerCase(Locale.ROOT);

    Specification<TenantEntity> spec =
        (root, query, cb) -> {
          List<Predicate> where = new ArrayList<>();
          // A Program Admin only ever sees their own tenant.
          if (!caller.isOperator()) where.add(cb.equal(root.get("id"), caller.tenantId()));
          if (!search.isEmpty()) {
            where.add(cb.like(cb.lower(root.get("name")), "%" + Cursor.escapeLike(search) + "%", '\\'));
          }
          if (status != null) where.add(cb.equal(root.get("status"), status.getValue()));
          if (after != null) {
            Path<String> name = root.get("name");
            where.add(
                cb.or(
                    cb.greaterThan(name, after.name()),
                    cb.and(cb.equal(name, after.name()), cb.greaterThan(root.get("id"), after.id()))));
          }
          return cb.and(where.toArray(Predicate[]::new));
        };

    List<TenantEntity> rows = tenants.findBy(spec, f -> f.sortBy(BY_NAME).limit(size + 1).all());
    boolean more = rows.size() > size;
    List<Tenant> items = rows.stream().limit(size).map(Mappers::tenant).toList();
    String next = null;
    if (more) {
      TenantEntity last = rows.get(size - 1);
      next = Cursor.encode(new Cursor.TenantKey(last.getName(), last.getId()));
    }
    return new TenantPage(items, next);
  }

  public Tenant get(Caller caller, String id) {
    return tenants
        .findById(id)
        .filter(t -> caller.canSee(t.getId()))
        .map(Mappers::tenant)
        .orElseThrow(() -> ApiProblem.notFound("Tenant not found."));
  }

  /** Onboards a tenant as {@code provisioning}. Callers are checked by {@code @PreAuthorize}. */
  @Transactional
  public Tenant create(Caller caller, @Nullable TenantCreate body) {
    if (body == null
        || body.getName() == null
        || body.getCountry() == null
        || body.getCurrency() == null) {
      throw Problems.invalidTenantCreate();
    }
    var result = NewTenant.validate(body.getName(), body.getCountry(), body.getCurrency());
    NewTenant.Valid valid =
        switch (result) {
          case Result.Err<NewTenant.Valid, List<FieldError>>(var errors) ->
              throw ApiProblem.invalidInput(errors);
          case Result.Ok<NewTenant.Valid, List<FieldError>>(var value) -> value;
        };

    String nameKey = NewTenant.nameKey(valid.name());
    if (tenants.existsByNameKey(nameKey)) {
      throw Problems.duplicateName(valid.name());
    }

    Instant now = now();
    TenantEntity entity =
        new TenantEntity(
            "tnt_" + NewTenant.slug(valid.name()) + randomSuffix(),
            valid.name(),
            nameKey,
            valid.country(),
            valid.currency(),
            TenantStatus.PROVISIONING,
            now);
    tenants.saveAndFlush(entity);

    Tenant tenant = Mappers.tenant(entity);
    audit.record(
        tenant.getId(),
        caller,
        "tenant.created",
        "tenant",
        tenant.getId(),
        null,
        json.convertValue(tenant, MAP),
        now);
    return tenant;
  }

  /**
   * Runs a Lifecycle Action. 404 for an unknown tenant, then the domain decides: 403, 409 or 422.
   * The {@code @Version} column turns a concurrent change into 409 instead of a lost update.
   */
  @Transactional
  public Tenant transition(Caller caller, String id, @Nullable LifecycleCommand command) {
    TenantEntity tenant =
        tenants.findById(id).orElseThrow(() -> ApiProblem.notFound("Tenant not found."));
    if (command == null || command.getAction() == null) {
      throw Problems.invalidLifecycleCommand();
    }

    var result = Lifecycle.transition(tenant.getName(), tenant.getStatus(), command, caller.role());
    Lifecycle.Outcome outcome =
        switch (result) {
          case Result.Err<Lifecycle.Outcome, TransitionError>(var error) ->
              throw ApiProblem.of(error);
          case Result.Ok<Lifecycle.Outcome, TransitionError>(var value) -> value;
        };

    Instant now = now();
    tenant.moveTo(outcome.to(), now);
    tenants.saveAndFlush(tenant);
    audit.record(
        tenant.getId(),
        caller,
        outcome.event(),
        "tenant",
        tenant.getId(),
        outcome.before(),
        outcome.after(),
        now);
    return Mappers.tenant(tenant);
  }

  /** Millisecond precision, like the DATETIME(3) columns, so what we return is what we stored. */
  private Instant now() {
    return clock.instant().truncatedTo(ChronoUnit.MILLIS);
  }

  private static String randomSuffix() {
    byte[] bytes = new byte[2];
    ThreadLocalRandom.current().nextBytes(bytes);
    return HexFormat.of().formatHex(bytes);
  }
}
