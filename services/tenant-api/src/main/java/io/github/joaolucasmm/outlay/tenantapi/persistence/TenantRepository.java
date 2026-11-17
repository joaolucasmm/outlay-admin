package io.github.joaolucasmm.outlay.tenantapi.persistence;

import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantStatus;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface TenantRepository
    extends JpaRepository<TenantEntity, String>, JpaSpecificationExecutor<TenantEntity> {

  boolean existsByNameKey(String nameKey);

  /** Tenants whose Program Admin can still sign in, by name. */
  @Query("select t from TenantEntity t where t.status <> :excluded order by t.name, t.id")
  List<TenantEntity> findAllExcept(String excluded);

  default List<TenantEntity> findSignInable() {
    return findAllExcept(TenantStatus.DEPROVISIONED.getValue());
  }
}
