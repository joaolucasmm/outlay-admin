package io.github.joaolucasmm.outlay.tenantapi.service;

import io.github.joaolucasmm.outlay.tenantapi.api.model.CategoryCreate;
import io.github.joaolucasmm.outlay.tenantapi.api.model.CategoryPage;
import io.github.joaolucasmm.outlay.tenantapi.api.model.CategoryUpdate;
import io.github.joaolucasmm.outlay.tenantapi.api.model.ExpenseCategory;
import io.github.joaolucasmm.outlay.tenantapi.domain.CategoryFields;
import io.github.joaolucasmm.outlay.tenantapi.domain.FieldError;
import io.github.joaolucasmm.outlay.tenantapi.domain.Result;
import io.github.joaolucasmm.outlay.tenantapi.persistence.CategoryEntity;
import io.github.joaolucasmm.outlay.tenantapi.persistence.CategoryRepository;
import io.github.joaolucasmm.outlay.tenantapi.persistence.TenantEntity;
import io.github.joaolucasmm.outlay.tenantapi.security.Caller;
import io.github.joaolucasmm.outlay.tenantapi.web.ApiProblem;
import io.github.joaolucasmm.outlay.tenantapi.web.Cursor;
import io.github.joaolucasmm.outlay.tenantapi.web.Mappers;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.lang.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** A tenant's expense categories. Rules in domain.CategoryFields; access in ProgramGuard. */
@Service
@Transactional(readOnly = true)
public class CategoryService {

  private static final Sort BY_CODE = Sort.by("code", "id");

  private final CategoryRepository categories;
  private final ProgramGuard guard;
  private final AuditLog audit;
  private final Clocks clocks;

  public CategoryService(
      CategoryRepository categories, ProgramGuard guard, AuditLog audit, Clocks clocks) {
    this.categories = categories;
    this.guard = guard;
    this.audit = audit;
    this.clocks = clocks;
  }

  public CategoryPage list(
      Caller caller, String tenantId, @Nullable String cursor, @Nullable Integer limit) {
    TenantEntity tenant = guard.read(caller, tenantId);
    Cursor.CodeKey after = Cursor.decode(cursor, Cursor.CodeKey.class);
    int size = Cursor.limit(limit);

    Specification<CategoryEntity> spec =
        (root, query, cb) -> {
          List<Predicate> where = new ArrayList<>();
          where.add(cb.equal(root.get("tenantId"), tenant.getId()));
          if (after != null) {
            Path<String> code = root.get("code");
            where.add(
                cb.or(
                    cb.greaterThan(code, after.code()),
                    cb.and(cb.equal(code, after.code()), cb.greaterThan(root.get("id"), after.id()))));
          }
          return cb.and(where.toArray(Predicate[]::new));
        };
    List<CategoryEntity> rows = categories.findBy(spec, q -> q.sortBy(BY_CODE).limit(size + 1).all());
    String next = null;
    if (rows.size() > size) {
      CategoryEntity last = rows.get(size - 1);
      next = Cursor.encode(new Cursor.CodeKey(last.getCode(), last.getId()));
    }
    return new CategoryPage(rows.stream().limit(size).map(Mappers::category).toList(), next);
  }

  @Transactional
  public ExpenseCategory create(Caller caller, String tenantId, @Nullable CategoryCreate body) {
    TenantEntity tenant = guard.write(caller, tenantId);
    if (body == null || body.getCode() == null || body.getName() == null) {
      throw ApiProblem.invalidInput(
          List.of(new FieldError("code", "Body must be a CategoryCreate.")));
    }
    CategoryFields valid =
        valid(
            CategoryFields.of(body.getCode(), body.getName())
                .withGlAccount(body.getGlAccount().orElse(null)));

    String code = Objects.requireNonNull(valid.code());
    if (categories.existsByTenantIdAndCode(tenant.getId(), code)) {
      String message = "The code " + code + " is already used.";
      throw new ApiProblem(409, "Duplicate code", message, List.of(new FieldError("code", message)));
    }

    CategoryEntity category =
        categories.save(
            new CategoryEntity(
                "cat_" + UUID.randomUUID(),
                tenant.getId(),
                code,
                Objects.requireNonNull(valid.name()),
                valid.glAccount(),
                true));
    ExpenseCategory dto = Mappers.category(category);
    audit.record(
        tenant.getId(), caller, "category.created", "category", category.getId(), null,
        audit.asMap(dto), clocks.now());
    return dto;
  }

  /** Changes name, GL account and active flag; never the code. Audits only what changed. */
  @Transactional
  public ExpenseCategory update(
      Caller caller, String tenantId, String categoryId, @Nullable CategoryUpdate body) {
    TenantEntity tenant = guard.write(caller, tenantId);
    CategoryEntity category =
        categories
            .findByIdAndTenantId(categoryId, tenant.getId())
            .orElseThrow(() -> ApiProblem.notFound("Category not found."));
    CategoryUpdate update = body == null ? new CategoryUpdate() : body;

    CategoryFields fields = CategoryFields.of(null, update.getName());
    if (update.getGlAccount().isPresent()) fields = fields.withGlAccount(update.getGlAccount().get());
    CategoryFields valid = valid(fields);

    Map<String, Object> before = new LinkedHashMap<>();
    Map<String, Object> after = new LinkedHashMap<>();
    if (valid.name() != null && !valid.name().equals(category.getName())) {
      before.put("name", category.getName());
      after.put("name", valid.name());
      category.setName(valid.name());
    }
    if (valid.hasGlAccount() && !Objects.equals(valid.glAccount(), category.getGlAccount())) {
      before.put("glAccount", category.getGlAccount());
      after.put("glAccount", valid.glAccount());
      category.setGlAccount(valid.glAccount());
    }
    if (update.getActive() != null && update.getActive() != category.isActive()) {
      before.put("active", category.isActive());
      after.put("active", update.getActive());
      category.setActive(update.getActive());
    }
    if (!after.isEmpty()) {
      audit.record(
          tenant.getId(), caller, "category.updated", "category", category.getId(), before, after,
          clocks.now());
    }
    return Mappers.category(category);
  }

  private static CategoryFields valid(CategoryFields fields) {
    return switch (fields.validate()) {
      case Result.Ok<CategoryFields, List<FieldError>>(var value) -> value;
      case Result.Err<CategoryFields, List<FieldError>>(var errors) ->
          throw ApiProblem.invalidInput(errors);
    };
  }
}
