package io.github.joaolucasmm.outlay.tenantapi.web;

import io.github.joaolucasmm.outlay.tenantapi.api.DemoApi;
import io.github.joaolucasmm.outlay.tenantapi.api.model.Persona;
import io.github.joaolucasmm.outlay.tenantapi.security.PersonaDirectory;
import io.github.joaolucasmm.outlay.tenantapi.service.DemoSeed;
import java.util.List;
import org.springframework.context.annotation.Profile;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RestController;

/** Demo-only endpoints: who you can be, and putting the seed data back. */
@RestController
@Profile("demo")
public class DemoController implements DemoApi {

  private final PersonaDirectory personas;
  private final DemoSeed seed;

  public DemoController(PersonaDirectory personas, DemoSeed seed) {
    this.personas = personas;
    this.seed = seed;
  }

  @Override
  public ResponseEntity<List<Persona>> listPersonas() {
    return ResponseEntity.ok(personas.all());
  }

  @Override
  public ResponseEntity<Void> resetDemo() {
    seed.reset();
    return ResponseEntity.noContent().build();
  }
}
