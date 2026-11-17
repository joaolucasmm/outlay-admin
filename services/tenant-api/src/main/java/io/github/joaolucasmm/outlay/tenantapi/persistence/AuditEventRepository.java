package io.github.joaolucasmm.outlay.tenantapi.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface AuditEventRepository
    extends JpaRepository<AuditEventEntity, String>, JpaSpecificationExecutor<AuditEventEntity> {}
