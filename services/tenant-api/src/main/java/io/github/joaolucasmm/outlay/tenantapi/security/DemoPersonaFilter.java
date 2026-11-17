package io.github.joaolucasmm.outlay.tenantapi.security;

import io.github.joaolucasmm.outlay.tenantapi.domain.Permission;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Authenticates the {@code X-Demo-Persona} header (ADR 0006). The only demo-specific piece of
 * security: replacing it with a JWT or session filter that builds the same {@link Caller} and
 * permission authorities leaves controllers and {@code @PreAuthorize} rules untouched.
 */
public class DemoPersonaFilter extends OncePerRequestFilter {

  public static final String HEADER = "X-Demo-Persona";

  private final PersonaDirectory personas;

  public DemoPersonaFilter(PersonaDirectory personas) {
    this.personas = personas;
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String id = request.getHeader(HEADER);
    if (id != null) {
      personas
          .find(id)
          .ifPresent(
              persona -> {
                Caller caller =
                    new Caller(
                        persona.getId(), persona.getRole(), persona.getTenantId().orElse(null));
                var authorities =
                    Permission.grantedTo(caller.role()).stream()
                        .map(p -> new SimpleGrantedAuthority(p.value()))
                        .toList();
                SecurityContextHolder.getContext()
                    .setAuthentication(
                        UsernamePasswordAuthenticationToken.authenticated(
                            caller, null, authorities));
              });
    }
    chain.doFilter(request, response);
  }
}
