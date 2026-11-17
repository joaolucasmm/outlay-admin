package io.github.joaolucasmm.outlay.tenantapi.security;

import io.github.joaolucasmm.outlay.tenantapi.web.ApiProblem;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

/** Reads the {@link Caller} that the security filter chain authenticated. */
public final class CurrentCaller {

  private CurrentCaller() {}

  public static Caller get() {
    Authentication auth = SecurityContextHolder.getContext().getAuthentication();
    if (auth != null && auth.getPrincipal() instanceof Caller caller) {
      return caller;
    }
    throw ApiProblem.unauthenticated();
  }
}
