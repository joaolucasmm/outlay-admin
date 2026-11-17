package io.github.joaolucasmm.outlay.tenantapi.security;

import io.github.joaolucasmm.outlay.tenantapi.api.model.AdminRole;
import io.github.joaolucasmm.outlay.tenantapi.api.model.Persona;
import io.github.joaolucasmm.outlay.tenantapi.persistence.TenantRepository;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

/**
 * The demo identities (ADR 0002): the Support Operator plus one Program Admin per tenant that can
 * still sign in. Same ids as the web mock.
 */
@Component
@Profile("demo")
public class PersonaDirectory {

  public static final String OPERATOR_ID = "per_operator";

  private final TenantRepository tenants;

  public PersonaDirectory(TenantRepository tenants) {
    this.tenants = tenants;
  }

  public static String adminId(String tenantId) {
    return "per_admin_" + tenantId;
  }

  public List<Persona> all() {
    List<Persona> personas = new ArrayList<>();
    personas.add(new Persona(OPERATOR_ID, "Support Operator", AdminRole.SUPPORT_OPERATOR, null));
    tenants
        .findSignInable()
        .forEach(
            t ->
                personas.add(
                    new Persona(
                        adminId(t.getId()),
                        "Program Admin · " + t.getName(),
                        AdminRole.PROGRAM_ADMIN,
                        t.getId())));
    return personas;
  }

  public Optional<Persona> find(String id) {
    return all().stream().filter(p -> p.getId().equals(id)).findFirst();
  }
}
