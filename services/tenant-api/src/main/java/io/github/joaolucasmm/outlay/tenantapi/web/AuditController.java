package io.github.joaolucasmm.outlay.tenantapi.web;

import io.github.joaolucasmm.outlay.tenantapi.api.AuditApi;
import io.github.joaolucasmm.outlay.tenantapi.api.model.AuditEventPage;
import io.github.joaolucasmm.outlay.tenantapi.security.CurrentCaller;
import io.github.joaolucasmm.outlay.tenantapi.service.AuditLog;
import java.time.OffsetDateTime;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class AuditController implements AuditApi {

  private final AuditLog audit;

  public AuditController(AuditLog audit) {
    this.audit = audit;
  }

  @Override
  @PreAuthorize("hasAuthority('audit:read')")
  public ResponseEntity<AuditEventPage> listAuditEvents(
      String tenantId,
      String actorId,
      String action,
      String entity,
      OffsetDateTime from,
      OffsetDateTime to,
      String cursor,
      Integer limit) {
    var filter = new AuditLog.Filter(blank(tenantId), blank(actorId), blank(action), blank(entity), from, to);
    return ResponseEntity.ok(audit.list(CurrentCaller.get(), filter, cursor, limit));
  }

  /** An empty query parameter means "no filter", as in the mock. */
  private static String blank(String value) {
    return value == null || value.isEmpty() ? null : value;
  }
}
