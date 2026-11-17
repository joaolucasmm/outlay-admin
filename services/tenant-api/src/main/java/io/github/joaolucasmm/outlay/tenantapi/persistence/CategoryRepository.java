package io.github.joaolucasmm.outlay.tenantapi.persistence;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface CategoryRepository
    extends JpaRepository<CategoryEntity, String>, JpaSpecificationExecutor<CategoryEntity> {

  List<CategoryEntity> findByTenantId(String tenantId);

  Optional<CategoryEntity> findByIdAndTenantId(String id, String tenantId);

  boolean existsByTenantIdAndCode(String tenantId, String code);
}
