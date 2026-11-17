package io.github.joaolucasmm.outlay.tenantapi.web;

import io.github.joaolucasmm.outlay.tenantapi.api.TenantsApi;
import io.github.joaolucasmm.outlay.tenantapi.api.model.LifecycleCommand;
import io.github.joaolucasmm.outlay.tenantapi.api.model.Tenant;
import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantCreate;
import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantPage;
import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantStatus;
import io.github.joaolucasmm.outlay.tenantapi.security.CurrentCaller;
import io.github.joaolucasmm.outlay.tenantapi.service.TenantService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

/** Implements the generated {@link TenantsApi}: paths, parameters and DTOs come from the contract. */
@RestController
public class TenantsController implements TenantsApi {

  private final TenantService tenants;

  public TenantsController(TenantService tenants) {
    this.tenants = tenants;
  }

  @Override
  public ResponseEntity<TenantPage> listTenants(
      String q, TenantStatus status, String cursor, Integer limit) {
    return ResponseEntity.ok(tenants.list(CurrentCaller.get(), q, status, cursor, limit));
  }

  @Override
  public ResponseEntity<Tenant> getTenant(String tenantId) {
    return ResponseEntity.ok(tenants.get(CurrentCaller.get(), tenantId));
  }

  @Override
  @PreAuthorize("hasAuthority('tenants:create')")
  public ResponseEntity<Tenant> createTenant(TenantCreate tenantCreate) {
    return ResponseEntity.status(HttpStatus.CREATED)
        .body(tenants.create(CurrentCaller.get(), tenantCreate));
  }

  /** No {@code @PreAuthorize}: the domain owns the lifecycle permission and its message. */
  @Override
  public ResponseEntity<Tenant> transitionTenant(String tenantId, LifecycleCommand command) {
    return ResponseEntity.ok(tenants.transition(CurrentCaller.get(), tenantId, command));
  }
}
