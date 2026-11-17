package io.github.joaolucasmm.outlay.tenantapi;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration;

// No user store: callers are authenticated by a filter (ADR 0006), never by username and password.
@SpringBootApplication(exclude = UserDetailsServiceAutoConfiguration.class)
public class TenantApiApplication {

  public static void main(String[] args) {
    SpringApplication.run(TenantApiApplication.class, args);
  }
}
