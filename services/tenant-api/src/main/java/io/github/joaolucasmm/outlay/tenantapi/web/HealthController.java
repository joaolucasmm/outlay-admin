package io.github.joaolucasmm.outlay.tenantapi.web;

import io.github.joaolucasmm.outlay.tenantapi.api.SystemApi;
import io.github.joaolucasmm.outlay.tenantapi.api.model.Health;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class HealthController implements SystemApi {

  @Override
  public ResponseEntity<Health> getHealth() {
    return ResponseEntity.ok(new Health(Health.StatusEnum.OK, Health.ModeEnum.LIVE));
  }
}
