package io.github.joaolucasmm.outlay.tenantapi.persistence;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

public interface EmployeeRepository
    extends JpaRepository<EmployeeEntity, String>, JpaSpecificationExecutor<EmployeeEntity> {

  @Query("select e.email from EmployeeEntity e where e.tenantId = :tenantId")
  List<String> findEmailsByTenantId(String tenantId);
}
