package io.github.joaolucasmm.outlay.tenantapi.persistence;

import io.github.joaolucasmm.outlay.tenantapi.api.model.TenantStatus;
import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface TenantRepository
    extends JpaRepository<TenantEntity, String>, JpaSpecificationExecutor<TenantEntity> {

  boolean existsByNameKey(String nameKey);

  /**
   * Locks the tenant row until the transaction ends ({@code SELECT ... FOR UPDATE}), so a program
   * write and a lifecycle action on the same tenant cannot interleave.
   */
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select t from TenantEntity t where t.id = :id")
  Optional<TenantEntity> findForUpdate(String id);

  /** Tenants whose Program Admin can still sign in, by name. */
  @Query("select t from TenantEntity t where t.status <> :excluded order by t.name, t.id")
  List<TenantEntity> findAllExcept(String excluded);

  default List<TenantEntity> findSignInable() {
    return findAllExcept(TenantStatus.DEPROVISIONED.getValue());
  }
}
