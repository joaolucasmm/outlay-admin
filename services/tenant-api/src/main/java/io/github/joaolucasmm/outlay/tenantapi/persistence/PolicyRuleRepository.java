package io.github.joaolucasmm.outlay.tenantapi.persistence;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PolicyRuleRepository extends JpaRepository<PolicyRuleEntity, String> {

  /** The grid in a stable order: by category, then role. */
  List<PolicyRuleEntity> findByTenantIdOrderByCategoryIdAscRoleAsc(String tenantId);
}
